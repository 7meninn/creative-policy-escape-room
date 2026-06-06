# Policy Escape Room

[![CI](https://github.com/7meninn/creative-policy-escape-room/actions/workflows/ci.yml/badge.svg)](https://github.com/7meninn/creative-policy-escape-room/actions/workflows/ci.yml)

Playable browser game for the Agents League Creative Apps track. Phase 2 makes
the game data-driven with validated synthetic policy JSON, deterministic local
mock retrieval, and a visible `GameTrace`.

## What works

- Three playable rooms: Inbox Vault, Data Locker, and AI Lab Door.
- Canonical room and policy data in JSON under
  `data/synthetic-policy-packs/synthetic-cybersecurity-onboarding/`.
- Runtime schema validation with citation and source-section checks.
- Deterministic `local_mock` retrieval over the synthetic policy pack.
- Inventory, puzzle console, progress map, citation drawer, score, hints, and final debrief.
- Collapsible trace panel showing retrieval mode, validation status, citation
  checks, answer validation events, and recent retrieval queries.
- No AI, no Foundry IQ, no MCP, and no credentials required.

## Run locally

```bash
npm install
npm run dev
```

Open the local Vite URL shown in the terminal.

## Game path

1. Enter the Inbox Vault and solve the phishing response sequence.
2. Classify artifacts in the Data Locker.
3. Redact unsafe AI prompt fragments in the AI Lab Door.
4. Review the final debrief and citation report.

## Data-driven mock mode

The app intentionally uses `local_mock` retrieval in this phase. The retrieval
adapter reads only synthetic JSON policy sources and returns deterministic
`EvidenceBundle` objects with snippets, citations, confidence, safety flags, and
`retrievalMode: "local_mock"`.

The room pack validator checks that:

- every puzzle has citations,
- clue and hint citation IDs resolve,
- citation source and section IDs exist in the policy source pack,
- duplicate citation IDs fail validation,
- uncited puzzles fail closed.

## Verify

```bash
npm run build
npm run lint
npm run test
npm audit --audit-level=moderate
```

## Synthetic data note

This phase uses synthetic demo content created for the Agents League hackathon.
It contains no real company policy, customer data, employee data, tenant content,
or confidential information.
