import { z } from "zod";

const retrievalModeSchema = z.enum(["local_mock", "foundry_iq", "azure_ai_search"]);
const puzzleTypeSchema = z.enum([
  "sequence_lock",
  "classification_lock",
  "redaction_lock"
]);
const hintLevelSchema = z.enum(["nudge", "concept", "evidence", "explanation"]);
const accentSchema = z.enum(["amber", "cyan", "green", "red", "violet"]);
const paletteSchema = z.enum(["inbox", "locker", "lab"]);

export const citationSchema = z.object({
  citationId: z.string().min(1),
  sourceId: z.string().min(1),
  sectionId: z.string().min(1),
  label: z.string().min(1),
  snippet: z.string().min(1),
  concept: z.string().min(1)
});

export const hintSchema = z.object({
  level: hintLevelSchema,
  label: z.string().min(1),
  text: z.string().min(1),
  citationIds: z.array(z.string().min(1))
});

export const clueSchema = z.object({
  clueId: z.string().min(1),
  label: z.string().min(1),
  content: z.string().min(1),
  citationIds: z.array(z.string().min(1))
});

const sceneObjectSchema = z.object({
  objectId: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  clueIds: z.array(z.string().min(1)),
  accent: accentSchema
});

const puzzleOptionSchema = z.object({
  optionId: z.string().min(1),
  label: z.string().min(1),
  detail: z.string().min(1)
});

const basePuzzleSchema = z.object({
  puzzleId: z.string().min(1),
  roomId: z.string().min(1),
  type: puzzleTypeSchema,
  title: z.string().min(1),
  prompt: z.string().min(1),
  instructions: z.string().min(1),
  citations: z.array(citationSchema),
  hints: z.array(hintSchema),
  successMessage: z.string().min(1),
  failureMessage: z.string().min(1)
});

const sequencePuzzleSchema = basePuzzleSchema.extend({
  type: z.literal("sequence_lock"),
  steps: z.array(puzzleOptionSchema),
  correctOrder: z.array(z.string().min(1))
});

const classificationPuzzleSchema = basePuzzleSchema.extend({
  type: z.literal("classification_lock"),
  artifacts: z.array(
    z.object({
      artifactId: z.string().min(1),
      label: z.string().min(1),
      detail: z.string().min(1)
    })
  ),
  categories: z.array(
    z.object({
      categoryId: z.string().min(1),
      label: z.string().min(1)
    })
  ),
  correctCategories: z.record(z.string().min(1), z.string().min(1))
});

const redactionPuzzleSchema = basePuzzleSchema.extend({
  type: z.literal("redaction_lock"),
  unsafePrompt: z.string().min(1),
  fragments: z.array(
    z.object({
      fragmentId: z.string().min(1),
      label: z.string().min(1),
      detail: z.string().min(1)
    })
  ),
  correctRedactions: z.array(z.string().min(1))
});

export const puzzleSchema = z.discriminatedUnion("type", [
  sequencePuzzleSchema,
  classificationPuzzleSchema,
  redactionPuzzleSchema
]);

export const roomPlanSchema = z.object({
  roomId: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  theme: z.string().min(1),
  learningObjectives: z.array(z.string().min(1)),
  sceneObjects: z.array(sceneObjectSchema),
  clues: z.array(clueSchema),
  puzzle: puzzleSchema,
  exitCondition: z.string().min(1),
  palette: paletteSchema
});

export const roomPackSchema = z.object({
  packId: z.string().min(1),
  title: z.string().min(1),
  retrievalMode: retrievalModeSchema,
  disclaimer: z.string().min(1),
  rooms: z.array(roomPlanSchema)
});

export const policySectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  concepts: z.array(z.string().min(1)),
  puzzleCandidates: z.array(z.string().min(1))
});

export const policySourceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  version: z.string().min(1),
  sourceType: z.literal("synthetic_policy"),
  ownerRole: z.string().min(1),
  tags: z.array(z.string().min(1)),
  allowedAudiences: z.array(z.string().min(1)),
  disclaimer: z.string().min(1),
  sections: z.array(policySectionSchema)
});

export const policySourcePackSchema = z.object({
  packId: z.string().min(1),
  title: z.string().min(1),
  disclaimer: z.string().min(1),
  sources: z.array(policySourceSchema)
});

export const evidenceBundleSchema = z.object({
  query: z.string(),
  sources: z.array(z.string()),
  snippets: z.array(
    z.object({
      sourceId: z.string(),
      sectionId: z.string(),
      title: z.string(),
      snippet: z.string(),
      concepts: z.array(z.string())
    })
  ),
  citations: z.array(citationSchema),
  retrievalMode: retrievalModeSchema,
  confidence: z.number().min(0).max(1),
  safetyFlags: z.array(z.string())
});

export const gameTraceSchema = z.object({
  runId: z.string().min(1),
  retrievalMode: retrievalModeSchema,
  validation: z.object({
    valid: z.boolean(),
    errors: z.array(z.string()),
    warnings: z.array(z.string()),
    citationCheckCount: z.number().int().nonnegative(),
    roomCount: z.number().int().nonnegative(),
    sourceCount: z.number().int().nonnegative()
  }),
  events: z.array(
    z.object({
      eventId: z.string().min(1),
      type: z.enum([
        "pack_loaded",
        "retrieval",
        "citation_drawer_opened",
        "hint_revealed",
        "answer_validated"
      ]),
      label: z.string().min(1),
      detail: z.string().min(1),
      timestamp: z.string().min(1),
      roomId: z.string().optional(),
      puzzleId: z.string().optional(),
      citationIds: z.array(z.string()).optional(),
      correct: z.boolean().optional()
    })
  ),
  recentRetrievals: z.array(evidenceBundleSchema)
});
