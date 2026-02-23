import type { Container } from "pixi.js";

export type EntityType = "vehicle" | "pedestrian" | "cyclist";
export type Direction = "n" | "s" | "e" | "w";
export type PedDirection = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

export type SpeedState = "cruising" | "decelerating" | "stopped" | "accelerating";

export interface Entity {
  id: number;
  type: EntityType;
  x: number;
  y: number;
  /** Current speed in px/frame (mutable — changes during braking/acceleration) */
  currentSpeed: number;
  /** Cruise speed in px/frame (the constant target speed for this entity) */
  cruiseSpeed: number;
  direction: Direction | PedDirection;
  sprite: Container;
  state: "moving" | "waiting" | "despawning";
  /** Fine-grained speed state for vehicles */
  speedState: SpeedState;
  variant: string;
  animFrame: number;
  animTimer: number;
  // For vehicles: lane assignment
  lane?: number;
  // Length of the entity along its direction of travel (sprite height for N/S, width for E/W)
  length?: number;
  // For pedestrians: target position
  targetX?: number;
  targetY?: number;
  // Path for pedestrians
  path?: { x: number; y: number }[];
  pathIndex?: number;
}
