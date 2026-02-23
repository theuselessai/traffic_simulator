import { createCanvas, Canvas } from "canvas";
import * as fs from "fs";
import * as path from "path";
import { PALETTE } from "./palette";

// ---- Types ----
interface SpriteFrame {
  name: string;
  canvas: Canvas;
  w: number;
  h: number;
}

interface PackedFrame {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

// ---- Helpers ----
function createPixelCanvas(w: number, h: number): [Canvas, CanvasRenderingContext2D] {
  const c = createCanvas(w, h);
  const ctx = c.getContext("2d");
  (ctx as any).imageSmoothingEnabled = false;
  (ctx as any).antialias = "none";
  (ctx as any).patternQuality = "nearest";
  (ctx as any).quality = "nearest";
  return [c, ctx as unknown as CanvasRenderingContext2D];
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
}

// ---- Sprite Generators ----

const frames: SpriteFrame[] = [];

function addFrame(name: string, canvas: Canvas, w: number, h: number) {
  frames.push({ name, canvas, w, h });
}

// ---- Road Tiles (24x24) ----
function generateRoadTiles() {
  // Asphalt
  {
    const [c, ctx] = createPixelCanvas(24, 24);
    rect(ctx, 0, 0, 24, 24, PALETTE.ROAD_MID);
    // Subtle noise
    for (let y = 0; y < 24; y += 3) {
      for (let x = 0; x < 24; x += 4) {
        px(ctx, x, y, PALETTE.ROAD_DARK);
      }
    }
    addFrame("road_asphalt", c, 24, 24);
  }

  // Lane marking horizontal (dashed)
  {
    const [c, ctx] = createPixelCanvas(24, 24);
    rect(ctx, 0, 0, 24, 24, PALETTE.ROAD_MID);
    rect(ctx, 2, 11, 8, 2, PALETTE.LANE_MARKING);
    rect(ctx, 14, 11, 8, 2, PALETTE.LANE_MARKING);
    addFrame("road_lane_h", c, 24, 24);
  }

  // Lane marking vertical (dashed)
  {
    const [c, ctx] = createPixelCanvas(24, 24);
    rect(ctx, 0, 0, 24, 24, PALETTE.ROAD_MID);
    rect(ctx, 11, 2, 2, 8, PALETTE.LANE_MARKING);
    rect(ctx, 11, 14, 2, 8, PALETTE.LANE_MARKING);
    addFrame("road_lane_v", c, 24, 24);
  }

  // Zebra crossing horizontal
  {
    const [c, ctx] = createPixelCanvas(24, 24);
    rect(ctx, 0, 0, 24, 24, PALETTE.ROAD_MID);
    for (let i = 0; i < 24; i += 4) {
      rect(ctx, i, 0, 2, 24, PALETTE.ZEBRA_WHITE);
    }
    addFrame("zebra_h", c, 24, 24);
  }

  // Zebra crossing vertical
  {
    const [c, ctx] = createPixelCanvas(24, 24);
    rect(ctx, 0, 0, 24, 24, PALETTE.ROAD_MID);
    for (let i = 0; i < 24; i += 4) {
      rect(ctx, 0, i, 24, 2, PALETTE.ZEBRA_WHITE);
    }
    addFrame("zebra_v", c, 24, 24);
  }

  // Zebra crossing diagonal (NW-SE)
  {
    const [c, ctx] = createPixelCanvas(24, 24);
    rect(ctx, 0, 0, 24, 24, PALETTE.ROAD_MID);
    for (let i = -24; i < 48; i += 5) {
      for (let d = 0; d < 2; d++) {
        for (let t = 0; t < 24; t++) {
          const x = t;
          const y = i + d + t;
          if (x >= 0 && x < 24 && y >= 0 && y < 24) {
            px(ctx, x, y, PALETTE.ZEBRA_WHITE);
          }
        }
      }
    }
    addFrame("zebra_diag_nwse", c, 24, 24);
  }

  // Zebra crossing diagonal (NE-SW)
  {
    const [c, ctx] = createPixelCanvas(24, 24);
    rect(ctx, 0, 0, 24, 24, PALETTE.ROAD_MID);
    for (let i = -24; i < 48; i += 5) {
      for (let d = 0; d < 2; d++) {
        for (let t = 0; t < 24; t++) {
          const x = t;
          const y = i + d - t + 24;
          if (x >= 0 && x < 24 && y >= 0 && y < 24) {
            px(ctx, x, y, PALETTE.ZEBRA_WHITE);
          }
        }
      }
    }
    addFrame("zebra_diag_nesw", c, 24, 24);
  }

  // Stop line horizontal
  {
    const [c, ctx] = createPixelCanvas(24, 24);
    rect(ctx, 0, 0, 24, 24, PALETTE.ROAD_MID);
    rect(ctx, 0, 10, 24, 4, PALETTE.ZEBRA_WHITE);
    addFrame("stop_line_h", c, 24, 24);
  }

  // Stop line vertical
  {
    const [c, ctx] = createPixelCanvas(24, 24);
    rect(ctx, 0, 0, 24, 24, PALETTE.ROAD_MID);
    rect(ctx, 10, 0, 4, 24, PALETTE.ZEBRA_WHITE);
    addFrame("stop_line_v", c, 24, 24);
  }

  // Sidewalk tile
  {
    const [c, ctx] = createPixelCanvas(24, 24);
    rect(ctx, 0, 0, 24, 24, PALETTE.SIDEWALK);
    // Grid pattern
    rect(ctx, 0, 0, 24, 1, PALETTE.CURB);
    rect(ctx, 0, 0, 1, 24, PALETTE.CURB);
    rect(ctx, 11, 0, 1, 24, PALETTE.CURB);
    rect(ctx, 0, 11, 24, 1, PALETTE.CURB);
    addFrame("sidewalk", c, 24, 24);
  }

  // Intersection center (plain asphalt, no markings)
  {
    const [c, ctx] = createPixelCanvas(24, 24);
    rect(ctx, 0, 0, 24, 24, PALETTE.ROAD_MID);
    addFrame("intersection", c, 24, 24);
  }
}

// ---- Vehicle Sprites ----
type Dir = "n" | "s" | "e" | "w";

function drawSedan(ctx: CanvasRenderingContext2D, bodyColor: string, dir: Dir) {
  // Sedan: 16w x 24h (N/S) or 24w x 16h (E/W)
  // Draw as facing south, then caller rotates
  // Body
  rect(ctx, 3, 4, 10, 16, bodyColor);
  // Roof (lighter)
  rect(ctx, 4, 8, 8, 6, PALETTE.WINDOW_DARK);
  // Windshield
  rect(ctx, 4, 7, 8, 2, PALETTE.WINDSHIELD);
  // Rear window
  rect(ctx, 4, 14, 8, 1, PALETTE.WINDSHIELD);
  // Headlights
  px(ctx, 4, 4, PALETTE.HEADLIGHT);
  px(ctx, 11, 4, PALETTE.HEADLIGHT);
  // Taillights
  px(ctx, 4, 19, PALETTE.TAILLIGHT);
  px(ctx, 11, 19, PALETTE.TAILLIGHT);
  // Wheels
  rect(ctx, 2, 5, 2, 3, PALETTE.WHEEL);
  rect(ctx, 12, 5, 2, 3, PALETTE.WHEEL);
  rect(ctx, 2, 16, 2, 3, PALETTE.WHEEL);
  rect(ctx, 12, 16, 2, 3, PALETTE.WHEEL);
}

function rotateCanvas(src: Canvas, srcW: number, srcH: number, dir: Dir): [Canvas, number, number] {
  if (dir === "s") return [src, srcW, srcH];

  let dstW: number, dstH: number;
  const [dst, dctx] = (() => {
    if (dir === "n") {
      dstW = srcW; dstH = srcH;
      const [c, ctx] = createPixelCanvas(dstW, dstH);
      ctx.translate(srcW, srcH);
      ctx.rotate(Math.PI);
      return [c, ctx];
    } else if (dir === "e") {
      dstW = srcH; dstH = srcW;
      const [c, ctx] = createPixelCanvas(dstW, dstH);
      ctx.translate(dstW, 0);
      ctx.rotate(Math.PI / 2);
      return [c, ctx];
    } else {
      // west
      dstW = srcH; dstH = srcW;
      const [c, ctx] = createPixelCanvas(dstW, dstH);
      ctx.translate(0, dstH);
      ctx.rotate(-Math.PI / 2);
      return [c, ctx];
    }
  })();

  (dctx as any).imageSmoothingEnabled = false;
  dctx.drawImage(src, 0, 0);
  return [dst, dstW!, dstH!];
}

function generateVehicles() {
  const sedanColors = [
    { name: "red", color: PALETTE.CAR_RED },
    { name: "blue", color: PALETTE.CAR_BLUE },
    { name: "white", color: PALETTE.CAR_WHITE },
    { name: "black", color: PALETTE.CAR_BLACK },
  ];
  const dirs: Dir[] = ["n", "s", "e", "w"];

  for (const { name, color } of sedanColors) {
    for (const dir of dirs) {
      const [c, ctx] = createPixelCanvas(16, 24);
      drawSedan(ctx, color, "s");
      const [rotated, rw, rh] = rotateCanvas(c, 16, 24, dir);
      addFrame(`sedan_${name}_${dir}`, rotated, rw, rh);
    }
  }

  // Taxi
  for (const dir of dirs) {
    const [c, ctx] = createPixelCanvas(16, 24);
    drawSedan(ctx, PALETTE.TAXI_BODY, "s");
    // Taxi sign on roof
    rect(ctx, 6, 9, 4, 2, PALETTE.TAXI_SIGN);
    const [rotated, rw, rh] = rotateCanvas(c, 16, 24, dir);
    addFrame(`taxi_${dir}`, rotated, rw, rh);
  }

  // Bus (16x40 facing south)
  for (const dir of dirs) {
    const [c, ctx] = createPixelCanvas(16, 40);
    rect(ctx, 2, 2, 12, 36, PALETTE.BUS_BODY);
    // Windows
    for (let wy = 6; wy < 34; wy += 4) {
      rect(ctx, 3, wy, 2, 3, PALETTE.WINDSHIELD);
      rect(ctx, 11, wy, 2, 3, PALETTE.WINDSHIELD);
    }
    // Front windshield
    rect(ctx, 3, 3, 10, 3, PALETTE.WINDSHIELD);
    // Headlights
    px(ctx, 3, 2, PALETTE.HEADLIGHT);
    px(ctx, 12, 2, PALETTE.HEADLIGHT);
    // Taillights
    rect(ctx, 3, 37, 2, 1, PALETTE.TAILLIGHT);
    rect(ctx, 11, 37, 2, 1, PALETTE.TAILLIGHT);
    // Wheels
    rect(ctx, 1, 4, 2, 4, PALETTE.WHEEL);
    rect(ctx, 13, 4, 2, 4, PALETTE.WHEEL);
    rect(ctx, 1, 32, 2, 4, PALETTE.WHEEL);
    rect(ctx, 13, 32, 2, 4, PALETTE.WHEEL);
    // Route number
    rect(ctx, 6, 3, 4, 2, PALETTE.LIME);
    const [rotated, rw, rh] = rotateCanvas(c, 16, 40, dir);
    addFrame(`bus_${dir}`, rotated, rw, rh);
  }

  // Kei Truck (14x20 facing south)
  for (const dir of dirs) {
    const [c, ctx] = createPixelCanvas(14, 20);
    // Cab
    rect(ctx, 2, 2, 10, 6, PALETTE.KEI_TRUCK);
    rect(ctx, 3, 3, 8, 3, PALETTE.WINDSHIELD); // windshield
    // Bed
    rect(ctx, 2, 8, 10, 10, PALETTE.SUIT_GREY);
    rect(ctx, 3, 9, 8, 8, PALETTE.CHARCOAL);
    // Headlights
    px(ctx, 3, 2, PALETTE.HEADLIGHT);
    px(ctx, 10, 2, PALETTE.HEADLIGHT);
    // Taillights
    px(ctx, 3, 17, PALETTE.TAILLIGHT);
    px(ctx, 10, 17, PALETTE.TAILLIGHT);
    // Wheels
    rect(ctx, 1, 3, 2, 3, PALETTE.WHEEL);
    rect(ctx, 11, 3, 2, 3, PALETTE.WHEEL);
    rect(ctx, 1, 14, 2, 3, PALETTE.WHEEL);
    rect(ctx, 11, 14, 2, 3, PALETTE.WHEEL);
    const [rotated, rw, rh] = rotateCanvas(c, 14, 20, dir);
    addFrame(`kei_truck_${dir}`, rotated, rw, rh);
  }

  // Police car
  for (const dir of dirs) {
    const [c, ctx] = createPixelCanvas(16, 24);
    drawSedan(ctx, PALETTE.POLICE, "s");
    // Police stripe
    rect(ctx, 3, 10, 10, 2, PALETTE.CAR_BLACK);
    // Light bar
    px(ctx, 6, 9, PALETTE.SIGNAL_RED);
    px(ctx, 9, 9, PALETTE.BRIGHT_BLUE);
    const [rotated, rw, rh] = rotateCanvas(c, 16, 24, dir);
    addFrame(`police_${dir}`, rotated, rw, rh);
  }
}

// ---- Pedestrian Sprites (10x16) ----
type PedDir = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

interface PedVariant {
  name: string;
  hair: string;
  skin: string;
  top: string;
  bottom: string;
  accessory?: string;
}

const PED_VARIANTS: PedVariant[] = [
  { name: "office_m", hair: PALETTE.HAIR_DARK, skin: PALETTE.SKIN_LIGHT, top: PALETTE.SUIT_DARK, bottom: PALETTE.SUIT_DARK },
  { name: "office_f", hair: PALETTE.HAIR_DARK, skin: PALETTE.SKIN_LIGHT, top: PALETTE.SHIRT_WHITE, bottom: PALETTE.SKIRT_NAVY },
  { name: "student", hair: PALETTE.HAIR_DARK, skin: PALETTE.SKIN_MEDIUM, top: PALETTE.STUDENT_NAVY, bottom: PALETTE.STUDENT_NAVY },
  { name: "tourist", hair: PALETTE.HAIR_GOLDEN, skin: PALETTE.SKIN_LIGHT, top: PALETTE.TOURIST_TOP, bottom: PALETTE.TOURIST_BOTTOM, accessory: PALETTE.TOURIST_PACK },
  { name: "elderly", hair: PALETTE.HAIR_GREY, skin: PALETTE.SKIN_MEDIUM, top: PALETTE.ELDERLY_TOP, bottom: PALETTE.ELDERLY_BOT },
];

function drawPedestrian(ctx: CanvasRenderingContext2D, v: PedVariant, frame: number, dir: PedDir) {
  // Simple 10x16 character, 4-frame walk cycle
  // frame 0: stand, 1: left step, 2: stand, 3: right step
  const legOffset = frame === 1 ? -1 : frame === 3 ? 1 : 0;

  // Determine if facing left/right for slight sprite flip
  const facingRight = dir === "e" || dir === "ne" || dir === "se";
  const facingLeft = dir === "w" || dir === "nw" || dir === "sw";

  // Head
  rect(ctx, 3, 0, 4, 4, v.skin);
  // Hair (top of head)
  rect(ctx, 3, 0, 4, 1, v.hair);
  if (facingRight) px(ctx, 7, 1, v.hair);
  else if (facingLeft) px(ctx, 2, 1, v.hair);

  // Body
  rect(ctx, 3, 4, 4, 5, v.top);

  // Arms
  if (frame === 1) {
    rect(ctx, 2, 5, 1, 3, v.top);
    rect(ctx, 7, 4, 1, 3, v.top);
  } else if (frame === 3) {
    rect(ctx, 2, 4, 1, 3, v.top);
    rect(ctx, 7, 5, 1, 3, v.top);
  } else {
    rect(ctx, 2, 5, 1, 3, v.top);
    rect(ctx, 7, 5, 1, 3, v.top);
  }

  // Legs
  rect(ctx, 3, 9, 2, 5, v.bottom);
  rect(ctx, 5, 9, 2, 5, v.bottom);

  // Walk animation - offset legs
  if (legOffset !== 0) {
    rect(ctx, 3, 13 + Math.max(0, legOffset), 2, 1, v.bottom);
    rect(ctx, 5, 13 + Math.max(0, -legOffset), 2, 1, v.bottom);
  }

  // Shoes
  rect(ctx, 3, 14, 2, 2, PALETTE.SHOES);
  rect(ctx, 5, 14, 2, 2, PALETTE.SHOES);

  // Accessory (tourist backpack)
  if (v.accessory) {
    if (facingRight) {
      rect(ctx, 1, 4, 2, 4, v.accessory);
    } else if (facingLeft) {
      rect(ctx, 7, 4, 2, 4, v.accessory);
    } else {
      rect(ctx, 2, 5, 1, 3, v.accessory);
    }
  }
}

function generatePedestrians() {
  const dirs: PedDir[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
  const walkFrames = [0, 1, 2, 3];

  for (const v of PED_VARIANTS) {
    for (const dir of dirs) {
      for (const frame of walkFrames) {
        const [c, ctx] = createPixelCanvas(10, 16);
        drawPedestrian(ctx, v, frame, dir);
        addFrame(`ped_${v.name}_${dir}_${frame}`, c, 10, 16);
      }
    }
  }
}

// ---- Cyclist Sprites ----
function drawCyclist(ctx: CanvasRenderingContext2D, isDelivery: boolean, frame: number) {
  // 10w x 20h (facing south), frame 0 or 1 for pedal cycle
  const topColor = isDelivery ? PALETTE.BUS_BODY : PALETTE.SUIT_GREY;

  // Wheels
  const pedalOffset = frame === 0 ? 0 : 1;
  rect(ctx, 3, 1 + pedalOffset, 4, 4, PALETTE.BIKE_WHEEL);
  rect(ctx, 4, 2 + pedalOffset, 2, 2, PALETTE.ROAD_MID); // hub
  rect(ctx, 3, 13 - pedalOffset, 4, 4, PALETTE.BIKE_WHEEL);
  rect(ctx, 4, 14 - pedalOffset, 2, 2, PALETTE.ROAD_MID);

  // Frame
  rect(ctx, 4, 5, 2, 9, PALETTE.BIKE_FRAME);

  // Rider body
  rect(ctx, 3, 5, 4, 3, topColor);
  // Head
  rect(ctx, 3, 3, 4, 2, PALETTE.SKIN_LIGHT);
  // Helmet
  rect(ctx, 3, 2, 4, 2, PALETTE.SUIT_DARK);

  // Legs on pedals
  rect(ctx, 2, 8 + pedalOffset, 2, 3, PALETTE.SUIT_DARK);
  rect(ctx, 6, 8 - pedalOffset, 2, 3, PALETTE.SUIT_DARK);

  // Delivery box
  if (isDelivery) {
    rect(ctx, 2, 5, 6, 4, PALETTE.DELIVERY_BOX);
    rect(ctx, 3, 6, 4, 2, topColor); // strap
  }
}

function generateCyclists() {
  const dirs: Dir[] = ["n", "s", "e", "w"];
  for (const type of ["commuter", "delivery"] as const) {
    const isDelivery = type === "delivery";
    for (const dir of dirs) {
      for (const frame of [0, 1]) {
        const h = isDelivery ? 22 : 20;
        const [c, ctx] = createPixelCanvas(10, h);
        drawCyclist(ctx, isDelivery, frame);
        const [rotated, rw, rh] = rotateCanvas(c, 10, h, dir);
        addFrame(`cyclist_${type}_${dir}_${frame}`, rotated, rw, rh);
      }
    }
  }
}

// ---- Traffic Lights (overhead gantry style — no poles) ----
function generateTrafficLights() {
  // Vehicle signal — overhead style (8x6px)
  // Gantry arm + housing + active light + shadow
  for (const state of ["red", "yellow", "green"] as const) {
    const [c, ctx] = createPixelCanvas(8, 6);
    // Gantry arm (full width, 1px)
    rect(ctx, 0, 0, 8, 1, PALETTE.SIGNAL_POST);
    // Housing (4px wide, centered)
    rect(ctx, 2, 1, 4, 3, PALETTE.SIGNAL_POST);
    // Active light (2x2 centered in housing)
    const lightColor = state === "red" ? PALETTE.SIGNAL_RED
                     : state === "yellow" ? PALETTE.SIGNAL_YELLOW
                     : PALETTE.LIME;
    rect(ctx, 3, 1, 2, 2, lightColor);
    // Shadow beneath housing
    rect(ctx, 2, 4, 4, 1, PALETTE.SIGNAL_OFF);
    addFrame(`signal_vehicle_${state}`, c, 8, 6);
  }

  // Pedestrian signal — compact (6x5px)
  // Housing + color indicator + shadow
  for (const state of ["walk", "stop", "flash"] as const) {
    const [c, ctx] = createPixelCanvas(6, 5);
    // Housing
    rect(ctx, 0, 0, 6, 4, PALETTE.SIGNAL_POST);
    // Signal indicator (4x2 centered)
    const color = state === "walk" ? PALETTE.WALK_GREEN
                : state === "stop" ? PALETTE.STOP_RED
                : PALETTE.FLASH_DIM;
    rect(ctx, 1, 1, 4, 2, color);
    // Shadow
    rect(ctx, 1, 4, 4, 1, PALETTE.SIGNAL_OFF);
    addFrame(`signal_ped_${state}`, c, 6, 5);
  }
}

// ---- Buildings ----
function generateBuildings() {
  // Shibuya 109 (64x80)
  {
    const [c, ctx] = createPixelCanvas(64, 80);
    // Cylindrical shape - approximate with rounded rect
    rect(ctx, 8, 0, 48, 80, PALETTE.BLDG_109_MAIN);
    rect(ctx, 4, 4, 4, 72, PALETTE.BLDG_109_DARK);
    rect(ctx, 56, 4, 4, 72, PALETTE.BLDG_109_DARK);
    // "109" text area
    rect(ctx, 16, 8, 32, 12, PALETTE.BLDG_109_DARK);
    // Windows grid
    for (let wy = 24; wy < 72; wy += 8) {
      for (let wx = 12; wx < 52; wx += 8) {
        rect(ctx, wx, wy, 5, 5, PALETTE.WINDOW_DARK);
      }
    }
    // Entrance
    rect(ctx, 22, 68, 20, 12, PALETTE.WINDOW_DARK);
    addFrame("bldg_109", c, 64, 80);
  }

  // Shibuya 109 Night
  {
    const [c, ctx] = createPixelCanvas(64, 80);
    rect(ctx, 8, 0, 48, 80, PALETTE.BLDG_109_MAIN);
    rect(ctx, 4, 4, 4, 72, PALETTE.BLDG_109_DARK);
    rect(ctx, 56, 4, 4, 72, PALETTE.BLDG_109_DARK);
    rect(ctx, 16, 8, 32, 12, PALETTE.BLDG_109_DARK);
    for (let wy = 24; wy < 72; wy += 8) {
      for (let wx = 12; wx < 52; wx += 8) {
        const lit = Math.random() > 0.3;
        rect(ctx, wx, wy, 5, 5, lit ? PALETTE.WINDOW_GLOW : PALETTE.WINDOW_DARK);
      }
    }
    rect(ctx, 22, 68, 20, 12, PALETTE.WINDOW_GLOW);
    addFrame("bldg_109_night", c, 64, 80);
  }

  // Starbucks (56x48)
  {
    const [c, ctx] = createPixelCanvas(56, 48);
    rect(ctx, 0, 0, 56, 48, PALETTE.SBUX_WALL);
    // Green awning
    rect(ctx, 0, 0, 56, 8, PALETTE.SBUX_GREEN);
    // Windows
    rect(ctx, 4, 12, 14, 16, PALETTE.WINDOW_DARK);
    rect(ctx, 22, 12, 14, 16, PALETTE.WINDOW_DARK);
    rect(ctx, 40, 12, 12, 16, PALETTE.WINDOW_DARK);
    // Door
    rect(ctx, 22, 32, 12, 16, PALETTE.WINDOW_DARK);
    addFrame("bldg_starbucks", c, 56, 48);
  }

  // Starbucks Night
  {
    const [c, ctx] = createPixelCanvas(56, 48);
    rect(ctx, 0, 0, 56, 48, PALETTE.SBUX_WALL);
    rect(ctx, 0, 0, 56, 8, PALETTE.SBUX_GREEN);
    rect(ctx, 4, 12, 14, 16, PALETTE.WINDOW_GLOW);
    rect(ctx, 22, 12, 14, 16, PALETTE.WINDOW_GLOW);
    rect(ctx, 40, 12, 12, 16, PALETTE.WINDOW_GLOW);
    rect(ctx, 22, 32, 12, 16, PALETTE.WINDOW_GLOW);
    addFrame("bldg_starbucks_night", c, 56, 48);
  }

  // QFront (56x96)
  {
    const [c, ctx] = createPixelCanvas(56, 96);
    rect(ctx, 0, 0, 56, 96, PALETTE.QFRONT_WALL);
    // Big screen
    rect(ctx, 4, 4, 48, 32, PALETTE.QFRONT_SCREEN);
    // Windows
    for (let wy = 40; wy < 88; wy += 8) {
      for (let wx = 4; wx < 52; wx += 10) {
        rect(ctx, wx, wy, 7, 5, PALETTE.WINDOW_DARK);
      }
    }
    // Entrance
    rect(ctx, 18, 84, 20, 12, PALETTE.WINDOW_DARK);
    addFrame("bldg_qfront", c, 56, 96);
  }

  // QFront Night
  {
    const [c, ctx] = createPixelCanvas(56, 96);
    rect(ctx, 0, 0, 56, 96, PALETTE.QFRONT_WALL);
    rect(ctx, 4, 4, 48, 32, PALETTE.QFRONT_GLOW);
    for (let wy = 40; wy < 88; wy += 8) {
      for (let wx = 4; wx < 52; wx += 10) {
        const lit = Math.random() > 0.4;
        rect(ctx, wx, wy, 7, 5, lit ? PALETTE.WINDOW_GLOW : PALETTE.WINDOW_DARK);
      }
    }
    rect(ctx, 18, 84, 20, 12, PALETTE.WINDOW_GLOW);
    addFrame("bldg_qfront_night", c, 56, 96);
  }

  // Station (80x48)
  {
    const [c, ctx] = createPixelCanvas(80, 48);
    rect(ctx, 0, 8, 80, 40, PALETTE.STATION_WALL);
    // Roof
    rect(ctx, 0, 0, 80, 10, PALETTE.STATION_ROOF);
    // Windows
    for (let wx = 4; wx < 76; wx += 10) {
      rect(ctx, wx, 14, 7, 8, PALETTE.WINDOW_DARK);
    }
    // Entrance gates
    for (let gx = 16; gx < 64; gx += 16) {
      rect(ctx, gx, 32, 10, 16, PALETTE.WINDOW_DARK);
    }
    addFrame("bldg_station", c, 80, 48);
  }

  // Station Night
  {
    const [c, ctx] = createPixelCanvas(80, 48);
    rect(ctx, 0, 8, 80, 40, PALETTE.STATION_WALL);
    rect(ctx, 0, 0, 80, 10, PALETTE.STATION_ROOF);
    for (let wx = 4; wx < 76; wx += 10) {
      rect(ctx, wx, 14, 7, 8, PALETTE.WINDOW_GLOW);
    }
    for (let gx = 16; gx < 64; gx += 16) {
      rect(ctx, gx, 32, 10, 16, PALETTE.WINDOW_GLOW);
    }
    addFrame("bldg_station_night", c, 80, 48);
  }

  // Generic storefronts (48x40) x2
  for (const [idx, awningColor] of [PALETTE.AWNING_A, PALETTE.AWNING_B].entries()) {
    const wallColor = idx === 0 ? PALETTE.STORE_WALL_A : PALETTE.STORE_WALL_B;
    const [c, ctx] = createPixelCanvas(48, 40);
    rect(ctx, 0, 0, 48, 40, wallColor);
    rect(ctx, 0, 0, 48, 6, awningColor);
    rect(ctx, 4, 10, 16, 12, PALETTE.WINDOW_DARK);
    rect(ctx, 28, 10, 16, 12, PALETTE.WINDOW_DARK);
    rect(ctx, 16, 24, 16, 16, PALETTE.WINDOW_DARK);
    addFrame(`bldg_store_${idx}`, c, 48, 40);

    // Night variant
    const [cn, ctxn] = createPixelCanvas(48, 40);
    rect(ctxn, 0, 0, 48, 40, wallColor);
    rect(ctxn, 0, 0, 48, 6, awningColor);
    rect(ctxn, 4, 10, 16, 12, PALETTE.WINDOW_GLOW);
    rect(ctxn, 28, 10, 16, 12, PALETTE.WINDOW_GLOW);
    rect(ctxn, 16, 24, 16, 16, PALETTE.WINDOW_GLOW);
    addFrame(`bldg_store_${idx}_night`, cn, 48, 40);
  }
}

// ---- Pack & Output ----
function packFrames(allFrames: SpriteFrame[]): { atlas: Canvas; packed: PackedFrame[]; width: number; height: number } {
  // Simple row packer
  // Sort by height descending for better packing
  const sorted = [...allFrames].sort((a, b) => b.h - a.h);

  let x = 0;
  let y = 0;
  let rowHeight = 0;
  const maxW = 1024;
  const packed: PackedFrame[] = [];

  for (const f of sorted) {
    if (x + f.w > maxW) {
      x = 0;
      y += rowHeight + 1;
      rowHeight = 0;
    }
    packed.push({ name: f.name, x, y, w: f.w, h: f.h });
    rowHeight = Math.max(rowHeight, f.h);
    x += f.w + 1;
  }

  const atlasW = maxW;
  const atlasH = y + rowHeight + 1;

  const [atlas, ctx] = createPixelCanvas(atlasW, atlasH);
  (ctx as any).imageSmoothingEnabled = false;

  for (let i = 0; i < sorted.length; i++) {
    ctx.drawImage(sorted[i].canvas, packed[i].x, packed[i].y);
  }

  return { atlas, packed, width: atlasW, height: atlasH };
}

function generateTexturePackerJSON(packed: PackedFrame[], atlasW: number, atlasH: number): object {
  const frames: Record<string, object> = {};
  for (const f of packed) {
    frames[f.name] = {
      frame: { x: f.x, y: f.y, w: f.w, h: f.h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: f.w, h: f.h },
      sourceSize: { w: f.w, h: f.h },
    };
  }
  return {
    frames,
    meta: {
      app: "shibuya-traffic-generator",
      version: "1.0",
      image: "spritesheet.png",
      format: "RGBA8888",
      size: { w: atlasW, h: atlasH },
      scale: "1",
    },
  };
}

// ---- Main ----
function main() {
  console.log("Generating sprites...");

  generateRoadTiles();
  console.log(`  Road tiles: ${frames.length} frames`);

  const prevCount = frames.length;
  generateVehicles();
  console.log(`  Vehicles: ${frames.length - prevCount} frames`);

  const prevCount2 = frames.length;
  generatePedestrians();
  console.log(`  Pedestrians: ${frames.length - prevCount2} frames`);

  const prevCount3 = frames.length;
  generateCyclists();
  console.log(`  Cyclists: ${frames.length - prevCount3} frames`);

  const prevCount4 = frames.length;
  generateTrafficLights();
  console.log(`  Traffic lights: ${frames.length - prevCount4} frames`);

  const prevCount5 = frames.length;
  generateBuildings();
  console.log(`  Buildings: ${frames.length - prevCount5} frames`);

  console.log(`Total: ${frames.length} frames`);

  const { atlas, packed, width, height } = packFrames(frames);
  console.log(`Atlas size: ${width}x${height}`);

  const outDir = path.join(__dirname, "..", "public", "sprites");
  fs.mkdirSync(outDir, { recursive: true });

  const pngBuffer = atlas.toBuffer("image/png");
  fs.writeFileSync(path.join(outDir, "spritesheet.png"), pngBuffer);
  console.log(`  Written spritesheet.png (${(pngBuffer.length / 1024).toFixed(1)} KB)`);

  const json = generateTexturePackerJSON(packed, width, height);
  fs.writeFileSync(path.join(outDir, "spritesheet.json"), JSON.stringify(json, null, 2));
  console.log(`  Written spritesheet.json`);

  console.log("Done!");
}

main();
