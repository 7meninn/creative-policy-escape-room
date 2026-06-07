# Phase 6 Evaluation Report

This report summarizes the local reliability, safety, accessibility, and
grounding checks added for Phase 6, plus the Phase 7 live-IQ submission gate.
The app still uses synthetic demo content only.

## Verification Commands

Latest local Phase 6 verification:

| Check | Result |
|---|---|
| `npm run lint` | Passed |
| `npm run test` | Passed, 71 tests across 17 files |
| `npm run build` | Passed |
| `npm run safety:scan` | Passed |
| `npm run eval:run` | Runs safety scan, lint, tests, and build |
| `npm run iq:verify` | Requires live Foundry IQ and fails on fallback |
| `npm run submission:check` | Runs local gates plus live IQ verification |
| `npm audit --audit-level=moderate` | Passed with 0 vulnerabilities |

The GitHub Actions workflow also runs dependency audit, safety scan, lint, test,
and build on pull requests and pushes to `main`.

## Safety Scan Policy

The deterministic scanner checks:

- synthetic demo disclaimers on policy sources and room packs,
- citation coverage for puzzles, clues, and hints,
- text labels and instructions needed for non-color-only play,
- prompt-injection-like text,
- secret-like values,
- PII-like values,
- confidential/proprietary language,
- unsafe legal/compliance claims.

Known approved demo findings:

- blank `.env.example` variable names used to document local setup,
- the intentionally synthetic unsafe-token example in the AI Lab Door,
- the intentionally synthetic account identifier in the AI Lab Door.

Any unapproved warning or error finding fails `npm run safety:scan`.

## Scenario Coverage

Automated scenario tests cover:

- the full three-room happy path reaching the escaped debrief,
- wrong-answer penalty and hint reveal behavior,
- generated-room verification and playability,
- Foundry IQ unavailable fallback to local mock evidence,
- MCP unsafe prompt failure behavior,
- citation/debrief export evidence.

Existing tests continue to cover schemas, room-pack validation, retrieval,
Foundry mapping/fallback, generation agents, verifier behavior, game logic,
tracing, and MCP stdio tool calls.

## Accessibility And Responsive Checks

Automated accessibility-readiness tests check:

- named lobby controls for keyboard/screen-reader discovery,
- score status labeling,
- citation/reset/policy controls exposed as buttons,
- text labels and descriptions for room objects and puzzles,
- classification categories with text labels.

Manual browser checks:

- Desktop in-app browser at approximately `1280x720`: lobby rendered as the
  first screen, core controls visible, retrieval mode visible, no horizontal
  overflow observed.
- Mobile CDP device metrics at `390x844`: `innerWidth` was `390`, page
  `scrollWidth` was `390`, no horizontal overflow, and Enter Room, Creator
  Mode, Trace, Reset, and `local_mock` status were present.

## Track Requirement Evidence

- GitHub Copilot usage: documented through the development process and MCP
  workflow docs.
- Microsoft IQ integration: live Foundry IQ retrieval mode with a hard
  `npm run iq:verify` submission gate. Safe local fallback remains available
  for development and outage resilience, but fallback fails submission
  verification.
- Creative application: browser-playable policy escape room with citations,
  trace, Creator Mode, and Copilot MCP tools.
- Safety: synthetic-only policy pack, deterministic local mock mode, scanner,
  verifier, citation checks, and no committed credentials.

## Honest Limitations

- Live Foundry IQ requires Azure/Foundry configuration on the demo or hosted
  environment before `npm run iq:verify` can pass.
- `local_mock` remains the reliable offline path, but it is not accepted as
  Microsoft IQ submission evidence.
- The app is a learning demo and is not formal compliance proof.
- Final submission still needs captured screenshots, a short demo video, and
  the hosted URL recorded after deployment.
