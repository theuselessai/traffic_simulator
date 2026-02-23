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

// ---- Low-Level Helpers ----
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

const frames: SpriteFrame[] = [];

function addFrame(name: string, canvas: Canvas, w: number, h: number) {
  frames.push({ name, canvas, w, h });
}

// ---- Color & Pixel Art Helpers ----
// Light source: TOP-LEFT, consistent everywhere

function darken(hex: string, amount: number = 0.35): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const f = 1 - amount;
  return `#${Math.round(r * f).toString(16).padStart(2, "0")}${Math.round(g * f).toString(16).padStart(2, "0")}${Math.round(b * f).toString(16).padStart(2, "0")}`;
}

function lighten(hex: string, amount: number = 0.2): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `#${Math.min(255, Math.round(r + (255 - r) * amount)).toString(16).padStart(2, "0")}${Math.min(255, Math.round(g + (255 - g) * amount)).toString(16).padStart(2, "0")}${Math.min(255, Math.round(b + (255 - b) * amount)).toString(16).padStart(2, "0")}`;
}

/** 3-tone shaded rectangle. Light source = top-left.
 *  Draws highlight on top+left edges, shadow on bottom+right edges. */
function rect3(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, base: string) {
  const hi = lighten(base, 0.2);
  const sh = darken(base, 0.2);
  // Base fill
  rect(ctx, x, y, w, h, base);
  // Highlight: top edge + left edge
  rect(ctx, x, y, w, 1, hi);
  rect(ctx, x, y, 1, h, hi);
  // Shadow: bottom edge + right edge
  rect(ctx, x, y + h - 1, w, 1, sh);
  rect(ctx, x + w - 1, y, 1, h, sh);
}

/** Draw a drop shadow */
function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, dx = 3, dy = 3, alpha = 0.3) {
  ctx.globalAlpha = alpha;
  rect(ctx, x + dx, y + dy, w, h, PALETTE.DARK_NAVY);
  ctx.globalAlpha = 1.0;
}

/** Sparse roof texture — every ~4th pixel shifted 1 shade darker */
function roofTexture(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, base: string) {
  const texColor = darken(base, 0.12);
  for (let py = y; py < y + h; py += 2) {
    for (let px_ = x + ((py - y) % 4 === 0 ? 0 : 2); px_ < x + w; px_ += 4) {
      px(ctx, px_, py, texColor);
    }
  }
}

/** 3-tone shaded roof with texture. No outline — uses highlight/shadow edges. */
function drawRoof(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, base: string) {
  const hi = lighten(base, 0.2);
  const sh = darken(base, 0.2);
  rect(ctx, x, y, w, h, base);
  // Highlight: top + left (light from top-left)
  rect(ctx, x, y, w, 1, hi);
  rect(ctx, x, y, 1, h, hi);
  // Shadow: bottom + right
  rect(ctx, x, y + h - 1, w, 1, sh);
  rect(ctx, x + w - 1, y, 1, h, sh);
  // Sparse texture
  roofTexture(ctx, x + 1, y + 1, w - 2, h - 2, base);
}

/** Roof overhang shadow cast onto the front face below */
function roofOverhangShadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  ctx.globalAlpha = 0.25;
  rect(ctx, x, y, w, 1, PALETTE.DARK_NAVY);
  ctx.globalAlpha = 1.0;
}

/** 3-tone wall surface with subtle panel lines */
function drawWall(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, base: string, panelSpacing = 7) {
  const hi = lighten(base, 0.15);
  const sh = darken(base, 0.15);
  const panelLine = darken(base, 0.08);
  rect(ctx, x, y, w, h, base);
  // Left edge highlight (light from top-left)
  rect(ctx, x, y, 1, h, hi);
  // Right edge shadow
  rect(ctx, x + w - 1, y, 1, h, sh);
  // Bottom edge shadow
  rect(ctx, x, y + h - 1, w, 1, sh);
  // Subtle vertical panel lines
  if (panelSpacing > 0) {
    for (let lx = x + panelSpacing; lx < x + w - 1; lx += panelSpacing) {
      rect(ctx, lx, y, 1, h, panelLine);
    }
  }
}

/** Floor divider: 1px shadow + 1px highlight below */
function floorLine(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, wallColor: string) {
  rect(ctx, x, y, w, 1, darken(wallColor, 0.2));
  rect(ctx, x, y + 1, w, 1, lighten(wallColor, 0.1));
}

/** Inset window with frame/glass/highlight. Light = top-left.
 *  Size must be >= 3×3. */
function drawWindow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
                     wallColor: string, isNight: boolean, forcelit?: boolean) {
  const frameDark = darken(wallColor, 0.3);
  const frameLight = lighten(wallColor, 0.1);
  const glass = isNight
    ? (forcelit !== false && (forcelit || Math.random() > 0.2) ? PALETTE.WINDOW_GLOW : PALETTE.WINDOW_DARK)
    : PALETTE.WINDSHIELD;
  const glassHi = isNight ? PALETTE.PURE_WHITE : PALETTE.CYAN;
  // Recessed frame: shadow on top + left
  rect(ctx, x, y, w, 1, frameDark);       // top frame
  rect(ctx, x, y, 1, h, frameDark);       // left frame
  rect(ctx, x + w - 1, y, 1, h, frameLight); // right frame
  rect(ctx, x, y + h - 1, w, 1, frameLight); // bottom frame
  // Glass fill
  rect(ctx, x + 1, y + 1, w - 2, h - 2, glass);
  // Highlight dot: top-right of glass (sky reflection)
  if (w >= 3 && h >= 3) {
    px(ctx, x + w - 2, y + 1, glassHi);
  }
}

/** Shopfront glass with diagonal highlight line */
function drawGlass(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, isNight: boolean) {
  const glass = isNight ? PALETTE.WINDOW_GLOW : PALETTE.WINDSHIELD;
  const hi = isNight ? PALETTE.PURE_WHITE : PALETTE.CYAN;
  const sill = darken(glass, 0.2);
  rect(ctx, x, y, w, h, glass);
  // Bottom sill shadow
  rect(ctx, x, y + h - 1, w, 1, sill);
  // Diagonal highlight (top-left to bottom-right, 1px line)
  const steps = Math.min(w, h);
  for (let i = 0; i < steps; i++) {
    const hx = x + Math.floor(i * (w - 1) / Math.max(1, steps - 1));
    const hy = y + Math.floor(i * (h - 1) / Math.max(1, steps - 1));
    px(ctx, hx, hy, hi);
  }
}

/** 3-tone awning with optional scalloped edge and cast shadow */
function drawAwning(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, base: string, scalloped = false) {
  const hi = lighten(base, 0.25);
  const sh = darken(base, 0.25);
  rect(ctx, x, y, w, h, base);
  rect(ctx, x, y, w, 1, hi); // top highlight
  if (scalloped) {
    // Scalloped bottom edge
    for (let sx = x; sx < x + w; sx++) {
      px(ctx, sx, y + h - 1, (sx - x) % 3 === 0 ? darken(sh, 0.15) : sh);
    }
  } else {
    rect(ctx, x, y + h - 1, w, 1, sh); // flat bottom shadow
  }
  // Cast shadow below awning (onto next surface)
  ctx.globalAlpha = 0.2;
  rect(ctx, x, y + h, w, 1, PALETTE.DARK_NAVY);
  ctx.globalAlpha = 1.0;
}

/** Door with recessed frame and handle */
function drawDoor(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, isGlass: boolean, isNight: boolean) {
  const frame = PALETTE.CHARCOAL;
  // Frame (recessed shadow on top + left)
  rect(ctx, x, y, w, 1, frame);
  rect(ctx, x, y, 1, h, frame);
  if (isGlass) {
    drawGlass(ctx, x + 1, y + 1, w - 2, h - 2, isNight);
  } else {
    const doorColor = PALETTE.STATION_ROOF;
    rect(ctx, x + 1, y + 1, w - 2, h - 2, doorColor);
    rect(ctx, x + 1, y + 1, w - 2, 1, lighten(doorColor, 0.15));
  }
  // Handle (bright dot, right side, mid height)
  px(ctx, x + w - 2, y + Math.floor(h / 2), PALETTE.NEAR_WHITE);
  // Threshold
  rect(ctx, x, y + h - 1, w, 1, darken(frame, 0.2));
}

/** Vending machine micro-sprite */
function drawVendingMachine(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // 4×8 with shading
  rect3(ctx, x, y, 4, 8, PALETTE.BRIGHT_BLUE);
  // Product display
  rect(ctx, x + 1, y + 1, 2, 3, PALETTE.SIGNAL_RED);
  px(ctx, x + 2, y + 1, lighten(PALETTE.SIGNAL_RED, 0.3)); // highlight
  // Dispensing slot
  rect(ctx, x + 1, y + 5, 2, 1, PALETTE.DARK_NAVY);
  // Coin slot glow
  px(ctx, x + 1, y + 6, PALETTE.GOLDEN);
}


