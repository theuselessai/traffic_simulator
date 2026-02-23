import { Graphics, Sprite, Spritesheet } from "pixi.js";
import type { GameState } from "../game/GameState";
import type { SceneLayers } from "../scene/SceneBuilder";
import { BLDG_BOTTOM } from "../scene/Buildings";

// Screen color cycle: hold 2s each, 0.3s crossfade
const SCREEN_SUFFIXES = ['_c0', '_c1', '_c2', '_c3']; // blue, pink, green, yellow
const HOLD_DURATION = 2.0;  // seconds per color
const FADE_DURATION = 0.3;  // crossfade seconds
const CYCLE_DURATION = HOLD_DURATION + FADE_DURATION;

// Glow colors matching each screen color (day)
const GLOW_COLORS_DAY = [0x41a6f6, 0xef7d8e, 0xa7f070, 0xffcd75];
// Glow colors matching each screen color (night — brighter)
const GLOW_COLORS_NIGHT = [0x73eff7, 0xff6b9d, 0x8aff70, 0xf7e476];

// State
let elapsed = 0;
let currentIndex = 0;
let nextSprite: Sprite | null = null;
let glowStrip: Graphics | null = null;
let initialized = false;

function isNight(hour: number): boolean {
  return hour >= 18.5 || hour < 6;
}

function getTextureName(index: number, night: boolean): string {
  return `bldg_qfront_n${SCREEN_SUFFIXES[index]}${night ? '_night' : ''}`;
}

export function updateQFrontScreen(
  state: GameState,
  dt: number,
  layers: SceneLayers,
  sheet: Spritesheet,
) {
  const qfront = layers.qfrontSprite;
  if (!qfront) return;

  const night = isNight(state.timeOfDay);

  // Initialize glow strip on first call
  if (!initialized) {
    glowStrip = new Graphics();
    // Insert glow strip into buildingBg container (same layer as buildings)
    layers.buildingBg.addChild(glowStrip);
    initialized = true;
  }

  elapsed += dt;

  if (elapsed < HOLD_DURATION) {
    // Hold phase: show current color, no crossfade
    const texName = getTextureName(currentIndex, night);
    const tex = sheet.textures[texName];
    if (tex && qfront.texture !== tex) {
      qfront.texture = tex;
    }
    qfront.alpha = 1;

    // Clean up any leftover next sprite
    if (nextSprite) {
      nextSprite.destroy();
      nextSprite = null;
    }
  } else if (elapsed < CYCLE_DURATION) {
    // Fade phase: crossfade to next color
    const fadeProgress = (elapsed - HOLD_DURATION) / FADE_DURATION;
    const nextIndex = (currentIndex + 1) % SCREEN_SUFFIXES.length;

    // Ensure current sprite has correct texture
    const curTexName = getTextureName(currentIndex, night);
    const curTex = sheet.textures[curTexName];
    if (curTex && qfront.texture !== curTex) {
      qfront.texture = curTex;
    }

    // Create or update next sprite overlay
    if (!nextSprite) {
      const nextTexName = getTextureName(nextIndex, night);
      const nextTex = sheet.textures[nextTexName];
      if (nextTex) {
        nextSprite = new Sprite(nextTex);
        nextSprite.x = qfront.x;
        nextSprite.y = qfront.y;
        nextSprite.alpha = 0;
        // Add next sprite right after qfront in the same parent
        const parent = qfront.parent;
        if (parent) {
          const idx = parent.children.indexOf(qfront);
          parent.addChildAt(nextSprite, idx + 1);
        }
      }
    }

    if (nextSprite) {
      nextSprite.alpha = fadeProgress;
    }
  } else {
    // Cycle complete: advance to next color
    currentIndex = (currentIndex + 1) % SCREEN_SUFFIXES.length;
    elapsed = 0;

    // Swap: set qfront to the new current texture, remove overlay
    const texName = getTextureName(currentIndex, night);
    const tex = sheet.textures[texName];
    if (tex) {
      qfront.texture = tex;
    }
    qfront.alpha = 1;

    if (nextSprite) {
      nextSprite.destroy();
      nextSprite = null;
    }
  }

  // Update glow strip
  if (glowStrip) {
    const glowColors = night ? GLOW_COLORS_NIGHT : GLOW_COLORS_DAY;
    const glowColor = glowColors[currentIndex];
    const glowAlpha = night ? 0.5 : 0.35;
    const glowHeight = night ? 3 : 2;

    glowStrip.clear();
    glowStrip.rect(qfront.x, BLDG_BOTTOM, 80, glowHeight);
    glowStrip.fill({ color: glowColor, alpha: glowAlpha });
  }
}
