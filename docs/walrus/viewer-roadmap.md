# Walrus Viewer Plugin — Feature Roadmap

## Current Features (v1.1)
- [x] View blob by ID (paste blob ID → fetch → preview)
- [x] Image preview (PNG, JPEG, GIF, WebP)
- [x] Text/JSON preview
- [x] Download file
- [x] Open in browser
- [x] My Blobs (owned blob objects from wallet)
- [x] Uploaded blobs (from walrus-upload shared data)
- [x] View history
- [x] Network-aware aggregator (mainnet/testnet)
- [x] Magic bytes content type detection

## Planned Features

### Managing Blobs
- [ ] **Extend lifetime** — extend storage epochs for owned blobs
- [ ] **Delete blobs** — delete deletable blobs (owner only)
- [ ] **Burn blobs** — burn blob objects
- [ ] **Shared blobs** — view/manage shared blob objects
- [ ] **Set blob attributes** — add metadata attributes to blobs
- [ ] **Get blob attributes** — read blob attributes
- [ ] **Remove blob attributes** — delete blob attributes

### Reading
- [ ] **Read blobs** — read via SDK (not just aggregator HTTP)
- [ ] **Check consistency** — verify blob integrity on storage nodes
- [ ] **Read quilt files** — extract files from quilt containers
- [ ] **Store as quilt** — upload multiple files as a quilt

### UI Structure (Tabs)
```
┌─────────┬──────────┬──────────┬──────────┐
│  View   │ My Blobs │  Manage  │  Quilts  │
└─────────┴──────────┴──────────┴──────────┘
```

- **View**: paste blob ID → preview (current)
- **My Blobs**: owned blobs + uploaded blobs + status
- **Manage**: extend, delete, burn, attributes (needs wallet)
- **Quilts**: read quilt files, store as quilt

### API Reference

**Extend blob:**
```ts
// CLI: walrus blob-extend --blob-id <ID> --epochs <N>
// SDK: not yet available, use Move call
tx.moveCall({
  target: `${walrusPackage}::blob::extend`,
  arguments: [systemObj, blobObj, extraEpochs],
})
```

**Delete blob:**
```ts
// CLI: walrus delete --blob-id <ID>
// SDK: not yet available, use Move call
tx.moveCall({
  target: `${walrusPackage}::blob::delete`,
  arguments: [systemObj, blobObj],
})
```

**Burn blob:**
```ts
// CLI: walrus burn-blob --object-id <ID>
// Destroys the blob object, storage remains until expiry
```

**Blob attributes:**
```ts
// CLI: walrus blob-attribute set --blob-id <ID> --key <K> --value <V>
// CLI: walrus blob-attribute get --blob-id <ID> --key <K>
// CLI: walrus blob-attribute remove --blob-id <ID> --key <K>
```

**Read quilt:**
```ts
const blob = await client.walrus.getBlob({ blobId })
const files = await blob.files()
// or by identifier:
const [readme] = await blob.files({ identifiers: ['README.md'] })
```

**Check consistency:**
```ts
// CLI: walrus blob-status --blob-id <ID>
// Returns: certified epoch, storage info, node status
```

### Dependencies
- `@mysten/walrus` SDK for quilt reading
- `@mysten/walrus-wasm` for WASM decoding
- Wallet connection for manage operations (extend, delete, burn, attributes)
- Move call knowledge for on-chain operations

### Implementation Priority
1. My Blobs tab (refactor from current inline section)
2. Manage tab: delete + extend (most useful)
3. Quilts tab: read quilt files
4. Attributes (set/get/remove)
5. Consistency check
6. Shared blobs
7. Burn blobs
