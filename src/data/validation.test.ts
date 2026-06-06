import { describe, expect, it } from "vitest";
import { policySources, roomPack, roomPackValidation } from "./rooms";
import { validateRoomPack } from "./validation";
import { policySourcePackSchema, roomPackSchema } from "../schemas";
import type { RoomPack } from "../types";

describe("data schemas", () => {
  it("parses the synthetic policy sources and room pack", () => {
    expect(policySourcePackSchema.parse(policySources).sources).toHaveLength(6);
    expect(roomPackSchema.parse(roomPack).rooms).toHaveLength(3);
  });
});

describe("validateRoomPack", () => {
  it("passes the canonical synthetic room pack", () => {
    expect(roomPackValidation.valid).toBe(true);
    expect(roomPackValidation.errors).toEqual([]);
    expect(roomPackValidation.citationCheckCount).toBeGreaterThan(0);
  });

  it("fails when a clue references a missing citation", () => {
    const invalidPack = cloneRoomPack();
    invalidPack.rooms[0].clues[0].citationIds = ["MISSING-CITATION"];

    const result = validateRoomPack(invalidPack, policySources);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "inbox-clue-email references missing citation 'MISSING-CITATION'."
    );
  });

  it("fails when a citation points to a missing policy section", () => {
    const invalidPack = cloneRoomPack();
    invalidPack.rooms[0].puzzle.citations[0].sectionId = "99.9";

    const result = validateRoomPack(invalidPack, policySources);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "CIT-PHISH-31 references missing source section 'SYN-POL-002#99.9'."
    );
  });

  it("fails when citation IDs are duplicated", () => {
    const invalidPack = cloneRoomPack();
    invalidPack.rooms[1].puzzle.citations[0].citationId =
      invalidPack.rooms[0].puzzle.citations[0].citationId;

    const result = validateRoomPack(invalidPack, policySources);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Duplicate citation ID 'CIT-PHISH-31'.");
  });

  it("fails when a puzzle is uncited", () => {
    const invalidPack = cloneRoomPack();
    invalidPack.rooms[2].puzzle.citations = [];

    const result = validateRoomPack(invalidPack, policySources);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "puzzle-ai-redaction must include at least one citation."
    );
  });
});

function cloneRoomPack(): RoomPack {
  return structuredClone(roomPack);
}