// ---- Road Tiles (20×20) ----
function generateRoadTiles() {
  const T = 20;

  // Asphalt — sparse noise texture
  {
    const [c, ctx] = createPixelCanvas(T, T);
    rect(ctx, 0, 0, T, T, PALETTE.ROAD_MID);
    // ~5% noise: random lighter/darker pixels
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        const r = Math.random();
        if (r < 0.03) px(ctx, x, y, lighten(PALETTE.ROAD_MID, 0.1));
        else if (r < 0.06) px(ctx, x, y, PALETTE.ROAD_DARK);
      }
    }
    addFrame("road_asphalt", c, T, T);
  }

  // Lane marking horizontal (dashed) — 3-tone raised paint
  {
    const [c, ctx] = createPixelCanvas(T, T);
    rect(ctx, 0, 0, T, T, PALETTE.ROAD_MID);
    for (const lx of [2, 12]) {
      rect(ctx, lx, 9, 6, 2, PALETTE.LANE_MARKING);
      rect(ctx, lx, 9, 6, 1, PALETTE.PURE_WHITE); // highlight top
      rect(ctx, lx, 10, 6, 1, darken(PALETTE.LANE_MARKING, 0.1)); // shadow bottom
    }
    addFrame("road_lane_h", c, T, T);
  }

  // Lane marking vertical (dashed)
  {
    const [c, ctx] = createPixelCanvas(T, T);
    rect(ctx, 0, 0, T, T, PALETTE.ROAD_MID);
    for (const ly of [2, 12]) {
      rect(ctx, 9, ly, 2, 6, PALETTE.LANE_MARKING);
      rect(ctx, 9, ly, 1, 6, PALETTE.PURE_WHITE); // highlight left
      rect(ctx, 10, ly, 1, 6, darken(PALETTE.LANE_MARKING, 0.1)); // shadow right
    }
    addFrame("road_lane_v", c, T, T);
  }

  // Zebra tile: horizontal bars (E-W bars, stacked vertically)
  // Used for crossings where pedestrians walk N-S (east & west sides)
  // Bars are PARALLEL to the EW road = PERPENDICULAR to the walking direction
  // 3px tall bars, 2px gap = 5px period
  {
    const [c, ctx] = createPixelCanvas(T, T);
    rect(ctx, 0, 0, T, T, PALETTE.ROAD_MID);
    for (let i = 0; i < T; i += 5) {
      rect(ctx, 0, i, T, 3, PALETTE.ZEBRA_WHITE);
      rect(ctx, 0, i, T, 1, PALETTE.PURE_WHITE); // top highlight
      rect(ctx, 0, i + 2, T, 1, darken(PALETTE.ZEBRA_WHITE, 0.08)); // bottom shadow
    }
    addFrame("zebra_h", c, T, T);
  }

  // Zebra tile: vertical bars (N-S bars, stacked horizontally)
  // Used for crossings where pedestrians walk E-W (north & south sides)
  // Bars are PARALLEL to the NS road = PERPENDICULAR to the walking direction
  // 3px wide bars, 2px gap = 5px period
  {
    const [c, ctx] = createPixelCanvas(T, T);
    rect(ctx, 0, 0, T, T, PALETTE.ROAD_MID);
    for (let i = 0; i < T; i += 5) {
      rect(ctx, i, 0, 3, T, PALETTE.ZEBRA_WHITE);
      rect(ctx, i, 0, 1, T, PALETTE.PURE_WHITE); // left highlight
      rect(ctx, i + 2, 0, 1, T, darken(PALETTE.ZEBRA_WHITE, 0.08)); // right shadow
    }
    addFrame("zebra_v", c, T, T);
  }

  // Diagonal corridor crossing SW↔NE (80×80, transparent background overlay)
  // This is the single famous Shibuya diagonal — a rectangular corridor at 45°
  // containing NW-SE bars (perpendicular to the SW-NE walking direction).
  // Placed on top of the intersection tiles so worn asphalt shows through gaps.
  {
    const SIZE = 80; // matches intersection size (ROAD_W × ROAD_W)
    const [c, ctx] = createPixelCanvas(SIZE, SIZE);
    // Canvas starts fully transparent — worn asphalt intersection tiles show through

    const CENTER_SUM = SIZE - 1; // x + y = 79 along the corridor center line (SW to NE)
    const HALF_W = 14; // |x+y - 79| ≤ 14 → ~20px perpendicular width

    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        // Corridor mask: perpendicular distance from center line
        const v = x + y - CENTER_SUM;
        if (Math.abs(v) > HALF_W) continue; // outside corridor

        // Bar pattern: NW-SE bars (direction (1,1), constant x-y along each bar)
        // Bars stack along the walking direction (x-y increases from SW to NE)
        // Period 5: 3 bar pixels + 2 gap pixels
        const u = ((x - y) % 5 + 500) % 5; // positive modulo
        if (u >= 3) continue; // gap — transparent, shows asphalt below

        // Draw bar pixel with highlight/shadow
        if (u === 0) {
          px(ctx, x, y, PALETTE.PURE_WHITE); // highlight edge (NW side of bar)
        } else if (u === 2) {
          px(ctx, x, y, darken(PALETTE.ZEBRA_WHITE, 0.08)); // shadow edge (SE side)
        } else {
          px(ctx, x, y, PALETTE.ZEBRA_WHITE); // bar body
        }
      }
    }
    addFrame("zebra_diag_corridor", c, SIZE, SIZE);
  }

  // Stop line horizontal (solid white line across full tile, near bottom)
  // 2px thick solid line
  {
    const [c, ctx] = createPixelCanvas(T, T);
    rect(ctx, 0, 0, T, T, PALETTE.ROAD_MID);
    rect(ctx, 0, T - 2, T, 2, PALETTE.ZEBRA_WHITE);
    rect(ctx, 0, T - 2, T, 1, PALETTE.PURE_WHITE); // highlight
    addFrame("stop_line_h_bottom", c, T, T);
  }

  // Stop line horizontal (near top — for southbound)
  {
    const [c, ctx] = createPixelCanvas(T, T);
    rect(ctx, 0, 0, T, T, PALETTE.ROAD_MID);
    rect(ctx, 0, 0, T, 2, PALETTE.ZEBRA_WHITE);
    rect(ctx, 0, 0, T, 1, PALETTE.PURE_WHITE);
    addFrame("stop_line_h_top", c, T, T);
  }

  // Stop line vertical (near right edge — for westbound)
  {
    const [c, ctx] = createPixelCanvas(T, T);
    rect(ctx, 0, 0, T, T, PALETTE.ROAD_MID);
    rect(ctx, T - 2, 0, 2, T, PALETTE.ZEBRA_WHITE);
    rect(ctx, T - 2, 0, 1, T, PALETTE.PURE_WHITE);
    addFrame("stop_line_v_right", c, T, T);
  }

  // Stop line vertical (near left edge — for eastbound)
  {
    const [c, ctx] = createPixelCanvas(T, T);
    rect(ctx, 0, 0, T, T, PALETTE.ROAD_MID);
    rect(ctx, 0, 0, 2, T, PALETTE.ZEBRA_WHITE);
    rect(ctx, 0, 0, 1, T, PALETTE.PURE_WHITE);
    addFrame("stop_line_v_left", c, T, T);
  }

  // Sidewalk — tile grid with subtle paving lines
  {
    const [c, ctx] = createPixelCanvas(T, T);
    const base = PALETTE.SIDEWALK;
    const hi = lighten(base, 0.12);
    const sh = darken(base, 0.1);
    rect(ctx, 0, 0, T, T, base);
    // Paving slab grid every 5px
    for (let lx = 0; lx < T; lx += 5) {
      rect(ctx, lx, 0, 1, T, sh);
      if (lx + 1 < T) rect(ctx, lx + 1, 0, 1, T, hi);
    }
    for (let ly = 0; ly < T; ly += 5) {
      rect(ctx, 0, ly, T, 1, sh);
      if (ly + 1 < T) rect(ctx, 0, ly + 1, T, 1, hi);
    }
    addFrame("sidewalk", c, T, T);
  }

  // Intersection center — worn asphalt (lighter from heavy pedestrian traffic)
  {
    const [c, ctx] = createPixelCanvas(T, T);
    const wornBase = lighten(PALETTE.ROAD_MID, 0.06);
    rect(ctx, 0, 0, T, T, wornBase);
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        const r = Math.random();
        if (r < 0.06) px(ctx, x, y, lighten(wornBase, 0.1));
        else if (r < 0.10) px(ctx, x, y, PALETTE.ROAD_MID);
        else if (r < 0.12) px(ctx, x, y, PALETTE.ROAD_DARK);
      }
    }
    addFrame("intersection", c, T, T);
  }
}


// ---- Vehicle Sprites (¾ view, 3-tone body shading) ----
type Dir = "n" | "s" | "e" | "w";

