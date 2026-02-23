import { Container, Sprite, Spritesheet } from "pixi.js";
import {
  NS_ROAD_LEFT, NS_ROAD_RIGHT, EW_ROAD_TOP, EW_ROAD_BOTTOM,
  SCENE_W, SCENE_H, ZEBRA_WIDTH, SIDEWALK_W
} from "./Road";

export function buildBuildingsBg(sheet: Spritesheet): Container {
  const container = new Container();

  // Building zone boundaries
  const nBldgBottom = EW_ROAD_TOP - ZEBRA_WIDTH - SIDEWALK_W; // 66
  const sBldgTop = EW_ROAD_BOTTOM + ZEBRA_WIDTH + SIDEWALK_W; // 254
  const wBldgRight = NS_ROAD_LEFT - SIDEWALK_W;               // 346
  const eBldgLeft = NS_ROAD_RIGHT + SIDEWALK_W;               // 454

  // ── NW corner — Starbucks + storefronts ──
  const sbux = new Sprite(sheet.textures["bldg_starbucks"]);
  sbux.x = wBldgRight - 56;          // 290
  sbux.y = nBldgBottom - 48;         // 18
  container.addChild(sbux);

  const store0a = new Sprite(sheet.textures["bldg_store_0"]);
  store0a.x = wBldgRight - 56 - 52;  // 238
  store0a.y = nBldgBottom - 40;       // 26
  container.addChild(store0a);

  const store1a = new Sprite(sheet.textures["bldg_store_1"]);
  store1a.x = wBldgRight - 56 - 52 - 52; // 186
  store1a.y = nBldgBottom - 40;
  container.addChild(store1a);

  // ── NE corner — storefronts ──
  const store0b = new Sprite(sheet.textures["bldg_store_0"]);
  store0b.x = eBldgLeft + 4;         // 458
  store0b.y = nBldgBottom - 40;       // 26
  container.addChild(store0b);

  const store1b = new Sprite(sheet.textures["bldg_store_1"]);
  store1b.x = eBldgLeft + 56;        // 510
  store1b.y = nBldgBottom - 40;
  container.addChild(store1b);

  const store0c = new Sprite(sheet.textures["bldg_store_0"]);
  store0c.x = eBldgLeft + 108;       // 562
  store0c.y = nBldgBottom - 40;
  container.addChild(store0c);

  // ── SW corner — Shibuya 109 (landmark) + station ──
  const b109 = new Sprite(sheet.textures["bldg_109"]);
  b109.x = wBldgRight - 64;          // 282
  b109.y = sBldgTop + 4;             // 258
  container.addChild(b109);

  const sta = new Sprite(sheet.textures["bldg_station"]);
  sta.x = wBldgRight - 64 - 84;      // 198
  sta.y = SCENE_H - 52;              // 348
  container.addChild(sta);

  // ── SE corner — QFront/Tsutaya (screen building) + stores ──
  const qf = new Sprite(sheet.textures["bldg_qfront"]);
  qf.x = eBldgLeft + 4;              // 458
  qf.y = sBldgTop + 4;               // 258
  container.addChild(qf);

  const store1c = new Sprite(sheet.textures["bldg_store_1"]);
  store1c.x = eBldgLeft + 64;        // 518
  store1c.y = sBldgTop + 4;
  container.addChild(store1c);

  return container;
}

export function buildBuildingsFg(_sheet: Spritesheet): Container {
  return new Container();
}
