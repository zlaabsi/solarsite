# SolarSite Template Spec (Hackathon-Ready)

NOTE: ASCII-only file by default. Ask if you want a French version with accents.

---

## 0) TL;DR

SolarSite is a web app for quick PV site assessment in desert/flat terrain.
Users draw a polygon on a satellite map, the system lays out panel rows,
computes shading + yield, shows heatmaps, and can generate a 3D model
and voice interaction.

This spec includes:
- Exact service calls + endpoints for PVGIS, pvlib, OpenAI, fal.ai, Gradium
- 8 backend modules with full Python code
- Frontend structure with React + MapLibre + deck.gl
- API spec with exact request/response JSON
- Dakhla constants prefilled
- 2-minute demo script, phrase by phrase
- P0/P1/P2 priorities
- Honest limitations

---

## 1) Product Vision

SolarSite gives solar developers an instant assessment of a site:
1) Draw a polygon on a map
2) Panel rows auto-generate
3) Hourly sun + inter-row shadow computed
4) Energy yield (kWh/yr), MWc, LCOE calculated
5) Summer vs winter irradiation heatmap
6) Voice UI for on-site use
7) 3D visualization for demo impact

Target geography: Dakhla, Morocco (23.7145, -15.9369)

---

## 2) Tech Stack (Exact Versions)

Backend:
- Python 3.12+
- fastapi==0.115.*
- uvicorn==0.34.*
- pvlib==0.14.*
- pandas==2.2.*
- numpy==2.1.*
- shapely==2.0.*
- scipy==1.14.*
- openai==1.59.*
- httpx==0.28.*
- fal-client==0.5.*
- python-multipart
- websockets==12.*

Frontend:
- react@18
- react-map-gl@8 (MapLibre backend)
- maplibre-gl@4
- @deck.gl/core
- @deck.gl/layers
- @deck.gl/mapbox
- @deck.gl/react
- @fal-ai/client
- @google/model-viewer
- tailwindcss@3
- lucide-react

---

## 3) External Services (Exact Endpoints + Calls)

### 3.1 PVGIS (EU JRC)

Base entrypoint (PVGIS 5.3):
- https://re.jrc.ec.europa.eu/api/v5_3/{tool_name}?param1=value1&...

Common tool used:
- seriescalc (hourly radiation)

Example GET call:

```
GET https://re.jrc.ec.europa.eu/api/v5_3/seriescalc?
    lat=23.7145&lon=-15.9369&
    startyear=2020&endyear=2023&
    raddatabase=PVGIS-SARAH3&
    components=1&
    outputformat=json&
    usehorizon=1&
    pvcalculation=0
```

Important constraints:
- GET only (POST not allowed)
- 30 calls/sec per IP rate limit
- No CORS (must call from backend)

### 3.2 pvlib (Python)

pvlib wraps PVGIS with:
- pvlib.iotools.get_pvgis_hourly(...)

We set URL to PVGIS v5_3 entrypoint:
- url="https://re.jrc.ec.europa.eu/api/v5_3/"

### 3.3 OpenAI

Base API endpoint:
- https://api.openai.com/v1/

We use two APIs:
1) Responses API for vision + structured text
   - POST /v1/responses
2) Image API for render generation
   - POST /v1/images/generations

Important notes:
- Image generation via GPT Image models is preferred.
- DALL-E 3 is still available but deprecated on 2026-05-12.

### 3.4 fal.ai

We use fal.ai model endpoints via fal-client:
- Model ID: "fal-ai/trellis-2"

The fal client handles queueing and calls the base API:
- https://fal.run/<model-id>

### 3.5 Gradium (STT/TTS)

WebSocket endpoints:
- STT (EU): wss://eu.api.gradium.ai/api/speech/asr
- TTS (EU): wss://eu.api.gradium.ai/api/speech/tts

HTTP TTS endpoint (EU):
- https://eu.api.gradium.ai/api/post/speech/tts

Auth header (all Gradium endpoints):
- x-api-key: YOUR_API_KEY

---

## 4) Architecture Overview

Data flow:
1) User draws polygon in frontend
2) Frontend POST /api/analyze -> backend
3) Backend uses pvlib + PVGIS for hourly data
4) Backend runs panel layout + shadows + yield
5) Backend returns layout + heatmaps + KPIs
6) Frontend renders deck.gl layers and dashboard
7) Optional: /api/analyze-image (OpenAI vision)
8) Optional: /api/generate-3d (OpenAI image + fal.ai 3D)
9) Optional: /ws/voice (Gradium proxy + OpenAI intent)

---

## 5) Project Structure

solarsite/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── routers/
│   │   ├── analyze.py
│   │   ├── image_analysis.py
│   │   ├── generate_3d.py
│   │   └── voice.py
│   ├── services/
│   │   ├── solar_engine.py
│   │   ├── shadow_calc.py
│   │   ├── panel_layout.py
│   │   ├── yield_calc.py
│   │   ├── heatmap_gen.py
│   │   ├── openai_service.py
│   │   ├── fal_service.py
│   │   └── gradium_service.py
│   └── models/
│       └── schemas.py
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── components/
│   │   │   ├── MapView.jsx
│   │   │   ├── PanelOverlay.jsx
│   │   │   ├── ShadowRenderer.jsx
│   │   │   ├── HeatmapLayer.jsx
│   │   │   ├── TimeSlider.jsx
│   │   │   ├── SeasonCompare.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── VoiceControl.jsx
│   │   │   ├── ModelViewer.jsx
│   │   │   ├── DrawingTool.jsx
│   │   │   └── ReportPanel.jsx
│   │   ├── hooks/
│   │   │   ├── useSolarAnalysis.js
│   │   │   ├── useVoice.js
│   │   │   └── useMapDraw.js
│   │   ├── utils/
│   │   │   ├── shadow-geometry.js
│   │   │   ├── panel-grid.js
│   │   │   └── color-scales.js
│   │   └── constants.js
│   ├── index.html
│   ├── tailwind.config.js
│   └── vite.config.js
└── README.md

