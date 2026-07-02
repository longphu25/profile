// SUI Seal Voting Plugin
// Encrypted ballot voting with on-chain decryption (HMAC-CTR)
// 4 tabs: Create, Vote, Tally, Results

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useEffect, useRef } from 'react'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { Transaction } from '@mysten/sui/transactions'
import { SealClient, SessionKey, EncryptedObject, DemType } from '@mysten/seal'
import { fromHex, toHex } from '@mysten/bcs'
import { fromBase64 } from '@mysten/sui/utils'
import {
  WALLET_KEY,
  TESTNET_KEY_SERVERS,
  DEFAULT_THRESHOLD,
  SUI_CLOCK,
  RPC_URLS,
  type NetworkKey,
} from '../sui-seal-shared/config'
import { SEAL_ONCHAIN_PKG, shortenAddr, fetchSession, type SessionInfo } from './voting-utils'
import './style.css'

let sharedHost: SuiHostAPI | null = null

type Tab = 'create' | 'vote' | 'tally'

function SealVotingContent() {
  const [tab, setTab] = useState<Tab>('create')
  const [packageId, setPackageId] = useState('')
  const [network, setNetwork] = useState<NetworkKey>(() => {
    const d = sharedHost?.getSharedData(WALLET_KEY) as { network: string } | null
    return (d?.network === 'testnet' ? 'testnet' : 'mainnet') as NetworkKey
  })
  const [walletAddr, setWalletAddr] = useState<string | null>(() => {
    const d = sharedHost?.getSharedData(WALLET_KEY) as { address: string } | null
    return d?.address ?? null
  })
  const [error, setError] = useState<string | null>(null)

  // Create state
  const [topic, setTopic] = useState('')
  const [options, setOptions] = useState(['Yes', 'No'])
  const [voterInput, setVoterInput] = useState('')
  const [voters, setVoters] = useState<string[]>([])
  const [createStatus, setCreateStatus] = useState('')

  // Vote state
  const [voteSessionId, setVoteSessionId] = useState('')
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [voteStatus, setVoteStatus] = useState('')
  const [loadingSession, setLoadingSession] = useState(false)

  // Tally state
  const [tallySessionId, setTallySessionId] = useState('')
  const [tallySession, setTallySession] = useState<SessionInfo | null>(null)
  const [tallyStatus, setTallyStatus] = useState('')
  const [tallyProgress, setTallyProgress] = useState('')
  const [results, setResults] = useState<number[] | null>(null)
  const [tallying, setTallying] = useState(false)
  const [tallyMode, setTallyMode] = useState<'client' | 'onchain'>('onchain')
  const [onChainVerified, setOnChainVerified] = useState(false)

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
      if (!packageId.trim()) throw new Error('Set Package ID first')
      const suiClient = new SuiGrpcClient({ network, baseUrl: RPC_URLS[network] })
      const sk = await SessionKey.create({
        address,
        packageId: packageId.trim(),
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

  // ─── CREATE ───
  async function handleCreate() {
    if (!walletAddr || !sharedHost || !packageId.trim()) return
    if (!topic.trim() || options.length < 2 || voters.length === 0) {
      setError('Need topic, 2+ options, and 1+ voter')
      return
    }
    setCreateStatus('Creating session on-chain…')
    setError(null)
    try {
      const tx = new Transaction()
      tx.moveCall({
        target: `${packageId}::voting_seal::create`,
        arguments: [
          tx.pure.vector('u8', new TextEncoder().encode(topic)),
          tx.pure.vector(
            'vector<u8>',
            options.map((o) => Array.from(new TextEncoder().encode(o))),
          ),
          tx.pure.vector('address', voters),
          tx.object(SUI_CLOCK),
        ],
      })
      const result = await sharedHost.signAndExecuteTransaction(tx)
      setCreateStatus('Waiting for indexing…')
      await new Promise((r) => setTimeout(r, 3000))
      // VotingSession is shared, not owned — use tx digest to find it
      setCreateStatus(`Session created! Tx: ${shortenAddr(result.digest)}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
      setCreateStatus('')
    }
  }

  // ─── VOTE: Load Session ───
  async function handleLoadSession() {
    if (!voteSessionId.trim()) return
    setLoadingSession(true)
    setSession(null)
    setError(null)
    try {
      const s = await fetchSession(RPC_URLS[network], voteSessionId.trim())
      if (!s) throw new Error('Session not found')
      setSession(s)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoadingSession(false)
    }
  }

  // ─── VOTE: Submit ───
  async function handleVote() {
    if (!walletAddr || !sharedHost || !session || selectedOption === null || !packageId.trim())
      return
    setVoteStatus('Encrypting ballot…')
    setError(null)
    try {
      const client = getSealClient()
      const ballotData = new Uint8Array([selectedOption])

      // Identity = session_object_id ++ random_nonce
      const sessionIdBytes = fromHex(session.objectId.replace(/^0x/, ''))
      const nonce = crypto.getRandomValues(new Uint8Array(5))
      const idBytes = new Uint8Array([...sessionIdBytes, ...nonce])
      const id = toHex(idBytes)

      const { encryptedObject } = await client.encrypt({
        threshold: DEFAULT_THRESHOLD,
        packageId: packageId.trim(),
        id,
        data: ballotData,
        demType: DemType.Hmac256Ctr,
      })

      setVoteStatus('Submitting ballot on-chain…')
      const tx = new Transaction()
      tx.moveCall({
        target: `${packageId}::voting_seal::submit_ballot`,
        arguments: [tx.object(session.objectId), tx.pure.vector('u8', Array.from(encryptedObject))],
      })
      await sharedHost.signAndExecuteTransaction(tx)
      setVoteStatus(
        'Vote submitted! Your ballot is encrypted — nobody can see it until voting closes.',
      )
      setSelectedOption(null)
      // Refresh session
      const s = await fetchSession(RPC_URLS[network], session.objectId)
      if (s) setSession(s)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
      setVoteStatus('')
    }
  }

  // ─── TALLY: Load ───
  async function handleLoadTally() {
    if (!tallySessionId.trim()) return
    setTallySession(null)
    setResults(null)
    setError(null)
    try {
      const s = await fetchSession(RPC_URLS[network], tallySessionId.trim())
      if (!s) throw new Error('Session not found')
      setTallySession(s)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  // ─── TALLY: Close ───
  async function handleClose() {
    if (!walletAddr || !sharedHost || !tallySession || !packageId.trim()) return
    setTallyStatus('Closing voting…')
    setError(null)
    try {
      const tx = new Transaction()
      tx.moveCall({
        target: `${packageId}::voting_seal::close`,
        arguments: [tx.object(tallySession.objectId)],
      })
      await sharedHost.signAndExecuteTransaction(tx)
      await new Promise((r) => setTimeout(r, 2000))
      const s = await fetchSession(RPC_URLS[network], tallySession.objectId)
      if (s) setTallySession(s)
      setTallyStatus('Voting closed!')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
      setTallyStatus('')
    }
  }

  // ─── TALLY: On-chain decryption via bf_hmac_encryption PTB ───
  async function handleOnChainTally() {
    if (!walletAddr || !sharedHost || !tallySession || !packageId.trim()) return
    if (!tallySession.isClosed) {
      setError('Close voting first')
      return
    }
    if (tallySession.encryptedBallots.length === 0) {
      setError('No ballots')
      return
    }

    setTallying(true)
    setResults(null)
    setOnChainVerified(false)
    setError(null)
    const counts = new Array(tallySession.options.length).fill(0)

    try {
      const client = getSealClient()
      setTallyStatus('Sign session key…')
      const sessionKey = await getSessionKey(walletAddr)
      const suiClient = new SuiGrpcClient({ network, baseUrl: RPC_URLS[network] })
      const total = tallySession.encryptedBallots.length

      const allEncrypted = tallySession.encryptedBallots.map((hex) => {
        try {
          return fromHex(hex.replace(/^0x/, ''))
        } catch {
          return fromBase64(hex)
        }
      })
      const allParsed = allEncrypted.map((b) => EncryptedObject.parse(b))

      // Get public keys once (same key servers for all ballots)
      setTallyStatus('Fetching public keys…')
      const serviceIds = allParsed[0].services.map(([s]) => s)
      const publicKeys = await client.getPublicKeys(serviceIds)

      // Process ballots in batches of 5 (PTB size limit)
      const BATCH_SIZE = 5
      for (let batchStart = 0; batchStart < total; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, total)
        setTallyProgress(
          `On-chain decrypt batch ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(total / BATCH_SIZE)}…`,
        )

        // Fetch derived keys for this batch
        for (let i = batchStart; i < batchEnd; i++) {
          setTallyProgress(`Fetching derived keys ${i + 1}/${total}…`)

          // Per-ballot approval PTB for getDerivedKeys
          const singleTx = new Transaction()
          singleTx.moveCall({
            target: `${packageId}::voting_seal::seal_approve`,
            arguments: [
              singleTx.pure.vector('u8', fromHex(allParsed[i].id)),
              singleTx.object(tallySession.objectId),
            ],
          })
          const singleTxBytes = await singleTx.build({
            client: suiClient,
            onlyTransactionKind: true,
          })

          try {
            const derivedKeys = await client.getDerivedKeys({
              id: allParsed[i].id,
              txBytes: singleTxBytes,
              sessionKey,
              threshold: allParsed[i].threshold,
            })

            // Build on-chain decryption PTB
            setTallyProgress(`On-chain decrypt ballot ${i + 1}/${total}…`)
            const tx = new Transaction()

            // 1. Convert public keys to on-chain PublicKey objects
            const correspondingPkObjects = Array.from(derivedKeys.keys()).map((objectId) => {
              const idx = allParsed[i].services.findIndex(([s]) => s === objectId)
              return tx.moveCall({
                target: `${SEAL_ONCHAIN_PKG}::bf_hmac_encryption::new_public_key`,
                arguments: [
                  tx.pure.address(objectId),
                  tx.pure.vector('u8', Array.from(publicKeys[idx].toBytes())),
                ],
              })
            })

            // 2. Convert derived keys to G1 elements
            const g1Elements = Array.from(derivedKeys).map(([, value]) =>
              tx.moveCall({
                target: '0x2::bls12381::g1_from_bytes',
                arguments: [tx.pure.vector('u8', Array.from(fromHex(value.toString())))],
              }),
            )

            // 3. Verify derived keys
            const verified = tx.moveCall({
              target: `${SEAL_ONCHAIN_PKG}::bf_hmac_encryption::verify_derived_keys`,
              arguments: [
                tx.makeMoveVec({
                  elements: g1Elements,
                  type: '0x2::group_ops::Element<0x2::bls12381::G1>',
                }),
                tx.pure.address(allParsed[i].packageId),
                tx.pure.vector('u8', Array.from(fromHex(allParsed[i].id))),
                tx.makeMoveVec({
                  elements: correspondingPkObjects,
                  type: `${SEAL_ONCHAIN_PKG}::bf_hmac_encryption::PublicKey`,
                }),
              ],
            })

            // 4. Parse encrypted object on-chain
            const parsedOnChain = tx.moveCall({
              target: `${SEAL_ONCHAIN_PKG}::bf_hmac_encryption::parse_encrypted_object`,
              arguments: [tx.pure.vector('u8', Array.from(allEncrypted[i]))],
            })

            // 5. Build all public keys for decrypt call
            const allPkObjects = publicKeys.map((pk, idx) =>
              tx.moveCall({
                target: `${SEAL_ONCHAIN_PKG}::bf_hmac_encryption::new_public_key`,
                arguments: [
                  tx.pure.address(allParsed[i].services[idx][0]),
                  tx.pure.vector('u8', Array.from(pk.toBytes())),
                ],
              }),
            )

            // 6. Decrypt on-chain → Option<vector<u8>>
            tx.moveCall({
              target: `${SEAL_ONCHAIN_PKG}::bf_hmac_encryption::decrypt`,
              arguments: [
                parsedOnChain,
                verified,
                tx.makeMoveVec({
                  elements: allPkObjects,
                  type: `${SEAL_ONCHAIN_PKG}::bf_hmac_encryption::PublicKey`,
                }),
              ],
            })

            // Execute via devInspectTransactionBlock (JSON-RPC, no gas needed)
            const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true })
            const rpc = RPC_URLS[network]
            const inspectRes = await fetch(rpc, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'sui_devInspectTransactionBlock',
                params: [walletAddr, toHex(txBytes), null, null],
              }),
            })
            const inspectJson = await inspectRes.json()
            const inspectResult = inspectJson.result

            // Parse the return value (Option<vector<u8>>)
            const returnValues =
              inspectResult?.results?.[inspectResult.results.length - 1]?.returnValues
            if (returnValues && returnValues.length > 0) {
              const [rawBytes] = returnValues[0]
              // Option<vector<u8>> BCS: 0x01 + length + data (Some), or 0x00 (None)
              const bytes =
                typeof rawBytes === 'string'
                  ? fromHex(rawBytes.replace(/^0x/, ''))
                  : new Uint8Array(rawBytes)
              if (bytes.length > 0 && bytes[0] === 1) {
                // Some — skip option tag (1 byte) + ULEB128 length
                let offset = 1
                let len = 0
                let shift = 0
                while (offset < bytes.length) {
                  const b = bytes[offset++]
                  len |= (b & 0x7f) << shift
                  if ((b & 0x80) === 0) break
                  shift += 7
                }
                if (len > 0 && offset < bytes.length) {
                  const optionIdx = bytes[offset]
                  if (optionIdx < counts.length) counts[optionIdx]++
                }
              }
            }
          } catch {
            // Invalid ballot or decryption failed — skip
          }
        }
      }

      setResults([...counts])
      setOnChainVerified(true)
      setTallyStatus(`On-chain tally complete! ${total} ballots processed.`)
      setTallyProgress('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
      setTallyStatus('')
      setTallyProgress('')
    } finally {
      setTallying(false)
    }
  }

  // ─── TALLY: Client-side decrypt (fallback, faster) ───
  async function handleClientTally() {
    if (!walletAddr || !sharedHost || !tallySession || !packageId.trim()) return
    if (!tallySession.isClosed) {
      setError('Close voting first')
      return
    }
    if (tallySession.encryptedBallots.length === 0) {
      setError('No ballots')
      return
    }

    setTallying(true)
    setResults(null)
    setOnChainVerified(false)
    setError(null)
    const counts = new Array(tallySession.options.length).fill(0)

    try {
      const client = getSealClient()
      setTallyStatus('Sign session key…')
      const sessionKey = await getSessionKey(walletAddr)
      const suiClient = new SuiGrpcClient({ network, baseUrl: RPC_URLS[network] })
      const total = tallySession.encryptedBallots.length

      // Pre-fetch all keys in batch
      const allEncrypted = tallySession.encryptedBallots.map((hex) => {
        // Ballots stored as vector<u8> — may be raw bytes or hex
        try {
          return fromHex(hex.replace(/^0x/, ''))
        } catch {
          return fromBase64(hex)
        }
      })
      const allParsed = allEncrypted.map((b) => EncryptedObject.parse(b))
      const allIds = allParsed.map((p) => p.id)

      // Build a single approval PTB for fetchKeys
      const approvalTx = new Transaction()
      for (const parsed of allParsed) {
        approvalTx.moveCall({
          target: `${packageId}::voting_seal::seal_approve`,
          arguments: [
            approvalTx.pure.vector('u8', fromHex(parsed.id)),
            approvalTx.object(tallySession.objectId),
          ],
        })
      }
      const approvalBytes = await approvalTx.build({ client: suiClient, onlyTransactionKind: true })

      setTallyStatus('Fetching keys from key servers…')
      await client.fetchKeys({
        ids: allIds,
        txBytes: approvalBytes,
        sessionKey,
        threshold: DEFAULT_THRESHOLD,
      })

      // Decrypt each ballot
      for (let i = 0; i < total; i++) {
        setTallyProgress(`Decrypting ballot ${i + 1}/${total}…`)
        try {
          // Build per-ballot approval PTB
          const tx = new Transaction()
          tx.moveCall({
            target: `${packageId}::voting_seal::seal_approve`,
            arguments: [
              tx.pure.vector('u8', fromHex(allParsed[i].id)),
              tx.object(tallySession.objectId),
            ],
          })
          const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true })

          const plaintext = await client.decrypt({
            data: allEncrypted[i],
            sessionKey,
            txBytes,
          })
          const optionIdx = plaintext[0]
          if (optionIdx < counts.length) counts[optionIdx]++
        } catch {
          // Invalid ballot — skip
        }
      }

      setResults([...counts])
      setTallyStatus(`Tally complete! ${total} ballots decrypted.`)
      setTallyProgress('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
      setTallyStatus('')
      setTallyProgress('')
    } finally {
      setTallying(false)
    }
  }

  function handleTally() {
    if (tallyMode === 'onchain') handleOnChainTally()
    else handleClientTally()
  }

  const addOption = () => setOptions([...options, ''])
  const removeOption = (i: number) => setOptions(options.filter((_, idx) => idx !== i))
  const updateOption = (i: number, v: string) => {
    const o = [...options]
    o[i] = v
    setOptions(o)
  }
  const addVoter = () => {
    const v = voterInput.trim()
    if (v && !voters.includes(v)) {
      setVoters([...voters, v])
      setVoterInput('')
    }
  }
  const removeVoter = (i: number) => setVoters(voters.filter((_, idx) => idx !== i))

  return (
    <div className="sui-sv2">
      <div className="sui-sv2__header">
        <h3 className="sui-sv2__title">Sealed Voting</h3>
        <p className="sui-sv2__desc">Encrypted ballots — votes hidden until tally</p>
      </div>

      {!walletAddr && <div className="sui-sv2__warn">Connect wallet to use Voting</div>}

      {/* Package ID config */}
      <div className="sui-sv2__config">
        <label className="sui-sv2__label">Voting Package ID</label>
        <input
          className="sui-sv2__input"
          placeholder="0x… (deploy voting_seal.move)"
          value={packageId}
          onChange={(e) => setPackageId(e.target.value)}
        />
      </div>

      {/* Tabs */}
      <div className="sui-sv2__tabs">
        {(['create', 'vote', 'tally'] as const).map((t) => (
          <button
            type="button"
            key={t}
            className={`sui-sv2__tab ${tab === t ? 'sui-sv2__tab--active' : ''}`}
            onClick={() => {
              setTab(t)
              setError(null)
            }}
          >
            {t === 'create' ? 'Create' : t === 'vote' ? 'Vote' : 'Tally'}
          </button>
        ))}
      </div>

      {/* ─── CREATE TAB ─── */}
      {tab === 'create' && (
        <div className="sui-sv2__panel">
          <div className="sui-sv2__panel-title">Create Voting Session</div>
          <div className="sui-sv2__field">
            <label className="sui-sv2__label">Topic</label>
            <input
              className="sui-sv2__input"
              placeholder="What are we voting on?"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>

          <div className="sui-sv2__field">
            <label className="sui-sv2__label">Options</label>
            {options.map((o, i) => (
              <div key={i} className="sui-sv2__row">
                <input
                  className="sui-sv2__input"
                  value={o}
                  onChange={(e) => updateOption(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                />
                {options.length > 2 && (
                  <button type="button" className="sui-sv2__btn-x" onClick={() => removeOption(i)}>
                    x
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="sui-sv2__btn-add" onClick={addOption}>
              + Add Option
            </button>
          </div>

          <div className="sui-sv2__field">
            <label className="sui-sv2__label">Eligible Voters</label>
            <div className="sui-sv2__row">
              <input
                className="sui-sv2__input"
                placeholder="0x… address"
                value={voterInput}
                onChange={(e) => setVoterInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addVoter()}
              />
              <button type="button" className="sui-sv2__btn-add" onClick={addVoter}>
                Add
              </button>
            </div>
            {walletAddr && !voters.includes(walletAddr) && (
              <button
                type="button"
                className="sui-sv2__btn-add"
                onClick={() => setVoters([...voters, walletAddr])}
              >
                + Add myself
              </button>
            )}
            {voters.map((v, i) => (
              <div key={i} className="sui-sv2__voter-row">
                <span className="sui-sv2__voter-addr">{shortenAddr(v)}</span>
                <button type="button" className="sui-sv2__btn-x" onClick={() => removeVoter(i)}>
                  x
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="sui-sv2__btn"
            onClick={handleCreate}
            disabled={!walletAddr || !packageId.trim()}
          >
            Create Session
          </button>
          {createStatus && <div className="sui-sv2__status">{createStatus}</div>}
        </div>
      )}

      {/* ─── VOTE TAB ─── */}
      {tab === 'vote' && (
        <div className="sui-sv2__panel">
          <div className="sui-sv2__panel-title">Cast Your Vote</div>
          <div className="sui-sv2__row">
            <input
              className="sui-sv2__input"
              placeholder="Session Object ID"
              value={voteSessionId}
              onChange={(e) => setVoteSessionId(e.target.value)}
            />
            <button
              type="button"
              className="sui-sv2__btn-add"
              onClick={handleLoadSession}
              disabled={loadingSession}
            >
              {loadingSession ? '…' : 'Load'}
            </button>
          </div>

          {session && (
            <>
              <div className="sui-sv2__session-info">
                <div className="sui-sv2__session-topic">{session.topic}</div>
                <div className="sui-sv2__session-meta">
                  {session.isClosed ? 'Closed' : 'Open'} — {session.votersSubmitted.length}/
                  {session.eligibleVoters.length} voted
                </div>
              </div>

              {!session.isClosed && (
                <>
                  <div className="sui-sv2__options">
                    {session.options.map((opt, i) => (
                      <label
                        key={i}
                        className={`sui-sv2__option ${selectedOption === i ? 'sui-sv2__option--selected' : ''}`}
                      >
                        <input
                          type="radio"
                          name="vote"
                          checked={selectedOption === i}
                          onChange={() => setSelectedOption(i)}
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="sui-sv2__btn"
                    onClick={handleVote}
                    disabled={selectedOption === null || !walletAddr}
                  >
                    Submit Encrypted Vote
                  </button>
                </>
              )}
              {session.isClosed && <div className="sui-sv2__status">Voting is closed.</div>}
              {voteStatus && <div className="sui-sv2__status">{voteStatus}</div>}
            </>
          )}
        </div>
      )}

      {/* ─── TALLY TAB ─── */}
      {tab === 'tally' && (
        <div className="sui-sv2__panel">
          <div className="sui-sv2__panel-title">Close & Tally</div>
          <div className="sui-sv2__row">
            <input
              className="sui-sv2__input"
              placeholder="Session Object ID"
              value={tallySessionId}
              onChange={(e) => setTallySessionId(e.target.value)}
            />
            <button type="button" className="sui-sv2__btn-add" onClick={handleLoadTally}>
              Load
            </button>
          </div>

          {tallySession && (
            <>
              <div className="sui-sv2__session-info">
                <div className="sui-sv2__session-topic">{tallySession.topic}</div>
                <div className="sui-sv2__session-meta">
                  {tallySession.isClosed ? 'Closed' : 'Open'} —{' '}
                  {tallySession.votersSubmitted.length}/{tallySession.eligibleVoters.length} voted —{' '}
                  {tallySession.encryptedBallots.length} ballots
                </div>
              </div>

              {!tallySession.isClosed && (
                <button
                  type="button"
                  className="sui-sv2__btn sui-sv2__btn--warn"
                  onClick={handleClose}
                  disabled={!walletAddr}
                >
                  Close Voting
                </button>
              )}

              {tallySession.isClosed && !results && (
                <>
                  <div className="sui-sv2__mode-toggle">
                    <label
                      className={`sui-sv2__mode ${tallyMode === 'onchain' ? 'sui-sv2__mode--active' : ''}`}
                    >
                      <input
                        type="radio"
                        name="tmode"
                        checked={tallyMode === 'onchain'}
                        onChange={() => setTallyMode('onchain')}
                      />
                      <span>On-chain (verifiable)</span>
                    </label>
                    <label
                      className={`sui-sv2__mode ${tallyMode === 'client' ? 'sui-sv2__mode--active' : ''}`}
                    >
                      <input
                        type="radio"
                        name="tmode"
                        checked={tallyMode === 'client'}
                        onChange={() => setTallyMode('client')}
                      />
                      <span>Client-side (faster)</span>
                    </label>
                  </div>
                  <button
                    type="button"
                    className="sui-sv2__btn"
                    onClick={handleTally}
                    disabled={tallying || !walletAddr}
                  >
                    {tallying
                      ? 'Tallying…'
                      : tallyMode === 'onchain'
                        ? 'On-chain Decrypt & Tally'
                        : 'Decrypt & Tally'}
                  </button>
                </>
              )}

              {tallyStatus && <div className="sui-sv2__status">{tallyStatus}</div>}
              {tallyProgress && <div className="sui-sv2__progress">{tallyProgress}</div>}

              {/* Results */}
              {results && tallySession && (
                <div className="sui-sv2__results">
                  <div className="sui-sv2__results-title">Results</div>
                  {tallySession.options.map((opt, i) => {
                    const total = results.reduce((a, b) => a + b, 0)
                    const pct = total > 0 ? Math.round((results[i] / total) * 100) : 0
                    return (
                      <div key={i} className="sui-sv2__result-row">
                        <div className="sui-sv2__result-label">
                          <span>{opt}</span>
                          <span>
                            {results[i]} ({pct}%)
                          </span>
                        </div>
                        <div className="sui-sv2__bar">
                          <div className="sui-sv2__bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                  <div className="sui-sv2__result-total">
                    Total: {results.reduce((a, b) => a + b, 0)} votes
                    {onChainVerified && (
                      <span className="sui-sv2__verified"> — Verified on-chain</span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {error && <div className="sui-sv2__error">{error}</div>}

      <div className="sui-sv2__footer">
        <span className="sui-sv2__net">{network}</span>
        <span className="sui-sv2__pkg">voting_seal</span>
      </div>
    </div>
  )
}

const SuiSealVotingPlugin: Plugin = {
  name: 'SuiSealVoting',
  version: '1.0.0',
  styleUrls: ['/plugins/sui-seal-voting/style.css'],
  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('SuiSealVoting', SealVotingContent)
    host.log('SuiSealVoting initialized')
  },
  mount() {
    console.log('[SuiSealVoting] mounted')
  },
  unmount() {
    sharedHost = null
    console.log('[SuiSealVoting] unmounted')
  },
}

export default SuiSealVotingPlugin
