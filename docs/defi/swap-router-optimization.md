# Swap Router Optimization — Multi-DEX Aggregation

> Tài liệu kỹ thuật cho việc tích hợp multi-route swap trong plugin `sui-swap`.
> Routes: DeepBook v3 (CLOB) + Cetus (AMM) + Turbos (AMM) + 7k Aggregator + Bluefin.

## 1. Tổng quan kiến trúc

```
User Input (token pair + amount)
       │
       ▼ debounce 300ms
┌──────────────────────────────────┐
│   Route Fetcher (parallel)       │
│                                  │
│  ┌─────────┐ ┌───────┐ ┌──────┐ │
│  │DeepBook │ │ Cetus │ │Turbos│ │
│  │  CLOB   │ │  AMM  │ │ AMM  │ │
│  └────┬────┘ └───┬───┘ └──┬───┘ │
│       │          │        │     │
│       ▼          ▼        ▼     │
│   Promise.allSettled (timeout)   │
└──────────────────┬───────────────┘
                   │
                   ▼
         Sort by best output
                   │
                   ▼
         Render quotes (streaming)
                   │
                   ▼
         User chọn route → Execute TX
```

## 2. Vấn đề hiện tại

Plugin `sui-swap` hiện tại chỉ dùng DeepBook v3:
- Chỉ có 1 source of liquidity
- Một số token pair không có pool trên DeepBook
- Không có so sánh giá để chọn route tốt nhất
- User phải có DEEP token để trả fee

## 3. Giải pháp: Multi-Route Aggregator

### 3.1 Các DEX được hỗ trợ

| DEX | Loại | Phương thức tích hợp | Ưu điểm |
|-----|------|---------------------|----------|
| DeepBook v3 | CLOB | SDK `@mysten/deepbook-v3` | Best price cho large orders, low slippage |
| Cetus | Concentrated AMM | Aggregator API | Liquidity rộng, nhiều token pairs |
| Turbos | Concentrated AMM | API | Fee thấp, nhiều pools |

### 3.2 API Endpoints

```typescript
const ROUTER_ENDPOINTS = {
  // DeepBook — dùng SDK trực tiếp + indexer cho orderbook
  deepbook: {
    indexer: 'https://deepbook-indexer.mainnet.mystenlabs.com',
    // SDK: @mysten/deepbook-v3 (local)
  },
  // Cetus Aggregator
  cetus: {
    quote: 'https://api-sui.cetus.zone/router_v2/find_routes',
    swap: 'https://api-sui.cetus.zone/router_v2/build_transaction',
  },
  // Turbos
  turbos: {
    quote: 'https://api.turbos.finance/route/get-quote',
    swap: 'https://api.turbos.finance/route/get-transaction',
  },
}
```

## 4. Kỹ thuật tối ưu tốc độ

### 4.1 Gọi song song với timeout

```typescript
function withTimeout<T>(promise: Promise<T>, ms = 3000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms),
    ),
  ])
}

async function fetchAllQuotes(params: QuoteParams): Promise<RouteQuote[]> {
  const results = await Promise.allSettled([
    withTimeout(fetchDeepBookQuote(params), 3000),
    withTimeout(fetchCetusQuote(params), 3000),
    withTimeout(fetchTurbosQuote(params), 2500),
  ])
  return results
    .filter((r): r is PromiseFulfilledResult<RouteQuote> => r.status === 'fulfilled')
    .map((r) => r.value)
    .sort((a, b) => b.outputAmount - a.outputAmount)
}
```

### 4.2 Debounce input

```typescript
// Chỉ fetch sau 300ms user ngừng gõ
const debouncedFetch = useMemo(
  () => debounce((amt: number) => fetchAllQuotes({ ...baseParams, amount: amt }), 300),
  [baseParams],
)
```

### 4.3 Cache ngắn hạn (stale-while-revalidate)

```typescript
const QUOTE_CACHE_TTL = 5000 // 5 giây
const quoteCache = new Map<string, { quotes: RouteQuote[]; ts: number }>()

function getCacheKey(params: QuoteParams): string {
  return `${params.fromToken}:${params.toToken}:${params.amount}`
}
```

### 4.4 Streaming render — hiện route nào xong trước

