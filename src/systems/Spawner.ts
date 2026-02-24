import { Sprite, Spritesheet } from "pixi.js";
import { GameState, TrafficPhase } from "../game/GameState";
import type { SceneLayers } from "../scene/SceneBuilder";
import type { Entity, Direction, Waypoint } from "../entities/Entity";
import {
  SCENE_W, SCENE_H, nsLaneX, ewLaneY,
  NS_ROAD_LEFT, NS_ROAD_RIGHT, EW_ROAD_TOP, EW_ROAD_BOTTOM,
} from "../scene/Road";
import { computeDirection } from "./Movement";

// Spawn timers
let vehicleTimer = 0;
let cyclistTimer = 0;
let pedTimer = 0;
let crosserBurstSpawned = false;
let lastPhaseForBurst: TrafficPhase | null = null;

// Vehicle type weights
const VEHICLE_TYPES = [
  { type: "sedan", weight: 50 },
  { type: "taxi", weight: 20 },
  { type: "bus", weight: 10 },
  { type: "kei_truck", weight: 15 },
  { type: "police", weight: 5 },
];

const SEDAN_COLORS = ["red", "blue", "white", "black"];

function weightedRandom<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

function spawnVehicle(state: GameState, layers: SceneLayers, sheet: Spritesheet) {
  const dir: Direction = (["n", "s", "e", "w"] as const)[Math.floor(Math.random() * 4)];
  const vType = weightedRandom(VEHICLE_TYPES).type;

  // Pick lane (0-1 for one direction, 2-3 for opposite)
  let lane: number;
  if (dir === "s") lane = Math.random() < 0.5 ? 0 : 1;
  else if (dir === "n") lane = Math.random() < 0.5 ? 2 : 3;
  else if (dir === "e") lane = Math.random() < 0.5 ? 0 : 1;
  else lane = Math.random() < 0.5 ? 2 : 3;

  // Starting position (off screen)
  let x: number, y: number;
  if (dir === "s") { x = nsLaneX(lane); y = -40; }
  else if (dir === "n") { x = nsLaneX(lane); y = SCENE_H + 40; }
  else if (dir === "e") { x = -40; y = ewLaneY(lane); }
  else { x = SCENE_W + 40; y = ewLaneY(lane); }

  // Check for too-close existing vehicles
  for (const [, e] of state.entities) {
    if (e.type !== "vehicle") continue;
    if (e.direction !== dir) continue;
    const dist = Math.abs(e.x - x) + Math.abs(e.y - y);
    if (dist < 40) return; // too close, skip spawn
  }

  let frameName: string;
  if (vType === "sedan") {
    const color = SEDAN_COLORS[Math.floor(Math.random() * SEDAN_COLORS.length)];
    frameName = `sedan_${color}_${dir}`;
  } else {
    frameName = `${vType}_${dir}`;
  }

  const texture = sheet.textures[frameName];
  if (!texture) return;

  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5, 0.5);
  sprite.x = x;
  sprite.y = y;
  sprite.zIndex = y;
  layers.vehicle.addChild(sprite);

  // Cruise speed in px/s with slight per-vehicle variance
  const baseCruise = vType === "bus" ? 35 : vType === "kei_truck" ? 40 : 50;
  const cruiseSpeed = baseCruise + (Math.random() - 0.5) * 4;

  // Length along direction of travel: height for N/S, width for E/W
  const length = (dir === "n" || dir === "s") ? texture.height : texture.width;

  const entity: Entity = {
    id: state.nextEntityId++,
    type: "vehicle",
    x, y,
    currentSpeed: cruiseSpeed,
    cruiseSpeed,
    direction: dir,
    sprite,
    state: "moving",
    speedState: "cruising",
    variant: vType,
    animFrame: 0,
    animTimer: 0,
    lane,
    length,
  };

  state.entities.set(entity.id, entity);
}

