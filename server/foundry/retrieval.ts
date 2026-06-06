import { DefaultAzureCredential } from "@azure/identity";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { retrievePolicyEvidence } from "../../src/retrieval/localMock";
import type {
  FoundryIqConfig,
  RetrievalRequest,
  RetrievalRuntimeResult
} from "../../src/types";
import { FoundryConfigError, readFoundryIqConfig } from "./config";
import { mapFoundryRetrieveResponse } from "./mapper";

const SEARCH_SCOPE = "https://search.azure.com/.default";

const retrievalFiltersSchema = z.object({
  sourceIds: z.array(z.string().min(1)).optional(),
  sectionIds: z.array(z.string().min(1)).optional(),
  concepts: z.array(z.string().min(1)).optional(),
  limit: z.number().int().positive().max(10).optional()
});

export const retrievalRequestSchema = z.object({
  query: z.string().trim().min(1).max(1000),
  filters: retrievalFiltersSchema.optional()
});

export interface FoundryRetrievalOptions {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  getAccessToken?: (scope: string) => Promise<string>;
}

export async function retrieveWithFoundryFallback(
  request: RetrievalRequest,
  options: FoundryRetrievalOptions = {}
): Promise<RetrievalRuntimeResult> {
  const started = Date.now();

  try {
    const config = readFoundryIqConfig(options.env);
    const evidence = await retrieveFoundryEvidence(request, config, options);

    return {
      evidence,
      status: "foundry_iq",
      latencyMs: Date.now() - started,
      citationMappingCount: evidence.citations.length
    };
  } catch (error) {
    return fallbackResult(request, started, error);
  }
}

export async function retrieveFoundryEvidence(
  request: RetrievalRequest,
  config: FoundryIqConfig,
  options: FoundryRetrievalOptions = {}
) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const token = await tokenForSearch(options.getAccessToken);
  const response = await fetchImpl(retrieveUrl(config), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "x-ms-client-request-id": randomUUID()
    },
    body: JSON.stringify(retrieveBody(request, config))
  });

  if (!response.ok) {
    const errorText = await safeResponseText(response);
    throw new Error(
      `Foundry IQ retrieve failed with ${response.status}: ${errorText}`
    );
  }

  return mapFoundryRetrieveResponse(request.query, await response.json());
}

function retrieveBody(request: RetrievalRequest, config: FoundryIqConfig) {
  const body: Record<string, unknown> = {
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: retrievalPrompt(request)
          }
        ]
      }
    ],
    includeActivity: true,
    maxOutputSizeInTokens: config.maxOutputSizeInTokens,
    maxRuntimeInSeconds: config.maxRuntimeInSeconds
  };

  if (config.knowledgeSourceName) {
    body.knowledgeSourceParams = [
      {
        kind: "searchIndex",
        knowledgeSourceName: config.knowledgeSourceName,
        includeReferences: true,
        includeReferenceSourceData: true
      }
    ];
  }

  return body;
}

function retrievalPrompt(request: RetrievalRequest) {
  const filters = request.filters ?? {};
  const constraints = [
    filters.sourceIds?.length ? `source IDs: ${filters.sourceIds.join(", ")}` : null,
    filters.sectionIds?.length
      ? `section IDs: ${filters.sectionIds.join(", ")}`
      : null,
    filters.concepts?.length ? `concepts: ${filters.concepts.join(", ")}` : null
  ].filter(Boolean);

  return [
    request.query,
    "Return only synthetic policy evidence for Policy Escape Room.",
    "Prefer references whose source data includes SYN-POL document IDs and section markers.",
    constraints.length > 0 ? `Retrieval constraints: ${constraints.join("; ")}.` : null
  ]
    .filter(Boolean)
    .join("\n");
}

function retrieveUrl(config: FoundryIqConfig) {
  const knowledgeBase = encodeURIComponent(config.knowledgeBase).replaceAll(
    "'",
    "%27"
  );
  const apiVersion = encodeURIComponent(config.apiVersion);
  return `${config.searchEndpoint}/knowledgebases('${knowledgeBase}')/retrieve?api-version=${apiVersion}`;
}

async function tokenForSearch(
  injectedTokenProvider: FoundryRetrievalOptions["getAccessToken"]
) {
  if (injectedTokenProvider) {
    return injectedTokenProvider(SEARCH_SCOPE);
  }

  const credential = new DefaultAzureCredential();
  const token = await credential.getToken(SEARCH_SCOPE);

  if (!token?.token) {
    throw new Error("DefaultAzureCredential did not return a Search token.");
  }

  return token.token;
}

async function safeResponseText(response: Response) {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return "No response body.";
  }
}

function fallbackResult(
  request: RetrievalRequest,
  started: number,
  error: unknown
): RetrievalRuntimeResult {
  const fallback = retrievePolicyEvidence(request.query, request.filters ?? {});
  const message = error instanceof Error ? error.message : "Unknown Foundry IQ error.";
  const reason =
    error instanceof FoundryConfigError
      ? "Foundry IQ configuration is incomplete; local mock evidence was used."
      : "Foundry IQ retrieval failed; local mock evidence was used.";

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
    fallbackReason: reason,
    error: message
  };
}
