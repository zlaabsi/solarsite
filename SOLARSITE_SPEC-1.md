# SolarSite — AI-Powered Solar Farm Site Assessment

## Project Context

**Hackathon**: {Tech: Europe} Paris AI Hackathon, February 2026
**Location**: NeonNoir, 14 Rue le Peletier, 75009 Paris
**Deadline**: Sunday 14:00
**Requirements**: Minimum 3 partner technologies, max 5-person team, 2-min video demo + public GitHub repo
**Partners used**: fal.ai, Gradium, OpenAI (+ Lovable optional for initial scaffold)

**Side challenges targeted**:
- Best use of fal ($1000 credits)
- Best use of Dify (€500 cash) — optional if time permits

---

## Product Vision

SolarSite is a web application that lets solar project developers assess ground-mounted photovoltaic farm sites interactively. The user uploads a satellite or drone image of a desert/plain terrain, draws an implantation zone on a map, and the tool automatically:

1. Places solar panel rows optimally within the zone
2. Simulates sun trajectory and inter-row shading for every hour of the year
3. Generates an irradiation heatmap (summer vs winter comparison)
4. Calculates energy yield (kWh/year), installed capacity (MWc), and LCOE (€/MWh)
5. Provides a voice-interactive interface for on-site use (Gradium STT/TTS)
6. Generates a 3D visualization/flyover of the completed project (fal.ai)

**Target users**: Solar EPC companies, project developers (MASEN, ACWA Power), site assessment engineers
**Target geography**: Dakhla, Morocco (23.7°N, -15.9°W) — desert terrain, ground-mounted utility-scale

---

## Tech Stack — Exact Versions

### Backend (Python)

```
Python 3.12+
fastapi==0.115.*
uvicorn==0.34.*
pvlib==0.14.0            # Industry-standard solar modeling library
pandas==2.2.*
numpy==2.1.*
shapely==2.0.*           # Geometric operations (polygons, panel placement)
scipy==1.14.*
openai==1.59.*           # GPT-4o Vision + DALL-E
httpx==0.28.*            # Async HTTP client
fal-client==0.5.*        # fal.ai API
python-multipart         # File uploads in FastAPI
```

### Frontend (React)

```
react@18
react-map-gl@8           # React wrapper for MapLibre
maplibre-gl@4             # Open-source map renderer (fork of Mapbox GL JS)
@deck.gl/core             # GPU-accelerated geospatial layers
@deck.gl/layers           # PolygonLayer, HeatmapLayer, ScatterplotLayer
@deck.gl/mapbox           # MapboxOverlay for MapLibre integration
@deck.gl/react            # React bindings
@fal-ai/client            # fal.ai client SDK
@google/model-viewer      # 3D GLB viewer in browser
tailwindcss@3             # Styling
lucide-react              # Icons
```

### External APIs (all confirmed available, Feb 2026)

| Service | Endpoint | Auth | Free Tier | Data |
|---------|----------|------|-----------|------|
| PVGIS v5.3 | `https://re.jrc.ec.europa.eu/api/v5_3/` | None | Unlimited | GHI, DNI, DHI, temp, wind (hourly, multi-year) |
| Open-Topo-Data | `https://api.opentopodata.org/v1/srtm30m` | None | 1 req/sec | Elevation SRTM 30m resolution |
| MapTiler | `https://api.maptiler.com/tiles/satellite-v2/` | API key | 100K req/month | Satellite imagery tiles |
| OpenAI | `https://api.openai.com/v1/` | API key | Paid | GPT-4o Vision, DALL-E 3 |
| fal.ai | `https://fal.run/` | API key | Hackathon credits | Trellis 2 (image→3D), video generation |
| Gradium | `wss://eu.api.gradium.ai/api/speech/` | API key | Hackathon credits | STT streaming + TTS streaming |

---

## Project Structure

```
solarsite/
├── backend/
│   ├── main.py                    # FastAPI app entry point
│   ├── requirements.txt
│   ├── routers/
│   │   ├── analyze.py             # POST /api/analyze — main solar calculation
│   │   ├── image_analysis.py      # POST /api/analyze-image — OpenAI Vision
│   │   ├── generate_3d.py         # POST /api/generate-3d — fal.ai 3D/video
│   │   └── voice.py               # WebSocket /ws/voice — Gradium proxy
│   ├── services/
│   │   ├── solar_engine.py        # pvlib calculations (position, irradiation)
│   │   ├── shadow_calc.py         # Inter-row shading geometry
│   │   ├── panel_layout.py        # Panel placement algorithm on polygon
│   │   ├── yield_calc.py          # Energy yield, LCOE calculation
│   │   ├── heatmap_gen.py         # Summer/winter heatmap generation
│   │   ├── openai_service.py      # GPT-4o Vision + DALL-E wrapper
│   │   ├── fal_service.py         # fal.ai Trellis 2 + video wrapper
│   │   └── gradium_service.py     # Gradium STT/TTS WebSocket handler
│   └── models/
│       └── schemas.py             # Pydantic models for API I/O
│
├── frontend/
│   ├── package.json
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── components/
│   │   │   ├── MapView.jsx        # MapLibre + deck.gl map with satellite tiles
│   │   │   ├── PanelOverlay.jsx   # deck.gl PolygonLayer for solar panels
│   │   │   ├── ShadowRenderer.jsx # Shadow polygons animated by time slider
│   │   │   ├── HeatmapLayer.jsx   # deck.gl HeatmapLayer for irradiation
│   │   │   ├── TimeSlider.jsx     # Hour/date slider controlling shadow animation
│   │   │   ├── SeasonCompare.jsx  # Split view summer vs winter heatmaps
│   │   │   ├── Dashboard.jsx      # KPIs: MWc, kWh/yr, LCOE, shadow loss %
│   │   │   ├── VoiceControl.jsx   # Gradium STT/TTS WebSocket + mic UI
│   │   │   ├── ModelViewer.jsx    # 3D GLB viewer (model-viewer web component)
│   │   │   ├── DrawingTool.jsx    # Polygon drawing tool on map
│   │   │   └── ReportPanel.jsx    # Generated report display
│   │   ├── hooks/
│   │   │   ├── useSolarAnalysis.js   # API call + state management
│   │   │   ├── useVoice.js           # Gradium WebSocket + AudioWorklet
│   │   │   └── useMapDraw.js         # Polygon drawing state
│   │   ├── utils/
│   │   │   ├── shadow-geometry.js    # Client-side shadow polygon generation
│   │   │   ├── panel-grid.js         # Client-side panel grid preview
│   │   │   └── color-scales.js       # Irradiation color ramp (blue→red)
│   │   └── constants.js              # Default values, Dakhla coords, etc.
│   ├── index.html
│   ├── tailwind.config.js
│   └── vite.config.js
│
├── README.md
└── .env.example
```

