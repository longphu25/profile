# Sơ Đồ Kiến Trúc Predict Club

## Tóm Tắt

Tài liệu này tập hợp các sơ đồ kiến trúc và cấu trúc file dự kiến cho
`predict-club.html`, `plugins/predict-club` và package `contracts/predict-club`
trong tương lai.

Predict Club là một tính năng rủi ro cao vì nó chạm tới ký ví,
authorization, tuyến nạp vốn, escrow exchange, rủi ro vay Scallop, DeepBook
Predict và custody vốn gộp trong tương lai.

## Ngữ Cảnh Hệ Thống

```mermaid
flowchart LR
  Leader[Leader] --> Page[predict-club.html]
  Member[Member] --> Page
  Observer[Observer] --> Page

  Page --> Host[React Page Host]
  Host --> Plugin[Predict Club Plugin]
  Plugin --> Wallet[Sui Wallet / DAppKit HostAPI]
  Plugin --> PredictAPI[DeepBook Predict Server]
  Plugin --> DeepBook[DeepBook V3 SUI_USDC Swap]
  Plugin --> Scallop[Scallop Borrow / Oracle / Liquidation]
  Plugin --> Bridge[Bridge Handoff]
  Plugin --> Store[localStorage V1]

  Wallet --> Sui[Sui Network]
  Sui --> PM[User PredictManager]
  Sui --> Escrow[Club Escrow Market]
  Sui --> FutureVault[Future PredictClubVault]
```

## Runtime Của Trang Và Plugin

```mermaid
sequenceDiagram
  participant Html as predict-club.html
  participant Main as src/predict-club/main.tsx
  participant Page as PredictClubPage
  participant Renderer as PluginRenderer
  participant Loader as Plugin Loader
  participant Plugin as plugins/predict-club/plugin.tsx
  participant Shadow as Shadow DOM
  participant Root as PredictClubRoot

  Html->>Main: load module
  Main->>Page: render React page
  Page->>Renderer: src=/plugins/predict-club/plugin.tsx
  Renderer->>Loader: dynamic import
  Loader->>Plugin: init(hostAPI)
  Plugin->>Renderer: registerComponent("PredictClub")
  Renderer->>Shadow: create shadow root + inject style.css
  Shadow->>Root: render portal
  Renderer->>Plugin: mount()
```

## Boundary Clean Architecture

```mermaid
flowchart TB
  Presentation[Presentation<br/>React components + hooks]
  Application[Application<br/>Use cases / commands]
  Domain[Domain<br/>entities / policies / state machine]
  Ports[Ports<br/>repositories / gateways]
  Data[Data<br/>localStorage + server adapters]
  Infra[Infrastructure<br/>Sui / DeepBook / Scallop / indicators]

  Presentation --> Application
  Application --> Domain
  Application --> Ports
  Data --> Ports
  Infra --> Ports

  Domain -. no React, fetch, Sui SDK .-> Domain
```

Quy tắc:

- Domain phải thuần và không phụ thuộc vào dependency.
- Application phụ thuộc vào interface, không phụ thuộc vào fetch/Sui client cụ thể.
- Presentation không bao giờ chứa quy tắc protocol.
- Infrastructure sở hữu chi tiết về ví, Sui SDK, DeepBook, Scallop và các
  external provider.

## Vòng Đời Round

```mermaid
stateDiagram-v2
  [*] --> draft
  draft --> open: leader publishes
  open --> confirmed: leader confirms
  open --> cancelled: cancel / expired
  confirmed --> funding: members need DUSDC
  funding --> executed: funded + member signs
  confirmed --> executed: already funded + member signs
  funding --> cancelled: funding expired / policy failure
  executed --> settled: oracle settles
  settled --> claimed: payout claimed
  claimed --> [*]
  cancelled --> [*]
```

## Luồng Thành Viên Tự Ký Giao Dịch

```mermaid
sequenceDiagram
  participant Leader
  participant Club as Predict Club Plugin
  participant Member
  participant Wallet
  participant Predict as DeepBook Predict

  Leader->>Club: create proposal
  Club->>Club: snapshot chỉ báo và kiểm tra rủi ro
  Member->>Club: pledge / accept signal
  Club->>Club: chạy checklist sẵn sàng
  Leader->>Club: confirm proposal
  Club->>Member: tạo kế hoạch giao dịch
  Member->>Wallet: review + sign PTB
  Wallet->>Predict: deposit DUSDC / mint / mint_range
  Predict-->>Club: tx digest / indexed position
  Club->>Member: theo dõi quyết toán và nhận kết quả
```

## Funding Router

