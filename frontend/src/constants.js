export const DEFAULT_LAT = 23.7145;
export const DEFAULT_LON = -15.9369;
export const DEFAULT_ALTITUDE_M = 12;

export const DEFAULT_MODULE_WIDTH_M = 1.134;
export const DEFAULT_MODULE_HEIGHT_M = 2.278;
export const DEFAULT_MODULE_POWER_WC = 550;
export const DEFAULT_MODULE_EFFICIENCY = 0.213;

export const DEFAULT_PANEL_TILT_DEG = 25;
export const DEFAULT_PANEL_AZIMUTH_DEG = 180;
export const DEFAULT_ROW_SPACING_M = 3.0;
export const DEFAULT_SYSTEM_LOSS_PCT = 14;
export const DEFAULT_ALBEDO = 0.3;

export const CAPEX_EUR_PER_WC = 0.6;
export const OPEX_EUR_PER_KWC_YEAR = 10;
export const WACC = 0.06;
export const LIFETIME_YEARS = 25;

export const GRID_EMISSION_FACTOR_TCO2_MWH = 0.47;

export const FALLBACK_GHI_KWH_M2_YEAR = 2150;
export const FALLBACK_SUNSHINE_HOURS = 3200;

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
export const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY || "";
