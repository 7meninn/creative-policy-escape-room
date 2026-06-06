import type { AgentStep, GeneratedDebrief, Room } from "../types";

export interface DebriefWriterOutput {
  debrief: GeneratedDebrief;
  step: AgentStep;
}

export function writeGeneratedDebrief(room: Room): DebriefWriterOutput {
  const concepts = Array.from(
    new Set(room.puzzle.citations.map((citation) => citation.concept))
  );
  const citationIds = room.puzzle.citations.map((citation) => citation.citationId);
  const debrief: GeneratedDebrief = {
    title: `${room.title} debrief`,
    summary:
      "This generated room teaches a safe identity access ritual using cited synthetic Password and MFA policy evidence.",
    concepts,
    citationIds
  };

  return {
    debrief,
    step: {
      stepId: "debrief-writer",
      agentName: "Debrief Writer",
      status: "passed",
      summary: `Prepared generated debrief for ${concepts.length} policy concepts.`,
      citationIds
    }
  };
}
