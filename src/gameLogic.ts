import { rooms } from "./data/rooms";
import type {
  Debrief,
  PlayerProgress,
  Puzzle,
  PuzzleAnswer,
  ValidationResult
} from "./types";

export const SOLVED_SCORE = 100;
export const WRONG_ATTEMPT_PENALTY = -5;
export const HINT_PENALTY = -10;

export function createInitialProgress(): PlayerProgress {
  return {
    phase: "lobby",
    currentRoomIndex: 0,
    score: 0,
    collectedClueIds: [],
    completedRoomIds: [],
    puzzleAttempts: {},
    revealedHints: {}
  };
}

export function validatePuzzleAnswer(
  puzzle: Puzzle,
  answer: PuzzleAnswer
): boolean {
  if (puzzle.type === "sequence_lock") {
    if (!Array.isArray(answer)) {
      return false;
    }

    return arraysEqual(answer, puzzle.correctOrder);
  }

  if (puzzle.type === "classification_lock") {
    if (!isRecord(answer)) {
      return false;
    }

    const expectedEntries = Object.entries(puzzle.correctCategories);
    return expectedEntries.every(
      ([artifactId, categoryId]) => answer[artifactId] === categoryId
    );
  }

  if (!(answer instanceof Set)) {
    return false;
  }

  return setsEqual(answer, new Set(puzzle.correctRedactions));
}

export function scoreHint(previousHintCount: number, hintCount: number): number {
  return Math.max(0, hintCount - previousHintCount) * HINT_PENALTY;
}

export function nextHintIndex(puzzle: Puzzle, revealedCount: number): number {
  return Math.min(revealedCount, puzzle.hints.length - 1);
}

export function evaluateAttempt(
  puzzle: Puzzle,
  answer: PuzzleAnswer,
  revealedHintCount: number
): ValidationResult {
  const correct = validatePuzzleAnswer(puzzle, answer);

  if (correct) {
    return {
      correct: true,
      message: puzzle.successMessage,
      scoreDelta: SOLVED_SCORE,
      revealedHintIndex: null
    };
  }

  return {
    correct: false,
    message: puzzle.failureMessage,
    scoreDelta: WRONG_ATTEMPT_PENALTY,
    revealedHintIndex: nextHintIndex(puzzle, revealedHintCount)
  };
}

export function buildDebrief(progress: PlayerProgress): Debrief {
  const completedRooms = rooms.filter((room) =>
    progress.completedRoomIds.includes(room.roomId)
  );
  const hintCount = Object.values(progress.revealedHints).reduce(
    (total, count) => total + count,
    0
  );
  const concepts = Array.from(
    new Set(
      completedRooms.flatMap((room) =>
        room.puzzle.citations.map((citation) => citation.concept)
      )
    )
  );
  const citations = completedRooms.flatMap((room) => room.puzzle.citations);

  return {
    finalScore: progress.score,
    roomsCompleted: completedRooms.length,
    concepts,
    citations,
    status: hintCount > 0 ? "escaped_with_hints" : "escaped"
  };
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((item, i) => item === right[i]);
}

function setsEqual(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) {
    return false;
  }

  for (const item of left) {
    if (!right.has(item)) {
      return false;
    }
  }

  return true;
}

function isRecord(value: PuzzleAnswer): value is Record<string, string> {
  return !Array.isArray(value) && !(value instanceof Set) && value !== null;
}
