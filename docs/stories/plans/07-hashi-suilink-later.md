# Hashi + SuiLink Later Plan

## Summary

This is a later-stage plan for adding BTC-on-Sui onboarding and identity readiness to the project by combining:

- Existing `sui-link` plugin for SuiLink soulbound identity discovery.
- Planned `sui-hashi` plugin for Hashi devnet BTC deposit/claim/withdraw guidance.
- Planned `sui-btc-credit-console` module that combines SuiLink identity + hBTC balance + DeepBook/DeFi readiness.

Important network constraint: Hashi is currently available on Sui devnet, while the existing repo `sui-link` plugin is configured for mainnet/testnet package IDs. The first version should support this mismatch explicitly instead of pretending the whole flow is one seamless testnet path.

Sources:

- Hashi Sui page: https://www.sui.io/hashi
- Hashi devnet app: https://devnet.hashi.sui.io/
- Hashi design docs: https://mystenlabs.github.io/hashi/design/index.html
- SuiLink site: https://www.suilink.io/
- Current repo plugin: `plugins/sui-link/plugin.tsx`

## Planned Modules

### 1. `sui-hashi`

Group: `BTC / Credit / DeepBook Advanced`

Purpose: guide user from BTC testnet/devnet setup to hBTC readiness on Sui.

V1 should be a guided runbook + status dashboard, not a direct Hashi protocol client unless stable APIs are confirmed.

Flow:

1. `Prepare Sui Wallet`
   - Connect Sui wallet.
   - Require network: `devnet` for Hashi.
   - Show SUI gas status.
   - Provide faucet link/action if balance is missing.
2. `Prepare BTC Testnet Wallet`
   - User enters BTC testnet address.
   - User records BTC wallet/provider: Unisat, Xverse, Bitcoin Core, or other.
   - Show reminder to use testnet BTC only.
3. `Open Hashi Devnet`
   - Link to `https://devnet.hashi.sui.io/`.
   - Explain expected Hashi action:
     - connect Sui wallet
     - enter Sui address
     - receive Hashi BTC deposit address
     - send tBTC
     - wait for confirmations
     - claim hBTC on Sui
4. `Track Deposit`
   - User can paste BTC txid.
   - V1 status can be manual/user-confirmed:
     - `not-started`
     - `btc-sent`
     - `confirming`
     - `claimable`
     - `claimed`
   - Later version can integrate Hashi status API if public and stable.
5. `Verify hBTC`
   - Query connected Sui wallet balances/coins on devnet.
   - Detect candidate Hashi BTC coin type once type/package is known.
   - Until type is confirmed, provide manual object/coin type input for devnet testing.
6. `Withdraw Path`
   - Explain reverse flow:
     - burn hBTC on Sui
     - release BTC to entered BTC address
   - Keep as guided external flow in v1.

### 2. Extend `sui-link`

Current `sui-link` already queries SuiLink objects on mainnet/testnet. Extend around it instead of replacing it.

Needed improvements:

- Add `Identity Readiness` panel:
  - `No SuiLink found`
  - `Ethereum linked`
  - `Solana linked`
  - `Multiple links found`
- Add user actions:
  - `Open SuiLink`
  - `Refresh Links`
  - `Copy linked address`
- Add shared data output:
  - key: `suilinkProfile`
  - value: linked chains, addresses, object IDs, timestamps
- Add network explanation:
  - SuiLink identity objects are network-specific.
  - Hashi devnet hBTC and SuiLink testnet/mainnet identity may not exist on the same network yet.
  - For v1, identity is used as an off-chain/app-level signal unless a matching network deployment exists.

Do not add devnet SuiLink package IDs unless verified.

### 3. `sui-btc-credit-console`

Purpose: combine Hashi + SuiLink + DeFi readiness into one screen.

It should show:

- Commander/wallet state:
  - Sui address
  - active network
  - gas balance
- SuiLink identity:
  - linked Ethereum/Solana/Sui addresses
  - identity readiness score
- Hashi hBTC state:
  - BTC deposit status
  - hBTC balance
  - last known BTC txid
- Risk/credit readiness:
  - `Not Ready`
  - `Identity Ready`
  - `BTC Deposited`
  - `Collateral Ready`
  - `DeFi Ready`