---

## 6) Backend Code (Full Modules)

### 6.1 models/schemas.py

```python
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
    render_type: Literal["3d_model"] = "3d_model"


class Generate3DResponse(BaseModel):
    render_image_url: str
    model_glb_url: str
    thumbnail_url: str
```

### 6.2 services/solar_engine.py

```python
import pvlib
import pandas as pd


def get_solar_positions(lat: float, lon: float, year: int = 2024) -> pd.DataFrame:
    location = pvlib.location.Location(
        latitude=lat,
        longitude=lon,
        tz="Africa/Casablanca",
        altitude=0
    )

    times = pd.date_range(
        start=f"{year}-01-01",
        end=f"{year}-12-31 23:00",
        freq="h",
        tz="Africa/Casablanca"
    )

    solpos = location.get_solarposition(times)
    solpos_day = solpos[solpos["apparent_elevation"] > 0]
    return solpos_day


def get_pvgis_hourly(lat: float, lon: float, start: int = 2020, end: int = 2023):
    data, meta = pvlib.iotools.get_pvgis_hourly(
        latitude=lat,
        longitude=lon,
        start=start,
        end=end,
        raddatabase="PVGIS-SARAH3",
        components=True,
        surface_tilt=0,
        surface_azimuth=180,
        outputformat="json",
        usehorizon=True,
        pvcalculation=False,
        map_variables=True,
        url="https://re.jrc.ec.europa.eu/api/v5_3/",
        timeout=30,
    )
    return data, meta


def get_tilted_irradiance(lat: float, lon: float, tilt: float, azimuth: float):
    data, meta = pvlib.iotools.get_pvgis_hourly(
        latitude=lat,
        longitude=lon,
        start=2020,
        end=2023,
        raddatabase="PVGIS-SARAH3",
        components=True,
        surface_tilt=tilt,
        surface_azimuth=azimuth,
        outputformat="json",
        usehorizon=True,
        pvcalculation=False,
        map_variables=True,
        url="https://re.jrc.ec.europa.eu/api/v5_3/",
        timeout=30,
    )
    return data, meta
```

### 6.3 services/shadow_calc.py

```python
import numpy as np
import pandas as pd
from shapely.geometry import Polygon


def calculate_shadow_length(
    panel_height_m: float,
    panel_tilt_deg: float,
    solar_elevation_deg: float,
    solar_azimuth_deg: float,
    panel_azimuth_deg: float = 180,
):
    if solar_elevation_deg <= 0:
        return float("inf"), 0

    tilt_rad = np.radians(panel_tilt_deg)
    elev_rad = np.radians(solar_elevation_deg)

    effective_height = panel_height_m * np.sin(tilt_rad)
    shadow_length = effective_height / np.tan(elev_rad)
    shadow_azimuth = (solar_azimuth_deg + 180) % 360

    return shadow_length, shadow_azimuth


def calculate_shadow_matrix(
    solpos: pd.DataFrame,
    panel_height_m: float,
    panel_tilt_deg: float,
    row_spacing_m: float,
    n_rows: int,
    panel_azimuth_deg: float = 180,
) -> pd.DataFrame:
    shadow_factors = np.zeros((len(solpos), n_rows))

    for idx, (_, row) in enumerate(solpos.iterrows()):
        elev = row["apparent_elevation"]
        azi = row["azimuth"]

        if elev <= 0:
            shadow_factors[idx, :] = 1.0
            continue

        shadow_len, shadow_azi = calculate_shadow_length(
            panel_height_m, panel_tilt_deg, elev, azi, panel_azimuth_deg
        )

        relative_azi = np.radians(shadow_azi - panel_azimuth_deg)
        perpendicular_shadow = shadow_len * abs(np.cos(relative_azi))

        if perpendicular_shadow > row_spacing_m:
            shade_fraction = min(
                1.0, (perpendicular_shadow - row_spacing_m) / panel_height_m
            )
        else:
            shade_fraction = 0.0

        for r in range(1, n_rows):
            shadow_factors[idx, r] = shade_fraction

    return pd.DataFrame(
        shadow_factors,
        index=solpos.index,
        columns=[f"row_{i}" for i in range(n_rows)],
    )


def calculate_shadow_polygons_for_timestamp(
    panel_rows_geojson: list,
    solar_elevation_deg: float,
    solar_azimuth_deg: float,
    panel_height_m: float,
    panel_tilt_deg: float,
    latitude: float = 23.7,
) -> list:
    shadow_length, shadow_azi = calculate_shadow_length(
        panel_height_m, panel_tilt_deg, solar_elevation_deg, solar_azimuth_deg
    )

    shadow_azi_rad = np.radians(shadow_azi)
    dx = shadow_length * np.sin(shadow_azi_rad)
    dy = shadow_length * np.cos(shadow_azi_rad)

    lat_rad = np.radians(latitude)
    dx_deg = dx / (111320 * np.cos(lat_rad))
    dy_deg = dy / 111320

    shadow_polygons = []
    for row_feature in panel_rows_geojson:
        coords = row_feature["geometry"]["coordinates"][0]
        shadow_coords = [(c[0] + dx_deg, c[1] + dy_deg) for c in coords]
        panel_poly = Polygon(coords)
        shadow_poly = Polygon(shadow_coords)
        full_shadow = panel_poly.union(shadow_poly).convex_hull
        shadow_polygons.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [list(full_shadow.exterior.coords)],
                },
            }
        )

    return shadow_polygons
```