---

## API Specification

### POST `/api/analyze`

Main endpoint. Performs complete solar site analysis.

**Request:**
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

**Response:**
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
    "panels_geojson": { "type": "FeatureCollection", "features": [...] },
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
    "shadow_matrix": "base64_encoded_numpy_array",
    "optimal_spacing_m": 2.85,
    "shadow_timestamps": ["2024-01-01T00:00:00", ...]
  },
  "heatmaps": {
    "summer": {
      "grid": [[irradiance_w_m2, ...], ...],
      "bounds": {"north": lat, "south": lat, "east": lng, "west": lng},
      "resolution_m": 2
    },
    "winter": {
      "grid": [[irradiance_w_m2, ...], ...],
      "bounds": {"north": lat, "south": lat, "east": lng, "west": lng},
      "resolution_m": 2
    }
  },
  "yield": {
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

### POST `/api/analyze-image`

Analyzes uploaded satellite/drone image using OpenAI GPT-4o Vision.

**Request:** `multipart/form-data` with `image` file + `latitude`, `longitude`

**Response:**
```json
{
  "terrain_type": "flat_sandy_desert",
  "obstacles": [
    {
      "type": "rock_formation",
      "estimated_height_m": 3.5,
      "polygon_geojson": { "type": "Polygon", "coordinates": [...] },
      "impact": "minor_shading"
    }
  ],
  "vegetation_coverage_pct": 2,
  "access_roads": [
    { "type": "LineString", "coordinates": [...] }
  ],
  "slope_estimate_deg": 1.5,
  "soil_assessment": "compacted_sand_suitable_for_ground_mount",
  "recommendations": "Terrain is excellent for ground-mounted PV..."
}
```

### POST `/api/generate-3d`

Generates 3D visualization of the solar farm project.

**Request:**
```json
{
  "latitude": 23.7145,
  "longitude": -15.9369,
  "n_panels": 4200,
  "render_type": "3d_model"
}
```

**Pipeline:**
1. OpenAI DALL-E 3 generates a photorealistic aerial render of the solar farm on desert terrain
2. fal.ai Trellis 2 converts the render into a 3D GLB mesh
3. Returns GLB URL for frontend model-viewer

**Response:**
```json
{
  "render_image_url": "https://...",
  "model_glb_url": "https://v3b.fal.media/files/.../model.glb",
  "thumbnail_url": "https://..."
}
```

### WebSocket `/ws/voice`

Proxies Gradium STT/TTS for the voice interface.

**Protocol:**
```
Client → Server: { "type": "audio", "data": "base64_pcm_24khz" }
Client → Server: { "type": "command", "text": "show shadow at 4pm december" }
Server → Client: { "type": "transcript", "text": "Show me the shadow..." }
Server → Client: { "type": "response", "text": "Here is the shadow...", "action": {...} }
Server → Client: { "type": "audio", "data": "base64_pcm_48khz" }
```

---

## Core Algorithms — Implementation Details

### 1. Solar Position Calculation (solar_engine.py)

Uses pvlib's NREL SPA algorithm (accuracy ±0.0003°). This is the industry standard.

```python
import pvlib
import pandas as pd
import numpy as np

def get_solar_positions(lat: float, lon: float, year: int = 2024) -> pd.DataFrame:
    """
    Calculate solar position for every hour of the year.
    Returns DataFrame with columns: apparent_elevation, azimuth, apparent_zenith
    """
    location = pvlib.location.Location(
        latitude=lat,
        longitude=lon,
        tz='Africa/Casablanca',
        altitude=0  # Will be overridden by Open-Topo-Data if available
    )

    # Generate hourly timestamps for full year
    times = pd.date_range(
        start=f'{year}-01-01',
        end=f'{year}-12-31 23:00',
        freq='h',
        tz='Africa/Casablanca'
    )

    # Calculate solar position using NREL SPA (default, recommended)
    solpos = location.get_solarposition(times)
    # Columns: apparent_zenith, zenith, apparent_elevation, elevation, azimuth, equation_of_time

    # Filter to daylight hours only (elevation > 0)
    solpos_day = solpos[solpos['apparent_elevation'] > 0]

    return solpos_day


def get_pvgis_data(lat: float, lon: float) -> tuple[pd.DataFrame, dict]:
    """
    Fetch hourly irradiation data from PVGIS v5.3 via pvlib.
    Returns (data_df, metadata_dict)

    DataFrame columns (mapped names):
    - ghi: Global Horizontal Irradiance (W/m²)
    - dni: Direct Normal Irradiance (W/m²)
    - dhi: Diffuse Horizontal Irradiance (W/m²)
    - temp_air: Air temperature at 2m (°C)
    - wind_speed: Wind speed at 10m (m/s)
    - solar_elevation: Sun height (degrees)
    """
    data, meta = pvlib.iotools.get_pvgis_hourly(
        latitude=lat,
        longitude=lon,
        start=2020,
        end=2023,
        raddatabase='PVGIS-SARAH2',  # Best for Africa/Europe
        components=True,              # Get beam, diffuse, reflected
        surface_tilt=0,               # Horizontal for GHI
        surface_azimuth=180,          # South-facing (pvlib convention)
        outputformat='json',
        usehorizon=True,              # Include horizon effects
        pvcalculation=False,
        map_variables=True,           # Map to pvlib standard names
        timeout=30
    )

    return data, meta


def get_tilted_irradiance(
    lat: float, lon: float,
    surface_tilt: float, surface_azimuth: float
) -> pd.DataFrame:
    """
    Get irradiance on a tilted surface (the actual panel plane).
    Uses PVGIS with specific tilt and azimuth.
    """
    data, meta = pvlib.iotools.get_pvgis_hourly(
        latitude=lat,
        longitude=lon,
        start=2020,
        end=2023,
        raddatabase='PVGIS-SARAH2',
        components=True,
        surface_tilt=surface_tilt,
        surface_azimuth=surface_azimuth,
        outputformat='json',
        usehorizon=True,
        map_variables=True,
        timeout=30
    )

    return data
```

### 2. Inter-Row Shadow Calculation (shadow_calc.py)

The core differentiator. For flat terrain, shading is purely geometric between rows.

```python
import numpy as np
import pandas as pd
from shapely.geometry import Polygon, box, MultiPolygon
from shapely.affinity import translate, rotate


def calculate_shadow_length(
    panel_height_m: float,
    panel_tilt_deg: float,
    solar_elevation_deg: float,
    solar_azimuth_deg: float,
    panel_azimuth_deg: float = 180  # South-facing
) -> tuple[float, float]:
    """
    Calculate shadow length and direction cast by a tilted panel row.

    Returns:
        shadow_length_m: Length of shadow on ground (meters)
        shadow_azimuth_deg: Direction of shadow (degrees from North)

    The effective height is the vertical projection of the tilted panel:
        h_eff = panel_height × sin(tilt)

    The shadow length on a flat surface:
        L_shadow = h_eff / tan(solar_elevation)

    The shadow falls OPPOSITE to the sun's azimuth.
    """
    if solar_elevation_deg <= 0:
        return float('inf'), 0  # No sun = infinite shadow

    tilt_rad = np.radians(panel_tilt_deg)
    elev_rad = np.radians(solar_elevation_deg)

    # Effective height of tilted panel above ground
    effective_height = panel_height_m * np.sin(tilt_rad)

    # Shadow length
    shadow_length = effective_height / np.tan(elev_rad)

    # Shadow falls opposite to sun direction
    shadow_azimuth = (solar_azimuth_deg + 180) % 360

    return shadow_length, shadow_azimuth


def calculate_shadow_matrix(
    solpos: pd.DataFrame,
    panel_height_m: float,
    panel_tilt_deg: float,
    row_spacing_m: float,
    n_rows: int,
    panel_azimuth_deg: float = 180
) -> pd.DataFrame:
    """
    Calculate shadow factor for each row at each hour of the year.

    Returns DataFrame with shape (n_daylight_hours, n_rows)
    Values: 0.0 = full sun, 1.0 = fully shaded

    The shadow from row i affects row i+1 (the row behind).
    A row is shaded when the shadow length > row spacing adjusted
    for the azimuth angle (component perpendicular to rows).
    """
    shadow_factors = np.zeros((len(solpos), n_rows))

    for idx, (timestamp, row) in enumerate(solpos.iterrows()):
        elev = row['apparent_elevation']
        azi = row['azimuth']

        if elev <= 0:
            shadow_factors[idx, :] = 1.0  # Full shadow (night)
            continue

        shadow_len, shadow_azi = calculate_shadow_length(
            panel_height_m, panel_tilt_deg, elev, azi, panel_azimuth_deg
        )

        # Component of shadow perpendicular to panel rows
        # Rows are perpendicular to panel_azimuth
        relative_azi = np.radians(shadow_azi - panel_azimuth_deg)
        perpendicular_shadow = shadow_len * np.abs(np.cos(relative_azi))

        # Each row i casts shadow on row i+1
        # Fraction of next row that is shaded
        if perpendicular_shadow > row_spacing_m:
            shade_fraction = min(1.0,
                (perpendicular_shadow - row_spacing_m) / panel_height_m
            )
        else:
            shade_fraction = 0.0

        # Row 0 (front) never shaded by other rows
        # Row 1+ can be shaded by the row in front
        for r in range(1, n_rows):
            shadow_factors[idx, r] = shade_fraction

    result = pd.DataFrame(
        shadow_factors,
        index=solpos.index,
        columns=[f'row_{i}' for i in range(n_rows)]
    )

    return result


def calculate_shadow_polygons_for_timestamp(
    panel_rows_geojson: list,
    solar_elevation_deg: float,
    solar_azimuth_deg: float,
    panel_height_m: float,
    panel_tilt_deg: float
) -> list:
    """
    Generate shadow polygons for each panel row at a specific timestamp.
    Used by the frontend to render shadow shapes on the map.

    Each panel row is a rectangle. Its shadow is a parallelogram
    projected on the ground in the direction opposite to the sun.
    """
    shadow_length, shadow_azi = calculate_shadow_length(
        panel_height_m, panel_tilt_deg,
        solar_elevation_deg, solar_azimuth_deg
    )

    # Convert shadow direction to dx, dy offset in meters
    shadow_azi_rad = np.radians(shadow_azi)
    dx = shadow_length * np.sin(shadow_azi_rad)
    dy = shadow_length * np.cos(shadow_azi_rad)

    # Convert meters to approximate degrees at this latitude (Dakhla ~23.7°N)
    # 1 degree latitude ≈ 111,320 m
    # 1 degree longitude ≈ 111,320 * cos(lat) m
    lat_rad = np.radians(23.7)
    dx_deg = dx / (111320 * np.cos(lat_rad))
    dy_deg = dy / 111320

    shadow_polygons = []
    for row_feature in panel_rows_geojson:
        coords = row_feature['geometry']['coordinates'][0]
        # Extrude each edge of the panel polygon in shadow direction
        shadow_coords = [(c[0] + dx_deg, c[1] + dy_deg) for c in coords]
        # Shadow polygon = union of original + extruded
        panel_poly = Polygon(coords)
        shadow_poly = Polygon(shadow_coords)
        full_shadow = panel_poly.union(shadow_poly).convex_hull
        shadow_polygons.append({
            'type': 'Feature',
            'geometry': {
                'type': 'Polygon',
                'coordinates': [list(full_shadow.exterior.coords)]
            }
        })

    return shadow_polygons
```

### 3. Panel Layout Algorithm (panel_layout.py)

Places panel rows optimally within a user-drawn polygon.

```python
import numpy as np
from shapely.geometry import Polygon, box, MultiPolygon, LineString
from shapely.affinity import rotate, translate
from shapely import ops


def generate_panel_layout(
    zone_polygon: Polygon,
    module_width_m: float,        # 1.134m typical
    module_height_m: float,       # 2.278m typical
    row_spacing_m: float,         # 3.0m typical
    panel_azimuth_deg: float,     # 180 = south-facing
    latitude: float,
    longitude: float
) -> dict:
    """
    Fill a polygon zone with rows of solar panels.

    Strategy:
    1. Compute the bounding box of the zone
    2. Create a grid of panel rectangles at the specified spacing
    3. Rotate the grid to match panel azimuth
    4. Clip to the zone polygon
    5. Return GeoJSON FeatureCollection of placed panels

    Each "row" is a long rectangle: width = zone_width, height = module_height
    Rows are spaced by row_spacing_m (center-to-center)
    """
    # Convert polygon coordinates to local meters using approximate projection
    # For Dakhla: 1° lat ≈ 111320m, 1° lon ≈ 111320 * cos(23.7°) ≈ 101960m
    lat_scale = 111320
    lon_scale = 111320 * np.cos(np.radians(latitude))

    # Transform polygon to meters (relative to centroid)
    centroid = zone_polygon.centroid
    cx, cy = centroid.x, centroid.y

    def to_meters(coord):
        return ((coord[0] - cx) * lon_scale, (coord[1] - cy) * lat_scale)

    def to_degrees(coord):
        return (coord[0] / lon_scale + cx, coord[1] / lat_scale + cy)

    # Transform zone to meters
    zone_coords_m = [to_meters(c) for c in zone_polygon.exterior.coords]
    zone_m = Polygon(zone_coords_m)

    # Get bounding box
    minx, miny, maxx, maxy = zone_m.bounds
    zone_width = maxx - minx
    zone_height = maxy - miny

    # Rotation angle: azimuth 180° = south = rows run east-west (0° rotation)
    rotation_angle = (panel_azimuth_deg - 180)

    # Generate rows grid
    panels = []
    row_index = 0
    y = miny + module_height_m / 2  # Start from south edge

    while y + module_height_m / 2 <= maxy:
        # Create one long row across the full width
        row_rect = box(
            minx,
            y - module_height_m / 2,
            maxx,
            y + module_height_m / 2
        )

        # Rotate if azimuth != 180
        if rotation_angle != 0:
            row_rect = rotate(row_rect, rotation_angle, origin=zone_m.centroid)

        # Clip to zone
        clipped = zone_m.intersection(row_rect)

        if not clipped.is_empty and clipped.area > module_width_m * module_height_m:
            # Count how many individual modules fit in this row
            row_length = clipped.bounds[2] - clipped.bounds[0]
            n_modules_in_row = int(row_length / module_width_m)

            # Create individual module rectangles
            for i in range(n_modules_in_row):
                module_x = clipped.bounds[0] + i * module_width_m
                module_rect = box(
                    module_x,
                    y - module_height_m / 2,
                    module_x + module_width_m,
                    y + module_height_m / 2
                )

                # Check module is within zone
                if zone_m.contains(module_rect) or zone_m.intersection(module_rect).area > 0.9 * module_rect.area:
                    # Convert back to degrees
                    coords_deg = [to_degrees(c) for c in module_rect.exterior.coords]
                    panels.append({
                        'type': 'Feature',
                        'properties': {
                            'row': row_index,
                            'col': i,
                            'area_m2': module_width_m * module_height_m
                        },
                        'geometry': {
                            'type': 'Polygon',
                            'coordinates': [coords_deg]
                        }
                    })

            row_index += 1

        y += row_spacing_m  # Move to next row

    return {
        'type': 'FeatureCollection',
        'features': panels,
        'properties': {
            'n_panels': len(panels),
            'n_rows': row_index,
            'total_area_m2': len(panels) * module_width_m * module_height_m,
            'ground_coverage_ratio': (len(panels) * module_width_m * module_height_m) / zone_m.area
        }
    }
```

### 4. Energy Yield Calculation (yield_calc.py)

```python
import numpy as np
import pandas as pd


def calculate_yield(
    pvgis_data: pd.DataFrame,
    shadow_matrix: pd.DataFrame,
    n_panels: int,
    module_power_wc: float,
    system_loss_pct: float = 14,
    temp_coefficient: float = -0.0035  # %/°C for crystalline silicon
) -> dict:
    """
    Calculate annual energy yield with shadow and temperature corrections.

    Standard PV yield formula:
        E = P_stc × H_poa × PR / G_stc

    Where:
        P_stc = nominal module power at STC (W)
        H_poa = Plane of Array irradiation (kWh/m²)
        PR = Performance Ratio (accounts for all losses)
        G_stc = 1000 W/m² (Standard Test Conditions irradiance)

    Temperature correction:
        PR_temp = 1 + temp_coefficient × (T_cell - 25)
        T_cell ≈ T_ambient + 0.03 × G_poa (simplified NOCT model)
    """
    installed_capacity_wc = n_panels * module_power_wc
    installed_capacity_kwc = installed_capacity_wc / 1000

    # Hourly POA irradiance (from PVGIS tilted surface data)
    # If only GHI available, use simple transposition
    if 'poa_global' in pvgis_data.columns:
        poa = pvgis_data['poa_global']
    else:
        poa = pvgis_data['ghi']  # Fallback

    # Average shadow factor across all rows for each hour
    if shadow_matrix is not None and not shadow_matrix.empty:
        # Align indices
        avg_shadow = shadow_matrix.mean(axis=1)
        # Reindex to match pvgis data
        avg_shadow = avg_shadow.reindex(poa.index, method='nearest', fill_value=0)
        effective_irradiance = poa * (1 - avg_shadow)
    else:
        effective_irradiance = poa

    # Temperature correction
    if 'temp_air' in pvgis_data.columns:
        t_ambient = pvgis_data['temp_air']
        t_cell = t_ambient + 0.03 * effective_irradiance
        temp_factor = 1 + temp_coefficient * (t_cell - 25)
        temp_factor = temp_factor.clip(0.7, 1.1)  # Sanity bounds
    else:
        temp_factor = pd.Series(1.0, index=poa.index)

    # System losses (wiring, inverter, soiling, mismatch, degradation)
    system_factor = 1 - system_loss_pct / 100

    # Hourly energy production (Wh per Wc installed)
    hourly_specific_yield = (effective_irradiance / 1000) * temp_factor * system_factor

    # Annual aggregations
    # PVGIS gives multi-year data, take average year
    hourly_specific_yield_avg = hourly_specific_yield.groupby(
        [hourly_specific_yield.index.month, hourly_specific_yield.index.hour]
    ).mean()

    # Total over average year
    annual_specific_yield = hourly_specific_yield.sum() / len(
        pvgis_data.index.year.unique()
    )  # kWh/kWp/year

    annual_yield_kwh = annual_specific_yield * installed_capacity_kwc
    annual_yield_mwh = annual_yield_kwh / 1000

    # Performance Ratio
    annual_ghi = pvgis_data['ghi'].sum() / len(pvgis_data.index.year.unique()) / 1000  # kWh/m²
    pr = annual_specific_yield / annual_ghi if annual_ghi > 0 else 0.80

    # Shadow loss percentage
    if shadow_matrix is not None:
        total_unshaded = (poa / 1000).sum()
        total_shaded = (effective_irradiance / 1000).sum()
        shadow_loss_pct = (1 - total_shaded / total_unshaded) * 100 if total_unshaded > 0 else 0
    else:
        shadow_loss_pct = 0

    # Simplified LCOE estimation
    # Assumptions: CAPEX = 0.6 €/Wc, OPEX = 10 €/kWc/yr, lifetime = 25 years, WACC = 6%
    capex_eur = installed_capacity_wc * 0.6 / 1000 * 1000  # €/kWc * kWc
    opex_annual_eur = installed_capacity_kwc * 10
    wacc = 0.06
    lifetime = 25
    annuity_factor = (wacc * (1 + wacc)**lifetime) / ((1 + wacc)**lifetime - 1)
    annual_cost = capex_eur * annuity_factor + opex_annual_eur
    lcoe = (annual_cost / annual_yield_mwh) if annual_yield_mwh > 0 else 0

    # CO2 avoided (Morocco grid factor ≈ 0.47 tCO2/MWh)
    co2_avoided = annual_yield_mwh * 0.47

    return {
        'installed_capacity_kwc': round(installed_capacity_kwc, 1),
        'installed_capacity_mwc': round(installed_capacity_kwc / 1000, 3),
        'annual_yield_kwh': round(annual_yield_kwh),
        'annual_yield_mwh': round(annual_yield_mwh, 1),
        'specific_yield_kwh_kwp': round(annual_specific_yield, 1),
        'performance_ratio': round(pr, 3),
        'shadow_loss_pct': round(shadow_loss_pct, 2),
        'lcoe_eur_mwh': round(lcoe, 1),
        'co2_avoided_tons_yr': round(co2_avoided, 1),
        'capex_total_eur': round(capex_eur),
    }
```

### 5. Heatmap Generation (heatmap_gen.py)

```python
import numpy as np
import pandas as pd
from shapely.geometry import Polygon


def generate_seasonal_heatmaps(
    pvgis_data: pd.DataFrame,
    shadow_matrix: pd.DataFrame,
    zone_polygon: Polygon,
    resolution_m: float = 5.0,
    latitude: float = 23.7
) -> dict:
    """
    Generate irradiation heatmaps for summer (Jun-Aug) and winter (Dec-Feb).

    Creates a grid over the zone polygon where each cell contains
    the average effective irradiance (after shadow correction).

    Returns two 2D arrays representing W/m² for summer and winter,
    plus bounding box info for the frontend to overlay on the map.
    """
    # Zone bounds in meters
    lat_scale = 111320
    lon_scale = 111320 * np.cos(np.radians(latitude))

    minx, miny, maxx, maxy = zone_polygon.bounds
    width_m = (maxx - minx) * lon_scale
    height_m = (maxy - miny) * lat_scale

    nx = max(int(width_m / resolution_m), 10)
    ny = max(int(height_m / resolution_m), 10)

    # Season filters
    summer_months = [6, 7, 8]
    winter_months = [12, 1, 2]

    pvgis_summer = pvgis_data[pvgis_data.index.month.isin(summer_months)]
    pvgis_winter = pvgis_data[pvgis_data.index.month.isin(winter_months)]

    # Average hourly irradiance per season
    summer_avg_ghi = pvgis_summer['ghi'].mean() if len(pvgis_summer) > 0 else 0
    winter_avg_ghi = pvgis_winter['ghi'].mean() if len(pvgis_winter) > 0 else 0

    # Create base grids
    summer_grid = np.full((ny, nx), summer_avg_ghi)
    winter_grid = np.full((ny, nx), winter_avg_ghi)

    # Apply shadow correction per row position
    # Shadow primarily affects the north-south axis (y-axis for south-facing panels)
    if shadow_matrix is not None:
        shadow_summer = shadow_matrix[
            shadow_matrix.index.month.isin(summer_months)
        ].mean()
        shadow_winter = shadow_matrix[
            shadow_matrix.index.month.isin(winter_months)
        ].mean()

        n_rows = len(shadow_summer)
        for j in range(ny):
            row_idx = min(int(j / ny * n_rows), n_rows - 1)
            row_key = f'row_{row_idx}'
            if row_key in shadow_summer.index:
                summer_grid[j, :] *= (1 - shadow_summer[row_key])
            if row_key in shadow_winter.index:
                winter_grid[j, :] *= (1 - shadow_winter[row_key])

    # Mask cells outside the polygon
    for j in range(ny):
        for i in range(nx):
            cell_lon = minx + (i + 0.5) * (maxx - minx) / nx
            cell_lat = miny + (j + 0.5) * (maxy - miny) / ny
            from shapely.geometry import Point
            if not zone_polygon.contains(Point(cell_lon, cell_lat)):
                summer_grid[j, i] = np.nan
                winter_grid[j, i] = np.nan

    return {
        'summer': {
            'grid': summer_grid.tolist(),
            'avg_irradiance_w_m2': round(float(np.nanmean(summer_grid)), 1),
        },
        'winter': {
            'grid': winter_grid.tolist(),
            'avg_irradiance_w_m2': round(float(np.nanmean(winter_grid)), 1),
        },
        'bounds': {
            'north': maxy,
            'south': miny,
            'east': maxx,
            'west': minx
        },
        'resolution': {
            'nx': nx,
            'ny': ny,
            'cell_size_m': resolution_m
        }
    }
```

### 6. OpenAI Service (openai_service.py)

```python
import openai
import base64
import json


async def analyze_terrain_image(image_bytes: bytes, lat: float, lon: float) -> dict:
    """
    Use GPT-4o Vision to analyze a satellite/drone image of the terrain.
    """
    b64_image = base64.b64encode(image_bytes).decode('utf-8')

    client = openai.AsyncOpenAI()

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": """You are a solar energy site assessment expert. Analyze the satellite/drone
image of a terrain and provide a structured assessment for ground-mounted solar PV installation.
Respond ONLY with valid JSON matching this schema:
{
  "terrain_type": "flat_sandy_desert | rocky | vegetated | mixed",
  "slope_estimate_deg": <number>,
  "obstacles": [{"type": "<type>", "estimated_height_m": <number>, "description": "<desc>"}],
  "vegetation_coverage_pct": <number>,
  "soil_assessment": "<description>",
  "access_roads_visible": <boolean>,
  "water_features_visible": <boolean>,
  "overall_suitability": "excellent | good | moderate | poor",
  "recommendations": "<text>"
}"""
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{b64_image}"
                        }
                    },
                    {
                        "type": "text",
                        "text": f"Analyze this terrain at coordinates ({lat}°N, {lon}°W) "
                                f"for ground-mounted solar PV installation suitability."
                    }
                ]
            }
        ],
        max_tokens=1000,
        temperature=0.2
    )

    # Parse JSON from response
    text = response.choices[0].message.content
    # Strip markdown code fences if present
    text = text.replace('```json', '').replace('```', '').strip()
    return json.loads(text)


async def generate_solar_farm_render(
    lat: float, lon: float, n_panels: int, terrain_desc: str = "flat desert"
) -> str:
    """
    Generate a photorealistic aerial render of the solar farm using DALL-E 3.
    Returns the image URL.
    """
    client = openai.AsyncOpenAI()

    prompt = (
        f"Photorealistic aerial drone photograph of a large ground-mounted solar farm "
        f"with approximately {n_panels} solar panels arranged in neat parallel rows "
        f"on {terrain_desc} terrain. Clear blue sky, golden sand, industrial scale. "
        f"Professional photography style, high resolution, realistic lighting."
    )

    response = await client.images.generate(
        model="dall-e-3",
        prompt=prompt,
        size="1792x1024",
        quality="hd",
        n=1
    )

    return response.data[0].url


async def generate_voice_response(
    user_text: str,
    analysis_data: dict
) -> dict:
    """
    Process voice command and generate contextual response + action.
    """
    client = openai.AsyncOpenAI()

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": f"""You are SolarSite's voice assistant. You help solar project developers
analyze their sites. You have access to the following analysis data:
{json.dumps(analysis_data, indent=2)}

When the user asks a question, respond with:
1. A concise spoken answer (1-2 sentences)
2. An optional UI action to trigger

Respond with JSON:
{{
  "spoken_response": "<text to speak via TTS>",
  "action": {{
    "type": "set_time" | "zoom_to" | "toggle_heatmap" | "show_report" | null,
    "params": {{}}
  }}
}}"""
            },
            {"role": "user", "content": user_text}
        ],
        max_tokens=300,
        temperature=0.3
    )

    text = response.choices[0].message.content
    text = text.replace('```json', '').replace('```', '').strip()
    return json.loads(text)
```

### 7. fal.ai Service (fal_service.py)

```python
import fal_client


async def generate_3d_model(image_url: str) -> dict:
    """
    Convert a solar farm render image to 3D GLB model using Trellis 2.

    Trellis 2 is the latest version on fal.ai, using Structured LATents (SLAT).
    Input: URL of a rendered image (from DALL-E or uploaded)
    Output: GLB file URL + thumbnail

    Cost: ~$0.02 per generation
    """
    result = fal_client.subscribe(
        "fal-ai/trellis-2",
        arguments={
            "image_url": image_url
        }
    )

    return {
        "model_glb_url": result["model_glb"]["url"],
        "thumbnail_url": result.get("thumbnail", {}).get("url", ""),
    }


async def generate_3d_model_hunyuan(image_url: str) -> dict:
    """
    Alternative: Hunyuan3D v3 for higher quality 3D.
    Supports configurable face count and PBR materials.

    Cost: ~$0.05 per generation (v2.1)
    """
    result = fal_client.subscribe(
        "fal-ai/hunyuan3d-v3/image-to-3d",
        arguments={
            "input_image_url": image_url,
            "face_count": 500000,
            "generate_type": "Normal",
            "polygon_type": "triangle"
        }
    )

    return {
        "model_glb_url": result["model_glb"]["url"],
        "model_obj_url": result.get("model_urls", {}).get("obj", {}).get("url", ""),
        "thumbnail_url": result.get("thumbnail", {}).get("url", ""),
    }


async def generate_flyover_video(image_url: str) -> dict:
    """
    Generate a cinematic flyover video of the solar farm render.
    Uses fal.ai video generation (Kling or Hailuo).

    This is a BONUS feature — impressive for the demo.
    """
    try:
        result = fal_client.subscribe(
            "fal-ai/kling-video/v2.1/standard/image-to-video",
            arguments={
                "prompt": "Smooth cinematic aerial drone flyover of this solar farm, "
                         "slowly panning across rows of solar panels in the desert, "
                         "golden hour lighting, professional documentary style",
                "image_url": image_url,
                "duration": "5",
                "aspect_ratio": "16:9"
            }
        )
        return {"video_url": result["video"]["url"]}
    except Exception as e:
        return {"error": str(e)}
```

### 8. Gradium Voice Service (gradium_service.py)

```python
import asyncio
import json
import websockets


GRADIUM_STT_ENDPOINT = "wss://eu.api.gradium.ai/api/speech/asr"
GRADIUM_TTS_ENDPOINT = "wss://eu.api.gradium.ai/api/speech/tts"


async def transcribe_audio_stream(api_key: str, audio_chunks):
    """
    Stream PCM audio chunks to Gradium STT and yield transcription results.

    Audio format: PCM 24kHz mono, 16-bit little-endian
    Chunk size: 1920 bytes (~80ms at 24kHz)

    Gradium STT returns two message types:
    - "text": transcription results with timestamps
    - "step": VAD (Voice Activity Detection) signals
    """
    async with websockets.connect(
        GRADIUM_STT_ENDPOINT,
        additional_headers={"Authorization": f"Bearer {api_key}"}
    ) as ws:
        # Send setup message
        setup = json.dumps({
            "model_name": "default",
            "input_format": "pcm",
            "sample_rate": 24000
        })
        await ws.send(setup)

        # Send audio chunks
        async for chunk in audio_chunks:
            await ws.send(chunk)

            # Check for transcription results (non-blocking)
            try:
                response = await asyncio.wait_for(ws.recv(), timeout=0.05)
                msg = json.loads(response)
                if msg.get("type") == "text":
                    yield msg["text"]
            except asyncio.TimeoutError:
                continue


async def synthesize_speech(api_key: str, text: str, voice_id: str = None) -> bytes:
    """
    Convert text to speech using Gradium TTS.

    Output: PCM 48kHz audio bytes (streamable)

    Supported languages: English, French, Spanish, Portuguese, German
    Supports text rewrite rules for dates, numbers, etc.
    """
    audio_chunks = []

    async with websockets.connect(
        GRADIUM_TTS_ENDPOINT,
        additional_headers={"Authorization": f"Bearer {api_key}"}
    ) as ws:
        # Send setup message
        setup = {
            "model_name": "default",
            "output_format": "pcm",
            "sample_rate": 48000,
            "rewrite_rules": "fr"  # Enable French text normalization
        }
        if voice_id:
            setup["voice_id"] = voice_id
        await ws.send(json.dumps(setup))

        # Send text to synthesize
        await ws.send(json.dumps({"text": text}))

        # Collect audio chunks
        async for message in ws:
            if isinstance(message, bytes):
                audio_chunks.append(message)
            else:
                msg = json.loads(message)
                if msg.get("type") == "done":
                    break

    return b''.join(audio_chunks)
```

---

## Frontend Component Specs

### MapView.jsx — Main Map Component

```jsx
// Core map with satellite imagery + deck.gl overlay layers
// Uses react-map-gl v8 with MapLibre backend
// MapTiler satellite tiles (free tier)

import Map from 'react-map-gl/maplibre';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { useControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

// MapTiler satellite style URL:
const MAP_STYLE = `https://api.maptiler.com/maps/satellite/style.json?key=${MAPTILER_KEY}`;

// Default view: Dakhla, Morocco
const INITIAL_VIEW = {
  latitude: 23.7145,
  longitude: -15.9369,
  zoom: 14,
  pitch: 45,
  bearing: 0
};

// deck.gl layers are added via MapboxOverlay with interleaved: true
// This allows deck.gl layers to render within MapLibre's WebGL context
```

### Key deck.gl Layers Used

```
PolygonLayer   → Panel rectangles (colored by irradiance: green→yellow→red)
PolygonLayer   → Shadow polygons (semi-transparent dark, animated)
HeatmapLayer   → Irradiation overlay (summer/winter)
IconLayer      → Obstacle markers from OpenAI Vision analysis
PathLayer      → Access roads detected
TextLayer      → Labels (MWc zones, row numbers)
```

### TimeSlider.jsx — Shadow Animation Control

```
Range input: 0-23 (hours) + date picker (or preset: summer/winter solstice, equinox)
When user drags the slider:
1. Client-side shadow polygon recalculation (fast, using pre-computed solar position array)
2. deck.gl PolygonLayer updates with new shadow shapes
3. Dashboard updates shadow loss % for selected time

Pre-computed data: Solar position array for 365 days × 24 hours sent from backend
Client-side calculation: Shadow polygons from the shadow-geometry.js utility
```

### SeasonCompare.jsx — Split View

```
Two side-by-side map views:
- Left: Summer heatmap (Jun-Aug average)
- Right: Winter heatmap (Dec-Feb average)

Both maps synchronized (pan/zoom/rotate together)
Color scale: Blue (low irradiance) → Yellow → Red (high irradiance)
Scale bar showing W/m² values

Implementation: Two <Map> instances with synchronized viewState
```

### VoiceControl.jsx — Gradium Integration

```
Microphone button (hold to speak / toggle)
Audio capture: AudioWorklet API → PCM 24kHz mono
WebSocket connection to backend /ws/voice
Backend proxies to Gradium STT → transcription
Transcription sent to OpenAI for intent parsing
Response spoken back via Gradium TTS

Voice commands supported:
- "Show me the shadow at 4pm in December"
  → action: { type: "set_time", params: { month: 12, hour: 16 } }
- "How many megawatts can I install?"
  → spoken: "You can install 2.31 megawatts on this site"
- "Compare summer and winter"
  → action: { type: "toggle_heatmap", params: { mode: "split" } }
- "Generate 3D model"
  → action: { type: "generate_3d" }
- "What is the annual yield?"
  → spoken: "The estimated annual yield is 4,158 megawatt-hours"
```

### Dashboard.jsx — KPI Display

```
Sidebar or bottom panel showing:

┌──────────────────────────────────────┐
│  📊 Site Analysis Results            │
├──────────────────────────────────────┤
│  Installed Capacity    2.31 MWc      │
│  Annual Yield          4,158 MWh     │
│  Specific Yield        1,800 kWh/kWp │
│  Performance Ratio     82%           │
│  Shadow Loss           2.8%          │
│  LCOE                  28.5 €/MWh    │
│  CO₂ Avoided           1,950 t/yr   │
│  Number of Panels      4,200         │
│  Row Spacing            3.0 m        │
│  Ground Coverage        21.7%        │
├──────────────────────────────────────┤
│  [📥 Download Report]                │
│  [🎬 Generate 3D Model]             │
│  [🎙️ Voice Assistant]               │
└──────────────────────────────────────┘
```

---

## Environment Variables

```env
# .env.example

# OpenAI
OPENAI_API_KEY=sk-...

# fal.ai
FAL_KEY=...

# Gradium
GRADIUM_API_KEY=...

# MapTiler (free tier: https://cloud.maptiler.com/account/keys/)
VITE_MAPTILER_KEY=...

# Backend URL (for frontend)
VITE_API_URL=http://localhost:8000
```

---

## Build & Run Commands

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Frontend
cd frontend
npm install
npm run dev  # Vite dev server on port 5173

# Production
npm run build  # Output to dist/
```

---

## Default Values & Constants

```python
# constants.py

# Dakhla, Morocco — default location
DEFAULT_LAT = 23.7145
DEFAULT_LON = -15.9369
DEFAULT_TZ = 'Africa/Casablanca'
DEFAULT_ALTITUDE_M = 12

# Standard module (JA Solar JAM72S30-550/MR, typical utility-scale)
DEFAULT_MODULE_WIDTH_M = 1.134
DEFAULT_MODULE_HEIGHT_M = 2.278
DEFAULT_MODULE_POWER_WC = 550
DEFAULT_MODULE_EFFICIENCY = 0.213

# Default system parameters
DEFAULT_PANEL_TILT_DEG = 25       # Optimal for Dakhla latitude
DEFAULT_PANEL_AZIMUTH_DEG = 180   # South-facing
DEFAULT_ROW_SPACING_M = 3.0      # Typical for flat terrain
DEFAULT_SYSTEM_LOSS_PCT = 14     # Industry standard (wiring, inverter, soiling, mismatch)
DEFAULT_ALBEDO = 0.3              # Desert sand albedo

# LCOE assumptions
CAPEX_EUR_PER_WC = 0.60
OPEX_EUR_PER_KWC_YEAR = 10
WACC = 0.06
LIFETIME_YEARS = 25

# Morocco grid emission factor
GRID_EMISSION_FACTOR_TCO2_MWH = 0.47

# Dakhla solar resource (for quick estimates without API call)
DAKHLA_GHI_KWH_M2_YEAR = 2150
DAKHLA_DNI_KWH_M2_YEAR = 2480
DAKHLA_AVG_TEMP_C = 21.3
DAKHLA_AVG_WIND_MS = 6.2
DAKHLA_SUNSHINE_HOURS = 3200
```

---

## Hackathon Demo Script (2 minutes)

### 0:00-0:15 — Problem Statement
"Morocco is investing 370 billion MAD in renewable energy in the South. Every solar project starts with a site assessment that costs tens of thousands of euros and takes weeks. SolarSite does it in 30 seconds."

### 0:15-0:40 — Live Demo: Map Interaction
- Open SolarSite on laptop
- Show Dakhla satellite map
- Draw a polygon zone on the terrain
- Panels auto-populate
- Drag the time slider: shadows animate across the panel rows
- Show split view: summer vs winter heatmap

### 0:40-1:00 — Voice Interaction (Gradium)
- Click mic: "Combien de mégawatts je peux installer sur cette zone?"
- SolarSite responds vocally: "Vous pouvez installer 2.3 mégawatts..."
- "Montre-moi l'ombrage en décembre à 16 heures"
- Map animates to December 4PM, shadows extend

### 1:00-1:20 — Analysis Results
- Show dashboard: MWc, kWh/yr, LCOE, shadow loss
- "L'outil utilise PVGIS (données satellite EU), pvlib (standard industriel), et un calcul géométrique d'ombrage inter-rangées"

### 1:20-1:40 — 3D Visualization (fal.ai)
- Click "Generate 3D Model"
- DALL-E renders the farm → Trellis 2 converts to 3D
- Show interactive 3D model in model-viewer
- Optional: show flyover video

### 1:40-2:00 — Impact & Vision
- "SolarSite uses OpenAI for terrain intelligence, Gradium for voice-first interaction on site, and fal.ai for immersive 3D visualization"
- "Built for the engineers deploying GW-scale solar in Morocco, MENA, and sub-Saharan Africa"
- "The future is solar. Let's make site assessment instant."

---

## Implementation Priority (what to build first)

### P0 — Must Have (MVP for demo)
1. FastAPI backend with `/api/analyze` endpoint (pvlib + shadow calc + yield)
2. React frontend with MapLibre satellite map
3. Polygon drawing tool on map
4. Panel grid overlay (deck.gl PolygonLayer)
5. Time slider with shadow animation
6. Dashboard with KPIs

### P1 — High Impact for Judging
7. Summer/winter heatmap split view
8. Gradium voice interface (STT + TTS)
9. OpenAI Vision terrain analysis
10. fal.ai 3D model generation

### P2 — Nice to Have
11. fal.ai flyover video generation
12. PDF report export
13. Panel parameter configuration UI (tilt, spacing, module type)
14. Optimal spacing recommendation engine
15. Multiple zone comparison

---

## Known Limitations & Honest Assessments

1. **fal.ai 3D models** are trained on objects, not topography. We use them for marketing renders (DALL-E image → 3D maquette), not for actual terrain reconstruction. Real topography comes from SRTM elevation data.

2. **Gradium** supports FR/EN/ES/PT/DE but NOT Arabic/Darija yet. Demo in French, mention Arabic as roadmap.

3. **Shadow calculation** assumes perfectly flat terrain. For sloped terrain, we'd need DEM integration (possible with Open-Topo-Data but adds complexity). For Dakhla desert, flat assumption is valid.

4. **PVGIS** has no CORS — must be called from backend (Python), never from frontend JavaScript. pvlib handles this natively.

5. **Panel placement algorithm** is simplified (rectangular grid clipped to polygon). Real utility-scale projects use more sophisticated algorithms (genetic optimization, terrain-following). This is adequate for a hackathon demo.

6. **LCOE calculation** uses simplified assumptions (fixed CAPEX/OPEX). Real LCOE requires detailed BoS costs, land costs, grid connection costs, financing structure. We state assumptions clearly.

7. **MapTiler free tier** is 100K requests/month. More than enough for hackathon, but would need paid tier for production.
