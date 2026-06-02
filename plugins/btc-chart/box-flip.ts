// BTC Chart — Box Breakout Direction Flip.
// Detects consolidation boxes and emits B/S markers only when breakout
// direction flips from the last emitted direction.

export interface BoxFlipCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
}

export interface BoxFlipBox {
  startIndex: number
  endIndex: number
  high: number
  low: number
  dir: 'B' | 'S' | null
}

export interface BoxFlipSignal {
  time: number
  price: number
  dir: 'B' | 'S'
}

export interface BoxFlipOptions {
  minBoxBars?: number
  maxBoxHeightPct?: number
  breakoutConfirm?: 'close' | 'wick'
  bufferPct?: number
}

export interface BoxFlipResult {
  boxes: BoxFlipBox[]
  signals: BoxFlipSignal[]
}

export function buildBoxFlipSignals(
  candles: BoxFlipCandle[],
  opts: BoxFlipOptions = {},
): BoxFlipResult {
  const {
    minBoxBars = 10,
    maxBoxHeightPct = 0.012,
    breakoutConfirm = 'close',
    bufferPct = 0.0007,
  } = opts

  if (candles.length < minBoxBars + 1) {
    return { boxes: [], signals: [] }
  }

  const boxes: BoxFlipBox[] = []
  const signals: BoxFlipSignal[] = []
  let box: BoxFlipBox | null = null
  let lastDir: 'B' | 'S' | null = null

  const getBreakPrice = (c: BoxFlipCandle, side: 'up' | 'down') => {
    if (breakoutConfirm === 'wick') return side === 'up' ? c.high : c.low
    return c.close
  }

  const isBoxTooWide = (b: BoxFlipBox, close: number) =>
    close > 0 && (b.high - b.low) / close > maxBoxHeightPct

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]

    if (!box) {
      box = {
        startIndex: i,
        endIndex: i,
        high: c.high,
        low: c.low,
        dir: null,
      }
      continue
    }

    const boxBars = i - box.startIndex
    if (boxBars >= minBoxBars) {
      const upper = box.high * (1 + bufferPct)
      const lower = box.low * (1 - bufferPct)
      const upPrice = getBreakPrice(c, 'up')
      const downPrice = getBreakPrice(c, 'down')
      const newDir = upPrice > upper ? 'B' : downPrice < lower ? 'S' : null

      if (newDir) {
        const closedBox: BoxFlipBox = { ...box, endIndex: i, dir: newDir }
        boxes.push(closedBox)

        if (newDir !== lastDir) {
          signals.push({
            time: c.time,
            price: newDir === 'B' ? c.low : c.high,
            dir: newDir,
          })
          lastDir = newDir
        }

        box = {
          startIndex: i,
          endIndex: i,
          high: c.high,
          low: c.low,
          dir: null,
        }
        continue
      }
    }

    box.high = Math.max(box.high, c.high)
    box.low = Math.min(box.low, c.low)
    box.endIndex = i

    if (boxBars >= minBoxBars && isBoxTooWide(box, c.close)) {
      box = {
        startIndex: Math.max(0, i - minBoxBars + 1),
        endIndex: i,
        high: c.high,
        low: c.low,
        dir: null,
      }
      for (let j = box.startIndex; j <= i; j++) {
        box.high = Math.max(box.high, candles[j].high)
        box.low = Math.min(box.low, candles[j].low)
      }
    }
  }

  if (box) boxes.push(box)

  return { boxes, signals }
}
