import { Container, Sprite, Spritesheet } from "pixi.js";
import { NS_ROAD_LEFT, NS_ROAD_RIGHT, BLDG_BOTTOM } from "./Road";

export { BLDG_BOTTOM } from "./Road";

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

/** Place buildings from a layout array into a container.
 *  Returns the QFront sprite if found in this section. */
function placeSection(
  container: Container,
  sheet: Spritesheet,
  layout: LayoutEntry[],
  direction: 'right-to-left' | 'left-to-right',
  startX: number,
  baselineY: number,
): Sprite | null {
  let cursor = startX;
  let qfrontSprite: Sprite | null = null;
  for (const entry of layout) {
    const id = entry.id;
    const w = BLDG_W[id];
    const h = BLDG_H_NORTH[id];
    // QFront uses first color variant (_c0) as initial texture
    const texName = id === 'qfront' ? `bldg_${id}_n_c0` : `bldg_${id}_n`;
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
    if (id === 'qfront') {
      spr.label = 'qfront';
      qfrontSprite = spr;
    }
  }
  return qfrontSprite;
}

export interface BuildingsBgResult {
  container: Container;
  qfrontSprite: Sprite | null;
}

/** Background buildings — north side only, bottom-aligned at BLDG_BOTTOM, BEHIND vehicles */
export function buildBuildingsBg(sheet: Spritesheet): BuildingsBgResult {
  const container = new Container();

  // West section: right-to-left from NS road edge
  placeSection(container, sheet, WEST_LAYOUT, 'right-to-left', NS_ROAD_LEFT, BLDG_BOTTOM);

  // East section: left-to-right from NS road edge
  const qfrontSprite = placeSection(container, sheet, EAST_LAYOUT, 'left-to-right', NS_ROAD_RIGHT, BLDG_BOTTOM);

  return { container, qfrontSprite };
}

/** Foreground vegetation — south side urban planting */
export function buildBuildingsFg(sheet: Spritesheet): Container {
  const container = new Container();

  // Seeded PRNG (mulberry32)
  let seed = 12345;
  function rand(): number {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  const STEP = 20;
  // Two zones: left of NS road, right of NS road (8px margin from edges)
  const zones: [number, number][] = [
    [8, NS_ROAD_LEFT - 8],      // left zone:  x=8  to x=352
    [NS_ROAD_RIGHT + 8, 792],   // right zone: x=448 to x=792
  ];

  // Sprite key → vertical placement (y coordinate, bottom-anchored at SCENE_H=300)
  const SPRITE_Y: Record<string, number> = {
    veg_tree: 260,
    veg_tree_sm: 272,
    veg_bush: 288,
    veg_planter: 284,
  };

  for (const [zoneStart, zoneEnd] of zones) {
    for (let x = zoneStart; x + STEP <= zoneEnd; x += STEP) {
      const r = rand();
      let spriteId: string;
      let addTrailingBush = false;

      if (r < 0.35) {
        spriteId = "veg_tree";
        // 50% chance of trailing bush after a large tree
        if (rand() < 0.5) addTrailingBush = true;
      } else if (r < 0.55) {
        spriteId = "veg_tree_sm";
      } else if (r < 0.75) {
        spriteId = "veg_planter";
      } else {
        spriteId = "veg_bush";
      }

      const tex = sheet.textures[spriteId];
      if (!tex) continue;
      const spr = new Sprite(tex);
      spr.x = x;
      spr.y = SPRITE_Y[spriteId];
      container.addChild(spr);

      // Optional trailing hedge after a large tree
      if (addTrailingBush && x + STEP + STEP <= zoneEnd) {
        const bushTex = sheet.textures["veg_bush"];
        if (bushTex) {
          const bush = new Sprite(bushTex);
          bush.x = x + STEP;
          bush.y = SPRITE_Y["veg_bush"];
          container.addChild(bush);
        }
        x += STEP; // skip next slot (occupied by trailing bush)
      }
    }
  }

  return container;
}
