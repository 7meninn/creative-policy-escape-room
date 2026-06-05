import { describe, expect, it } from "vitest";
import { rooms } from "./data/rooms";
import {
  buildDebrief,
  createInitialProgress,
  evaluateAttempt,
  HINT_PENALTY,
  SOLVED_SCORE,
  validatePuzzleAnswer,
  WRONG_ATTEMPT_PENALTY
} from "./gameLogic";

describe("static room pack", () => {
  it("has a cited puzzle for every room", () => {
    expect(rooms).toHaveLength(3);

    for (const room of rooms) {
      expect(room.puzzle.citations.length).toBeGreaterThan(0);
      expect(room.puzzle.hints.length).toBeGreaterThanOrEqual(3);
      expect(room.clues.every((clue) => clue.citationIds.length > 0)).toBe(true);
    }
  });
});

describe("validatePuzzleAnswer", () => {
  it("validates the Inbox Vault sequence lock", () => {
    const puzzle = rooms[0].puzzle;

    expect(validatePuzzleAnswer(puzzle, ["identify", "portal", "phone"])).toBe(
      true
    );
    expect(validatePuzzleAnswer(puzzle, ["portal", "identify", "phone"])).toBe(
      false
    );
  });

  it("validates the Data Locker classification lock", () => {
    const puzzle = rooms[1].puzzle;

    expect(
      validatePuzzleAnswer(puzzle, {
        "press-post": "public",
        roadmap: "internal",
        "support-export": "confidential",
        token: "restricted"
      })
    ).toBe(true);
  });

  it("validates the AI Lab Door redaction lock", () => {
    const puzzle = rooms[2].puzzle;

    expect(
      validatePuzzleAnswer(
        puzzle,
        new Set(["customer-name", "account-id", "token"])
      )
    ).toBe(true);
    expect(validatePuzzleAnswer(puzzle, new Set(["customer-name", "task"]))).toBe(
      false
    );
  });
});

describe("evaluateAttempt", () => {
  it("awards solved score for correct answers", () => {
    const result = evaluateAttempt(
      rooms[0].puzzle,
      ["identify", "portal", "phone"],
      0
    );

    expect(result.correct).toBe(true);
    expect(result.scoreDelta).toBe(SOLVED_SCORE);
  });

  it("penalizes wrong answers and reveals the next hint", () => {
    const result = evaluateAttempt(rooms[0].puzzle, ["delete"], 0);

    expect(result.correct).toBe(false);
    expect(result.scoreDelta).toBe(WRONG_ATTEMPT_PENALTY);
    expect(result.revealedHintIndex).toBe(0);
  });
});

describe("buildDebrief", () => {
  it("summarizes completed rooms and hint status", () => {
    const progress = {
      ...createInitialProgress(),
      phase: "debrief" as const,
      score: SOLVED_SCORE * 3 + HINT_PENALTY,
      completedRoomIds: rooms.map((room) => room.roomId),
      revealedHints: {
        [rooms[0].puzzle.puzzleId]: 1
      }
    };

    const debrief = buildDebrief(progress);

    expect(debrief.roomsCompleted).toBe(3);
    expect(debrief.status).toBe("escaped_with_hints");
    expect(debrief.concepts).toContain("Phishing reporting window");
  });
});
