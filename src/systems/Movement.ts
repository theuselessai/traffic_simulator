import { Spritesheet } from "pixi.js";
import { GameState } from "../game/GameState";
import type { SceneLayers } from "../scene/SceneBuilder";
import type { Entity, Direction } from "../entities/Entity";
import {
  SCENE_W, SCENE_H,
  EW_ROAD_TOP, EW_ROAD_BOTTOM, NS_ROAD_LEFT, NS_ROAD_RIGHT,
  ZEBRA_WIDTH, TILE,
  IX_CENTER_X, IX_CENTER_Y
} from "../scene/Road";
import { canVehicleGo, shouldVehicleSlow, isPedestrianFlashing } from "./TrafficLight";

// Stop line positions for each direction of travel
function getStopLinePos(dir: Direction): number {
  switch (dir) {
    case "s": return EW_ROAD_TOP - ZEBRA_WIDTH - TILE; // approaching from north
    case "n": return EW_ROAD_BOTTOM + ZEBRA_WIDTH + TILE; // approaching from south
    case "e": return NS_ROAD_LEFT - ZEBRA_WIDTH - TILE; // approaching from west
    case "w": return NS_ROAD_RIGHT + ZEBRA_WIDTH + TILE; // approaching from east
  }
}

function isApproachingStopLine(entity: Entity): boolean {
  const stopPos = getStopLinePos(entity.direction as Direction);
  const dir = entity.direction as Direction;

  switch (dir) {
    case "s": return entity.y < stopPos && entity.y > stopPos - 80;
    case "n": return entity.y > stopPos && entity.y < stopPos + 80;
    case "e": return entity.x < stopPos && entity.x > stopPos - 80;
    case "w": return entity.x > stopPos && entity.x < stopPos + 80;
  }
  return false;
}

function isAtStopLine(entity: Entity): boolean {
  const stopPos = getStopLinePos(entity.direction as Direction);
  const dir = entity.direction as Direction;
  const threshold = 3;

  switch (dir) {
    case "s": return Math.abs(entity.y - stopPos) < threshold;
    case "n": return Math.abs(entity.y - stopPos) < threshold;
    case "e": return Math.abs(entity.x - stopPos) < threshold;
    case "w": return Math.abs(entity.x - stopPos) < threshold;
  }
  return false;
}

function isPastStopLine(entity: Entity): boolean {
  const stopPos = getStopLinePos(entity.direction as Direction);
  const dir = entity.direction as Direction;

  switch (dir) {
    case "s": return entity.y > stopPos;
    case "n": return entity.y < stopPos;
    case "e": return entity.x > stopPos;
    case "w": return entity.x < stopPos;
  }
  return false;
}

function isOffScreen(entity: Entity): boolean {
  const margin = 60;
  return entity.x < -margin || entity.x > SCENE_W + margin ||
         entity.y < -margin || entity.y > SCENE_H + margin;
}

function getVelocity(dir: Direction | string, speed: number): { vx: number; vy: number } {
  switch (dir) {
    case "n": return { vx: 0, vy: -speed };
    case "s": return { vx: 0, vy: speed };
    case "e": return { vx: speed, vy: 0 };
    case "w": return { vx: -speed, vy: 0 };
    case "ne": return { vx: speed * 0.707, vy: -speed * 0.707 };
    case "nw": return { vx: -speed * 0.707, vy: -speed * 0.707 };
    case "se": return { vx: speed * 0.707, vy: speed * 0.707 };
    case "sw": return { vx: -speed * 0.707, vy: speed * 0.707 };
    default: return { vx: 0, vy: 0 };
  }
}

// Check following distance - find closest vehicle ahead in same lane
function hasVehicleAhead(entity: Entity, state: GameState): boolean {
  const minDist = 30;
  for (const [, other] of state.entities) {
    if (other.id === entity.id) continue;
    if (other.type !== "vehicle" && other.type !== "cyclist") continue;
    if (other.direction !== entity.direction) continue;
    if (other.lane !== entity.lane) continue;

    const dir = entity.direction as Direction;
    switch (dir) {
      case "s":
        if (other.y > entity.y && other.y - entity.y < minDist) return true;
        break;
      case "n":
        if (other.y < entity.y && entity.y - other.y < minDist) return true;
        break;
      case "e":
        if (other.x > entity.x && other.x - entity.x < minDist) return true;
        break;
      case "w":
        if (other.x < entity.x && entity.x - other.x < minDist) return true;
        break;
    }
  }
  return false;
}

