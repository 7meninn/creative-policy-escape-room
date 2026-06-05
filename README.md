# Policy Escape Room

[![CI](https://github.com/7meninn/creative-policy-escape-room/actions/workflows/ci.yml/badge.svg)](https://github.com/7meninn/creative-policy-escape-room/actions/workflows/ci.yml)

Static Phase 1 browser game for the Agents League Creative Apps track.

## What works in Phase 1

- Three playable rooms: Inbox Vault, Data Locker, and AI Lab Door.
- Static synthetic policy content only.
- Inventory, puzzle console, progress map, citation drawer, score, hints, and final debrief.
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
