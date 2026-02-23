import type { Container } from "pixi.js";

export type EntityType = "vehicle" | "pedestrian" | "cyclist";
export type Direction = "n" | "s" | "e" | "w";
export type PedDirection = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

export interface Entity {
  id: number;
  type: EntityType;
  x: number;
  y: number;
  speed: number;
  direction: Direction | PedDirection;
  sprite: Container;
  state: "moving" | "waiting" | "despawning";
  variant: string;
  animFrame: number;
  animTimer: number;
  // For vehicles: lane assignment
  lane?: number;
  // For pedestrians: target position
  targetX?: number;
  targetY?: number;
  // Path for pedestrians
  path?: { x: number; y: number }[];
  pathIndex?: number;
}
