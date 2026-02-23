import { Container, Sprite, Spritesheet } from "pixi.js";

// Layout constants for 800x400 cinematic viewport
export const SCENE_W = 800;
export const SCENE_H = 300;
export const TILE = 20;
export const LANE_W = TILE; // 20px per lane
export const ROAD_LANES = 4; // 4 lanes per road
export const ROAD_W = LANE_W * ROAD_LANES; // 80px
export const SIDEWALK_W = 14; // narrow sidewalk strips

// Cinematic layout: E-W road is the hero, buildings only on north side
export const IX_CENTER_X = SCENE_W / 2; // 400
export const IX_CENTER_Y = 208;

// Road boundaries
// NS road: lanes run vertically
export const NS_ROAD_LEFT = IX_CENTER_X - ROAD_W / 2; // 360
export const NS_ROAD_RIGHT = IX_CENTER_X + ROAD_W / 2; // 440

// EW road: lanes run horizontally (hero road, full 800px width)
export const EW_ROAD_TOP = IX_CENTER_Y - ROAD_W / 2; // 168
export const EW_ROAD_BOTTOM = IX_CENTER_Y + ROAD_W / 2; // 248

// Building zone (north side only)
export const SIDEWALK_N = 8; // narrow sidewalk between buildings and road
export const BLDG_BOTTOM = EW_ROAD_TOP - SIDEWALK_N; // 160

// Zebra crossings
export const ZEBRA_WIDTH = 2 * TILE; // 40px (south, east, west)
export const ZEBRA_WIDTH_N = ZEBRA_WIDTH; // 40px (same as other crossings)

// NS road rendering extent (extends to top of window)
export const NS_ROAD_NORTH = 0;

// Stop lines (one tile before zebra crossing)
export const STOP_LINE_N = EW_ROAD_TOP - ZEBRA_WIDTH_N - TILE; // 128
export const STOP_LINE_S = EW_ROAD_BOTTOM + ZEBRA_WIDTH;       // 288
export const STOP_LINE_W = NS_ROAD_LEFT - ZEBRA_WIDTH - TILE;  // 300
export const STOP_LINE_E = NS_ROAD_RIGHT + ZEBRA_WIDTH;        // 480

// Lane centers (for vehicle spawning/following)
// NS road: lanes 0-1 go south (left side), lanes 2-3 go north (right side)
export function nsLaneX(lane: number): number {
  return NS_ROAD_LEFT + lane * LANE_W + LANE_W / 2;
}

// EW road: lanes 0-1 go east (top), lanes 2-3 go west (bottom)
export function ewLaneY(lane: number): number {
  return EW_ROAD_TOP + lane * LANE_W + LANE_W / 2;
}

