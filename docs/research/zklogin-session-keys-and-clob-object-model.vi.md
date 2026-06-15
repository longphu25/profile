# Nghiên cứu: khóa phiên zkLogin & mô hình lưu trữ object-centric vs account-based cho order book trên Sui

> Báo cáo deep-research (2026). 16 nguồn sơ cấp, 25 claim được kiểm chứng đối kháng
> (3 phiếu), tất cả xác nhận 3-0. Độ tin cậy đồng đều ở mức cao. Đọc phần Lưu ý trước
> khi code dựa trên đường dẫn endpoint hay tên method SDK cụ thể.

Hai phần:
- **Phần A** quản lý khóa phiên zkLogin trong dApp Sui production.
- **Phần B** mô hình lưu trữ object-centric vs account/ledger của Sui Move cho order
  book on-chain (CLOB).

---

## Phần A: quản lý khóa phiên zkLogin

### Vòng đời phiên

Một phiên bắt đầu bằng việc sinh một cặp khóa ephemeral Ed25519 mới. Public key của nó,
giá trị hết hạn `max_epoch`, và `jwt_randomness` được commit vào `nonce` của OAuth qua
hàm băm Poseidon BN254. Vì nhà cung cấp OAuth sau đó ký một JWT chứa nonce này, JWT do
provider ký bị ràng buộc mật mã vào đúng cặp khóa ephemeral đó trong đúng cửa sổ hết
hạn đó. [1]

```
nonce = Poseidon_BN254(eph_pk, max_epoch, jwt_randomness)

// dapp-kit / zkLogin SDK
const maxEpoch = Number(epoch) + 2
generateNonce(ephemeralKeyPair.getPublicKey(), maxEpoch, randomness)
```

### Hết hạn theo epoch, không theo đồng hồ thực

`max_epoch` là một `u64` đặt lúc tạo phiên, thường là epoch hiện tại + 2 (đây là ví dụ
trong tài liệu, không phải quy tắc cứng). Một ZK proof dẫn xuất từ JWT được cache và
tái dùng cho mọi giao dịch trong phiên cho tới khi epoch hiện tại của chain vượt qua
`max_epoch`. Sau đó cả proof lẫn khóa ephemeral đều vô hiệu. [2]

### Không có xoay khóa tăng dần

Không có cơ chế xoay khóa. Một proof duy nhất ký mọi giao dịch; nó chỉ được sinh lại
khi khóa ephemeral hết hạn. Gia hạn phiên đòi hỏi một chu trình mới hoàn toàn: khóa
ephemeral mới, nonce mới, đăng nhập OAuth mới, JWT mới, proof mới. Không có refresh
token ngầm dựng sẵn.

Mất khóa ephemeral không làm mất tiền. Xác thực lại sẽ khôi phục quyền kiểm soát, vì địa
chỉ zkLogin dẫn xuất từ `salt + claim của JWT`, không phải từ khóa ephemeral. [3]

### Lưu trữ khóa ephemeral an toàn

Hướng dẫn chính thức: lưu cặp khóa ephemeral và ZK proof vào `sessionStorage` của
trình duyệt, không dùng `localStorage`. `sessionStorage` bị xóa khi phiên trình duyệt
kết thúc, giới hạn cửa sổ phơi nhiễm. Coi khóa ephemeral như một bí mật ngang với khóa
private của ví. [4]

Lưu ý cho repo này: một gợi ý vị thế lưu ở `localStorage` (như marker minted của studio)
là ổn vì nó không chứa bí mật, nhưng khóa ephemeral và proof tuyệt đối không được để ở đó.

### Vì sao lộ một credential chưa phải mất tất cả

zkLogin là multisig 2-of-2: credential OAuth và salt riêng của người dùng.
- Chỉ chiếm được tài khoản OAuth thì không truy cập được địa chỉ (thiếu salt).
- Chỉ lộ JWT thì không mất tiền (vẫn cần khóa private ephemeral + proof hợp lệ).
- Salt tách bạch danh tính OAuth khỏi địa chỉ giữ tiền. [5]

### Enoki (hạ tầng production)

Enoki sản phẩm hóa hai thứ mà bạn sẽ phải tự dựng:

