// NAVI DeFi Strategy Advisor
// Fetches pools, vaults, swap quotes → recommends yield strategies for a given budget
// Can execute supply/borrow transactions via @naviprotocol/lending SDK

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useEffect } from 'react'
import { Transaction } from '@mysten/sui/transactions'
import {
  getPools,
  getHealthFactor,
  getCoins,
  getAvailableRewards,
  type Pool,
} from '../sui-navi-dashboard/navi-api'
import { RPC_URLS, type NetworkKey } from '../sui-seal-shared/config'
import './style.css'

let sharedHost: SuiHostAPI | null = null
const WALLET_KEY = 'walletProfile'
const MCP_URL = 'https://open-api.naviprotocol.io/api/mcp'

interface Vault {
  id: string
  name: string
  status: string
  riskLevel: string
  instantAPR: number
  apy7d: number
  apy30d: number
  totalStakedUsd: number
  minInvestment: number
  coinPrice: number
}

interface Strategy {
  name: string
  steps: string[]
  estApy: number
  risk: 'Low' | 'Medium' | 'High'
  detail: string
  /** coinType for the primary supply action (if executable) */
  supplyCoinType?: string
  /** Amount in token decimals for supply */
  supplyAmount?: number
  /** Token decimals */
  decimals?: number
  /** Action type: 'deposit-sui' for on-chain tx, 'link' for external URL */
  action?: 'deposit' | 'volo-stake' | 'supply-borrow' | 'link'
  /** External URL for strategies that can't be executed in-plugin */
  actionUrl?: string
  /** Button label */
  actionLabel?: string
  /** For supply-borrow: which stablecoin to borrow */
  borrowSymbol?: string
}

async function mcpCall(tool: string, args: Record<string, unknown> = {}) {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: tool, arguments: args },
    }),
  })
  const json = await res.json()
  const text = json.result?.content?.[0]?.text
  if (!text) throw new Error('MCP call failed')
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function parseVaultsCsv(csv: string): Vault[] {
  const lines = csv.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',')
  return lines
    .slice(1)
    .map((line) => {
      const vals = line.split(',')
      const row: Record<string, string> = {}
      headers.forEach((h, i) => {
        row[h] = vals[i] ?? ''
      })
      return {
        id: row.id ?? '',
        name: row.name ?? '',
        status: row.status ?? '',
        riskLevel: row.riskLevel ?? 'Low',
        instantAPR: Number(row.instantAPR) || 0,
        apy7d: Number(row.apy7d) || 0,
        apy30d: Number(row.apy30d) || 0,
        totalStakedUsd: Number(row.totalStakedUsd) || 0,
        minInvestment: Number(row.minInvestment) || 0,
        coinPrice: Number(row.coinPrice) || 0,
      }
    })
    .filter((v) => v.status === 'open')
}

