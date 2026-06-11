# Product Contract

This folder holds stable product-facing truth. The current product contract is
distributed across existing root notes and domain docs.

## Current Product Maps

- `../project-overview.md`: repo purpose and major system layers.
- `../repo-map.md`: source tree and onboarding map.
- `../runtime-entry-points.md`: HTML/React entry points and their roles.
- `../plugin-catalog.md`: plugin catalog by domain.
- `../development-workflow.md`: development and documentation conventions.

## Domain Contracts

- Predict Club: `predict-club.md`
- Predict Club Architecture: `predict-club-architecture.md`
- Predict Club Escrow Contract: `predict-club-escrow-contract.md`
- Predict Club Funding: `predict-club-funding.md`
- Predict Club UI Motion: `predict-club-ui-motion.md`
- Predict Club UI Requirements: `predict-club-ui-requirements.md`
- DeepBook: `../deepbook/README.md`
- NAVI: `../defi/navi/TECHNICAL.md`
- Seal: `../seal/TECHNICAL.md`
- Walrus: `../walrus/integration.md`
- zkLogin/ZK Merkle: `../zklogin/TECHNICAL.md`

When a product behavior becomes stable, summarize it here or link the exact
domain doc that owns it.

## Predict Club UI Source Of Truth

Use `predict-club-ui-requirements.md` before changing the Predict Club surface.
It owns the expected layout, panel responsibilities, wallet/address behavior,
error states, and minimum validation checks. Implementation plans should link
back to it rather than redefining the UI contract.