function drawVehicle3Quarter(
  ctx: CanvasRenderingContext2D,
  dir: Dir,
  w: number, h: number,
  bodyColor: string,
  faceH: number,
) {
  const hi = lighten(bodyColor, 0.2);
  const sh = darken(bodyColor, 0.2);
  const shDeep = darken(bodyColor, 0.35);
  const glassHi = PALETTE.CYAN;

  if (dir === "s" || dir === "n") {
    drawShadow(ctx, 0, 0, w, h, 2, 2, 0.2);
    const roofH = h - faceH;

    // ── Roof: 3-tone ──
    rect(ctx, 1, 0, w - 2, roofH, hi); // highlight base (top surface catches light)
    rect(ctx, 0, 0, 1, roofH, bodyColor); // left edge
    rect(ctx, w - 1, 0, 1, roofH, sh); // right edge shadow
    rect(ctx, 1, 0, w - 2, 1, lighten(hi, 0.15)); // top edge brightest
    rect(ctx, 1, roofH - 1, w - 2, 1, bodyColor); // bottom of roof
    // Specular highlight (1px bright spot on roof)
    px(ctx, Math.floor(w / 2), 1, PALETTE.NEAR_WHITE);
    // Windshield on roof (glass strip)
    const wsY = dir === "s" ? 2 : roofH - 4;
    rect(ctx, 3, wsY, w - 6, 2, PALETTE.WINDSHIELD);
    px(ctx, w - 4, wsY, glassHi); // reflection dot

    // ── Front/rear face: 3-tone ──
    rect(ctx, 0, roofH, w, faceH, bodyColor);
    // Shadow gradient: bottom and right edges
    rect(ctx, w - 1, roofH, 1, faceH, sh);
    rect(ctx, 0, h - 1, w, 1, shDeep);
    // Roof overhang shadow
    roofOverhangShadow(ctx, 0, roofH, w);

    if (dir === "s") {
      // Windshield with diagonal highlight
      rect(ctx, 2, roofH + 1, w - 4, 3, PALETTE.WINDSHIELD);
      // Glass diagonal reflection
      for (let i = 0; i < 3; i++) {
        px(ctx, 2 + Math.floor(i * (w - 5) / 2), roofH + 1 + i, glassHi);
      }
      // Hood (3-tone)
      rect(ctx, 1, roofH + 4, w - 2, faceH - 6, bodyColor);
      rect(ctx, 1, roofH + 4, w - 2, 1, hi); // hood top highlight
      // Bumper
      rect3(ctx, 0, h - 2, w, 2, shDeep);
      // Headlights
      rect(ctx, 1, h - 3, 2, 2, PALETTE.HEADLIGHT);
      px(ctx, 1, h - 3, PALETTE.PURE_WHITE); // bright center
      rect(ctx, w - 3, h - 3, 2, 2, PALETTE.HEADLIGHT);
      px(ctx, w - 2, h - 3, PALETTE.PURE_WHITE);
      // License plate
      rect(ctx, 5, h - 2, w - 10, 1, PALETTE.NEAR_WHITE);
    } else {
      // Rear window
      rect(ctx, 3, roofH + 1, w - 6, 2, PALETTE.WINDSHIELD);
      px(ctx, w - 4, roofH + 1, glassHi);
      // Trunk (3-tone)
      rect(ctx, 1, roofH + 3, w - 2, faceH - 5, bodyColor);
      rect(ctx, 1, roofH + 3, w - 2, 1, hi);
      // Bumper
      rect3(ctx, 0, h - 2, w, 2, shDeep);
      // Taillights
      rect(ctx, 1, h - 3, 2, 2, PALETTE.TAILLIGHT);
      px(ctx, 1, h - 3, lighten(PALETTE.TAILLIGHT, 0.3));
      rect(ctx, w - 3, h - 3, 2, 2, PALETTE.TAILLIGHT);
      px(ctx, w - 2, h - 3, lighten(PALETTE.TAILLIGHT, 0.3));
      rect(ctx, 5, h - 2, w - 10, 1, PALETTE.NEAR_WHITE);
    }
    // Wheels (2-tone)
    rect(ctx, 0, roofH + 1, 1, 3, PALETTE.WHEEL);
    px(ctx, 0, roofH + 1, PALETTE.CHARCOAL);
    rect(ctx, w - 1, roofH + 1, 1, 3, PALETTE.WHEEL);
    rect(ctx, 0, h - 5, 1, 3, PALETTE.WHEEL);
    px(ctx, 0, h - 5, PALETTE.CHARCOAL);
    rect(ctx, w - 1, h - 5, 1, 3, PALETTE.WHEEL);
  } else {
    // E/W: canvas is h×w
    const cw = h, ch = w;
    drawShadow(ctx, 0, 0, cw, ch, 2, 2, 0.2);
    const roofW = cw - faceH;

    if (dir === "e") {
      // Roof (left portion, 3-tone)
      rect(ctx, 0, 1, roofW, ch - 2, hi);
      rect(ctx, 0, 0, roofW, 1, lighten(hi, 0.15)); // top
      rect(ctx, 0, ch - 1, roofW, 1, sh); // bottom
      rect(ctx, 0, 1, 1, ch - 2, hi); // left
      px(ctx, Math.floor(roofW / 2), 1, PALETTE.NEAR_WHITE); // specular
      rect(ctx, roofW - 4, 2, 2, ch - 4, PALETTE.WINDSHIELD);
      px(ctx, roofW - 3, 2, glassHi);

      // Side face (right portion, 3-tone)
      rect(ctx, roofW, 0, faceH, ch, bodyColor);
      rect(ctx, cw - 1, 0, 1, ch, sh); // right shadow
      rect(ctx, roofW, ch - 1, faceH, 1, shDeep); // bottom shadow
      roofOverhangShadow(ctx, roofW, 0, ch); // vertical overhang — draw along top
      // Side windows (inset)
      for (let wy = roofW + 2; wy + 3 <= cw - 2; wy += 4) {
        drawWindow(ctx, wy, 2, 3, 3, bodyColor, false, true);
      }
      // Door line
      rect(ctx, roofW + Math.floor(faceH / 2), 1, 1, ch - 2, sh);
      // Wheels (2-tone)
      rect(ctx, roofW + 1, 0, 3, 1, PALETTE.WHEEL);
      px(ctx, roofW + 1, 0, PALETTE.CHARCOAL);
      rect(ctx, roofW + 1, ch - 1, 3, 1, PALETTE.WHEEL);
      rect(ctx, cw - 3, 0, 2, 1, PALETTE.WHEEL);
      rect(ctx, cw - 3, ch - 1, 2, 1, PALETTE.WHEEL);
      px(ctx, cw - 1, 1, PALETTE.HEADLIGHT);
      px(ctx, cw - 1, ch - 2, PALETTE.HEADLIGHT);
      px(ctx, 0, 1, PALETTE.TAILLIGHT);
      px(ctx, 0, ch - 2, PALETTE.TAILLIGHT);
    } else {
      // West: mirror
      rect(ctx, faceH, 1, roofW, ch - 2, hi);
      rect(ctx, faceH, 0, roofW, 1, lighten(hi, 0.15));
      rect(ctx, faceH, ch - 1, roofW, 1, sh);
      rect(ctx, cw - 1, 1, 1, ch - 2, sh);
      px(ctx, faceH + Math.floor(roofW / 2), 1, PALETTE.NEAR_WHITE);
      rect(ctx, faceH + 2, 2, 2, ch - 4, PALETTE.WINDSHIELD);
      px(ctx, faceH + 3, 2, glassHi);

      rect(ctx, 0, 0, faceH, ch, bodyColor);
      rect(ctx, 0, 0, 1, ch, hi); // left highlight
      rect(ctx, 0, ch - 1, faceH, 1, shDeep);
      for (let wy = 2; wy + 3 <= faceH - 1; wy += 4) {
        drawWindow(ctx, wy, 2, 3, 3, bodyColor, false, true);
      }
      rect(ctx, Math.floor(faceH / 2), 1, 1, ch - 2, sh);
      rect(ctx, 0, 0, 2, 1, PALETTE.WHEEL);
      rect(ctx, 0, ch - 1, 2, 1, PALETTE.WHEEL);
      rect(ctx, faceH - 4, 0, 3, 1, PALETTE.WHEEL);
      px(ctx, faceH - 2, 0, PALETTE.CHARCOAL);
      rect(ctx, faceH - 4, ch - 1, 3, 1, PALETTE.WHEEL);
      px(ctx, 0, 1, PALETTE.HEADLIGHT);
      px(ctx, 0, ch - 2, PALETTE.HEADLIGHT);
      px(ctx, cw - 1, 1, PALETTE.TAILLIGHT);
      px(ctx, cw - 1, ch - 2, PALETTE.TAILLIGHT);
    }
  }
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
      const isVert = dir === "n" || dir === "s";
      const cw = isVert ? 16 : 24, ch = isVert ? 24 : 16;
      const [c, ctx] = createPixelCanvas(cw, ch);
      drawVehicle3Quarter(ctx, dir, 16, 24, color, 10);
      addFrame(`sedan_${name}_${dir}`, c, cw, ch);
    }
  }

  // Taxi
  for (const dir of dirs) {
    const isVert = dir === "n" || dir === "s";
    const cw = isVert ? 16 : 24, ch = isVert ? 24 : 16;
    const [c, ctx] = createPixelCanvas(cw, ch);
    drawVehicle3Quarter(ctx, dir, 16, 24, PALETTE.TAXI_BODY, 10);
    // Taxi roof light (3-tone)
    if (isVert) {
      rect3(ctx, 6, 3, 4, 3, PALETTE.TAXI_SIGN);
      px(ctx, 7, 3, lighten(PALETTE.TAXI_SIGN, 0.3)); // glow
    } else {
      const rx = dir === "e" ? 5 : 16;
      rect3(ctx, rx, 5, 3, 4, PALETTE.TAXI_SIGN);
    }
    addFrame(`taxi_${dir}`, c, cw, ch);
  }

  // Bus
  for (const dir of dirs) {
    const isVert = dir === "n" || dir === "s";
    const cw = isVert ? 16 : 40, ch = isVert ? 40 : 16;
    const [c, ctx] = createPixelCanvas(cw, ch);
    drawVehicle3Quarter(ctx, dir, 16, 40, PALETTE.BUS_BODY, 16);
    // Side windows (inset, repeated)
    if (!isVert) {
      const fs = dir === "e" ? 24 : 0;
      const fe = dir === "e" ? 40 : 16;
      for (let wy = fs + 2; wy + 3 <= fe - 1; wy += 4) {
        drawWindow(ctx, wy, 2, 3, 3, PALETTE.BUS_BODY, false, true);
      }
    }
    // Destination sign (bright strip)
    if (isVert) {
      rect3(ctx, 4, 7, 8, 3, PALETTE.LIME);
    } else {
      const mid = dir === "e" ? 7 : 29;
      rect3(ctx, mid, 5, 3, 6, PALETTE.LIME);
    }
    addFrame(`bus_${dir}`, c, cw, ch);
  }

  // Kei Truck
  for (const dir of dirs) {
    const isVert = dir === "n" || dir === "s";
    const cw = isVert ? 14 : 20, ch = isVert ? 20 : 14;
    const [c, ctx] = createPixelCanvas(cw, ch);
    drawVehicle3Quarter(ctx, dir, 14, 20, PALETTE.KEI_TRUCK, 8);
    // Truck bed (3-tone)
    if (isVert) {
      const bedY = dir === "s" ? 1 : 6;
      rect3(ctx, 2, bedY, 10, 5, PALETTE.CHARCOAL);
      rect(ctx, 3, bedY + 1, 8, 3, PALETTE.SUIT_GREY);
      px(ctx, 3, bedY + 1, lighten(PALETTE.SUIT_GREY, 0.15));
    } else {
      const bedX = dir === "e" ? 1 : 12;
      rect3(ctx, bedX, 2, 5, 10, PALETTE.CHARCOAL);
      rect(ctx, bedX + 1, 3, 3, 8, PALETTE.SUIT_GREY);
    }
    addFrame(`kei_truck_${dir}`, c, cw, ch);
  }

  // Police car
  for (const dir of dirs) {
    const isVert = dir === "n" || dir === "s";
    const cw = isVert ? 16 : 24, ch = isVert ? 24 : 16;
    const [c, ctx] = createPixelCanvas(cw, ch);
    drawVehicle3Quarter(ctx, dir, 16, 24, PALETTE.POLICE, 10);
    if (isVert) {
      rect(ctx, 2, 5, 12, 2, PALETTE.CAR_BLACK);
      // Light bar with glow pixels
      rect(ctx, 4, 4, 3, 2, PALETTE.SIGNAL_RED);
      px(ctx, 5, 3, lighten(PALETTE.SIGNAL_RED, 0.4)); // glow
      rect(ctx, 9, 4, 3, 2, PALETTE.BRIGHT_BLUE);
      px(ctx, 10, 3, lighten(PALETTE.BRIGHT_BLUE, 0.4));
    } else {
      const rm = dir === "e" ? 6 : 18;
      rect(ctx, rm - 1, 2, 2, 12, PALETTE.CAR_BLACK);
      rect(ctx, rm - 1, 4, 2, 3, PALETTE.SIGNAL_RED);
      rect(ctx, rm - 1, 9, 2, 3, PALETTE.BRIGHT_BLUE);
    }
    addFrame(`police_${dir}`, c, cw, ch);
  }
}


