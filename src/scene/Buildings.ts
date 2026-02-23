import { Container, Sprite, Spritesheet } from "pixi.js";
import { NS_ROAD_LEFT, NS_ROAD_RIGHT, BLDG_BOTTOM } from "./Road";

// Building widths (must match generate-sprites.ts template configs)
const BLDG_W: Record<string, number> = {
  '109': 80, starbucks: 60, qfront: 80, station: 80,
  lawson: 40, familymart: 40, seven_eleven: 40, ramen: 40,
  office_a: 60, office_b: 60, pachinko: 60, subway: 40,
};

// North-facing heights: roofCap(12) + floors×24 + extraRoof
const BLDG_H_NORTH: Record<string, number> = {
  '109': 92, starbucks: 64, qfront: 118, station: 36,
  lawson: 36, familymart: 36, seven_eleven: 36, ramen: 36,
  office_a: 92, office_b: 92, pachinko: 64, subway: 24,
};

type LayoutEntry = { id: string };

// ── West section: right-to-left from NS_ROAD_LEFT (x=360) ──
// Starbucks(60) + Pachinko(60) + Lawson(40) + Ramen(40) + Office_A(60) + Office_B(60) + FamilyMart(40) = 360
const WEST_LAYOUT: LayoutEntry[] = [
  { id: 'starbucks' },   // 60
  { id: 'pachinko' },    // 60
  { id: 'lawson' },      // 40
  { id: 'ramen' },       // 40
  { id: 'office_a' },    // 60
  { id: 'office_b' },    // 60
  { id: 'familymart' },  // 40
]; // total = 360

// ── East section: left-to-right from NS_ROAD_RIGHT (x=440) ──
// QFront(80) + 7-Eleven(40) + Office_B(60) + 109(80) + Office_A(60) + Subway(40) = 360
const EAST_LAYOUT: LayoutEntry[] = [
  { id: 'qfront' },       // 80
  { id: 'seven_eleven' }, // 40
  { id: 'office_b' },     // 60
  { id: '109' },          // 80
  { id: 'office_a' },     // 60
  { id: 'subway' },       // 40
]; // total = 360

/** Place buildings from a layout array into a container */
function placeSection(
  container: Container,
  sheet: Spritesheet,
  layout: LayoutEntry[],
  direction: 'right-to-left' | 'left-to-right',
  startX: number,
  baselineY: number,
) {
  let cursor = startX;
  for (const entry of layout) {
    const id = entry.id;
    const w = BLDG_W[id];
    const h = BLDG_H_NORTH[id];
    const texName = `bldg_${id}_n`;
    const tex = sheet.textures[texName];
    if (!tex) continue;
    const spr = new Sprite(tex);
    if (direction === 'right-to-left') {
      spr.x = cursor - w;
      cursor -= w;
    } else {
      spr.x = cursor;
      cursor += w;
    }
    spr.y = baselineY - h;
    container.addChild(spr);
  }
}

/** Background buildings — north side only, bottom-aligned at BLDG_BOTTOM, BEHIND vehicles */
export function buildBuildingsBg(sheet: Spritesheet): Container {
  const container = new Container();

  // West section: right-to-left from NS road edge
  placeSection(container, sheet, WEST_LAYOUT, 'right-to-left', NS_ROAD_LEFT, BLDG_BOTTOM);

  // East section: left-to-right from NS road edge
  placeSection(container, sheet, EAST_LAYOUT, 'left-to-right', NS_ROAD_RIGHT, BLDG_BOTTOM);

  return container;
}

/** Foreground buildings — none in cinematic view (no south-side buildings) */
export function buildBuildingsFg(_sheet: Spritesheet): Container {
  return new Container();
}
