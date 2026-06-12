# Oracle & Keeper Guide — DeepBook Predict

Comprehensive reference on oracle lifecycle, settlement mechanics, keeper types,
and operational patterns for DeepBook Predict on Sui testnet.

---

## Oracle Lifecycle

```
                    ┌─────────────────────────────────────────────────┐
                    │                                                   │
  create_oracle     │   update_prices (authorized keeper)               │
       │            │       │                                          │
       ▼            │       ▼                                          │
  ┌──────────┐      │  ┌──────────┐    expiry reached    ┌───────────────┐
  │ Inactive │──────┼─▶│  Active  │──────────────────────▶│   Pending     │
  └──────────┘      │  └──────────┘                       │  Settlement   │
                    │       │                              └───────┬───────┘
                    │       │ mints/redeems allowed                │
                    │       │ price updates flowing                │
                    │                                              │
                    │              first post-expiry               │
                    │              update_prices call               │
                    │                      │                       │
                    │                      ▼                       │
                    │              ┌──────────────┐                │
                    │              │   Settled    │◀───────────────┘
                    │              └──────────────┘
                    │                      │
                    │                      │ settlement_price frozen
                    │                      │ redeem/redeem_permissionless allowed
                    └──────────────────────┘
```

| State | Mints | Redeems | Price Updates | Settlement Price |
|-------|-------|---------|---------------|-----------------|
| Inactive | ❌ | ❌ | ❌ | null |
| Active | ✅ | ✅ (live price) | ✅ (continuous) | null |
| Pending Settlement | ❌ | ✅ (live price) | First post-expiry update freezes | null → set on first update |
| Settled | ❌ | ✅ (settlement price) | ❌ | frozen value |

---

## Two Types of Keepers

### Type 1: Oracle Price Keeper (AUTHORIZED — Mysten only)

| Aspect | Detail |
|--------|--------|
| What | Push price updates to OracleSVI, trigger settlement |
| Who | Mysten Labs infrastructure |
| Permission | Requires `OracleSVICap` (non-transferable capability) |
| Function | `oracle::update_prices(oracle, cap, spot, forward, svi_params...)` |
| If dies | Oracle stops updating, settlement_price remains null |
| You can do | NOTHING (report to team via Discord) |

```move
// Only authorized keeper can do this:
public fun update_prices(
    oracle: &mut OracleSVI,
    cap: &OracleSVICap,     // ← AUTHORIZED CAP REQUIRED
    spot: u64,
    forward: u64,
    a: u64,
    b: u64,
    rho: u64,
    rho_negative: bool,
    m: u64,
    sigma: u64,
    clock: &Clock,
)
```

**How settlement works:**
1. Oracle reaches expiry timestamp
2. Status transitions to "pending_settlement"
3. Next `update_prices` call (post-expiry) freezes `settlement_price` = current spot
4. Status transitions to "settled"
5. No more updates accepted

**If keeper dies before step 3 → oracle stuck forever with settlement_price = null.**

### Type 2: Position Redeem Keeper (PERMISSIONLESS — anyone)

| Aspect | Detail |
|--------|--------|
| What | Call `redeem_permissionless` for settled positions |
| Who | Anyone with SUI for gas |
| Permission | NONE — fully permissionless |
| Function | `predict::redeem_permissionless(predict, manager, oracle, key, qty, clock)` |
| Prerequisite | Oracle MUST be settled (settlement_price != null) |
| Incentive | Currently none (you pay gas, payout goes to position owner) |
| You can do | Build and run this yourself ✅ |

```move
public fun redeem_permissionless<T>(
    predict: &mut Predict,
    manager: &mut PredictManager,   // any manager, not just yours
    oracle: &OracleSVI,             // must be settled
    market_key: MarketKey,
    quantity: u64,
    clock: &Clock,
    ctx: &mut TxContext,
)
```

**TYPE 2 cannot function without TYPE 1 completing first.**

---

## Keeper Architecture (Mysten Infrastructure)

```
Mysten Keeper Cluster:
├── Instance A → owns caps for oracles [0x1958..., 0xab12..., 0xcd34...]
├── Instance B → owns caps for oracles [0xef56..., 0x7890..., 0xaabb...]
├── Instance C → owns caps for oracles [0xccdd..., 0xeeff..., 0x1122...]
└── ...

Each instance:
  - Subscribes to external price feed (e.g. Pyth BTC/USD)
  - Pushes update_prices every ~10-30 seconds
  - On expiry: pushes final price → triggers settlement
```

**Failure mode:**
- Single instance crash → all its oracles stop updating simultaneously
- Other instances unaffected → their oracles continue normally
- Observation: multiple oracles dying at same second = single instance crash

---

## Running a Position Redeem Keeper

### Minimal implementation

