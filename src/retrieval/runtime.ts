import { evidenceBundleSchema } from "../schemas";
import type {
  RetrievalFilters,
  RetrievalRuntimeConfig,
  RetrievalRuntimeResult
} from "../types";
import { retrievePolicyEvidence } from "./localMock";

const DEFAULT_RETRIEVAL_API_URL =
  "http://localhost:8787/api/retrieve-policy-evidence";

export function getRetrievalRuntimeConfig(
  env: ImportMetaEnv = import.meta.env
): RetrievalRuntimeConfig {
  const requestedMode = env.VITE_RETRIEVAL_MODE;

  return {
    mode: requestedMode === "foundry_iq" ? "foundry_iq" : "local_mock",
    apiUrl: env.VITE_RETRIEVAL_API_URL || DEFAULT_RETRIEVAL_API_URL
  };
}

export async function retrievePolicyEvidenceRuntime(
  query: string,
  filters: RetrievalFilters = {},
  config: RetrievalRuntimeConfig = getRetrievalRuntimeConfig()
): Promise<RetrievalRuntimeResult> {
  if (config.mode !== "foundry_iq") {
    return localResult(query, filters, "local_mock", 0);
  }

  const started = Date.now();

  try {
    const response = await fetch(config.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query, filters })
    });

    if (!response.ok) {
      throw new Error(`Foundry API proxy returned ${response.status}`);
    }

    const parsed = await response.json();
    const evidence = evidenceBundleSchema.parse(parsed.evidence);
    const latencyMs = numberOrDefault(parsed.latencyMs, Date.now() - started);
    const status =
      parsed.status === "foundry_iq"
        ? "foundry_iq"
        : parsed.status === "foundry_iq_fallback"
          ? "foundry_iq_fallback"
          : evidence.retrievalMode === "foundry_iq"
            ? "foundry_iq"
            : "foundry_iq_fallback";

    return {
      evidence,
      status,
      latencyMs,
      citationMappingCount: numberOrDefault(
        parsed.citationMappingCount,
        evidence.citations.length
      ),
      fallbackReason: stringOrUndefined(parsed.fallbackReason),
      error: stringOrUndefined(parsed.error)
    };
  } catch (error) {
    const fallback = retrievePolicyEvidence(query, filters);
    const message = error instanceof Error ? error.message : "Unknown retrieval error";

    return {
      evidence: {
        ...fallback,
        safetyFlags: Array.from(
          new Set([...fallback.safetyFlags, "foundry_iq_fallback"])
        )
      },
      status: "foundry_iq_fallback",
      latencyMs: Date.now() - started,
      citationMappingCount: fallback.citations.length,
      fallbackReason: "Foundry IQ was unavailable; local mock evidence was used.",
      error: message
    };
  }
}

function localResult(
  query: string,
  filters: RetrievalFilters,
  status: "local_mock",
  latencyMs: number
): RetrievalRuntimeResult {
  const evidence = retrievePolicyEvidence(query, filters);

  return {
    evidence,
    status,
    latencyMs,
    citationMappingCount: evidence.citations.length
  };
}

function numberOrDefault(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringOrUndefined(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
