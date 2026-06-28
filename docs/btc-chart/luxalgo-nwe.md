# LuxAlgo Nadaraya-Watson Envelope

## Overview

The LuxAlgo Nadaraya-Watson Envelope is a kernel regression-based indicator that creates dynamic, adaptive volatility bands around price. Unlike traditional moving averages, it provides a non-linear, adaptive view of price trends, making it ideal for capturing complex market movements.

**License:** CC BY-NC-SA 4.0  
**Original Source:** [TradingView](https://www.tradingview.com/script/Iko0E2kL-Nadaraya-Watson-Envelope-LuxAlgo/)

## Mathematical Foundation

### Nadaraya-Watson Kernel Regression

The Nadaraya-Watson estimator is a non-parametric kernel regression technique:

```
ŷ(x) = Σ K(x - xᵢ/h) · yᵢ / Σ K(x - xᵢ/h)
```

Where:
- `K()` is the kernel function (Gaussian in this case)
- `h` is the bandwidth parameter (controls smoothness)
- `xᵢ` are the input data points
- `yᵢ` are the corresponding values

### Gaussian Kernel Function

```
gauss(x, h) = exp(-(x² / (h² × 2)))
```

The Gaussian kernel gives more weight to nearby points and less weight to distant points, creating a smooth, continuous curve.

## Two Operating Modes

### 1. Repainting Mode (Default)

**How it works:**
- Recomputes all historical points on each new bar
- Uses full Nadaraya-Watson estimator over a sliding window (default 500 bars)
- Historical values change as new data arrives

**Characteristics:**
- More accurate smoothing
- Historical signals may appear/disappear retroactively
- Better for identifying support/resistance zones
- **Not suitable for backtesting**

**Use cases:**
- Identifying potential reversal zones
- Setting take-profit/stop-loss levels
- Trend bias determination

### 2. Non-Repainting Mode

**How it works:**
- Uses endpoint Nadaraya-Watson estimator
- Only computes the current bar's value
- Historical values remain fixed

**Characteristics:**
- Similar to classical band indicators
- Signals remain fixed once confirmed
- **Suitable for backtesting and live trading**
- Slightly more lag than repainting mode

**Use cases:**
- Live trading signals
- Automated strategies
- Backtesting

## Band Construction

The envelope bands are constructed as:

```
upper = NWE + (MAE × multiplier)
lower = NWE - (MAE × multiplier)
```

Where:
- `NWE` = Nadaraya-Watson estimated value
- `MAE` = Mean Absolute Error (robust to outliers)
- `multiplier` = User-defined width factor (default: 3.0)

**Why MAE instead of Standard Deviation?**
- MAE doesn't square errors, so outliers don't disproportionately affect the bands
- More robust to price spikes and wicks
- Better represents typical deviation from the trend

## Default Parameters

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| Bandwidth (h) | 8.0 | 0.1 - 50 | Controls smoothness. Higher = smoother |
| Multiplier | 3.0 | 0.1 - 10 | Band width as MAE multiple |
| Window Size | 500 | 100 - 1000 | Lookback period for calculation |
| Source | Close | OHLC | Price source for calculation |
| Repainting | true | true/false | Use repainting mode |

## Signal Logic

### Buy Signal (Green Triangle ▼)
- Price crosses **above** the lower band
- Indicates potential oversold condition
- Suggests mean reversion upward

### Sell Signal (Red Triangle ▲)
- Price crosses **below** the upper band
- Indicates potential overbought condition
- Suggests mean reversion downward

## Combining with Other Indicators

### 1. RSI (Relative Strength Index)

**Strategy: Mean Reversion with Momentum Confirmation**

```
Buy Setup:
- Price touches/crosses below lower band
- RSI(14) < 30 (oversold)
- Wait for candle to close back above lower band
- Stop loss: below recent swing low
- Take profit: mid band or upper band

Sell Setup:
- Price touches/crosses above upper band
- RSI(14) > 70 (overbought)
- Wait for candle to close back below upper band
- Stop loss: above recent swing high
- Take profit: mid band or lower band
```

**Why it works:**
- RSI confirms momentum exhaustion
- Reduces false signals from envelope touches
- Higher win rate in ranging markets

### 2. MACD (Moving Average Convergence Divergence)

**Strategy: Trend Reversal Confirmation**

```
Buy Signal:
- Price bounces from lower band
- MACD histogram turns positive
- MACD line crosses above signal line
- Confirms bullish momentum shift

Sell Signal:
- Price rejects from upper band
- MACD histogram turns negative
- MACD line crosses below signal line
- Confirms bearish momentum shift
```

**Best timeframes:** Daily charts and above

### 3. ROC (Rate of Change)

**Strategy: Dual Envelope Trend Following**

```
Long Entry:
- Price breaks above upper band
- ROC(9) > 0 (positive momentum)
- Current close > previous close
- Indicates strong uptrend

Short Entry:
- Price breaks below lower band
- ROC(9) < 0 (negative momentum)
- Current close < previous close
- Indicates strong downtrend

Exit:
- Long: when ROC turns negative or price touches lower band
- Short: when ROC turns positive or price touches upper band
```

**Parameters:**
- ROC length: 9
- NW bandwidth: 8
- NW multiplier: 3

### 4. Volume Confirmation

**Strategy: Volume-Weighted Signals**

```
Strong Buy:
- Price crosses above lower band
- Volume > 1.5× average volume (20-period)
- Confirms buying pressure

Strong Sell:
- Price crosses below upper band
- Volume > 1.5× average volume (20-period)
- Confirms selling pressure

Weak Signal:
- Price touches band
- Volume < average
- Likely false signal, avoid trading
```

### 5. Trend Filters (EMA 50/100/200)

**Strategy: Trade with the Trend**

```
Bullish Bias (Price > EMA 200):
- Only take buy signals from lower band
- Ignore sell signals from upper band
- Higher probability trades

Bearish Bias (Price < EMA 200):
- Only take sell signals from upper band
- Ignore buy signals from lower band
- Avoid counter-trend trades
```

## Adaptive Bandwidth Optimization

### Problem with Fixed Bandwidth

Fixed bandwidth doesn't adapt to changing market volatility:
- Too small → noisy, many false signals
- Too large → laggy, misses opportunities

### Solution: ATR-Adaptive Bandwidth

```
h_eff = h × max(0.5, min(ATR(20) / ATR(100), 2.0))
```

**How it works:**
- When current ATR(20) is 2× the long-term ATR(100) → bandwidth doubles
- Forces estimator to "zoom out" during high volatility
- Ignores noise that would otherwise trigger false signals
- During calm periods → bandwidth shrinks, captures micro-trends

**Implementation:**
```python
vol_ratio = ATR(20) / ATR(100)
vol_mod = max(0.5, min(vol_ratio, 2.0))
h_effective = h_base × vol_mod
```

**Benefits:**
- Automatically adjusts to market conditions
- Reduces false signals during news events
- Better performance across different market regimes

## Optimal Parameters by Market Condition

### Cryptocurrency (High Volatility)
- **Bandwidth:** 8-10
- **Multiplier:** 3.0-3.5
- **RSI Period:** 14
- **Timeframe:** 1h, 4h, 1d

### Forex (Lower Volatility)
- **Bandwidth:** 6-8
- **Multiplier:** 2.5-3.0
- **RSI Period:** 14
- **Timeframe:** 15m, 1h, 4h

### Stocks (Medium Volatility)
- **Bandwidth:** 7-9
- **Multiplier:** 3.0
- **RSI Period:** 14
- **Timeframe:** 1h, 4h, 1d

### Scalping (1m-5m)
- **Bandwidth:** 5-7
- **Multiplier:** 2.0-2.5
- **RSI Period:** 7
- **Note:** More noise, requires strict risk management

### Swing Trading (1h-4h)
- **Bandwidth:** 8-10
- **Multiplier:** 3.0-3.5
- **RSI Period:** 14
- **Best for:** Capturing multi-day moves

### Position Trading (Daily+)
- **Bandwidth:** 10-12
- **Multiplier:** 3.5-4.0
- **RSI Period:** 21
- **Best for:** Long-term trend following

## Trading Strategies

### Strategy 1: Mean Reversion (Ranging Markets)

**Setup:**
- LuxAlgo NWE (bandwidth=8, mult=3, non-repainting)
- RSI(14)
- Volume indicator

**Buy Rules:**
1. Price touches/crosses below lower band
2. RSI < 30 (oversold)
3. Volume spike (> 1.5× average)
4. Candle closes back above lower band
5. Enter long on next candle open

**Sell Rules:**
1. Price touches/crosses above upper band
2. RSI > 70 (overbought)
3. Volume spike (> 1.5× average)
4. Candle closes back below upper band
5. Enter short on next candle open

**Risk Management:**
- Stop loss: 1× ATR beyond recent swing
- Take profit 1: Mid band
- Take profit 2: Opposite band
- Position size: 1-2% of capital per trade

**Best markets:** Sideways/ranging conditions

### Strategy 2: Trend Following (Trending Markets)

**Setup:**
- LuxAlgo NWE (bandwidth=10, mult=3.5, non-repainting)
- ROC(9)
- EMA(200)

**Long Rules:**
1. Price > EMA(200) (uptrend)
2. Price breaks above upper band
3. ROC > 0 (positive momentum)
4. Current close > previous close
5. Enter long on next candle open

**Short Rules:**
1. Price < EMA(200) (downtrend)
2. Price breaks below lower band
3. ROC < 0 (negative momentum)
4. Current close < previous close
5. Enter short on next candle open

**Exit Rules:**
- Long: Exit when ROC < 0 OR price touches lower band
- Short: Exit when ROC > 0 OR price touches upper band

**Risk Management:**
- Stop loss: Opposite band
- Trailing stop: 2× ATR
- Position size: 1-2% of capital per trade

**Best markets:** Strong trending conditions

### Strategy 3: SwiftEdge NW Envelope (Advanced)

**Setup:**
- NWE with ATR-adaptive bandwidth
- RSI(5) - more sensitive
- ATR(14) with multiplier 0.5

**Buy Signal:**
1. Price crosses above lower band
2. RSI < 30 (oversold)
3. Background zone turns green
4. Volume confirms

**Sell Signal:**
1. Price crosses below upper band
2. RSI > 70 (overbought)
3. Background zone turns red
4. Volume confirms

**Advantages:**
- Adaptive bandwidth adjusts to volatility
- More sensitive RSI catches reversals earlier
- Visual background zones for quick identification

## Technical Implementation Notes

### Performance Considerations

**Computational Complexity:**
- Repainting mode: O(n²) per bar (recalculates entire window)
- Non-repainting mode: O(n) per bar (endpoint calculation only)

**Optimization:**
- Use non-repainting mode for live trading
- Limit window size to 500 bars (default)
- Cache Gaussian coefficients in non-repainting mode

### Edge Cases

**Small datasets (< 100 bars):**
- Reduce window size to match available data
- Expect less reliable signals
- Increase bandwidth slightly for smoothing

**Extreme volatility:**
- Increase multiplier to 4.0-5.0
- Use ATR-adaptive bandwidth
- Widen stop losses

**Low liquidity:**
- Increase bandwidth to 10-12
- Use volume filters
- Avoid trading during low-volume periods

## Common Mistakes

### 1. Using Repainting Mode for Backtesting
**Problem:** Results look perfect but are unrealistic  
**Solution:** Always use non-repainting mode for backtesting

### 2. Trading Every Signal
**Problem:** Many false signals in trending markets  
**Solution:** Use trend filters (EMA 200) and only trade with the trend

### 3. Ignoring Volume
**Problem:** Low-volume signals often fail  
**Solution:** Require volume confirmation (> 1.5× average)

### 4. Wrong Bandwidth for Market
**Problem:** Too noisy or too laggy  
**Solution:** Adjust bandwidth based on volatility and timeframe

### 5. No Stop Loss
**Problem:** Large losses when signals fail  
**Solution:** Always use stop loss beyond recent swing or opposite band

## Comparison with Other Indicators

### vs. Bollinger Bands

| Feature | LuxAlgo NWE | Bollinger Bands |
|---------|-------------|-----------------|
| Smoothing | Kernel regression (non-linear) | Simple moving average (linear) |
| Band width | MAE-based (robust) | Standard deviation (sensitive to outliers) |
| Adaptability | High (kernel weights) | Low (equal weights) |
| Lag | Lower (adaptive) | Higher (fixed period) |
| Repainting | Yes (optional) | No |
| Best for | Complex price action | Simple mean reversion |

### vs. Keltner Channels

| Feature | LuxAlgo NWE | Keltner Channels |
|---------|-------------|------------------|
| Center line | Kernel regression | EMA |
| Band calculation | MAE × multiplier | ATR × multiplier |
| Smoothing | Non-linear, adaptive | Linear, fixed |
| Responsiveness | High | Medium |
| Best for | Volatile markets | Trending markets |

## Advanced Techniques

### Multi-Timeframe Analysis

**Setup:**
- Higher timeframe (4h): Determine trend bias
- Lower timeframe (15m): Find entry points

**Example:**
1. 4h chart: Price above upper band → bullish bias
2. 15m chart: Wait for pullback to lower band
3. Enter long when 15m price bounces from lower band
4. Higher probability trade (aligned with 4h trend)

### Divergence Trading

**Setup:**
- Price makes new high/low
- NWE does not confirm
- Signals potential reversal

**Bullish Divergence:**
- Price makes lower low
- NWE makes higher low
- Enter long when price crosses above lower band

**Bearish Divergence:**
- Price makes higher high
- NWE makes lower high
- Enter short when price crosses below upper band

### Combining with Support/Resistance

**Enhanced Signals:**
- NWE signal + horizontal S/R level = stronger signal
- NWE band aligns with previous S/R = confirmation
- Multiple timeframes showing NWE signals at same level = high probability

## Conclusion

The LuxAlgo Nadaraya-Watson Envelope is a powerful, adaptive indicator that excels at identifying potential reversal zones and trend exhaustion points. By combining it with momentum oscillators (RSI, MACD, ROC), volume analysis, and trend filters, traders can develop robust strategies for various market conditions.

**Key takeaways:**
1. Use non-repainting mode for live trading and backtesting
2. Combine with RSI/MACD/ROC for signal confirmation
3. Adjust bandwidth based on market volatility and timeframe
4. Always use proper risk management (stop loss, position sizing)
5. Consider ATR-adaptive bandwidth for better performance across market regimes

**Recommended starting point:**
- Bandwidth: 8
- Multiplier: 3
- Mode: Non-repainting
- Confirmation: RSI(14) with 30/70 levels
- Timeframe: 1h or 4h

---

**References:**
- [LuxAlgo Original Indicator](https://www.tradingview.com/script/Iko0E2kL-Nadaraya-Watson-Envelope-LuxAlgo/)
- [Nadaraya-Watson Estimator Theory](https://en.wikipedia.org/wiki/Kernel_regression)
- [Adaptive Bandwidth Selection Research](https://www.fmz.com/lang/en/strategy/439361)
