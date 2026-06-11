// SUI Wallet Profile Plugin — main entry
// Required plugin: other plugins depend on this for wallet context
// Connects wallet, resolves SuiNS, lists tokens, shares context via SuiHostAPI

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ComponentType,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import {
  DAppKitProvider,
  useDAppKit,
  useCurrentAccount,
  useCurrentNetwork,
  useCurrentClient,
  useWallets,
  useWalletConnection,
} from '@mysten/dapp-kit-react'
import { createDAppKit } from '@mysten/dapp-kit-core'

import {
  GRPC_URLS,
  SHARED_KEY,
  PREDICT_CLUB_WALLET_PROFILE_KEY,
  NETWORKS,
  type Network,
  type PredictClubWalletProfile,
  type TokenBalance,
  type WalletAccount,
  type WalletProfile,
  getSuiScanAccountUrl,
  getSuiScanObjectUrl,
  isFullSuiAddress,
  shortenAddress,
} from './types'
import { ConnectPopup } from './ConnectPopup'
import { NetworkSelector } from './NetworkSelector'
import { ProfileHeader } from './ProfileHeader'
import { TokenList } from './TokenList'
import './style.css'

let sharedHost: SuiHostAPI | null = null

// Standalone DAppKit (only when NOT in sui-dashboard)
const standaloneDAppKit = createDAppKit({
  networks: ['mainnet', 'testnet', 'devnet'],
  defaultNetwork: 'mainnet',
  createClient: (network) => new SuiGrpcClient({ network, baseUrl: GRPC_URLS[network as Network] }),
})

declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof standaloneDAppKit
  }
}

// Known token decimals
const KNOWN_DECIMALS: Record<string, number> = {
  SUI: 9,
  USDC: 6,
  USDT: 6,
  WAL: 9,
  DEEP: 6,
  NS: 6,
  WUSDC: 6,
  WUSDT: 6,
}

function getDecimals(coinType: string): number {
  const symbol = coinType.split('::').pop() ?? ''
  return KNOWN_DECIMALS[symbol] ?? 9
}

const PROFILE_CACHE_TTL_MS = 30_000

interface ProfileDataCacheValue {
  tokens: TokenBalance[]
  suinsName: string | null
  updatedAt: number
}

interface WalletProfileClient {
  core: {
    listBalances: (input: { owner: string }) => Promise<{
      balances: Array<{ coinType: string; balance: string }>
    }>
    defaultNameServiceName: (input: { address: string }) => Promise<{
      data: { name: string | null }
    }>
  }
}

const profileDataCache = new Map<string, ProfileDataCacheValue>()
const profileDataInflight = new Map<string, Promise<ProfileDataCacheValue>>()

function profileCacheKey(network: string, address: string) {
  return `${network}:${address.toLowerCase()}`
}

async function loadProfileData(
  client: WalletProfileClient,
  address: string,
  network: string,
): Promise<ProfileDataCacheValue> {
  const key = profileCacheKey(network, address)
  const cached = profileDataCache.get(key)
  if (cached && Date.now() - cached.updatedAt < PROFILE_CACHE_TTL_MS) return cached

  const inflight = profileDataInflight.get(key)
  if (inflight) return inflight

  const request = (async () => {
    const { balances: raw } = await client.core.listBalances({ owner: address })
    const tokens: TokenBalance[] = raw
      .map((b) => {
        const symbol = b.coinType.split('::').pop() ?? 'Unknown'
        return {
          coinType: b.coinType,
          symbol,
          balance: b.balance,
          decimals: getDecimals(b.coinType),
        }
      })
      .sort((a, b) => {
        if (a.symbol === 'SUI') return -1
        if (b.symbol === 'SUI') return 1
        return Number(b.balance) - Number(a.balance)
      })

    let nextSuinsName: string | null = null
    try {
      const { data } = await client.core.defaultNameServiceName({ address })
      nextSuinsName = data.name
    } catch {
      nextSuinsName = null
    }

    const value = { tokens, suinsName: nextSuinsName, updatedAt: Date.now() }
    profileDataCache.set(key, value)
    return value
  })()

  profileDataInflight.set(key, request)
  try {
    return await request
  } catch (error) {
    if (cached) return cached
    throw error
  } finally {
    profileDataInflight.delete(key)
  }
}