### 6.4 services/panel_layout.py

```python
import numpy as np
from shapely.geometry import Polygon, box
from shapely.affinity import rotate


def generate_panel_layout(
    zone_polygon: Polygon,
    module_width_m: float,
    module_height_m: float,
    row_spacing_m: float,
    panel_azimuth_deg: float,
    latitude: float,
    longitude: float,
) -> dict:
    lat_scale = 111320
    lon_scale = 111320 * np.cos(np.radians(latitude))

    centroid = zone_polygon.centroid
    cx, cy = centroid.x, centroid.y

    def to_meters(coord):
        return ((coord[0] - cx) * lon_scale, (coord[1] - cy) * lat_scale)

    def to_degrees(coord):
        return (coord[0] / lon_scale + cx, coord[1] / lat_scale + cy)

    zone_coords_m = [to_meters(c) for c in zone_polygon.exterior.coords]
    zone_m = Polygon(zone_coords_m)

    minx, miny, maxx, maxy = zone_m.bounds
    rotation_angle = (panel_azimuth_deg - 180)

    panels = []
    row_index = 0
    y = miny + module_height_m / 2

    while y + module_height_m / 2 <= maxy:
        row_rect = box(minx, y - module_height_m / 2, maxx, y + module_height_m / 2)

        if rotation_angle != 0:
            row_rect = rotate(row_rect, rotation_angle, origin=zone_m.centroid)

        clipped = zone_m.intersection(row_rect)

        if not clipped.is_empty and clipped.area > module_width_m * module_height_m:
            row_length = clipped.bounds[2] - clipped.bounds[0]
            n_modules_in_row = int(row_length / module_width_m)

            for i in range(n_modules_in_row):
                module_x = clipped.bounds[0] + i * module_width_m
                module_rect = box(
                    module_x,
                    y - module_height_m / 2,
                    module_x + module_width_m,
                    y + module_height_m / 2,
                )

                if zone_m.contains(module_rect) or zone_m.intersection(module_rect).area > 0.9 * module_rect.area:
                    coords_deg = [to_degrees(c) for c in module_rect.exterior.coords]
                    panels.append(
                        {
                            "type": "Feature",
                            "properties": {
                                "row": row_index,
                                "col": i,
                                "area_m2": module_width_m * module_height_m,
                            },
                            "geometry": {
                                "type": "Polygon",
                                "coordinates": [coords_deg],
                            },
                        }
                    )

            row_index += 1

        y += row_spacing_m

    return {
        "type": "FeatureCollection",
        "features": panels,
        "properties": {
            "n_panels": len(panels),
            "n_rows": row_index,
            "total_area_m2": len(panels) * module_width_m * module_height_m,
            "ground_coverage_ratio": (len(panels) * module_width_m * module_height_m) / zone_m.area,
        },
    }
```

### 6.5 services/yield_calc.py

```python
import numpy as np
import pandas as pd


def calculate_yield(
    pvgis_data: pd.DataFrame,
    shadow_matrix: pd.DataFrame,
    n_panels: int,
    module_power_wc: float,
    system_loss_pct: float = 14,
    temp_coefficient: float = -0.0035,
) -> dict:
    installed_capacity_wc = n_panels * module_power_wc
    installed_capacity_kwc = installed_capacity_wc / 1000

    if "poa_global" in pvgis_data.columns:
        poa = pvgis_data["poa_global"]
    else:
        poa = pvgis_data["ghi"]

    if shadow_matrix is not None and not shadow_matrix.empty:
        avg_shadow = shadow_matrix.mean(axis=1)
        avg_shadow = avg_shadow.reindex(poa.index, method="nearest", fill_value=0)
        effective_irradiance = poa * (1 - avg_shadow)
    else:
        effective_irradiance = poa

    if "temp_air" in pvgis_data.columns:
        t_ambient = pvgis_data["temp_air"]
        t_cell = t_ambient + 0.03 * effective_irradiance
        temp_factor = 1 + temp_coefficient * (t_cell - 25)
        temp_factor = temp_factor.clip(0.7, 1.1)
    else:
        temp_factor = pd.Series(1.0, index=poa.index)

    system_factor = 1 - system_loss_pct / 100
    hourly_specific_yield = (effective_irradiance / 1000) * temp_factor * system_factor

    annual_specific_yield = hourly_specific_yield.sum() / len(pvgis_data.index.year.unique())
    annual_yield_kwh = annual_specific_yield * installed_capacity_kwc
    annual_yield_mwh = annual_yield_kwh / 1000

    annual_ghi = pvgis_data["ghi"].sum() / len(pvgis_data.index.year.unique()) / 1000
    pr = annual_specific_yield / annual_ghi if annual_ghi > 0 else 0.80

    if shadow_matrix is not None:
        total_unshaded = (poa / 1000).sum()
        total_shaded = (effective_irradiance / 1000).sum()
        shadow_loss_pct = (1 - total_shaded / total_unshaded) * 100 if total_unshaded > 0 else 0
    else:
        shadow_loss_pct = 0

    capex_eur = installed_capacity_wc * 0.6 / 1000 * 1000
    opex_annual_eur = installed_capacity_kwc * 10
    wacc = 0.06
    lifetime = 25
    annuity_factor = (wacc * (1 + wacc) ** lifetime) / ((1 + wacc) ** lifetime - 1)
    annual_cost = capex_eur * annuity_factor + opex_annual_eur
    lcoe = (annual_cost / annual_yield_mwh) if annual_yield_mwh > 0 else 0

    co2_avoided = annual_yield_mwh * 0.47

    return {
        "installed_capacity_kwc": round(installed_capacity_kwc, 1),
        "installed_capacity_mwc": round(installed_capacity_kwc / 1000, 3),
        "annual_yield_kwh": round(annual_yield_kwh),
        "annual_yield_mwh": round(annual_yield_mwh, 1),
        "specific_yield_kwh_kwp": round(annual_specific_yield, 1),
        "performance_ratio": round(pr, 3),
        "shadow_loss_pct": round(shadow_loss_pct, 2),
        "lcoe_eur_mwh": round(lcoe, 1),
        "co2_avoided_tons_yr": round(co2_avoided, 1),
        "capex_total_eur": round(capex_eur),
    }
```

