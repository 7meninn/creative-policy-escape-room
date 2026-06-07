# Copilot MCP Setup

This phase adds a local Model Context Protocol server for GitHub Copilot in VS
Code. It is optional and credential-free by default. The browser game still runs
with `npm run dev`.

## What The Server Provides

The workspace MCP config is checked in at `.vscode/mcp.json` and starts:

```bash
npm run -s mcp:stdio
```

Tools:

- `generate_room`: generates one cited synthetic room draft with verifier output.
- `create_policy_puzzle`: creates or selects a cited supported puzzle shape.
- `validate_answer`: validates sequence, classification, or redaction answers.
- `explain_citation`: resolves citation and source-section metadata.
- `export_escape_room`: exports room pack, citation report, debrief, or trace JSON.

## VS Code / Copilot Steps

1. Open this repository folder in VS Code.
2. Install dependencies with `npm install`.
3. Enable GitHub Copilot Chat.
4. Open the MCP servers view or Copilot Agent Mode tool list.
5. Trust/start the `policy-escape-room` workspace MCP server.
6. Ask Copilot to use the Policy Escape Room tools.

Example prompts:

```text
Use the policy-escape-room MCP tools to generate a room from SYN-POL-005 for the MFA requirement. Show the citations and verifier result.
```

```text
Use policy-escape-room.validate_answer to check puzzle-inbox-sequence with answer ["identify","portal","phone"].
```

```text
Use policy-escape-room.explain_citation for CIT-PHISH-31 and summarize why it supports the Inbox Vault puzzle.
```

```text
Use policy-escape-room.export_escape_room to produce a citation_report_json artifact.
```

## Safety Boundary

- The tools use synthetic demo policy content only.
- The default retrieval path is `local_mock`.
- No `.env.local`, credentials, tenant data, uploads, or real policy documents
  are required.
- Tool requests that look like prompt injection or real secrets fail closed.
- Foundry IQ remains optional and server-side only through the existing local
  proxy; credentials are never exposed through MCP responses.

## Troubleshooting

- If tools do not appear, confirm VS Code opened the repository root and
  `.vscode/mcp.json` is visible.
- If the server fails to start, run `npm run mcp:stdio` from a terminal and fix
  dependency or TypeScript errors.
- If Copilot reports invalid tool input, simplify the request to one tool call
  and include known IDs such as `SYN-POL-005`, `MFA requirement`, or
  `CIT-PHISH-31`.
