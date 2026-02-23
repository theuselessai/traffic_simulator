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

  // Zebra crossing horizontal (E-W bars)
  {
    const [c, ctx] = createPixelCanvas(T, T);
    rect(ctx, 0, 0, T, T, PALETTE.ROAD_MID);
    for (let i = 0; i < T; i += 4) {
      rect(ctx, i, 0, 2, T, PALETTE.ZEBRA_WHITE);
      // Highlight top edge, shadow bottom edge of each bar
      rect(ctx, i, 0, 2, 1, PALETTE.PURE_WHITE);
    }
    addFrame("zebra_h", c, T, T);
  }

  // Zebra crossing vertical (N-S bars — slightly wider, perpendicular to viewer)
  {
    const [c, ctx] = createPixelCanvas(T, T);
    rect(ctx, 0, 0, T, T, PALETTE.ROAD_MID);
    for (let i = 0; i < T; i += 5) {
      rect(ctx, 0, i, T, 3, PALETTE.ZEBRA_WHITE);
      rect(ctx, 0, i, T, 1, PALETTE.PURE_WHITE); // top highlight
      rect(ctx, 0, i + 2, T, 1, darken(PALETTE.ZEBRA_WHITE, 0.08)); // bottom shadow
    }
    addFrame("zebra_v", c, T, T);
  }

  // Zebra crossing diagonal (NW-SE)
  {
    const [c, ctx] = createPixelCanvas(T, T);
    rect(ctx, 0, 0, T, T, PALETTE.ROAD_MID);
    for (let i = -T; i < T * 2; i += 5) {
      for (let d = 0; d < 2; d++) {
        for (let t = 0; t < T; t++) {
          const x = t, y = i + d + t;
          if (x >= 0 && x < T && y >= 0 && y < T) {
            px(ctx, x, y, d === 0 ? PALETTE.PURE_WHITE : PALETTE.ZEBRA_WHITE);
          }
        }
      }
    }
    addFrame("zebra_diag_nwse", c, T, T);
  }

  // Zebra crossing diagonal (NE-SW)
  {
    const [c, ctx] = createPixelCanvas(T, T);
    rect(ctx, 0, 0, T, T, PALETTE.ROAD_MID);
    for (let i = -T; i < T * 2; i += 5) {
      for (let d = 0; d < 2; d++) {
        for (let t = 0; t < T; t++) {
          const x = t, y = i + d - t + T;
          if (x >= 0 && x < T && y >= 0 && y < T) {
            px(ctx, x, y, d === 0 ? PALETTE.PURE_WHITE : PALETTE.ZEBRA_WHITE);
          }
        }
      }
    }
    addFrame("zebra_diag_nesw", c, T, T);
  }

  // Stop line horizontal
  {
    const [c, ctx] = createPixelCanvas(T, T);
    rect(ctx, 0, 0, T, T, PALETTE.ROAD_MID);
    rect(ctx, 0, 8, T, 4, PALETTE.ZEBRA_WHITE);
    rect(ctx, 0, 8, T, 1, PALETTE.PURE_WHITE);
    rect(ctx, 0, 11, T, 1, darken(PALETTE.ZEBRA_WHITE, 0.08));
    addFrame("stop_line_h", c, T, T);
  }

  // Stop line vertical
  {
    const [c, ctx] = createPixelCanvas(T, T);
    rect(ctx, 0, 0, T, T, PALETTE.ROAD_MID);
    rect(ctx, 8, 0, 4, T, PALETTE.ZEBRA_WHITE);
    rect(ctx, 8, 0, 1, T, PALETTE.PURE_WHITE);
    rect(ctx, 11, 0, 1, T, darken(PALETTE.ZEBRA_WHITE, 0.08));
    addFrame("stop_line_v", c, T, T);
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

  // Intersection center — worn asphalt
  {
    const [c, ctx] = createPixelCanvas(T, T);
    rect(ctx, 0, 0, T, T, PALETTE.ROAD_MID);
    // Slightly more lighter pixels (worn center)
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        const r = Math.random();
        if (r < 0.04) px(ctx, x, y, lighten(PALETTE.ROAD_MID, 0.12));
        else if (r < 0.06) px(ctx, x, y, PALETTE.ROAD_DARK);
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


// ---- Buildings (¾ view: ~40% roof / ~60% front, full pixel art) ----

function generateBuildings() {

  // ── Shibuya 109 (64×80) — roofH=28, frontH=52 ──
  function draw109(isNight: boolean) {
    const W = 64, H = 80;
    const roofH = 28, frontH = H - roofH;
    const wallBase = PALETTE.BLDG_109_MAIN;
    const [c, ctx] = createPixelCanvas(W, H);
    drawShadow(ctx, 0, 0, W, H);

    // Roof
    drawRoof(ctx, 0, 0, W, roofH, darken(wallBase, 0.1));

    // Front face wall (3-tone)
    drawWall(ctx, 0, roofH, W, frontH, wallBase, 8);
    roofOverhangShadow(ctx, 0, roofH, W);
    // Cylindrical shading
    rect(ctx, 0, roofH, 4, frontH, PALETTE.BLDG_109_DARK);
    rect(ctx, 0, roofH, 1, frontH, darken(PALETTE.BLDG_109_DARK, 0.15));
    rect(ctx, W - 4, roofH, 4, frontH, PALETTE.BLDG_109_DARK);
    rect(ctx, W - 1, roofH, 1, frontH, darken(PALETTE.BLDG_109_DARK, 0.3));
    // Floor lines
    floorLine(ctx, 4, roofH + 12, W - 8, wallBase);
    floorLine(ctx, 4, roofH + 22, W - 8, wallBase);
    // Windows (inset, 3×3 with frame/glass/highlight)
    for (let wy = roofH + 3; wy + 4 < roofH + 30; wy += 6) {
      for (let wx = 8; wx + 4 < W - 8; wx += 7) {
        drawWindow(ctx, wx, wy, 4, 4, wallBase, isNight);
      }
    }
    // "109" sign (3-tone sign panel)
    rect3(ctx, 12, roofH + 31, 40, 9, PALETTE.BLDG_109_DARK);
    rect(ctx, 14, roofH + 33, 36, 5, isNight ? PALETTE.WINDOW_GLOW : PALETTE.GOLDEN);
    px(ctx, 14, roofH + 33, isNight ? PALETTE.PURE_WHITE : lighten(PALETTE.GOLDEN, 0.3));
    // Ground floor
    rect3(ctx, 4, H - 14, W - 8, 14, darken(wallBase, 0.2));
    floorLine(ctx, 4, H - 14, W - 8, wallBase);
    // Entrance (glass door)
    drawDoor(ctx, 22, H - 12, 10, 12, true, isNight);
    drawDoor(ctx, 32, H - 12, 10, 12, true, isNight);
    // Accent stripe
    drawAwning(ctx, 4, H - 14, W - 8, 2, PALETTE.BLDG_109_DARK, false);
    addFrame(isNight ? "bldg_109_night" : "bldg_109", c, W, H);
  }
  draw109(false);
  draw109(true);

  // ── Starbucks (56×48) — roofH=16, frontH=32 ──
  function drawStarbucks(isNight: boolean) {
    const W = 56, H = 48;
    const roofH = 16, frontH = H - roofH;
    const [c, ctx] = createPixelCanvas(W, H);
    drawShadow(ctx, 0, 0, W, H);

    // Roof
    drawRoof(ctx, 0, 0, W, roofH, darken(PALETTE.SBUX_GREEN, 0.3));

    // Front face
    drawWall(ctx, 0, roofH, W, frontH, PALETTE.SBUX_WALL, 8);
    roofOverhangShadow(ctx, 0, roofH, W);
    // Upper floor windows (glass with diagonal highlight)
    drawGlass(ctx, 4, roofH + 2, 14, 10, isNight);
    drawGlass(ctx, 22, roofH + 2, 14, 10, isNight);
    drawGlass(ctx, 40, roofH + 2, 12, 10, isNight);
    // Green awning with logo (scalloped)
    drawAwning(ctx, 0, roofH + 13, W, 3, PALETTE.SBUX_GREEN, true);
    // Logo circle
    rect(ctx, 24, roofH + 13, 8, 3, PALETTE.FOREST_GREEN);
    rect(ctx, 26, roofH + 14, 4, 1, PALETTE.NEAR_WHITE);
    // Ground floor shopfront
    drawGlass(ctx, 4, roofH + 17, 18, 14, isNight);
    drawGlass(ctx, 30, roofH + 17, 22, 14, isNight);
    // Door
    drawDoor(ctx, 22, H - 12, 8, 12, true, isNight);
    addFrame(isNight ? "bldg_starbucks_night" : "bldg_starbucks", c, W, H);
  }
  drawStarbucks(false);
  drawStarbucks(true);

  // ── QFront/Tsutaya (56×96) — roofH=22, frontH=74 ──
  function drawQFront(isNight: boolean) {
    const W = 56, H = 96;
    const roofH = 22;
    const [c, ctx] = createPixelCanvas(W, H);
    drawShadow(ctx, 0, 0, W, H);

    // Roof
    drawRoof(ctx, 0, 0, W, roofH, darken(PALETTE.QFRONT_WALL, 0.2));
    // Antenna
    rect(ctx, 26, 0, 2, 4, PALETTE.SIGNAL_POST);
    px(ctx, 26, 0, lighten(PALETTE.SIGNAL_POST, 0.2));

    // Front face
    drawWall(ctx, 0, roofH, W, H - roofH, PALETTE.QFRONT_WALL, 0);
    roofOverhangShadow(ctx, 0, roofH, W);

    // MASSIVE VIDEO SCREEN (the hero element)
    const screenY = roofH + 2;
    const screenH = 40;
    const screenColor = isNight ? PALETTE.QFRONT_GLOW : PALETTE.QFRONT_SCREEN;
    rect(ctx, 3, screenY, W - 6, screenH, screenColor);
    // Screen edges (inset)
    rect(ctx, 3, screenY, W - 6, 1, darken(screenColor, 0.3));
    rect(ctx, 3, screenY, 1, screenH, darken(screenColor, 0.3));
    rect(ctx, W - 4, screenY, 1, screenH, lighten(screenColor, 0.1));
    rect(ctx, 3, screenY + screenH - 1, W - 6, 1, lighten(screenColor, 0.1));
    // Screen scanline texture (subtle)
    for (let sy = screenY + 2; sy < screenY + screenH - 2; sy += 3) {
      ctx.globalAlpha = 0.08;
      rect(ctx, 4, sy, W - 8, 1, PALETTE.DARK_NAVY);
      ctx.globalAlpha = 1.0;
    }
    // Screen highlight glow
    if (isNight) {
      px(ctx, 4, screenY + 1, PALETTE.PURE_WHITE);
      px(ctx, 5, screenY + 1, PALETTE.PURE_WHITE);
    }

    // "TSUTAYA" signage (3-tone panel)
    rect3(ctx, 6, roofH + 44, 44, 6, darken(PALETTE.QFRONT_WALL, 0.15));
    rect(ctx, 8, roofH + 45, 40, 4, isNight ? PALETTE.WINDOW_GLOW : PALETTE.NEAR_WHITE);
    px(ctx, 8, roofH + 45, isNight ? PALETTE.PURE_WHITE : lighten(PALETTE.NEAR_WHITE, 0.1));

    // Window row
    floorLine(ctx, 4, roofH + 51, W - 8, PALETTE.QFRONT_WALL);
    for (let wx = 6; wx + 5 < W - 4; wx += 8) {
      drawWindow(ctx, wx, roofH + 53, 5, 5, PALETTE.QFRONT_WALL, isNight);
    }

    // Ground floor
    floorLine(ctx, 3, H - 16, W - 6, PALETTE.QFRONT_WALL);
    rect3(ctx, 3, H - 14, W - 6, 14, darken(PALETTE.QFRONT_WALL, 0.15));
    drawGlass(ctx, 6, H - 12, 18, 10, isNight);
    drawDoor(ctx, 28, H - 12, 8, 10, true, isNight);
    // Starbucks corner
    drawAwning(ctx, 38, H - 14, 14, 2, PALETTE.SBUX_GREEN, false);
    drawGlass(ctx, 38, H - 12, 14, 10, isNight);
    addFrame(isNight ? "bldg_qfront_night" : "bldg_qfront", c, W, H);
  }
  drawQFront(false);
  drawQFront(true);

  // ── Station (80×48) — roofH=16, frontH=32 ──
  function drawStation(isNight: boolean) {
    const W = 80, H = 48;
    const roofH = 16;
    const [c, ctx] = createPixelCanvas(W, H);
    drawShadow(ctx, 0, 0, W, H);

    // Roof
    drawRoof(ctx, 0, 0, W, roofH, PALETTE.STATION_ROOF);

    // Front face
    drawWall(ctx, 0, roofH, W, H - roofH, PALETTE.STATION_WALL, 10);
    roofOverhangShadow(ctx, 0, roofH, W);

    // Station name sign (3-tone panel)
    rect3(ctx, 14, roofH + 2, 52, 6, darken(PALETTE.STATION_WALL, 0.2));
    rect(ctx, 16, roofH + 3, 48, 4, isNight ? PALETTE.WINDOW_GLOW : PALETTE.NEAR_WHITE);
    px(ctx, 16, roofH + 3, isNight ? PALETTE.PURE_WHITE : lighten(PALETTE.NEAR_WHITE, 0.1));

    // Upper windows
    floorLine(ctx, 2, roofH + 9, W - 4, PALETTE.STATION_WALL);
    for (let wx = 4; wx + 5 < W - 4; wx += 8) {
      drawWindow(ctx, wx, roofH + 11, 5, 5, PALETTE.STATION_WALL, isNight);
    }

    // Entrance gates
    floorLine(ctx, 2, H - 16, W - 4, PALETTE.STATION_WALL);
    for (let gx = 12; gx + 10 < W - 10; gx += 14) {
      drawGlass(ctx, gx, H - 14, 4, 14, isNight);
      rect(ctx, gx + 4, H - 14, 2, 14, PALETTE.STATION_WALL);
      drawGlass(ctx, gx + 6, H - 14, 4, 14, isNight);
    }
    // Ticket machines
    drawVendingMachine(ctx, 4, H - 10);
    drawVendingMachine(ctx, W - 8, H - 10);
    addFrame(isNight ? "bldg_station_night" : "bldg_station", c, W, H);
  }
  drawStation(false);
  drawStation(true);

  // ── Generic storefronts (48×40) ×2 — roofH=12, frontH=28 ──
  for (const [idx, awningColor] of [PALETTE.AWNING_A, PALETTE.AWNING_B].entries()) {
    const wallColor = idx === 0 ? PALETTE.STORE_WALL_A : PALETTE.STORE_WALL_B;
    const W = 48, H = 40;
    const roofH = 12;

    function drawStore(isNight: boolean) {
      const [c, ctx] = createPixelCanvas(W, H);
      drawShadow(ctx, 0, 0, W, H);

      // Roof
      drawRoof(ctx, 0, 0, W, roofH, darken(wallColor, 0.1));

      // Front face
      drawWall(ctx, 0, roofH, W, H - roofH, wallColor, 8);
      roofOverhangShadow(ctx, 0, roofH, W);

      // Awning (scalloped for variety)
      drawAwning(ctx, 0, roofH + 1, W, 4, awningColor, idx === 0);
      // Logo on awning
      rect(ctx, 18, roofH + 2, 12, 2, PALETTE.NEAR_WHITE);
      px(ctx, 18, roofH + 2, PALETTE.PURE_WHITE); // highlight

      // Upper windows
      drawWindow(ctx, 4, roofH + 7, 5, 5, wallColor, isNight);
      drawWindow(ctx, 12, roofH + 7, 5, 5, wallColor, isNight);
      drawWindow(ctx, 31, roofH + 7, 5, 5, wallColor, isNight);
      drawWindow(ctx, 39, roofH + 7, 5, 5, wallColor, isNight);

      // Ground floor glass storefronts
      floorLine(ctx, 2, H - 14, W - 4, wallColor);
      drawGlass(ctx, 4, H - 13, 16, 13, isNight);
      drawGlass(ctx, 26, H - 13, 14, 13, isNight);
      // Door
      drawDoor(ctx, 19, H - 12, 7, 12, true, isNight);
      // Vending machine
      drawVendingMachine(ctx, W - 6, H - 10);

      addFrame(isNight ? `bldg_store_${idx}_night` : `bldg_store_${idx}`, c, W, H);
    }
    drawStore(false);
    drawStore(true);
  }
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