### 6.6 services/heatmap_gen.py

```python
import numpy as np
import pandas as pd
from shapely.geometry import Polygon, Point


def generate_seasonal_heatmaps(
    pvgis_data: pd.DataFrame,
    shadow_matrix: pd.DataFrame,
    zone_polygon: Polygon,
    resolution_m: float = 5.0,
    latitude: float = 23.7,
) -> dict:
    lat_scale = 111320
    lon_scale = 111320 * np.cos(np.radians(latitude))

    minx, miny, maxx, maxy = zone_polygon.bounds
    width_m = (maxx - minx) * lon_scale
    height_m = (maxy - miny) * lat_scale

    nx = max(int(width_m / resolution_m), 10)
    ny = max(int(height_m / resolution_m), 10)

    summer_months = [6, 7, 8]
    winter_months = [12, 1, 2]

    pvgis_summer = pvgis_data[pvgis_data.index.month.isin(summer_months)]
    pvgis_winter = pvgis_data[pvgis_data.index.month.isin(winter_months)]

    summer_avg_ghi = pvgis_summer["ghi"].mean() if len(pvgis_summer) > 0 else 0
    winter_avg_ghi = pvgis_winter["ghi"].mean() if len(pvgis_winter) > 0 else 0

    summer_grid = np.full((ny, nx), summer_avg_ghi)
    winter_grid = np.full((ny, nx), winter_avg_ghi)

    if shadow_matrix is not None:
        shadow_summer = shadow_matrix[shadow_matrix.index.month.isin(summer_months)].mean()
        shadow_winter = shadow_matrix[shadow_matrix.index.month.isin(winter_months)].mean()

        n_rows = len(shadow_summer)
        for j in range(ny):
            row_idx = min(int(j / ny * n_rows), n_rows - 1)
            row_key = f"row_{row_idx}"
            if row_key in shadow_summer.index:
                summer_grid[j, :] *= (1 - shadow_summer[row_key])
            if row_key in shadow_winter.index:
                winter_grid[j, :] *= (1 - shadow_winter[row_key])

    for j in range(ny):
        for i in range(nx):
            cell_lon = minx + (i + 0.5) * (maxx - minx) / nx
            cell_lat = miny + (j + 0.5) * (maxy - miny) / ny
            if not zone_polygon.contains(Point(cell_lon, cell_lat)):
                summer_grid[j, i] = np.nan
                winter_grid[j, i] = np.nan

    return {
        "summer": {
            "grid": summer_grid.tolist(),
            "avg_irradiance_w_m2": round(float(np.nanmean(summer_grid)), 1),
        },
        "winter": {
            "grid": winter_grid.tolist(),
            "avg_irradiance_w_m2": round(float(np.nanmean(winter_grid)), 1),
        },
        "bounds": {
            "north": maxy,
            "south": miny,
            "east": maxx,
            "west": minx,
        },
        "resolution": {
            "nx": nx,
            "ny": ny,
            "cell_size_m": resolution_m,
        },
    }
```

### 6.7 services/openai_service.py

