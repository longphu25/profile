# DeepBook Predict — Regression Checklist

Run before every commit that touches `plugins/sui-deepbook-predict/`.

## Build

```bash
bunx vite build 2>&1 | tail -5
```

Must exit 0 with no errors.

## Domain Tests

```bash
bun test plugins/sui-deepbook-predict/domain/
```

All tests must pass (currently 16).

## Scoped TypeScript Check

```bash
bunx tsc --noEmit --project tsconfig.app.json 2>&1 | grep -c 'error' || echo 0
```

Zero errors in Predict plugin files. Pre-existing errors in unrelated plugins are acceptable.

## HTTP Smoke Check

```bash
bun run dev &
sleep 3
curl -sf http://localhost:5173/deepbook.html | grep -q 'deepbook' && echo OK || echo FAIL
curl -sf http://localhost:5173/sui-deepbook-predict.html | grep -q 'predict' && echo OK || echo FAIL
kill %1
```

Both pages must return HTML containing their expected markers.

## Visual QA Chart

Open `http://localhost:5173/sui-deepbook-predict.html` and verify:

- [ ] Chart renders price line (not blank)
- [ ] Feed status shows "Live" (green chip) when oracle is active
- [ ] Click in binary mode fills strike + direction
- [ ] Drag in range mode fills lower/upper strikes
- [ ] Open position overlays track pan/zoom
- [ ] Wallet disconnect: chart still renders (without overlays)
- [ ] Mobile (375px): chart + form don't overlap, no horizontal scroll
