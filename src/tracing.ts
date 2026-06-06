import type {
  EvidenceBundle,
  GameTrace,
  RetrievalMode,
  RetrievalRuntimeResult,
  RetrievalStatus,
  RoomPackValidationResult,
  TraceEvent
} from "./types";

type TraceEventInput = Omit<TraceEvent, "eventId" | "timestamp">;

export function createInitialTrace(
  validation: RoomPackValidationResult,
  retrievalMode: RetrievalMode,
  retrievalStatus: RetrievalStatus = retrievalMode === "generated_mock"
    ? "generated_mock"
    : retrievalMode === "foundry_iq"
      ? "foundry_iq"
      : "local_mock"
): GameTrace {
  const trace: GameTrace = {
    runId: `local-${Date.now().toString(36)}`,
    retrievalMode,
    retrievalStatus,
    validation,
    events: [],
    recentRetrievals: []
  };

  return appendTraceEvent(trace, {
    type: "pack_loaded",
    label: "Room pack loaded",
    detail: validation.valid
      ? `${validation.roomCount} rooms and ${validation.sourceCount} policy sources validated.`
      : `${validation.errors.length} validation errors found.`
  });
}

export function appendTraceEvent(trace: GameTrace, event: TraceEventInput) {
  return {
    ...trace,
    events: [
      {
        ...event,
        eventId: `${trace.events.length + 1}-${event.type}`,
        timestamp: new Date().toISOString()
      },
      ...trace.events
    ].slice(0, 50)
  };
}

export function appendRetrieval(
  trace: GameTrace,
  bundle: EvidenceBundle,
  label: string,
  detail?: string,
  retrievalStatus?: RetrievalStatus
) {
  return appendTraceEvent(
    {
      ...trace,
      retrievalMode: bundle.retrievalMode,
      retrievalStatus: retrievalStatus ?? statusForBundle(bundle),
      recentRetrievals: [bundle, ...trace.recentRetrievals].slice(0, 5)
    },
    {
      type: "retrieval",
      label,
      detail:
        detail ??
        `${bundle.snippets.length} snippets from ${bundle.sources.length} policy sources.`
    }
  );
}

export function appendRetrievalResult(
  trace: GameTrace,
  result: RetrievalRuntimeResult,
  label: string,
  detail?: string
) {
  const withRetrieval = appendRetrieval(
    trace,
    result.evidence,
    label,
    detail ??
      `${result.evidence.snippets.length} snippets, ${result.citationMappingCount} mapped citations, ${result.latencyMs} ms.`,
    result.status
  );

  if (result.status !== "foundry_iq_fallback") {
    return withRetrieval;
  }

  return appendTraceEvent(
    appendTraceEvent(withRetrieval, {
      type: "retrieval_failed",
      label: "Foundry IQ retrieval failed",
      detail: result.error ?? result.fallbackReason ?? "Foundry IQ was unavailable."
    }),
    {
      type: "retrieval_fallback",
      label: "Local mock fallback used",
      detail:
        result.fallbackReason ??
        "Used deterministic local synthetic policy evidence instead."
    }
  );
}

function statusForBundle(bundle: EvidenceBundle): RetrievalStatus {
  if (bundle.retrievalMode === "foundry_iq") {
    return "foundry_iq";
  }

  if (bundle.retrievalMode === "generated_mock") {
    return "generated_mock";
  }

  return "local_mock";
}
