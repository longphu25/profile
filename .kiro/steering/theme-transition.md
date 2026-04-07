---
inclusion: manual
---

# Wavy Circle Theme Transition Effect

Hiệu ứng chuyển đổi Light/Dark mode với View Transitions API — vòng tròn gợn sóng mở rộng từ vị trí click.

## File tham khảo

- `src/hooks/useTheme.ts` — React hook implementation

## Cách hoạt động

Animation chia làm 3 phase:

1. **Phase 1 (0-30%)**: Vòng tròn wavy mở rộng từ 0 đến ~50% viewport
2. **Phase 2 (30-60%)**: Dừng lại ở giữa, sóng gợn lên xuống tạo hiệu ứng "thở"  
3. **Phase 3 (60-100%)**: Mở rộng ra full screen, sóng fade dần

## Config có thể điều chỉnh

```ts
const CONFIG = {
  duration: 1200,           // Tổng thời gian animation (ms)
  midRadiusRatio: 0.5,      // Kích thước vòng tròn khi dừng giữa (0.5 = 50% viewport)
  midRadiusMultiplier: 1.25,// Nhân thêm cho mid radius
  waveAmplitudeStart: 20,   // Biên độ sóng ban đầu
  waveAmplitudeMiddle: 30,  // Biên độ sóng max ở giữa
  waveAmplitudeEnd: 25,     // Biên độ sóng khi mở rộng cuối
  waveFrequency: 3,         // Số sóng quanh vòng tròn
  phase1End: 0.3,           // Kết thúc phase 1
  phase2End: 0.6,           // Kết thúc phase 2
}
```

## Kỹ thuật chính

- Dùng `polygon()` với 72 điểm tạo đường viền wavy
- 2 lớp sóng chồng nhau (`wave + wave2`) cho cảm giác organic
- `easeOutCubic` cho chuyển động mượt
- `flushSync` từ React để đồng bộ DOM với View Transition
- Fallback cho browser không hỗ trợ View Transitions API

## CSS cần thiết

```css
::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
  mix-blend-mode: normal;
}
::view-transition-old(root) {
  z-index: 1;
}
::view-transition-new(root) {
  z-index: 9999;
}
```

## Browser support

- Chrome/Edge 111+
- Safari 18+
- Firefox: chưa hỗ trợ (sẽ fallback về instant switch)
