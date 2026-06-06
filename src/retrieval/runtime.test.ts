import { describe, expect, it } from "vitest";
import {
  getRetrievalRuntimeConfig,
  retrievePolicyEvidenceRuntime
} from "./runtime";

describe("retrieval runtime", () => {
  it("defaults to local_mock when no Vite mode is requested", () => {
    expect(getRetrievalRuntimeConfig({} as ImportMetaEnv)).toEqual({
      mode: "local_mock",
      apiUrl: "http://localhost:8787/api/retrieve-policy-evidence"
    });
  });

  it("returns local mock evidence without calling the API in local mode", async () => {
    const result = await retrievePolicyEvidenceRuntime(
      "phishing reporting",
      {},
      {
        mode: "local_mock",
        apiUrl: "http://localhost:8787/api/retrieve-policy-evidence"
      }
    );

    expect(result.status).toBe("local_mock");
    expect(result.evidence.retrievalMode).toBe("local_mock");
    expect(result.evidence.sources).toContain("SYN-POL-002");
  });
});