function updateVehicle(entity: Entity, state: GameState, dt: number) {
  const dir = entity.direction as Direction;

  if (entity.state === "moving") {
    // Check if we need to stop at red/yellow light
    if (!isPastStopLine(entity) && isApproachingStopLine(entity)) {
      if (!canVehicleGo(state, dir)) {
        if (shouldVehicleSlow(entity as any, dir)) {
          // Yellow: if close to stop line (within 30px), continue through
          const stopPos = getStopLinePos(dir);
          const dist = dir === "s" ? stopPos - entity.y :
                       dir === "n" ? entity.y - stopPos :
                       dir === "e" ? stopPos - entity.x :
                       entity.x - stopPos;
          if (dist > 30) {
            entity.state = "waiting";
          }
        } else {
          // Red light - stop
          entity.state = "waiting";
        }
      }
    }

    // Check following distance
    if (hasVehicleAhead(entity, state)) {
      // Slow down but don't fully stop (reduce speed)
      const { vx, vy } = getVelocity(dir, entity.speed * 0.3);
      entity.x += vx * dt;
      entity.y += vy * dt;
    } else {
      const { vx, vy } = getVelocity(dir, entity.speed);
      entity.x += vx * dt;
      entity.y += vy * dt;
    }
  } else if (entity.state === "waiting") {
    // Check if light turned green
    if (canVehicleGo(state, dir)) {
      entity.state = "moving";
    }
    // Also check if vehicle ahead moved
    if (!hasVehicleAhead(entity, state) && isPastStopLine(entity)) {
      entity.state = "moving";
    }
  }

  // Update sprite position
  entity.sprite.x = entity.x;
  entity.sprite.y = entity.y;
  entity.sprite.zIndex = entity.y;

  // Despawn if off screen
  if (isOffScreen(entity)) {
    entity.state = "despawning";
  }
}

function updatePedestrian(entity: Entity, state: GameState, dt: number) {
  if (entity.targetX === undefined || entity.targetY === undefined) {
    entity.state = "despawning";
    return;
  }

  const dx = entity.targetX - entity.x;
  const dy = entity.targetY - entity.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 3) {
    entity.state = "despawning";
    return;
  }

  // Speed up during flashing phase
  let speed = entity.speed;
  if (isPedestrianFlashing(state)) {
    speed *= 1.3;
  }

  const nx = dx / dist;
  const ny = dy / dist;
  entity.x += nx * speed * dt;
  entity.y += ny * speed * dt;

  // Walk animation
  entity.animTimer += dt;
  if (entity.animTimer > 0.15) {
    entity.animTimer = 0;
    entity.animFrame = (entity.animFrame + 1) % 4;
  }

  entity.sprite.x = entity.x;
  entity.sprite.y = entity.y;
  entity.sprite.zIndex = entity.y;

  if (isOffScreen(entity)) {
    entity.state = "despawning";
  }
}

function updateCyclist(entity: Entity, state: GameState, dt: number) {
  // Cyclists use same logic as vehicles
  updateVehicle(entity, state, dt);

  // Pedal animation
  entity.animTimer += dt;
  if (entity.animTimer > 0.3) {
    entity.animTimer = 0;
    entity.animFrame = entity.animFrame === 0 ? 1 : 0;
  }
}

export function updateMovement(
  state: GameState,
  dt: number,
  layers: SceneLayers
) {
  const toRemove: number[] = [];

  for (const [id, entity] of state.entities) {
    switch (entity.type) {
      case "vehicle":
        updateVehicle(entity, state, dt);
        break;
      case "pedestrian":
        updatePedestrian(entity, state, dt);
        break;
      case "cyclist":
        updateCyclist(entity, state, dt);
        break;
    }

    if (entity.state === "despawning") {
      toRemove.push(id);
    }
  }

  // Remove despawned entities
  for (const id of toRemove) {
    const entity = state.entities.get(id);
    if (entity) {
      entity.sprite.removeFromParent();
      entity.sprite.destroy();
      state.entities.delete(id);
    }
  }
}
