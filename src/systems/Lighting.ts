import { ColorMatrixFilter } from "pixi.js";
import type { GameState } from "../game/GameState";
import type { SceneLayers } from "../scene/SceneBuilder";

let filter: ColorMatrixFilter | null = null;
let lastPeriod = "";

type TimePeriod = "sunrise" | "day" | "sunset" | "evening" | "night";

function getTimePeriod(hour: number): TimePeriod {
  if (hour >= 6 && hour < 7) return "sunrise";
  if (hour >= 7 && hour < 17) return "day";
  if (hour >= 17 && hour < 18.5) return "sunset";
  if (hour >= 18.5 && hour < 21) return "evening";
  return "night";
}

export function updateLighting(state: GameState, layers: SceneLayers) {
  const period = getTimePeriod(state.timeOfDay);

  if (period === lastPeriod) return;
  lastPeriod = period;

  if (!filter) {
    filter = new ColorMatrixFilter();
    layers.root.filters = [filter];
  }

  filter.reset();

  switch (period) {
    case "sunrise":
      // Warm orange tint
      filter.matrix[0] = 1.1;  // R
      filter.matrix[6] = 1.0;  // G
      filter.matrix[12] = 0.85; // B
      break;
    case "day":
      // No filter
      break;
    case "sunset":
      // Orange/pink tint
      filter.matrix[0] = 1.15;
      filter.matrix[6] = 0.9;
      filter.matrix[12] = 0.8;
      break;
    case "evening":
      // Blue tint
      filter.matrix[0] = 0.85;
      filter.matrix[6] = 0.85;
      filter.matrix[12] = 1.1;
      filter.brightness(0.85, false);
      break;
    case "night":
      // Deeper blue tint
      filter.matrix[0] = 0.7;
      filter.matrix[6] = 0.75;
      filter.matrix[12] = 1.2;
      filter.brightness(0.7, false);
      break;
  }
}
