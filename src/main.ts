import { Application, Assets, Graphics, Spritesheet, TextureSource } from "pixi.js";
import { buildScene } from "./scene/SceneBuilder";
import { createGameState } from "./game/GameState";
import { createGameLoop } from "./game/GameLoop";
import { SCENE_W, SCENE_H } from "./scene/Road";

// Force nearest-neighbor scaling for pixel art
TextureSource.defaultOptions.scaleMode = "nearest";

// Debug overlay for diagnosing issues in Tauri's WKWebView
function debugLog(msg: string) {
  console.log("[shibuya]", msg);
  const el = document.getElementById("debug");
  if (el) {
    el.textContent += msg + "\n";
  }
}

async function init() {
  // Create debug overlay
  const debugEl = document.createElement("pre");
  debugEl.id = "debug";
  debugEl.style.cssText =
    "position:fixed;top:0;left:0;z-index:9999;color:lime;background:rgba(0,0,0,0.7);font-size:10px;padding:4px;pointer-events:none;max-height:200px;overflow:hidden;";
  document.body.appendChild(debugEl);

  debugLog("init starting...");
  debugLog(`scene size: ${SCENE_W}x${SCENE_H}`);

  const app = new Application();
  await app.init({
    backgroundAlpha: 0,
    antialias: false,
    width: SCENE_W,
    height: SCENE_H,
  });
  app.ticker.maxFPS = 30;

  const container = document.getElementById("app")!;
  container.appendChild(app.canvas);
  debugLog(`canvas appended: ${app.canvas.width}x${app.canvas.height}`);

  // Draw a visible test rectangle directly to confirm PixiJS renders
  const testRect = new Graphics();
  testRect.rect(0, 0, SCENE_W, SCENE_H);
  testRect.fill({ color: 0x222222, alpha: 0.9 });
  app.stage.addChild(testRect);
  debugLog("test rect drawn");

  // Load spritesheet
  debugLog(`base URL: ${window.location.href}`);
  debugLog("loading spritesheet...");
  let sheet: Spritesheet;
  try {
    // Try fetching JSON first to debug path issues
    const testFetch = await fetch("sprites/spritesheet.json");
    debugLog(`fetch status: ${testFetch.status} ${testFetch.statusText}`);
    if (!testFetch.ok) {
      // Try absolute path
      const testFetch2 = await fetch("/sprites/spritesheet.json");
      debugLog(`fetch /abs: ${testFetch2.status}`);
    }

    sheet = await Assets.load<Spritesheet>("sprites/spritesheet.json");
    const texCount = Object.keys(sheet.textures).length;
    debugLog(`spritesheet loaded: ${texCount} textures`);

    if (texCount === 0) {
      debugLog("ERROR: No textures parsed!");
      return;
    }
  } catch (e) {
    debugLog(`spritesheet ERROR: ${String(e)}`);
    debugLog(`stack: ${(e as Error)?.stack?.slice(0, 200)}`);
    return;
  }

  // Build scene layers
  const layers = buildScene(sheet);
  // Insert scene above test rect
  app.stage.addChild(layers.root);
  debugLog(`scene built, layers: ${layers.root.children.length}`);

  // Create game state
  const state = createGameState();

  // Start game loop
  createGameLoop(app.ticker, state, layers, sheet);
  debugLog("game loop started");

  // Remove debug overlay after 10 seconds
  setTimeout(() => {
    debugEl.remove();
  }, 10000);

  // Window dragging (Tauri)
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = getCurrentWindow();

    container.addEventListener("mousedown", async (e) => {
      if (e.button === 0) {
        await win.startDragging();
      }
    });

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
        const { enable, disable, isEnabled } = await import(
          "@tauri-apps/plugin-autostart"
        );
        if (await isEnabled()) {
          await disable();
        } else {
          await enable();
        }
      } catch (e) {
        debugLog(`autostart error: ${e}`);
      }
    });

    debugLog("Tauri APIs wired");
  } catch {
    debugLog("browser mode (no Tauri)");
  }
}

init().catch((e) => {
  const el = document.getElementById("app")!;
  el.style.background = "rgba(255,0,0,0.9)";
  el.style.color = "white";
  el.style.padding = "20px";
  el.style.fontFamily = "monospace";
  el.style.fontSize = "14px";
  el.textContent = "FATAL ERROR:\n" + String(e) + "\n\n" + (e as Error)?.stack;
});