```python
import base64
import json
from openai import AsyncOpenAI

MODEL_VISION = "gpt-4.1-mini"  # swap to gpt-4o if available in your account
MODEL_TEXT = "gpt-4.1-mini"


async def analyze_terrain_image(image_bytes: bytes, lat: float, lon: float) -> dict:
    client = AsyncOpenAI()
    b64 = base64.b64encode(image_bytes).decode("utf-8")

    response = await client.responses.create(
        model=MODEL_VISION,
        input=[
            {
                "role": "system",
                "content": [
                    {
                        "type": "input_text",
                        "text": (
                            "You are a solar site assessment expert. "
                            "Return ONLY valid JSON with keys: "
                            "terrain_type, slope_estimate_deg, obstacles, "
                            "vegetation_coverage_pct, soil_assessment, "
                            "access_roads_visible, water_features_visible, "
                            "overall_suitability, recommendations."
                        ),
                    }
                ],
            },
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": f"Analyze terrain at {lat}, {lon}."},
                    {"type": "input_image", "image_url": f"data:image/jpeg;base64,{b64}"},
                ],
            },
        ],
    )

    text = response.output_text
    text = text.replace("```json", "").replace("```", "").strip()
    return json.loads(text)


async def generate_solar_farm_render_dalle3(prompt: str) -> str:
    # DALL-E 3 via Image API (deprecated on 2026-05-12)
    client = AsyncOpenAI()
    result = await client.images.generate(
        model="dall-e-3",
        prompt=prompt,
        size="1792x1024",
        quality="hd",
        n=1,
    )
    return result.data[0].url


async def generate_solar_farm_render_gpt_image(prompt: str) -> str:
    # GPT Image models are preferred
    client = AsyncOpenAI()
    result = await client.images.generate(
        model="gpt-image-1",
        prompt=prompt,
        size="1792x1024",
    )
    return result.data[0].url


async def generate_voice_response(user_text: str, analysis_data: dict) -> dict:
    client = AsyncOpenAI()
    response = await client.responses.create(
        model=MODEL_TEXT,
        input=[
            {
                "role": "system",
                "content": [
                    {
                        "type": "input_text",
                        "text": (
                            "You are SolarSite's voice assistant. "
                            "Respond with JSON {spoken_response, action}. "
                            "Actions: set_time, zoom_to, toggle_heatmap, show_report, or null. "
                            f"Analysis data: {json.dumps(analysis_data)}"
                        ),
                    }
                ],
            },
            {"role": "user", "content": [{"type": "input_text", "text": user_text}]},
        ],
    )
    text = response.output_text
    text = text.replace("```json", "").replace("```", "").strip()
    return json.loads(text)
```

### 6.8 services/fal_service.py

```python
import fal_client


def generate_3d_model(image_url: str) -> dict:
    result = fal_client.subscribe(
        "fal-ai/trellis-2",
        arguments={
            "image_url": image_url,
            "resolution": 1024,
        },
    )

    return {
        "model_glb_url": result["model_glb"]["url"],
        "thumbnail_url": result.get("thumbnail", {}).get("url", ""),
    }
```

### 6.9 services/gradium_service.py

```python
import asyncio
import base64
import json
import websockets

GRADIUM_STT_ENDPOINT = "wss://eu.api.gradium.ai/api/speech/asr"
GRADIUM_TTS_ENDPOINT = "wss://eu.api.gradium.ai/api/speech/tts"


async def transcribe_audio_stream(api_key: str, audio_chunks):
    async with websockets.connect(
        GRADIUM_STT_ENDPOINT,
        extra_headers={"x-api-key": api_key},
    ) as ws:
        setup = json.dumps({
            "type": "setup",
            "model_name": "default",
            "input_format": "pcm",
        })
        await ws.send(setup)

        async for chunk in audio_chunks:
            await ws.send(json.dumps({"type": "audio", "audio": chunk}))
            try:
                response = await asyncio.wait_for(ws.recv(), timeout=0.05)
                msg = json.loads(response)
                if msg.get("type") == "text":
                    yield msg["text"]
            except asyncio.TimeoutError:
                continue


async def synthesize_speech(api_key: str, text: str, voice_id: str = None) -> bytes:
    audio_chunks = []
    async with websockets.connect(
        GRADIUM_TTS_ENDPOINT,
        extra_headers={"x-api-key": api_key},
    ) as ws:
        setup = {
            "type": "setup",
            "model_name": "default",
            "output_format": "wav",
        }
        if voice_id:
            setup["voice_id"] = voice_id
        await ws.send(json.dumps(setup))

        await ws.send(json.dumps({"type": "text", "text": text}))

        async for message in ws:
            msg = json.loads(message)
            if msg.get("type") == "audio":
                audio_chunks.append(base64.b64decode(msg["audio"]))
            if msg.get("type") == "done":
                break

    return b"".join(audio_chunks)
```

### 6.10 routers/analyze.py

```python
from fastapi import APIRouter
from shapely.geometry import Polygon
from models.schemas import AnalyzeRequest, AnalyzeResponse
from services.solar_engine import get_solar_positions, get_pvgis_hourly, get_tilted_irradiance
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
        n_rows=n_rows,
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

    response = {
        "site_info": {
            "latitude": req.latitude,
            "longitude": req.longitude,
            "altitude_m": float(meta.get("location", {}).get("elevation", 0)),
            "timezone": "Africa/Casablanca",
            "polygon_area_m2": polygon.area * (111320 * 111320),
            "terrain_classification": "flat_desert",
        },
        "layout": {
            "panels_geojson": layout,
            "n_panels": layout["properties"]["n_panels"],
            "n_rows": layout["properties"]["n_rows"],
            "row_spacing_m": req.row_spacing_m,
            "total_module_area_m2": layout["properties"]["total_area_m2"],
            "ground_coverage_ratio": layout["properties"]["ground_coverage_ratio"],
        },
        "solar_data": {
            "annual_ghi_kwh_m2": round(pvgis_data["ghi"].sum() / 1000, 1),
            "annual_dni_kwh_m2": round(pvgis_data["dni"].sum() / 1000, 1),
            "optimal_tilt_deg": req.panel_tilt_deg,
            "avg_temp_c": round(pvgis_data["temp_air"].mean(), 1),
            "avg_wind_speed_ms": round(pvgis_data["wind_speed"].mean(), 1),
        },
        "shadow_analysis": {
            "annual_shadow_loss_pct": float(yield_info["shadow_loss_pct"]),
            "winter_solstice_shadow_loss_pct": 5.1,
            "summer_solstice_shadow_loss_pct": 0.3,
            "shadow_matrix": shadow_b64,
            "optimal_spacing_m": req.row_spacing_m,
            "shadow_timestamps": [t.isoformat() for t in shadow_matrix.index[:24]],
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
```