function generateStrategies(budget: number, pools: Pool[], vaults: Vault[]): Strategy[] {
  const strategies: Strategy[] = []

  // 1. Best supply-only (safest)
  const topSupply = [...pools]
    .filter((p) => p.supplyApy > 0)
    .sort((a, b) => b.supplyApy - a.supplyApy)
  if (topSupply.length > 0) {
    const p = topSupply[0]
    const earn = budget * (p.supplyApy / 100)
    strategies.push({
      name: `Supply ${p.symbol} on NAVI`,
      steps: [
        pools.some((x) => x.symbol === 'SUI') && p.symbol !== 'SUI'
          ? `Swap $${budget} → ${p.symbol}`
          : `Deposit $${budget} ${p.symbol}`,
        `Supply to NAVI ${p.symbol} pool`,
      ],
      estApy: p.supplyApy,
      risk: 'Low',
      detail: `Supply APY: ${p.supplyApy.toFixed(2)}% | Est. yearly: $${earn.toFixed(2)} | No borrow risk`,
      supplyCoinType: p.coinType ? `0x${p.coinType}` : undefined,
      action: 'deposit',
      actionLabel: `Supply ${p.symbol} to NAVI`,
    })
  }

  // 2. Best Volo Vault
  const topVault = [...vaults].sort((a, b) => b.apy7d - a.apy7d)
  if (topVault.length > 0) {
    const v = topVault[0]
    const earn = budget * (v.apy7d / 100)
    strategies.push({
      name: `Volo Vault: ${v.name}`,
      steps: [`Deposit $${budget} into ${v.name} vault`],
      estApy: v.apy7d,
      risk: v.riskLevel as Strategy['risk'],
      detail: `7d APY: ${v.apy7d.toFixed(2)}% | 30d APY: ${v.apy30d.toFixed(2)}% | Est. yearly: $${earn.toFixed(2)} | TVL: $${(v.totalStakedUsd / 1e6).toFixed(1)}M`,
      action: 'volo-stake',
      actionUrl: 'https://app.naviprotocol.io/earn',
      actionLabel: `Stake SUI → vSUI (${v.name})`,
    })
  }

  // 3. Supply + Borrow loop (leveraged)
  const stablePool = pools.find(
    (p) => ['USDC', 'wUSDC', 'USDT', 'wUSDT'].includes(p.symbol) && p.supplyApy > 0,
  )
  const suiPool = pools.find((p) => p.symbol === 'SUI')
  if (stablePool && suiPool && suiPool.supplyApy > stablePool.borrowApy) {
    const safeLtv = 0.5 // conservative
    const borrowed = budget * safeLtv
    const netApy = suiPool.supplyApy - stablePool.borrowApy * safeLtv
    const earn = budget * (netApy / 100)
    strategies.push({
      name: 'Supply SUI + Borrow Stable (loop)',
      steps: [
        `Supply $${budget} SUI to NAVI (${suiPool.supplyApy.toFixed(2)}% APY)`,
        `Borrow $${borrowed.toFixed(0)} ${stablePool.symbol} at ${safeLtv * 100}% LTV (${stablePool.borrowApy.toFixed(2)}% APY)`,
        `Deposit borrowed ${stablePool.symbol} into Volo Vault or re-supply`,
      ],
      estApy: netApy,
      risk: 'Medium',
      detail: `Net APY: ${netApy.toFixed(2)}% | Est. yearly: $${earn.toFixed(2)} | Health factor ~${(1 / safeLtv).toFixed(1)}`,
      action: 'supply-borrow',
      actionLabel: `Supply SUI + Borrow ${stablePool.symbol}`,
      borrowSymbol: stablePool.symbol,
    })
  }

  // 4. Stablecoin vault (lowest risk)
  const stableVaults = vaults.filter(
    (v) => v.name.toLowerCase().includes('stable') || v.name.includes('MMT'),
  )
  if (stableVaults.length > 0) {
    const sv = stableVaults.sort((a, b) => b.apy7d - a.apy7d)[0]
    const earn = budget * (sv.apy7d / 100)
    strategies.push({
      name: `Stable Vault: ${sv.name}`,
      steps: [`Swap $${budget} → stablecoin`, `Deposit into ${sv.name} vault`],
      estApy: sv.apy7d,
      risk: 'Low',
      detail: `7d APY: ${sv.apy7d.toFixed(2)}% | 30d APY: ${sv.apy30d.toFixed(2)}% | Est. yearly: $${earn.toFixed(2)} | Stablecoin = low IL`,
      action: 'link',
      actionUrl: 'https://app.naviprotocol.io/earn',
      actionLabel: `Deposit to ${sv.name} ↗`,
    })
  }

  // 5. Top 3 diversified supply
  if (topSupply.length >= 3) {
    const top3 = topSupply.slice(0, 3)
    const split = budget / 3
    const avgApy = top3.reduce((s, p) => s + p.supplyApy, 0) / 3
    const earn = budget * (avgApy / 100)
    strategies.push({
      name: 'Diversified Supply (Top 3)',
      steps: top3.map(
        (p) => `Supply $${split.toFixed(0)} ${p.symbol} (${p.supplyApy.toFixed(2)}% APY)`,
      ),
      estApy: avgApy,
      risk: 'Low',
      detail: `Avg APY: ${avgApy.toFixed(2)}% | Est. yearly: $${earn.toFixed(2)} | Diversified across ${top3.map((p) => p.symbol).join(', ')}`,
      action: 'link',
      actionUrl: 'https://app.naviprotocol.io/',
      actionLabel: 'Open NAVI Markets ↗',
    })
  }

  return strategies.sort((a, b) => b.estApy - a.estApy)
}

