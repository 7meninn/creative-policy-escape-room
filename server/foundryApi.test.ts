import type { AddressInfo } from "node:net";
import { describe, expect, it, vi } from "vitest";
import { createFoundryApiServer } from "./foundryApi";
import type { FoundryRetrievalOptions } from "./foundry/retrieval";

interface ApiPayload {
  status: string;
  evidence: {
    retrievalMode: string;
    citations: Array<{ sectionId: string }>;
  };
  error?: string;
}

const env = {
  FOUNDRY_IQ_SEARCH_ENDPOINT: "https://example.search.windows.net",
  FOUNDRY_IQ_KNOWLEDGE_BASE: "synthetic-kb"
};

describe("Foundry IQ API proxy", () => {
  it("validates retrieval request input", async () => {
    await withServer({}, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/retrieve-policy-evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "" })
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        error: "Invalid retrieval request"
      });
    });
  });

  it("rejects malformed JSON request bodies", async () => {
    await withServer({}, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/retrieve-policy-evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{"
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        error: "Invalid JSON request body"
      });
    });
  });

  it("returns foundry_iq evidence through POST when retrieval succeeds", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          references: [
            {
              sourceData: {
                id: "SYN-POL-005#2.1",
                content:
                  "## Section SYN-POL-005#2.1 - Password Reuse\nSection ID: 2.1"
              }
            }
          ]
        }),
        { status: 200 }
      )
    ) as unknown as typeof fetch;

    await withServer(
      { env, fetchImpl, getAccessToken: async () => "fake-token" },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/retrieve-policy-evidence`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: "password reuse" })
        });
        const payload = (await response.json()) as ApiPayload;

        expect(response.status).toBe(200);
        expect(payload.status).toBe("foundry_iq");
        expect(payload.evidence.retrievalMode).toBe("foundry_iq");
        expect(payload.evidence.citations[0].sectionId).toBe("2.1");
      }
    );
  });

  it("returns fallback evidence through POST when retrieval fails", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("missing", { status: 404 })
    ) as unknown as typeof fetch;

    await withServer(
      { env, fetchImpl, getAccessToken: async () => "fake-token" },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/retrieve-policy-evidence`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: "phishing reporting" })
        });
        const payload = (await response.json()) as ApiPayload;

        expect(response.status).toBe(200);
        expect(payload.status).toBe("foundry_iq_fallback");
        expect(payload.evidence.retrievalMode).toBe("local_mock");
      }
    );
  });
});

async function withServer(
  options: FoundryRetrievalOptions,
  assertion: (baseUrl: string) => Promise<void>
) {
  const server = createFoundryApiServer(options);

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  const { port } = server.address() as AddressInfo;

  try {
    await assertion(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}
