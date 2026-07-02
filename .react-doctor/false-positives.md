# React Doctor false positives

Patterns listed here are dropped during agent triage (`/doctor` playbook Step 2).
Add entries only after verifying the code shape with grep or Read.

## Format

```
- plugin/rule - <code shape> - <why it is safe to ignore>
```