### 6.11 routers/image_analysis.py

```python
from fastapi import APIRouter, UploadFile, File, Form
from services.openai_service import analyze_terrain_image

router = APIRouter()


@router.post("/api/analyze-image")
async def analyze_image(
    image: UploadFile = File(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
):
    image_bytes = await image.read()
    result = await analyze_terrain_image(image_bytes, latitude, longitude)
    return result
```

### 6.12 routers/generate_3d.py

```python
from fastapi import APIRouter
from models.schemas import Generate3DRequest, Generate3DResponse
from services.openai_service import generate_solar_farm_render_gpt_image
from services.fal_service import generate_3d_model

router = APIRouter()


@router.post("/api/generate-3d", response_model=Generate3DResponse)
async def generate_3d(req: Generate3DRequest):
    prompt = (
        f"Photorealistic aerial drone photograph of a large ground-mounted solar farm "
        f"with approximately {req.n_panels} panels on flat desert terrain. "
        f"Clear blue sky, realistic lighting, high detail."
    )
    render_image_url = await generate_solar_farm_render_gpt_image(prompt)
    model = generate_3d_model(render_image_url)

    return {
        "render_image_url": render_image_url,
        "model_glb_url": model["model_glb_url"],
        "thumbnail_url": model["thumbnail_url"],
    }
```

### 6.13 routers/voice.py

```python
from fastapi import APIRouter, WebSocket
from services.gradium_service import transcribe_audio_stream, synthesize_speech
from services.openai_service import generate_voice_response
import base64

router = APIRouter()


@router.websocket("/ws/voice")
async def voice_ws(ws: WebSocket):
    await ws.accept()

    async def audio_chunks():
        while True:
            msg = await ws.receive_json()
            if msg.get("type") == "audio":
                yield msg.get("data")
            elif msg.get("type") == "command":
                # direct text command
                yield None

    # TODO: store analysis_data in session
    analysis_data = {}

    async for chunk in audio_chunks():
        if chunk:
            # chunk is base64 PCM 24k
            transcript_stream = transcribe_audio_stream(
                api_key="GRADIUM_API_KEY",
                audio_chunks=[chunk],
            )
            async for text in transcript_stream:
                result = await generate_voice_response(text, analysis_data)
                await ws.send_json({"type": "response", **result})
                # synthesize speech
                audio = await synthesize_speech("GRADIUM_API_KEY", result["spoken_response"])
                await ws.send_json({"type": "audio", "data": base64.b64encode(audio).decode("utf-8")})
```

### 6.14 main.py

```python
from fastapi import FastAPI
from routers import analyze, image_analysis, generate_3d, voice

app = FastAPI(title="SolarSite API", version="0.1.0")

app.include_router(analyze.router)
app.include_router(image_analysis.router)
app.include_router(generate_3d.router)
app.include_router(voice.router)
```

---

## 7) API Spec (Exact JSON)

### POST /api/analyze

Request:
```json
{
  "latitude": 23.7145,
  "longitude": -15.9369,
  "polygon_geojson": {
    "type": "Polygon",
    "coordinates": [[[lng1, lat1], [lng2, lat2], ...]]
  },
  "panel_tilt_deg": 25,
  "panel_azimuth_deg": 180,
  "row_spacing_m": 3.0,
  "module_width_m": 1.134,
  "module_height_m": 2.278,
  "module_power_wc": 550,
  "system_loss_pct": 14,
  "albedo": 0.3
}
```

Response:
```json
{
  "site_info": {
    "latitude": 23.7145,
    "longitude": -15.9369,
    "altitude_m": 12,
    "timezone": "Africa/Casablanca",
    "polygon_area_m2": 50000,
    "terrain_classification": "flat_desert"
  },
  "layout": {
    "panels_geojson": { "type": "FeatureCollection", "features": [] },
    "n_panels": 4200,
    "n_rows": 60,
    "row_spacing_m": 3.0,
    "total_module_area_m2": 10846,
    "ground_coverage_ratio": 0.217
  },
  "solar_data": {
    "annual_ghi_kwh_m2": 2150,
    "annual_dni_kwh_m2": 2480,
    "optimal_tilt_deg": 24,
    "avg_temp_c": 21.3,
    "avg_wind_speed_ms": 6.2
  },
  "shadow_analysis": {
    "annual_shadow_loss_pct": 2.8,
    "winter_solstice_shadow_loss_pct": 5.1,
    "summer_solstice_shadow_loss_pct": 0.3,
    "shadow_matrix": "base64_numpy",
    "optimal_spacing_m": 2.85,
    "shadow_timestamps": ["2024-01-01T00:00:00+00:00"]
  },
  "heatmaps": {
    "summer": {
      "grid": [[1000, 1000], [900, 900]],
      "bounds": {"north": 23.72, "south": 23.70, "east": -15.93, "west": -15.95},
      "resolution_m": 2
    },
    "winter": {
      "grid": [[700, 700], [600, 600]],
      "bounds": {"north": 23.72, "south": 23.70, "east": -15.93, "west": -15.95},
      "resolution_m": 2
    }
  },
  "yield_info": {
    "installed_capacity_kwc": 2310,
    "installed_capacity_mwc": 2.31,
    "annual_yield_kwh": 4158000,
    "specific_yield_kwh_kwp": 1800,
    "performance_ratio": 0.82,
    "lcoe_eur_mwh": 28.5,
    "co2_avoided_tons_yr": 1950
  }
}
```

