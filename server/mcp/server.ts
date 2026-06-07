import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { pathToFileURL } from "node:url";
import {
  createPolicyPuzzleInputSchema,
  explainCitationInputSchema,
  exportEscapeRoomInputSchema,
  generateRoomInputSchema,
  validateAnswerInputSchema
} from "./schemas";
import { mcpToolHandlers } from "./tools";

export function createPolicyEscapeRoomMcpServer() {
  const server = new McpServer({
    name: "policy-escape-room",
    version: "0.1.0"
  });

  server.registerTool(
    "generate_room",
    {
      title: "Generate Policy Escape Room",
      description:
        "Generate one playable synthetic policy escape-room draft with citations and verifier output.",
      inputSchema: generateRoomInputSchema
    },
    (input) => toMcpResult(mcpToolHandlers.generate_room(input))
  );

  server.registerTool(
    "create_policy_puzzle",
    {
      title: "Create Policy Puzzle",
      description:
        "Create or select a cited policy puzzle using supported escape-room puzzle shapes.",
      inputSchema: createPolicyPuzzleInputSchema
    },
    (input) => toMcpResult(mcpToolHandlers.create_policy_puzzle(input))
  );

  server.registerTool(
    "validate_answer",
    {
      title: "Validate Puzzle Answer",
      description:
        "Validate a sequence, classification, or redaction answer against a known or inline puzzle.",
      inputSchema: validateAnswerInputSchema
    },
    (input) => toMcpResult(mcpToolHandlers.validate_answer(input))
  );

  server.registerTool(
    "explain_citation",
    {
      title: "Explain Citation",
      description:
        "Resolve citation metadata and source-section evidence from the synthetic policy pack.",
      inputSchema: explainCitationInputSchema
    },
    (input) => toMcpResult(mcpToolHandlers.explain_citation(input))
  );

  server.registerTool(
    "export_escape_room",
    {
      title: "Export Escape Room Artifact",
      description:
        "Export room-pack JSON, citation report JSON, debrief Markdown, or trace JSON.",
      inputSchema: exportEscapeRoomInputSchema
    },
    (input) => toMcpResult(mcpToolHandlers.export_escape_room(input))
  );

  return server;
}

export function toMcpResult(result: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2)
      }
    ],
    structuredContent: result as Record<string, unknown>,
    isError:
      typeof result === "object" &&
      result !== null &&
      "status" in result &&
      result.status === "error"
  };
}

async function main() {
  const server = createPolicyEscapeRoomMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Policy Escape Room MCP server running on stdio.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