```typescript
import { Transaction } from '@mysten/sui/transactions'
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'

const PREDICT_PACKAGE = '0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138'
const PREDICT_ID = '0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a'
const DUSDC_TYPE = '0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC'
const PREDICT_SERVER = 'https://predict-server.testnet.mystenlabs.com'

const client = new SuiClient({ url: getFullnodeUrl('testnet') })
const keypair = Ed25519Keypair.fromSecretKey(/* keeper wallet secret */)

async function getSettledOracles(): Promise<any[]> {
  const res = await fetch(`${PREDICT_SERVER}/predicts/${PREDICT_ID}/oracles`)
  const oracles = await res.json()
  return oracles.filter((o: any) => o.status === 'settled')
}

async function getRedeemablePositions(settledOracleIds: string[]): Promise<any[]> {
  const managersRes = await fetch(`${PREDICT_SERVER}/managers`)
  const managers = await managersRes.json()
  
  const redeemable: any[] = []
  for (const mgr of managers) {
    const posRes = await fetch(`${PREDICT_SERVER}/managers/${mgr.manager_id}/positions/summary`)
    const positions = await posRes.json()
    
    for (const pos of positions) {
      if (Number(pos.open_quantity) > 0 && settledOracleIds.includes(pos.oracle_id)) {
        redeemable.push({ ...pos, manager_id: mgr.manager_id })
      }
    }
  }
  return redeemable
}

async function batchRedeem(positions: any[]) {
  if (positions.length === 0) return
  
  const tx = new Transaction()
  tx.setSender(keypair.toSuiAddress())

  for (const pos of positions) {
    const keyFn = pos.is_up ? 'up' : 'down'
    const [marketKey] = tx.moveCall({
      target: `${PREDICT_PACKAGE}::market_key::${keyFn}`,
      arguments: [
        tx.pure.id(pos.oracle_id),
        tx.pure.u64(pos.expiry),
        tx.pure.u64(pos.strike),
      ],
    })

    tx.moveCall({
      target: `${PREDICT_PACKAGE}::predict::redeem_permissionless`,
      typeArguments: [DUSDC_TYPE],
      arguments: [
        tx.object(PREDICT_ID),
        tx.object(pos.manager_id),
        tx.object(pos.oracle_id),
        marketKey,
        tx.pure.u64(pos.open_quantity),
        tx.object.clock(),
      ],
    })
  }

  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
  })
  console.log(`Keeper TX: ${result.digest} — redeemed ${positions.length} positions`)
}

// Main loop
async function keeperLoop() {
  console.log('Keeper started — scanning every 60s')
  
  setInterval(async () => {
    try {
      const settled = await getSettledOracles()
      if (settled.length === 0) return
      
      const oracleIds = settled.map((o: any) => o.oracle_id)
      const redeemable = await getRedeemablePositions(oracleIds)
      
      if (redeemable.length > 0) {
        console.log(`Found ${redeemable.length} redeemable positions`)
        await batchRedeem(redeemable)
      }
    } catch (err) {
      console.error('Keeper error:', err)
    }
  }, 60_000)
}

keeperLoop()
```

### Production considerations

| Concern | Solution |
|---------|----------|
| Rate limiting API calls | Cache manager list, only re-fetch every 5 min |
| Gas cost | Batch up to ~20 redeems per PTB (gas limit) |
| Already-claimed positions | Wrap in try/catch, log failures, skip next scan |
| Multiple keepers running | Safe — worst case = duplicate tx (one fails, one succeeds) |
| Large number of managers | Paginate, scan in batches of 20 |
| Event-driven (faster) | Subscribe to `OracleSettled` event instead of polling |

### Event-driven variant (faster)

```typescript
// Subscribe to settlement events instead of polling
import { SuiClient } from '@mysten/sui/client'

const unsubscribe = await client.subscribeEvent({
  filter: {
    MoveEventType: `${PREDICT_PACKAGE}::oracle::OracleSettled`,
  },
  onMessage: async (event) => {
    const oracleId = event.parsedJson?.oracle_id
    console.log(`Oracle settled: ${oracleId}`)
    
    // Immediately scan for positions on this oracle
    const redeemable = await getRedeemablePositions([oracleId])
    if (redeemable.length > 0) {
      await batchRedeem(redeemable)
    }
  },
})
```

---

## Oracle Health Monitoring

### Classification

```typescript
type OracleHealth = 'healthy' | 'stale' | 'orphaned'

function classifyOracleHealth(oracle: {
  status: string
  expiry: number
  settlement_price: number | null
  last_update_timestamp?: number
}): OracleHealth {
  const now = Date.now()
  
  // Already settled = healthy
  if (oracle.status === 'settled' && oracle.settlement_price != null) {
    return 'healthy'
  }
  
  // Active but not updating = stale
  if (oracle.status === 'active' && oracle.last_update_timestamp) {
    const staleness = now - oracle.last_update_timestamp
    if (staleness > 5 * 60 * 1000) return 'stale' // > 5 min without update
  }
  
  // Expired but not settled = orphaned
  if (oracle.expiry < now) {
    const timeSinceExpiry = now - oracle.expiry
    if (timeSinceExpiry > 30 * 60 * 1000) return 'orphaned' // > 30 min past expiry
    return 'stale' // < 30 min — might still settle
  }
  
  return 'healthy'
}
```

### What each state means

