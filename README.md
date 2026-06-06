# Policy Escape Room

[![CI](https://github.com/7meninn/creative-policy-escape-room/actions/workflows/ci.yml/badge.svg)](https://github.com/7meninn/creative-policy-escape-room/actions/workflows/ci.yml)

Playable browser game for the Agents League Creative Apps track. The game is
data-driven with validated synthetic policy JSON, deterministic local mock
retrieval, deterministic generated-room agents, optional Foundry IQ retrieval,
and a visible `GameTrace`.

## What works

- Three playable rooms: Inbox Vault, Data Locker, and AI Lab Door.
- Canonical room and policy data in JSON under
  `data/synthetic-policy-packs/synthetic-cybersecurity-onboarding/`.
- Runtime schema validation with citation and source-section checks.
- Deterministic `local_mock` retrieval over the synthetic policy pack.
- Inventory, puzzle console, progress map, citation drawer, score, hints, and final debrief.
- Collapsible trace panel showing retrieval mode, validation status, citation
  checks, answer validation events, and recent retrieval queries.
- Creator Mode for `generated_mock` room drafts from local synthetic policy
  sources.
- Optional `foundry_iq` mode through a local Node proxy.
- No MCP, no uploads, and no credentials required for the default demo.

## Run locally

```bash
npm install
npm run dev
```

Open the local Vite URL shown in the terminal.

## Optional Foundry IQ Mode

Phase 4 can retrieve evidence from a Foundry IQ knowledge base built from the
same synthetic policy pack. It is optional; `local_mock` remains the reliable
default.

1. Follow [docs/foundry-iq-setup.md](docs/foundry-iq-setup.md).
2. Copy `.env.example` to `.env.local` and set the Foundry IQ values.
3. Authenticate with `az login` or service-principal environment variables.
4. Run:

```bash
npm run dev:foundry
```

The browser calls `POST /api/retrieve-policy-evidence` on the local proxy. The
proxy uses server-side `DefaultAzureCredential` and maps Foundry IQ references
back into the existing `EvidenceBundle` and citation format.

If configuration, auth, network access, or citation mapping fails, the trace
panel shows `foundry_iq fallback` and the app continues with deterministic
synthetic local evidence.

## Game path

1. Enter the Inbox Vault and solve the phishing response sequence.
2. Classify artifacts in the Data Locker.
3. Redact unsafe AI prompt fragments in the AI Lab Door.
4. Review the final debrief and citation report.

## Creator Mode

Creator Mode demonstrates the Phase 3 local agent pipeline without credentials
or model calls.

1. Open **Creator Mode** from the lobby.
2. Keep the default `SYN-POL-005 Password And MFA Policy` and `MFA requirement`.
3. Select **Generate Draft**.
4. Review the generated Identity Gatehouse room, agent steps, verifier result,
   and citations.
5. Select **Play Generated Room** to play the one-room generated draft.
6. Select **Export JSON** to download the generated room pack.

The deterministic local agents are:

- Source Curator
- Room Designer
- Puzzle Maker
- Verifier
- Debrief Writer

## Data-driven mock mode

The app intentionally uses `local_mock` retrieval in this phase. The retrieval
adapter reads only synthetic JSON policy sources and returns deterministic
`EvidenceBundle` objects with snippets, citations, confidence, safety flags, and
`retrievalMode: "local_mock"`.

Generated rooms use `retrievalMode: "generated_mock"` and are verified with the
same citation/source-section checks as the static room pack.

`foundry_iq` mode uses the same public TypeScript retrieval shape, but routes
through the local proxy so credentials are never exposed to the browser.

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
