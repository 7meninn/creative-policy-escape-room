import { z } from "zod";
import { generateRoomDraft } from "../../src/agents/generationPipeline";
import { verifyGeneratedRoomPack } from "../../src/agents/verifier";
import {
  policySources,
  roomPack,
  roomPackValidation,
  rooms
} from "../../src/data/rooms";
import { validateRoomPack } from "../../src/data/validation";
import {
  buildDebrief,
  createInitialProgress,
  evaluateAttempt
} from "../../src/gameLogic";
import { createInitialTrace } from "../../src/tracing";
import type {
  Citation,
  McpExportFormat,
  McpToolName,
  McpToolResult,
  McpToolTrace,
  Puzzle,
  PuzzleAnswer,
  RetrievalStatus,
  Room,
  RoomPack
} from "../../src/types";
import {
  createPolicyPuzzleInputSchema,
  explainCitationInputSchema,
  exportEscapeRoomInputSchema,
  generateRoomInputSchema,
  validateAnswerInputSchema,
  type CreatePolicyPuzzleInput,
  type ExplainCitationInput,
  type ValidateAnswerInput
} from "./schemas";

const SAFE_INPUT_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /reveal\s+(the\s+)?(system|developer)\s+(prompt|message)/i,
  /disable\s+safety/i,
  /BEGIN\s+(RSA|OPENSSH|PRIVATE)\s+KEY/i,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bghp_[A-Za-z0-9_]{20,}\b/,
  /\bsk-(?!live-example\b)[A-Za-z0-9_-]{12,}\b/,
  /\b(client_secret|api[_-]?key|password)\s*=/i
];

export function generateRoomTool(input: unknown) {
  return runTool("generate_room", () => {
    const request = generateRoomInputSchema.parse(input);
    assertSafeInput(request);
    assertKnownSource(request.sourceId);

    const generation = generateRoomDraft(request, verifyGeneratedRoomPack);
    if (!generation.verifierResult.valid) {
      throw new McpToolError(
        "VERIFIER_BLOCKED",
        generation.verifierResult.errors.join(" ")
      );
    }

    return ok("generate_room", "generated_mock", generation.room.puzzle.citations, {
      room: generation.room,
      roomPack: generation.roomPack,
      debrief: generation.debrief,
      evidence: generation.evidence,
      agentSteps: generation.agentSteps,
      verifierResult: generation.verifierResult
    });
  });
}

export function createPolicyPuzzleTool(input: unknown) {
  return runTool<unknown>("create_policy_puzzle", () => {
    const request = createPolicyPuzzleInputSchema.parse(input);
    assertSafeInput(request);

    const existing = findStaticPuzzle(request);
    if (existing) {
      return ok("create_policy_puzzle", "local_mock", existing.puzzle.citations, {
        puzzle: existing.puzzle,
        sourceRoom: existing.room,
        validation: validateRoomPack(roomPack, policySources)
      });
    }

    if (request.puzzleType !== "sequence_lock") {
      throw new McpToolError(
        "NO_SUPPORTED_PUZZLE",
        `No cited ${request.puzzleType} puzzle exists for the requested source/concept.`
      );
    }

    const generated = generateRoomTool({
      sourceId: request.sourceId ?? "SYN-POL-005",
      concept: request.concept ?? "MFA requirement",
      seed: request.seed,
      difficulty: "standard"
    });

    if (generated.status === "error" || !generated.payload) {
      throw new McpToolError(
        generated.errorCode ?? "GENERATION_FAILED",
        generated.message ?? "The puzzle generator did not return a valid puzzle."
      );
    }

    const room = generated.payload.room as Room;
    return ok("create_policy_puzzle", "generated_mock", room.puzzle.citations, {
      puzzle: room.puzzle,
      sourceRoom: room,
      verifierResult: generated.payload.verifierResult
    });
  });
}

export function validateAnswerTool(input: unknown) {
  return runTool("validate_answer", () => {
    const request = validateAnswerInputSchema.parse(input);
    const puzzle = resolvePuzzleForAnswer(request);
    const answer = normalizeAnswer(puzzle, request.answer);
    const result = evaluateAttempt(puzzle, answer, request.revealedHintCount);

    return ok("validate_answer", "local_mock", puzzle.citations, {
      puzzleId: puzzle.puzzleId,
      correct: result.correct,
      scoreDelta: result.scoreDelta,
      revealedHintIndex: result.revealedHintIndex,
      message: result.message,
      citations: puzzle.citations
    });
  });
}

