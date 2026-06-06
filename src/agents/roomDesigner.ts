import type { AgentStep, EvidenceBundle, Room } from "../types";

export interface RoomDesignerOutput {
  roomDraft: Omit<Room, "puzzle">;
  step: AgentStep;
}

export function designRoom(evidence: EvidenceBundle): RoomDesignerOutput {
  const primaryConcept = evidence.citations[0]?.concept ?? "Identity security";
  const sourceId = evidence.citations[0]?.sourceId ?? "SYN-POL-005";

  const roomDraft: Omit<Room, "puzzle"> = {
    roomId: "generated-identity-gatehouse",
    title: "The Identity Gatehouse",
    subtitle: "A badge reader blinks until the right identity ritual is restored.",
    theme: `${primaryConcept} generated training`,
    learningObjectives: [
      "Recognize when multifactor authentication is required",
      "Reject suspicious or reused credential behavior",
      "Use cited policy evidence to unlock the identity gate"
    ],
    palette: "locker",
    sceneObjects: [
      {
        objectId: "mfa-reader",
        label: "MFA Reader",
        description:
          "The reader accepts a sign-in only when protected access includes multifactor authentication.",
        clueIds: ["generated-clue-mfa"],
        accent: "green"
      },
      {
        objectId: "password-ledger",
        label: "Password Ledger",
        description:
          "The ledger rejects any credential pattern reused across work and personal services.",
        clueIds: ["generated-clue-password"],
        accent: "amber"
      },
      {
        objectId: "identity-console",
        label: "Identity Console",
        description:
          "The console asks you to order the safe access ritual before the gate opens.",
        clueIds: ["generated-clue-sequence"],
        accent: "cyan"
      }
    ],
    clues: [
      {
        clueId: "generated-clue-mfa",
        label: "Protected Access Rule",
        content:
          "Protected systems require multifactor authentication for work account access.",
        citationIds: ["GEN-MFA-11"]
      },
      {
        clueId: "generated-clue-password",
        label: "Reuse Warning",
        content:
          "Work passwords must not be reused across personal and work services.",
        citationIds: ["GEN-PASS-21"]
      },
      {
        clueId: "generated-clue-sequence",
        label: "Gate Ritual",
        content:
          "The safe sequence checks account context, completes MFA, then rejects reused-password behavior.",
        citationIds: ["GEN-MFA-11", "GEN-PASS-21"]
      }
    ],
    exitCondition:
      "Order the identity access ritual using the cited Password and MFA policy evidence."
  };

  return {
    roomDraft,
    step: {
      stepId: "room-designer",
      agentName: "Room Designer",
      status: "passed",
      summary: `Mapped ${sourceId} evidence into ${roomDraft.title}.`,
      citationIds: evidence.citations.map((citation) => citation.citationId)
    }
  };
}
