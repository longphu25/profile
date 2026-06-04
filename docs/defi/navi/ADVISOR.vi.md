---
tags: [navi, advisor, strategy, yield, defi, execute]
aliases: [NAVI Advisor, Strategy Advisor]
---

# NAVI Strategy Advisor — Ghi Chú Kỹ Thuật

Plugin nhận budget USD, fetch dữ liệu thời gian thực, sinh và xếp hạng chiến
lược sinh lời, rồi cho phép execute on-chain.

## 5 Loại Chiến Lược

1. **Best Supply**: chọn pool có supply APY cao nhất.
2. **Best Volo Vault**: chọn vault có `apy7d` cao nhất.
3. **Supply + Borrow Loop**: supply SUI rồi borrow stablecoin ở LTV an toàn.
4. **Stable Vault**: chọn vault ổn định hơn như nhóm MMT/stable.
5. **Diversified Top 3**: chia đều budget cho 3 pool APY cao nhất.

## Execute Flow

### Deposit

1. Tìm pool config trong `NAVI_POOL_CFG`
2. Tính `tokenAmount`
3. Tạo coin object:
   - SUI → `splitCoins(tx.gas, [amount])`
   - non-SUI → `suix_getCoins` → merge → split
4. Gọi `incentive_v3::entry_deposit`
5. Ký và thực thi

### Volo Stake

1. Tính lượng SUI cần stake
2. Split coin từ gas
3. Gọi `stake_pool::stake`
4. Transfer `vSUI` về ví
5. Ký và thực thi

### Supply + Borrow

1. Tính `suiAmount` và `borrowAmount`
2. Deposit SUI
3. Borrow stablecoin
4. Chuyển coin vay được về ví
5. Ký và thực thi trong cùng một PTB

## Volo CSV Parsing

`volo_get_vaults` trả về CSV nên plugin phải parse header, map từng dòng, parse
số rồi filter `status === 'open'`.

## Xử Lý Coin Non-SUI

Với token không phải SUI:
- fetch coin objects bằng `suix_getCoins`
- merge các object cùng loại
- split đúng lượng cần dùng

Nếu ví không có token đó, plugin ném lỗi `"No {symbol} coins in wallet"`.
