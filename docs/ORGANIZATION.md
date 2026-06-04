# Documentation Organization

This repo keeps `docs/` as both a project harness and an Obsidian-style
knowledge vault. Prefer clear folder roles over moving legacy documents without
updating every wiki link.

## Folder Roles

| Area | Use for | Examples |
| --- | --- | --- |
| Root harness | How to work in the repo | `README.md`, `HARNESS.md`, `FEATURE_INTAKE.md`, `ARCHITECTURE.md`, `TEST_MATRIX.md`, `QMD.md` |
| Root project guide | Cross-cutting repo maps | `project-overview.md`, `repo-map.md`, `runtime-entry-points.md`, `development-workflow.md` |
| Root plugin architecture | Shared plugin/runtime design | `plugin-architecture.md`, `plugin-wasm.md`, `plugin-sui-wallet.md`, `wasm-native.md` |
| `product/` | Stable product truth | Predict Club contracts, funding, architecture |
| `stories/` | Scoped plans and work packets | Story plans, roadmap slices, implementation packets |
| `decisions/` | Durable decisions and tradeoffs | Architecture decisions, funding/escrow decisions |
| `demo/` | Minimal harness flow example | Request to intake, product, story, decision, validation |
| `templates/` | Reusable writing formats | Story, decision, validation templates |
| Domain folders | Technical depth by domain | `deepbook/`, `defi/navi/`, `seal/`, `walrus/`, `zklogin/`, `contracts/` |
| Design artifacts | Generated UI references and static previews | `stitch_predict_club_trading_terminal/` |

## Language Policy

- English source docs use `*.md`.
- Vietnamese translations use `*.vi.md` beside the source document.
- If a source document is mixed English/Vietnamese, normalize the source `.md`
  toward English first, then create or update the `.vi.md` translation.
- Use `TERMINOLOGY.vi.md` when editing Vietnamese docs.

## Indexing Policy

QMD should index the full `docs/` tree with:

```text
Collection: profile-docs
Path: docs/
Pattern: **/*.md
```

The index intentionally includes both English and Vietnamese Markdown files.
This lets agents search by either language while keeping source/translation
pairs discoverable.

## When Adding New Docs

1. Put stable product truth in `product/`.
2. Put scoped implementation plans in `stories/`.
3. Put durable tradeoffs in `decisions/`.
4. Put deep technical notes in the matching domain folder.
5. Add a `*.vi.md` translation when the document is useful to Vietnamese readers.
6. Update `README.md`, `INDEX.md`, or a folder README if the new doc is a main
   navigation point.
7. Run `qmd update` after adding or moving docs.

## Demo Policy

`demo/` is not product truth. It is a small executable reading example for
agents learning the harness flow. Real implementation work should still use
`product/`, `stories/`, `decisions/`, and validation records.

## Move Policy

Do not move legacy root docs just to make the tree look cleaner. Move a document
only when:

- the destination folder is clearly more accurate,
- all wiki links and relative links are updated,
- QMD is refreshed after the move,
- and the move does not hide an important navigation entry from `INDEX.md`.

Before moving root-level Markdown files, update `ROOT_DOC_AUDIT.md`.
