// SUI Seal Time-Lock Plugin
// Time-Lock pattern — data unlocks after a timestamp
// Identity = BCS(u64 unlock_timestamp_ms), seal_approve checks clock >= timestamp

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
  SUI_CLOCK,
  RPC_URLS,
  type NetworkKey,
} from '../sui-seal-shared/config'
import './style.css'

let sharedHost: SuiHostAPI | null = null

function SealTimelockContent() {
  const [plaintext, setPlaintext] = useState('')
  const [delaySeconds, setDelaySeconds] = useState(30)
  const [ciphertext, setCiphertext] = useState('')
  const [encStatus, setEncStatus] = useState('')

  const [decryptInput, setDecryptInput] = useState('')
  const [decrypted, setDecrypted] = useState('')
  const [decStatus, setDecStatus] = useState('')
  const [parsedUnlock, setParsedUnlock] = useState<number | null>(null)
  const [countdown, setCountdown] = useState('')

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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

  // Countdown timer — setState only in interval callback
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (!parsedUnlock) return
    timerRef.current = setInterval(() => {
      const diff = parsedUnlock - Date.now()
      if (diff <= 0) {
        setCountdown('Unlocked!')
        if (timerRef.current) clearInterval(timerRef.current)
      } else {
        const s = Math.ceil(diff / 1000)
        const m = Math.floor(s / 60)
        setCountdown(m > 0 ? `${m}m ${s % 60}s remaining` : `${s}s remaining`)
      }
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [parsedUnlock])

  // Parse unlock time from ciphertext — use useMemo instead of effect+setState
  const parsedUnlockFromInput = (() => {
    if (!decryptInput.trim()) return null
    try {
      const bytes = fromBase64(decryptInput.trim())
      const parsed = EncryptedObject.parse(bytes)
      const idBytes = fromHex(parsed.id)
      return Number(bcs.u64().parse(idBytes))
    } catch {
      return null
    }
  })()

  // Sync parsedUnlock when input changes
  if (parsedUnlockFromInput !== parsedUnlock) {
    setParsedUnlock(parsedUnlockFromInput)
    if (!parsedUnlockFromInput) setCountdown('')
  }

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
      const unlock = Date.now() + delaySeconds * 1000
      const id = toHex(bcs.u64().serialize(unlock).toBytes())

      const { encryptedObject } = await client.encrypt({
        threshold: DEFAULT_THRESHOLD,
        packageId: SEAL_PACKAGE_ID,
        id,
        data: new TextEncoder().encode(plaintext),
      })
      setCiphertext(toBase64(encryptedObject))
      setEncStatus(
        `Encrypted! Unlocks at ${new Date(unlock).toLocaleTimeString()} (in ${delaySeconds}s)`,
      )
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

      setDecStatus('Building PTB with Clock object…')
      const suiClient = new SuiGrpcClient({ network, baseUrl: RPC_URLS[network] })
      const tx = new Transaction()
      tx.moveCall({
        target: `${parsed.packageId}::timelock_seal::seal_approve`,
        arguments: [tx.pure.vector('u8', fromHex(parsed.id)), tx.object(SUI_CLOCK)],
      })
      const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true })

      setDecStatus('Key servers checking: clock >= unlock_time?')
      const dec = await client.decrypt({ data: encryptedBytes, sessionKey, txBytes })
      setDecrypted(new TextDecoder().decode(dec))
      setDecStatus('Decrypted! Time-lock has passed.')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('does not have access')) {
        setDecStatus('Access denied — time-lock has not passed yet. Wait for the countdown.')
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

  const isUnlocked = parsedUnlock ? countdown === 'Unlocked!' : false

  return (
    <div className="sui-st">
      <div className="sui-st__header">
        <h3 className="sui-st__title">Time-Lock Encryption</h3>
        <p className="sui-st__desc">Encrypt data that unlocks after a deadline</p>
      </div>

      {!walletAddr && <div className="sui-st__warn">Connect wallet to use Time-Lock</div>}

      {/* Encrypt */}
      <div className="sui-st__panel">
        <div className="sui-st__panel-title">Encrypt with Time-Lock</div>
        <p className="sui-st__panel-desc">
          Identity = future timestamp. Nobody can decrypt before the deadline.
        </p>
        <textarea
          className="sui-st__textarea"
          placeholder="Secret message…"
          value={plaintext}
          onChange={(e) => setPlaintext(e.target.value)}
          rows={2}
        />
        <div className="sui-st__delay-row">
          <label className="sui-st__label">Unlock in:</label>
          <input
            className="sui-st__input sui-st__input--sm"
            type="number"
            min={5}
            max={3600}
            value={delaySeconds}
            onChange={(e) => setDelaySeconds(Number(e.target.value))}
          />
          <span className="sui-st__label">seconds</span>
        </div>
        <button
          type="button"
          className="sui-st__btn"
          onClick={handleEncrypt}
          disabled={!walletAddr || !plaintext.trim()}
        >
          Encrypt (Time-Lock)
        </button>
        {encStatus && <div className="sui-st__status">{encStatus}</div>}
        {ciphertext && (
          <div className="sui-st__output">
            <pre className="sui-st__pre">{ciphertext}</pre>
            <button type="button" className="sui-st__copy" onClick={() => copy(ciphertext)}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}
      </div>

      {/* Decrypt */}
      <div className="sui-st__panel">
        <div className="sui-st__panel-title">Decrypt</div>
        <p className="sui-st__panel-desc">
          {
            'Paste ciphertext. Key servers dry-run seal_approve(id, clock) — checks clock >= timestamp.'
          }
        </p>
        <textarea
          className="sui-st__textarea"
          placeholder="Paste ciphertext here…"
          value={decryptInput}
          onChange={(e) => setDecryptInput(e.target.value)}
          rows={4}
        />

        {/* Countdown */}
        {parsedUnlock && (
          <div className={`sui-st__countdown ${isUnlocked ? 'sui-st__countdown--unlocked' : ''}`}>
            <div className="sui-st__countdown-icon">{isUnlocked ? '🔓' : '🔒'}</div>
            <div>
              <div className="sui-st__countdown-time">{isUnlocked ? 'Unlocked' : countdown}</div>
              <div className="sui-st__countdown-date">
                Unlock: {new Date(parsedUnlock).toLocaleString()}
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          className="sui-st__btn"
          onClick={handleDecrypt}
          disabled={!walletAddr || !decryptInput.trim()}
        >
          Decrypt
        </button>
        {decStatus && (
          <div
            className={`sui-st__status ${decStatus.startsWith('Access') ? 'sui-st__status--err' : ''}`}
          >
            {decStatus}
          </div>
        )}
        {decrypted && <div className="sui-st__result">{decrypted}</div>}
      </div>

      {error && <div className="sui-st__error">{error}</div>}

      <div className="sui-st__footer">
        <span className="sui-st__net">{network}</span>
        <span className="sui-st__pkg">timelock_seal</span>
      </div>
    </div>
  )
}

const SuiSealTimelockPlugin: Plugin = {
  name: 'SuiSealTimelock',
  version: '1.0.0',
  styleUrls: ['/plugins/sui-seal-timelock/style.css'],
  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('SuiSealTimelock', SealTimelockContent)
    host.log('SuiSealTimelock initialized')
  },
  mount() {
    console.log('[SuiSealTimelock] mounted')
  },
  unmount() {
    sharedHost = null
    console.log('[SuiSealTimelock] unmounted')
  },
}

export default SuiSealTimelockPlugin