1. **Quản lý salt theo từng app.** Enoki dẫn xuất địa chỉ bằng salt riêng cho từng app,
   nên cùng một người dùng có địa chỉ Sui khác nhau giữa các app dùng Enoki khác nhau. [7]

2. **Giao dịch được tài trợ (sponsored).** Người dùng giao dịch với 0 SUI (dApp trả
   gas), qua luồng 4 bước nghiêm ngặt: [6]

```
1. Client dựng bytes chỉ-phần-tx:  build({ onlyTransactionKind: true })
2. Backend -> POST /v1/transaction-blocks/sponsor   (header: zklogin-jwt)
                                     -> trả về { bytes, digest }
3. Client ký phần bytes trả về
4. Backend -> POST /v1/transaction-blocks/sponsor/:digest   (chữ ký)
```

Tài trợ đòi hỏi private API key và key này phải nằm ở backend, đồng thời bị giới hạn bởi
allowlist `allowedMoveCallTargets` / `allowedAddresses` do builder cấu hình. Nên "tài
trợ toàn bộ giao dịch" thực chất là "mọi giao dịch khớp allowlist của bạn." [6]

---

## Phần B: object-centric vs account/ledger cho order book

### Đánh đổi cốt lõi: quyền sở hữu quyết định tính song song

| Khía cạnh | Object sở hữu theo địa chỉ | Object shared |
|---|---|---|
| Truy cập | Một chủ duy nhất | Bất kỳ địa chỉ nào |
| Tuần tự hóa | Fastpath không qua consensus (lấy quorum validator trực tiếp) | Bắt buộc qua consensus (Mysticeti) |
| Song song | Song song khi không tranh chấp | Tuần tự hóa trên mỗi object |
| Vai trò order-book | Số dư, biên nhận theo từng người | Chính cuốn sổ lệnh |

Sự thật trung tâm của thiết kế CLOB trên Sui: một cuốn sổ lệnh dạng một object shared
duy nhất là nút thắt tranh chấp căn bản, vì mọi lệnh sửa nó đều phải tuần tự hóa qua
consensus. Bạn không thể song song hóa ghi vào một cuốn sổ shared. [8]

Đây là khác biệt mấu chốt so với mô hình account/ledger: trên chain account-based, mọi
lệnh đều chạm vào một ledger toàn cục và tranh chấp là ngầm định và toàn phần. Mô hình
object của Sui cho phép tách phần buộc-phải-shared khỏi phần có-thể-sở-hữu-và-song-song,
nhưng chỉ khi bạn thiết kế cho điều đó.

### Dynamic field thoát khỏi giới hạn kích thước object

Object trên Sui có chặn trên về kích thước khi bọc các object khác, nên không thể nhồi
cả cuốn sổ vào một struct. Dynamic field gắn vào `UID` của object và chỉ tốn gas khi
được truy cập, cho phép dựng cấu trúc thưa, lớn không chặn (như một cuốn sổ) mà không
trả phí cho các mục không đụng tới. [9]

```move
// chỉ tính gas cho các mục bạn thực sự chạm vào
dynamic_field::borrow_mut(&mut book.id, price_key)
```

### Thiết kế tham chiếu DeepBook v3

DeepBook v3 là lời giải kinh điển, đáng sao chép về mặt cấu trúc. Nó xoay quanh ba
object shared: [10]

- **`Pool`** một thị trường cộng cuốn sổ lệnh của nó.
- **`PoolRegistry`** chống trùng (ngăn pool trùng lặp) cộng versioning package lúc tạo.
- **`BalanceManager`** một nguồn vốn duy nhất tái dùng được cho mọi pool, nên vốn của
  trader không bị phân mảnh theo từng thị trường.

Lệnh (bid/ask) nằm trong `BigVector`, một cây B+ on-chain với thao tác gần như hằng số
(`log cơ số max_fan_out`), các node lưu dưới dạng dynamic field. Đó chính là cách thoát
giới hạn kích thước và gas áp thẳng vào cuốn sổ. [10]

