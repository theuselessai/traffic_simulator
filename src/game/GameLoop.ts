import type { Ticker } from "pixi.js";
import type { GameState } from "./GameState";
import type { SceneLayers } from "../scene/SceneBuilder";
import type { Spritesheet } from "pixi.js";
import { updateTrafficLight, placeTrafficLightSprites } from "../systems/TrafficLight";
import { updateSpawner } from "../systems/Spawner";
import { updateMovement } from "../systems/Movement";
import { updateLighting } from "../systems/Lighting";
import { updateQFrontScreen } from "../systems/QFrontScreen";

export function createGameLoop(
  ticker: Ticker,
  state: GameState,
  layers: SceneLayers,
  sheet: Spritesheet
) {
  // Place static traffic light sprites
  placeTrafficLightSprites(layers.trafficLight, sheet, state);

  ticker.add(() => {
    const dt = ticker.deltaMS / 1000; // seconds

    // Advance time of day (1 real second = 1 game minute)
    state.timeOfDay += dt / 60;
    if (state.timeOfDay >= 24) state.timeOfDay -= 24;

    // Update traffic light state machine
    updateTrafficLight(state, dt, layers.trafficLight, sheet);

    // Spawn entities
    updateSpawner(state, dt, layers, sheet);

    // Move entities
    updateMovement(state, dt, layers);

    // Update lighting
    updateLighting(state, layers);

    // Animate QFront video screen
    updateQFrontScreen(state, dt, layers, sheet);
  });
}
