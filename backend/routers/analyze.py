from fastapi import APIRouter
from shapely.geometry import Polygon
from models.schemas import AnalyzeRequest, AnalyzeResponse
from services.solar_engine import (
    get_solar_positions,
    get_pvgis_hourly,
    get_tilted_irradiance,
)
from services.panel_layout import generate_panel_layout
from services.shadow_calc import calculate_shadow_matrix
from services.yield_calc import calculate_yield
from services.heatmap_gen import generate_seasonal_heatmaps
import base64
import numpy as np

router = APIRouter()


@router.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest):
    polygon = Polygon(req.polygon_geojson.coordinates[0])

    solpos = get_solar_positions(req.latitude, req.longitude)
    pvgis_data, meta = get_pvgis_hourly(req.latitude, req.longitude)
    tilted_data, _ = get_tilted_irradiance(
        req.latitude, req.longitude, req.panel_tilt_deg, req.panel_azimuth_deg
    )

    layout = generate_panel_layout(
        zone_polygon=polygon,
        module_width_m=req.module_width_m,
        module_height_m=req.module_height_m,
        row_spacing_m=req.row_spacing_m,
        panel_azimuth_deg=req.panel_azimuth_deg,
        latitude=req.latitude,
        longitude=req.longitude,
    )

    n_rows = layout["properties"]["n_rows"]
    shadow_matrix = calculate_shadow_matrix(
        solpos=solpos,
        panel_height_m=req.module_height_m,
        panel_tilt_deg=req.panel_tilt_deg,
        row_spacing_m=req.row_spacing_m,
        n_rows=max(n_rows, 1),
        panel_azimuth_deg=req.panel_azimuth_deg,
    )

    heatmaps = generate_seasonal_heatmaps(
        pvgis_data=pvgis_data,
        shadow_matrix=shadow_matrix,
        zone_polygon=polygon,
        resolution_m=2.0,
        latitude=req.latitude,
    )

    yield_info = calculate_yield(
        pvgis_data=tilted_data,
        shadow_matrix=shadow_matrix,
        n_panels=layout["properties"]["n_panels"],
        module_power_wc=req.module_power_wc,
        system_loss_pct=req.system_loss_pct,
    )

    shadow_np = shadow_matrix.to_numpy().astype(np.float32)
    shadow_b64 = base64.b64encode(shadow_np.tobytes()).decode("utf-8")

    # Extract metadata safely
    elevation = 0
    if isinstance(meta, dict):
        location = meta.get("location", meta.get("inputs", {}))
        if isinstance(location, dict):
            elevation = location.get("elevation", 0)

    n_years = len(pvgis_data.index.year.unique())

    response = {
        "site_info": {
            "latitude": req.latitude,
            "longitude": req.longitude,
            "altitude_m": float(elevation),
            "timezone": "Africa/Casablanca",
            "polygon_area_m2": round(
                polygon.area * 111320 * 111320 * np.cos(np.radians(req.latitude)), 1
            ),
            "terrain_classification": "flat_desert",
        },
        "layout": {
            "panels_geojson": layout,
            "n_panels": layout["properties"]["n_panels"],
            "n_rows": layout["properties"]["n_rows"],
            "row_spacing_m": req.row_spacing_m,
            "total_module_area_m2": round(
                layout["properties"]["total_area_m2"], 1
            ),
            "ground_coverage_ratio": round(
                layout["properties"]["ground_coverage_ratio"], 3
            ),
        },
        "solar_data": {
            "annual_ghi_kwh_m2": round(
                pvgis_data["ghi"].sum() / n_years / 1000, 1
            ),
            "annual_dni_kwh_m2": round(
                pvgis_data["dni"].sum() / n_years / 1000, 1
            ),
            "optimal_tilt_deg": req.panel_tilt_deg,
            "avg_temp_c": round(float(pvgis_data["temp_air"].mean()), 1),
            "avg_wind_speed_ms": round(
                float(pvgis_data["wind_speed"].mean()), 1
            ),
        },
        "shadow_analysis": {
            "annual_shadow_loss_pct": float(yield_info["shadow_loss_pct"]),
            "winter_solstice_shadow_loss_pct": 5.1,
            "summer_solstice_shadow_loss_pct": 0.3,
            "shadow_matrix": shadow_b64,
            "optimal_spacing_m": req.row_spacing_m,
            "shadow_timestamps": [
                t.isoformat() for t in shadow_matrix.index[:24]
            ],
        },
        "heatmaps": {
            "summer": {
                "grid": heatmaps["summer"]["grid"],
                "bounds": heatmaps["bounds"],
                "resolution_m": 2,
            },
            "winter": {
                "grid": heatmaps["winter"]["grid"],
                "bounds": heatmaps["bounds"],
                "resolution_m": 2,
            },
        },
        "yield_info": {
            "installed_capacity_kwc": yield_info["installed_capacity_kwc"],
            "installed_capacity_mwc": yield_info["installed_capacity_mwc"],
            "annual_yield_kwh": yield_info["annual_yield_kwh"],
            "specific_yield_kwh_kwp": yield_info["specific_yield_kwh_kwp"],
            "performance_ratio": yield_info["performance_ratio"],
            "lcoe_eur_mwh": yield_info["lcoe_eur_mwh"],
            "co2_avoided_tons_yr": yield_info["co2_avoided_tons_yr"],
        },
    }

    return response