- Next action:
  - create SuiLink
  - switch to devnet
  - open Hashi
  - paste BTC txid
  - verify hBTC
  - open DeepBook/Scallop/Bluefin when supported

## DeepBook Suite / TaskOS Integration

In `deepbook.html` / DeepBook Suite, add a new navigation group or app card:

- Group: `BTC Credit`
- Apps:
  - `Hashi Onboarding`
  - `SuiLink Identity`
  - `BTC Credit Console`

Mission examples:

- `Link Cross-Chain Identity`
  - connect Sui wallet
  - open SuiLink
  - mint SuiLink
  - refresh identity status
- `Bring BTC to Sui`
  - switch to devnet
  - open Hashi
  - send testnet BTC
  - paste txid
  - claim hBTC
  - verify hBTC balance
- `Prepare BTC Collateral`
  - verify SuiLink
  - verify hBTC
  - show DeFi readiness
  - route to DeepBook/NAVI/Scallop plan when supported

## Public Interfaces / Types

No on-chain contract changes required.

```ts
type HashiStep =
  | 'prepare-sui'
  | 'prepare-btc'
  | 'open-hashi'
  | 'send-btc'
  | 'track-deposit'
  | 'claim-hbtc'
  | 'verify-hbtc'
  | 'withdraw'

type HashiDepositStatus =
  | 'not-started'
  | 'btc-sent'
  | 'confirming'
  | 'claimable'
  | 'claimed'
  | 'failed'
  | 'manual-review'

type SuiLinkReadiness =
  | 'none'
  | 'eth-linked'
  | 'sol-linked'
  | 'multi-linked'
  | 'unknown-network'

type BtcCreditReadiness =
  | 'not-ready'
  | 'identity-ready'
  | 'btc-deposited'
  | 'collateral-ready'
  | 'defi-ready'

type LinkedChain = 'ethereum' | 'solana' | 'sui' | 'unknown'

type SuiLinkProfile = {
  owner: string
  network: string
  links: Array<{
    objectId: string
    chain: LinkedChain
    linkedAddress: string
    objectType: string
    timestampMs?: string
  }>
}

type HashiDepositDraft = {
  suiAddress: string
  suiNetwork: 'devnet' | 'testnet' | 'mainnet'
  btcTestnetAddress?: string
  btcTxid?: string
  status: HashiDepositStatus
  hbtcCoinType?: string
}
```

Shared data keys:

```ts
sharedHost.setSharedData('suilinkProfile', profile)
sharedHost.setSharedData('hashiDepositDraft', draft)
sharedHost.setSharedData('btcCreditReadiness', readiness)
```

## Test Plan

Manual scenarios:

- Wallet disconnected:
  - Hashi/SuiLink cards show connect wallet first.
  - No protocol step appears executable.
- SuiLink plugin on testnet:
  - Existing SuiLink objects display correctly.
  - Empty state points user to `https://www.suilink.io/`.
  - Shared data key `suilinkProfile` is populated after fetch.
- Hashi flow on devnet:
  - User can switch to devnet.
  - App links to Hashi devnet.
  - User can save BTC testnet address and txid locally/session state.
  - Status can move through manual states.
- hBTC verification:
  - If known coin type is configured, app checks balance.
  - If coin type is unknown, app shows manual configuration instead of failing silently.
- Network mismatch:
  - App explains when SuiLink identity is on testnet/mainnet but Hashi hBTC is on devnet.
  - App does not falsely mark DeFi readiness as complete across incompatible networks.
- DeepBook Suite integration:
  - `BTC Credit` group appears.
  - Opening Hashi/SuiLink apps does not break existing DeepBook plugin loading.
- Regression:
  - Existing `sui-link` standalone/shared mode still works.
  - Existing `sui-plugin.html`, `sui-plugin-wasm.html`, `sui-deepbook-predict.html` still work.
  - `bun run build` passes after implementation.

## Assumptions

- Hashi devnet is the initial target.
- Direct Hashi deposit/claim APIs are not assumed until confirmed from official docs or code.
- SuiLink remains the identity layer; Hashi remains the BTC collateral layer.
- The first implementation should prioritize guided onboarding, state tracking, and verification over direct protocol automation.
- SuiLink devnet package IDs are not assumed.
- hBTC coin type/package ID must be configurable until the devnet contract type is confirmed.

