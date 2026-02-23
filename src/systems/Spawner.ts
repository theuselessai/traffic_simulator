import { Sprite, Spritesheet } from "pixi.js";
import { GameState, TrafficPhase } from "../game/GameState";
import type { SceneLayers } from "../scene/SceneBuilder";
import type { Entity, Direction, PedDirection } from "../entities/Entity";
import {
  SCENE_W, SCENE_H, nsLaneX, ewLaneY,
  NS_ROAD_LEFT, NS_ROAD_RIGHT, EW_ROAD_TOP, EW_ROAD_BOTTOM,
  IX_CENTER_X, IX_CENTER_Y
} from "../scene/Road";
import { canPedestriansGo, isPedestrianFlashing } from "./TrafficLight";

// Spawn timers
let vehicleTimer = 0;
let cyclistTimer = 0;
let pedestrianSpawnedThisPhase = false;
let lastPhase: TrafficPhase | null = null;

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

// Pedestrian crossing paths
interface CrossingPath {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  dir: PedDirection;
}

function getPedestrianPaths(): CrossingPath[] {
  const paths: CrossingPath[] = [];
  const offset = () => (Math.random() - 0.5) * 20;

  // N-S crossings (west side)
  paths.push({
    startX: NS_ROAD_LEFT - 20 + offset(), startY: EW_ROAD_TOP - 48,
    endX: NS_ROAD_LEFT - 20 + offset(), endY: EW_ROAD_BOTTOM + 48,
    dir: "s"
  });
  paths.push({
    startX: NS_ROAD_LEFT - 20 + offset(), startY: EW_ROAD_BOTTOM + 48,
    endX: NS_ROAD_LEFT - 20 + offset(), endY: EW_ROAD_TOP - 48,
    dir: "n"
  });

  // N-S crossings (east side)
  paths.push({
    startX: NS_ROAD_RIGHT + 20 + offset(), startY: EW_ROAD_TOP - 48,
    endX: NS_ROAD_RIGHT + 20 + offset(), endY: EW_ROAD_BOTTOM + 48,
    dir: "s"
  });
  paths.push({
    startX: NS_ROAD_RIGHT + 20 + offset(), startY: EW_ROAD_BOTTOM + 48,
    endX: NS_ROAD_RIGHT + 20 + offset(), endY: EW_ROAD_TOP - 48,
    dir: "n"
  });

  // E-W crossings (north side)
  paths.push({
    startX: NS_ROAD_LEFT - 48, startY: EW_ROAD_TOP - 20 + offset(),
    endX: NS_ROAD_RIGHT + 48, endY: EW_ROAD_TOP - 20 + offset(),
    dir: "e"
  });
  paths.push({
    startX: NS_ROAD_RIGHT + 48, startY: EW_ROAD_TOP - 20 + offset(),
    endX: NS_ROAD_LEFT - 48, endY: EW_ROAD_TOP - 20 + offset(),
    dir: "w"
  });

  // E-W crossings (south side)
  paths.push({
    startX: NS_ROAD_LEFT - 48, startY: EW_ROAD_BOTTOM + 20 + offset(),
    endX: NS_ROAD_RIGHT + 48, endY: EW_ROAD_BOTTOM + 20 + offset(),
    dir: "e"
  });
  paths.push({
    startX: NS_ROAD_RIGHT + 48, startY: EW_ROAD_BOTTOM + 20 + offset(),
    endX: NS_ROAD_LEFT - 48, endY: EW_ROAD_BOTTOM + 20 + offset(),
    dir: "w"
  });

  // Diagonal crossings
  // NW -> SE
  paths.push({
    startX: NS_ROAD_LEFT - 32, startY: EW_ROAD_TOP - 32,
    endX: NS_ROAD_RIGHT + 32, endY: EW_ROAD_BOTTOM + 32,
    dir: "se"
  });
  // SE -> NW
  paths.push({
    startX: NS_ROAD_RIGHT + 32, startY: EW_ROAD_BOTTOM + 32,
    endX: NS_ROAD_LEFT - 32, endY: EW_ROAD_TOP - 32,
    dir: "nw"
  });
  // NE -> SW
  paths.push({
    startX: NS_ROAD_RIGHT + 32, startY: EW_ROAD_TOP - 32,
    endX: NS_ROAD_LEFT - 32, endY: EW_ROAD_BOTTOM + 32,
    dir: "sw"
  });
  // SW -> NE
  paths.push({
    startX: NS_ROAD_LEFT - 32, startY: EW_ROAD_BOTTOM + 32,
    endX: NS_ROAD_RIGHT + 32, endY: EW_ROAD_TOP - 32,
    dir: "ne"
  });

  return paths;
}

const PED_VARIANTS = [
  { name: "office_m", weight: 40 },
  { name: "office_f", weight: 40 },
  { name: "student", weight: 25 },
  { name: "tourist", weight: 20 },
  { name: "elderly", weight: 15 },
];

function spawnPedestrianWave(state: GameState, layers: SceneLayers, sheet: Spritesheet) {
  const paths = getPedestrianPaths();
  const count = 15 + Math.floor(Math.random() * 11); // 15-25

  for (let i = 0; i < count; i++) {
    const path = paths[Math.floor(Math.random() * paths.length)];
    const variant = weightedRandom(PED_VARIANTS).name;

    const frameName = `ped_${variant}_${path.dir}_0`;
    const texture = sheet.textures[frameName];
    if (!texture) continue;

    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5, 0.5);

    // Stagger spawn position slightly
    const stagger = Math.random() * 20 - 10;
    const x = path.startX + stagger;
    const y = path.startY + stagger;

    sprite.x = x;
    sprite.y = y;
    sprite.zIndex = y;
    layers.pedestrian.addChild(sprite);

    // Speed varies by variant
    let speed = 25;
    if (variant === "elderly") speed = 18;
    else if (variant === "tourist") speed = 20;
    else if (variant === "student") speed = 28;

    const entity: Entity = {
      id: state.nextEntityId++,
      type: "pedestrian",
      x, y,
      currentSpeed: speed,
      cruiseSpeed: speed,
      direction: path.dir,
      sprite,
      state: "moving",
      speedState: "cruising",
      variant,
      animFrame: 0,
      animTimer: 0,
      targetX: path.endX + stagger,
      targetY: path.endY + stagger,
    };

    state.entities.set(entity.id, entity);
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

  // Pedestrian spawning during SCRAMBLE
  if (state.trafficPhase !== lastPhase) {
    lastPhase = state.trafficPhase;
    pedestrianSpawnedThisPhase = false;
  }

  if (canPedestriansGo(state) && !pedestrianSpawnedThisPhase && state.phaseElapsed < 5) {
    pedestrianSpawnedThisPhase = true;
    spawnPedestrianWave(state, layers, sheet);
  }
}
