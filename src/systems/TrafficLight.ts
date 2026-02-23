import { Container, Sprite, Spritesheet } from "pixi.js";
import { GameState, TrafficPhase } from "../game/GameState";
import type { Direction } from "../entities/Entity";
import {
  NS_ROAD_LEFT, NS_ROAD_RIGHT, EW_ROAD_TOP, EW_ROAD_BOTTOM,
  ZEBRA_WIDTH, TILE
} from "../scene/Road";

// Phase durations in seconds
const PHASE_DURATIONS: Record<TrafficPhase, number> = {
  [TrafficPhase.NS_GREEN]: 25,
  [TrafficPhase.NS_YELLOW]: 3,
  [TrafficPhase.ALL_RED_1]: 2,
  [TrafficPhase.EW_GREEN]: 25,
  [TrafficPhase.EW_YELLOW]: 3,
  [TrafficPhase.ALL_RED_2]: 2,
  [TrafficPhase.SCRAMBLE]: 25,
  [TrafficPhase.SCRAMBLE_FLASH]: 5,
  [TrafficPhase.ALL_RED_3]: 2,
};

const PHASE_ORDER: TrafficPhase[] = [
  TrafficPhase.NS_GREEN,
  TrafficPhase.NS_YELLOW,
  TrafficPhase.ALL_RED_1,
  TrafficPhase.EW_GREEN,
  TrafficPhase.EW_YELLOW,
  TrafficPhase.ALL_RED_2,
  TrafficPhase.SCRAMBLE,
  TrafficPhase.SCRAMBLE_FLASH,
  TrafficPhase.ALL_RED_3,
];

// Query methods
export function canVehicleGo(state: GameState, dir: Direction): boolean {
  const p = state.trafficPhase;
  if (dir === "n" || dir === "s") {
    return p === TrafficPhase.NS_GREEN;
  }
  return p === TrafficPhase.EW_GREEN;
}

export function shouldVehicleSlow(state: GameState, dir: Direction): boolean {
  const p = state.trafficPhase;
  if (dir === "n" || dir === "s") {
    return p === TrafficPhase.NS_YELLOW;
  }
  return p === TrafficPhase.EW_YELLOW;
}

export function canPedestriansGo(state: GameState): boolean {
  return state.trafficPhase === TrafficPhase.SCRAMBLE;
}

export function isPedestrianFlashing(state: GameState): boolean {
  return state.trafficPhase === TrafficPhase.SCRAMBLE_FLASH;
}

// Traffic light signal sprites — overhead gantry style, floating above the road
interface SignalSprites {
  nsSignals: Sprite[];
  ewSignals: Sprite[];
  pedSignals: Sprite[];
}

let signals: SignalSprites | null = null;

