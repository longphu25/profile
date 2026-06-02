// SUI ZK Login Plugin — Zero-Knowledge Proof authentication via OAuth
// Based on K2 bootcamp: Ephemeral keypair → OAuth → ZK Proof → Wallet
// Flow: Google OAuth JWT → Mysten prover → zkLogin signature → on-chain tx

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useCallback } from 'react'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import {
  generateNonce,
  generateRandomness,
  jwtToAddress,
  genAddressSeed,
  getZkLoginSignature,
} from '@mysten/sui/zklogin'
import { Transaction } from '@mysten/sui/transactions'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { jwtDecode } from 'jwt-decode'
import './style.css'

let sharedHost: SuiHostAPI | null = null

const PROVER_URL = 'https://prover-dev.mystenlabs.com/v1'
const GRPC_URL = 'https://fullnode.devnet.sui.io:443'
const NETWORK = 'devnet'
// Default salt — in production, use a unique per-user salt stored securely
const DEFAULT_SALT = '248191903847969014646285995941615069143'
const EPOCH_DURATION = 2

// ─── ZK helpers ───
function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}
function hexToBase64(hex: string): string {
  const bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)))
  return bytesToBase64(bytes)
}
function saltToBase64(salt: string): string {
  const hex = BigInt(salt).toString(16).padStart(32, '0')
  return hexToBase64(hex)
}
function randomnessToBase64(r: string): string {
  const hex = BigInt(r).toString(16).padStart(32, '0')
  return hexToBase64(hex)
}

