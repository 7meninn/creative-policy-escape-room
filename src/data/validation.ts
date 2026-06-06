import type {
  ClassificationPuzzle,
  PolicySourcePack,
  RedactionPuzzle,
  Room,
  RoomPack,
  RoomPackValidationResult,
  SequencePuzzle
} from "../types";

export function validateRoomPack(
  roomPack: RoomPack,
  policySources: PolicySourcePack
): RoomPackValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sourceSectionIds = buildSourceSectionIds(policySources);
  const allCitationIds = collectCitationIds(roomPack, errors);
  const clueIds = new Set<string>();
  let citationCheckCount = 0;

  if (roomPack.rooms.length === 0) {
    errors.push("Room pack must include at least one room.");
  }

  for (const room of roomPack.rooms) {
    validateRoom(room, sourceSectionIds, allCitationIds, clueIds, errors);
    citationCheckCount += countCitationChecks(room);
  }

  if (roomPack.packId !== policySources.packId) {
    errors.push(
      `Room pack '${roomPack.packId}' does not match policy source pack '${policySources.packId}'.`
    );
  }

  if (!roomPack.disclaimer.toLowerCase().includes("synthetic demo content")) {
    warnings.push("Room pack disclaimer should explicitly label synthetic demo content.");
  }

  for (const source of policySources.sources) {
    if (!source.disclaimer.toLowerCase().includes("synthetic demo content")) {
      warnings.push(`${source.id} disclaimer should explicitly label synthetic demo content.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    citationCheckCount,
    roomCount: roomPack.rooms.length,
    sourceCount: policySources.sources.length
  };
}

function validateRoom(
  room: Room,
  sourceSectionIds: Set<string>,
  allCitationIds: Set<string>,
  globalClueIds: Set<string>,
  errors: string[]
) {
  const roomClueIds = new Set(room.clues.map((clue) => clue.clueId));

  if (room.puzzle.roomId !== room.roomId) {
    errors.push(`${room.puzzle.puzzleId} points to room '${room.puzzle.roomId}', not '${room.roomId}'.`);
  }

  for (const clue of room.clues) {
    if (globalClueIds.has(clue.clueId)) {
      errors.push(`Duplicate clue ID '${clue.clueId}'.`);
    }
    globalClueIds.add(clue.clueId);
  }

  for (const sceneObject of room.sceneObjects) {
    for (const clueId of sceneObject.clueIds) {
      if (!roomClueIds.has(clueId)) {
        errors.push(`${sceneObject.objectId} references missing clue '${clueId}'.`);
      }
    }
  }

  if (room.puzzle.citations.length === 0) {
    errors.push(`${room.puzzle.puzzleId} must include at least one citation.`);
  }

  for (const citation of room.puzzle.citations) {
    if (!sourceSectionIds.has(sourceSectionKey(citation.sourceId, citation.sectionId))) {
      errors.push(
        `${citation.citationId} references missing source section '${citation.sourceId}#${citation.sectionId}'.`
      );
    }
  }

  for (const clue of room.clues) {
    for (const citationId of clue.citationIds) {
      if (!allCitationIds.has(citationId)) {
        errors.push(`${clue.clueId} references missing citation '${citationId}'.`);
      }
    }
  }

  for (const hint of room.puzzle.hints) {
    for (const citationId of hint.citationIds) {
      if (!allCitationIds.has(citationId)) {
        errors.push(`${room.puzzle.puzzleId} hint '${hint.label}' references missing citation '${citationId}'.`);
      }
    }
  }

  validatePuzzleShape(room.puzzle, errors);
}

function validatePuzzleShape(
  puzzle: SequencePuzzle | ClassificationPuzzle | RedactionPuzzle,
  errors: string[]
) {
  if (puzzle.type === "sequence_lock") {
    const stepIds = new Set(puzzle.steps.map((step) => step.optionId));
    for (const stepId of puzzle.correctOrder) {
      if (!stepIds.has(stepId)) {
        errors.push(`${puzzle.puzzleId} correct order references missing step '${stepId}'.`);
      }
    }
    return;
  }

  if (puzzle.type === "classification_lock") {
    const artifactIds = new Set(puzzle.artifacts.map((artifact) => artifact.artifactId));
    const categoryIds = new Set(puzzle.categories.map((category) => category.categoryId));
    for (const [artifactId, categoryId] of Object.entries(puzzle.correctCategories)) {
      if (!artifactIds.has(artifactId)) {
        errors.push(`${puzzle.puzzleId} answer references missing artifact '${artifactId}'.`);
      }
      if (!categoryIds.has(categoryId)) {
        errors.push(`${puzzle.puzzleId} answer references missing category '${categoryId}'.`);
      }
    }
    return;
  }

  const fragmentIds = new Set(puzzle.fragments.map((fragment) => fragment.fragmentId));
  for (const fragmentId of puzzle.correctRedactions) {
    if (!fragmentIds.has(fragmentId)) {
      errors.push(`${puzzle.puzzleId} redaction references missing fragment '${fragmentId}'.`);
    }
  }
}

function buildSourceSectionIds(policySources: PolicySourcePack) {
  const keys = new Set<string>();
  for (const source of policySources.sources) {
    for (const section of source.sections) {
      keys.add(sourceSectionKey(source.id, section.id));
    }
  }
  return keys;
}

function collectCitationIds(roomPack: RoomPack, errors: string[]) {
  const citationIds = new Set<string>();
  for (const room of roomPack.rooms) {
    for (const citation of room.puzzle.citations) {
      if (citationIds.has(citation.citationId)) {
        errors.push(`Duplicate citation ID '${citation.citationId}'.`);
      }
      citationIds.add(citation.citationId);
    }
  }
  return citationIds;
}

function sourceSectionKey(sourceId: string, sectionId: string) {
  return `${sourceId}#${sectionId}`;
}

function countCitationChecks(room: Room) {
  return (
    room.puzzle.citations.length +
    room.clues.reduce((total, clue) => total + clue.citationIds.length, 0) +
    room.puzzle.hints.reduce((total, hint) => total + hint.citationIds.length, 0)
  );
}
