import { policyPack } from "../data/rooms";
import type {
  AgentStep,
  GeneratedRoomPack,
  GenerationRequest,
  GenerationResult,
  VerifierResult
} from "../types";
import { writeGeneratedDebrief } from "./debriefWriter";
import { makePuzzle } from "./puzzleMaker";
import { designRoom } from "./roomDesigner";
import { curateSources } from "./sourceCurator";

export function generateRoomDraft(
  request: GenerationRequest,
  verifyRoom: (roomPack: GeneratedRoomPack) => VerifierResult
): GenerationResult {
  const sourceCurator = curateSources(request);
  const roomDesigner = designRoom(sourceCurator.evidence);
  const puzzleMaker = makePuzzle(roomDesigner.roomDraft, sourceCurator.evidence);
  const roomPack = buildGeneratedRoomPack([puzzleMaker.room]);
  const verifierResult = verifyRoom(roomPack);
  const debriefWriter = writeGeneratedDebrief(puzzleMaker.room);
  const verifierStep: AgentStep = {
    stepId: "verifier",
    agentName: "Verifier",
    status: verifierResult.valid ? "passed" : "blocked",
    summary: verifierResult.valid
      ? "Generated room passed schema, citation, and safety checks."
      : `Generated room blocked by ${verifierResult.errors.length} verifier errors.`,
    citationIds: puzzleMaker.room.puzzle.citations.map(
      (citation) => citation.citationId
    )
  };

  return {
    request,
    evidence: sourceCurator.evidence,
    room: puzzleMaker.room,
    roomPack,
    verifierResult,
    debrief: debriefWriter.debrief,
    agentSteps: [
      sourceCurator.step,
      roomDesigner.step,
      puzzleMaker.step,
      verifierStep,
      debriefWriter.step
    ]
  };
}

function buildGeneratedRoomPack(rooms: GeneratedRoomPack["rooms"]): GeneratedRoomPack {
  return {
    packId: policyPack.id,
    title: "Generated Mock Identity Room",
    retrievalMode: "generated_mock",
    disclaimer: policyPack.disclaimer,
    rooms
  };
}