function spawnCyclist(state: GameState, layers: SceneLayers, sheet: Spritesheet) {
  const dir: Direction = (["n", "s", "e", "w"] as const)[Math.floor(Math.random() * 4)];
  const variant = Math.random() < 0.7 ? "commuter" : "delivery";

  // Cyclists use curb lane (lane 0 or 3)
  let lane: number;
  if (dir === "s") lane = 0;
  else if (dir === "n") lane = 3;
  else if (dir === "e") lane = 0;
  else lane = 3;

  let x: number, y: number;
  if (dir === "s") { x = nsLaneX(lane); y = -24; }
  else if (dir === "n") { x = nsLaneX(lane); y = SCENE_H + 24; }
  else if (dir === "e") { x = -24; y = ewLaneY(lane); }
  else { x = SCENE_W + 24; y = ewLaneY(lane); }

  const frameName = `cyclist_${variant}_${dir}_0`;
  const texture = sheet.textures[frameName];
  if (!texture) return;

  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5, 0.5);
  sprite.x = x;
  sprite.y = y;
  sprite.zIndex = y;
  layers.vehicle.addChild(sprite);

  const length = (dir === "n" || dir === "s") ? texture.height : texture.width;
  const cruiseSpeed = 30 + (Math.random() - 0.5) * 4;

  const entity: Entity = {
    id: state.nextEntityId++,
    type: "cyclist",
    x, y,
    currentSpeed: cruiseSpeed,
    cruiseSpeed,
    direction: dir,
    sprite,
    state: "moving",
    speedState: "cruising",
    variant,
    animFrame: 0,
    animTimer: 0,
    length,
    lane,
  };

  state.entities.set(entity.id, entity);
}

// ---- Pedestrian path system ----

const NORTH_SIDEWALK_Y = 164;
const SOUTH_SIDEWALK_Y = 270;
const BLDG_Y = 160;
const LEFT_EDGE = -10;
const RIGHT_EDGE = 810;
const MAX_PEDESTRIANS = 60;

// Building entrances (center of each building's frontage, at y=160)
const WEST_BUILDINGS = [
  { x: 330, name: "starbucks" },
  { x: 270, name: "pachinko" },
  { x: 220, name: "lawson" },
  { x: 180, name: "ramen" },
  { x: 130, name: "office_a" },
  { x: 70, name: "office_b" },
  { x: 20, name: "familymart" },
];

const EAST_BUILDINGS = [
  { x: 480, name: "qfront" },
  { x: 540, name: "seven_eleven" },
  { x: 590, name: "office_b" },
  { x: 660, name: "109" },
  { x: 730, name: "office_a" },
  { x: 780, name: "subway" },
];

// Crossing wait points and crossing endpoints
const WEST_CROSS_X = 340;
const EAST_CROSS_X = 460;
const NORTH_CROSS_WAIT_X = 314;  // just west of NS road gap
const SOUTH_CROSS_WAIT_X = 486;  // just east of NS road gap

const PED_VARIANTS = [
  { name: "office_m", weight: 40 },
  { name: "office_f", weight: 40 },
  { name: "student", weight: 25 },
  { name: "tourist", weight: 20 },
  { name: "elderly", weight: 15 },
];

