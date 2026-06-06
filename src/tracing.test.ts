import { describe, expect, it } from "vitest";
import { roomPackValidation } from "./data/rooms";
import { retrievePolicyEvidence } from "./retrieval/localMock";
import {
  appendRetrieval,
  appendRetrievalResult,
  appendTraceEvent,
  createInitialTrace
} from "./tracing";

describe("GameTrace", () => {
  it("starts with a pack-loaded validation event", () => {
    const trace = createInitialTrace(roomPackValidation, "local_mock");

    expect(trace.retrievalMode).toBe("local_mock");
    expect(trace.retrievalStatus).toBe("local_mock");
    expect(trace.validation.valid).toBe(true);
    expect(trace.events[0].type).toBe("pack_loaded");
  });

  it("records retrieval, hint, and answer validation events", () => {
    const trace = createInitialTrace(roomPackValidation, "local_mock");
    const withRetrieval = appendRetrieval(
      trace,
      retrievePolicyEvidence("classification levels"),
      "Room evidence retrieved"
    );
    const withHint = appendTraceEvent(withRetrieval, {
      type: "hint_revealed",
      label: "Storage citation",
      detail: "The policy requires protected storage.",
      roomId: "data-locker",
      puzzleId: "puzzle-data-classification",
      citationIds: ["CIT-DATA-33"]
    });
    const withAnswer = appendTraceEvent(withHint, {
      type: "answer_validated",
      label: "Wrong answer",
      detail: "A drawer buzzes.",
      roomId: "data-locker",
      puzzleId: "puzzle-data-classification",
      correct: false
    });

    expect(withAnswer.recentRetrievals).toHaveLength(1);
    expect(withAnswer.events.map((event) => event.type)).toEqual([
      "answer_validated",
      "hint_revealed",
      "retrieval",
      "pack_loaded"
    ]);
  });

  it("records Foundry fallback status and trace events", () => {
    const trace = createInitialTrace(roomPackValidation, "foundry_iq", "foundry_iq");
    const evidence = retrievePolicyEvidence("mfa requirement");
    const withFallback = appendRetrievalResult(
      trace,
      {
        evidence,
        status: "foundry_iq_fallback",
        latencyMs: 12,
        citationMappingCount: evidence.citations.length,
        fallbackReason: "Foundry IQ retrieval failed; local mock evidence was used.",
        error: "403"
      },
      "Citation evidence retrieved"
    );

    expect(withFallback.retrievalStatus).toBe("foundry_iq_fallback");
    expect(withFallback.events.map((event) => event.type).slice(0, 3)).toEqual([
      "retrieval_fallback",
      "retrieval_failed",
      "retrieval"
    ]);
  });
});
