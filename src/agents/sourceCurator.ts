import { retrievePolicyEvidence } from "../retrieval/localMock";
import type { AgentStep, EvidenceBundle, GenerationRequest } from "../types";

export interface SourceCuratorOutput {
  evidence: EvidenceBundle;
  step: AgentStep;
}

export function curateSources(request: GenerationRequest): SourceCuratorOutput {
  const evidence = retrievePolicyEvidence(request.concept, {
    sourceIds: [request.sourceId],
    concepts: [request.concept],
    limit: 3
  });

  return {
    evidence,
    step: {
      stepId: "source-curator",
      agentName: "Source Curator",
      status: evidence.citations.length > 0 ? "passed" : "blocked",
      summary:
        evidence.citations.length > 0
          ? `Selected ${evidence.snippets.length} synthetic policy snippets for ${request.concept}.`
          : `No cited evidence found for ${request.concept}.`,
      citationIds: evidence.citations.map((citation) => citation.citationId)
    }
  };
}