function pedSpeed(variant: string): number {
  if (variant === "elderly") return 18;
  if (variant === "tourist") return 20;
  if (variant === "student") return 28;
  return 25;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomWestBldgX(): number { return pickRandom(WEST_BUILDINGS).x; }
function randomEastBldgX(): number { return pickRandom(EAST_BUILDINGS).x; }

/** Small random offset for natural variation */
function jitter(amount = 6): number { return (Math.random() - 0.5) * amount; }

// ---- Path generators ----

/** A) Sidewalk-only paths: walk within one sidewalk segment */
function generateSidewalkPath(): Waypoint[] {
  const segment = Math.floor(Math.random() * 4);
  switch (segment) {
    case 0: { // North-west
      const fromBldg = Math.random() < 0.7;
      const toBldg = Math.random() < 0.7;
      const startX = fromBldg ? randomWestBldgX() : LEFT_EDGE;
      const endX = toBldg ? randomWestBldgX() : LEFT_EDGE;
      // Ensure they're different enough
      if (Math.abs(startX - endX) < 30) return generateSidewalkPath();
      const path: Waypoint[] = [];
      if (fromBldg && startX > LEFT_EDGE) {
        path.push({ x: startX, y: BLDG_Y });
      }
      path.push({ x: startX, y: NORTH_SIDEWALK_Y });
      path.push({ x: endX, y: NORTH_SIDEWALK_Y });
      if (toBldg && endX > LEFT_EDGE) {
        path.push({ x: endX, y: BLDG_Y });
      }
      return path;
    }
    case 1: { // North-east
      const fromBldg = Math.random() < 0.7;
      const toBldg = Math.random() < 0.7;
      const startX = fromBldg ? randomEastBldgX() : RIGHT_EDGE;
      const endX = toBldg ? randomEastBldgX() : RIGHT_EDGE;
      if (Math.abs(startX - endX) < 30) return generateSidewalkPath();
      const path: Waypoint[] = [];
      if (fromBldg && startX < RIGHT_EDGE) {
        path.push({ x: startX, y: BLDG_Y });
      }
      path.push({ x: startX, y: NORTH_SIDEWALK_Y });
      path.push({ x: endX, y: NORTH_SIDEWALK_Y });
      if (toBldg && endX < RIGHT_EDGE) {
        path.push({ x: endX, y: BLDG_Y });
      }
      return path;
    }
    case 2: { // South-west (window edges only)
      const startX = LEFT_EDGE;
      const endX = NORTH_CROSS_WAIT_X - 20 - Math.random() * 80;
      const path: Waypoint[] = [];
      path.push({ x: startX, y: SOUTH_SIDEWALK_Y });
      path.push({ x: endX, y: SOUTH_SIDEWALK_Y });
      path.push({ x: startX, y: SOUTH_SIDEWALK_Y });
      return path;
    }
    case 3: { // South-east (window edges only)
      const startX = RIGHT_EDGE;
      const endX = SOUTH_CROSS_WAIT_X + 20 + Math.random() * 80;
      const path: Waypoint[] = [];
      path.push({ x: startX, y: SOUTH_SIDEWALK_Y });
      path.push({ x: endX, y: SOUTH_SIDEWALK_Y });
      path.push({ x: startX, y: SOUTH_SIDEWALK_Y });
      return path;
    }
    default: return generateSidewalkPath();
  }
}

/** B) Crosser paths: sidewalk → wait at crossing → cross → sidewalk → exit */
function generateCrosserPath(): Waypoint[] {
  const variant = Math.floor(Math.random() * 8);
  switch (variant) {
    case 0: { // N→S via west zebra
      const startX = randomWestBldgX();
      const path: Waypoint[] = [];
      path.push({ x: startX, y: BLDG_Y });
      path.push({ x: startX, y: NORTH_SIDEWALK_Y });
      path.push({ x: WEST_CROSS_X + jitter(), y: NORTH_SIDEWALK_Y });
      path.push({ x: WEST_CROSS_X + jitter(), y: NORTH_SIDEWALK_Y, waitForSignal: true });
      path.push({ x: WEST_CROSS_X + jitter(), y: SOUTH_SIDEWALK_Y });
      path.push({ x: LEFT_EDGE, y: SOUTH_SIDEWALK_Y });
      return path;
    }
    case 1: { // S→N via west zebra
      const endX = randomWestBldgX();
      const path: Waypoint[] = [];
      path.push({ x: LEFT_EDGE, y: SOUTH_SIDEWALK_Y });
      path.push({ x: WEST_CROSS_X + jitter(), y: SOUTH_SIDEWALK_Y });
      path.push({ x: WEST_CROSS_X + jitter(), y: SOUTH_SIDEWALK_Y, waitForSignal: true });
      path.push({ x: WEST_CROSS_X + jitter(), y: NORTH_SIDEWALK_Y });
      path.push({ x: endX, y: NORTH_SIDEWALK_Y });
      path.push({ x: endX, y: BLDG_Y });
      return path;
    }
    case 2: { // N→S via east zebra
      const startX = randomEastBldgX();
      const path: Waypoint[] = [];
      path.push({ x: startX, y: BLDG_Y });
      path.push({ x: startX, y: NORTH_SIDEWALK_Y });
      path.push({ x: EAST_CROSS_X + jitter(), y: NORTH_SIDEWALK_Y });
      path.push({ x: EAST_CROSS_X + jitter(), y: NORTH_SIDEWALK_Y, waitForSignal: true });
      path.push({ x: EAST_CROSS_X + jitter(), y: SOUTH_SIDEWALK_Y });
      path.push({ x: RIGHT_EDGE, y: SOUTH_SIDEWALK_Y });
      return path;
    }
    case 3: { // S→N via east zebra
      const endX = randomEastBldgX();
      const path: Waypoint[] = [];
      path.push({ x: RIGHT_EDGE, y: SOUTH_SIDEWALK_Y });
      path.push({ x: EAST_CROSS_X + jitter(), y: SOUTH_SIDEWALK_Y });
      path.push({ x: EAST_CROSS_X + jitter(), y: SOUTH_SIDEWALK_Y, waitForSignal: true });
      path.push({ x: EAST_CROSS_X + jitter(), y: NORTH_SIDEWALK_Y });
      path.push({ x: endX, y: NORTH_SIDEWALK_Y });
      path.push({ x: endX, y: BLDG_Y });
      return path;
    }
    case 4: { // W→E via north crossing
      const startX = randomWestBldgX();
      const endX = randomEastBldgX();
      const path: Waypoint[] = [];
      path.push({ x: startX, y: BLDG_Y });
      path.push({ x: startX, y: NORTH_SIDEWALK_Y });
      path.push({ x: NORTH_CROSS_WAIT_X, y: NORTH_SIDEWALK_Y, waitForSignal: true });
      path.push({ x: SOUTH_CROSS_WAIT_X, y: NORTH_SIDEWALK_Y });
      path.push({ x: endX, y: NORTH_SIDEWALK_Y });
      path.push({ x: endX, y: BLDG_Y });
      return path;
    }
    case 5: { // E→W via north crossing
      const startX = randomEastBldgX();
      const endX = randomWestBldgX();
      const path: Waypoint[] = [];
      path.push({ x: startX, y: BLDG_Y });
      path.push({ x: startX, y: NORTH_SIDEWALK_Y });
      path.push({ x: SOUTH_CROSS_WAIT_X, y: NORTH_SIDEWALK_Y, waitForSignal: true });
      path.push({ x: NORTH_CROSS_WAIT_X, y: NORTH_SIDEWALK_Y });
      path.push({ x: endX, y: NORTH_SIDEWALK_Y });
      path.push({ x: endX, y: BLDG_Y });
      return path;
    }
    case 6: { // W→E via south crossing
      const path: Waypoint[] = [];
      path.push({ x: LEFT_EDGE, y: SOUTH_SIDEWALK_Y });
      path.push({ x: NORTH_CROSS_WAIT_X, y: SOUTH_SIDEWALK_Y, waitForSignal: true });
      path.push({ x: SOUTH_CROSS_WAIT_X, y: SOUTH_SIDEWALK_Y });
      path.push({ x: RIGHT_EDGE, y: SOUTH_SIDEWALK_Y });
      return path;
    }
    case 7: { // E→W via south crossing
      const path: Waypoint[] = [];
      path.push({ x: RIGHT_EDGE, y: SOUTH_SIDEWALK_Y });
      path.push({ x: SOUTH_CROSS_WAIT_X, y: SOUTH_SIDEWALK_Y, waitForSignal: true });
      path.push({ x: NORTH_CROSS_WAIT_X, y: SOUTH_SIDEWALK_Y });
      path.push({ x: LEFT_EDGE, y: SOUTH_SIDEWALK_Y });
      return path;
    }
    default: return generateCrosserPath();
  }
}

/** C) Diagonal scramble paths */
function generateDiagonalPath(): Waypoint[] {
  const variant = Math.floor(Math.random() * 4);
  switch (variant) {
    case 0: { // NW→SE
      const startX = randomWestBldgX();
      const path: Waypoint[] = [];
      path.push({ x: startX, y: BLDG_Y });
      path.push({ x: startX, y: NORTH_SIDEWALK_Y });
      path.push({ x: WEST_CROSS_X, y: NORTH_SIDEWALK_Y, waitForSignal: true });
      path.push({ x: EAST_CROSS_X, y: SOUTH_SIDEWALK_Y });
      path.push({ x: RIGHT_EDGE, y: SOUTH_SIDEWALK_Y });
      return path;
    }
    case 1: { // SE→NW
      const endX = randomWestBldgX();
      const path: Waypoint[] = [];
      path.push({ x: RIGHT_EDGE, y: SOUTH_SIDEWALK_Y });
      path.push({ x: EAST_CROSS_X, y: SOUTH_SIDEWALK_Y, waitForSignal: true });
      path.push({ x: WEST_CROSS_X, y: NORTH_SIDEWALK_Y });
      path.push({ x: endX, y: NORTH_SIDEWALK_Y });
      path.push({ x: endX, y: BLDG_Y });
      return path;
    }
    case 2: { // NE→SW
      const startX = randomEastBldgX();
      const path: Waypoint[] = [];
      path.push({ x: startX, y: BLDG_Y });
      path.push({ x: startX, y: NORTH_SIDEWALK_Y });
      path.push({ x: EAST_CROSS_X, y: NORTH_SIDEWALK_Y, waitForSignal: true });
      path.push({ x: WEST_CROSS_X, y: SOUTH_SIDEWALK_Y });
      path.push({ x: LEFT_EDGE, y: SOUTH_SIDEWALK_Y });
      return path;
    }
    case 3: { // SW→NE
      const endX = randomEastBldgX();
      const path: Waypoint[] = [];
      path.push({ x: LEFT_EDGE, y: SOUTH_SIDEWALK_Y });
      path.push({ x: WEST_CROSS_X, y: SOUTH_SIDEWALK_Y, waitForSignal: true });
      path.push({ x: EAST_CROSS_X, y: NORTH_SIDEWALK_Y });
      path.push({ x: endX, y: NORTH_SIDEWALK_Y });
      path.push({ x: endX, y: BLDG_Y });
      return path;
    }
    default: return generateDiagonalPath();
  }
}

/** Generate a random pedestrian path based on category weights */
function generatePedestrianPath(): Waypoint[] {
  const r = Math.random();
  if (r < 0.35) return generateSidewalkPath();
  if (r < 0.85) return generateCrosserPath();
  return generateDiagonalPath();
}

/** Spawn a single pedestrian with a waypoint path */
function spawnPedestrian(state: GameState, layers: SceneLayers, sheet: Spritesheet, pathOverride?: Waypoint[]) {
  // Cap total pedestrians
  let pedCount = 0;
  for (const [, e] of state.entities) {
    if (e.type === "pedestrian") pedCount++;
  }
  if (pedCount >= MAX_PEDESTRIANS) return;

  const path = pathOverride ?? generatePedestrianPath();
  if (path.length < 2) return;

  const variant = weightedRandom(PED_VARIANTS).name;
  const startX = path[0].x;
  const startY = path[0].y;

  // Compute initial direction from first segment
  const dx = path[1].x - startX;
  const dy = path[1].y - startY;
  const dir = computeDirection(dx, dy);

  const frameName = `ped_${variant}_${dir}_0`;
  const texture = sheet.textures[frameName];
  if (!texture) return;

  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5, 0.5);
  sprite.x = startX;
  sprite.y = startY;
  sprite.zIndex = startY;
  layers.pedestrian.addChild(sprite);

  const speed = pedSpeed(variant);

  const entity: Entity = {
    id: state.nextEntityId++,
    type: "pedestrian",
    x: startX,
    y: startY,
    currentSpeed: speed,
    cruiseSpeed: speed,
    direction: dir,
    sprite,
    state: "moving",
    speedState: "cruising",
    variant,
    animFrame: 0,
    animTimer: 0,
    path,
    pathIndex: 1, // start walking toward first target waypoint
  };

  state.entities.set(entity.id, entity);
}

