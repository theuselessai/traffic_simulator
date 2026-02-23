import { Container, Sprite, Spritesheet } from "pixi.js";

// Layout constants for 480x480 scene
export const SCENE_W = 480;
export const SCENE_H = 480;
export const TILE = 24;
export const LANE_W = TILE; // 24px per lane
export const ROAD_LANES = 4; // 4 lanes per road
export const ROAD_W = LANE_W * ROAD_LANES; // 96px

// Intersection center
export const IX_CENTER_X = SCENE_W / 2; // 240
export const IX_CENTER_Y = SCENE_H / 2; // 240

// Road boundaries
// NS road: lanes run vertically
export const NS_ROAD_LEFT = IX_CENTER_X - ROAD_W / 2; // 192
export const NS_ROAD_RIGHT = IX_CENTER_X + ROAD_W / 2; // 288

// EW road: lanes run horizontally
export const EW_ROAD_TOP = IX_CENTER_Y - ROAD_W / 2; // 192
export const EW_ROAD_BOTTOM = IX_CENTER_Y + ROAD_W / 2; // 288

// Zebra crossings (outside the intersection)
export const ZEBRA_WIDTH = TILE; // 24px wide crossing

// Stop lines
export const STOP_LINE_N = EW_ROAD_TOP - ZEBRA_WIDTH - TILE; // vehicles stop here going south
export const STOP_LINE_S = EW_ROAD_BOTTOM + ZEBRA_WIDTH; // vehicles stop here going north
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

  // Diagonal crossings through intersection
  {
    // NW-SE diagonal
    const diagTiles = Math.ceil(ROAD_W / TILE);
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
