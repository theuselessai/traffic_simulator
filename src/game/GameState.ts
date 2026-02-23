import type { Entity } from "../entities/Entity";

export enum TrafficPhase {
  NS_GREEN = "NS_GREEN",
  NS_YELLOW = "NS_YELLOW",
  ALL_RED_1 = "ALL_RED_1",
  EW_GREEN = "EW_GREEN",
  EW_YELLOW = "EW_YELLOW",
  ALL_RED_2 = "ALL_RED_2",
  SCRAMBLE = "SCRAMBLE",
  SCRAMBLE_FLASH = "SCRAMBLE_FLASH",
  ALL_RED_3 = "ALL_RED_3",
}

export interface GameState {
  trafficPhase: TrafficPhase;
  phaseElapsed: number; // seconds elapsed in current phase
  entities: Map<number, Entity>;
  nextEntityId: number;
  timeOfDay: number; // 0-24 hours (fractional)
}

export function createGameState(): GameState {
  return {
    trafficPhase: TrafficPhase.NS_GREEN,
    phaseElapsed: 0,
    entities: new Map(),
    nextEntityId: 1,
    timeOfDay: 12, // start at noon
  };
}
