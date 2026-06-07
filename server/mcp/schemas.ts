import { z } from "zod";
import { puzzleSchema } from "../../src/schemas";

const puzzleTypeSchema = z.enum([
  "sequence_lock",
  "classification_lock",
  "redaction_lock"
]);

export const generateRoomInputSchema = z.object({
  sourceId: z.string().min(1).default("SYN-POL-005"),
  concept: z.string().min(1).default("MFA requirement"),
  seed: z.string().min(1).default("mcp-generated-room"),
  difficulty: z.literal("standard").default("standard")
});

export const createPolicyPuzzleInputSchema = z.object({
  sourceId: z.string().min(1).optional(),
  concept: z.string().min(1).optional(),
  puzzleType: puzzleTypeSchema.default("sequence_lock"),
  seed: z.string().min(1).default("mcp-policy-puzzle")
});

const answerSchema = z.union([
  z.array(z.string()),
  z.record(z.string(), z.string())
]);

export const validateAnswerInputSchema = z
  .object({
    puzzleId: z.string().min(1).optional(),
    puzzle: puzzleSchema.optional(),
    answer: answerSchema,
    revealedHintCount: z.number().int().min(0).default(0)
  })
  .refine((input) => input.puzzleId || input.puzzle, {
    message: "Provide either puzzleId or puzzle."
  });

export const explainCitationInputSchema = z
  .object({
    citationId: z.string().min(1).optional(),
    sourceId: z.string().min(1).optional(),
    sectionId: z.string().min(1).optional()
  })
  .refine((input) => input.citationId || (input.sourceId && input.sectionId), {
    message: "Provide citationId, or both sourceId and sectionId."
  });

export const exportEscapeRoomInputSchema = z.object({
  format: z
    .enum([
      "room_pack_json",
      "citation_report_json",
      "debrief_markdown",
      "trace_json"
    ])
    .default("room_pack_json"),
  includeGenerated: z.boolean().default(false)
});

export type GenerateRoomInput = z.infer<typeof generateRoomInputSchema>;
export type CreatePolicyPuzzleInput = z.infer<
  typeof createPolicyPuzzleInputSchema
>;
export type ValidateAnswerInput = z.infer<typeof validateAnswerInputSchema>;
export type ExplainCitationInput = z.infer<typeof explainCitationInputSchema>;
export type ExportEscapeRoomInput = z.infer<typeof exportEscapeRoomInputSchema>;
