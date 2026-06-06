import { policySources } from "../data/rooms";
import { validateRoomPack } from "../data/validation";
import { roomPackSchema } from "../schemas";
import type {
  GeneratedRoomPack,
  PolicySourcePack,
  Room,
  RoomPack,
  VerifierResult
} from "../types";

const PROMPT_INJECTION_PATTERNS = [
  "ignore previous instructions",
  "reveal secrets",
  "disable safety",
  "system prompt",
  "developer message"
];

export function verifyGeneratedRoomPack(
  candidate: unknown,
  sourcePack: PolicySourcePack = policySources
): VerifierResult {
  const parsed = roomPackSchema.safeParse(candidate);

  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "roomPack"}: ${issue.message}`
      ),
      warnings: [],
      safetyFlags: [],
      roomPackValidation: {
        valid: false,
        errors: ["Generated room pack failed schema validation."],
        warnings: [],
        citationCheckCount: 0,
        roomCount: 0,
        sourceCount: sourcePack.sources.length
      }
    };
  }

  const roomPack = parsed.data as RoomPack;
  const roomPackValidation = validateRoomPack(roomPack, sourcePack);
  const safetyFlags = detectSafetyFlags(roomPack.rooms);
  const errors = [...roomPackValidation.errors];

  if (roomPack.retrievalMode !== "generated_mock") {
    errors.push("Generated room pack must use retrievalMode 'generated_mock'.");
  }

  if (safetyFlags.length > 0) {
    errors.push("Generated room pack contains unsafe prompt-injection-like text.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: roomPackValidation.warnings,
    safetyFlags,
    roomPackValidation: {
      ...roomPackValidation,
      valid: errors.length === 0,
      errors
    }
  };
}

export function verifyGeneratedRoom(
  roomPack: GeneratedRoomPack,
  sourcePack: PolicySourcePack = policySources
) {
  return verifyGeneratedRoomPack(roomPack, sourcePack);
}

function detectSafetyFlags(rooms: Room[]) {
  const flags = new Set<string>();
  const text = JSON.stringify(rooms).toLowerCase();

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (text.includes(pattern)) {
      flags.add(`prompt_injection:${pattern}`);
    }
  }

  return Array.from(flags);
}