// ---- Pedestrian Sprites (10×16, shaded) ----
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
  const legOffset = frame === 1 ? -1 : frame === 3 ? 1 : 0;
  const facingRight = dir === "e" || dir === "ne" || dir === "se";
  const facingLeft = dir === "w" || dir === "nw" || dir === "sw";
  const facingSouth = dir === "s" || dir === "se" || dir === "sw";
  const facingNorth = dir === "n" || dir === "ne" || dir === "nw";

  const hairHi = lighten(v.hair, 0.2);
  const skinSh = darken(v.skin, 0.15);
  const topHi = lighten(v.top, 0.15);
  const topSh = darken(v.top, 0.15);
  const botSh = darken(v.bottom, 0.15);

  // Shadow ellipse
  drawShadow(ctx, 2, 14, 6, 2, 1, 1, 0.15);

  // Head (4×3) — 2-tone skin
  rect(ctx, 3, 0, 4, 3, v.skin);
  // Skin shadow on right side (light from left)
  rect(ctx, 6, 1, 1, 2, skinSh);
  // Hair: 2-tone (base + highlight on top-left)
  rect(ctx, 3, 0, 4, 1, v.hair);
  px(ctx, 3, 0, hairHi); // highlight pixel
  if (facingRight) px(ctx, 7, 1, v.hair);
  else if (facingLeft) px(ctx, 2, 1, v.hair);

  // Face details for south-facing
  if (facingSouth) {
    px(ctx, 4, 1, PALETTE.DARK_NAVY);
    px(ctx, 6, 1, PALETTE.DARK_NAVY);
  }

  // Shoulders
  rect(ctx, 2, 3, 6, 1, v.top);
  px(ctx, 2, 3, topHi); // left highlight

  // Torso — 2-tone (highlight left, shadow right+bottom)
  rect(ctx, 3, 3, 4, 5, v.top);
  rect(ctx, 3, 3, 1, 5, topHi); // left highlight
  rect(ctx, 6, 3, 1, 5, topSh); // right shadow
  rect(ctx, 3, 7, 4, 1, topSh); // bottom shadow

  // Arms
  if (frame === 1) {
    rect(ctx, 2, 4, 1, 4, v.top);
    rect(ctx, 7, 3, 1, 4, topSh);
  } else if (frame === 3) {
    rect(ctx, 2, 3, 1, 4, topHi);
    rect(ctx, 7, 4, 1, 4, v.top);
  } else {
    rect(ctx, 2, 4, 1, 3, v.top);
    rect(ctx, 7, 4, 1, 3, topSh);
  }

  // Legs — 2-tone
  rect(ctx, 3, 8, 2, 6, v.bottom);
  rect(ctx, 5, 8, 2, 6, v.bottom);
  rect(ctx, 6, 8, 1, 6, botSh); // right leg shadow

  if (legOffset !== 0) {
    rect(ctx, 3, 13 + Math.max(0, legOffset), 2, 1, v.bottom);
    rect(ctx, 5, 13 + Math.max(0, -legOffset), 2, 1, v.bottom);
  }

  // Shoes (distinct)
  rect(ctx, 3, 14, 2, 2, PALETTE.SHOES);
  px(ctx, 3, 14, PALETTE.CHARCOAL); // highlight
  rect(ctx, 5, 14, 2, 2, PALETTE.SHOES);

  // Accessory (3-tone where possible)
  if (v.accessory) {
    if (facingRight) {
      rect(ctx, 1, 3, 2, 4, v.accessory);
      px(ctx, 1, 3, lighten(v.accessory, 0.2)); // highlight
    } else if (facingLeft) {
      rect(ctx, 7, 3, 2, 4, v.accessory);
      px(ctx, 7, 3, lighten(v.accessory, 0.2));
    } else if (facingNorth) {
      rect(ctx, 3, 4, 4, 3, v.accessory);
      px(ctx, 3, 4, lighten(v.accessory, 0.2));
    } else {
      rect(ctx, 2, 4, 1, 3, v.accessory);
    }
  }
}