```mermaid
flowchart LR
  Start[Member wants to join] --> Check{Has DUSDC?}
  Check -->|Yes| Ready[Ready for PredictManager deposit]
  Check -->|No, has USDC| Escrow[USDC to DUSDC escrow]
  Check -->|Only SUI, sell SUI| Swap[DeepBook SUI_USDC swap]
  Check -->|Only SUI, keep SUI| Borrow[Scallop borrow USDC]
  Check -->|External assets| Bridge[Bridge assets to Sui]

  Swap --> USDC[USDC on Sui]
  Borrow --> Risk[Liquidation + oracle checklist]
  Risk --> USDC
  Bridge --> USDC
  USDC --> Escrow
  Escrow --> DUSDC[DUSDC]
  DUSDC --> Ready
  Ready --> Trade[Member tự ký giao dịch Predict]
```

## Escrow Exchange

```mermaid
sequenceDiagram
  participant Maker
  participant Market as ClubEscrowMarket
  participant Filler
  participant UI as Predict Club UI

  Maker->>Market: create_offer(offer_coin, want_amount, expiry)
  Market-->>UI: OfferCreated event
  Filler->>Market: fill_offer(payment_coin)
  Market-->>Filler: transfer offered coin
  Market-->>Maker: transfer wanted coin
  Market-->>UI: OfferFilled event
```

Các use case:

- Leader chào bán DUSDC và muốn nhận USDC.
- Member chào bán USDC và muốn nhận DUSDC.
- Offer giới hạn người nhận để hỗ trợ một thành viên cụ thể.
- Offer gắn với round hỗ trợ việc nạp vốn cho một prediction round đang hoạt động.

## Luồng Rủi Ro Vay Scallop

```mermaid
flowchart TB
  Wallet[Member wallet] --> Obligation{Has Scallop obligation?}
  Obligation -->|No| Create[Create/select obligation]
  Obligation -->|Yes| Collateral[Review SUI collateral]
  Create --> Collateral
  Collateral --> Oracle[Update/check oracle]
  Oracle --> Borrow[Borrow USDC]
  Borrow --> Health[Health / liquidation monitor]
  Health -->|Safe| Escrow[USDC to DUSDC escrow]
  Health -->|Warning| Reduce[Reduce size / add collateral]
  Health -->|Danger| Block[Block new Predict participation]
  Health -->|Liquidatable| Repay[Repay / top up before joining]
```

## Group Vault Tương Lai

```mermaid
flowchart TB
  Members[Members deposit DUSDC] --> Vault[PredictClubVault]
  Vault --> Shares[Member shares / accounting]
  LeaderCap[LeaderCap] --> Policy[Policy Guard]
  Policy -->|Allowed| Execute[Execute bounded Predict round]
  Policy -->|Blocked| Reject[Reject action]

  Execute --> VaultManager[Vault-controlled Predict path]
  VaultManager --> Predict[DeepBook Predict]
  Predict --> Settlement[Settlement payout]
  Settlement --> Vault
  Vault --> Claim[Member claim / withdrawal]
```

Công việc vault ở V2 tách biệt rõ khỏi V1. Nó yêu cầu một story về Move, test
contract và rà soát luồng ví trước khi triển khai.

## Kiến Trúc Module Của Escrow Contract

```mermaid
flowchart TB
  Errors[errors.move]
  Events[events.move]
  Types[types.move]
  Escrow[escrow.move]
  Approvals[approvals.move]
  Receipts[receipts.move]
  Views[views.move]
  ExTypes[exchange_types.move]
  ExMarket[exchange_market.move]
  ExViews[exchange_views.move]
  ExEvents[exchange_events.move]

  Escrow --> Errors
  Escrow --> Events
  Escrow --> Types
  Escrow --> Receipts
  Approvals --> Errors
  Approvals --> Types
  Views --> Types
  ExMarket --> Errors
  ExMarket --> ExTypes
  ExMarket --> ExEvents
  ExViews --> ExTypes
```

Move package nên được tách thành các file nhỏ. Không gộp logic escrow khóa thời
gian và logic trao đổi USDC/DUSDC tổng quát vào một module lớn.

## Cấu Trúc File Dự Kiến

### Page Host

```text
predict-club.html
src/predict-club/
  main.tsx
  PredictClubPage.tsx
  predict-club.css
```

Mục đích:

- `predict-club.html`: entry point độc lập.
- `main.tsx`: bootstrap React root.
- `PredictClubPage.tsx`: page shell, wallet provider và plugin renderer.
- `predict-club.css`: chỉ layout cho host page; UI của plugin vẫn được cô lập
  trong Shadow DOM.
