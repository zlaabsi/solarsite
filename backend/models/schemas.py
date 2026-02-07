from __future__ import annotations
from typing import Any, Dict, List, Literal, Optional, Tuple
from pydantic import BaseModel, Field


class PolygonGeoJSON(BaseModel):
    type: Literal["Polygon"]
    coordinates: List[List[Tuple[float, float]]]


class AnalyzeRequest(BaseModel):
    latitude: float
    longitude: float
    polygon_geojson: PolygonGeoJSON
    panel_tilt_deg: float = 25
    panel_azimuth_deg: float = 180
    row_spacing_m: float = 3.0
    module_width_m: float = 1.134
    module_height_m: float = 2.278
    module_power_wc: float = 550
    system_loss_pct: float = 14
    albedo: float = 0.3


class SiteInfo(BaseModel):
    latitude: float
    longitude: float
    altitude_m: float
    timezone: str
    polygon_area_m2: float
    terrain_classification: str


class LayoutInfo(BaseModel):
    panels_geojson: Dict[str, Any]
    n_panels: int
    n_rows: int
    row_spacing_m: float
    total_module_area_m2: float
    ground_coverage_ratio: float


class SolarData(BaseModel):
    annual_ghi_kwh_m2: float
    annual_dni_kwh_m2: float
    optimal_tilt_deg: float
    avg_temp_c: float
    avg_wind_speed_ms: float


class ShadowAnalysis(BaseModel):
    annual_shadow_loss_pct: float
    winter_solstice_shadow_loss_pct: float
    summer_solstice_shadow_loss_pct: float
    shadow_matrix: str
    optimal_spacing_m: float
    shadow_timestamps: List[str]


class HeatmapSeason(BaseModel):
    grid: List[List[float]]
    bounds: Dict[str, float]
    resolution_m: float


class Heatmaps(BaseModel):
    summer: HeatmapSeason
    winter: HeatmapSeason


class YieldInfo(BaseModel):
    installed_capacity_kwc: float
    installed_capacity_mwc: float
    annual_yield_kwh: float
    specific_yield_kwh_kwp: float
    performance_ratio: float
    lcoe_eur_mwh: float
    co2_avoided_tons_yr: float


class AnalyzeResponse(BaseModel):
    site_info: SiteInfo
    layout: LayoutInfo
    solar_data: SolarData
    shadow_analysis: ShadowAnalysis
    heatmaps: Heatmaps
    yield_info: YieldInfo


class AnalyzeImageResponse(BaseModel):
    terrain_type: str
    obstacles: List[Dict[str, Any]]
    vegetation_coverage_pct: float
    access_roads: List[Dict[str, Any]]
    slope_estimate_deg: float
    soil_assessment: str
    recommendations: str


class Generate3DRequest(BaseModel):
    latitude: float
    longitude: float
    n_panels: int
    render_type: Literal["test", "demo"] = "test"


class Generate3DResponse(BaseModel):
    render_image_url: str
    model_glb_url: str
    thumbnail_url: str
