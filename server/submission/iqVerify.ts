import { policySources, roomPackValidation } from "../../src/data/rooms";
import { appendRetrievalResult, createInitialTrace } from "../../src/tracing";
import type {
  Citation,
  GameTrace,
  RetrievalRequest,
  RetrievalRuntimeResult
} from "../../src/types";
import {
  type FoundryRetrievalOptions,
  retrieveWithFoundryFallback
} from "../foundry/retrieval";

const REQUIRED_ENV = [
  "FOUNDRY_IQ_SEARCH_ENDPOINT",
  "FOUNDRY_IQ_KNOWLEDGE_BASE",
  "FOUNDRY_IQ_API_VERSION"
] as const;

const DEFAULT_VERIFICATION_REQUEST: RetrievalRequest = {
  query:
    "What does the synthetic password and MFA policy require for accounts that access sensitive systems?",
  filters: {
    sourceIds: ["SYN-POL-005"],
    sectionIds: ["1.1"],
    concepts: ["MFA requirement"],
    limit: 3
  }
};

type RetrieveFn = (
  request: RetrievalRequest,
  options: FoundryRetrievalOptions
) => Promise<RetrievalRuntimeResult>;

export interface LiveIqVerificationOptions extends FoundryRetrievalOptions {
  request?: RetrievalRequest;
  retrieve?: RetrieveFn;
}

export interface LiveIqVerificationResult {
  status: "passed";
  request: RetrievalRequest;
  latencyMs: number;
  citationMappingCount: number;
  citations: Citation[];
  trace: GameTrace;
}

export class LiveIqVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LiveIqVerificationError";
  }
}

export async function verifyLiveFoundryIq(
  options: LiveIqVerificationOptions = {}
): Promise<LiveIqVerificationResult> {
  const env = options.env ?? process.env;
  const missing = missingLiveIqEnv(env);

  if (missing.length > 0) {
    throw new LiveIqVerificationError(
      `Live Foundry IQ verification requires ${missing.join(", ")}. Add them to .env.local or the host environment.`
    );
  }

  const request = options.request ?? DEFAULT_VERIFICATION_REQUEST;
  const retrieve = options.retrieve ?? retrieveWithFoundryFallback;
  const result = await retrieve(request, {
    env,
    fetchImpl: options.fetchImpl,
    getAccessToken: options.getAccessToken
  });

  assertLiveFoundryResult(result);

  const trace = appendRetrievalResult(
    createInitialTrace(roomPackValidation, "foundry_iq", "foundry_iq"),
    result,
    "Submission IQ verification"
  );

  assertTraceProof(trace, result);

  return {
    status: "passed",
    request,
    latencyMs: result.latencyMs,
    citationMappingCount: result.citationMappingCount,
    citations: result.evidence.citations,
    trace
  };
}

export function missingLiveIqEnv(env: NodeJS.ProcessEnv = process.env) {
  return REQUIRED_ENV.filter((name) => !env[name]?.trim());
}

function assertLiveFoundryResult(result: RetrievalRuntimeResult) {
  if (result.status !== "foundry_iq") {
    throw new LiveIqVerificationError(
      `Live IQ verification must return status 'foundry_iq'; received '${result.status}'. ${result.fallbackReason ?? result.error ?? ""}`.trim()
    );
  }

  if (result.evidence.retrievalMode !== "foundry_iq") {
    throw new LiveIqVerificationError(
      `Live IQ verification must return foundry_iq evidence; received '${result.evidence.retrievalMode}'.`
    );
  }

  if (result.citationMappingCount < 1 || result.evidence.citations.length < 1) {
    throw new LiveIqVerificationError(
      "Live IQ verification must map at least one Foundry citation to synthetic policy metadata."
    );
  }

  const unresolved = result.evidence.citations.filter(
    (citation) => !citationResolves(citation)
  );

  if (unresolved.length > 0) {
    throw new LiveIqVerificationError(
      `Live IQ verification returned unresolved synthetic citations: ${unresolved.map((citation) => citation.citationId).join(", ")}.`
    );
  }
}

function assertTraceProof(trace: GameTrace, result: RetrievalRuntimeResult) {
  const retrievalEvent = trace.events.find((event) => event.type === "retrieval");
  const recentRetrieval = trace.recentRetrievals[0];

  if (
    trace.retrievalStatus !== "foundry_iq" ||
    recentRetrieval?.retrievalMode !== "foundry_iq" ||
    !retrievalEvent?.detail.includes(`${result.citationMappingCount} mapped citations`)
  ) {
    throw new LiveIqVerificationError(
      "Live IQ verification did not produce trace proof with foundry_iq status and mapped citation count."
    );
  }
}

function citationResolves(citation: Citation) {
  const source = policySources.sources.find(
    (candidate) => candidate.id === citation.sourceId
  );

  return source?.sections.some((section) => section.id === citation.sectionId);
}
