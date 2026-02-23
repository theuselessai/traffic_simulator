import { Container, Sprite, Spritesheet } from "pixi.js";

// Layout constants for 800x400 cinematic viewport
export const SCENE_W = 800;
export const SCENE_H = 400;
export const TILE = 20;
export const LANE_W = TILE; // 20px per lane
export const ROAD_LANES = 4; // 4 lanes per road
export const ROAD_W = LANE_W * ROAD_LANES; // 80px
export const SIDEWALK_W = 14; // narrow sidewalk strips

// Intersection center (shifted up for taller south-side buildings)
export const IX_CENTER_X = SCENE_W / 2; // 400
export const IX_CENTER_Y = 160;

// Road boundaries
// NS road: lanes run vertically
export const NS_ROAD_LEFT = IX_CENTER_X - ROAD_W / 2; // 360
export const NS_ROAD_RIGHT = IX_CENTER_X + ROAD_W / 2; // 440

// EW road: lanes run horizontally
export const EW_ROAD_TOP = IX_CENTER_Y - ROAD_W / 2; // 120
export const EW_ROAD_BOTTOM = IX_CENTER_Y + ROAD_W / 2; // 200

// Zebra crossings (outside the intersection)
export const ZEBRA_WIDTH = 2 * TILE; // 40px

// Stop lines (one tile before zebra crossing)
export const STOP_LINE_N = EW_ROAD_TOP - ZEBRA_WIDTH - TILE;
export const STOP_LINE_S = EW_ROAD_BOTTOM + ZEBRA_WIDTH;
export const STOP_LINE_W = NS_ROAD_LEFT - ZEBRA_WIDTH - TILE;
export const STOP_LINE_E = NS_ROAD_RIGHT + ZEBRA_WIDTH;

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

  // NS road (vertical)
  for (let ty = 0; ty < SCENE_H; ty += TILE) {
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
      // Skip intersection area (already drawn by NS road or will be intersection)
      if (tx >= NS_ROAD_LEFT && tx < NS_ROAD_RIGHT) continue;
      const s = new Sprite(sheet.textures["road_asphalt"]);
      s.x = tx;
      s.y = ty;
      container.addChild(s);
    }
  }

  // Intersection center
  for (let ty = EW_ROAD_TOP; ty < EW_ROAD_BOTTOM; ty += TILE) {
    for (let tx = NS_ROAD_LEFT; tx < NS_ROAD_RIGHT; tx += TILE) {
      const s = new Sprite(sheet.textures["intersection"]);
      s.x = tx;
      s.y = ty;
      container.addChild(s);
    }
  }

  // Lane markings - NS road center line (vertical)
  for (let ty = 0; ty < SCENE_H; ty += TILE) {
    if (ty >= EW_ROAD_TOP - ZEBRA_WIDTH && ty < EW_ROAD_BOTTOM + ZEBRA_WIDTH) continue;
    const s = new Sprite(sheet.textures["road_lane_v"]);
    s.x = IX_CENTER_X - TILE / 2;
    s.y = ty;
    container.addChild(s);
  }

  // Lane markings - EW road center line (horizontal)
  for (let tx = 0; tx < SCENE_W; tx += TILE) {
    if (tx >= NS_ROAD_LEFT - ZEBRA_WIDTH && tx < NS_ROAD_RIGHT + ZEBRA_WIDTH) continue;
    const s = new Sprite(sheet.textures["road_lane_h"]);
    s.x = tx;
    s.y = IX_CENTER_Y - TILE / 2;
    container.addChild(s);
  }

  // Zebra crossings - North side (horizontal crossing)
  for (let tx = NS_ROAD_LEFT; tx < NS_ROAD_RIGHT; tx += TILE) {
    const s = new Sprite(sheet.textures["zebra_v"]);
    s.x = tx;
    s.y = EW_ROAD_TOP - ZEBRA_WIDTH;
    container.addChild(s);
  }

  // Zebra crossings - South side
  for (let tx = NS_ROAD_LEFT; tx < NS_ROAD_RIGHT; tx += TILE) {
    const s = new Sprite(sheet.textures["zebra_v"]);
    s.x = tx;
    s.y = EW_ROAD_BOTTOM;
    container.addChild(s);
  }

  // Zebra crossings - West side (vertical crossing)
  for (let ty = EW_ROAD_TOP; ty < EW_ROAD_BOTTOM; ty += TILE) {
    const s = new Sprite(sheet.textures["zebra_h"]);
    s.x = NS_ROAD_LEFT - ZEBRA_WIDTH;
    s.y = ty;
    container.addChild(s);
  }

  // Zebra crossings - East side
  for (let ty = EW_ROAD_TOP; ty < EW_ROAD_BOTTOM; ty += TILE) {
    const s = new Sprite(sheet.textures["zebra_h"]);
    s.x = NS_ROAD_RIGHT;
    s.y = ty;
    container.addChild(s);
  }

  // Diagonal crossings through intersection (scramble)
  {
    const diagTiles = ROAD_W / TILE; // 4 tiles
    // NW-SE diagonal
    for (let i = 0; i < diagTiles; i++) {
      const s = new Sprite(sheet.textures["zebra_diag_nwse"]);
      s.x = NS_ROAD_LEFT + i * TILE;
      s.y = EW_ROAD_TOP + i * TILE;
      container.addChild(s);
    }
    // NE-SW diagonal
    for (let i = 0; i < diagTiles; i++) {
      const s = new Sprite(sheet.textures["zebra_diag_nesw"]);
      s.x = NS_ROAD_RIGHT - (i + 1) * TILE;
      s.y = EW_ROAD_TOP + i * TILE;
      container.addChild(s);
    }
  }

  return container;
}