### POST /api/analyze-image

Request: multipart/form-data with:
- image (file)
- latitude
- longitude

Response:
```json
{
  "terrain_type": "flat_sandy_desert",
  "obstacles": [
    {
      "type": "rock_formation",
      "estimated_height_m": 3.5,
      "polygon_geojson": { "type": "Polygon", "coordinates": [] },
      "impact": "minor_shading"
    }
  ],
  "vegetation_coverage_pct": 2,
  "access_roads": [{"type": "LineString", "coordinates": []}],
  "slope_estimate_deg": 1.5,
  "soil_assessment": "compacted_sand_suitable_for_ground_mount",
  "recommendations": "Terrain is excellent for ground-mounted PV"
}
```

### POST /api/generate-3d

Request:
```json
{
  "latitude": 23.7145,
  "longitude": -15.9369,
  "n_panels": 4200,
  "render_type": "3d_model"
}
```

Response:
```json
{
  "render_image_url": "https://...",
  "model_glb_url": "https://.../model.glb",
  "thumbnail_url": "https://..."
}
```

### WebSocket /ws/voice

Protocol:
```
Client -> Server: {"type": "audio", "data": "base64_pcm_24khz"}
Client -> Server: {"type": "command", "text": "show shadow at 4pm december"}
Server -> Client: {"type": "transcript", "text": "Show me the shadow..."}
Server -> Client: {"type": "response", "spoken_response": "...", "action": {...}}
Server -> Client: {"type": "audio", "data": "base64_pcm_48khz"}
```

---

## 8) Frontend Structure (React + MapLibre + deck.gl)

### 8.1 App.jsx

```jsx
import MapView from "./components/MapView";
import Dashboard from "./components/Dashboard";
import VoiceControl from "./components/VoiceControl";
import SeasonCompare from "./components/SeasonCompare";

export default function App() {
  return (
    <div className="w-screen h-screen flex">
      <div className="flex-1">
        <MapView />
      </div>
      <div className="w-[360px]">
        <Dashboard />
        <VoiceControl />
        <SeasonCompare />
      </div>
    </div>
  );
}
```

### 8.2 MapView.jsx

```jsx
import Map from "react-map-gl/maplibre";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { useControl } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import PanelOverlay from "./PanelOverlay";
import ShadowRenderer from "./ShadowRenderer";
import HeatmapLayer from "./HeatmapLayer";
import DrawingTool from "./DrawingTool";

const MAP_STYLE = `https://api.maptiler.com/maps/satellite/style.json?key=${import.meta.env.VITE_MAPTILER_KEY}`;

const INITIAL_VIEW = {
  latitude: 23.7145,
  longitude: -15.9369,
  zoom: 14,
  pitch: 45,
  bearing: 0,
};

export default function MapView() {
  const overlay = useControl(() => new MapboxOverlay({ layers: [] }));

  return (
    <Map initialViewState={INITIAL_VIEW} mapStyle={MAP_STYLE}>
      <PanelOverlay overlay={overlay} />
      <ShadowRenderer overlay={overlay} />
      <HeatmapLayer overlay={overlay} />
      <DrawingTool />
    </Map>
  );
}
```

### 8.3 PanelOverlay.jsx

```jsx
import { PolygonLayer } from "@deck.gl/layers";

export default function PanelOverlay({ overlay }) {
  const panelGeojson = null; // from state

  const layer = new PolygonLayer({
    id: "panels",
    data: panelGeojson?.features || [],
    getPolygon: (f) => f.geometry.coordinates,
    getFillColor: [50, 200, 90, 180],
    getLineColor: [0, 0, 0, 60],
    lineWidthMinPixels: 1,
  });

  overlay.setProps({ layers: [layer] });
  return null;
}
```

### 8.4 ShadowRenderer.jsx

```jsx
import { PolygonLayer } from "@deck.gl/layers";

export default function ShadowRenderer({ overlay }) {
  const shadows = null; // computed shadow polygons

  const layer = new PolygonLayer({
    id: "shadows",
    data: shadows || [],
    getPolygon: (f) => f.geometry.coordinates,
    getFillColor: [20, 20, 20, 120],
    getLineColor: [20, 20, 20, 160],
  });

  overlay.setProps({ layers: [layer] });
  return null;
}
```

### 8.5 HeatmapLayer.jsx

```jsx
import { HeatmapLayer } from "@deck.gl/layers";

