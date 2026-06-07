import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { describe, expect, it } from "vitest";
import { toMcpResult } from "./server";

describe("Policy Escape Room MCP server", () => {
  it("wraps tool results as JSON text and structured content", () => {
    const result = toMcpResult({
      toolName: "explain_citation",
      status: "success"
    });

    expect(result.content[0].type).toBe("text");
    if (result.content[0].type === "text") {
      expect(result.content[0].text).toContain("explain_citation");
    }
    const structured = result.structuredContent as { status?: string };
    expect(structured.status).toBe("success");
    expect(result.isError).toBe(false);
  });

  it("lists tools and calls generate_room over stdio", async () => {
    const transport = new StdioClientTransport({
      command: process.platform === "win32" ? "npm.cmd" : "npm",
      args: ["run", "-s", "mcp:stdio"],
      cwd: process.cwd(),
      stderr: "pipe"
    });
    const client = new Client({
      name: "policy-escape-room-test-client",
      version: "0.1.0"
    });

    try {
      await client.connect(transport);
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toEqual(
        expect.arrayContaining([
          "generate_room",
          "create_policy_puzzle",
          "validate_answer",
          "explain_citation",
          "export_escape_room"
        ])
      );

      const result = await client.callTool({
        name: "generate_room",
        arguments: {
          sourceId: "SYN-POL-005",
          concept: "MFA requirement"
        }
      });

      expect(result.isError).toBe(false);
      const structured = result.structuredContent as {
        status?: string;
        retrievalStatus?: string;
      };
      expect(structured.status).toBe("success");
      expect(structured.retrievalStatus).toBe("generated_mock");
    } finally {
      await client.close();
    }
  }, 30000);
});
