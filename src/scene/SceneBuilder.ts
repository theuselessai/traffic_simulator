import { Container, Spritesheet } from "pixi.js";
import { buildRoad } from "./Road";
import { buildBuildingsBg, buildBuildingsFg } from "./Buildings";

export interface SceneLayers {
  root: Container;
  buildingBg: Container;
  road: Container;
  vehicle: Container;
  pedestrian: Container;
  trafficLight: Container;
  buildingFg: Container;
  ui: Container;
}

export function buildScene(sheet: Spritesheet): SceneLayers {
  const root = new Container();

  // 7 layers, bottom to top
  const buildingBg = buildBuildingsBg(sheet);
  const road = buildRoad(sheet);
  const vehicle = new Container();
  vehicle.sortableChildren = true;
  const pedestrian = new Container();
  pedestrian.sortableChildren = true;
  const trafficLight = new Container();
  const buildingFg = buildBuildingsFg(sheet);
  const ui = new Container();

  // Add in order (first = bottom)
  root.addChild(road);        // road goes under buildings bg for corner overlap
  root.addChild(buildingBg);
  root.addChild(vehicle);
  root.addChild(pedestrian);
  root.addChild(trafficLight);
  root.addChild(buildingFg);
  root.addChild(ui);

  return { root, buildingBg, road, vehicle, pedestrian, trafficLight, buildingFg, ui };
}
