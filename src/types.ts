export type GamePhase = "lobby" | "playing" | "debrief";

export type PuzzleType =
  | "sequence_lock"
  | "classification_lock"
  | "redaction_lock";

export interface Citation {
  citationId: string;
  sourceId: string;
  sectionId: string;
  label: string;
  snippet: string;
  concept: string;
}

export interface Hint {
  level: "nudge" | "concept" | "evidence" | "explanation";
  label: string;
  text: string;
  citationIds: string[];
}

export interface Clue {
  clueId: string;
  label: string;
  content: string;
  citationIds: string[];
}

export interface SceneObject {
  objectId: string;
  label: string;
  description: string;
  clueIds: string[];
  accent: "amber" | "cyan" | "green" | "red" | "violet";
}

export interface PuzzleOption {
  optionId: string;
  label: string;
  detail: string;
}

export interface BasePuzzle {
  puzzleId: string;
  roomId: string;
  type: PuzzleType;
  title: string;
  prompt: string;
  instructions: string;
  citations: Citation[];
  hints: Hint[];
  successMessage: string;
  failureMessage: string;
}

export interface SequencePuzzle extends BasePuzzle {
  type: "sequence_lock";
  steps: PuzzleOption[];
  correctOrder: string[];
}

export interface ClassificationArtifact {
  artifactId: string;
  label: string;
  detail: string;
}

export interface ClassificationCategory {
  categoryId: string;
  label: string;
}

export interface ClassificationPuzzle extends BasePuzzle {
  type: "classification_lock";
  artifacts: ClassificationArtifact[];
  categories: ClassificationCategory[];
  correctCategories: Record<string, string>;
}

export interface RedactionFragment {
  fragmentId: string;
  label: string;
  detail: string;
}

export interface RedactionPuzzle extends BasePuzzle {
  type: "redaction_lock";
  unsafePrompt: string;
  fragments: RedactionFragment[];
  correctRedactions: string[];
}

export type Puzzle = SequencePuzzle | ClassificationPuzzle | RedactionPuzzle;

export interface Room {
  roomId: string;
  title: string;
  subtitle: string;
  theme: string;
  learningObjectives: string[];
  sceneObjects: SceneObject[];
  clues: Clue[];
  puzzle: Puzzle;
  exitCondition: string;
  palette: "inbox" | "locker" | "lab";
}

export interface PuzzleAttempt {
  attempts: number;
  solved: boolean;
}

export interface PlayerProgress {
  phase: GamePhase;
  currentRoomIndex: number;
  score: number;
  collectedClueIds: string[];
  completedRoomIds: string[];
  puzzleAttempts: Record<string, PuzzleAttempt>;
  revealedHints: Record<string, number>;
}

export interface ValidationResult {
  correct: boolean;
  message: string;
  scoreDelta: number;
  revealedHintIndex: number | null;
}

export interface Debrief {
  finalScore: number;
  roomsCompleted: number;
  concepts: string[];
  citations: Citation[];
  status: "escaped" | "escaped_with_hints" | "needs_review";
}

export type PuzzleAnswer =
  | string[]
  | Record<string, string>
  | Set<string>;
