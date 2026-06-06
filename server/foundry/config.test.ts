import { describe, expect, it } from "vitest";
import { FoundryConfigError, readFoundryIqConfig } from "./config";

describe("readFoundryIqConfig", () => {
  it("accepts complete Foundry IQ configuration", () => {
    const config = readFoundryIqConfig({
      FOUNDRY_IQ_SEARCH_ENDPOINT: "https://example.search.windows.net/",
      FOUNDRY_IQ_KNOWLEDGE_BASE: "synthetic-kb",
      FOUNDRY_IQ_KNOWLEDGE_SOURCE_NAME: "synthetic-ks",
      FOUNDRY_IQ_API_VERSION: "2026-05-01-preview",
      FOUNDRY_IQ_MAX_OUTPUT_TOKENS: "900",
      FOUNDRY_IQ_MAX_RUNTIME_SECONDS: "9"
    });

    expect(config).toEqual({
      searchEndpoint: "https://example.search.windows.net",
      knowledgeBase: "synthetic-kb",
      knowledgeSourceName: "synthetic-ks",
      apiVersion: "2026-05-01-preview",
      maxOutputSizeInTokens: 900,
      maxRuntimeInSeconds: 9
    });
  });

  it("rejects incomplete Foundry IQ configuration", () => {
    expect(() => readFoundryIqConfig({})).toThrow(FoundryConfigError);
  });
});