function generatePedestrians() {
  const dirs: PedDir[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
  for (const v of PED_VARIANTS) {
    for (const dir of dirs) {
      for (const frame of [0, 1, 2, 3]) {
        const [c, ctx] = createPixelCanvas(10, 16);
        drawPedestrian(ctx, v, frame, dir);
        addFrame(`ped_${v.name}_${dir}_${frame}`, c, 10, 16);
      }
    }
  }
}


// ---- Cyclist Sprites (¾ view, shaded) ----

function drawCyclist3Quarter(
  ctx: CanvasRenderingContext2D, dir: Dir, isDelivery: boolean,
  frame: number, cw: number, ch: number,
) {
  const topColor = isDelivery ? PALETTE.BUS_BODY : PALETTE.SUIT_GREY;
  const topHi = lighten(topColor, 0.15);
  const topSh = darken(topColor, 0.15);
  const pedalOff = frame === 0 ? 0 : 1;

  drawShadow(ctx, 0, 0, cw, ch, 1, 1, 0.15);

  if (dir === "s" || dir === "n") {
    // Bike frame
    rect(ctx, 4, 3, 2, ch - 6, PALETTE.BIKE_FRAME);
    px(ctx, 4, 3, lighten(PALETTE.BIKE_FRAME, 0.2));

    // Wheels (2-tone)
    const fwy = dir === "s" ? ch - 5 - pedalOff : 1 + pedalOff;
    const rwy = dir === "s" ? 1 + pedalOff : ch - 5 - pedalOff;
    rect(ctx, 3, fwy, 4, 4, PALETTE.BIKE_WHEEL);
    rect(ctx, 4, fwy + 1, 2, 2, lighten(PALETTE.BIKE_WHEEL, 0.2));
    rect(ctx, 3, rwy, 4, 4, PALETTE.BIKE_WHEEL);
    rect(ctx, 4, rwy + 1, 2, 2, lighten(PALETTE.BIKE_WHEEL, 0.2));

    const ry = Math.floor(ch / 2) - 5;
    // Helmet (2-tone)
    rect(ctx, 3, ry, 4, 2, PALETTE.SUIT_DARK);
    px(ctx, 3, ry, lighten(PALETTE.SUIT_DARK, 0.2));
    rect(ctx, 3, ry + 2, 4, 1, PALETTE.SKIN_LIGHT);
    // Torso (3-tone)
    rect(ctx, 2, ry + 3, 6, 3, topColor);
    rect(ctx, 2, ry + 3, 1, 3, topHi);
    rect(ctx, 7, ry + 3, 1, 3, topSh);
    rect(ctx, 1, ry + 3, 1, 2, topColor);
    rect(ctx, 8, ry + 3, 1, 2, topSh);
    // Legs
    rect(ctx, 2 - pedalOff, ry + 6, 2, 3, PALETTE.SUIT_DARK);
    rect(ctx, 6 + pedalOff, ry + 6, 2, 3, PALETTE.SUIT_DARK);

    if (isDelivery) {
      const boxY = dir === "s" ? ry - 2 : ry + 10;
      rect3(ctx, 2, boxY, 6, 3, PALETTE.DELIVERY_BOX);
    }
  } else {
    rect(ctx, 3, 4, cw - 6, 2, PALETTE.BIKE_FRAME);
    px(ctx, 3, 4, lighten(PALETTE.BIKE_FRAME, 0.2));

    const fwx = dir === "e" ? cw - 5 - pedalOff : 1 + pedalOff;
    const rwx = dir === "e" ? 1 + pedalOff : cw - 5 - pedalOff;
    rect(ctx, fwx, 3, 4, 4, PALETTE.BIKE_WHEEL);
    rect(ctx, fwx + 1, 4, 2, 2, lighten(PALETTE.BIKE_WHEEL, 0.2));
    rect(ctx, rwx, 3, 4, 4, PALETTE.BIKE_WHEEL);
    rect(ctx, rwx + 1, 4, 2, 2, lighten(PALETTE.BIKE_WHEEL, 0.2));

    const rx = Math.floor(cw / 2) - 4;
    rect(ctx, rx, 1, 2, 3, PALETTE.SUIT_DARK);
    px(ctx, rx, 1, lighten(PALETTE.SUIT_DARK, 0.2));
    rect(ctx, rx + 2, 1, 1, 3, PALETTE.SKIN_LIGHT);
    rect(ctx, rx + 2, 2, 3, 4, topColor);
    rect(ctx, rx + 2, 2, 3, 1, topHi);
    rect(ctx, rx + 4, 2, 1, 4, topSh);
    rect(ctx, rx + 2, 1, 2, 1, topColor);
    rect(ctx, rx + 4, 2 - pedalOff, 3, 2, PALETTE.SUIT_DARK);
    rect(ctx, rx + 4, 6 + pedalOff, 3, 2, PALETTE.SUIT_DARK);

    if (isDelivery) {
      const bx = dir === "e" ? rx - 3 : rx + 8;
      rect3(ctx, bx, 1, 3, 6, PALETTE.DELIVERY_BOX);
    }
  }
}

function generateCyclists() {
  const dirs: Dir[] = ["n", "s", "e", "w"];
  for (const type of ["commuter", "delivery"] as const) {
    const isDel = type === "delivery";
    for (const dir of dirs) {
      for (const frame of [0, 1]) {
        const isVert = dir === "n" || dir === "s";
        const baseLen = isDel ? 22 : 20;
        const cw = isVert ? 10 : baseLen, ch = isVert ? baseLen : 10;
        const [c, ctx] = createPixelCanvas(cw, ch);
        drawCyclist3Quarter(ctx, dir, isDel, frame, cw, ch);
        addFrame(`cyclist_${type}_${dir}_${frame}`, c, cw, ch);
      }
    }
  }
}


// ---- Traffic Lights (¾ view, 3-tone housing) ----
function generateTrafficLights() {
  for (const state of ["red", "yellow", "green"] as const) {
    const [c, ctx] = createPixelCanvas(8, 8);
    // Gantry arm
    rect3(ctx, 0, 0, 8, 1, PALETTE.SIGNAL_POST);
    // Housing top (3-tone)
    rect3(ctx, 2, 1, 4, 2, darken(PALETTE.SIGNAL_POST, 0.15));
    // Housing front (3-tone)
    rect3(ctx, 2, 3, 4, 3, PALETTE.SIGNAL_POST);
    // Active light with glow
    const lc = state === "red" ? PALETTE.SIGNAL_RED
             : state === "yellow" ? PALETTE.SIGNAL_YELLOW : PALETTE.LIME;
    rect(ctx, 3, 3, 2, 2, lc);
    px(ctx, 3, 3, lighten(lc, 0.3)); // glow highlight
    rect(ctx, 2, 6, 5, 1, PALETTE.SIGNAL_OFF);
    addFrame(`signal_vehicle_${state}`, c, 8, 8);
  }

  for (const state of ["walk", "stop", "flash"] as const) {
    const [c, ctx] = createPixelCanvas(6, 7);
    rect3(ctx, 0, 0, 6, 1, darken(PALETTE.SIGNAL_POST, 0.15));
    rect3(ctx, 0, 1, 6, 4, PALETTE.SIGNAL_POST);
    const color = state === "walk" ? PALETTE.WALK_GREEN
                : state === "stop" ? PALETTE.STOP_RED : PALETTE.FLASH_DIM;
    rect(ctx, 1, 2, 4, 2, color);
    px(ctx, 1, 2, lighten(color, 0.3));
    rect(ctx, 1, 5, 5, 1, PALETTE.SIGNAL_OFF);
    addFrame(`signal_ped_${state}`, c, 6, 7);
  }
}


// ---- Buildings: Template System ----

interface BuildingConfig {
  id: string;
  width: 40 | 60 | 80;
  floors: number;        // 1-4 (0 for subway special)
  heightOverride?: number;
  wallColor: string;
  roofColor: string;
  awningColor: string;
  groundFloor: {
    type: 'shop' | 'entrance' | 'convenience' | 'restaurant' | 'subway';
    doorPosition: 'center' | 'left' | 'right';
    doorIsGlass: boolean;
    hasVendingMachine: boolean;
  };
  upperFloorsOverride?: {
    screenColor: string;
    screenGlowColor: string;
    fromFloor: number;
    toFloor: number;
  };
  decorateGround?: (ctx: CanvasRenderingContext2D, gfY: number, W: number, isNight: boolean) => void;
  decorateSouth?: (ctx: CanvasRenderingContext2D, W: number, H: number, isNight: boolean) => void;
}

// ── 3×5 Pixel Font Map ──
const PIXEL_FONT: Record<string, number[]> = {
  'A': [0b010, 0b101, 0b111, 0b101, 0b101],
  'B': [0b110, 0b101, 0b110, 0b101, 0b110],
  'C': [0b011, 0b100, 0b100, 0b100, 0b011],
  'D': [0b110, 0b101, 0b101, 0b101, 0b110],
  'E': [0b111, 0b100, 0b110, 0b100, 0b111],
  'F': [0b111, 0b100, 0b110, 0b100, 0b100],
  'G': [0b011, 0b100, 0b101, 0b101, 0b011],
  'H': [0b101, 0b101, 0b111, 0b101, 0b101],
  'I': [0b111, 0b010, 0b010, 0b010, 0b111],
  'J': [0b001, 0b001, 0b001, 0b101, 0b010],
  'K': [0b101, 0b101, 0b110, 0b101, 0b101],
  'L': [0b100, 0b100, 0b100, 0b100, 0b111],
  'M': [0b101, 0b111, 0b111, 0b101, 0b101],
  'N': [0b101, 0b111, 0b111, 0b111, 0b101],
  'O': [0b010, 0b101, 0b101, 0b101, 0b010],
  'P': [0b110, 0b101, 0b110, 0b100, 0b100],
  'Q': [0b010, 0b101, 0b101, 0b110, 0b011],
  'R': [0b110, 0b101, 0b110, 0b101, 0b101],
  'S': [0b011, 0b100, 0b010, 0b001, 0b110],
  'T': [0b111, 0b010, 0b010, 0b010, 0b010],
  'U': [0b101, 0b101, 0b101, 0b101, 0b010],
  'V': [0b101, 0b101, 0b101, 0b010, 0b010],
  'W': [0b101, 0b101, 0b111, 0b111, 0b101],
  'X': [0b101, 0b101, 0b010, 0b101, 0b101],
  'Y': [0b101, 0b101, 0b010, 0b010, 0b010],
  'Z': [0b111, 0b001, 0b010, 0b100, 0b111],
  '0': [0b010, 0b101, 0b101, 0b101, 0b010],
  '1': [0b010, 0b110, 0b010, 0b010, 0b111],
  '2': [0b110, 0b001, 0b010, 0b100, 0b111],
  '3': [0b110, 0b001, 0b010, 0b001, 0b110],
  '4': [0b101, 0b101, 0b111, 0b001, 0b001],
  '5': [0b111, 0b100, 0b110, 0b001, 0b110],
  '6': [0b011, 0b100, 0b110, 0b101, 0b010],
  '7': [0b111, 0b001, 0b010, 0b010, 0b010],
  '8': [0b010, 0b101, 0b010, 0b101, 0b010],
  '9': [0b010, 0b101, 0b011, 0b001, 0b110],
  ' ': [0b000, 0b000, 0b000, 0b000, 0b000],
};

function drawPixelText(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string) {
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const glyph = PIXEL_FONT[ch];
    if (!glyph) { cx += 4; continue; }
    for (let row = 0; row < 5; row++) {
      const bits = glyph[row];
      if (bits & 0b100) px(ctx, cx, y + row, color);
      if (bits & 0b010) px(ctx, cx + 1, y + row, color);
      if (bits & 0b001) px(ctx, cx + 2, y + row, color);
    }
    cx += 4; // 3px char + 1px spacing
  }
}

function pixelTextWidth(text: string): number {
  return text.length * 4 - 1; // 3px per char + 1px spacing, minus trailing
}

// ── Template Sub-functions ──

function drawTemplateRoof(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, roofColor: string) {
  rect(ctx, x, y, w, 12, roofColor);
  rect(ctx, x, y, w, 1, darken(roofColor, 0.3));
  // Left highlight
  rect(ctx, x, y, 1, 12, lighten(roofColor, 0.15));
  // Right shadow
  rect(ctx, x + w - 1, y, 1, 12, darken(roofColor, 0.15));
}

function drawTemplateFloor(ctx: CanvasRenderingContext2D, floorY: number, w: number, wallColor: string, isNight: boolean) {
  // Wall fill (24px per floor)
  rect(ctx, 0, floorY, w, 24, wallColor);
  // Left highlight
  rect(ctx, 0, floorY, 1, 24, lighten(wallColor, 0.15));
  // Right shadow
  rect(ctx, w - 1, floorY, 1, 24, darken(wallColor, 0.15));
  // 1px floor separator at bottom
  rect(ctx, 0, floorY + 23, w, 1, darken(wallColor, 0.1));

  // 5×5 windows, uniformly spaced
  const glassColor = isNight ? PALETTE.WINDOW_GLOW : PALETTE.SKY_BLUE;
  const glassHi = isNight ? PALETTE.PURE_WHITE : PALETTE.CYAN;
  const winY = floorY + 10; // vertically centered in 24px
  const margin = w === 40 ? 5 : w === 60 ? 6 : 8;
  for (let wx = margin; wx + 5 <= w - margin; wx += 10) {
    // Window frame recess
    rect(ctx, wx, winY, 5, 5, darken(wallColor, 0.2));
    // Glass
    rect(ctx, wx, winY, 5, 5, glassColor);
    // Highlight dot top-right
    px(ctx, wx + 4, winY, glassHi);
  }
}

