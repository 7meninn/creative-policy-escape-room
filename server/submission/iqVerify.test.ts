import { describe, expect, it, vi } from "vitest";
import type { Citation, EvidenceBundle, RetrievalRuntimeResult } from "../../src/types";
import {
  missingLiveIqEnv,
  verifyLiveFoundryIq
} from "./iqVerify";

const completeEnv = {
  FOUNDRY_IQ_SEARCH_ENDPOINT: "https://example.search.windows.net",
  FOUNDRY_IQ_KNOWLEDGE_BASE: "synthetic-kb",
  FOUNDRY_IQ_API_VERSION: "2026-05-01-preview"
};

const mfaCitation: Citation = {
  citationId: "FDRY-SYN-POL-005-1-1",
  sourceId: "SYN-POL-005",
  sectionId: "1.1",
  label: "Password And MFA Policy, section 1.1",
  snippet:
    "Accounts that access sensitive systems must use multifactor authentication.",
  concept: "MFA requirement"
};

function liveEvidence(citations: Citation[] = [mfaCitation]): EvidenceBundle {
  return {
    query: "mfa requirement",
    sources: citations.map((citation) => citation.sourceId),
    snippets: citations.map((citation) => ({
      sourceId: citation.sourceId,
      sectionId: citation.sectionId,
      title: citation.concept,
      snippet: citation.snippet,
      concepts: [citation.concept]
    })),
    citations,
    retrievalMode: "foundry_iq",
    confidence: 0.91,
    safetyFlags: ["foundry_activity_present"]
  };
}

function liveResult(
  overrides: Partial<RetrievalRuntimeResult> = {}
): RetrievalRuntimeResult {
  return {
    evidence: liveEvidence(),
    status: "foundry_iq",
    latencyMs: 37,
    citationMappingCount: 1,
    ...overrides
  };
}

describe("verifyLiveFoundryIq", () => {
  it("passes only when live Foundry IQ evidence and trace proof are present", async () => {
    const retrieve = vi.fn(async () => liveResult());

    const result = await verifyLiveFoundryIq({
      env: completeEnv,
      retrieve
    });

    expect(result.status).toBe("passed");
    expect(result.trace.retrievalStatus).toBe("foundry_iq");
    expect(result.trace.events[0]).toMatchObject({
      type: "retrieval",
      label: "Submission IQ verification"
    });
    expect(result.citations[0].sourceId).toBe("SYN-POL-005");
    expect(retrieve).toHaveBeenCalledOnce();
  });

  it("fails when required live IQ environment values are missing", async () => {
    const retrieve = vi.fn(async () => liveResult());

    await expect(
      verifyLiveFoundryIq({
        env: {
          FOUNDRY_IQ_SEARCH_ENDPOINT: "https://example.search.windows.net",
          FOUNDRY_IQ_KNOWLEDGE_BASE: "synthetic-kb"
        },
        retrieve
      })
    ).rejects.toThrow("FOUNDRY_IQ_API_VERSION");
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("fails when Foundry falls back to local mock evidence", async () => {
    await expect(
      verifyLiveFoundryIq({
        env: completeEnv,
        retrieve: vi.fn(async () =>
          liveResult({
            status: "foundry_iq_fallback",
            fallbackReason: "Foundry IQ retrieval failed; local mock evidence was used."
          })
        )
      })
    ).rejects.toThrow("received 'foundry_iq_fallback'");
  });

  it("fails when Foundry citations do not resolve to synthetic policy sections", async () => {
    const unresolvedCitation = {
      ...mfaCitation,
      citationId: "FDRY-SYN-POL-999-9-9",
      sourceId: "SYN-POL-999",
      sectionId: "9.9"
    };

    await expect(
      verifyLiveFoundryIq({
        env: completeEnv,
        retrieve: vi.fn(async () =>
          liveResult({
            evidence: liveEvidence([unresolvedCitation])
          })
        )
      })
    ).rejects.toThrow("unresolved synthetic citations");
  });
});

describe("missingLiveIqEnv", () => {
  it("requires endpoint, knowledge base, and explicit API version", () => {
    expect(missingLiveIqEnv(completeEnv)).toEqual([]);
    expect(missingLiveIqEnv({})).toEqual([
      "FOUNDRY_IQ_SEARCH_ENDPOINT",
      "FOUNDRY_IQ_KNOWLEDGE_BASE",
      "FOUNDRY_IQ_API_VERSION"
    ]);
  });
});