export function explainCitationTool(input: unknown) {
  return runTool("explain_citation", () => {
    const request = explainCitationInputSchema.parse(input);
    const citation = resolveCitation(request);

    if (!citation) {
      throw new McpToolError(
        "CITATION_NOT_FOUND",
        "The requested citation or source section could not be resolved."
      );
    }

    const source = policySources.sources.find(
      (candidate) => candidate.id === citation.sourceId
    );
    const section = source?.sections.find(
      (candidate) => candidate.id === citation.sectionId
    );

    return ok("explain_citation", "local_mock", [citation], {
      citation,
      source: source
        ? {
            id: source.id,
            title: source.title,
            version: source.version,
            ownerRole: source.ownerRole,
            disclaimer: source.disclaimer
          }
        : null,
      section: section
        ? {
            id: section.id,
            title: section.title,
            body: section.body,
            concepts: section.concepts,
            puzzleCandidates: section.puzzleCandidates
          }
        : null
    });
  });
}

export function exportEscapeRoomTool(input: unknown) {
  return runTool("export_escape_room", () => {
    const request = exportEscapeRoomInputSchema.parse(input);
    const generated = request.includeGenerated ? generatedRoomPack() : null;
    const exportPayload = exportPayloadFor(request.format, generated);
    const citations = collectCitations(generated ?? roomPack);

    return ok("export_escape_room", "local_mock", citations, exportPayload);
  });
}

export const mcpToolHandlers = {
  generate_room: generateRoomTool,
  create_policy_puzzle: createPolicyPuzzleTool,
  validate_answer: validateAnswerTool,
  explain_citation: explainCitationTool,
  export_escape_room: exportEscapeRoomTool
} satisfies Record<McpToolName, (input: unknown) => McpToolResult>;

function runTool<TPayload>(
  toolName: McpToolName,
  action: () => McpToolResult<TPayload>
): McpToolResult<TPayload> {
  try {
    return action();
  } catch (error) {
    const parsed = normalizeError(error);
    return {
      toolName,
      status: "error",
      retrievalStatus: "local_mock",
      citations: [],
      trace: [trace(toolName, "error", parsed.message)],
      errorCode: parsed.code,
      message: parsed.message
    };
  }
}

function ok<TPayload>(
  toolName: McpToolName,
  retrievalStatus: RetrievalStatus,
  citations: Citation[],
  payload: TPayload
): McpToolResult<TPayload> {
  if (citations.length === 0) {
    throw new McpToolError(
      "MISSING_CITATIONS",
      `${toolName} must return at least one citation.`
    );
  }

  return {
    toolName,
    status: "success",
    retrievalStatus,
    citations,
    trace: [trace(toolName, "success", `${toolName} completed successfully.`)],
    payload
  };
}

function trace(
  toolName: McpToolName,
  status: "success" | "error",
  detail: string
): McpToolTrace {
  return {
    eventId: `mcp-${Date.now().toString(36)}-${toolName}-${status}`,
    toolName,
    status,
    detail,
    timestamp: new Date().toISOString()
  };
}

function normalizeError(error: unknown) {
  if (error instanceof McpToolError) {
    return { code: error.code, message: error.message };
  }

  if (error instanceof z.ZodError) {
    return {
      code: "INVALID_INPUT",
      message: error.issues
        .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
        .join("; ")
    };
  }

  return {
    code: "TOOL_FAILED",
    message: error instanceof Error ? error.message : "Unknown MCP tool error."
  };
}

function assertSafeInput(value: unknown) {
  const text = JSON.stringify(value);
  for (const pattern of SAFE_INPUT_PATTERNS) {
    if (pattern.test(text)) {
      throw new McpToolError(
        "UNSAFE_INPUT",
        "Request text matched a blocked prompt-injection or secret-like pattern."
      );
    }
  }
}

function assertKnownSource(sourceId: string) {
  if (!policySources.sources.some((source) => source.id === sourceId)) {
    throw new McpToolError("SOURCE_NOT_FOUND", `Unknown policy source '${sourceId}'.`);
  }
}

function findStaticPuzzle(request: CreatePolicyPuzzleInput) {
  const candidates = rooms
    .filter((room) => room.puzzle.type === request.puzzleType)
    .filter((room) =>
      request.sourceId
        ? room.puzzle.citations.some((citation) => citation.sourceId === request.sourceId)
        : true
    )
    .filter((room) =>
      request.concept
        ? room.puzzle.citations.some((citation) =>
            citation.concept
              .toLowerCase()
              .includes(request.concept!.toLowerCase())
          )
        : true
    );

  const room = candidates[0];
  return room ? { room, puzzle: room.puzzle } : null;
}