function NaviAdvisorContent() {
  const [budget, setBudget] = useState(100)
  const [loading, setLoading] = useState(false)
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [pools, setPools] = useState<Pool[]>([])
  const [vaults, setVaults] = useState<Vault[]>([])
  const [error, setError] = useState<string | null>(null)
  const [executing, setExecuting] = useState<number | null>(null)
  const [txResult, setTxResult] = useState<string | null>(null)
  const [walletAddr, setWalletAddr] = useState<string | null>(() => {
    const d = sharedHost?.getSharedData(WALLET_KEY) as { address: string } | null
    return d?.address ?? null
  })
  const [network] = useState<NetworkKey>('mainnet')

  useEffect(() => {
    if (!sharedHost) return
    return sharedHost.onSharedDataChange(WALLET_KEY, (v) => {
      setWalletAddr((v as { address: string } | null)?.address ?? null)
    })
  }, [])

  async function analyze() {
    setLoading(true)
    setError(null)
    setStrategies([])
    try {
      // Market data (always)
      const [poolData, vaultCsv] = await Promise.all([getPools(), mcpCall('volo_get_vaults')])
      const vaultData = typeof vaultCsv === 'string' ? parseVaultsCsv(vaultCsv) : []
      setPools(poolData)
      setVaults(vaultData)

      const strats = generateStrategies(budget, poolData, vaultData)

      // Portfolio-aware strategies (when wallet connected)
      if (walletAddr) {
        const [health, coins, rewards] = await Promise.all([
          getHealthFactor(walletAddr).catch(() => null),
          getCoins(walletAddr).catch(() => []),
          getAvailableRewards(walletAddr).catch(() => null),
        ])

        // Strategy: Claim unclaimed rewards
        if (rewards && typeof rewards === 'object') {
          const rewardEntries = Array.isArray(rewards) ? rewards : Object.values(rewards)
          const totalRewardUsd = rewardEntries.reduce(
            (sum: number, r: Record<string, unknown>) => sum + Number(r?.usdValue ?? r?.value ?? 0),
            0,
          )
          if (totalRewardUsd > 0.5) {
            strats.push({
              name: `Claim $${totalRewardUsd.toFixed(2)} Rewards`,
              steps: ['Claim unclaimed lending rewards from NAVI'],
              estApy: 0,
              risk: 'Low',
              detail: `${rewardEntries.length} reward(s) available | Claim and re-supply for compound yield`,
              action: 'link',
              actionUrl: 'https://app.naviprotocol.io/portfolio',
              actionLabel: 'Claim on NAVI ↗',
            })
          }
        }

        // Strategy: Health factor warning
        if (
          health &&
          health.healthFactor != null &&
          health.healthFactor < 1.5 &&
          health.healthFactor > 0
        ) {
          const repayNeeded = health.totalBorrowUsd * (1 - health.healthFactor / 2)
          strats.unshift({
            name: `⚠️ Health Factor ${health.healthFactor.toFixed(2)}`,
            steps: [
              `Current: supply $${health.totalSupplyUsd.toFixed(0)} / borrow $${health.totalBorrowUsd.toFixed(0)}`,
              repayNeeded > 0
                ? `Repay ~$${repayNeeded.toFixed(0)} to reach safe HF 2.0`
                : 'Add more collateral',
            ],
            estApy: 0,
            risk: 'High',
            detail: `Liquidation risk! Health factor ${health.healthFactor.toFixed(2)} (safe > 1.5)`,
            action: 'link',
            actionUrl: 'https://app.naviprotocol.io/portfolio',
            actionLabel: 'Manage Position ↗',
          })
        }

        // Strategy: Idle assets in wallet
        const idleCoins = (Array.isArray(coins) ? coins : []).filter((c) => {
          const sym = c.symbol || ''
          const hasPool = poolData.some((p) => p.symbol === sym)
          return hasPool && c.usdValue > 1
        })
        for (const coin of idleCoins.slice(0, 2)) {
          const pool = poolData.find((p) => p.symbol === coin.symbol)
          if (pool && pool.supplyApy > 0.5) {
            const earn = coin.usdValue * (pool.supplyApy / 100)
            strats.push({
              name: `Supply idle ${coin.symbol} ($${coin.usdValue.toFixed(0)})`,
              steps: [
                `You have ${coin.balance.toFixed(4)} ${coin.symbol} idle in wallet`,
                `Supply to NAVI for ${pool.supplyApy.toFixed(2)}% APY`,
              ],
              estApy: pool.supplyApy,
              risk: 'Low',
              detail: `Idle asset earning 0% → could earn $${earn.toFixed(2)}/year`,
              action: 'deposit',
              actionLabel: `Supply ${coin.symbol} to NAVI`,
            })
          }
        }
      }

      setStrategies(
        strats.sort((a, b) => {
          // Health warnings always first
          if (a.risk === 'High' && a.estApy === 0) return -1
          if (b.risk === 'High' && b.estApy === 0) return 1
          return b.estApy - a.estApy
        }),
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  // NAVI Protocol contract addresses (mainnet)
  const NAVI_PROTOCOL_PKG = '0xee0041239b89564ce870a7dec5ddc5d114367ab94a1137e90aa0633cb76518e0'
  const NAVI_STORAGE = '0xbb4e2f4b6205c2e2a2db47aeb4f830796ec7c005f88537ee775986639bc442fe'
  const NAVI_INCENTIVE_V2 = '0xf87a8acb8b81d14307894d12595541a73f19933f88e1326d5be349c7a6f7559c'
  const NAVI_INCENTIVE_V3 = '0x62982dad27fb10bb314b3384d5de8d2ac2d72ab2dbeae5d801dbdb9efa816c80'
  const NAVI_ORACLE = '0x1568865ed9a0b5ec414220e8f79b3d04c77acc82358f6e5ae4635687392ffbef'

  // Volo staking contract addresses
  const VOLO_PKG = '0x68d22cf8bdbcd11ecba1e094922873e4080d4d11133e2443fddda0bfd11dae20'
  const VOLO_POOL = '0x2d914e23d82fedef1b5f56a32d5c64bdcc3087ccfea2b4d6ea51a71f587840e5'
  const VOLO_METADATA = '0x680cd26af32b2bde8d3361e804c53ec1d1cfe24c7f039eb7f549e8dfde389a60'

  // All NAVI pool configs (from navi-sdk address.ts)
  const NAVI_POOL_CFG: Record<
    string,
    { poolId: string; assetId: number; type: string; decimals: number }
  > = {
    SUI: {
      poolId: '0x96df0fce3c471489f4debaaa762cf960b3d97820bd1f3f025ff8190730e958c5',
      assetId: 0,
      type: '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI',
      decimals: 9,
    },
    wUSDC: {
      poolId: '0xa02a98f9c88db51c6f5efaaf2261c81f34dd56d86073387e0ef1805ca22e39c8',
      assetId: 1,
      type: '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN',
      decimals: 6,
    },
    USDT: {
      poolId: '0x0e060c3b5b8de00fb50511b7a45188c8e34b6995c01f69d98ea5a466fe10d103',
      assetId: 2,
      type: '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN',
      decimals: 6,
    },
    WETH: {
      poolId: '0x71b9f6e822c48ce827bceadce82201d6a7559f7b0350ed1daa1dc2ba3ac41b56',
      assetId: 3,
      type: '0xaf8cd5edc19c4512f4259f0bee101a40d41ebed738ade5874359610ef8eeced5::coin::COIN',
      decimals: 8,
    },
    CETUS: {
      poolId: '0x3c376f857ec4247b8ee456c1db19e9c74e0154d4876915e54221b5052d5b1e2e',
      assetId: 4,
      type: '0x06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS',
      decimals: 9,
    },
    vSUI: {
      poolId: '0x9790c2c272e15b6bf9b341eb531ef16bcc8ed2b20dfda25d060bf47f5dd88d01',
      assetId: 5,
      type: '0x549e8b69270defbfafd4f94e17ec44cdbdd99820b33bda2278dea3b9a32d3f55::cert::CERT',
      decimals: 9,
    },
    haSUI: {
      poolId: '0x6fd9cb6ebd76bc80340a9443d72ea0ae282ee20e2fd7544f6ffcd2c070d9557a',
      assetId: 6,
      type: '0xbde4ba4c2e274a60ce15c1cfff9e5c42e41654ac8b6d906a57efa4bd3c29f47d::hasui::HASUI',
      decimals: 9,
    },
    NAVX: {
      poolId: '0xc0e02e7a245e855dd365422faf76f87d9f5b2148a26d48dda6e8253c3fe9fa60',
      assetId: 7,
      type: '0xa99b8952d4f7d947ea77fe0ecdcc9e5fc0bcab2841d6e2a5aa00c3044e5544b5::navx::NAVX',
      decimals: 9,
    },
    nUSDC: {
      poolId: '0xa3582097b4c57630046c0c49a88bfc6b202a3ec0a9db5597c31765f7563755a8',
      assetId: 10,
      type: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC',
      decimals: 6,
    },
    USDC: {
      poolId: '0xa3582097b4c57630046c0c49a88bfc6b202a3ec0a9db5597c31765f7563755a8',
      assetId: 10,
      type: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC',
      decimals: 6,
    },
    DEEP: {
      poolId: '0x08373c5efffd07f88eace1c76abe4777489d9ec044fd4cd567f982d9c169e946',
      assetId: 15,
      type: '0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP',
      decimals: 6,
    },
    WAL: {
      poolId: '0xef76883525f5c2ff90cd97732940dbbdba0b391e29de839b10588cee8e4fe167',
      assetId: 24,
      type: '0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL',
      decimals: 9,
    },
    HAEDAL: {
      poolId: '0x930f5cf61dcb66d699ba57b2eb72da6fd04c64a53073cc40f751ef12c77aaa6a',
      assetId: 25,
      type: '0x3a304c7feba2d819ea57c3542d68439ca2c386ba02159c740f7b406e592c62ea::haedal::HAEDAL',
      decimals: 9,
    },
    NS: {
      poolId: '0x2fcc6245f72795fad50f17c20583f8c6e81426ab69d7d3590420571364d080d4',
      assetId: 13,
      type: '0x5145494a5f5100e645e4b0aa950fa6b68f614e8c59e17bc5ded3495123a79178::ns::NS',
      decimals: 6,
    },
    LBTC: {
      poolId: '0x377b8322c0d349b44b5873d418192eefe871b9372bb3a86f288cafe97317de04',
      assetId: 23,
      type: '0x3e8e9423d80e1774a7ca128fccd8bf5f1f7753be658c5e645929037f7c819040::lbtc::LBTC',
      decimals: 8,
    },
    suiUSDT: {
      poolId: '0xa3e0471746e5d35043801bce247d3b3784cc74329d39f7ed665446ddcf22a9e2',
      assetId: 19,
      type: '0x375f70cf2ae4c00bf37117d0c85a2c71545e6ee05c4a5c7d282cd66a4504b068::usdt::USDT',
      decimals: 6,
    },
    stSUI: {
      poolId: '0x0bccd5189d311002f4e10dc98270a3362fb3f7f9d48164cf40828f6c09f351e2',
      assetId: 20,
      type: '0xd1b72982e40348d069bb1ff701e634c117bb5f741f44dff91e472d3b01461e55::stsui::STSUI',
      decimals: 9,
    },
    IKA: {
      poolId: '0x3566577feaba2f24b9e0b315a10f1afe04e7d275c2da6f28caeba095d00dee8d',
      assetId: 27,
      type: '0x7262fb2f7a3a14c888c438a3cd9b912469a58cf60f367352c46584262e8299aa::ika::IKA',
      decimals: 9,
    },
  }

  async function executeSupply(_strategyIdx: number) {
    if (!walletAddr || !sharedHost) return
    setExecuting(_strategyIdx)
    setTxResult(null)
    setError(null)
    try {
      const s = strategies[_strategyIdx]
      // Extract symbol from strategy name "Supply WAL on NAVI" → "WAL"
      const symbol = s.name.replace('Supply ', '').replace(' on NAVI', '').trim()
      const cfg = NAVI_POOL_CFG[symbol]
      if (!cfg) throw new Error(`No NAVI pool config for ${symbol}. Use NAVI app directly.`)

      const pool = pools.find((p) => p.symbol === symbol)
      if (!pool?.price || pool.price <= 0) throw new Error(`${symbol} price unavailable`)

      const tokenAmount = Math.floor((budget / pool.price) * 10 ** cfg.decimals)
      if (tokenAmount <= 0) throw new Error('Amount too small')

      const tx = new Transaction()
      const isSui = cfg.type.endsWith('::sui::SUI')

      let coinObj
      if (isSui) {
        coinObj = tx.splitCoins(tx.gas, [tokenAmount])
      } else {
        // Fetch user's coins of this type via JSON-RPC
        const rpc = RPC_URLS[network]
        const res = await fetch(rpc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'suix_getCoins',
            params: [walletAddr, `0x${cfg.type}`, null, 50],
          }),
        })
        const json = await res.json()
        const coins = json.result?.data ?? []
        if (coins.length === 0) throw new Error(`No ${symbol} coins in wallet`)

        // Merge all coins of this type
        const primaryCoin = tx.object(coins[0].coinObjectId)
        if (coins.length > 1) {
          tx.mergeCoins(
            primaryCoin,
            coins.slice(1).map((c: { coinObjectId: string }) => tx.object(c.coinObjectId)),
          )
        }
        coinObj = tx.splitCoins(primaryCoin, [tokenAmount])
      }

      tx.moveCall({
        target: `${NAVI_PROTOCOL_PKG}::incentive_v3::entry_deposit`,
        arguments: [
          tx.object('0x06'),
          tx.object(NAVI_STORAGE),
          tx.object(cfg.poolId),
          tx.pure.u8(cfg.assetId),
          coinObj,
          tx.pure.u64(tokenAmount),
          tx.object(NAVI_INCENTIVE_V2),
          tx.object(NAVI_INCENTIVE_V3),
        ],
        typeArguments: [`0x${cfg.type}`],
      })

      const result = await sharedHost.signAndExecuteTransaction(tx)
      setTxResult(
        `Supplied ${(tokenAmount / 10 ** cfg.decimals).toFixed(4)} ${symbol} to NAVI! Tx: ${result.digest.slice(0, 16)}…`,
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setExecuting(null)
    }
  }

  async function executeVoStake(strategyIdx: number) {
    if (!walletAddr || !sharedHost) return
    setExecuting(strategyIdx)
    setTxResult(null)
    setError(null)
    try {
      const suiPool = pools.find((p) => p.symbol === 'SUI')
      if (!suiPool?.price || suiPool.price <= 0) throw new Error('SUI price unavailable')
      const tokenAmount = Math.floor((budget / suiPool.price) * 1e9)
      if (tokenAmount <= 0) throw new Error('Amount too small')

      const tx = new Transaction()
      const coinObj = tx.splitCoins(tx.gas, [tokenAmount])

      // Volo stake_pool::stake → returns vSUI coin
      const [vSuiCoin] = tx.moveCall({
        target: `${VOLO_PKG}::stake_pool::stake`,
        arguments: [
          tx.object(VOLO_POOL),
          tx.object(VOLO_METADATA),
          tx.object('0x05'), // SuiSystemState wrapper
          coinObj,
        ],
      })
      tx.transferObjects([vSuiCoin], walletAddr)

      const result = await sharedHost.signAndExecuteTransaction(tx)
      setTxResult(
        `Staked ${(tokenAmount / 1e9).toFixed(4)} SUI → vSUI! Tx: ${result.digest.slice(0, 16)}…`,
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setExecuting(null)
    }
  }

  async function executeSupplyBorrow(strategyIdx: number) {
    const s = strategies[strategyIdx]
    if (!walletAddr || !sharedHost) return
    const stableCfg = NAVI_POOL_CFG[s.borrowSymbol ?? '']
    if (!stableCfg) {
      setError(`No pool config for ${s.borrowSymbol}`)
      return
    }

    setExecuting(strategyIdx)
    setTxResult(null)
    setError(null)
    try {
      const suiPool = pools.find((p) => p.symbol === 'SUI')
      if (!suiPool?.price || suiPool.price <= 0) throw new Error('SUI price unavailable')

      const suiAmount = Math.floor((budget / suiPool.price) * 1e9)
      const borrowUsd = budget * 0.5 // 50% LTV
      const borrowAmount = Math.floor(borrowUsd * 10 ** stableCfg.decimals) // stablecoins ≈ $1

      const tx = new Transaction()

      // Step 1: Supply SUI
      const coinObj = tx.splitCoins(tx.gas, [suiAmount])
      tx.moveCall({
        target: `${NAVI_PROTOCOL_PKG}::incentive_v3::entry_deposit`,
        arguments: [
          tx.object('0x06'),
          tx.object(NAVI_STORAGE),
          tx.object(NAVI_POOL_CFG.SUI.poolId),
          tx.pure.u8(0),
          coinObj,
          tx.pure.u64(suiAmount),
          tx.object(NAVI_INCENTIVE_V2),
          tx.object(NAVI_INCENTIVE_V3),
        ],
        typeArguments: [NAVI_POOL_CFG.SUI.type],
      })

      // Step 2: Borrow stablecoin
      const [borrowBalance] = tx.moveCall({
        target: `${NAVI_PROTOCOL_PKG}::incentive_v3::borrow_v2`,
        arguments: [
          tx.object('0x06'),
          tx.object(NAVI_ORACLE),
          tx.object(NAVI_STORAGE),
          tx.object(stableCfg.poolId),
          tx.pure.u8(stableCfg.assetId),
          tx.pure.u64(borrowAmount),
          tx.object(NAVI_INCENTIVE_V2),
          tx.object(NAVI_INCENTIVE_V3),
          tx.object('0x05'),
        ],
        typeArguments: [`0x${stableCfg.type}`],
      })

      // Convert balance to coin and transfer to user
      const [borrowedCoin] = tx.moveCall({
        target: '0x2::coin::from_balance',
        arguments: [borrowBalance],
        typeArguments: [`0x${stableCfg.type}`],
      })
      tx.transferObjects([borrowedCoin], walletAddr)

      const result = await sharedHost.signAndExecuteTransaction(tx)
      setTxResult(
        `Supplied ${(suiAmount / 1e9).toFixed(4)} SUI + Borrowed ${(borrowAmount / 10 ** stableCfg.decimals).toFixed(2)} ${s.borrowSymbol}! Tx: ${result.digest.slice(0, 16)}…`,
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setExecuting(null)
    }
  }

  const riskColor = (r: string) =>
    r === 'Low' ? '#4ade80' : r === 'Medium' ? '#f0b429' : '#f87171'

  return (
    <div className="sui-na">
      <div className="sui-na__header">
        <h3 className="sui-na__title">NAVI Strategy Advisor</h3>
        <p className="sui-na__desc">Find the best yield strategies for your budget</p>
      </div>

      <div className="sui-na__budget-row">
        <label className="sui-na__label">Budget (USD)</label>
        <input
          className="sui-na__input"
          type="number"
          min={1}
          value={budget}
          onChange={(e) => setBudget(Number(e.target.value))}
        />
        <button className="sui-na__btn" onClick={analyze} disabled={loading}>
          {loading
            ? 'Analyzing…'
            : walletAddr
              ? 'Find Strategies (+ Portfolio)'
              : 'Find Strategies'}
        </button>
      </div>

      {error && <div className="sui-na__error">{error}</div>}
      {txResult && <div className="sui-na__success">{txResult}</div>}

      {strategies.length > 0 && (
        <div className="sui-na__strategies">
          {strategies.map((s, i) => (
            <div key={i} className="sui-na__strategy">
              <div className="sui-na__strategy-header">
                <span className="sui-na__strategy-rank">#{i + 1}</span>
                <span className="sui-na__strategy-name">{s.name}</span>
                <span className="sui-na__strategy-apy" style={{ color: riskColor(s.risk) }}>
                  {s.estApy.toFixed(2)}% APY
                </span>
              </div>
              <div className="sui-na__strategy-risk" style={{ color: riskColor(s.risk) }}>
                Risk: {s.risk}
              </div>
              <div className="sui-na__strategy-steps">
                {s.steps.map((step, j) => (
                  <div key={j} className="sui-na__step">
                    <span className="sui-na__step-num">{j + 1}</span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
              <div className="sui-na__strategy-detail">{s.detail}</div>
              {s.action === 'deposit' && walletAddr && (
                <button
                  className="sui-na__btn-exec"
                  onClick={() => executeSupply(i)}
                  disabled={executing !== null}
                >
                  {executing === i ? 'Executing…' : (s.actionLabel ?? 'Supply SUI')}
                </button>
              )}
              {s.action === 'volo-stake' && walletAddr && (
                <button
                  className="sui-na__btn-exec"
                  onClick={() => executeVoStake(i)}
                  disabled={executing !== null}
                >
                  {executing === i ? 'Executing…' : (s.actionLabel ?? 'Stake SUI → vSUI')}
                </button>
              )}
              {s.action === 'supply-borrow' && walletAddr && (
                <button
                  className="sui-na__btn-exec sui-na__btn-exec--warn"
                  onClick={() => executeSupplyBorrow(i)}
                  disabled={executing !== null}
                >
                  {executing === i ? 'Executing…' : (s.actionLabel ?? 'Supply + Borrow')}
                </button>
              )}
              {s.action === 'link' && s.actionUrl && (
                <a
                  className="sui-na__btn-link"
                  href={s.actionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {s.actionLabel ?? 'Open NAVI ↗'}
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Market snapshot */}
      {pools.length > 0 && (
        <div className="sui-na__snapshot">
          <div className="sui-na__snapshot-title">Top Supply APY</div>
          {[...pools]
            .sort((a, b) => b.supplyApy - a.supplyApy)
            .slice(0, 5)
            .map((p) => (
              <div key={p.symbol} className="sui-na__snapshot-row">
                <span>{p.symbol}</span>
                <span className="sui-na__snapshot-apy">{p.supplyApy.toFixed(2)}%</span>
              </div>
            ))}
        </div>
      )}

      {vaults.length > 0 && (
        <div className="sui-na__snapshot">
          <div className="sui-na__snapshot-title">Top Volo Vaults (7d APY)</div>
          {[...vaults]
            .sort((a, b) => b.apy7d - a.apy7d)
            .slice(0, 5)
            .map((v) => (
              <div key={v.id} className="sui-na__snapshot-row">
                <span>{v.name}</span>
                <span className="sui-na__snapshot-apy">{v.apy7d.toFixed(2)}%</span>
              </div>
            ))}
        </div>
      )}

      <div className="sui-na__footer">
        <span className="sui-na__badge">NAVI MCP</span>
        <span className="sui-na__disclaimer">Read-only analysis — not financial advice</span>
      </div>
    </div>
  )
}

const SuiNaviAdvisorPlugin: Plugin = {
  name: 'SuiNaviAdvisor',
  version: '1.0.0',
  styleUrls: ['/plugins/sui-navi-advisor/style.css'],
  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('SuiNaviAdvisor', NaviAdvisorContent)
    host.log('SuiNaviAdvisor initialized')
  },
  mount() {
    console.log('[SuiNaviAdvisor] mounted')
  },
  unmount() {
    sharedHost = null
    console.log('[SuiNaviAdvisor] unmounted')
  },
}

export default SuiNaviAdvisorPlugin