export function placeTrafficLightSprites(
  layer: Container,
  sheet: Spritesheet,
  _state: GameState
) {
  const nsSignals: Sprite[] = [];
  const ewSignals: Sprite[] = [];
  const pedSignals: Sprite[] = [];

  // Lane center positions
  const sbCenterX = NS_ROAD_LEFT + TILE;    // center of southbound lanes 0-1 (216)
  const nbCenterX = NS_ROAD_RIGHT - TILE;   // center of northbound lanes 2-3 (264)
  const ebCenterY = EW_ROAD_TOP + TILE;     // center of eastbound lanes 0-1 (216)
  const wbCenterY = EW_ROAD_BOTTOM - TILE;  // center of westbound lanes 2-3 (264)

  // Crossing edges (outer edge of zebra crossings)
  const crossingTop = EW_ROAD_TOP - ZEBRA_WIDTH;      // 168
  const crossingBottom = EW_ROAD_BOTTOM + ZEBRA_WIDTH; // 312
  const crossingLeft = NS_ROAD_LEFT - ZEBRA_WIDTH;     // 168
  const crossingRight = NS_ROAD_RIGHT + ZEBRA_WIDTH;   // 312

  // Intersection center
  const ixCenterX = (NS_ROAD_LEFT + NS_ROAD_RIGHT) / 2; // 240
  const ixCenterY = (EW_ROAD_TOP + EW_ROAD_BOTTOM) / 2; // 240

  // ── Vehicle signals (4) — centered over approach lanes, just outside crosswalk ──

  // North approach (controls southbound traffic) — NS signal
  const nsNorth = new Sprite(sheet.textures["signal_vehicle_green"]);
  nsNorth.anchor.set(0.5, 0.5);
  nsNorth.x = sbCenterX;
  nsNorth.y = crossingTop - 4;
  layer.addChild(nsNorth);
  nsSignals.push(nsNorth);

  // South approach (controls northbound traffic) — NS signal
  const nsSouth = new Sprite(sheet.textures["signal_vehicle_green"]);
  nsSouth.anchor.set(0.5, 0.5);
  nsSouth.x = nbCenterX;
  nsSouth.y = crossingBottom + 4;
  layer.addChild(nsSouth);
  nsSignals.push(nsSouth);

  // West approach (controls eastbound traffic) — EW signal
  const ewWest = new Sprite(sheet.textures["signal_vehicle_red"]);
  ewWest.anchor.set(0.5, 0.5);
  ewWest.x = crossingLeft - 4;
  ewWest.y = ebCenterY;
  layer.addChild(ewWest);
  ewSignals.push(ewWest);

  // East approach (controls westbound traffic) — EW signal
  const ewEast = new Sprite(sheet.textures["signal_vehicle_red"]);
  ewEast.anchor.set(0.5, 0.5);
  ewEast.x = crossingRight + 4;
  ewEast.y = wbCenterY;
  layer.addChild(ewEast);
  ewSignals.push(ewEast);

  // ── Pedestrian signals (4) — at inner crosswalk edge (intersection side) ──

  const pedPositions = [
    { x: ixCenterX, y: EW_ROAD_TOP - 2 },     // North crosswalk
    { x: ixCenterX, y: EW_ROAD_BOTTOM + 2 },   // South crosswalk
    { x: NS_ROAD_LEFT - 2, y: ixCenterY },      // West crosswalk
    { x: NS_ROAD_RIGHT + 2, y: ixCenterY },     // East crosswalk
  ];

  for (const pos of pedPositions) {
    const s = new Sprite(sheet.textures["signal_ped_stop"]);
    s.anchor.set(0.5, 0.5);
    s.x = pos.x;
    s.y = pos.y;
    layer.addChild(s);
    pedSignals.push(s);
  }

  signals = { nsSignals, ewSignals, pedSignals };
}

export function updateTrafficLight(
  state: GameState,
  dt: number,
  layer: Container,
  sheet: Spritesheet
) {
  state.phaseElapsed += dt;
  const duration = PHASE_DURATIONS[state.trafficPhase];

  if (state.phaseElapsed >= duration) {
    state.phaseElapsed -= duration;
    const idx = PHASE_ORDER.indexOf(state.trafficPhase);
    state.trafficPhase = PHASE_ORDER[(idx + 1) % PHASE_ORDER.length];
    updateSignalSprites(state, sheet);
  }

  // Handle flashing during SCRAMBLE_FLASH
  if (state.trafficPhase === TrafficPhase.SCRAMBLE_FLASH && signals) {
    const flashOn = Math.floor(state.phaseElapsed * 2) % 2 === 0;
    for (const s of signals.pedSignals) {
      s.texture = sheet.textures[flashOn ? "signal_ped_walk" : "signal_ped_flash"];
    }
  }
}

function updateSignalSprites(state: GameState, sheet: Spritesheet) {
  if (!signals) return;

  const p = state.trafficPhase;

  // NS vehicle signals
  let nsTexture = "signal_vehicle_red";
  if (p === TrafficPhase.NS_GREEN) nsTexture = "signal_vehicle_green";
  else if (p === TrafficPhase.NS_YELLOW) nsTexture = "signal_vehicle_yellow";

  for (const s of signals.nsSignals) {
    s.texture = sheet.textures[nsTexture];
  }

  // EW vehicle signals
  let ewTexture = "signal_vehicle_red";
  if (p === TrafficPhase.EW_GREEN) ewTexture = "signal_vehicle_green";
  else if (p === TrafficPhase.EW_YELLOW) ewTexture = "signal_vehicle_yellow";

  for (const s of signals.ewSignals) {
    s.texture = sheet.textures[ewTexture];
  }

  // Pedestrian signals
  let pedTexture = "signal_ped_stop";
  if (p === TrafficPhase.SCRAMBLE) pedTexture = "signal_ped_walk";
  else if (p === TrafficPhase.SCRAMBLE_FLASH) pedTexture = "signal_ped_flash";

  for (const s of signals.pedSignals) {
    s.texture = sheet.textures[pedTexture];
  }
}
