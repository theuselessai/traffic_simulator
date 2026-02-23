import { GameState } from "../game/GameState";
import type { SceneLayers } from "../scene/SceneBuilder";
import type { Entity, Direction, SpeedState } from "../entities/Entity";
import {
  SCENE_W, SCENE_H,
  EW_ROAD_TOP, EW_ROAD_BOTTOM, NS_ROAD_LEFT, NS_ROAD_RIGHT,
  ZEBRA_WIDTH, ZEBRA_WIDTH_N, TILE,
} from "../scene/Road";
import { canVehicleGo, shouldVehicleSlow, isPedestrianFlashing } from "./TrafficLight";

// Physics constants (per-second, converted to per-frame in update via dt)
const DECELERATION = 120; // px/s² (≈0.12 px/frame² at 30fps → 0.12*30²=108, rounded up)
const ACCELERATION = 80;  // px/s² (≈0.08 px/frame² at 30fps → 0.08*30²=72, rounded up)
const VEHICLE_GAP = 6;
const CYCLIST_GAP = 4;
const DEPARTURE_GAP = 12; // gap that must open before the next car departs

// ---- Geometry helpers ----

function getStopLinePos(dir: Direction): number {
  switch (dir) {
    case "s": return EW_ROAD_TOP - ZEBRA_WIDTH_N - TILE;  // compact north crossing
    case "n": return EW_ROAD_BOTTOM + ZEBRA_WIDTH + TILE;
    case "e": return NS_ROAD_LEFT - ZEBRA_WIDTH - TILE;
    case "w": return NS_ROAD_RIGHT + ZEBRA_WIDTH + TILE;
  }
}

/** Position along the axis of travel */
function posAlong(entity: Entity, dir: Direction): number {
  return (dir === "n" || dir === "s") ? entity.y : entity.x;
}

/** Front edge position (the edge facing the direction of travel) */
function frontPos(entity: Entity, dir: Direction): number {
  const halfLen = (entity.length ?? 20) / 2;
  switch (dir) {
    case "s": return entity.y + halfLen;
    case "n": return entity.y - halfLen;
    case "e": return entity.x + halfLen;
    case "w": return entity.x - halfLen;
  }
}

/** Rear edge position (the edge facing away from travel) */
function rearPos(entity: Entity, dir: Direction): number {
  const halfLen = (entity.length ?? 20) / 2;
  switch (dir) {
    case "s": return entity.y - halfLen;
    case "n": return entity.y + halfLen;
    case "e": return entity.x - halfLen;
    case "w": return entity.x + halfLen;
  }
}

/** Signed distance from entity's front edge to a target position along travel axis.
 *  Positive = target is still ahead, negative = already past it. */
function distFrontTo(entity: Entity, targetPos: number, dir: Direction): number {
  const front = frontPos(entity, dir);
  switch (dir) {
    case "s": return targetPos - front;
    case "n": return front - targetPos;
    case "e": return targetPos - front;
    case "w": return front - targetPos;
  }
}

function isPastStopLine(entity: Entity, dir: Direction): boolean {
  return distFrontTo(entity, getStopLinePos(dir), dir) < 0;
}

function isOffScreen(entity: Entity): boolean {
  const margin = 60;
  return entity.x < -margin || entity.x > SCENE_W + margin ||
         entity.y < -margin || entity.y > SCENE_H + margin;
}

/** Find the closest entity ahead in the same lane+direction.
 *  Returns the gap from our front edge to their rear edge, and a ref to them. */
function findVehicleAhead(
  entity: Entity,
  state: GameState,
  dir: Direction
): { other: Entity; gap: number } | null {
  let closest: { other: Entity; gap: number } | null = null;
  const myFront = frontPos(entity, dir);

  for (const [, other] of state.entities) {
    if (other.id === entity.id) continue;
    if (other.type !== "vehicle" && other.type !== "cyclist") continue;
    if (other.direction !== dir) continue;
    if (other.lane !== entity.lane) continue;

    const otherRear = rearPos(other, dir);

    // Gap from my front to their rear (positive = they are ahead with space between)
    let gap: number;
    switch (dir) {
      case "s": gap = otherRear - myFront; break;
      case "n": gap = myFront - otherRear; break;
      case "e": gap = otherRear - myFront; break;
      case "w": gap = myFront - otherRear; break;
    }

    // Only consider entities that are actually ahead (gap > some negative tolerance)
    if (gap < -(entity.length ?? 20)) continue; // overlapping or behind us

    if (closest === null || gap < closest.gap) {
      closest = { other, gap };
    }
  }

  return closest;
}

/** Compute the furthest-forward position our front edge can occupy right now.
 *  This is the min of (stop line, rear of vehicle ahead − gap). */
function computeTargetFrontPos(
  entity: Entity,
  state: GameState,
  dir: Direction,
  lightIsRed: boolean
): number | null {
  const gap = entity.type === "cyclist" ? CYCLIST_GAP : VEHICLE_GAP;
  let target: number | null = null;

  // Stop line constraint (only if light is red/yellow and we haven't passed it)
  if (lightIsRed && !isPastStopLine(entity, dir)) {
    target = getStopLinePos(dir);
  }

  // Vehicle-ahead constraint (always applies, regardless of light)
  const ahead = findVehicleAhead(entity, state, dir);
  if (ahead) {
    const otherRear = rearPos(ahead.other, dir);
    let behindPos: number;
    switch (dir) {
      case "s": behindPos = otherRear - gap; break;
      case "n": behindPos = otherRear + gap; break;
      case "e": behindPos = otherRear - gap; break;
      case "w": behindPos = otherRear + gap; break;
    }

    if (target === null) {
      target = behindPos;
    } else {
      // Take the more conservative (further back)
      switch (dir) {
        case "s": target = Math.min(target, behindPos); break;
        case "n": target = Math.max(target, behindPos); break;
        case "e": target = Math.min(target, behindPos); break;
        case "w": target = Math.max(target, behindPos); break;
      }
    }
  }

  return target;
}

