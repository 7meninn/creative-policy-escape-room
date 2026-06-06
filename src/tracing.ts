import type {
  EvidenceBundle,
  GameTrace,
  RetrievalMode,
  RoomPackValidationResult,
  TraceEvent
} from "./types";

type TraceEventInput = Omit<TraceEvent, "eventId" | "timestamp">;

export function createInitialTrace(
  validation: RoomPackValidationResult,
  retrievalMode: RetrievalMode
): GameTrace {
  const trace: GameTrace = {
    runId: `local-${Date.now().toString(36)}`,
    retrievalMode,
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
  detail?: string
) {
  return appendTraceEvent(
    {
      ...trace,
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