function drawTemplateGroundFloor(ctx: CanvasRenderingContext2D, gfY: number, w: number, config: BuildingConfig, isNight: boolean) {
  // Top 5px: awning strip
  rect(ctx, 0, gfY, w, 5, config.awningColor);
  rect(ctx, 0, gfY, w, 1, lighten(config.awningColor, 0.2));
  rect(ctx, 0, gfY + 4, w, 1, darken(config.awningColor, 0.2));

  // Middle 12px: glass storefront default
  const glass = isNight ? PALETTE.WINDOW_GLOW : PALETTE.SKY_BLUE;
  rect(ctx, 1, gfY + 5, w - 2, 12, glass);
  // Diagonal highlight on glass
  const hi = isNight ? PALETTE.PURE_WHITE : PALETTE.CYAN;
  for (let i = 0; i < 6; i++) {
    const hx = 1 + Math.floor(i * (w - 3) / 5);
    px(ctx, hx, gfY + 5 + Math.min(i, 11), hi);
  }

  // Bottom 7px: dark base strip
  rect(ctx, 0, gfY + 17, w, 7, darken(config.wallColor, 0.4));
  rect(ctx, 0, gfY + 17, w, 1, darken(config.wallColor, 0.3));

  // Door
  const doorW = 6;
  const doorH = 12;
  const doorY = gfY + 5;
  let doorX: number;
  if (config.groundFloor.doorPosition === 'left') doorX = 3;
  else if (config.groundFloor.doorPosition === 'right') doorX = w - doorW - 3;
  else doorX = Math.floor((w - doorW) / 2);

  if (config.groundFloor.doorIsGlass) {
    rect(ctx, doorX, doorY, doorW, doorH, glass);
    px(ctx, doorX + doorW - 1, doorY, hi);
    // Door frame
    rect(ctx, doorX, doorY, 1, doorH, darken(config.wallColor, 0.3));
    rect(ctx, doorX + doorW - 1, doorY, 1, doorH, darken(config.wallColor, 0.3));
  } else {
    rect(ctx, doorX, doorY, doorW, doorH, PALETTE.CHARCOAL);
    rect(ctx, doorX, doorY, doorW, 1, lighten(PALETTE.CHARCOAL, 0.15));
  }
  // Handle (bright dot, right side, mid height)
  px(ctx, doorX + doorW - 2, doorY + Math.floor(doorH / 2), PALETTE.NEAR_WHITE);

  // Vending machine
  if (config.groundFloor.hasVendingMachine) {
    const vmX = config.groundFloor.doorPosition === 'right' ? 2 : w - 6;
    drawVendingMachine(ctx, vmX, gfY + 5);
  }
}

function drawVideoScreenSegment(ctx: CanvasRenderingContext2D, y: number, w: number, h: number,
  override: NonNullable<BuildingConfig['upperFloorsOverride']>, isNight: boolean) {
  const screenColor = isNight ? override.screenGlowColor : override.screenColor;
  rect(ctx, 1, y, w - 2, h, screenColor);
  // 1px inset bezels
  rect(ctx, 1, y, w - 2, 1, darken(screenColor, 0.3));
  rect(ctx, 1, y, 1, h, darken(screenColor, 0.3));
  rect(ctx, w - 2, y, 1, h, lighten(screenColor, 0.1));
  rect(ctx, 1, y + h - 1, w - 2, 1, lighten(screenColor, 0.1));
  // Horizontal scanlines every 4px
  for (let sy = y + 2; sy < y + h - 1; sy += 4) {
    ctx.globalAlpha = 0.08;
    rect(ctx, 2, sy, w - 4, 1, PALETTE.DARK_NAVY);
    ctx.globalAlpha = 1.0;
  }
  // Night: highlight dots top-left
  if (isNight) {
    px(ctx, 2, y + 1, PALETTE.PURE_WHITE);
    px(ctx, 3, y + 1, PALETTE.PURE_WHITE);
  }
}

// ── Facing Helpers ──

function getExtraRoof(floors: number): number {
  if (floors >= 4) return 10;
  if (floors >= 3) return 8;
  if (floors >= 2) return 4;
  return 0;
}

function getSouthHeight(floors: number, heightOverride?: number): number {
  if (floors === 0) return heightOverride ?? 24;
  if (floors >= 4) return 60;
  if (floors >= 3) return 46;
  if (floors >= 2) return 36;
  return 28;
}

/** Roof top surface for north-facing buildings — lighter fill with AC units */
function drawRoofTopSurface(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, roofColor: string, floors: number) {
  const lightRoof = lighten(roofColor, 0.2);
  rect(ctx, x, y, w, h, lightRoof);
  // 1px darker border at top and left edges (shadow from "above")
  rect(ctx, x, y, w, 1, darken(roofColor, 0.1));
  rect(ctx, x, y, 1, h, darken(roofColor, 0.1));
  // AC units for tall buildings (floors >= 3)
  if (floors >= 3 && h > 6) {
    for (let ax = x + 6; ax + 3 <= x + w - 3; ax += 12) {
      for (let ay = y + 3; ay + 3 <= y + h - 3; ay += 6) {
        rect(ctx, ax, ay, 3, 3, PALETTE.COOL_GREY);
        px(ctx, ax, ay, lighten(PALETTE.COOL_GREY, 0.15));
      }
    }
  }
  // 2px dark fascia at bottom of roof surface
  if (h >= 2) {
    rect(ctx, x, y + h - 2, w, 2, darken(roofColor, 0.3));
  }
}

// ── Core Orchestrator ──

function drawBuildingFromTemplate(config: BuildingConfig, isNight: boolean) {
  const W = config.width;
  const H = config.heightOverride ?? (12 + 24 * config.floors);
  const [c, ctx] = createPixelCanvas(W, H);

  // 1. Drop shadow
  drawShadow(ctx, 0, 0, W, H, 2, 2, 0.2);

  if (config.floors === 0) {
    // Special case: subway (no roof, no upper floors — just ground floor)
    const gfY = 0;
    // Dark fill for whole thing
    rect(ctx, 0, 0, W, H, config.wallColor);
    // Awning strip at top
    rect(ctx, 0, 0, W, 5, config.awningColor);
    rect(ctx, 0, 0, W, 1, lighten(config.awningColor, 0.2));
    // Dark stair opening
    rect(ctx, 4, 6, W - 8, H - 8, PALETTE.DARK_NAVY);
    rect(ctx, 4, 6, W - 8, 1, darken(PALETTE.DARK_NAVY, 0.2));
    // Railings
    rect(ctx, 3, 6, 1, H - 8, PALETTE.COOL_GREY);
    rect(ctx, W - 4, 6, 1, H - 8, PALETTE.COOL_GREY);
    // Per-building decoration
    if (config.decorateGround) config.decorateGround(ctx, 0, W, isNight);
    const name = isNight ? `bldg_${config.id}_night` : `bldg_${config.id}`;
    addFrame(name, c, W, H);
    return;
  }

  // 2. Roof cap (12px)
  drawTemplateRoof(ctx, 0, 0, W, config.roofColor);

  // 3. Upper floors (24px each, top-down)
  for (let f = config.floors; f >= 2; f--) {
    const floorY = 12 + (config.floors - f) * 24;
    if (config.upperFloorsOverride &&
        f >= config.upperFloorsOverride.fromFloor &&
        f <= config.upperFloorsOverride.toFloor) {
      drawVideoScreenSegment(ctx, floorY, W, 24, config.upperFloorsOverride, isNight);
    } else {
      drawTemplateFloor(ctx, floorY, W, config.wallColor, isNight);
    }
  }

  // 4. Ground floor (24px)
  const gfY = H - 24;
  drawTemplateGroundFloor(ctx, gfY, W, config, isNight);

  // 5. Per-building decorateGround callback
  if (config.decorateGround) config.decorateGround(ctx, gfY, W, isNight);

  const name = isNight ? `bldg_${config.id}_night` : `bldg_${config.id}`;
  addFrame(name, c, W, H);
}

// ── North-Facing Buildings (Front-Face Hero View) ──

function drawBuildingNorth(config: BuildingConfig, isNight: boolean) {
  const W = config.width;
  const extraRoof = getExtraRoof(config.floors);
  const baseH = config.heightOverride ?? (12 + 24 * config.floors);
  const H = baseH + extraRoof;
  const [c, ctx] = createPixelCanvas(W, H);

  drawShadow(ctx, 0, 0, W, H, 2, 2, 0.2);

  if (config.floors === 0) {
    // Subway: same rendering as current, no extra roof
    rect(ctx, 0, 0, W, H, config.wallColor);
    rect(ctx, 0, 0, W, 5, config.awningColor);
    rect(ctx, 0, 0, W, 1, lighten(config.awningColor, 0.2));
    rect(ctx, 4, 6, W - 8, H - 8, PALETTE.DARK_NAVY);
    rect(ctx, 4, 6, W - 8, 1, darken(PALETTE.DARK_NAVY, 0.2));
    rect(ctx, 3, 6, 1, H - 8, PALETTE.COOL_GREY);
    rect(ctx, W - 4, 6, 1, H - 8, PALETTE.COOL_GREY);
    if (config.decorateGround) config.decorateGround(ctx, 0, W, isNight);
    const name = `bldg_${config.id}_n${isNight ? '_night' : ''}`;
    addFrame(name, c, W, H);
    return;
  }

  // 1. Roof top surface (extra pixels at the very top)
  if (extraRoof > 0) {
    drawRoofTopSurface(ctx, 0, 0, W, extraRoof, config.roofColor, config.floors);
  }

  // 2. Roof cap (12px, offset by extraRoof)
  drawTemplateRoof(ctx, 0, extraRoof, W, config.roofColor);

  // 3. Upper floors (24px each, offset by extraRoof)
  for (let f = config.floors; f >= 2; f--) {
    const floorY = extraRoof + 12 + (config.floors - f) * 24;
    if (config.upperFloorsOverride &&
        f >= config.upperFloorsOverride.fromFloor &&
        f <= config.upperFloorsOverride.toFloor) {
      drawVideoScreenSegment(ctx, floorY, W, 24, config.upperFloorsOverride, isNight);
    } else {
      drawTemplateFloor(ctx, floorY, W, config.wallColor, isNight);
    }
  }

  // 4. Ground floor (24px)
  const gfY = H - 24;
  drawTemplateGroundFloor(ctx, gfY, W, config, isNight);

  // 5. Per-building decoration
  if (config.decorateGround) config.decorateGround(ctx, gfY, W, isNight);

  const name = `bldg_${config.id}_n${isNight ? '_night' : ''}`;
  addFrame(name, c, W, H);
}

// ── South-Facing Buildings (Roof-Dominant Back View) ──