export function buildRoad(sheet: Spritesheet): Container {
  const container = new Container();

  // Fill sidewalk everywhere first
  for (let ty = 0; ty < SCENE_H; ty += TILE) {
    for (let tx = 0; tx < SCENE_W; tx += TILE) {
      const s = new Sprite(sheet.textures["sidewalk"]);
      s.x = tx;
      s.y = ty;
      container.addChild(s);
    }
  }

  // NS road (vertical) — limited extent for cinematic view
  for (let ty = NS_ROAD_NORTH; ty < SCENE_H; ty += TILE) {
    for (let lane = 0; lane < ROAD_LANES; lane++) {
      const tx = NS_ROAD_LEFT + lane * LANE_W;
      // Skip intersection area
      if (ty >= EW_ROAD_TOP && ty < EW_ROAD_BOTTOM) continue;
      const s = new Sprite(sheet.textures["road_asphalt"]);
      s.x = tx;
      s.y = ty;
      container.addChild(s);
    }
  }

  // EW road (horizontal)
  for (let tx = 0; tx < SCENE_W; tx += TILE) {
    for (let lane = 0; lane < ROAD_LANES; lane++) {
      const ty = EW_ROAD_TOP + lane * LANE_W;
      if (tx >= NS_ROAD_LEFT && tx < NS_ROAD_RIGHT) continue;
      const s = new Sprite(sheet.textures["road_asphalt"]);
      s.x = tx;
      s.y = ty;
      container.addChild(s);
    }
  }

  // Intersection center — worn asphalt (lighter from heavy pedestrian traffic)
  for (let ty = EW_ROAD_TOP; ty < EW_ROAD_BOTTOM; ty += TILE) {
    for (let tx = NS_ROAD_LEFT; tx < NS_ROAD_RIGHT; tx += TILE) {
      const s = new Sprite(sheet.textures["intersection"]);
      s.x = tx;
      s.y = ty;
      container.addChild(s);
    }
  }

  // ── Lane markings ──
  // NS road center line (dashed, separating opposing traffic) — limited extent
  for (let ty = NS_ROAD_NORTH; ty < SCENE_H; ty += TILE) {
    if (ty >= EW_ROAD_TOP - ZEBRA_WIDTH_N && ty < EW_ROAD_BOTTOM + ZEBRA_WIDTH) continue;
    const s = new Sprite(sheet.textures["road_lane_v"]);
    s.x = IX_CENTER_X - TILE / 2;
    s.y = ty;
    container.addChild(s);
  }

  // EW road center line (dashed, separating opposing traffic)
  for (let tx = 0; tx < SCENE_W; tx += TILE) {
    if (tx >= NS_ROAD_LEFT - ZEBRA_WIDTH && tx < NS_ROAD_RIGHT + ZEBRA_WIDTH) continue;
    const s = new Sprite(sheet.textures["road_lane_h"]);
    s.x = tx;
    s.y = IX_CENTER_Y - TILE / 2;
    container.addChild(s);
  }

  // ── 5 Zebra crossings (authentic Shibuya scramble) ──

  // 1. North crossing (compact, on NS road's north arm)
  // Pedestrians walk E↔W → bars run N-S (vertical), parallel to NS road
  for (let tx = NS_ROAD_LEFT; tx < NS_ROAD_RIGHT; tx += TILE) {
    for (let ty = EW_ROAD_TOP - ZEBRA_WIDTH_N; ty < EW_ROAD_TOP; ty += TILE) {
      const s = new Sprite(sheet.textures["zebra_v"]);
      s.x = tx;
      s.y = ty;
      container.addChild(s);
    }
  }

  // 2. South crossing (on NS road's south arm — connects SW ↔ SE corners)
  // Pedestrians walk E↔W → bars run N-S (vertical)
  for (let tx = NS_ROAD_LEFT; tx < NS_ROAD_RIGHT; tx += TILE) {
    for (let ty = EW_ROAD_BOTTOM; ty < EW_ROAD_BOTTOM + ZEBRA_WIDTH; ty += TILE) {
      const s = new Sprite(sheet.textures["zebra_v"]);
      s.x = tx;
      s.y = ty;
      container.addChild(s);
    }
  }

  // 3. West crossing (on EW road's west arm — connects NW ↔ SW corners)
  // Pedestrians walk N↔S → bars run E-W (horizontal), parallel to EW road
  for (let ty = EW_ROAD_TOP; ty < EW_ROAD_BOTTOM; ty += TILE) {
    for (let tx = NS_ROAD_LEFT - ZEBRA_WIDTH; tx < NS_ROAD_LEFT; tx += TILE) {
      const s = new Sprite(sheet.textures["zebra_h"]);
      s.x = tx;
      s.y = ty;
      container.addChild(s);
    }
  }

  // 4. East crossing (on EW road's east arm — connects NE ↔ SE corners)
  // Pedestrians walk N↔S → bars run E-W (horizontal)
  for (let ty = EW_ROAD_TOP; ty < EW_ROAD_BOTTOM; ty += TILE) {
    for (let tx = NS_ROAD_RIGHT; tx < NS_ROAD_RIGHT + ZEBRA_WIDTH; tx += TILE) {
      const s = new Sprite(sheet.textures["zebra_h"]);
      s.x = tx;
      s.y = ty;
      container.addChild(s);
    }
  }

  // 5. Single diagonal crossing: SW corner ↔ NE corner
  // This is the famous Shibuya diagonal — only ONE diagonal, not an X.
  // Rendered as a single 80×80 transparent overlay with a corridor of NW-SE bars.
  // Placed on top of the intersection tiles so worn asphalt shows through the gaps.
  {
    const s = new Sprite(sheet.textures["zebra_diag_corridor"]);
    s.x = NS_ROAD_LEFT;  // 360
    s.y = EW_ROAD_TOP;   // 168
    container.addChild(s);
  }

  // ── Stop lines ──
  // Solid white lines across all lanes, one tile before each zebra crossing

  // North stop line (for southbound traffic, lanes 0-1 on left side of NS road)
  // Placed at bottom edge of tile just before north zebra (compact)
  for (let lane = 0; lane < 2; lane++) {
    const s = new Sprite(sheet.textures["stop_line_h_bottom"]);
    s.x = NS_ROAD_LEFT + lane * LANE_W;
    s.y = EW_ROAD_TOP - ZEBRA_WIDTH_N - TILE;
    container.addChild(s);
  }

  // South stop line (for northbound traffic, lanes 2-3 on right side)
  for (let lane = 2; lane < ROAD_LANES; lane++) {
    const s = new Sprite(sheet.textures["stop_line_h_top"]);
    s.x = NS_ROAD_LEFT + lane * LANE_W;
    s.y = EW_ROAD_BOTTOM + ZEBRA_WIDTH;
    container.addChild(s);
  }

  // West stop line (for eastbound traffic, lanes 0-1 top half of EW road)
  for (let lane = 0; lane < 2; lane++) {
    const s = new Sprite(sheet.textures["stop_line_v_right"]);
    s.x = NS_ROAD_LEFT - ZEBRA_WIDTH - TILE;
    s.y = EW_ROAD_TOP + lane * LANE_W;
    container.addChild(s);
  }

  // East stop line (for westbound traffic, lanes 2-3 bottom half)
  for (let lane = 2; lane < ROAD_LANES; lane++) {
    const s = new Sprite(sheet.textures["stop_line_v_left"]);
    s.x = NS_ROAD_RIGHT + ZEBRA_WIDTH;
    s.y = EW_ROAD_TOP + lane * LANE_W;
    container.addChild(s);
  }

  return container;
}
