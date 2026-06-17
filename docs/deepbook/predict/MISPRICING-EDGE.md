# Mispricing Edge: "which side is mispriced"

What the Surface Studio means when it flags a side as carrying value, stated
precisely so the UI never oversells it. This is the one honest edge signal in the
product: it does NOT predict whether BTC goes up or down (that price is exogenous
and unknowable), it only says whether the contract is charging more or less than a
volatility model thinks the outcome is worth, right now.

## The idea in one line

Edge = (what the contract charges) minus (what the model says it is worth).
Two independent estimates of the same win probability. When they disagree, the gap
is the mispricing, and the cheaper-than-fair side is where the value sits.

## The two probabilities

Both numbers are a win probability for the UP side of one binary strike, in [0, 1].
A binary contract pays 1 DUSDC per contract on a win, so a win probability and a
fair price per contract are the same number.

### 1. Model fair probability (free, local SVI math)

Computed locally from the oracle's SVI volatility surface, no network call. For a
strike K against forward F:

```
k  = ln(K / F)                        log-moneyness
w  = SVI total variance at k          a + b*(rho*(k-m) + sqrt((k-m)^2 + sigma^2))
d2 = -((k + w/2) / sqrt(w))
pUp = N(d2)                           N = standard normal CDF
```

`pUp` is the model's probability that BTC settles above K. DOWN is `1 - pUp`. This
is the same `computeFairValue` the payout preview uses, so the heatmap IV, the
smile, and the edge all read one consistent surface.

Source: `plugins/predict-club/domain/payoutPreview.ts` (`computeFairValue`,
`totalVarianceAtLogMoneyness`).

### 2. Contract-implied probability (one devInspect quote)

The contract is asked, read-only, what it would charge to mint the UP side at that
strike. The mint cost per contract IS the implied win probability (each contract
pays 1 DUSDC on a win, so cost-per-contract sits in [0, 1] too):

```
quote = devInspect predict::get_trade_amounts(oracle, marketKey(K, isUp), 10 contracts)
impliedProbability = mintCostDusdc / 10
```

This is the market's price, baked with the AMM curve and the house edge. It is the
only part of the edge that costs a network round-trip, so it is quoted only for the
ATM band of the selected column, cached by (oracle, strike) for 20s, and bounded to
3 concurrent quotes.

Source: `plugins/predict-club/infrastructure/deepbookPredictPricingService.ts`
(`quoteBinaryStrike`), orchestrated by
`plugins/predict-club/application/mispricing.ts` (`getMispriceCell`).

## Reading the edge

```
edge = contractProbability - fairProbability
```

| edge sign | meaning | where the value is |
|-----------|---------|--------------------|
| `edge > 0` | contract prices UP richer than the model | UP is expensive, value leans DOWN (sell-side edge on UP) |
| `edge < 0` | contract prices UP cheaper than the model | UP is underpriced, value leans UP (buy-side edge on UP) |
| `edge ~ 0` | contract and model agree | no edge, do not act on noise |

Worked example: model says UP is worth 0.45 (45% to settle above K), contract
charges 0.52 per UP contract. `edge = 0.52 - 0.45 = +0.07`. The contract is selling
UP at 52 cents when the model values it at 45, so UP is 7 points expensive, the
relatively cheap side is DOWN.

The Studio surfaces this as a caret toward the value side plus the edge in points,
faint at a weak edge and chip-backed at a strong one, and nothing below a noise
floor. The caret is the primary colorblind-safe signal; the number is the second
encoding.

## What this is NOT (honesty boundary)

- **Not a BTC direction call.** Neither number says BTC will rise. Both are
  probabilities derived from the current vol surface and the current quote. The
  settlement price is set by the market, not by this signal.
- **Not a guaranteed win.** A positive edge means the price looks rich relative to
  one model; the model can be wrong, the surface can be stale, and a single round
  is a coin flip regardless. Edge is an expectation over many trades, not a promise
  on one.
- **Not free of the house edge.** The contract-implied probability already includes
  the AMM/house margin, so a tiny edge that does not clear that margin is not real
  value. Only act when the gap is clearly above the noise floor.
- **Degrades, never fabricates.** If the column has no SVI, the fair side is null
  and no edge is shown. If the devInspect quote fails (strike outside contract
  bounds, oracle stale), the contract side is null and the cell shows the reason,
  not a guessed number. `edge` is null whenever either input is null.

## Where it lives

| Concern | File |
|---------|------|
| Fair probability (SVI) | `plugins/predict-club/domain/payoutPreview.ts` |
| Contract-implied probability | `plugins/predict-club/infrastructure/deepbookPredictPricingService.ts` (`quoteBinaryStrike`) |
| Edge assembly + cache + concurrency | `plugins/predict-club/application/mispricing.ts` |
| Cell shape (`fairProbability`, `contractProbability`, `edge`, `reason`) | `plugins/predict-club/domain/volSurface.ts` (`MispriceCell`) |
| Presentation (caret, edge points, ATM band) | `plugins/predict-club/presentation/studio/` (`VolHeatmap`, `EdgePanel`, `SmileSlice`) |

See also `SURFACE-STUDIO-TRADE.md` (how the edge feeds the trade ticket) and
`COMPETITORS.md` (CRASH by Suize, the same UP/DOWN mechanic this signal applies to).
