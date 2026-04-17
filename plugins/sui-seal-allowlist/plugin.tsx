// SUI Seal Allowlist Plugin
// Allowlist pattern — group access control with on-chain member management
// Identity = allowlist_obj_id ++ random_nonce, seal_approve checks sender in members

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useEffect, useRef } from 'react'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { Transaction } from '@mysten/sui/transactions'
import { SealClient, SessionKey, EncryptedObject } from '@mysten/seal'
import { fromHex, toHex } from '@mysten/bcs'
import { fromBase64, toBase64 } from '@mysten/sui/utils'
import {
  WALLET_KEY,
  SEAL_PACKAGE_ID,
  TESTNET_KEY_SERVERS,
  DEFAULT_THRESHOLD,
  RPC_URLS,
  shortenHex,
  type NetworkKey,
} from '../sui-seal-shared/config'
import './style.css'

let sharedHost: SuiHostAPI | null = null

type Tab = 'setup' | 'encrypt' | 'decrypt'

function SealAllowlistContent() {
  const [tab, setTab] = useState<Tab>('setup')

  // Setup state
  const [allowlistId, setAllowlistId] = useState('')
  const [adminCapId, setAdminCapId] = useState('')
  const [setupStatus, setSetupStatus] = useState('')
  const [memberAddr, setMemberAddr] = useState('')
  const [addStatus, setAddStatus] = useState('')
  const [members, setMembers] = useState<string[]>([])

  // Encrypt state
  const [plaintext, setPlaintext] = useState('')
  const [ciphertext, setCiphertext] = useState('')
  const [encStatus, setEncStatus] = useState('')

  // Decrypt state
  const [decryptInput, setDecryptInput] = useState('')
  const [decrypted, setDecrypted] = useState('')
  const [decStatus, setDecStatus] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [network, setNetwork] = useState<NetworkKey>(() => {
    const d = sharedHost?.getSharedData(WALLET_KEY) as { network: string } | null
    return (d?.network === 'testnet' ? 'testnet' : 'mainnet') as NetworkKey
  })
  const [walletAddr, setWalletAddr] = useState<string | null>(() => {
    const d = sharedHost?.getSharedData(WALLET_KEY) as { address: string } | null
    return d?.address ?? null
  })

  const sealClientRef = useRef<SealClient | null>(null)
  const sessionKeyRef = useRef<SessionKey | null>(null)

  useEffect(() => {
    if (!sharedHost) return
    return sharedHost.onSharedDataChange(WALLET_KEY, (v) => {
      const p = v as { address: string; network: string } | null
      setWalletAddr(p?.address ?? null)
      setNetwork((p?.network === 'testnet' ? 'testnet' : 'mainnet') as NetworkKey)
      sealClientRef.current = null
      sessionKeyRef.current = null
    })
  }, [])

  function getSealClient() {
    if (!sealClientRef.current) {
      const suiClient = new SuiGrpcClient({ network, baseUrl: RPC_URLS[network] })
      sealClientRef.current = new SealClient({
        suiClient,
        serverConfigs: TESTNET_KEY_SERVERS,
        verifyKeyServers: false,
      })
    }
    return sealClientRef.current
  }

  async function getSessionKey(address: string) {
    if (!sessionKeyRef.current || sessionKeyRef.current.isExpired()) {
      const suiClient = new SuiGrpcClient({ network, baseUrl: RPC_URLS[network] })
      const sk = await SessionKey.create({
        address,
        packageId: SEAL_PACKAGE_ID,
        ttlMin: 10,
        suiClient,
      })
      const message = sk.getPersonalMessage()
      const { signature } = await sharedHost!.signPersonalMessage(message)
      await sk.setPersonalMessageSignature(signature)
      sessionKeyRef.current = sk
    }
    return sessionKeyRef.current
  }

  // --- Setup: Create Allowlist ---
  async function handleCreateAllowlist() {
    if (!walletAddr || !sharedHost) return
    setSetupStatus('Creating allowlist on-chain…')
    setError(null)
    try {
      const tx = new Transaction()
      tx.moveCall({ target: `${SEAL_PACKAGE_ID}::allowlist_seal::create` })
      await sharedHost.signAndExecuteTransaction(tx)

      setSetupStatus('Waiting for indexing…')
      await new Promise((r) => setTimeout(r, 3000))

      // Find the AdminCap via JSON-RPC
      const rpc = RPC_URLS[network]
      const res = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'suix_getOwnedObjects',
          params: [
            walletAddr,
            {
              filter: { Package: SEAL_PACKAGE_ID },
              options: { showType: true, showContent: true },
            },
            null,
            50,
          ],
        }),
      })
      const json = await res.json()
      const objects = json.result?.data ?? []

      let foundCap = ''
      let foundList = ''
      for (const obj of objects) {
        const type = obj.data?.type ?? ''
        if (type.includes('::AdminCap')) {
          foundCap = obj.data!.objectId
          const fields = obj.data?.content?.fields as Record<string, string> | undefined
          if (fields?.allowlist_id) foundList = fields.allowlist_id
        }
      }

      setAllowlistId(foundList)
      setAdminCapId(foundCap)
      setSetupStatus(
        foundList ? 'Allowlist created!' : 'Created but could not find objects — try refreshing.',
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
      setSetupStatus('')
    }
  }

  // --- Setup: Add Member ---
  async function handleAddMember() {
    if (!allowlistId || !adminCapId || !sharedHost) return
    const addr = memberAddr.trim() || walletAddr!
    setAddStatus(`Adding ${shortenHex(addr)}…`)
    setError(null)
    try {
      const tx = new Transaction()
      tx.moveCall({
        target: `${SEAL_PACKAGE_ID}::allowlist_seal::add_member`,
        arguments: [tx.object(allowlistId), tx.object(adminCapId), tx.pure.address(addr)],
      })
      await sharedHost.signAndExecuteTransaction(tx)
      setMembers((m) => (m.includes(addr) ? m : [...m, addr]))
      setAddStatus(`Added ${shortenHex(addr)}!`)
      setMemberAddr('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
      setAddStatus('')
    }
  }

  // --- Setup: Remove Member ---
  async function handleRemoveMember(addr: string) {
    if (!allowlistId || !adminCapId || !sharedHost) return
    setError(null)
    try {
      const tx = new Transaction()
      tx.moveCall({
        target: `${SEAL_PACKAGE_ID}::allowlist_seal::remove_member`,
        arguments: [tx.object(allowlistId), tx.object(adminCapId), tx.pure.address(addr)],
      })
      await sharedHost.signAndExecuteTransaction(tx)
      setMembers((m) => m.filter((a) => a !== addr))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  // --- Encrypt ---
  async function handleEncrypt() {
    if (!walletAddr || !allowlistId || !plaintext.trim()) return
    setEncStatus('Encrypting…')
    setCiphertext('')
    setError(null)
    try {
      const client = getSealClient()
      const nonce = crypto.getRandomValues(new Uint8Array(5))
      const alBytes = fromHex(allowlistId.replace(/^0x/, ''))
      const idBytes = new Uint8Array([...alBytes, ...nonce])
      const id = toHex(idBytes)

      const { encryptedObject } = await client.encrypt({
        threshold: DEFAULT_THRESHOLD,
        packageId: SEAL_PACKAGE_ID,
        id,
        data: new TextEncoder().encode(plaintext),
      })
      setCiphertext(toBase64(encryptedObject))
      setEncStatus('Encrypted to allowlist! Only members can decrypt.')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
      setEncStatus('')
    }
  }

  // --- Decrypt ---
  async function handleDecrypt() {
    if (!walletAddr || !sharedHost || !decryptInput.trim()) return
    setDecStatus('Parsing ciphertext…')
    setDecrypted('')
    setError(null)
    try {
      const encryptedBytes = fromBase64(decryptInput.trim())
      const parsed = EncryptedObject.parse(encryptedBytes)
      const client = getSealClient()

      // Extract allowlist object ID from identity (first 32 bytes)
      const idBytes = fromHex(parsed.id)
      const allowlistObjId = '0x' + toHex(idBytes.slice(0, 32))

      setDecStatus('Sign the session key in your wallet…')
      const sessionKey = await getSessionKey(walletAddr)

      setDecStatus('Contacting key servers…')
      const suiClient = new SuiGrpcClient({ network, baseUrl: RPC_URLS[network] })
      const tx = new Transaction()
      tx.moveCall({
        target: `${parsed.packageId}::allowlist_seal::seal_approve`,
        arguments: [tx.pure.vector('u8', fromHex(parsed.id)), tx.object(allowlistObjId)],
      })
      const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true })

      const dec = await client.decrypt({ data: encryptedBytes, sessionKey, txBytes })
      setDecrypted(new TextDecoder().decode(dec))
      setDecStatus('Decrypted! You are on the allowlist.')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('does not have access')) {
        setDecStatus('Access denied — you are not on the allowlist.')
      } else {
        setError(msg)
        setDecStatus('')
      }
    }
  }

  const copy = (val: string) => {
    navigator.clipboard.writeText(val)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="sui-sa">
      <div className="sui-sa__header">
        <h3 className="sui-sa__title">Allowlist Encryption</h3>
        <p className="sui-sa__desc">Group access control — only listed addresses can decrypt</p>
      </div>

      {!walletAddr && <div className="sui-sa__warn">Connect wallet to use Allowlist</div>}

      {/* Tabs */}
      <div className="sui-sa__tabs">
        {(['setup', 'encrypt', 'decrypt'] as const).map((t) => (
          <button
            key={t}
            className={`sui-sa__tab ${tab === t ? 'sui-sa__tab--active' : ''}`}
            onClick={() => {
              setTab(t)
              setError(null)
            }}
          >
            {t === 'setup' ? 'Setup' : t === 'encrypt' ? 'Encrypt' : 'Decrypt'}
          </button>
        ))}
      </div>

      {/* Setup Tab */}
      {tab === 'setup' && (
        <div className="sui-sa__panel">
          {!allowlistId ? (
            <>
              <div className="sui-sa__panel-title">Create Allowlist</div>
              <p className="sui-sa__panel-desc">
                Deploy a shared Allowlist object on-chain. You'll get an AdminCap to manage members.
              </p>
              <button
                className="sui-sa__btn"
                onClick={handleCreateAllowlist}
                disabled={!walletAddr}
              >
                Create Allowlist
              </button>
              {setupStatus && <div className="sui-sa__status">{setupStatus}</div>}
            </>
          ) : (
            <>
              <div className="sui-sa__panel-title">Allowlist Created</div>
              <div className="sui-sa__meta">
                <div className="sui-sa__meta-row">
                  <span className="sui-sa__meta-label">Allowlist</span>
                  <button className="sui-sa__copy" onClick={() => copy(allowlistId)}>
                    {copied ? 'Copied!' : shortenHex(allowlistId)}
                  </button>
                </div>
                <div className="sui-sa__meta-row">
                  <span className="sui-sa__meta-label">AdminCap</span>
                  <span className="sui-sa__meta-val">{shortenHex(adminCapId)}</span>
                </div>
              </div>

              {/* Add member */}
              <div className="sui-sa__add-row">
                <input
                  className="sui-sa__input"
                  placeholder={walletAddr ?? 'Address to add'}
                  value={memberAddr}
                  onChange={(e) => setMemberAddr(e.target.value)}
                />
                <button className="sui-sa__btn sui-sa__btn--sm" onClick={handleAddMember}>
                  Add
                </button>
              </div>
              {addStatus && <div className="sui-sa__status">{addStatus}</div>}

              {/* Member list */}
              {members.length > 0 && (
                <div className="sui-sa__members">
                  <div className="sui-sa__members-title">Members ({members.length})</div>
                  {members.map((m) => (
                    <div key={m} className="sui-sa__member-row">
                      <span className="sui-sa__member-addr">{shortenHex(m)}</span>
                      <button className="sui-sa__btn-del" onClick={() => handleRemoveMember(m)}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Encrypt Tab */}
      {tab === 'encrypt' && (
        <div className={`sui-sa__panel ${!allowlistId ? 'sui-sa__panel--disabled' : ''}`}>
          <div className="sui-sa__panel-title">Encrypt to Allowlist</div>
          {!allowlistId && (
            <p className="sui-sa__panel-desc">Create an allowlist first in the Setup tab.</p>
          )}
          {allowlistId && (
            <>
              <p className="sui-sa__panel-desc">
                Identity = allowlist object ID. Only members can decrypt. Add/remove members without
                re-encrypting.
              </p>
              <textarea
                className="sui-sa__textarea"
                placeholder="Secret message…"
                value={plaintext}
                onChange={(e) => setPlaintext(e.target.value)}
                rows={3}
              />
              <button className="sui-sa__btn" onClick={handleEncrypt} disabled={!plaintext.trim()}>
                Encrypt
              </button>
              {encStatus && <div className="sui-sa__status">{encStatus}</div>}
              {ciphertext && (
                <div className="sui-sa__output">
                  <pre className="sui-sa__pre">{ciphertext}</pre>
                  <button className="sui-sa__copy" onClick={() => copy(ciphertext)}>
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Decrypt Tab */}
      {tab === 'decrypt' && (
        <div className="sui-sa__panel">
          <div className="sui-sa__panel-title">Decrypt</div>
          <p className="sui-sa__panel-desc">
            Paste ciphertext. Key servers dry-run seal_approve(id, allowlist, ctx) — checks sender
            in members.
          </p>
          <textarea
            className="sui-sa__textarea"
            placeholder="Paste ciphertext here…"
            value={decryptInput}
            onChange={(e) => setDecryptInput(e.target.value)}
            rows={4}
          />
          <button
            className="sui-sa__btn"
            onClick={handleDecrypt}
            disabled={!walletAddr || !decryptInput.trim()}
          >
            Decrypt
          </button>
          {decStatus && (
            <div
              className={`sui-sa__status ${decStatus.startsWith('Access') ? 'sui-sa__status--err' : ''}`}
            >
              {decStatus}
            </div>
          )}
          {decrypted && <div className="sui-sa__result">{decrypted}</div>}
        </div>
      )}

      {error && <div className="sui-sa__error">{error}</div>}

      <div className="sui-sa__footer">
        <span className="sui-sa__net">{network}</span>
        <span className="sui-sa__pkg">allowlist_seal</span>
      </div>
    </div>
  )
}

const SuiSealAllowlistPlugin: Plugin = {
  name: 'SuiSealAllowlist',
  version: '1.0.0',
  styleUrls: ['/plugins/sui-seal-allowlist/style.css'],
  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('SuiSealAllowlist', SealAllowlistContent)
    host.log('SuiSealAllowlist initialized')
  },
  mount() {
    console.log('[SuiSealAllowlist] mounted')
  },
  unmount() {
    sharedHost = null
    console.log('[SuiSealAllowlist] unmounted')
  },
}

export default SuiSealAllowlistPlugin