```typescript
function useStreamingQuotes(params: QuoteParams) {
  const [quotes, setQuotes] = useState<RouteQuote[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!params.amount) return
    setLoading(true)
    setQuotes([])

    const fetchers = [
      fetchDeepBookQuote(params),
      fetchCetusQuote(params),
      fetchTurbosQuote(params),
    ]

    fetchers.forEach((fetcher) => {
      withTimeout(fetcher, 3000)
        .then((quote) => {
          setQuotes((prev) =>
            [...prev, quote].sort((a, b) => b.outputAmount - a.outputAmount),
          )
        })
        .catch(() => {}) // skip failed/timeout routes
    })

    // Mark done after all settle
    Promise.allSettled(fetchers).then(() => setLoading(false))
  }, [params.fromToken, params.toToken, params.amount])

  return { quotes, loading }
}
```

### 4.5 Pre-warm connections

```typescript
useEffect(() => {
  // Ping endpoints khi component mount để warm up TCP/TLS
  fetch(ROUTER_ENDPOINTS.cetus.quote, { method: 'HEAD' }).catch(() => {})
  fetch(ROUTER_ENDPOINTS.turbos.quote, { method: 'HEAD' }).catch(() => {})
}, [])
```

## 5. Data flow

```
┌─────────────────────────────────────────────────────┐
│                  QuoteParams                         │
│  fromToken: string (coin type)                      │
│  toToken: string (coin type)                        │
│  amount: bigint (raw units)                         │
│  slippage: number (0.001 = 0.1%)                    │
│  sender: string (wallet address)                    │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│                  RouteQuote                          │
│  dex: 'deepbook' | 'cetus' | 'turbos'              │
│  outputAmount: number (human-readable)              │
│  priceImpact: number (%)                            │
│  fee: { amount: number; token: string }             │
│  route: string[] (hop path)                         │
│  estimatedGas: number                               │
│  txPayload?: Transaction (pre-built for execution)  │
└─────────────────────────────────────────────────────┘
```

## 6. Kế hoạch triển khai

### Phase 1: Multi-quote UI (không thực thi)
- [ ] Thêm route fetchers cho Cetus và Turbos (quote only)
- [ ] UI hiển thị so sánh 3 routes với best price badge
- [ ] Debounce + timeout + streaming render
- [ ] Cache quotes 5s

### Phase 2: Execute qua best route
- [ ] DeepBook: giữ nguyên SDK execution hiện tại
- [ ] Cetus: build TX từ aggregator API response
- [ ] Turbos: build TX từ API response
- [ ] Thêm route confirmation modal

### Phase 3: Mở rộng
- [ ] Thêm Aftermath, 7k aggregator
- [ ] Multi-hop routing (A → B → C)
- [ ] Split routing (chia amount qua nhiều DEX)
- [ ] Price alert khi route tốt hơn X%

## 7. Cấu trúc file

```
plugins/sui-swap/
├── plugin.tsx          # Main plugin entry + SwapContent component
├── style.css           # Styles (thêm route selector)
├── lib/
│   ├── types.ts        # QuoteParams, RouteQuote interfaces
│   ├── deepbook.ts     # DeepBook quote + execute
│   ├── cetus.ts        # Cetus API quote + build TX
│   ├── turbos.ts       # Turbos API quote + build TX
│   ├── router.ts       # Orchestrator: parallel fetch, sort, cache
│   └── utils.ts        # withTimeout, debounce, formatters
└── hooks/
    └── useSwapQuotes.ts # React hook: streaming quotes
```

## 8. Lưu ý kỹ thuật

- DeepBook yêu cầu DEEP token cho fee → hiện warning nếu user không có DEEP
- Cetus/Turbos fee tính trực tiếp từ output → không cần token riêng
- Slippage mặc định: 0.5% (có thể tuỳ chỉnh 0.1% / 0.5% / 1.0%)
- Timeout mặc định: 3s cho mỗi router
- Nếu tất cả routes fail → fallback hiện error + suggest retry

## 9. Bổ sung: 7k Aggregator & Bluefin Swap

### 9.1 7k Aggregator (7k.ag)

7k là DEX aggregator hàng đầu trên Sui, tập hợp liquidity từ nhiều nguồn:
- DeepBook, Cetus, Turbos, Kriya, FlowX, Aftermath, Haedal, ...
- Tự động split route (chia order qua nhiều DEX)
- Multi-hop routing (A → B → C)

