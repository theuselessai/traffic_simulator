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

// Traffic light signal sprites placed at corners of intersection
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

  // NS signals (at top and bottom of intersection)
  // North side - signal for southbound traffic
  const nsTop = new Sprite(sheet.textures["signal_vehicle_green"]);
  nsTop.x = NS_ROAD_LEFT - 12;
  nsTop.y = EW_ROAD_TOP - ZEBRA_WIDTH - TILE - 24;
  layer.addChild(nsTop);
  nsSignals.push(nsTop);

  // South side - signal for northbound traffic
  const nsBot = new Sprite(sheet.textures["signal_vehicle_green"]);
  nsBot.x = NS_ROAD_RIGHT + 4;
  nsBot.y = EW_ROAD_BOTTOM + ZEBRA_WIDTH;
  layer.addChild(nsBot);
  nsSignals.push(nsBot);

  // EW signals (at left and right of intersection)
  const ewLeft = new Sprite(sheet.textures["signal_vehicle_red"]);
  ewLeft.x = NS_ROAD_LEFT - ZEBRA_WIDTH - TILE - 8;
  ewLeft.y = EW_ROAD_BOTTOM + 4;
  layer.addChild(ewLeft);
  ewSignals.push(ewLeft);

  const ewRight = new Sprite(sheet.textures["signal_vehicle_red"]);
  ewRight.x = NS_ROAD_RIGHT + ZEBRA_WIDTH;
  ewRight.y = EW_ROAD_TOP - 28;
  layer.addChild(ewRight);
  ewSignals.push(ewRight);

  // Pedestrian signals at each crossing
  const pedPositions = [
    { x: NS_ROAD_LEFT - ZEBRA_WIDTH - 12, y: EW_ROAD_TOP - ZEBRA_WIDTH - 20 },
    { x: NS_ROAD_RIGHT + ZEBRA_WIDTH + 4, y: EW_ROAD_TOP - ZEBRA_WIDTH - 20 },
    { x: NS_ROAD_LEFT - ZEBRA_WIDTH - 12, y: EW_ROAD_BOTTOM + ZEBRA_WIDTH },
    { x: NS_ROAD_RIGHT + ZEBRA_WIDTH + 4, y: EW_ROAD_BOTTOM + ZEBRA_WIDTH },
  ];

  for (const pos of pedPositions) {
    const s = new Sprite(sheet.textures["signal_ped_stop"]);
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