/** Braking distance from current speed: d = v² / (2a) */
function brakingDistance(speed: number): number {
  return (speed * speed) / (2 * DECELERATION);
}

// ---- Main vehicle update ----

function updateVehicle(entity: Entity, state: GameState, dt: number) {
  const dir = entity.direction as Direction;

  // Determine if the light is blocking us
  const lightGreen = canVehicleGo(state, dir);
  const lightYellow = shouldVehicleSlow(state, dir);
  const lightBlocking = !lightGreen; // red or yellow or scramble

  // If yellow and we're close to the stop line, treat as green (run the yellow)
  let effectivelyBlocked = lightBlocking;
  if (lightYellow && !isPastStopLine(entity, dir)) {
    const distToStop = distFrontTo(entity, getStopLinePos(dir), dir);
    if (distToStop >= 0 && distToStop < 30) {
      effectivelyBlocked = false; // close enough, run it
    }
  }
  // If we've already passed the stop line, never block
  if (isPastStopLine(entity, dir)) {
    effectivelyBlocked = false;
  }

  // Compute the target front position (where our front edge should not exceed)
  const targetFront = computeTargetFrontPos(entity, state, dir, effectivelyBlocked);

  // Distance from our front edge to that target
  let distToTarget = Infinity;
  if (targetFront !== null) {
    distToTarget = distFrontTo(entity, targetFront, dir);
    if (distToTarget < 0) distToTarget = 0; // already at or past target
  }

  // ---- Speed state machine ----
  const prevState = entity.speedState;

  if (distToTarget <= 0 && entity.currentSpeed <= 0) {
    // At target and stopped
    entity.speedState = "stopped";
    entity.currentSpeed = 0;
  } else if (distToTarget < brakingDistance(entity.currentSpeed) && distToTarget < Infinity) {
    // Need to brake
    entity.speedState = "decelerating";
  } else if (entity.speedState === "stopped") {
    // We're stopped — check if we should start moving
    if (targetFront === null) {
      // No obstacle — accelerate
      entity.speedState = "accelerating";
    } else if (distToTarget > DEPARTURE_GAP) {
      // Enough gap opened ahead — accelerate
      entity.speedState = "accelerating";
    }
    // else: stay stopped, gap hasn't opened yet
  } else if (entity.currentSpeed < entity.cruiseSpeed) {
    entity.speedState = "accelerating";
  } else {
    entity.speedState = "cruising";
  }

  // ---- Apply speed changes ----
  switch (entity.speedState) {
    case "cruising":
      entity.currentSpeed = entity.cruiseSpeed;
      break;
    case "decelerating": {
      entity.currentSpeed -= DECELERATION * dt;
      if (entity.currentSpeed < 0) entity.currentSpeed = 0;
      // If we'd overshoot the target at this speed, clamp
      if (distToTarget <= 0) {
        entity.currentSpeed = 0;
      }
      break;
    }
    case "stopped":
      entity.currentSpeed = 0;
      break;
    case "accelerating":
      entity.currentSpeed += ACCELERATION * dt;
      if (entity.currentSpeed > entity.cruiseSpeed) {
        entity.currentSpeed = entity.cruiseSpeed;
      }
      break;
  }

  // ---- Apply movement (the ONLY place position is modified) ----
  if (entity.currentSpeed > 0) {
    const spd = entity.currentSpeed;
    switch (dir) {
      case "s": entity.y += spd * dt; break;
      case "n": entity.y -= spd * dt; break;
      case "e": entity.x += spd * dt; break;
      case "w": entity.x -= spd * dt; break;
    }

    // Prevent overshooting the target position
    if (targetFront !== null && entity.speedState === "decelerating") {
      const overshoot = -distFrontTo(entity, targetFront, dir);
      if (overshoot > 0) {
        // Nudge back by overshoot amount
        switch (dir) {
          case "s": entity.y -= overshoot; break;
          case "n": entity.y += overshoot; break;
          case "e": entity.x -= overshoot; break;
          case "w": entity.x += overshoot; break;
        }
        entity.currentSpeed = 0;
        entity.speedState = "stopped";
      }
    }
  }

  // Keep high-level state in sync for spawner/other systems
  entity.state = entity.currentSpeed > 0 ? "moving" : (isOffScreen(entity) ? "despawning" : "waiting");

  // Update sprite
  entity.sprite.x = entity.x;
  entity.sprite.y = entity.y;
  entity.sprite.zIndex = entity.y;

  if (isOffScreen(entity)) {
    entity.state = "despawning";
  }
}

// ---- Pedestrian (unchanged physics — they don't queue) ----

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

  let speed = entity.cruiseSpeed;
  if (isPedestrianFlashing(state)) {
    speed *= 1.3;
  }

  const nx = dx / dist;
  const ny = dy / dist;
  entity.x += nx * speed * dt;
  entity.y += ny * speed * dt;

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

// ---- Cyclist (uses vehicle logic + pedal anim) ----

function updateCyclist(entity: Entity, state: GameState, dt: number) {
  updateVehicle(entity, state, dt);

  entity.animTimer += dt;
  if (entity.animTimer > 0.3) {
    entity.animTimer = 0;
    entity.animFrame = entity.animFrame === 0 ? 1 : 0;
  }
}

// ---- Public entry point ----

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

  for (const id of toRemove) {
    const entity = state.entities.get(id);
    if (entity) {
      entity.sprite.removeFromParent();
      entity.sprite.destroy();
      state.entities.delete(id);
    }
  }
}
