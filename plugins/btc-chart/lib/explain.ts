// BTC Chart — plain-language explanations for the Trade Setup engine.
//
// Maps each confluence reason string emitted by `calcTradeSetup` to a Vietnamese
// explanation, classifies its bull/bear side, and provides static documentation
// for every indicator so the "Vì sao có Trade Setup này?" popup can teach the
// reasoning rather than just listing tags.

export type ReasonSide = 'bull' | 'bear' | 'context'

export interface ReasonExplain {
  side: ReasonSide
  /** Short plain-language "what this means / why it matters". */
  text: string
}

/**
 * Explain one reason string. Handles both fixed labels and the dynamic ones
 * (RSI/ADX/ADR/Draw) via prefix matching. Falls back to a neutral note.
 */
export function explainReason(reason: string): ReasonExplain {
  // ── Dynamic / prefixed reasons ──
  if (reason.startsWith('RSI')) {
    const oversold = reason.includes('oversold')
    return {
      side: oversold ? 'bull' : 'bear',
      text: oversold
        ? 'RSI dưới 35: quá bán, lực bán cạn dần, ưu tiên khả năng bật lên.'
        : 'RSI trên 65: quá mua, lực mua căng, ưu tiên khả năng điều chỉnh xuống.',
    }
  }
  if (reason.startsWith('ADX')) {
    return {
      side: 'context',
      text: 'ADX cao (>25): thị trường đang có xu hướng rõ, tín hiệu theo trend đáng tin hơn (không quyết định hướng).',
    }
  }
  if (reason.startsWith('ADR')) {
    return {
      side: 'context',
      text: 'Đã dùng >85% biên độ ngày trung bình: giá đi hơi xa, cẩn trọng rủi ro đảo chiều về trung bình.',
    }
  }
  if (reason.startsWith('In ') && reason.includes('Killzone')) {
    return {
      side: 'context',
      text: 'Giá đang trong killzone London/NY: khung giờ thanh khoản mạnh, xác suất tín hiệu chạy cao hơn.',
    }
  }
  if (reason.startsWith('Draw →')) {
    return {
      side: 'context',
      text: 'Vùng thanh khoản giá đang nhắm tới tiếp theo (không đổi hướng, chỉ định hướng mục tiêu).',
    }
  }

  return (
    REASON_MAP[reason] ?? {
      side: 'context',
      text: reason,
    }
  )
}

const REASON_MAP: Record<string, ReasonExplain> = {
  'ML Bullish': {
    side: 'bull',
    text: 'Mô hình ML tổng hợp nhiều chỉ báo cho điểm thiên về tăng (≥0.65).',
  },
  'ML Bearish': {
    side: 'bear',
    text: 'Mô hình ML tổng hợp nhiều chỉ báo cho điểm thiên về giảm (≤0.35).',
  },
  'Price at NWE lower': {
    side: 'bull',
    text: 'Giá chạm dải dưới NWE (Midnight Hunter): vùng quá bán động, hay bật lên.',
  },
  'Price at NWE upper': {
    side: 'bear',
    text: 'Giá chạm dải trên NWE: vùng quá mua động, hay quay đầu.',
  },
  'Boucher Buy': { side: 'bull', text: 'Tín hiệu mua scalping Boucher (M1) vừa xuất hiện.' },
  'Boucher Sell': { side: 'bear', text: 'Tín hiệu bán scalping Boucher (M1) vừa xuất hiện.' },
  '3-Bar Reversal+': { side: 'bull', text: 'Mẫu đảo chiều 3 nến hướng lên vừa hoàn tất.' },
  '3-Bar Reversal-': { side: 'bear', text: 'Mẫu đảo chiều 3 nến hướng xuống vừa hoàn tất.' },
  'Box Speed Fast': {
    side: 'context',
    text: 'Box flip đang chạy nhanh: động lượng mạnh, xác nhận thêm cho hướng chính.',
  },
  'Lien Bullish Rev': { side: 'bull', text: 'Tín hiệu đảo chiều tăng theo Kathy Lien.' },
  'Lien Bearish Rev': { side: 'bear', text: 'Tín hiệu đảo chiều giảm theo Kathy Lien.' },
  'Lien High Conf': {
    side: 'context',
    text: 'Tín hiệu Lien có độ tin cậy cao (≥70%): tăng trọng số cho hướng đó.',
  },
  'Squeeze Breakout+': {
    side: 'bull',
    text: 'Bollinger squeeze bung lên: nén biến động rồi phá vỡ hướng tăng.',
  },
  'Squeeze Breakout-': {
    side: 'bear',
    text: 'Bollinger squeeze bung xuống: nén biến động rồi phá vỡ hướng giảm.',
  },
  'Exhaustion at Top': {
    side: 'bear',
    text: 'Kiệt sức tại đỉnh dải: lực mua yếu dần, rủi ro quay đầu.',
  },
  'Exhaustion at Bottom': {
    side: 'bull',
    text: 'Kiệt sức tại đáy dải: lực bán yếu dần, khả năng bật lên.',
  },
  'NWE Cross Buy': { side: 'bull', text: 'Giá cắt lên đường NWE (LuxAlgo): tín hiệu mua.' },
  'NWE Cross Sell': { side: 'bear', text: 'Giá cắt xuống đường NWE (LuxAlgo): tín hiệu bán.' },
  'Price at Lux NWE lower': {
    side: 'bull',
    text: 'Giá tại dải dưới Lux NWE: vùng chiết khấu, ưu tiên mua.',
  },
  'Price at Lux NWE upper': {
    side: 'bear',
    text: 'Giá tại dải trên Lux NWE: vùng cao, ưu tiên bán.',
  },
  'Above Lux NWE mid (bullish bias)': {
    side: 'context',
    text: 'Giá trên đường giữa Lux NWE: thiên hướng tăng (bối cảnh).',
  },
  'Below Lux NWE mid (bearish bias)': {
    side: 'context',
    text: 'Giá dưới đường giữa Lux NWE: thiên hướng giảm (bối cảnh).',
  },
  'Judas Swing Long (sweep Asia low)': {
    side: 'bull',
    text: 'Judas Swing: London quét đáy phiên Á gom stoploss rồi đảo lên — vào Long theo Smart Money.',
  },
  'Judas Swing Short (sweep Asia high)': {
    side: 'bear',
    text: 'Judas Swing: London quét đỉnh phiên Á gom stoploss rồi đảo xuống — vào Short theo Smart Money.',
  },
  'VOL confirms sweep': {
    side: 'context',
    text: 'Khối lượng tăng vọt tại nến quét: xác nhận đây là cú quét thật, không phải nhiễu.',
  },
  'Liquidity Sweep Long (external low)': {
    side: 'bull',
    text: 'Giá quét đáy range (SSL) rồi đóng ngược vào trong: bẫy bán, ưu tiên Long.',
  },
  'Liquidity Sweep Short (external high)': {
    side: 'bear',
    text: 'Giá quét đỉnh range (BSL) rồi đóng ngược vào trong: bẫy mua, ưu tiên Short.',
  },
  'Sweep in London/NY Killzone': {
    side: 'context',
    text: 'Cú quét rơi vào killzone London/NY: xác suất vào lệnh cùng tổ chức cao nhất.',
  },
  'Discount + bullish FVG target': {
    side: 'bull',
    text: 'Giá ở nửa dưới range (discount) + có FVG tăng phía trên làm mục tiêu: canh Long.',
  },
  'Premium + bearish FVG target': {
    side: 'bear',
    text: 'Giá ở nửa trên range (premium) + có FVG giảm phía dưới làm mục tiêu: canh Short.',
  },
}