function resolvePuzzleForAnswer(request: ValidateAnswerInput): Puzzle {
  if (request.puzzle) {
    return request.puzzle;
  }

  const staticPuzzle = rooms
    .map((room) => room.puzzle)
    .find((puzzle) => puzzle.puzzleId === request.puzzleId);

  if (staticPuzzle) {
    return staticPuzzle;
  }

  if (request.puzzleId === "generated-puzzle-identity-sequence") {
    return generatedRoomPack().rooms[0].puzzle;
  }

  throw new McpToolError("PUZZLE_NOT_FOUND", `Unknown puzzle '${request.puzzleId}'.`);
}

function normalizeAnswer(
  puzzle: Puzzle,
  answer: ValidateAnswerInput["answer"]
): PuzzleAnswer {
  if (puzzle.type === "redaction_lock") {
    if (!Array.isArray(answer)) {
      throw new McpToolError("INVALID_ANSWER", "Redaction answers must be string arrays.");
    }
    return new Set(answer);
  }

  if (puzzle.type === "sequence_lock") {
    if (!Array.isArray(answer)) {
      throw new McpToolError("INVALID_ANSWER", "Sequence answers must be string arrays.");
    }
    return answer;
  }

  if (Array.isArray(answer)) {
    throw new McpToolError("INVALID_ANSWER", "Classification answers must be objects.");
  }

  return answer;
}

function resolveCitation(request: ExplainCitationInput) {
  const citations = collectCitations(roomPack);
  if (request.citationId) {
    return citations.find((citation) => citation.citationId === request.citationId);
  }

  const source = policySources.sources.find(
    (candidate) => candidate.id === request.sourceId
  );
  const section = source?.sections.find(
    (candidate) => candidate.id === request.sectionId
  );

  if (!source || !section) {
    return null;
  }

  return {
    citationId: `EVID-${source.id}-${section.id.replaceAll(".", "-")}`,
    sourceId: source.id,
    sectionId: section.id,
    label: `${source.title}, section ${section.id}`,
    snippet: section.body,
    concept: section.concepts[0] ?? section.title
  };
}

function generatedRoomPack(): RoomPack {
  const result = generateRoomDraft(
    {
      sourceId: "SYN-POL-005",
      concept: "MFA requirement",
      seed: "mcp-export-generated-room",
      difficulty: "standard"
    },
    verifyGeneratedRoomPack
  );

  return result.roomPack;
}

function exportPayloadFor(format: McpExportFormat, generated: RoomPack | null) {
  const selectedPack = generated ?? roomPack;
  if (format === "room_pack_json") {
    return { format, roomPack: selectedPack };
  }

  if (format === "citation_report_json") {
    return { format, report: citationReportFor(selectedPack) };
  }

  if (format === "trace_json") {
    return {
      format,
      trace: createInitialTrace(roomPackValidation, selectedPack.retrievalMode)
    };
  }

  return { format, markdown: debriefMarkdownFor(selectedPack) };
}

function citationReportFor(selectedPack: RoomPack) {
  return selectedPack.rooms.map((room) => ({
    roomId: room.roomId,
    roomTitle: room.title,
    puzzleId: room.puzzle.puzzleId,
    puzzleTitle: room.puzzle.title,
    citations: room.puzzle.citations
  }));
}

function debriefMarkdownFor(selectedPack: RoomPack) {
  const progress = {
    ...createInitialProgress(),
    score: selectedPack.rooms.length * 100,
    completedRoomIds: selectedPack.rooms.map((room) => room.roomId)
  };
  const debrief = buildDebrief(progress, selectedPack.rooms);
  const citationLines = debrief.citations.map(
    (citation) =>
      `- ${citation.citationId}: ${citation.label} (${citation.concept})`
  );

  return [
    `# ${selectedPack.title} Debrief`,
    "",
    `Rooms completed: ${debrief.roomsCompleted}`,
    `Final score: ${debrief.finalScore}`,
    `Status: ${debrief.status}`,
    "",
    "## Concepts",
    ...debrief.concepts.map((concept) => `- ${concept}`),
    "",
    "## Citations",
    ...citationLines
  ].join("\n");
}

function collectCitations(selectedPack: RoomPack) {
  return selectedPack.rooms.flatMap((room) => room.puzzle.citations);
}

class McpToolError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}
