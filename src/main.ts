import { Application, Assets, Spritesheet, TextureSource } from "pixi.js";
import { buildScene } from "./scene/SceneBuilder";
import { createGameState } from "./game/GameState";
import { createGameLoop } from "./game/GameLoop";
import { SCENE_W, SCENE_H } from "./scene/Road";

// Force nearest-neighbor scaling for pixel art
TextureSource.defaultOptions.scaleMode = "nearest";

async function init() {
  const app = new Application();
  await app.init({
    backgroundAlpha: 0,
    antialias: false,
    width: SCENE_W,
    height: SCENE_H,
    canvas: document.createElement("canvas"),
  });
  app.ticker.maxFPS = 30;

  const container = document.getElementById("app")!;
  container.appendChild(app.canvas);

  // Load spritesheet
  const sheetData = await Assets.load("/sprites/spritesheet.json");
  let sheet: Spritesheet;
  if (sheetData instanceof Spritesheet) {
    sheet = sheetData;
  } else {
    // Loaded as raw JSON - need to construct spritesheet
    const texture = await Assets.load("/sprites/spritesheet.png");
    sheet = new Spritesheet(texture, sheetData);
    await sheet.parse();
  }

  // Build scene layers
  const layers = buildScene(sheet);
  app.stage.addChild(layers.root);

  // Create game state
  const state = createGameState();

  // Start game loop
  createGameLoop(app.ticker, state, layers, sheet);

  // Window dragging (Tauri)
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = getCurrentWindow();

    container.addEventListener("mousedown", async (e) => {
      if (e.button === 0) {
        await win.startDragging();
      }
    });

    // Listen for tray events
    const { listen } = await import("@tauri-apps/api/event");
    let clickThrough = false;

    await listen("toggle-click-through", async () => {
      clickThrough = !clickThrough;
      await win.setIgnoreCursorEvents(clickThrough);
    });

    await listen("reset-position", async () => {
      await win.setPosition(
        new (await import("@tauri-apps/api/dpi")).PhysicalPosition(100, 100)
      );
    });

    await listen("toggle-autostart", async () => {
      try {
        const { enable, disable, isEnabled } = await import("@tauri-apps/plugin-autostart");
        if (await isEnabled()) {
          await disable();
          console.log("Autostart disabled");
        } else {
          await enable();
          console.log("Autostart enabled");
        }
      } catch (e) {
        console.error("Autostart toggle failed:", e);
      }
    });
  } catch {
    // Not running in Tauri (browser dev mode)
    console.log("Running in browser mode (no Tauri APIs)");
  }
}

init();
