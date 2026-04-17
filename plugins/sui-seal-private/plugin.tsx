// SUI Seal Private Plugin
// Private Data pattern — only the connected wallet can decrypt
// Identity = BCS(sender address), seal_approve checks id == sender

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useEffect, useRef } from 'react'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { Transaction } from '@mysten/sui/transactions'
import { SealClient, SessionKey, EncryptedObject } from '@mysten/seal'
import { fromHex, toHex } from '@mysten/bcs'
import { bcs } from '@mysten/sui/bcs'
import { fromBase64, toBase64 } from '@mysten/sui/utils'
import {
  WALLET_KEY,
  SEAL_PACKAGE_ID,
  TESTNET_KEY_SERVERS,
  DEFAULT_THRESHOLD,
  RPC_URLS,
  type NetworkKey,
} from '../sui-seal-shared/config'
import './style.css'

let sharedHost: SuiHostAPI | null = null

function SealPrivateContent() {
  const [plaintext, setPlaintext] = useState('')
  const [ciphertext, setCiphertext] = useState('')
  const [encStatus, setEncStatus] = useState('')
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

  async function handleEncrypt() {
    if (!walletAddr || !plaintext.trim()) return
    setEncStatus('Encrypting…')
    setCiphertext('')
    setError(null)
    try {
      const client = getSealClient()
      const id = toHex(bcs.Address.serialize(walletAddr).toBytes())
      const { encryptedObject } = await client.encrypt({
        threshold: DEFAULT_THRESHOLD,
        packageId: SEAL_PACKAGE_ID,
        id,
        data: new TextEncoder().encode(plaintext),
      })
      setCiphertext(toBase64(encryptedObject))
      setEncStatus('Encrypted! Only your wallet can decrypt this.')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
      setEncStatus('')
    }
  }

  async function handleDecrypt() {
    if (!walletAddr || !sharedHost || !decryptInput.trim()) return
    setDecStatus('Parsing ciphertext…')
    setDecrypted('')
    setError(null)
    try {
      const encryptedBytes = fromBase64(decryptInput.trim())
      const parsed = EncryptedObject.parse(encryptedBytes)
      const client = getSealClient()

      setDecStatus('Sign the session key in your wallet…')
      const sessionKey = await getSessionKey(walletAddr)

      setDecStatus('Contacting key servers…')
      const suiClient = new SuiGrpcClient({ network, baseUrl: RPC_URLS[network] })
      const tx = new Transaction()
      tx.moveCall({
        target: `${parsed.packageId}::private_seal::seal_approve`,
        arguments: [tx.pure.vector('u8', fromHex(parsed.id))],
      })
      const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true })

      const dec = await client.decrypt({ data: encryptedBytes, sessionKey, txBytes })
      setDecrypted(new TextDecoder().decode(dec))
      setDecStatus('Decrypted! seal_approve confirmed sender == owner.')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('does not have access')) {
        setDecStatus('Access denied — only the encrypting wallet can decrypt.')
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
    <div className="sui-sp">
      <div className="sui-sp__header">
        <h3 className="sui-sp__title">Private Data</h3>
        <p className="sui-sp__desc">Encrypt data only you can decrypt — identity = your address</p>
      </div>

      {!walletAddr && <div className="sui-sp__warn">Connect wallet to use Private Data</div>}

      {/* Encrypt */}
      <div className="sui-sp__panel">
        <div className="sui-sp__panel-title">Encrypt</div>
        <p className="sui-sp__panel-desc">Identity = your address. Encryption is entirely local.</p>
        <textarea
          className="sui-sp__textarea"
          placeholder="Secret message…"
          value={plaintext}
          onChange={(e) => setPlaintext(e.target.value)}
          rows={3}
        />
        <button
          className="sui-sp__btn"
          onClick={handleEncrypt}
          disabled={!walletAddr || !plaintext.trim()}
        >
          Encrypt
        </button>
        {encStatus && <div className="sui-sp__status">{encStatus}</div>}
        {ciphertext && (
          <div className="sui-sp__output">
            <pre className="sui-sp__pre">{ciphertext}</pre>
            <button className="sui-sp__copy" onClick={() => copy(ciphertext)}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}
      </div>

      {/* Decrypt */}
      <div className="sui-sp__panel">
        <div className="sui-sp__panel-title">Decrypt</div>
        <p className="sui-sp__panel-desc">
          Paste ciphertext. Key servers dry-run seal_approve(id, ctx) — checks id == sender.
        </p>
        <textarea
          className="sui-sp__textarea"
          placeholder="Paste ciphertext here…"
          value={decryptInput}
          onChange={(e) => setDecryptInput(e.target.value)}
          rows={4}
        />
        <button
          className="sui-sp__btn"
          onClick={handleDecrypt}
          disabled={!walletAddr || !decryptInput.trim()}
        >
          Decrypt
        </button>
        {decStatus && (
          <div
            className={`sui-sp__status ${decStatus.startsWith('Access') ? 'sui-sp__status--err' : ''}`}
          >
            {decStatus}
          </div>
        )}
        {decrypted && <div className="sui-sp__result">{decrypted}</div>}
      </div>

      {error && <div className="sui-sp__error">{error}</div>}

      <div className="sui-sp__footer">
        <span className="sui-sp__net">{network}</span>
        <span className="sui-sp__pkg">private_seal</span>
      </div>
    </div>
  )
}

const SuiSealPrivatePlugin: Plugin = {
  name: 'SuiSealPrivate',
  version: '1.0.0',
  styleUrls: ['/plugins/sui-seal-private/style.css'],
  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('SuiSealPrivate', SealPrivateContent)
    host.log('SuiSealPrivate initialized')
  },
  mount() {
    console.log('[SuiSealPrivate] mounted')
  },
  unmount() {
    sharedHost = null
    console.log('[SuiSealPrivate] unmounted')
  },
}

export default SuiSealPrivatePlugin
