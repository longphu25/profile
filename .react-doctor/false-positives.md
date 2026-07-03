# React Doctor false positives

Patterns listed here are dropped during agent triage (`/doctor` playbook Step 2).
Add entries only after verifying the code shape with grep or Read.

## Format

```
- plugin/rule - <code shape> - <why it is safe to ignore>
```

## Verified suppressions

- react-doctor/public-env-secret-name - `VITE_TURSO_DB_READ_TOKEN` / `VITE_TURSO_DB_TOKEN` in `plugins/btc-chart/lib/turso.ts` - Read-only Turso HTTP token for public coin list; documented in file header, no write ops from client.