**API Endpoints:**
```typescript
const SEVK_ENDPOINTS = {
  // Quote — lấy best route
  quote: 'https://api.7k.ag/v1/swap/quote',
  // Build TX — build transaction để execute
  buildTx: 'https://api.7k.ag/v1/swap/build-tx',
  // Tokens — danh sách tokens supported
  tokens: 'https://api.7k.ag/v1/tokens',
}
```

**Quote Request:**
```typescript
// GET /v1/swap/quote
const params = {
  tokenIn: '0x2::sui::SUI',
  tokenOut: '0xdba34...::usdc::USDC',
  amountIn: '1000000000', // raw units
  slippage: '0.005', // 0.5%
}
```

**Quote Response:**
```typescript
interface SevenKQuote {
  amountOut: string
  amountOutMin: string
  priceImpact: number
  routes: Array<{
    dex: string
    poolId: string
    tokenIn: string
    tokenOut: string
    amountIn: string
    amountOut: string
  }>
  txData?: string // serialized Transaction
}
```

**Ưu điểm 7k:**
- Aggregator: tự động tìm best price qua tất cả DEX
- Split routing: chia 1 order thành nhiều phần qua nhiều DEX
- Đã handle phí DEEP cho DeepBook routes
- Không cần SDK riêng — chỉ REST API

### 9.2 Bluefin Swap (trade.bluefin.io/swap)

Bluefin là nền tảng giao dịch perpetual + spot swap trên Sui:
- Concentrated liquidity AMM (tương tự Cetus)
- Tập trung vào các pairs chính: SUI/USDC, BTC/USDC, ETH/USDC
- Giao diện pro-trader với charts

**API Endpoints:**
```typescript
const BLUEFIN_ENDPOINTS = {
  // Quote
  quote: 'https://swap-api.bluefin.io/api/v1/quote',
  // Build swap TX
  swap: 'https://swap-api.bluefin.io/api/v1/swap',
  // Pool info
  pools: 'https://swap-api.bluefin.io/api/v1/pools',
}
```

**Quote Request:**
```typescript
// POST /api/v1/quote
const body = {
  tokenIn: '0x2::sui::SUI',
  tokenOut: '0xdba34...::usdc::USDC',
  amountIn: '1000000000',
  slippage: 50, // bps (0.5% = 50 bps)
  sender: '0x...',
}
```

**Quote Response:**
```typescript
interface BluefinQuote {
  amountOut: string
  minAmountOut: string
  priceImpact: string
  fee: string
  route: Array<{ pool: string; tokenIn: string; tokenOut: string }>
  txPayload?: string
}
```

**Ưu điểm Bluefin:**
- Deep liquidity cho major pairs (SUI, BTC, ETH)
- Low fee (thấp hơn Cetus cho một số pairs)
- Stable pool support (USDC/USDT)

### 9.3 Updated Router Architecture

```
┌─────────────────────────────────────────────────────────┐
│              SwapRouter (Strategy Pattern)                │
│                                                         │
│  ┌─────────┐ ┌───────┐ ┌──────┐ ┌────┐ ┌───────┐     │
│  │DeepBook │ │ Cetus │ │Turbos│ │ 7k │ │Bluefin│     │
│  │  CLOB   │ │  AMM  │ │ AMM  │ │Aggr│ │  AMM  │     │
│  └─────────┘ └───────┘ └──────┘ └────┘ └───────┘     │
│                                                         │
│  register(new DeepBookAdapter())                        │
│  register(new CetusAdapter())                           │
│  register(new TurbosAdapter())                          │
│  register(new SevenKAdapter())    ← NEW                 │
│  register(new BluefinAdapter())   ← NEW                 │
└─────────────────────────────────────────────────────────┘
```

### 9.4 Lưu ý khi dùng 7k làm meta-aggregator

7k đã aggregates DeepBook + Cetus + Turbos bên trong. Nếu dùng 7k,
có thể có **duplicate quotes** (7k route qua Cetus = Cetus direct).

**Chiến lược:**
- Option A: Dùng 7k thay thế tất cả individual DEX adapters (đơn giản nhất)
- Option B: Dùng 7k song song, deduplicate bằng cách so sánh output (chính xác nhất)
- Option C: Dùng 7k cho multi-hop/split, individual adapters cho single-hop (hybrid)

**Khuyến nghị: Option C** — linh hoạt nhất, user thấy cả direct routes và aggregated routes.