interface WalletProfileContentProps {
  embedded?: boolean
  open?: boolean
  onClose?: () => void
}

function normalizeNetwork(network: string): Network {
  return NETWORKS.includes(network as Network) ? (network as Network) : 'testnet'
}

function useHostSuiContext() {
  const [ctx, setCtx] = useState(() => sharedHost?.getSuiContext() ?? null)

  useEffect(() => {
    if (!sharedHost) return undefined
    setCtx(sharedHost.getSuiContext())
    return sharedHost.onSuiContextChange(setCtx)
  }, [])

  return ctx
}

function usePredictClubWalletProfile() {
  const [profile, setProfile] = useState<PredictClubWalletProfile | null>(() => {
    if (!sharedHost) return null
    return (
      (sharedHost.getSharedData(PREDICT_CLUB_WALLET_PROFILE_KEY) as PredictClubWalletProfile) ??
      null
    )
  })

  useEffect(() => {
    if (!sharedHost) return undefined
    setProfile(
      (sharedHost.getSharedData(PREDICT_CLUB_WALLET_PROFILE_KEY) as PredictClubWalletProfile) ??
        null,
    )
    return sharedHost.onSharedDataChange(PREDICT_CLUB_WALLET_PROFILE_KEY, (value) => {
      setProfile((value as PredictClubWalletProfile) ?? null)
    })
  }, [])

  return profile
}

function stopPropagation(event: MouseEvent) {
  event.stopPropagation()
}