export interface IndicatorDoc {
  name: string
  desc: string
}

/** Static docs for every indicator/overlay, shown in the explanation popup. */
export const INDICATOR_DOCS: IndicatorDoc[] = [
  {
    name: 'ML Signal',
    desc: 'Điểm tổng hợp từ nhiều chỉ báo (NWE, MA, RSI, MACD…) quy về một điểm 0–1: >0.65 tăng, <0.35 giảm.',
  },
  {
    name: 'RSI (14)',
    desc: 'Đo động lượng. <35 quá bán (canh mua), >65 quá mua (canh bán); phân kỳ RSI báo hiệu đảo chiều.',
  },
  {
    name: 'MACD',
    desc: 'Chênh lệch 2 đường trung bình động — đo động lượng và giao cắt tín hiệu tăng/giảm.',
  },
  {
    name: 'ADX (14)',
    desc: 'Đo độ mạnh xu hướng (không đo hướng). >25 = trend rõ, tín hiệu theo trend đáng tin hơn.',
  },
  {
    name: 'Stoch RSI',
    desc: 'RSI áp lên công thức Stochastic — nhạy hơn, bắt quá mua/quá bán ngắn hạn.',
  },
  {
    name: 'OBV',
    desc: 'On-Balance Volume: cộng/trừ khối lượng theo hướng nến, xác nhận dòng tiền theo giá.',
  },
  {
    name: 'VWAP',
    desc: 'Giá trung bình theo khối lượng trong ngày — mốc tham chiếu fair value của phiên.',
  },
  {
    name: 'NWE / MH Band',
    desc: 'Nadaraya-Watson Envelope: dải bao quanh giá; chạm dải dưới hay bật lên, dải trên hay quay đầu.',
  },
  {
    name: 'Lux NWE',
    desc: 'Biến thể LuxAlgo của NWE với tín hiệu giao cắt mua/bán và đường giữa xác định thiên hướng.',
  },
  {
    name: 'SMC',
    desc: 'Smart Money Concepts: BOS/CHoCH (phá cấu trúc), Order Block, FVG (khoảng trống giá trị).',
  },
  {
    name: 'ICT Sessions',
    desc: 'Giải mã phiên Á/Âu/Mỹ + Judas Swing (cú quét stop đầu London) theo tư duy Inner Circle Trader.',
  },
  {
    name: 'Liquidity',
    desc: 'Range + Premium/Discount, thanh khoản External (BSL/SSL) vs Internal (FVG), và cú quét thanh khoản.',
  },
  {
    name: 'Boucher Scalping',
    desc: 'Hệ scalping M1 của Boucher: tín hiệu mua/bán nhanh + mẫu đảo chiều 3 nến.',
  },
  {
    name: 'Lien Reversal',
    desc: 'Tín hiệu đảo chiều theo Kathy Lien: squeeze breakout, kiệt sức tại biên dải.',
  },
  {
    name: 'Box Flip',
    desc: 'Hộp tích lũy và cú lật hướng — đo tốc độ (fast/slow) động lượng phá hộp.',
  },
  { name: 'Order Flow', desc: 'Mất cân bằng mua/bán theo khối lượng tại từng mức giá.' },
  {
    name: 'Volume Profile',
    desc: 'Phân bổ khối lượng theo giá: POC/VAH/VAL — vùng giá giao dịch nhiều nhất.',
  },
]