function drawBuildingSouth(config: BuildingConfig, isNight: boolean) {
  const W = config.width;
  const H = getSouthHeight(config.floors, config.heightOverride);
  const [c, ctx] = createPixelCanvas(W, H);

  drawShadow(ctx, 0, 0, W, H, 2, 2, 0.2);

  if (config.floors === 0) {
    // Subway south: dark stair opening visible (no roof)
    rect(ctx, 0, 0, W, H, config.wallColor);
    rect(ctx, 4, 3, W - 8, H - 6, PALETTE.DARK_NAVY);
    rect(ctx, 4, 3, W - 8, 1, darken(PALETTE.DARK_NAVY, 0.2));
    rect(ctx, 3, 3, 1, H - 6, PALETTE.COOL_GREY);
    rect(ctx, W - 4, 3, 1, H - 6, PALETTE.COOL_GREY);
    const name = `bldg_${config.id}_s${isNight ? '_night' : ''}`;
    addFrame(name, c, W, H);
    return;
  }

  // Calculate proportions (scaled up)
  const backWallH = config.floors >= 3 ? 5 : 3;
  const awningH = config.floors >= 4 ? 12 : config.floors >= 3 ? 10 : config.floors >= 2 ? 8 : 6;
  const roofH = H - backWallH - awningH;

  // 1. Back wall strip (darker wallColor, no windows)
  rect(ctx, 0, 0, W, backWallH, darken(config.wallColor, 0.3));
  rect(ctx, 0, 0, W, 1, darken(config.wallColor, 0.4));
  rect(ctx, 0, 0, 1, backWallH, darken(config.wallColor, 0.2));
  rect(ctx, W - 1, 0, 1, backWallH, darken(config.wallColor, 0.45));

  // 2. Roof surface (~70% of height)
  const roofY = backWallH;
  const lightRoof = lighten(config.roofColor, 0.2);
  rect(ctx, 0, roofY, W, roofH, lightRoof);
  // Border edges
  rect(ctx, 0, roofY, W, 1, darken(config.roofColor, 0.1));
  rect(ctx, 0, roofY, 1, roofH, lighten(config.roofColor, 0.1));
  rect(ctx, W - 1, roofY, 1, roofH, darken(config.roofColor, 0.1));
  // Subtle grid lines every 6px
  const gridColor = darken(lightRoof, 0.06);
  for (let gy = roofY + 6; gy < roofY + roofH; gy += 6) {
    rect(ctx, 1, gy, W - 2, 1, gridColor);
  }
  for (let gx = 6; gx < W; gx += 6) {
    rect(ctx, gx, roofY + 1, 1, roofH - 1, gridColor);
  }
  // AC units for tall buildings (floors >= 3)
  if (config.floors >= 3) {
    const acColor = PALETTE.COOL_GREY;
    for (let ax = 6; ax + 3 <= W - 6; ax += 12) {
      for (let ay = roofY + 4; ay + 3 <= roofY + roofH - 4; ay += 8) {
        rect(ctx, ax, ay, 3, 3, acColor);
        px(ctx, ax, ay, lighten(acColor, 0.15));
      }
    }
  }

  // decorateSouth callback for roof identity
  if (config.decorateSouth) config.decorateSouth(ctx, W, H, isNight);

  // 3. Awning/signage projection
  const awningY = H - awningH;
  rect(ctx, 0, awningY, W, awningH, config.awningColor);
  rect(ctx, 0, awningY, W, 1, lighten(config.awningColor, 0.2));
  rect(ctx, 0, awningY + awningH - 1, W, 1, darken(config.awningColor, 0.2));
  // Cast shadow below awning
  ctx.globalAlpha = 0.3;
  rect(ctx, 0, H - 1, W, 1, PALETTE.DARK_NAVY);
  ctx.globalAlpha = 1.0;

  const name = `bldg_${config.id}_s${isNight ? '_night' : ''}`;
  addFrame(name, c, W, H);
}

// ── 12 Building Configs ──

