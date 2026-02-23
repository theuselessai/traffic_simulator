// Sweetie 16 base palette (by GrafxKid) + 8 extended colors
// Bright, warm, cohesive — inspired by Celeste / Stardew Valley / Tiny Tower

export const PALETTE = {
  // ── Sweetie 16 core ──
  DARK_NAVY:    "#1a1c2c", // outlines, shadows, darkest
  DEEP_PURPLE:  "#5d275d", // accent
  CRIMSON:      "#b13e53", // brake lights, awnings
  WARM_ORANGE:  "#ef7d57", // taxi, delivery box, construction
  GOLDEN:       "#ffcd75", // headlights, highlights, window glow
  LIME:         "#a7f070", // go signals, walk figure
  FOREST_GREEN: "#38b764", // Starbucks, buses, trees
  TEAL:         "#257179", // glass, windshields
  ROYAL_BLUE:   "#29366f", // sedan blue, night sky
  BRIGHT_BLUE:  "#3b5dc9", // uniforms, accents
  SKY_BLUE:     "#41a6f6", // daytime glass, sky
  CYAN:         "#73eff7", // screen glow, highlights
  NEAR_WHITE:   "#f4f4f4", // crossings, shirts, white car
  COOL_GREY:    "#94b0c2", // concrete sidewalk
  SLATE:        "#566c86", // building facades
  CHARCOAL:     "#333c57", // dark buildings, asphalt

  // ── Extended: skin tones ──
  SKIN_LIGHT:   "#f2d3ab",
  SKIN_MEDIUM:  "#c69c6d",
  SKIN_TAN:     "#9a6348",
  SKIN_DARK:    "#5a3a29",

  // ── Extended: signals & special ──
  SIGNAL_RED:   "#e83b3b",
  SIGNAL_YELLOW:"#f7e476",
  NEON_CYAN:    "#2ce8f5",
  PURE_WHITE:   "#ffffff",

  // ── Semantic aliases (mapped to Sweetie 16 colors) ──

  // Road & infrastructure
  ROAD_DARK:    "#333c57", // CHARCOAL
  ROAD_MID:     "#566c86", // SLATE  (brighter than before!)
  LANE_MARKING: "#f4f4f4", // NEAR_WHITE
  ZEBRA_WHITE:  "#ffffff", // PURE_WHITE
  SIDEWALK:     "#94b0c2", // COOL_GREY
  CURB:         "#566c86", // SLATE

  // Vehicles
  CAR_RED:      "#b13e53", // CRIMSON
  CAR_BLUE:     "#29366f", // ROYAL_BLUE
  CAR_WHITE:    "#f4f4f4", // NEAR_WHITE
  CAR_BLACK:    "#1a1c2c", // DARK_NAVY
  TAXI_BODY:    "#ef7d57", // WARM_ORANGE
  TAXI_SIGN:    "#38b764", // FOREST_GREEN
  BUS_BODY:     "#38b764", // FOREST_GREEN
  KEI_TRUCK:    "#3b5dc9", // BRIGHT_BLUE
  POLICE:       "#f4f4f4", // NEAR_WHITE
  HEADLIGHT:    "#ffcd75", // GOLDEN
  TAILLIGHT:    "#b13e53", // CRIMSON
  WINDSHIELD:   "#41a6f6", // SKY_BLUE
  WHEEL:        "#1a1c2c", // DARK_NAVY

  // Pedestrian clothing
  SUIT_DARK:    "#29366f", // ROYAL_BLUE (dark suit)
  SUIT_GREY:    "#566c86", // SLATE
  SHIRT_WHITE:  "#f4f4f4", // NEAR_WHITE
  SKIRT_NAVY:   "#5d275d", // DEEP_PURPLE
  STUDENT_NAVY: "#3b5dc9", // BRIGHT_BLUE
  TOURIST_TOP:  "#b13e53", // CRIMSON
  TOURIST_PACK: "#3b5dc9", // BRIGHT_BLUE
  TOURIST_BOTTOM:"#257179",// TEAL
  ELDERLY_TOP:  "#c69c6d", // SKIN_MEDIUM
  ELDERLY_BOT:  "#9a6348", // SKIN_TAN
  HAIR_DARK:    "#1a1c2c", // DARK_NAVY
  HAIR_GOLDEN:  "#ffcd75", // GOLDEN
  HAIR_GREY:    "#94b0c2", // COOL_GREY
  SHOES:        "#1a1c2c", // DARK_NAVY

  // Traffic signals
  SIGNAL_POST:  "#566c86", // SLATE
  SIGNAL_OFF:   "#333c57", // CHARCOAL
  WALK_GREEN:   "#a7f070", // LIME
  STOP_RED:     "#e83b3b", // SIGNAL_RED
  FLASH_DIM:    "#257179", // TEAL (dimmed walk)

  // Buildings
  BLDG_109_MAIN:"#b13e53", // CRIMSON (pink-ish)
  BLDG_109_DARK:"#5d275d", // DEEP_PURPLE
  SBUX_GREEN:   "#38b764", // FOREST_GREEN
  SBUX_WALL:    "#f4f4f4", // NEAR_WHITE
  QFRONT_WALL:  "#566c86", // SLATE
  QFRONT_SCREEN:"#3b5dc9", // BRIGHT_BLUE
  QFRONT_GLOW:  "#2ce8f5", // NEON_CYAN
  STATION_WALL: "#9a6348", // SKIN_TAN (warm brown)
  STATION_ROOF: "#5a3a29", // SKIN_DARK (dark brown)
  STORE_WALL_A: "#c69c6d", // SKIN_MEDIUM (warm beige)
  STORE_WALL_B: "#94b0c2", // COOL_GREY
  AWNING_A:     "#b13e53", // CRIMSON
  AWNING_B:     "#3b5dc9", // BRIGHT_BLUE
  WINDOW_DARK:  "#1a1c2c", // DARK_NAVY
  WINDOW_GLOW:  "#ffcd75", // GOLDEN

  // Cyclist
  BIKE_FRAME:   "#566c86", // SLATE
  BIKE_WHEEL:   "#333c57", // CHARCOAL
  DELIVERY_BOX: "#ef7d57", // WARM_ORANGE
} as const;

export type PaletteKey = keyof typeof PALETTE;
