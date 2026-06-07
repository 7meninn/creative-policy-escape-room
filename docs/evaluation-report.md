# Phase 6 Evaluation Report

This report summarizes the local reliability, safety, accessibility, and
grounding checks added for Phase 6. The app still uses synthetic demo content
only, and the default demo remains credential-free.

## Verification Commands

Latest local Phase 6 verification:

| Check | Result |
|---|---|
| `npm run lint` | Passed |
| `npm run test` | Passed, 66 tests across 16 files |
| `npm run build` | Passed |
| `npm run safety:scan` | Passed |
| `npm run eval:run` | Runs safety scan, lint, tests, and build |
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
- Microsoft IQ integration: optional Foundry IQ retrieval mode with documented
  setup and safe local fallback.
- Creative application: browser-playable policy escape room with citations,
  trace, Creator Mode, and Copilot MCP tools.
- Safety: synthetic-only policy pack, deterministic local mock mode, scanner,
  verifier, citation checks, and no committed credentials.

## Honest Limitations

- Live Foundry IQ requires local Azure/Foundry configuration and is optional for
  judging; local mock remains the reliable default.
- The app is a learning demo and is not formal compliance proof.
- Phase 7 still needs final submission polish: screenshots, demo video,
  architecture diagram, judging table, and Copilot usage log.
