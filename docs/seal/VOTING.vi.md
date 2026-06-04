---
tags: [seal, voting, onchain-decryption, hmac-ctr]
aliases: [Seal Voting, Sealed Voting]
---

# `sui-seal-voting` — Thiết Kế Kỹ Thuật

Bỏ phiếu bằng phiếu bầu đã mã hóa, với giải mã on-chain qua Seal HMAC-CTR.

## Tổng Quan

Người bỏ phiếu gửi các lá phiếu đã mã hóa lên chain. Không ai có thể xem từng
lá phiếu riêng lẻ cho tới khi admin đóng phiên bỏ phiếu và kích hoạt giải mã
on-chain. Kết quả kiểm phiếu có thể xác minh được: bất kỳ ai cũng có thể chạy
lại bước giải mã và kiểm tra kết quả.

```text
Voter → encrypt(ballot, HMAC-CTR) → submit on-chain
                                          ↓
Admin closes voting → fetch derived keys → on-chain decrypt → tally
```

## 1. Move Contract: `voting_seal.move`

### Structs

`VotingSession` là shared object lưu:
- admin
- chủ đề bỏ phiếu
- danh sách option
- danh sách cử tri hợp lệ
- các lá phiếu đã mã hóa
- danh sách địa chỉ đã gửi phiếu
- cờ `is_closed`
- thời điểm tạo

### Functions

- `create(...)`: tạo một phiên bỏ phiếu mới, người gọi trở thành admin
- `submit_ballot(...)`: gửi lá phiếu đã mã hóa; chỉ cử tri hợp lệ và chưa bỏ phiếu mới được gửi
- `close(...)`: admin đóng phiên bỏ phiếu
- `seal_approve(...)`: cho phép cử tri hợp lệ mã hóa vào phiên này; `id` phải có tiền tố là object ID của session

### Deployment

```bash
cd move
sui move build
sui client publish --gas-budget 100000000
```

## 2. Mã Hóa: HMAC-CTR (Bắt Buộc)

Giải mã on-chain chỉ hỗ trợ HMAC-CTR, nên phải dùng `DemType.Hmac256Ctr`.

- Dữ liệu ballot chỉ là 1 byte (option index)
- Identity = `session_object_id ++ random_nonce`
- Overhead của HMAC-CTR là chấp nhận được vì payload rất nhỏ

## 3. PTB Giải Mã On-chain

Đây là phần phức tạp nhất. Admin phải dựng một PTB giải mã từng lá phiếu
trên chain.

### Seal Package cho Giải Mã On-chain

- Testnet:
  `0x4016869413374eaa71df2a043d1660ed7bc927ab7962831f8b07efbc7efdb2c3`
- Mainnet:
  `0xcb83a248bda5f7a0a431e6bf9e96d184e604130ec5218696e3f1211113b447b7`

### Các Bước Dựng PTB

Với mỗi encrypted ballot:
1. Parse `EncryptedObject`
2. Gọi `getDerivedKeys(...)` từ key servers
3. Lấy public keys tương ứng
4. Trong PTB:
   - chuyển public keys sang định dạng on-chain
   - chuyển derived keys sang G1 elements
   - gọi `verify_derived_keys`
   - gọi `parse_encrypted_object`
   - gọi `decrypt`

Kết quả `decrypt` là `Option<vector<u8>>`.

### Chiến Lược Chia Batch

Kích thước PTB có giới hạn, nên không thể giải mã toàn bộ ballots trong một tx:
- ước lượng khoảng 5-10 ballot mỗi PTB
- nếu nhiều hơn, tách thành nhiều transaction
- tổng hợp kết quả phía client

## 4. Plugin UI

### Tab: Create Session

UI cho phép:
- nhập topic
- thêm/xóa option động
- thêm danh sách địa chỉ cử tri hợp lệ
- tạo session và hiển thị `Session ID`

### Tab: Vote

UI cho phép:
- nhập hoặc chọn `Session ID`
- hiển thị topic và trạng thái
- chọn một option
- gửi encrypted vote
- hiện xác nhận rằng lá phiếu đã được mã hóa và chưa ai xem được

### Tab: Tally

UI cho phép:
- đóng phiên bỏ phiếu
- theo dõi tiến độ giải mã on-chain
- hiển thị kết quả cuối cùng theo số lượng và phần trăm
- đánh dấu `Verified on-chain`

## 5. Luồng Dữ Liệu

```text
Admin creates session
    ↓
VotingSession shared object on Sui
    ↓
Voters encrypt ballots and submit them on-chain
    ↓
Admin closes voting and runs on-chain decryption PTBs
    ↓
Results are counted and can be verified
```

