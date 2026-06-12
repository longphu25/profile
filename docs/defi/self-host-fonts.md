# Self-Hosting Satoshi Font

> Hướng dẫn tải và self-host font Satoshi, thay thế fontshare.com CDN.

## Lý do

Trước đây `@font-face` trỏ `src` vào URL fontshare trả về **CSS** (không phải file font):

```css
/* ❌ SAI — URL này trả về CSS, không phải font binary */
@font-face {
  font-family: 'Satoshi';
  src: url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap');
}
```

Browser cố parse CSS như font binary → lỗi `OTS parsing error: invalid sfntVersion`.

## Nguồn tải font

Tải từ: **https://font.download/font/satoshi**

Giải nén và đặt các file `.woff` vào `public/fonts/satoshi/`:

```
public/fonts/satoshi/
├── Satoshi-Light.woff
├── Satoshi-Regular.woff
├── Satoshi-Medium.woff
├── Satoshi-Bold.woff
├── Satoshi-Black.woff
├── Satoshi-Italic.woff
├── Satoshi-LightItalic.woff
├── Satoshi-MediumItalic.woff
├── Satoshi-BoldItalic.woff
└── Satoshi-BlackItalic.woff
```

## Cấu hình @font-face

Mỗi file CSS dùng Satoshi khai báo `@font-face` với family thống nhất `'Satoshi'`
và map đúng `font-weight`:

| Weight | File |
|--------|------|
| 300 (Light) | `Satoshi-Light.woff` |
| 400 (Regular) | `Satoshi-Regular.woff` |
| 500 (Medium) | `Satoshi-Medium.woff` |
| 700 (Bold) | `Satoshi-Bold.woff` |
| 900 (Black) | `Satoshi-Black.woff` |
| 400 italic | `Satoshi-Italic.woff` |

```css
@font-face {
  font-family: 'Satoshi';
  font-weight: 400;
  font-style: normal;
  font-display: swap;
  src: url('/fonts/satoshi/Satoshi-Regular.woff') format('woff');
}
/* ... các weight khác ... */
```

## Files đã cập nhật

- `src/btc-chart/btc-chart.css`
- `src/sui-deepbook-predict/predict.css`
- `src/deepbook-predict/deepbook-predict.css`

## Lưu ý

- File từ font.download là `.woff` (không phải `.woff2`). `.woff` nhỏ hơn `.woff2`
  một chút về nén nhưng tương thích rộng và đủ tốt cho self-host.
- `font-display: swap` đảm bảo text hiển thị ngay với fallback font trong khi
  Satoshi đang tải.
- Font stack fallback: `'Satoshi', 'Avenir Next', Avenir, ui-sans-serif, system-ui, ...`
  nên nếu font lỗi, UI vẫn hiển thị bình thường.
- File `public/fonts/satoshi/style.css` và `example.html` (từ font.download) không
  được dùng — có thể xóa nếu muốn gọn.
