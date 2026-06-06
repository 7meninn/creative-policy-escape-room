import type { FoundryIqConfig } from "../../src/types";

const DEFAULT_API_VERSION = "2026-05-01-preview";
const DEFAULT_MAX_OUTPUT_SIZE_IN_TOKENS = 1400;
const DEFAULT_MAX_RUNTIME_IN_SECONDS = 15;

export class FoundryConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FoundryConfigError";
  }
}

export function readFoundryIqConfig(
  env: NodeJS.ProcessEnv = process.env
): FoundryIqConfig {
  const searchEndpoint = cleanEndpoint(env.FOUNDRY_IQ_SEARCH_ENDPOINT);
  const knowledgeBase = env.FOUNDRY_IQ_KNOWLEDGE_BASE?.trim();

  const missing = [
    ["FOUNDRY_IQ_SEARCH_ENDPOINT", searchEndpoint],
    ["FOUNDRY_IQ_KNOWLEDGE_BASE", knowledgeBase]
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new FoundryConfigError(
      `Missing Foundry IQ configuration: ${missing.join(", ")}.`
    );
  }

  return {
    searchEndpoint: searchEndpoint as string,
    knowledgeBase: knowledgeBase as string,
    knowledgeSourceName: optionalString(env.FOUNDRY_IQ_KNOWLEDGE_SOURCE_NAME),
    apiVersion: optionalString(env.FOUNDRY_IQ_API_VERSION) ?? DEFAULT_API_VERSION,
    maxOutputSizeInTokens: positiveInteger(
      env.FOUNDRY_IQ_MAX_OUTPUT_TOKENS,
      DEFAULT_MAX_OUTPUT_SIZE_IN_TOKENS
    ),
    maxRuntimeInSeconds: positiveInteger(
      env.FOUNDRY_IQ_MAX_RUNTIME_SECONDS,
      DEFAULT_MAX_RUNTIME_IN_SECONDS
    )
  };
}

export function foundryApiPort(env: NodeJS.ProcessEnv = process.env) {
  return positiveInteger(env.FOUNDRY_IQ_PROXY_PORT, 8787);
}

function cleanEndpoint(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\/+$/, "") : undefined;
}

function optionalString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