/** Spawn a burst of crossers already waiting at crossing edges (for crowd density before SCRAMBLE) */
function spawnCrosserBurst(state: GameState, layers: SceneLayers, sheet: Spritesheet) {
  const count = 6 + Math.floor(Math.random() * 5); // 6-10
  for (let i = 0; i < count; i++) {
    // Generate a crosser or diagonal path, but start them at the wait waypoint
    const fullPath = Math.random() < 0.8 ? generateCrosserPath() : generateDiagonalPath();
    // Find the wait waypoint index
    let waitIdx = -1;
    for (let j = 0; j < fullPath.length; j++) {
      if (fullPath[j].waitForSignal) {
        waitIdx = j;
        break;
      }
    }
    if (waitIdx < 0) continue;
    // Create a truncated path starting at the wait point
    const truncatedPath = fullPath.slice(waitIdx);
    spawnPedestrian(state, layers, sheet, truncatedPath);
  }
}

export function updateSpawner(
  state: GameState,
  dt: number,
  layers: SceneLayers,
  sheet: Spritesheet
) {
  // Vehicle spawning
  vehicleTimer += dt;
  if (vehicleTimer >= 2 + Math.random()) {
    vehicleTimer = 0;
    spawnVehicle(state, layers, sheet);
  }

  // Cyclist spawning
  cyclistTimer += dt;
  if (cyclistTimer >= 8 + Math.random() * 2) {
    cyclistTimer = 0;
    spawnCyclist(state, layers, sheet);
  }

  // Continuous pedestrian spawning
  pedTimer += dt;
  if (pedTimer >= 1.2 + Math.random() * 0.5) {
    pedTimer = 0;
    spawnPedestrian(state, layers, sheet);
  }

  // Burst of crossers at wait points during ALL_RED_2 (just before SCRAMBLE)
  if (state.trafficPhase !== lastPhaseForBurst) {
    lastPhaseForBurst = state.trafficPhase;
    crosserBurstSpawned = false;
  }
  if (state.trafficPhase === TrafficPhase.ALL_RED_2 && !crosserBurstSpawned) {
    crosserBurstSpawned = true;
    spawnCrosserBurst(state, layers, sheet);
  }
}
