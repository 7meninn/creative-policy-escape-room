import { describe, expect, it } from "vitest";
import { generateRoomDraft } from "./generationPipeline";
import { verifyGeneratedRoom } from "./verifier";
import { validatePuzzleAnswer } from "../gameLogic";
import type { GenerationRequest } from "../types";

const defaultRequest: GenerationRequest = {
  sourceId: "SYN-POL-005",
  concept: "MFA requirement",
  difficulty: "standard",
  seed: "phase-3-default"
};

describe("generateRoomDraft", () => {
  it("returns deterministic output for the same request", () => {
    const first = generateRoomDraft(defaultRequest, verifyGeneratedRoom);
    const second = generateRoomDraft(defaultRequest, verifyGeneratedRoom);

    expect(first.room).toEqual(second.room);
    expect(first.agentSteps).toEqual(second.agentSteps);
    expect(first.verifierResult).toEqual(second.verifierResult);
  });

  it("generates a valid Password and MFA playable room", () => {
    const result = generateRoomDraft(defaultRequest, verifyGeneratedRoom);

    expect(result.room.title).toBe("The Identity Gatehouse");
    expect(result.roomPack.retrievalMode).toBe("generated_mock");
    expect(result.verifierResult.valid).toBe(true);
    expect(result.evidence.sources).toContain("SYN-POL-005");
    expect(result.agentSteps.map((step) => step.agentName)).toEqual([
      "Source Curator",
      "Room Designer",
      "Puzzle Maker",
      "Verifier",
      "Debrief Writer"
    ]);
    expect(
      validatePuzzleAnswer(result.room.puzzle, [
        "confirm-work-account",
        "complete-mfa",
        "reject-reuse"
      ])
    ).toBe(true);
  });
});