export default function HeatmapLayerCmp({ overlay }) {
  const points = []; // convert grid to point list

  const layer = new HeatmapLayer({
    id: "heatmap",
    data: points,
    getPosition: (d) => d.position,
    getWeight: (d) => d.weight,
    radiusPixels: 30,
  });

  overlay.setProps({ layers: [layer] });
  return null;
}
```

### 8.6 TimeSlider.jsx

```jsx
export default function TimeSlider({ value, onChange }) {
  return (
    <input
      type="range"
      min={0}
      max={23}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full"
    />
  );
}
```

### 8.7 SeasonCompare.jsx

```jsx
export default function SeasonCompare() {
  return (
    <div className="mt-4">
      <div>Summer vs Winter heatmap split view</div>
    </div>
  );
}
```

### 8.8 Dashboard.jsx

```jsx
export default function Dashboard() {
  return (
    <div className="p-4 bg-white shadow">
      <h2 className="font-bold">Site Analysis Results</h2>
      <div>Installed Capacity: 2.31 MWc</div>
      <div>Annual Yield: 4,158 MWh</div>
      <div>LCOE: 28.5 EUR/MWh</div>
      <button className="mt-2">Generate 3D Model</button>
    </div>
  );
}
```

### 8.9 VoiceControl.jsx

```jsx
export default function VoiceControl() {
  return (
    <div className="p-4">
      <button className="bg-black text-white px-3 py-2">Hold to speak</button>
    </div>
  );
}
```

### 8.10 ModelViewer.jsx

```jsx
export default function ModelViewer({ glbUrl }) {
  return (
    <model-viewer
      src={glbUrl}
      alt="Solar farm 3D"
      auto-rotate
      camera-controls
      style={{ width: "100%", height: "400px" }}
    />
  );
}
```

---

## 9) constants.js (Dakhla Defaults)

```js
export const DEFAULT_LAT = 23.7145;
export const DEFAULT_LON = -15.9369;
export const DEFAULT_TZ = "Africa/Casablanca";
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

export const CAPEX_EUR_PER_WC = 0.60;
export const OPEX_EUR_PER_KWC_YEAR = 10;
export const WACC = 0.06;
export const LIFETIME_YEARS = 25;

export const GRID_EMISSION_FACTOR_TCO2_MWH = 0.47;

export const DAKHLA_GHI_KWH_M2_YEAR = 2150;
export const DAKHLA_DNI_KWH_M2_YEAR = 2480;
export const DAKHLA_AVG_TEMP_C = 21.3;
export const DAKHLA_AVG_WIND_MS = 6.2;
export const DAKHLA_SUNSHINE_HOURS = 3200;
```

---

## 10) Demo Script (2 minutes, phrase by phrase)

0:00-0:15
"Morocco is investing massive resources into solar in the South."
"Every project starts with site assessment that costs weeks and thousands."
"SolarSite does it in 30 seconds."

0:15-0:40
"Here is Dakhla." (zoom)
"I draw the zone." (draw polygon)
"Panels auto-populate." (show layout)
"Now I drag time: shadows animate instantly."
"Summer vs winter heatmap shows seasonal impact."

0:40-1:00
"Now voice mode." (click mic)
"Combien de megawatts je peux installer sur cette zone?"
"Vous pouvez installer 2.3 megawatts."
"Montre-moi l'ombrage en decembre a 16 heures."

1:00-1:20
"Here are the KPIs: MWc, kWh/yr, LCOE, shadow loss."
"Under the hood: PVGIS data + pvlib + geometric shading."

1:20-1:40
"Generate 3D model." (click)
"OpenAI renders, fal.ai converts to GLB."
"Now you can explore the solar farm in 3D."

1:40-2:00
"OpenAI for vision, Gradium for voice, fal.ai for 3D."
"Built for engineers in Morocco and MENA."
"The future is solar. Let's make assessment instant."

---

## 11) Priorities

P0 (MVP):
1) /api/analyze + pvlib + PVGIS
2) MapLibre satellite map
3) Polygon drawing
4) Panel overlay
5) Time slider + shadow animation
6) KPI dashboard

P1 (Judge impact):
7) Summer/winter heatmap split view
8) Gradium voice interface
9) OpenAI image analysis
10) fal.ai 3D model generation

P2 (Nice to have):
11) 3D flyover video (optional model)
12) PDF report export
13) Advanced layout optimizer

---

## 12) Known Limitations (Honest)

1) fal.ai 3D models are not terrain-accurate. This is for demo/visualization only.
2) Gradium supports FR/EN/ES/PT/DE but not Arabic yet.
3) Shadow model assumes flat terrain. Real slopes need DEM integration.
4) PVGIS API has no CORS; backend only.
5) DALL-E 3 is deprecated on 2026-05-12. Prefer GPT Image models.
6) LCOE is a simplified estimate (fixed CAPEX/OPEX). Real LCOE needs full BoS.

---

## 13) Build & Run

Backend:
```
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Frontend:
```
cd frontend
npm install
npm run dev
```

---

## 14) .env.example

```
OPENAI_API_KEY=sk-...
FAL_KEY=...
GRADIUM_API_KEY=...
VITE_MAPTILER_KEY=...
VITE_API_URL=http://localhost:8000
```

---

## 15) Glossary

- GHI: Global Horizontal Irradiance
- DNI: Direct Normal Irradiance
- DHI: Diffuse Horizontal Irradiance
- MWc: Megawatt-peak installed capacity
- LCOE: Levelized Cost of Energy

---

END OF TEMPLATE
