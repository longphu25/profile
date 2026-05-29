# Mint BTC Position — DeepBook Predict Testnet

## Quick Reference

### Current Active Oracles (query live)

```bash
curl -s "https://predict-server.testnet.mystenlabs.com/predicts/0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a/oracles" | python3 -c "
import json, sys, time
data = json.load(sys.stdin)
now = int(time.time() * 1000)
active = [o for o in data if o['status'] == 'active' and o['expiry'] > now]
print(f'Now: {now}')
print(f'Active oracles: {len(active)}')
for o in sorted(active, key=lambda x: x['expiry']):
    mins_left = (o['expiry'] - now) / 60000
    print(f\"  BTC expiry={o['expiry']} ({mins_left:.0f}m left) oracle={o['oracle_id']}\")
"
```

### Oracle Detail

```bash
curl -s "https://predict-server.testnet.mystenlabs.com/oracles/<ORACLE_ID>/state" | python3 -m json.tool
```

## Scaling Rules

| Param | Scale | Example |
|-------|-------|---------|
| Strike | × 1e9 | $73,745 → `73_745_000_000_000` |
| Quantity/DUSDC | × 1e6 | $100 → `100_000_000` |
| Expiry | milliseconds | `1780041600000` |
| Spot/Forward | × 1e9 | $73,745.03 → `73745030000000` |

## Strike Validation

```
strike >= min_strike (= $50,000 = 50_000_000_000_000)
(strike - min_strike) % tick_size == 0
tick_size = 1_000_000_000 (= $1)
```

Any integer USD value ≥ $50,000 is valid.

## Full Mint Flow (TypeScript)

### Constants

```typescript
const PREDICT_PACKAGE = '0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138'
const PREDICT_ID = '0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a'
const DUSDC_TYPE = '0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC'
```

### Step 1: Create PredictManager (one-time)

```typescript
const tx = new Transaction()
tx.moveCall({ target: `${PREDICT_PACKAGE}::predict::create_manager` })
// Execute → wait 2-3s → query /managers to get manager_id
```

### Step 2+3: Deposit + Mint (single PTB)

```typescript
const tx = new Transaction()
tx.setSender(walletAddress)

// 1. Merge + split DUSDC
const [depositCoin] = tx.splitCoins(tx.object(primaryDUSDC), [tx.pure.u64(100_000_000n)])

// 2. Deposit into manager
tx.moveCall({
  target: `${PREDICT_PACKAGE}::predict_manager::deposit`,
  typeArguments: [DUSDC_TYPE],
  arguments: [tx.object(managerId), depositCoin],
})

// 3. Create market key — use ::up or ::down (NOT ::new)
const [marketKey] = tx.moveCall({
  target: `${PREDICT_PACKAGE}::market_key::up`, // or ::down
  arguments: [
    tx.pure.id(oracleId),
    tx.pure.u64(expiry),        // ms
    tx.pure.u64(strike * 1e9),  // strike in 1e9 scale
  ],
})

// 4. Mint
tx.moveCall({
  target: `${PREDICT_PACKAGE}::predict::mint`,
  typeArguments: [DUSDC_TYPE],
  arguments: [
    tx.object(PREDICT_ID),
    tx.object(managerId),
    tx.object(oracleId),
    marketKey,
    tx.pure.u64(quantity * 1e6), // DUSDC scale
    tx.object.clock(),
  ],
})
```

## Pricing

```
cost = fair_value + protocol_spread + utilization_adjustment
```

### Fair Value (from SVI):
```
k = ln(K / F)
w(k) = a + b · (ρ·(k − m) + √((k − m)² + σ²))
d₂ = −k / √w − √w / 2
P(UP) = N(d₂)
P(DOWN) = 1 − N(d₂)
```

- Strike ≈ Spot → ~50% probability → costs ~$50 per $100 face
- OTM strike → cheaper but lower win probability

## Settlement Rules

- **UP wins** if `settlement_price > strike` (strict >)
- **DOWN wins** if `settlement_price < strike` (strict <)
- **settlement = strike** → DOWN wins (UP loses)

## After Settlement

```typescript
// Anyone can call redeem_permissionless after oracle settles
const [marketKey] = tx.moveCall({
  target: `${PREDICT_PACKAGE}::market_key::up`,
  arguments: [tx.pure.id(oracleId), tx.pure.u64(expiry), tx.pure.u64(strike)],
})
tx.moveCall({
  target: `${PREDICT_PACKAGE}::predict::redeem_permissionless`,
  typeArguments: [DUSDC_TYPE],
  arguments: [tx.object(PREDICT_ID), tx.object(managerId), tx.object(oracleId), marketKey, tx.pure.u64(quantity), tx.object.clock()],
})
```

## Get DUSDC

Request testnet DUSDC: https://tally.so/r/Xx102L