async function fetchZkProof(payload: Record<string, unknown>) {
  const res = await fetch(PROVER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Prover error: ${res.status} ${await res.text()}`)
  return res.json()
}

// ─── Types ───
type Step = 'init' | 'ephemeral' | 'oauth' | 'proving' | 'wallet'

interface EphemeralData {
  keypair: Ed25519Keypair
  publicKey: string
  randomness: string
  nonce: string
  maxEpoch: number
}

interface JwtData {
  token: string
  iss: string
  sub: string
  aud: string
  nonce: string
}

interface WalletData {
  address: string
  addressSeed: string
  balance: string
}

// ─── Component ───
function ZkLoginContent() {
  const [step, setStep] = useState<Step>('init')
  const [ephemeral, setEphemeral] = useState<EphemeralData | null>(null)
  const [jwt, setJwt] = useState<JwtData | null>(null)
  const [zkProof, setZkProof] = useState<Record<string, unknown> | null>(null)
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [oauthClientId, setOauthClientId] = useState('')
  const [salt] = useState(DEFAULT_SALT)
  const [txResult, setTxResult] = useState<string | null>(null)

  // Step 1: Generate ephemeral keypair
  const generateEphemeral = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const client = new SuiGrpcClient({ network: NETWORK, baseUrl: GRPC_URL })
      const epochResp = await client.ledgerService.getEpoch({})
      const currentEpoch = Number(epochResp.response.epoch?.epoch ?? 0)
      const maxEpoch = currentEpoch + EPOCH_DURATION

      const keypair = Ed25519Keypair.generate()
      const publicKey = keypair.getPublicKey()
      const randomness = generateRandomness()
      const nonce = generateNonce(publicKey, maxEpoch, randomness)

      const data: EphemeralData = {
        keypair,
        publicKey: publicKey.toBase64(),
        randomness: randomness.toString(),
        nonce,
        maxEpoch,
      }
      setEphemeral(data)
      setStep('ephemeral')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  // Step 2: OAuth login
  const startOauth = useCallback(() => {
    if (!ephemeral || !oauthClientId) return
    const redirectUri = window.location.origin
    const params = new URLSearchParams({
      response_type: 'id_token',
      client_id: oauthClientId,
      redirect_uri: redirectUri,
      scope: 'openid email profile',
      nonce: ephemeral.nonce,
    })
    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
    const popup = window.open(url, 'zklogin-oauth', 'width=500,height=600')

    // Listen for redirect with id_token
    const interval = setInterval(() => {
      try {
        if (!popup || popup.closed) {
          clearInterval(interval)
          return
        }
        const hash = popup.location.hash
        if (hash && hash.includes('id_token=')) {
          const token = new URLSearchParams(hash.slice(1)).get('id_token')
          if (token) {
            popup.close()
            clearInterval(interval)
            handleJwt(token)
          }
        }
      } catch {
        // Cross-origin — ignore until redirect
      }
    }, 500)
  }, [ephemeral, oauthClientId])

  function handleJwt(token: string) {
    const decoded = jwtDecode<{ iss: string; sub: string; aud: string; nonce: string }>(token)
    setJwt({
      token,
      iss: decoded.iss,
      sub: decoded.sub,
      aud: typeof decoded.aud === 'string' ? decoded.aud : decoded.aud[0],
      nonce: decoded.nonce,
    })
    setStep('oauth')
  }

  // Step 3: Generate ZK proof
  const generateProof = useCallback(async () => {
    if (!jwt || !ephemeral) return
    setLoading(true)
    setError(null)
    try {
      const payload = {
        jwt: jwt.token,
        extendedEphemeralPublicKey: ephemeral.publicKey,
        maxEpoch: ephemeral.maxEpoch,
        jwtRandomness: randomnessToBase64(ephemeral.randomness),
        salt: saltToBase64(salt),
        keyClaimName: 'sub',
      }
      const proof = await fetchZkProof(payload)
      setZkProof(proof)

      // Derive wallet address
      const address = jwtToAddress(jwt.token, BigInt(salt), false)
      const addressSeed = genAddressSeed(BigInt(salt), 'sub', jwt.sub, jwt.aud).toString()

      let balance = '0'
      try {
        const grpc = new SuiGrpcClient({ network: NETWORK, baseUrl: GRPC_URL })
        const bal = await grpc.core.getBalance({ owner: address })
        balance = String(bal.balance?.balance ?? '0')
      } catch {
        /* new address, no balance */
      }

      setWallet({ address, addressSeed, balance })
      setStep('wallet')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [jwt, ephemeral, salt])

  // Step 4: Send transaction with zkLogin
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')

  const sendTx = useCallback(async () => {
    if (!wallet || !ephemeral || !zkProof || !recipient || !amount) return
    setLoading(true)
    setError(null)
    setTxResult(null)
    try {
      const client = new SuiGrpcClient({ network: NETWORK, baseUrl: GRPC_URL })
      const amountMist = Math.floor(Number(amount) * 1e9)

      // Build transaction
      const tx = new Transaction()
      tx.setSender(wallet.address)
      const [coin] = tx.splitCoins(tx.gas, [amountMist])
      tx.transferObjects([coin], recipient)

      const txBytes = await tx.build({ client })
      const { signature: userSignature } = await ephemeral.keypair.signTransaction(txBytes)

      // Create zkLogin signature
      const zkSig = getZkLoginSignature({
        inputs: {
          proofPoints: (zkProof as Record<string, unknown>).proofPoints as never,
          issBase64Details: (zkProof as Record<string, unknown>).issBase64Details as never,
          headerBase64: (zkProof as Record<string, unknown>).headerBase64 as string,
          addressSeed: wallet.addressSeed,
        },
        maxEpoch: ephemeral.maxEpoch.toString(),
        userSignature,
      })

      // Execute via core client
      await client.core.executeTransaction({
        transaction: txBytes,
        signatures: [zkSig],
      })

      setTxResult('Tx sent! Check explorer for details.')

      // Refresh balance
      try {
        const bal = await client.core.getBalance({ owner: wallet.address })
        setWallet((w) => (w ? { ...w, balance: String(bal.balance?.balance ?? w.balance) } : w))
      } catch {
        /* ignore */
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [wallet, ephemeral, zkProof, recipient, amount])

  // Share wallet to other plugins
  function shareWallet() {
    if (!wallet || !sharedHost) return
    sharedHost.setSharedData('walletProfile', { address: wallet.address, network: NETWORK })
  }

  // ─── Render ───
  const stepNum = { init: 0, ephemeral: 1, oauth: 2, proving: 3, wallet: 4 }[step]

  return (
    <div className="sui-zk">
      <div className="sui-zk__header">
        <h3 className="sui-zk__title">ZK Login</h3>
        <span className="sui-zk__network">{NETWORK}</span>
      </div>

      {/* Progress */}
      <div className="sui-zk__progress">
        {['Keypair', 'OAuth', 'ZK Proof', 'Wallet'].map((label, i) => (
          <div
            key={label}
            className={`sui-zk__step-dot ${i < stepNum ? 'sui-zk__step-dot--done' : i === stepNum ? 'sui-zk__step-dot--active' : ''}`}
          >
            <span className="sui-zk__step-num">{i + 1}</span>
            <span className="sui-zk__step-label">{label}</span>
          </div>
        ))}
      </div>

      {error && <div className="sui-zk__error">{error}</div>}
      {txResult && <div className="sui-zk__success">{txResult}</div>}

      {/* Step 1: Generate Ephemeral */}
      {step === 'init' && (
        <div className="sui-zk__card">
          <div className="sui-zk__card-title">Step 1: Generate Ephemeral Keypair</div>
          <p className="sui-zk__card-desc">
            Creates a temporary Ed25519 keypair, randomness, and nonce for the ZK proof.
          </p>
          <button className="sui-zk__btn" onClick={generateEphemeral} disabled={loading}>
            {loading ? 'Generating…' : 'Generate Keypair'}
          </button>
        </div>
      )}

      {/* Step 2: OAuth */}
      {step === 'ephemeral' && ephemeral && (
        <div className="sui-zk__card">
          <div className="sui-zk__card-title">Step 2: Google OAuth Login</div>
          <div className="sui-zk__info">
            <div className="sui-zk__info-row">
              <span>Public Key</span>
              <code>{ephemeral.publicKey.slice(0, 20)}…</code>
            </div>
            <div className="sui-zk__info-row">
              <span>Nonce</span>
              <code>{ephemeral.nonce.slice(0, 20)}…</code>
            </div>
            <div className="sui-zk__info-row">
              <span>Max Epoch</span>
              <code>{ephemeral.maxEpoch}</code>
            </div>
          </div>
          <label className="sui-zk__label">Google OAuth Client ID</label>
          <input
            className="sui-zk__input"
            placeholder="xxx.apps.googleusercontent.com"
            value={oauthClientId}
            onChange={(e) => setOauthClientId(e.target.value)}
          />
          <button className="sui-zk__btn" onClick={startOauth} disabled={!oauthClientId || loading}>
            Login with Google
          </button>
          <p className="sui-zk__hint">Or paste JWT token directly:</p>
          <input
            className="sui-zk__input"
            placeholder="eyJhbGciOiJSUzI1NiIs..."
            onChange={(e) => {
              if (e.target.value.startsWith('ey')) handleJwt(e.target.value)
            }}
          />
        </div>
      )}

      {/* Step 3: ZK Proof */}
      {step === 'oauth' && jwt && (
        <div className="sui-zk__card">
          <div className="sui-zk__card-title">Step 3: Generate ZK Proof</div>
          <div className="sui-zk__info">
            <div className="sui-zk__info-row">
              <span>Issuer</span>
              <code>{jwt.iss}</code>
            </div>
            <div className="sui-zk__info-row">
              <span>Subject</span>
              <code>{jwt.sub.slice(0, 12)}…</code>
            </div>
            <div className="sui-zk__info-row">
              <span>Audience</span>
              <code>{jwt.aud.slice(0, 20)}…</code>
            </div>
          </div>
          <p className="sui-zk__card-desc">
            Sends JWT + ephemeral data to Mysten Labs prover service. This generates a
            zero-knowledge proof that you own the OAuth identity without revealing the JWT.
          </p>
          <button className="sui-zk__btn" onClick={generateProof} disabled={loading}>
            {loading ? 'Generating ZK Proof…' : 'Generate Proof & Derive Wallet'}
          </button>
        </div>
      )}

      {/* Step 4: Wallet */}
      {step === 'wallet' && wallet && (
        <div className="sui-zk__card">
          <div className="sui-zk__card-title">Step 4: ZK Wallet Ready</div>
          <div className="sui-zk__info">
            <div className="sui-zk__info-row">
              <span>Address</span>
              <code
                className="sui-zk__addr"
                title="Click to copy"
                onClick={() => navigator.clipboard.writeText(wallet.address)}
              >
                {wallet.address.slice(0, 10)}…{wallet.address.slice(-6)}
              </code>
            </div>
            <div className="sui-zk__info-row">
              <span>Balance</span>
              <code>{(Number(wallet.balance) / 1e9).toFixed(4)} SUI</code>
            </div>
            <div className="sui-zk__info-row">
              <span>ZK Proof</span>
              <code className="sui-zk__proof-ok">Verified</code>
            </div>
          </div>

          <button className="sui-zk__btn sui-zk__btn--share" onClick={shareWallet}>
            Share to Dashboard
          </button>

          <div className="sui-zk__send">
            <div className="sui-zk__send-title">Send SUI (zkLogin)</div>
            <input
              className="sui-zk__input"
              placeholder="Recipient address (0x...)"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
            <input
              className="sui-zk__input"
              placeholder="Amount (SUI)"
              type="number"
              step="0.001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <button
              className="sui-zk__btn"
              onClick={sendTx}
              disabled={loading || !recipient || !amount}
            >
              {loading ? 'Sending…' : 'Send with ZK Signature'}
            </button>
          </div>
        </div>
      )}

      {/* Reset */}
      {step !== 'init' && (
        <button
          className="sui-zk__btn-reset"
          onClick={() => {
            setStep('init')
            setEphemeral(null)
            setJwt(null)
            setZkProof(null)
            setWallet(null)
            setError(null)
            setTxResult(null)
          }}
        >
          Reset All Steps
        </button>
      )}

      <div className="sui-zk__footer">
        <span className="sui-zk__badge">zkLogin</span>
        <span className="sui-zk__badge sui-zk__badge--zk">ZK Proof</span>
        <span className="sui-zk__disclaimer">Devnet only — prover: Mysten Labs</span>
      </div>
    </div>
  )
}

const SuiZkLoginPlugin: Plugin = {
  name: 'SuiZkLogin',
  version: '1.0.0',
  styleUrls: ['/plugins/sui-zk-login/style.css'],
  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('SuiZkLogin', ZkLoginContent)
    host.log('SuiZkLogin initialized')
  },
  mount() {
    console.log('[SuiZkLogin] mounted')
  },
  unmount() {
    sharedHost = null
  },
}

export default SuiZkLoginPlugin
