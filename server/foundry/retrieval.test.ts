import { describe, expect, it, vi } from "vitest";
import {
  retrievalRequestSchema,
  retrieveWithFoundryFallback
} from "./retrieval";

const env = {
  FOUNDRY_IQ_SEARCH_ENDPOINT: "https://example.search.windows.net",
  FOUNDRY_IQ_KNOWLEDGE_BASE: "synthetic-kb",
  FOUNDRY_IQ_KNOWLEDGE_SOURCE_NAME: "synthetic-ks"
};

describe("retrieveWithFoundryFallback", () => {
  it("returns foundry_iq evidence for a successful mocked retrieve call", async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(
        JSON.stringify({
          activity: [{ type: "searchIndex", id: 0 }],
          references: [
            {
              id: "0",
              docKey: "SYN-POL-002#3.1",
              sourceData: {
                id: "SYN-POL-002#3.1",
                content:
                  "## Section SYN-POL-002#3.1 - Reporting Window\nSection ID: 3.1"
              }
            }
          ]
        }),
        { status: 200 }
      )
    );
    const fetchImpl = fetchSpy as unknown as typeof fetch;

    const result = await retrieveWithFoundryFallback(
      { query: "phishing reporting", filters: { sourceIds: ["SYN-POL-002"] } },
      {
        env,
        fetchImpl,
        getAccessToken: async () => "fake-token"
      }
    );

    expect(result.status).toBe("foundry_iq");
    expect(result.evidence.retrievalMode).toBe("foundry_iq");
    expect(result.evidence.citations[0].sectionId).toBe("3.1");
    expect(fetchSpy).toHaveBeenCalledOnce();
    const firstCall = fetchSpy.mock.calls[0] as unknown[];
    expect(String(firstCall[0])).toContain(
      "/knowledgebases('synthetic-kb')/retrieve"
    );
  });

  it("falls back to local mock evidence when Foundry returns an error", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("forbidden", { status: 403 })
    ) as unknown as typeof fetch;

    const result = await retrieveWithFoundryFallback(
      { query: "classification levels" },
      {
        env,
        fetchImpl,
        getAccessToken: async () => "fake-token"
      }
    );

    expect(result.status).toBe("foundry_iq_fallback");
    expect(result.evidence.retrievalMode).toBe("local_mock");
    expect(result.evidence.safetyFlags).toContain("foundry_iq_fallback");
    expect(result.error).toContain("403");
  });

  it("falls back to local mock evidence when config is missing", async () => {
    const result = await retrieveWithFoundryFallback(
      {
        query: "password reuse",
        filters: { sourceIds: ["SYN-POL-005"] }
      },
      { env: {} }
    );

    expect(result.status).toBe("foundry_iq_fallback");
    expect(result.fallbackReason).toContain("configuration is incomplete");
    expect(result.evidence.sources).toContain("SYN-POL-005");
  });

  it("validates API retrieval request input", () => {
    expect(
      retrievalRequestSchema.safeParse({
        query: "mfa",
        filters: { limit: 2 }
      }).success
    ).toBe(true);
    expect(retrievalRequestSchema.safeParse({ query: "" }).success).toBe(false);
  });
});
