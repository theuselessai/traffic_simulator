import { Container, Sprite, Spritesheet } from "pixi.js";
import { NS_ROAD_LEFT, NS_ROAD_RIGHT, EW_ROAD_TOP, EW_ROAD_BOTTOM, SCENE_W, SCENE_H } from "./Road";

export function buildBuildingsBg(sheet: Spritesheet): Container {
  const container = new Container();

  // SW corner - Shibuya 109 (64x80)
  const b109 = new Sprite(sheet.textures["bldg_109"]);
  b109.x = NS_ROAD_LEFT - 64 - 24; // pushed further left
  b109.y = EW_ROAD_BOTTOM + 24;
  container.addChild(b109);

  // NW corner - Starbucks (56x48)
  const sbux = new Sprite(sheet.textures["bldg_starbucks"]);
  sbux.x = NS_ROAD_LEFT - 56 - 24;
  sbux.y = EW_ROAD_TOP - 48 - 24;
  container.addChild(sbux);

  // NE corner - QFront (56x96)
  const qf = new Sprite(sheet.textures["bldg_qfront"]);
  qf.x = NS_ROAD_RIGHT + 24;
  qf.y = EW_ROAD_TOP - 96 - 8;
  container.addChild(qf);

  // SE corner - Station (80x48)
  const sta = new Sprite(sheet.textures["bldg_station"]);
  sta.x = NS_ROAD_RIGHT + 16;
  sta.y = EW_ROAD_BOTTOM + 24;
  container.addChild(sta);

  // Extra storefronts
  const store0 = new Sprite(sheet.textures["bldg_store_0"]);
  store0.x = 8;
  store0.y = 8;
  container.addChild(store0);

  const store1 = new Sprite(sheet.textures["bldg_store_1"]);
  store1.x = SCENE_W - 56;
  store1.y = SCENE_H - 48;
  container.addChild(store1);

  return container;
}

export function buildBuildingsFg(_sheet: Spritesheet): Container {
  // Foreground building layer (for buildings that should overlap entities)
  // For now empty - buildings are all in background
  return new Container();
}
