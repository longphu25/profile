# BTC Chart Plugin - User Guide

## Getting Started

Open `btc-chart.html` in the browser (via `bun run dev`). The chart loads BTC/USDT 1H data from Binance Futures by default, then connects a WebSocket for real-time updates.

## Interface Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Header: Symbol | Intervals | Price | OHLCV | Live status    │
├─────────────────────────────────────────────────────────────┤
│ Toolbar: Indicator toggles | Sound | Notif | Export         │
├────────────────────────────────────────────┬────────────────┤
│                                            │                │
│        Main Chart                          │   Sidebar      │
│        (Candlestick + overlays)            │   - Signal     │
│                                            │   - Trade Setup│
│                                            │   - Config     │
│                                            │   - Scalping   │
├────────────────────────────────────────────│   - Reversal   │
│ Oscillator Pane (RSI/ADX/Stoch/OBV)       │   - Positions  │
│                                            │   - Market data│
├────────────────────────────────────────────┴────────────────┤
│ Status: WS status | Update time | OF/Box counts            │
└─────────────────────────────────────────────────────────────┘
```

## Changing Symbol

- Use the dropdown to select from preset symbols (BTC, ETH, SOL, etc.)
- Type a custom symbol in the input field (validates against Binance)
- Supports Binance, Bybit, MEXC, OKX pairs

## Indicator Toggles

Click toolbar buttons to show/hide:

| Button | Overlay |
|--------|---------|
| MH Band | Midnight Hunter envelope (upper/mid/lower) |
| MA50 | Simple Moving Average 50 |
| MA200 | Simple Moving Average 200 |
| DBB | Double Bollinger Bands (Kathy Lien) |
| SMC | Smart Money Concepts (structure + OB + FVG) |
| Box Flip | Range breakout signals |
| Order Flow | Buy/sell pressure pills |
| VWAP | Volume-Weighted Average Price + bands |
| RSI Div | RSI divergence arrows |
| Vol Profile | Volume histogram overlay |
| Volume | Volume bars |
| Vol Spike | Highlight abnormal volume |

## Signal System

The ML Signal panel shows a 0-100% gauge:

- **STRONG BUY/SELL**: Multiple indicators in strong agreement
- **BUY/SELL**: Moderate agreement
- **NEUTRAL**: Mixed signals

### Configuring Signals

Click "Signal Config" to expand the configuration panel:

1. **Quick presets**: Click a preset button to switch indicator sets
2. **Individual toggles**: Check/uncheck specific features
3. Changes take effect immediately

## Trade Setup

Automatically computes Entry, SL, TP when 2+ signals agree:

- Shows direction (LONG/SHORT) with confidence %
- Groups contributing signals by source (Indicators, Boucher, Lien)
- Entry at current price, SL at swing low/high, TP at 2x/3x risk

## Boucher M1 Scalping

Collapsible panel for Jean-Francois Boucher's box scalping method:

- **ON/OFF**: Toggle button enables/disables the system
- **Collapsed**: Shows speed + signal + win rate
- **Expanded**: Full metrics, box boundaries, entry signal, ladder levels
- Best used on M1 timeframe

## Kathy Lien Reversal

Collapsible panel for Double Bollinger Band reversal detection:

- **ON/OFF**: Toggle button enables/disables the system
- **Collapsed**: Shows zone + latest reversal + squeeze state
- **Expanded**: All DBB levels, squeeze, exhaustion, signal details

## Alerts

Set price or RSI alerts in the Alerts panel:

- Triggers sound + browser notification
- Auto-resets after firing
- Can be enabled/disabled individually

## Positions

Track manual positions with Entry/SL/TP:

- Shows unrealized PnL
- Suggests SL/TP based on ATR + NWE bands
- Draws price lines on the chart

## Keyboard / Touch

- **Desktop**: Mouse wheel zoom, drag to pan, crosshair on hover
- **Mobile**: Pinch zoom, touch drag, tap for crosshair
- **Oscillator pane**: Drag resize handle to adjust height

## Export / Import

- **Snapshot**: Download chart as PNG
- **Export Config**: Save all settings as JSON
- **Import Config**: Load settings from JSON file

## Mobile

The interface is fully responsive:

- **768px+**: Side-by-side layout
- **< 768px**: Stacked (chart top, sidebar bottom with scroll)
- **< 480px**: Compact mode, horizontal-scroll toolbar