## 6. Các Quyết Định Kỹ Thuật Chính

### Mã Hóa Ballot

Một byte duy nhất:
- `0x00` = Option 0
- `0x01` = Option 1
- `0x02` = Option 2

### Cấu Trúc Identity

`id = session_object_id (32 bytes) ++ random_nonce (5 bytes)`

Nonce giúp mỗi lá phiếu có identity riêng dù cùng một session. `seal_approve`
kiểm tra tiền tố session ID.

### Tally On-chain vs Client-side

| Cách | Ưu điểm | Nhược điểm |
|------|---------|------------|
| On-chain | có thể xác minh, trustless | PTB phức tạp, tốn gas, chỉ hỗ trợ HMAC-CTR |
| Client-side | đơn giản, nhanh | admin thấy được phiếu, không xác minh được |

Chọn on-chain vì mục tiêu cốt lõi là quyền riêng tư cộng với khả năng xác minh.

### Phạm Vi SessionKey

- Cử tri cần `SessionKey` để mã hóa và để phục vụ dry-run `seal_approve`
- Admin cần `SessionKey` để gọi `getDerivedKeys` khi tally
- Cả hai đều gắn với voting package ID, TTL khoảng 10 phút

### Cache Public Key

`getPublicKeys()` nên gọi một lần khi app khởi tạo rồi cache lại, vì cùng một
session sẽ dùng cùng nhóm key server.

## 7. Rủi Ro Và Giảm Thiểu

| Rủi ro | Tác động | Cách giảm |
|--------|----------|-----------|
| PTB quá lớn khi ballot nhiều | transaction fail | batch 5-10 ballot/PTB, tổng hợp ở client |
| Key server rate limit | `getDerivedKeys` fail | dùng `fetchKeys()` batch API, pre-fetch IDs |
| Voter gửi ballot không hợp lệ | lỗi tally | `decrypt` trả `None`, bỏ qua khi đếm |
| Admin không đóng voting | phiếu bị kẹt | có thể thêm deadline auto-close bằng clock trong Move |
| Gas giải mã on-chain cao | tốn phí khi nhiều cử tri | ước lượng gas trước và cảnh báo admin |
| Hiệu năng HMAC-CTR | chậm nếu dữ liệu lớn | ballot chỉ 1 byte nên gần như không đáng kể |

## 8. Checklist Triển Khai

### Move Contract
- [ ] Viết `voting_seal.move` (`create`, `submit_ballot`, `close`, `seal_approve`)
- [ ] Thêm helper tally hoặc để tally chạy hoàn toàn bằng PTB
- [ ] `sui move test` — unit test cho access control
- [ ] Deploy lên testnet và lưu package ID

### Plugin: Create Tab
- [ ] Form: topic, options, eligible voters
- [ ] `signAndExecuteTransaction` để tạo session
- [ ] Fetch session object để xác nhận + hiển thị ID

### Plugin: Vote Tab
- [ ] Input session ID → fetch session details
- [ ] Radio buttons cho options
- [ ] Encrypt bằng `DemType.Hmac256Ctr`
- [ ] Submit encrypted ballot on-chain
- [ ] Hiển thị xác nhận

### Plugin: Tally Tab
- [ ] Close voting (admin only)
- [ ] Fetch toàn bộ `encrypted_ballots`
- [ ] Build approval PTB cho `seal_approve`
- [ ] `getDerivedKeys` + `getPublicKeys` theo batch
- [ ] Build PTB giải mã on-chain
- [ ] Execute + parse kết quả
- [ ] Đếm phiếu theo từng option

### Plugin: Results Display
- [ ] Bar chart bằng CSS
- [ ] Vote counts + percentages
- [ ] Chỉ báo `Verified on-chain`

### Integration
- [ ] Đăng ký trong `vite.config.ts`
- [ ] Đăng ký trong `SuiWasmDashboard.tsx`
- [ ] CSS file
- [ ] Build + verify

## 9. Ước Tính Công Sức

| Thành phần | LOC | Thời gian |
|-----------|-----|-----------|
| `voting_seal.move` | ~120 | 1h |
| Move tests | ~80 | 30min |
| Plugin UI (4 tab) | ~400 | 2h |
| PTB builder giải mã on-chain | ~150 | 2h |
| Batch logic + error handling | ~80 | 1h |
| CSS | ~80 | 30min |
| Test + debug | — | 2h |
| **Tổng** | **~910** | **~9h** |

PTB builder cho giải mã on-chain là phần rủi ro cao nhất vì type annotations,
`makeMoveVec` với generic types, và chuỗi Move calls nhiều bước phải ghép đúng.
