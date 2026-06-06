import type { AgentStep, EvidenceBundle, Room, SequencePuzzle } from "../types";

export interface PuzzleMakerOutput {
  room: Room;
  step: AgentStep;
}

export function makePuzzle(
  roomDraft: Omit<Room, "puzzle">,
  evidence: EvidenceBundle
): PuzzleMakerOutput {
  const mfaCitation = citationFor(evidence, "1.1", "GEN-MFA-11");
  const passwordCitation = citationFor(evidence, "2.1", "GEN-PASS-21");

  const puzzle: SequencePuzzle = {
    puzzleId: "generated-puzzle-identity-sequence",
    roomId: roomDraft.roomId,
    type: "sequence_lock",
    title: "Identity Ritual Sequence",
    prompt:
      "Order the safe sign-in ritual for a protected work system before the gate opens.",
    instructions:
      "Select the steps in order. The correct answer must satisfy MFA and password-reuse policy evidence.",
    steps: [
      {
        optionId: "confirm-work-account",
        label: "Confirm it is a protected work account",
        detail: "Start by identifying that the sign-in targets a protected work system."
      },
      {
        optionId: "reuse-password",
        label: "Reuse a familiar personal password",
        detail: "This is rejected because work and personal passwords must differ."
      },
      {
        optionId: "complete-mfa",
        label: "Complete multifactor authentication",
        detail: "Protected work access requires MFA."
      },
      {
        optionId: "reject-reuse",
        label: "Reject reused-password behavior",
        detail: "Do not approve a credential pattern reused across services."
      }
    ],
    correctOrder: ["confirm-work-account", "complete-mfa", "reject-reuse"],
    citations: [mfaCitation, passwordCitation],
    hints: [
      {
        level: "nudge",
        label: "Start with context",
        text:
          "The gate first needs to know whether this access is for a protected work system.",
        citationIds: ["GEN-MFA-11"]
      },
      {
        level: "concept",
        label: "MFA before entry",
        text:
          "Protected systems require multifactor authentication before access is allowed.",
        citationIds: ["GEN-MFA-11"]
      },
      {
        level: "evidence",
        label: "Password reuse citation",
        text:
          "The policy also rejects using the same password across work and personal services.",
        citationIds: ["GEN-PASS-21"]
      },
      {
        level: "explanation",
        label: "Answer explanation",
        text:
          "The safe sequence is confirm protected work context, complete MFA, then reject reused-password behavior.",
        citationIds: ["GEN-MFA-11", "GEN-PASS-21"]
      }
    ],
    successMessage:
      "The identity gate opens. Your access ritual used MFA and rejected password reuse.",
    failureMessage:
      "The identity gate stays sealed. Re-check the MFA requirement and password reuse rule."
  };

  return {
    room: {
      ...roomDraft,
      puzzle
    },
    step: {
      stepId: "puzzle-maker",
      agentName: "Puzzle Maker",
      status: "passed",
      summary: `Created ${puzzle.type} puzzle '${puzzle.title}'.`,
      citationIds: puzzle.citations.map((citation) => citation.citationId)
    }
  };
}

function citationFor(evidence: EvidenceBundle, sectionId: string, citationId: string) {
  const citation = evidence.citations.find((item) => item.sectionId === sectionId);

  return {
    citationId,
    sourceId: citation?.sourceId ?? "SYN-POL-005",
    sectionId,
    label: citation?.label ?? `Password And MFA Policy, section ${sectionId}`,
    snippet:
      citation?.snippet ??
      (sectionId === "1.1"
        ? "Work accounts must use multifactor authentication when accessing protected systems."
        : "Employees must not reuse passwords across work and personal services."),
    concept:
      citation?.concept ??
      (sectionId === "1.1" ? "MFA requirement" : "Password reuse prevention")
  };
}