Thanh toán dùng mô hình kế toán settled/owed tường minh: mọi giao dịch đặt lại số dư
settled và owed của người dùng, được Vault đối soát với BalanceManager theo từng tài sản
ở định dạng `(base, quote, DEEP)`. Đây là ý tưởng account/ledger được đưa trở lại bên
trong mô hình object, không phải dưới dạng ledger toàn cục mà là đối soát theo từng
giao dịch. [10]

### Hệ quả cho predict-club

Thị trường predict ở đây mint các vị thế sở hữu riêng lẻ (Quick Predict / studio mint)
thay vì khớp vào một cuốn sổ shared, đó là con đường tốt cho tính song song: mint
object-sở-hữu đi theo fastpath và song song hóa tự nhiên. Nếu sau này thêm một CLOB thực
sự (máy khớp lệnh, lệnh chờ), hình dạng DeepBook v3 là bản thiết kế mẫu: `Pool` shared
cho mỗi thị trường, một object vốn kiểu `BalanceManager` tái dùng giữa các thị trường,
cuốn sổ cây B+ trong dynamic field, và đối soát settled/owed theo từng giao dịch. Thứ
cần tránh là một object shared nóng mà mọi giao dịch phải tuần tự hóa qua nó.

---

## Lưu ý

- Độ tin cậy cao tổng thể. Cả 10 phát hiện dựa trên tài liệu sơ cấp của Sui/Mysten/Enoki,
  kiểm chứng nhất trí 3-0.
- Nhạy thời điểm. Enoki và DeepBook v3 đang tiến hóa tích cực. Một URL Enoki được trích
  ban đầu (`.../ts-sdk/zklogin`) đã 404, dù nội dung của nó được xác nhận ở nơi khác.
  Hãy kiểm tra đường dẫn endpoint và tên method SDK cụ thể với tài liệu hiện hành trước
  khi code.
- Chưa benchmark. Các nhận định về tranh chấp/song song là lý do thiết kế trong tài liệu,
  không phải số throughput đo độc lập. `max_epoch + 2` là giá trị ví dụ. "Fastpath" là
  thuật ngữ trong tài liệu ownership; trang consensus không dùng từ này theo nghĩa đen.

## Câu hỏi mở

1. Số latency/throughput thực của DeepBook v3 khi tranh chấp, và sharding nhiều pool
   thực sự giảm được bao nhiêu so với một pool.
2. Cách dApp production che đi việc buộc xác thực lại hoàn toàn ở `max_epoch` giữa phiên
   giao dịch (re-proving nền, làm mới OAuth ngầm).
3. Rate limit của Enoki, cơ chế nạp gas-station, và mô hình chi phí khi scale.
4. Các pattern không-Enoki (dịch vụ salt/proving tự host, backend proving thay thế) và
   đánh đổi lưu trữ/bảo mật của chúng.

## Nguồn

- [1] [zkLogin concepts](https://docs.sui.io/concepts/cryptography/zklogin), [zkLogin integration](https://docs.sui.io/guides/developer/cryptography/zklogin-integration)
- [2] như trên + [developer-account](https://docs.sui.io/guides/developer/cryptography/zklogin-integration/developer-account)
- [3] [zkLogin concepts](https://docs.sui.io/concepts/cryptography/zklogin), [integration](https://docs.sui.io/guides/developer/cryptography/zklogin-integration), [developer-account](https://docs.sui.io/guides/developer/cryptography/zklogin-integration/developer-account)
- [4] [zkLogin integration guide](https://docs.sui.io/guides/developer/cryptography/zklogin-integration)
- [5] [zkLogin concepts](https://docs.sui.io/concepts/cryptography/zklogin)
- [6] [Enoki docs](https://docs.enoki.mystenlabs.com/), [sponsored transactions](https://docs.enoki.mystenlabs.com/ts-sdk/sponsored-transactions), [OpenAPI](https://docs.enoki.mystenlabs.com/http-api/openapi)
- [7] [Enoki TS SDK](https://docs.enoki.mystenlabs.com/ts-sdk)
- [8] [Object ownership](https://docs.sui.io/concepts/object-ownership)
- [9] [Dynamic fields](https://docs.sui.io/concepts/dynamic-fields)
- [10] [DeepBook v3 design](https://docs.sui.io/standards/deepbookv3/design)