| Health | Meaning | Action |
|--------|---------|--------|
| `healthy` | Oracle operating normally or already settled | Safe to use |
| `stale` | Price updates stopped or expiry just passed | Monitor closely, prepare fallback |
| `orphaned` | Expired >30 min without settlement | **Do not use.** Migrate to fresh oracle |

### Orphaned oracle detection heuristics

- Normal settlement happens within **seconds** of expiry
- If > 5 minutes post-expiry without settlement → suspicious
- If > 30 minutes post-expiry → almost certainly orphaned
- If multiple oracles went stale at the exact same timestamp → keeper instance crash

---

## Incident Playbook

### "Oracle stopped updating" (pre-expiry)

1. Check `last_update_timestamp` — how stale?
2. If < 5 min → might be transient, monitor
3. If > 5 min → **flag as stale**, warn users
4. DO NOT open new positions on stale oracles
5. Existing positions: can still redeem at live (stale) price via `predict::redeem`
6. Report to team via Discord if critical

### "Oracle expired but settlement_price = null"

1. Confirm: `oracle.status` = pending_settlement AND `settlement_price` = null
2. Check: is another oracle with same expiry settled? → yes = orphaned keeper
3. Wait 30 min maximum
4. If still null after 30 min → **oracle is orphaned**
5. Positions on this oracle are **locked** — cannot redeem
6. **Rebuild on fresh oracle** (don't wait indefinitely)
7. Report to team — they may manually settle with cap

### "Position stuck — cannot redeem"

1. Check oracle status: `GET /oracles/:id/state`
2. If `status = settled` + `settlement_price != null` → call `redeem_permissionless`
3. If `status = pending_settlement` + `settlement_price = null` → oracle orphaned, funds locked
4. If `status = active` → oracle hasn't expired yet, use normal `predict::redeem`

---

## Design Patterns for Resilience

### Don't all-in on one oracle

```typescript
// BAD: All capital on one oracle
await mintRange(oracle_A, allCapital)

// GOOD: Spread across multiple oracles/expiries
await mintRange(oracle_A, capital * 0.3)  // expiry 08:00
await mintRange(oracle_B, capital * 0.3)  // expiry 08:30
await mintRange(oracle_C, capital * 0.4)  // expiry 09:00
```

If one keeper dies, only partial capital is at risk.

### Validate before committing

```typescript
async function validateOracleForTrading(oracleId: string): Promise<{
  valid: boolean
  reason?: string
  health: OracleHealth
}> {
  const state = await fetch(`${PREDICT_SERVER}/oracles/${oracleId}/state`).then(r => r.json())
  const health = classifyOracleHealth(state)
  
  if (state.status !== 'active') {
    return { valid: false, reason: `Oracle is ${state.status}`, health }
  }
  
  if (health === 'stale') {
    return { valid: false, reason: `Price stale (last update ${staleness(state)}m ago)`, health }
  }
  
  const timeToExpiry = state.expiry - Date.now()
  if (timeToExpiry < 5 * 60 * 1000) {
    return { valid: false, reason: `Expires in ${Math.round(timeToExpiry/60000)}m`, health }
  }
  
  return { valid: true, health }
}
```

### Recovery-first test design

When building vault simulations:
1. **Snapshot state** before deploying capital (manager balances, positions)
2. **Use multiple oracles** with different expiries
3. **Set a "max stuck" threshold** — if oracle not settling in 30 min, auto-migrate
4. **Keep some capital undeployed** as buffer for rebuild scenarios

---

## Useful Endpoints

| Endpoint | What |
|----------|------|
| `GET /predicts/:id/oracles` | All oracles (filter by status) |
| `GET /oracles/:id/state` | Full oracle detail (spot, forward, SVI, status, settlement_price) |
| `GET /oracles/:id/ask-bounds` | Ask bounds (null = no limit, normal) |
| `GET /managers` | All PredictManagers |
| `GET /managers/:id/positions/summary` | Open positions for a manager |
| `GET /oracles/:id/prices` | Historical price updates (check last_update) |

Base URL: `https://predict-server.testnet.mystenlabs.com`

---

## Events for Monitoring

Subscribe via Sui WebSocket for real-time alerts:

```typescript
// Oracle settled — trigger position redeem keeper
filter: { MoveEventType: `${PREDICT_PKG}::oracle::OracleSettled` }

// Oracle price updated — track freshness
filter: { MoveEventType: `${PREDICT_PKG}::oracle::OraclePricesUpdated` }

// Oracle activated — new oracle available
filter: { MoveEventType: `${PREDICT_PKG}::oracle::OracleActivated` }

// Oracle SVI updated — vol surface changed
filter: { MoveEventType: `${PREDICT_PKG}::oracle::OracleSVIUpdated` }
```

---

## Contract IDs (Testnet)

```
PREDICT_PACKAGE:  0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138
PREDICT_OBJECT:   0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a
PREDICT_REGISTRY: 0x43af14fed5480c20ff77e2263d5f794c35b9fab7e2212903127062f4fe2a6e64
DUSDC:            0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC
CLOCK:            0x6
```
