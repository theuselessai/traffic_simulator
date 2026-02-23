import { Container, Sprite, Spritesheet } from "pixi.js";
import {
  NS_ROAD_LEFT, NS_ROAD_RIGHT, EW_ROAD_TOP, EW_ROAD_BOTTOM,
  SCENE_W, SCENE_H, ZEBRA_WIDTH, SIDEWALK_W
} from "./Road";

// Building widths (must match generate-sprites.ts template configs)
const BLDG_W: Record<string, number> = {
  '109': 48, starbucks: 36, qfront: 48, station: 48,
  lawson: 24, familymart: 24, seven_eleven: 24, ramen: 24,
  office_a: 36, office_b: 36, pachinko: 36, subway: 24,
};

// Building heights: heightOverride ?? (8 + 12 * floors)
const BLDG_H: Record<string, number> = {
  '109': 56, starbucks: 32, qfront: 56, station: 20,
  lawson: 20, familymart: 20, seven_eleven: 20, ramen: 20,
  office_a: 44, office_b: 44, pachinko: 32, subway: 14,
};

type LayoutEntry = { type: 'building'; id: string } | { type: 'sign' };

// Quadrant layout arrays — buildings + optional vertical signs
// Each quadrant fills 346px: sum of building widths + 2px per sign = 346

const NW_LAYOUT: LayoutEntry[] = [
  { type: 'building', id: 'starbucks' },  // 36
  { type: 'sign' },                        // 2
  { type: 'building', id: 'office_a' },    // 36
  { type: 'building', id: 'lawson' },      // 24
  { type: 'sign' },                        // 2
  { type: 'building', id: 'ramen' },       // 24
  { type: 'building', id: 'office_b' },    // 36
  { type: 'sign' },                        // 2
  { type: 'building', id: 'familymart' },  // 24
  { type: 'building', id: 'seven_eleven' },// 24
  { type: 'sign' },                        // 2
  { type: 'building', id: 'pachinko' },    // 36
  { type: 'building', id: 'subway' },      // 24
  { type: 'building', id: 'office_a' },    // 36
  { type: 'sign' },                        // 2
  { type: 'building', id: 'starbucks' },   // 36
]; // 336 + 10 = 346

const NE_LAYOUT: LayoutEntry[] = [
  { type: 'building', id: 'office_b' },    // 36
  { type: 'sign' },                        // 2
  { type: 'building', id: 'seven_eleven' },// 24
  { type: 'building', id: 'pachinko' },    // 36
  { type: 'sign' },                        // 2
  { type: 'building', id: 'ramen' },       // 24
  { type: 'building', id: 'office_a' },    // 36
  { type: 'building', id: 'familymart' },  // 24
  { type: 'sign' },                        // 2
  { type: 'building', id: 'lawson' },      // 24
  { type: 'building', id: 'starbucks' },   // 36
  { type: 'sign' },                        // 2
  { type: 'building', id: 'office_b' },    // 36
  { type: 'building', id: 'subway' },      // 24
  { type: 'sign' },                        // 2
  { type: 'building', id: 'starbucks' },   // 36
]; // 336 + 10 = 346

const SW_LAYOUT: LayoutEntry[] = [
  { type: 'building', id: '109' },         // 48
  { type: 'building', id: 'station' },     // 48
  { type: 'sign' },                        // 2
  { type: 'building', id: 'office_a' },    // 36
  { type: 'building', id: 'ramen' },       // 24
  { type: 'sign' },                        // 2
  { type: 'building', id: 'office_b' },    // 36
  { type: 'building', id: 'lawson' },      // 24
  { type: 'sign' },                        // 2
  { type: 'building', id: 'familymart' },  // 24
  { type: 'building', id: 'seven_eleven' },// 24
  { type: 'sign' },                        // 2
  { type: 'building', id: 'starbucks' },   // 36
  { type: 'building', id: 'pachinko' },    // 36
  { type: 'sign' },                        // 2
]; // 336 + 10 = 346

const SE_LAYOUT: LayoutEntry[] = [
  { type: 'building', id: 'qfront' },      // 48
  { type: 'sign' },                        // 2
  { type: 'building', id: 'office_b' },    // 36
  { type: 'building', id: 'seven_eleven' },// 24
  { type: 'sign' },                        // 2
  { type: 'building', id: 'office_a' },    // 36
  { type: 'building', id: 'ramen' },       // 24
  { type: 'building', id: 'starbucks' },   // 36
  { type: 'sign' },                        // 2
  { type: 'building', id: 'lawson' },      // 24
  { type: 'building', id: 'familymart' },  // 24
  { type: 'sign' },                        // 2
  { type: 'building', id: 'pachinko' },    // 36
  { type: 'building', id: 'subway' },      // 24
  { type: 'sign' },                        // 2
  { type: 'building', id: 'lawson' },      // 24
]; // 336 + 10 = 346

const SIGN_W = 2;

export function buildBuildingsBg(sheet: Spritesheet): Container {
  const container = new Container();

  const nBldgBottom = EW_ROAD_TOP - ZEBRA_WIDTH - SIDEWALK_W; // 66
  const sBldgTop = EW_ROAD_BOTTOM + ZEBRA_WIDTH + SIDEWALK_W; // 254
  const wBldgRight = NS_ROAD_LEFT - SIDEWALK_W;               // 346
  const eBldgLeft = NS_ROAD_RIGHT + SIDEWALK_W;               // 454

  // Helper: place buildings from a layout array
  function placeQuadrant(
    layout: LayoutEntry[],
    direction: 'right-to-left' | 'left-to-right',
    startX: number,
    baselineY: number,
    align: 'bottom' | 'top',
  ) {
    let cursor = startX;
    for (const entry of layout) {
      if (entry.type === 'sign') {
        const signH = 12;
        const sy = align === 'bottom' ? baselineY - signH : baselineY;
        const s = new Sprite(sheet.textures["bldg_sign_v"]);
        if (direction === 'right-to-left') {
          s.x = cursor - SIGN_W;
          cursor -= SIGN_W;
        } else {
          s.x = cursor;
          cursor += SIGN_W;
        }
        s.y = sy;
        container.addChild(s);
      } else {
        const id = entry.id;
        const w = BLDG_W[id];
        const h = BLDG_H[id];
        const texName = `bldg_${id}`;
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
        spr.y = align === 'bottom' ? baselineY - h : baselineY;
        container.addChild(spr);
      }
    }
  }

  // NW quadrant: right-to-left from wBldgRight, bottom-aligned at nBldgBottom
  placeQuadrant(NW_LAYOUT, 'right-to-left', wBldgRight, nBldgBottom, 'bottom');

  // NE quadrant: left-to-right from eBldgLeft, bottom-aligned at nBldgBottom
  placeQuadrant(NE_LAYOUT, 'left-to-right', eBldgLeft, nBldgBottom, 'bottom');

  // SW quadrant: right-to-left from wBldgRight, top-aligned at sBldgTop
  placeQuadrant(SW_LAYOUT, 'right-to-left', wBldgRight, sBldgTop, 'top');

  // SE quadrant: left-to-right from eBldgLeft, top-aligned at sBldgTop
  placeQuadrant(SE_LAYOUT, 'left-to-right', eBldgLeft, sBldgTop, 'top');

  return container;
}

export function buildBuildingsFg(_sheet: Spritesheet): Container {
  return new Container();
}
