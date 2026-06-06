import roomPackJson from "../../data/synthetic-policy-packs/synthetic-cybersecurity-onboarding/room-pack.json";
import policySourcesJson from "../../data/synthetic-policy-packs/synthetic-cybersecurity-onboarding/policy-sources.json";
import { policySourcePackSchema, roomPackSchema } from "../schemas";
import type { PolicyPack, PolicySourcePack, Room, RoomPack } from "../types";
import { validateRoomPack } from "./validation";

export const policySources: PolicySourcePack =
  policySourcePackSchema.parse(policySourcesJson);

export const roomPack: RoomPack = roomPackSchema.parse(roomPackJson);

export const roomPackValidation = validateRoomPack(roomPack, policySources);

export const policyPack: PolicyPack = {
  id: roomPack.packId,
  title: roomPack.title,
  retrievalMode: roomPack.retrievalMode,
  disclaimer: roomPack.disclaimer
};

export const rooms: Room[] = roomPack.rooms;
