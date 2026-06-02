// SUI ZK Merkle Identity Plugin
// Build Merkle tree from wallet addresses (WASM) → export identity.json blobs
// Each blob = identity_secret + commitment + Merkle path + poll info

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { useState, useCallback, useRef } from 'react'
import './style.css'

// ─── WASM loader ───
type WasmModule = {
  build_merkle_tree: (addrs: unknown, pollId: string, title: string, signal: string) => unknown
  verify_proof: (commitment: string, proof: unknown, root: string) => boolean
}
let wasm: WasmModule | null = null
let wasmStatus: 'loading' | 'ready' | 'error' = 'loading'

async function initWasm() {
  try {
    const pkgUrl = `${import.meta.env.BASE_URL}plugins/sui-zk-merkle/pkg/zk_merkle_wasm.js`
    const mod = (await import(/* @vite-ignore */ pkgUrl)) as {
      default: (input: URL) => Promise<unknown>
      build_merkle_tree: WasmModule['build_merkle_tree']
      verify_proof: WasmModule['verify_proof']
    }
    await mod.default(new URL(`${import.meta.env.BASE_URL}wasm/zk-merkle.wasm`, location.origin))
    wasm = mod
    wasmStatus = 'ready'
  } catch (e) {
    console.warn('[ZkMerkle] WASM load failed:', e)
    wasmStatus = 'error'
  }
}
const wasmReady = initWasm()

// ─── Types ───
interface ProofNode {
  hash: string
  position: string
}
interface IdentityBlob {
  identity_secret: string
  identity_nullifier: string
  identity_commitment: string
  address: string
  merkle_root: string
  merkle_path: ProofNode[]
  leaf_index: number
  tree_depth: number
  poll_info: { poll_id: string; title: string; total_members: number }
  groth16_inputs: {
    merkle_root_le: string
    nullifier_hash_le: string
    signal_hash_le: string
    external_nullifier_le: string
    concatenated_le: string
    merkle_root_decimal: string
    nullifier_hash_decimal: string
  }
}
interface MerkleResult {
  root: string
  root_le: string
  root_decimal: string
  leaf_count: number
  tree_depth: number
  commitments: string[]
  identities: IdentityBlob[]
}

