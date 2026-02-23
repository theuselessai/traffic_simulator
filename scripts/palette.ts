// 32-color shared palette for Shibuya Crossing pixel art
// "Tiny Tower" style - limited palette for cohesive look

export const PALETTE = {
  // Road & infrastructure
  ROAD_DARK: "#2a2a2a",
  ROAD_MID: "#3d3d3d",
  ROAD_LIGHT: "#555555",
  LANE_MARKING: "#cccccc",
  ZEBRA_WHITE: "#e8e8e8",
  SIDEWALK: "#8a8a7a",
  CURB: "#6b6b5c",

  // Vehicles
  CAR_RED: "#c03030",
  CAR_BLUE: "#3050a0",
  CAR_WHITE: "#d8d8d0",
  CAR_BLACK: "#1a1a1a",
  TAXI_YELLOW: "#e8c020",
  TAXI_GREEN: "#007040",
  BUS_GREEN: "#208040",
  BUS_RED: "#b02020",
  KEI_TRUCK_BLUE: "#4070b0",
  POLICE_BW: "#e0e0e0",
  HEADLIGHT: "#ffeeaa",
  TAILLIGHT: "#ff3030",

  // Skin tones
  SKIN_LIGHT: "#f0c8a0",
  SKIN_MID: "#d4a878",
  SKIN_DARK: "#a07850",

  // Pedestrian clothing
  SUIT_DARK: "#2c2c3a",
  SUIT_GREY: "#606068",
  SHIRT_WHITE: "#e8e8e0",
  SKIRT_NAVY: "#283048",
  STUDENT_NAVY: "#1c2840",
  TOURIST_RED: "#d04040",
  TOURIST_BLUE: "#4060c0",
  ELDERLY_BROWN: "#8b7355",

  // Traffic signals
  SIGNAL_POST: "#484848",
  SIGNAL_RED: "#ff2020",
  SIGNAL_YELLOW: "#ffcc00",
  SIGNAL_GREEN: "#20dd40",
  SIGNAL_OFF: "#333333",
  WALK_GREEN: "#20ee60",
  STOP_RED: "#ff1010",

  // Buildings
  BLDG_109_PINK: "#d070a0",
  BLDG_109_DARK: "#a05078",
  STARBUCKS_GREEN: "#00704a",
  STARBUCKS_WALL: "#e8dcc8",
  QFRONT_GREY: "#707078",
  QFRONT_SCREEN: "#3040a0",
  QFRONT_SCREEN_GLOW: "#5060d0",
  STATION_BROWN: "#786050",
  STATION_ROOF: "#504038",
  STOREFRONT_A: "#c8b090",
  STOREFRONT_B: "#a08868",
  WINDOW_DARK: "#181828",
  WINDOW_GLOW: "#ffdd66",
  AWNING: "#c04040",

  // Cyclist
  BIKE_FRAME: "#404040",
  BIKE_WHEEL: "#333333",
  DELIVERY_BOX: "#d08020",
} as const;

export type PaletteKey = keyof typeof PALETTE;