function formatOptionalAmount(value: number | null | undefined, suffix = '') {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Unavailable'
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 4 })}${suffix}`
}

function formatProfileError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  if (message.includes('429') || message.includes('Too Many Requests')) {
    return 'Sui RPC rate limit reached. Cached wallet data will be used when available; retry shortly.'
  }
  return message || 'Failed to load profile'
}

// --- Core content (used in both modes) ---
function WalletProfileContent({
  embedded = false,
  open = true,
  onClose,
}: WalletProfileContentProps) {
  const wallets = useWallets()
  const connection = useWalletConnection()
  const account = useCurrentAccount()
  const network = useCurrentNetwork()
  const client = useCurrentClient()
  const dAppKit = useDAppKit()
  const hostContext = useHostSuiContext()
  const predictProfile = usePredictClubWalletProfile()
  const popupRef = useRef<HTMLElement | null>(null)

  // Determine effective connection state:
  // Prefer dApp Kit hooks, fall back to host context for cross-bundle scenarios
  const effectiveConnected = connection.isConnected || (hostContext?.isConnected ?? false)
  const effectiveAddress = account?.address ?? hostContext?.address ?? null

  const [showPopup, setShowPopup] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [balances, setBalances] = useState<TokenBalance[]>([])
  const [suinsName, setSuinsName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch balances + SuiNS
  const fetchProfile = useCallback(async () => {
    const addr = effectiveAddress
    if (embedded && !open) return
    if (!addr || !client) return
    setLoading(true)
    setError(null)

    try {
      const { tokens, suinsName: nextSuinsName } = await loadProfileData(
        client as WalletProfileClient,
        addr,
        network,
      )
      setBalances(tokens)
      setSuinsName(nextSuinsName)

      // Share profile via host API
      if (sharedHost) {
        const profile: WalletProfile = {
          address: addr,
          suinsName: nextSuinsName,
          network: normalizeNetwork(network),
          balances: tokens,
          walletName: connection.wallet?.name,
          walletIcon: connection.wallet?.icon,
          accounts: hostContext?.accounts?.length
            ? hostContext.accounts.map((a) => ({
                address: a.address,
                walletName: a.walletName,
                walletIcon: a.walletIcon,
              }))
            : [
                {
                  address: addr,
                  walletName: connection.wallet?.name,
                  walletIcon: connection.wallet?.icon,
                },
              ],
        }
        sharedHost.setSharedData(SHARED_KEY, profile)
      }
    } catch (err) {
      setError(formatProfileError(err))
    } finally {
      setLoading(false)
    }
  }, [
    client,
    effectiveAddress,
    embedded,
    open,
    network,
    connection.wallet?.name,
    connection.wallet?.icon,
    hostContext?.accounts,
  ])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  // Sync to SuiHostAPI context
  useEffect(() => {
    if (!sharedHost || !effectiveAddress) return
    sharedHost.setSharedData(SHARED_KEY, {
      address: effectiveAddress,
      suinsName,
      network: normalizeNetwork(network),
      balances,
      walletName: connection.wallet?.name,
      walletIcon: connection.wallet?.icon,
      accounts: hostContext?.accounts?.length
        ? hostContext.accounts.map((a) => ({
            address: a.address,
            walletName: a.walletName,
            walletIcon: a.walletIcon,
          }))
        : [
            {
              address: effectiveAddress,
              walletName: connection.wallet?.name,
              walletIcon: connection.wallet?.icon,
            },
          ],
    } satisfies WalletProfile)
  }, [
    effectiveAddress,
    suinsName,
    network,
    balances,
    connection.wallet?.name,
    connection.wallet?.icon,
    hostContext?.accounts,
  ])

  // Register transaction signer so other plugins can sign via host API
  useEffect(() => {
    if (!sharedHost || !effectiveConnected) return
    sharedHost.registerSigner(async (transaction) => {
      const result = await dAppKit.signAndExecuteTransaction({ transaction })
      const tx = result.Transaction ?? result.FailedTransaction
      if (result.$kind === 'FailedTransaction') {
        throw new Error(`Transaction failed: ${tx?.digest}`)
      }
      return { digest: tx!.digest, effects: tx }
    })
  }, [effectiveConnected, dAppKit])

  // Listen for network switch from dashboard header
  useEffect(() => {
    if (!sharedHost) return
    return sharedHost.onSharedDataChange('networkSwitch', (v) => {
      const net = v as string | null
      if (net && NETWORKS.includes(net as Network)) {
        dAppKit.switchNetwork(net as Network)
      }
    })
  }, [dAppKit])

  const handleConnect = async (wallet: { name: string }) => {
    setConnecting(true)
    setError(null)
    try {
      const w = wallets.find((w) => w.name === wallet.name)
      if (w) await dAppKit.connectWallet({ wallet: w })
      setShowPopup(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = () => {
    if (sharedHost) sharedHost.requestDisconnect()
    else dAppKit.disconnectWallet()
    setBalances([])
    setSuinsName(null)
    if (sharedHost) sharedHost.setSharedData(SHARED_KEY, null)
    onClose?.()
  }

  const handleNetworkChange = (n: Network) => {
    dAppKit.switchNetwork(n)
    if (sharedHost) sharedHost.requestNetworkSwitch(n)
  }

  useEffect(() => {
    if (!embedded || !open) return undefined
    const frame = window.requestAnimationFrame(() => popupRef.current?.focus())
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [embedded, open, onClose])

  const explorerUrl = effectiveAddress
    ? getSuiScanAccountUrl(effectiveAddress, normalizeNetwork(network))
    : null

  const accounts: WalletAccount[] =
    hostContext?.accounts?.length && effectiveAddress
      ? hostContext.accounts.map((a) => ({
          address: a.address,
          walletName: a.walletName,
          walletIcon: a.walletIcon,
        }))
      : effectiveAddress
        ? [
            {
              address: effectiveAddress,
              walletName: connection.wallet?.name,
              walletIcon: connection.wallet?.icon,
            },
          ]
        : []
  const activeAccount = accounts.find((item) => item.address === effectiveAddress)
  const effectiveWalletName = connection.wallet?.name ?? activeAccount?.walletName ?? 'Wallet'
  const effectiveWalletIcon = connection.wallet?.icon ?? activeAccount?.walletIcon

  const body =
    !effectiveConnected || !effectiveAddress ? (
      <div className="swp">
        <div className="swp__header">
          <h3 className="swp__title">Wallet Profile</h3>
          <span className="swp__required-badge">Required</span>
        </div>
        <p className="swp__desc">Connect your wallet to enable all plugins</p>

        <NetworkSelector current={network as Network} onChange={handleNetworkChange} />

        <button className="swp__connect-btn" onClick={() => setShowPopup(true)}>
          Connect Wallet
        </button>

        {error && <div className="swp__error">{error}</div>}

        {showPopup && (
          <ConnectPopup
            wallets={wallets.map((w) => ({ name: w.name, icon: w.icon }))}
            onConnect={handleConnect}
            onClose={() => setShowPopup(false)}
            connecting={connecting}
          />
        )}
      </div>
    ) : (
      <div className="swp">
        <div className="swp__header">
          <h3 className="swp__title">Wallet Profile</h3>
          <span className="swp__connected-badge">Connected</span>
        </div>

        <ProfileHeader
          address={effectiveAddress!}
          suinsName={suinsName}
          walletName={effectiveWalletName}
          walletIcon={effectiveWalletIcon}
          network={normalizeNetwork(network)}
          onDisconnect={handleDisconnect}
        />

        <AccountList
          accounts={accounts}
          network={normalizeNetwork(network)}
          activeAddress={effectiveAddress!}
        />

        <NetworkSelector current={network as Network} onChange={handleNetworkChange} />

        {explorerUrl && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="swp__explorer-link"
          >
            View on Explorer ↗
          </a>
        )}

        {error && <div className="swp__error">{error}</div>}

        <TokenList balances={balances} loading={loading} />

        <PredictExtension profile={predictProfile} network={normalizeNetwork(network)} />

        <div className="swp__footer">
          Wallet context shared with all plugins via <code>sharedData.{SHARED_KEY}</code>
        </div>
      </div>
    )

  if (!embedded) return body
  if (!open) return null

  return (
    <div className="swp__overlay swp__profile-overlay" onClick={onClose}>
      <section
        ref={popupRef}
        className="swp__popup swp__profile-popup"
        onClick={stopPropagation}
        tabIndex={-1}
      >
        <div className="swp__popup-header">
          <h2 className="swp__popup-title">Wallet Profile</h2>
          <button className="swp__popup-close" type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {body}
      </section>
    </div>
  )
}

function CopyableAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)
  const canCopy = isFullSuiAddress(address)

  const copyAddress = async () => {
    if (!canCopy) return
    await navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <button
      className="swp__icon-action"
      type="button"
      disabled={!canCopy}
      onClick={copyAddress}
      title={canCopy ? 'Copy full address' : 'Copy unavailable'}
      aria-label="Copy full address"
    >
      {copied ? '✓' : '⎘'}
    </button>
  )
}

function SuiScanObjectControl({
  objectId,
  network,
  label = 'object',
}: {
  objectId: string
  network: Network
  label?: string
}) {
  const [copied, setCopied] = useState(false)

  const copyObjectId = async () => {
    try {
      await navigator.clipboard.writeText(objectId)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <span className="swp__object-control" title={objectId}>
      <button
        className="swp__object-id"
        type="button"
        onClick={copyObjectId}
        aria-label={`Copy ${label} id`}
      >
        {shortenAddress(objectId)}
      </button>
      <button
        className="swp__icon-action"
        type="button"
        onClick={copyObjectId}
        title={`Copy ${label} id`}
        aria-label={`Copy ${label} id`}
      >
        {copied ? '✓' : '⎘'}
      </button>
      <a
        className="swp__icon-action"
        href={getSuiScanObjectUrl(objectId, network)}
        target="_blank"
        rel="noopener noreferrer"
        title={`View ${label} on SuiScan`}
        aria-label={`View ${label} on SuiScan`}
      >
        ↗
      </a>
    </span>
  )
}

function AccountList({
  accounts,
  network,
  activeAddress,
}: {
  accounts: WalletAccount[]
  network: Network
  activeAddress: string
}) {
  if (!accounts.length) return null

  return (
    <section className="swp__section">
      <div className="swp__section-title">Accounts ({accounts.length})</div>
      <div className="swp__account-list">
        {accounts.map((account) => (
          <div className="swp__account-row" key={account.address}>
            {account.walletIcon ? (
              <img src={account.walletIcon} alt="" className="swp__account-icon" />
            ) : null}
            <div className="swp__account-main">
              <span className="swp__account-address">{shortenAddress(account.address)}</span>
              <span className="swp__account-wallet">
                {account.address === activeAddress ? 'Active' : (account.walletName ?? 'Wallet')}
              </span>
            </div>
            <CopyableAddress address={account.address} />
            <a
              className="swp__icon-action"
              href={getSuiScanAccountUrl(account.address, network)}
              target="_blank"
              rel="noopener noreferrer"
              title="View account on SuiScan"
              aria-label="View account on SuiScan"
            >
              ↗
            </a>
          </div>
        ))}
      </div>
    </section>
  )
}

function PredictExtension({
  profile,
  network,
}: {
  profile: PredictClubWalletProfile | null
  network: Network
}) {
  if (!profile) return null

  const managerId = profile.manager?.id ?? null
  const binaryPositions =
    profile.binaryPositions ??
    profile.positions?.filter((position) => position.kind === 'binary').length ??
    null
  const rangePositions =
    profile.rangePositions ??
    profile.positions?.filter((position) => position.kind === 'range').length ??
    null

  return (
    <section className="swp__section swp__predict">
      <div className="swp__section-title">Predict Club</div>
      <div className="swp__metric-grid">
        <DataMetric label="DUSDC" value={formatOptionalAmount(profile.balances?.dusdc)} />
        <DataMetric
          label="Binary"
          value={binaryPositions === null ? 'Unavailable' : String(binaryPositions)}
        />
        <DataMetric
          label="RANGE"
          value={rangePositions === null ? 'Unavailable' : String(rangePositions)}
        />
      </div>
      <div className="swp__data-list">
        <DataRow
          label="PredictManager"
          value={
            managerId ? (
              <SuiScanObjectControl objectId={managerId} network={network} label="PredictManager" />
            ) : (
              (profile.manager?.status ?? 'Unavailable')
            )
          }
        />
        <DataRow
          label="Manager balance"
          value={formatOptionalAmount(profile.manager?.quoteBalance, ' DUSDC')}
        />
        <DataRow
          label="Vault liquidity"
          value={formatOptionalAmount(profile.vault?.availableLiquidity, ' DUSDC')}
        />
        <DataRow
          label="Max payout"
          value={formatOptionalAmount(profile.vault?.totalMaxPayout, ' DUSDC')}
        />
        <DataRow
          label="Wallet LP share"
          value={
            profile.vault?.walletLpShare === null || profile.vault?.walletLpShare === undefined
              ? 'Unavailable'
              : `${(profile.vault.walletLpShare * 100).toFixed(4)}%`
          }
        />
      </div>
      {profile.positions?.length ? (
        <div className="swp__position-list">
          {profile.positions.slice(0, 4).map((position) => (
            <div className="swp__position-row" key={position.id}>
              <div className="swp__position-main">
                <span>{position.kind}</span>
                <strong>{position.quantity ? `${position.quantity} contracts` : 'Position'}</strong>
              </div>
              <SuiScanObjectControl objectId={position.id} network={network} label="position" />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function DataMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="swp__metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function DataRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="swp__data-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

// Standalone wrapper — always provides its own DAppKitProvider
// Works in both WASM dashboard and plugin-demo pages
// Still uses sharedHost for cross-plugin data sharing when available
function WalletProfileStandalone() {
  return (
    <DAppKitProvider dAppKit={standaloneDAppKit}>
      <WalletProfileContent />
    </DAppKitProvider>
  )
}

function WalletProfileEmbedded(props: WalletProfileContentProps) {
  return <WalletProfileContent embedded {...props} />
}

const SuiWalletProfilePlugin: Plugin = {
  name: 'SuiWalletProfile',
  version: '1.0.0',
  styleUrls: ['/plugins/sui-wallet-profile/style.css'],

  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('SuiWalletProfile', WalletProfileStandalone)
    host.registerComponent(
      'SuiWalletProfile.Embedded',
      WalletProfileEmbedded as ComponentType<unknown>,
    )
    host.registerComponent(
      'SuiWalletProfile.Popup',
      WalletProfileEmbedded as ComponentType<unknown>,
    )
    host.log(
      'SuiWalletProfile initialized' +
        (sharedHost ? ' (standalone + embedded shared data)' : ' (standalone)'),
    )
  },

  mount() {
    console.log('[SuiWalletProfile] mounted')
  },

  unmount() {
    if (sharedHost) sharedHost.setSharedData(SHARED_KEY, null)
    sharedHost = null
    console.log('[SuiWalletProfile] unmounted')
  },
}

export default SuiWalletProfilePlugin