const BUILDING_CONFIGS: BuildingConfig[] = [
  // 1. 109 — Pink awning + "109" text (3 floors for cinematic view)
  {
    id: '109', width: 80, floors: 3,
    wallColor: PALETTE.BLDG_109_MAIN,
    roofColor: darken(PALETTE.BLDG_109_MAIN, 0.2),
    awningColor: PALETTE.BLDG_109_DARK,
    groundFloor: { type: 'entrance', doorPosition: 'center', doorIsGlass: true, hasVendingMachine: false },
    decorateGround(ctx, gfY, W, isNight) {
      // "109" sign panel on awning
      const tw = pixelTextWidth("109");
      const tx = Math.floor((W - tw) / 2);
      rect(ctx, tx - 2, gfY, tw + 4, 5, PALETTE.BLDG_109_DARK);
      drawPixelText(ctx, tx, gfY - 10, "109", PALETTE.NEAR_WHITE);
    },
    decorateSouth(ctx, W, H, isNight) {
      const roofY = 5, roofH = H - 5 - 10;
      // Pink/purple section on left half of roof
      rect(ctx, 2, roofY + 2, Math.floor(W / 2), roofH - 4, lighten(PALETTE.BLDG_109_DARK, 0.15));
      // "109" pixel text on roof
      const tw = pixelTextWidth("109");
      drawPixelText(ctx, Math.floor((W - tw) / 2), roofY + Math.floor(roofH / 2) - 2, "109", PALETTE.NEAR_WHITE);
    },
  },
  // 2. Starbucks — Green awning + circle logo + merged windows
  {
    id: 'starbucks', width: 60, floors: 2,
    wallColor: PALETTE.SBUX_WALL,
    roofColor: darken(PALETTE.SBUX_GREEN, 0.3),
    awningColor: PALETTE.SBUX_GREEN,
    groundFloor: { type: 'shop', doorPosition: 'center', doorIsGlass: true, hasVendingMachine: false },
    decorateGround(ctx, gfY, W, isNight) {
      // "STARBUCKS" on awning
      drawPixelText(ctx, 6, gfY + 2, "STARBUCKS", PALETTE.NEAR_WHITE);
      // Green circle logo on glass
      rect(ctx, 24, gfY + 7, 6, 6, PALETTE.FOREST_GREEN);
      rect(ctx, 25, gfY + 8, 4, 4, PALETTE.NEAR_WHITE);
      rect(ctx, 26, gfY + 9, 2, 2, PALETTE.FOREST_GREEN);
    },
    decorateSouth(ctx, W, H, isNight) {
      const roofY = 3, roofH = H - 3 - 8;
      // Green circle suggesting rooftop logo
      const cx = Math.floor(W / 2), cy = roofY + Math.floor(roofH / 2);
      rect(ctx, cx - 3, cy - 2, 7, 5, PALETTE.SBUX_GREEN);
      rect(ctx, cx - 2, cy - 3, 5, 7, PALETTE.SBUX_GREEN);
      px(ctx, cx, cy, PALETTE.NEAR_WHITE);
    },
  },
  // 3. QFront — Video screen floors 3-4, "TSUTAYA" sign
  {
    id: 'qfront', width: 80, floors: 4,
    wallColor: PALETTE.QFRONT_WALL,
    roofColor: darken(PALETTE.QFRONT_WALL, 0.2),
    awningColor: darken(PALETTE.QFRONT_WALL, 0.15),
    groundFloor: { type: 'shop', doorPosition: 'center', doorIsGlass: true, hasVendingMachine: false },
    upperFloorsOverride: {
      screenColor: PALETTE.QFRONT_SCREEN,
      screenGlowColor: PALETTE.QFRONT_GLOW,
      fromFloor: 3, toFloor: 4,
    },
    decorateGround(ctx, gfY, W, isNight) {
      // "TSUTAYA" sign panel between screen and ground floor
      const tw = pixelTextWidth("TSUTAYA");
      const tx = Math.floor((W - tw) / 2);
      rect(ctx, 3, gfY - 12, W - 6, 12, darken(PALETTE.QFRONT_WALL, 0.15));
      drawPixelText(ctx, tx, gfY - 10, "TSUTAYA", isNight ? PALETTE.WINDOW_GLOW : PALETTE.NEAR_WHITE);
    },
    decorateSouth(ctx, W, H, isNight) {
      const roofY = 5, roofH = H - 5 - 12;
      // Blue-tinted roof section (screen glow visible from above at night)
      const tintColor = isNight ? PALETTE.QFRONT_GLOW : PALETTE.QFRONT_SCREEN;
      ctx.globalAlpha = 0.3;
      rect(ctx, 3, roofY + 3, W - 6, roofH - 6, tintColor);
      ctx.globalAlpha = 1.0;
    },
  },
  // 4. Station — Dark awning + "JR" mark + gate bars + wide entrance
  {
    id: 'station', width: 80, floors: 1,
    wallColor: PALETTE.STATION_WALL,
    roofColor: PALETTE.STATION_ROOF,
    awningColor: darken(PALETTE.STATION_WALL, 0.3),
    groundFloor: { type: 'entrance', doorPosition: 'center', doorIsGlass: false, hasVendingMachine: false },
    decorateGround(ctx, gfY, W, isNight) {
      // JR green square on awning
      rect(ctx, 3, gfY + 1, 6, 4, PALETTE.FOREST_GREEN);
      drawPixelText(ctx, 11, gfY + 2, "JR", PALETTE.NEAR_WHITE);
      // Wide entrance with gate bars
      rect(ctx, 8, gfY + 5, W - 16, 12, darken(PALETTE.STATION_WALL, 0.3));
      // Gate bar pattern
      for (let gx = 10; gx < W - 10; gx += 5) {
        rect(ctx, gx, gfY + 5, 1, 12, PALETTE.COOL_GREY);
      }
    },
    decorateSouth(ctx, W, H, isNight) {
      const roofY = 3, roofH = H - 3 - 6;
      // Darker ridge line down center of roof
      rect(ctx, Math.floor(W / 2) - 1, roofY, 3, roofH, darken(PALETTE.STATION_ROOF, 0.2));
    },
  },
  // 5. Lawson — Blue awning + vending machine
  {
    id: 'lawson', width: 40, floors: 1,
    wallColor: PALETTE.NEAR_WHITE,
    roofColor: darken(PALETTE.NEAR_WHITE, 0.15),
    awningColor: PALETTE.BRIGHT_BLUE,
    groundFloor: { type: 'convenience', doorPosition: 'left', doorIsGlass: true, hasVendingMachine: true },
    decorateGround(ctx, gfY, W, isNight) {
      drawPixelText(ctx, 4, gfY + 2, "LAWSON", PALETTE.NEAR_WHITE);
    },
  },
  // 6. FamilyMart — Green/white/blue triple-stripe awning + "FM"
  {
    id: 'familymart', width: 40, floors: 1,
    wallColor: PALETTE.NEAR_WHITE,
    roofColor: darken(PALETTE.NEAR_WHITE, 0.15),
    awningColor: PALETTE.FOREST_GREEN,
    groundFloor: { type: 'convenience', doorPosition: 'center', doorIsGlass: true, hasVendingMachine: false },
    decorateGround(ctx, gfY, W, isNight) {
      // Triple-stripe awning: green / white / blue (scaled to 5px awning)
      rect(ctx, 0, gfY, W, 2, PALETTE.FOREST_GREEN);
      rect(ctx, 0, gfY + 2, W, 1, PALETTE.NEAR_WHITE);
      rect(ctx, 0, gfY + 3, W, 2, PALETTE.BRIGHT_BLUE);
      drawPixelText(ctx, 8, gfY + 2, "FM", PALETTE.NEAR_WHITE);
    },
  },
  // 7. 7-Eleven — Orange/green/red stripe + big "7"
  {
    id: 'seven_eleven', width: 40, floors: 1,
    wallColor: PALETTE.NEAR_WHITE,
    roofColor: darken(PALETTE.NEAR_WHITE, 0.15),
    awningColor: PALETTE.WARM_ORANGE,
    groundFloor: { type: 'convenience', doorPosition: 'center', doorIsGlass: true, hasVendingMachine: false },
    decorateGround(ctx, gfY, W, isNight) {
      // Orange/green/red stripe awning (scaled to 5px)
      rect(ctx, 0, gfY, W, 2, PALETTE.WARM_ORANGE);
      rect(ctx, 0, gfY + 2, W, 1, PALETTE.FOREST_GREEN);
      rect(ctx, 0, gfY + 3, W, 2, PALETTE.CRIMSON);
      // Big "7" on shopfront glass — 6px tall bold
      const sevenGlyph = [0b111111, 0b000001, 0b000010, 0b000100, 0b001000, 0b010000];
      const sevenX = Math.floor((W - 6) / 2);
      const color = isNight ? PALETTE.WINDOW_GLOW : PALETTE.WARM_ORANGE;
      for (let row = 0; row < 6; row++) {
        const bits = sevenGlyph[row];
        for (let bit = 0; bit < 6; bit++) {
          if (bits & (1 << (5 - bit))) px(ctx, sevenX + bit, gfY + 7 + row, color);
        }
      }
    },
  },
  // 8. Ramen — Red awning + noren curtain bars
  {
    id: 'ramen', width: 40, floors: 1,
    wallColor: PALETTE.STORE_WALL_A,
    roofColor: darken(PALETTE.STORE_WALL_A, 0.15),
    awningColor: PALETTE.CRIMSON,
    groundFloor: { type: 'restaurant', doorPosition: 'center', doorIsGlass: false, hasVendingMachine: false },
    decorateGround(ctx, gfY, W, isNight) {
      // Stylized kanji marks on awning
      px(ctx, 6, gfY + 2, PALETTE.NEAR_WHITE);
      px(ctx, 7, gfY + 2, PALETTE.NEAR_WHITE);
      px(ctx, 9, gfY + 2, PALETTE.NEAR_WHITE);
      px(ctx, 10, gfY + 2, PALETTE.NEAR_WHITE);
      px(ctx, 12, gfY + 2, PALETTE.NEAR_WHITE);
      px(ctx, 13, gfY + 2, PALETTE.NEAR_WHITE);
      // Noren curtain bars (scaled)
      for (let nx = 4; nx < W - 4; nx += 4) {
        rect(ctx, nx, gfY + 5, 3, 8, PALETTE.CRIMSON);
        rect(ctx, nx, gfY + 5, 3, 1, lighten(PALETTE.CRIMSON, 0.2));
      }
    },
  },
  // 9. Office A — Warm grey wall, dark awning, plain glass
  {
    id: 'office_a', width: 60, floors: 3,
    wallColor: PALETTE.STORE_WALL_A,
    roofColor: darken(PALETTE.STORE_WALL_A, 0.2),
    awningColor: PALETTE.CHARCOAL,
    groundFloor: { type: 'shop', doorPosition: 'center', doorIsGlass: true, hasVendingMachine: false },
    decorateGround(ctx, gfY, W, isNight) {
      drawPixelText(ctx, 10, gfY + 2, "BLDG", PALETTE.COOL_GREY);
    },
  },
  // 10. Office B — Cool grey wall, blue awning, plain glass
  {
    id: 'office_b', width: 60, floors: 3,
    wallColor: PALETTE.STORE_WALL_B,
    roofColor: darken(PALETTE.STORE_WALL_B, 0.2),
    awningColor: PALETTE.BRIGHT_BLUE,
    groundFloor: { type: 'shop', doorPosition: 'center', doorIsGlass: true, hasVendingMachine: false },
    decorateGround(ctx, gfY, W, isNight) {
      drawPixelText(ctx, 14, gfY + 2, "OFC", PALETTE.COOL_GREY);
    },
  },
  // 11. Pachinko — Golden wall, colorful signage rectangles
  {
    id: 'pachinko', width: 60, floors: 2,
    wallColor: PALETTE.GOLDEN,
    roofColor: darken(PALETTE.GOLDEN, 0.2),
    awningColor: PALETTE.WARM_ORANGE,
    groundFloor: { type: 'shop', doorPosition: 'center', doorIsGlass: true, hasVendingMachine: false },
    decorateGround(ctx, gfY, W, isNight) {
      // "SLOT" in neon-style on shopfront
      const color = isNight ? PALETTE.SIGNAL_YELLOW : PALETTE.GOLDEN;
      drawPixelText(ctx, 10, gfY + 8, "SLOT", color);
      // Colorful signage blocks above awning
      const signColors = [PALETTE.CRIMSON, PALETTE.NEON_CYAN, PALETTE.SIGNAL_YELLOW, PALETTE.FOREST_GREEN];
      for (let i = 0; i < signColors.length; i++) {
        rect(ctx, 6 + i * 13, gfY - 7, 10, 5, signColors[i]);
      }
    },
    decorateSouth(ctx, W, H, isNight) {
      const roofY = 3, roofH = H - 3 - 8;
      // Golden/yellow tinted roof
      ctx.globalAlpha = 0.25;
      rect(ctx, 2, roofY + 2, W - 4, roofH - 4, PALETTE.GOLDEN);
      ctx.globalAlpha = 1.0;
    },
  },
  // 12. Subway — Metro "M" logo + dark stair opening
  {
    id: 'subway', width: 40, floors: 0, heightOverride: 24,
    wallColor: PALETTE.CHARCOAL,
    roofColor: PALETTE.CHARCOAL,
    awningColor: PALETTE.SLATE,
    groundFloor: { type: 'subway', doorPosition: 'center', doorIsGlass: false, hasVendingMachine: false },
    decorateGround(ctx, _gfY, W, isNight) {
      // Metro "M" logo: blue circle with white M (larger)
      const mx = Math.floor((W - 7) / 2);
      rect(ctx, mx, 0, 7, 5, PALETTE.BRIGHT_BLUE);
      // "M" inside (scaled)
      px(ctx, mx + 1, 1, PALETTE.NEAR_WHITE);
      px(ctx, mx + 1, 2, PALETTE.NEAR_WHITE);
      px(ctx, mx + 2, 2, PALETTE.NEAR_WHITE);
      px(ctx, mx + 3, 3, PALETTE.NEAR_WHITE);
      px(ctx, mx + 4, 2, PALETTE.NEAR_WHITE);
      px(ctx, mx + 5, 2, PALETTE.NEAR_WHITE);
      px(ctx, mx + 5, 1, PALETTE.NEAR_WHITE);
    },
  },
];

// ── Vertical Sign Sprites ──

function generateVerticalSigns() {
  for (const isNight of [false, true]) {
    const W = 2, H = 12;
    const [c, ctx] = createPixelCanvas(W, H);
    const base = isNight ? PALETTE.CRIMSON : PALETTE.WARM_ORANGE;
    rect(ctx, 0, 0, W, H, base);
    // Highlight left, shadow right
    rect(ctx, 0, 0, 1, H, lighten(base, 0.2));
    rect(ctx, W - 1, 0, 1, H, darken(base, 0.2));
    // Contrasting dots every 3px suggesting kanji
    const dotColor = isNight ? PALETTE.WINDOW_GLOW : PALETTE.NEAR_WHITE;
    for (let dy = 1; dy < H - 1; dy += 3) {
      px(ctx, 0, dy, dotColor);
      px(ctx, 1, dy + 1, dotColor);
    }
    addFrame(isNight ? "bldg_sign_v_night" : "bldg_sign_v", c, W, H);
  }
}

// ── Main Buildings Generator ──

function generateBuildings() {
  // Generate all 12 buildings × 4 (north/south × day/night)
  for (const config of BUILDING_CONFIGS) {
    drawBuildingNorth(config, false);
    drawBuildingNorth(config, true);
    drawBuildingSouth(config, false);
    drawBuildingSouth(config, true);
  }
  // Generate vertical sign sprites
  generateVerticalSigns();
}


// ---- Pack & Output ----
function packFrames(allFrames: SpriteFrame[]): { atlas: Canvas; packed: PackedFrame[]; width: number; height: number } {
  const sorted = [...allFrames].sort((a, b) => b.h - a.h);
  let x = 0, y = 0, rowHeight = 0;
  const maxW = 1024;
  const packed: PackedFrame[] = [];

  for (const f of sorted) {
    if (x + f.w > maxW) { x = 0; y += rowHeight + 1; rowHeight = 0; }
    packed.push({ name: f.name, x, y, w: f.w, h: f.h });
    rowHeight = Math.max(rowHeight, f.h);
    x += f.w + 1;
  }

  const atlasW = maxW, atlasH = y + rowHeight + 1;
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