// ─── Component ───
function ZkMerkleContent() {
  const [addresses, setAddresses] = useState('')
  const [pollId, setPollId] = useState('')
  const [pollTitle, setPollTitle] = useState('')
  const [signal, setSignal] = useState('')
  const [result, setResult] = useState<MerkleResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [verifyResult, setVerifyResult] = useState<boolean | null>(null)
  const dlRef = useRef<HTMLAnchorElement>(null)

  const buildTree = useCallback(async () => {
    await wasmReady
    if (!wasm) {
      setError('WASM not loaded')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    setSelectedIdx(null)
    try {
      const addrs = addresses
        .split(/[\n,]+/)
        .map((a) => a.trim())
        .filter((a) => a.startsWith('0x') && a.length > 10)
      if (addrs.length === 0) throw new Error('Enter at least 1 valid address (0x...)')
      const id = pollId || `poll_${Date.now()}`
      const title = pollTitle || 'Untitled Poll'
      const r = wasm.build_merkle_tree(addrs, id, title, signal || 'vote') as MerkleResult
      setResult(r)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [addresses, pollId, pollTitle])

  function downloadIdentity(idx: number) {
    if (!result) return
    const blob = result.identities[idx]
    const json = JSON.stringify(blob, null, 2)
    const file = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(file)
    if (dlRef.current) {
      dlRef.current.href = url
      dlRef.current.download = `identity_${blob.address.slice(0, 8)}.json`
      dlRef.current.click()
      URL.revokeObjectURL(url)
    }
  }

  function downloadAll() {
    if (!result) return
    const json = JSON.stringify(result, null, 2)
    const file = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(file)
    if (dlRef.current) {
      dlRef.current.href = url
      dlRef.current.download = `merkle_${result.root.slice(0, 8)}.json`
      dlRef.current.click()
      URL.revokeObjectURL(url)
    }
  }

  function verifyIdentity(idx: number) {
    if (!result || !wasm) return
    const id = result.identities[idx]
    const ok = wasm.verify_proof(id.identity_commitment, id.merkle_path, id.merkle_root)
    setVerifyResult(ok)
    setSelectedIdx(idx)
  }

  return (
    <div className="sui-zm">
      <div className="sui-zm__header">
        <h3 className="sui-zm__title">ZK Merkle Identity</h3>
        <span
          className={`sui-zm__badge ${wasmStatus === 'ready' ? 'sui-zm__badge--ok' : 'sui-zm__badge--err'}`}
        >
          {wasmStatus === 'ready' ? 'WASM 72KB' : wasmStatus}
        </span>
      </div>

      {error && <div className="sui-zm__error">{error}</div>}

      {/* Input */}
      <div className="sui-zm__card">
        <label className="sui-zm__label">Wallet Addresses (one per line or comma-separated)</label>
        <textarea
          className="sui-zm__textarea"
          rows={4}
          placeholder={
            '0xde03f5aa56efbf3765da3b92425e1403f0820f574933073c13c47070fd56128b\n0xabc123...'
          }
          value={addresses}
          onChange={(e) => setAddresses(e.target.value)}
        />
        <div className="sui-zm__row">
          <div className="sui-zm__field">
            <label className="sui-zm__label">Poll ID</label>
            <input
              className="sui-zm__input"
              placeholder="poll_001"
              value={pollId}
              onChange={(e) => setPollId(e.target.value)}
            />
          </div>
          <div className="sui-zm__field">
            <label className="sui-zm__label">Title</label>
            <input
              className="sui-zm__input"
              placeholder="DAO Vote #1"
              value={pollTitle}
              onChange={(e) => setPollTitle(e.target.value)}
            />
          </div>
        </div>
        <div className="sui-zm__row">
          <div className="sui-zm__field">
            <label className="sui-zm__label">Signal (vote value / action)</label>
            <input
              className="sui-zm__input"
              placeholder="vote_yes"
              value={signal}
              onChange={(e) => setSignal(e.target.value)}
            />
          </div>
        </div>
        <button className="sui-zm__btn" onClick={buildTree} disabled={loading || !addresses.trim()}>
          {loading ? 'Building…' : 'Build Merkle Tree (WASM)'}
        </button>
      </div>

      {/* Result */}
      {result && (
        <>
          <div className="sui-zm__card">
            <div className="sui-zm__card-title">Merkle Tree (Poseidon BN254)</div>
            <div className="sui-zm__info">
              <div className="sui-zm__info-row">
                <span>Root</span>
                <code>
                  {result.root.slice(0, 16)}…{result.root.slice(-8)}
                </code>
              </div>
              <div className="sui-zm__info-row">
                <span>Leaves</span>
                <code>{result.leaf_count}</code>
              </div>
              <div className="sui-zm__info-row">
                <span>Depth</span>
                <code>{result.tree_depth}</code>
              </div>
              <div className="sui-zm__info-row">
                <span>Hash</span>
                <code>Poseidon BN254 (Circom)</code>
              </div>
              <div className="sui-zm__info-row">
                <span>Groth16</span>
                <code>sui::groth16::bn254()</code>
              </div>
            </div>
            <button className="sui-zm__btn sui-zm__btn--dl" onClick={downloadAll}>
              Download Full Tree JSON
            </button>
          </div>

          <div className="sui-zm__card">
            <div className="sui-zm__card-title">Identity Blobs ({result.identities.length})</div>
            <div className="sui-zm__list">
              {result.identities.map((id, i) => (
                <div
                  key={i}
                  className={`sui-zm__identity ${selectedIdx === i ? 'sui-zm__identity--selected' : ''}`}
                >
                  <div className="sui-zm__identity-head">
                    <span className="sui-zm__identity-idx">#{i}</span>
                    <code className="sui-zm__identity-addr">
                      {id.address.slice(0, 10)}…{id.address.slice(-6)}
                    </code>
                  </div>
                  <div className="sui-zm__identity-meta">
                    <span>nullifier: {id.identity_nullifier.slice(0, 8)}…</span>
                    <span>commit: {id.identity_commitment.slice(0, 8)}…</span>
                  </div>
                  <div className="sui-zm__identity-actions">
                    <button className="sui-zm__btn-sm" onClick={() => downloadIdentity(i)}>
                      Download
                    </button>
                    <button
                      className="sui-zm__btn-sm sui-zm__btn-sm--verify"
                      onClick={() => verifyIdentity(i)}
                    >
                      Verify
                    </button>
                    {selectedIdx === i && verifyResult !== null && (
                      <span className={verifyResult ? 'sui-zm__verify-ok' : 'sui-zm__verify-fail'}>
                        {verifyResult ? '✓ Valid' : '✗ Invalid'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <a ref={dlRef} style={{ display: 'none' }} />

      <div className="sui-zm__footer">
        <span className="sui-zm__badge sui-zm__badge--ok">Rust WASM</span>
        <span className="sui-zm__badge">SHA-256 Merkle</span>
        <span className="sui-zm__disclaimer">Identity blobs are secrets — do not share</span>
      </div>
    </div>
  )
}

const SuiZkMerklePlugin: Plugin = {
  name: 'SuiZkMerkle',
  version: '1.0.0',
  styleUrls: ['/plugins/sui-zk-merkle/style.css'],
  init(host: HostAPI) {
    host.registerComponent('SuiZkMerkle', ZkMerkleContent)
    host.log('SuiZkMerkle initialized')
  },
  mount() {
    console.log('[SuiZkMerkle] mounted')
  },
  unmount() {
    console.log('[SuiZkMerkle] unmounted')
  },
}

export default SuiZkMerklePlugin
