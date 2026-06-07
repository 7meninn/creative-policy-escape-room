export type GamePhase = "lobby" | "playing" | "debrief";

export type RetrievalMode =
  | "local_mock"
  | "generated_mock"
  | "foundry_iq"
  | "azure_ai_search";

export type RetrievalStatus =
  | "local_mock"
  | "generated_mock"
  | "foundry_iq"
  | "foundry_iq_fallback";

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

export interface PolicySection {
  id: string;
  title: string;
  body: string;
  concepts: string[];
  puzzleCandidates: string[];
}

export interface PolicySource {
  id: string;
  title: string;
  version: string;
  sourceType: "synthetic_policy";
  ownerRole: string;
  sections: PolicySection[];
  tags: string[];
  allowedAudiences: string[];
  disclaimer: string;
}

export interface PolicySourcePack {
  packId: string;
  title: string;
  disclaimer: string;
  sources: PolicySource[];
}

export interface PolicyPack {
  id: string;
  title: string;
  retrievalMode: RetrievalMode;
  disclaimer: string;
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

export interface RoomPack {
  packId: string;
  title: string;
  retrievalMode: RetrievalMode;
  disclaimer: string;
  rooms: Room[];
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

export interface EvidenceSnippet {
  sourceId: string;
  sectionId: string;
  title: string;
  snippet: string;
  concepts: string[];
}

export interface EvidenceBundle {
  query: string;
  sources: string[];
  snippets: EvidenceSnippet[];
  citations: Citation[];
  retrievalMode: RetrievalMode;
  confidence: number;
  safetyFlags: string[];
}

export interface RetrievalFilters {
  sourceIds?: string[];
  sectionIds?: string[];
  concepts?: string[];
  limit?: number;
}

export interface RetrievalRuntimeConfig {
  mode: "local_mock" | "foundry_iq";
  apiUrl: string;
}

export interface FoundryIqConfig {
  searchEndpoint: string;
  knowledgeBase: string;
  knowledgeSourceName?: string;
  apiVersion: string;
  maxOutputSizeInTokens: number;
  maxRuntimeInSeconds: number;
}

export interface RetrievalRequest {
  query: string;
  filters?: RetrievalFilters;
}

export interface RetrievalRuntimeResult {
  evidence: EvidenceBundle;
  status: RetrievalStatus;
  latencyMs: number;
  citationMappingCount: number;
  fallbackReason?: string;
  error?: string;
}

export interface RoomPackValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  citationCheckCount: number;
  roomCount: number;
  sourceCount: number;
}

export type TraceEventType =
  | "pack_loaded"
  | "retrieval"
  | "citation_drawer_opened"
  | "hint_revealed"
  | "answer_validated"
  | "retrieval_failed"
  | "retrieval_fallback"
  | "mcp_tool_succeeded"
  | "mcp_tool_failed"
  | "source_curated"
  | "room_designed"
  | "puzzle_created"
  | "generation_verified"
  | "creator_previewed"
  | "generated_room_played"
  | "generated_room_exported";

export interface TraceEvent {
  eventId: string;
  type: TraceEventType;
  label: string;
  detail: string;
  timestamp: string;
  roomId?: string;
  puzzleId?: string;
  citationIds?: string[];
  correct?: boolean;
}

export interface GameTrace {
  runId: string;
  retrievalMode: RetrievalMode;
  retrievalStatus: RetrievalStatus;
  validation: RoomPackValidationResult;
  events: TraceEvent[];
  recentRetrievals: EvidenceBundle[];
}

export interface GenerationRequest {
  sourceId: string;
  concept: string;
  difficulty: "standard";
  seed: string;
}

export interface AgentStep {
  stepId: string;
  agentName:
    | "Source Curator"
    | "Room Designer"
    | "Puzzle Maker"
    | "Verifier"
    | "Debrief Writer";
  status: "passed" | "blocked";
  summary: string;
  citationIds: string[];
}

export interface VerifierResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  safetyFlags: string[];
  roomPackValidation: RoomPackValidationResult;
}

export interface GeneratedRoomPack {
  packId: string;
  title: string;
  retrievalMode: "generated_mock";
  disclaimer: string;
  rooms: Room[];
}

export interface GeneratedDebrief {
  title: string;
  summary: string;
  concepts: string[];
  citationIds: string[];
}

export interface GenerationResult {
  request: GenerationRequest;
  evidence: EvidenceBundle;
  room: Room;
  roomPack: GeneratedRoomPack;
  verifierResult: VerifierResult;
  debrief: GeneratedDebrief;
  agentSteps: AgentStep[];
}

export type McpToolName =
  | "generate_room"
  | "create_policy_puzzle"
  | "validate_answer"
  | "explain_citation"
  | "export_escape_room";

export type McpExportFormat =
  | "room_pack_json"
  | "citation_report_json"
  | "debrief_markdown"
  | "trace_json";

export interface McpToolTrace {
  eventId: string;
  toolName: McpToolName;
  status: "success" | "error";
  detail: string;
  timestamp: string;
}

export interface McpToolResult<TPayload = unknown> {
  toolName: McpToolName;
  status: "success" | "error";
  retrievalStatus: RetrievalStatus;
  citations: Citation[];
  trace: McpToolTrace[];
  payload?: TPayload;
  errorCode?: string;
  message?: string;
}

export type SafetySeverity = "info" | "warning" | "error";

export type SafetyRule =
  | "synthetic_disclaimer"
  | "citation_coverage"
  | "prompt_injection"
  | "secret_like"
  | "pii_like"
  | "confidential_language"
  | "legal_claim"
  | "accessibility_metadata";

export interface SafetyFinding {
  rule: SafetyRule;
  severity: SafetySeverity;
  location: string;
  message: string;
  excerpt?: string;
  approved?: boolean;
}

export interface EvaluationCheck {
  checkId: string;
  label: string;
  status: "passed" | "warning" | "failed";
  summary: string;
  findings: SafetyFinding[];
}

export interface EvaluationResult {
  generatedAt: string;
  status: "passed" | "failed";
  checks: EvaluationCheck[];
  safetyFindings: SafetyFinding[];
}
