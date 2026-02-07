# SolarSite AI Agent

## Overview

SolarSite uses a **LangGraph ReAct agent** that autonomously performs a complete solar farm site assessment. No manual interaction required — the agent selects a zone, runs analysis, and generates a 3D model.

## Architecture

```
Frontend (useAgent.js)          Backend (agent_service.py)
       │                               │
       │  POST /api/agent/run          │
       │──────────────────────────────>│
       │                               │  create_react_agent(gpt-5-mini, tools)
       │                               │
       │  SSE: tool_start              │  ┌─────────────────┐
       │<──────────────────────────────│  │  select_zone     │
       │  SSE: polygon                 │  │  (Shapely box)   │
       │<──────────────────────────────│  └─────────────────┘
       │                               │
       │  SSE: tool_start              │  ┌─────────────────────────┐
       │<──────────────────────────────│  │  run_solar_analysis      │
       │                               │  │  PVGIS + layout + shadow │
       │  SSE: analysis                │  │  + yield + heatmaps      │
       │<──────────────────────────────│  └─────────────────────────┘
       │                               │
       │  SSE: tool_start              │  ┌──────────────────────────────┐
       │<──────────────────────────────│  │  generate_3d_visualization    │
       │                               │  │  test: GPT-Image-1.5 → SAM 3D│
       │  SSE: model_3d               │  │  demo: Hunyuan 3D text-to-3D  │
       │<──────────────────────────────│  └──────────────────────────────┘
       │  SSE: done                    │
       │<──────────────────────────────│
```

## Agent Tools

### 1. `select_zone`
- **Input**: latitude, longitude, area_hectares
- **Action**: Creates a rectangular polygon using Shapely `box()`
- **Output**: GeoJSON Polygon + zone metadata
- **SSE event**: `polygon` — frontend renders zone on map

### 2. `run_solar_analysis`
- **Input**: latitude, longitude, polygon_coordinates, panel parameters
- **Action**: Calls PVGIS v5.3 for irradiance data, generates panel layout, computes shadows, calculates yield/LCOE. Timezone, terrain classification, and seasonal shadow losses are computed dynamically from coordinates and shadow matrix.
- **Output**: Full analysis (site info, layout with panels GeoJSON, solar data, shadows, heatmaps, yield KPIs)
- **SSE event**: `analysis` — frontend renders panels + dashboard
- **Duration**: ~15-30s (PVGIS HTTP calls)

### 3. `generate_3d_visualization`
- **Input**: n_panels, latitude (required), longitude (required)
- **Dual modes** (controlled by `mode` parameter):
  - **test**: GPT-Image-1.5 render (1536x1024) → SAM 3D Objects image-to-3D ($0.02)
  - **demo**: Hunyuan 3D v3.1 Rapid text-to-3D directly, skips image gen ($0.225)
- **Output**: render_image_url, model_glb_url, thumbnail_url
- **SSE event**: `model_3d` — frontend loads GLB in @google/model-viewer

## SSE Event Types

| Event | Payload | Frontend action |
|-------|---------|-----------------|
| `thinking` | `{content: "..."}` | Show agent reasoning text |
| `tool_start` | `{tool: "tool_name"}` | Add step with spinner |
| `tool_result` | `{tool, result}` | (internal) |
| `polygon` | `{data: GeoJSON}` | Render zone on map |
| `analysis` | `{data: AnalysisResult}` | Render panels + KPIs |
| `model_3d` | `{data: {model_glb_url, ...}}` | Switch to 3D tab |
| `error` | `{message: "..."}` | Show error |
| `done` | `{}` | Mark complete |

## Post-Agent: Interactive Zone Editing

After the agent completes, the user can iteratively refine the zone polygon **without re-running the full agent**. This enables rapid site optimization.

### Flow

```
Agent done → EDIT ZONE → Move/Resize/Rotate → APPLY → POST /api/analyze → Updated KPIs
                                              → CANCEL → Revert to original
```

### Edit Modes

| Mode | Action | Geometry |
|------|--------|----------|
| **MOVE** | Drag polygon body | `translateCoords(coords, dlng, dlat)` |
| **RESIZE** | Drag corner handle | Uniform `scaleFromCenter` (min 0.1x) |
| **ROTATE** | Drag green handle above centroid | `rotateCoords` around centroid |

### Implementation (`usePolygonEdit.js`)

- **State**: `editCorners` (4-corner working copy), `editMode`, `isDragging`, `cumulativeRotationDeg`
- **Azimuth**: `((180 + cumulativeRotationDeg) % 360 + 360) % 360` — passed to `panel_azimuth_deg` on re-analysis
- **Override pattern**: `AppView` maintains `polygonOverride`/`analysisOverride` that take precedence over agent results. Reset when agent re-runs.
- **Re-analysis**: On APPLY, calls `POST /api/analyze` via `useSolarAnalysis` with the edited polygon + derived azimuth

### Visual Handles (MapView)

- **Corner handles**: 4x 12x12 red squares (`#e05438`) with white border
- **Rotation handle**: 1x 16x16 green circle (`#22c55e`) with glow, positioned above centroid
- **Connector line**: Dashed green line from centroid to rotation handle
- **Edit polygon**: Dashed `#e05438` border, 0.18 fill opacity (replaces original polygon)

## OpenAI Models Used

| Purpose | Model | API |
|---------|-------|-----|
| Agent LLM | `gpt-5-mini` | LangGraph / langchain-openai |
| Vision (terrain analysis) | `gpt-5-mini` | Responses API with reasoning |
| Voice response gen | `gpt-5-nano` | Responses API |
| Image generation | `gpt-image-1.5` | OpenAI Images (1536x1024, quality: low) |

## 3D Pipeline (fal.ai)

| Mode | fal.ai Model | Input | Cost |
|------|-------------|-------|------|
| test | `fal-ai/sam-3/3d-objects` (SAM 3D Objects) | GPT-Image-1.5 render URL | ~$0.02 |
| demo | `fal-ai/hunyuan-3d/v3.1/rapid/text-to-3d` (Hunyuan 3D) | Text prompt | ~$0.225 |

## Dynamic GIS Context

All site data is derived dynamically from coordinates — no hardcoded location data:
- **System prompt**: Generated via `_build_system_prompt(lat, lon)` — includes hemisphere, coordinate formatting, no location name
- **Timezone**: `lookup_timezone(lat, lon)` via `timezonefinder` (fallback: UTC offset from longitude)
- **Terrain**: `classify_terrain(elevation_m)` — flat_lowland/flat_plateau/elevated_terrain/highland
- **Shadow losses**: `compute_seasonal_shadow_losses(shadow_matrix, latitude)` — hemisphere-aware seasonal calculation from actual shadow matrix
- **Financial parameters**: Configurable via API request fields (CAPEX, OPEX, WACC, lifetime, CO2 factor) with sensible defaults

## Implementation Details

- **LLM**: `gpt-5-mini` (temperature=0) via `langchain-openai`
- **Agent**: `create_react_agent` from `langgraph.prebuilt`
- **Streaming**: `astream_events(version="v2")` for real-time SSE
- **Sync tools**: LangGraph auto-handles thread pooling for sync tools (`select_zone`, `run_solar_analysis`)
- **Async tools**: `generate_3d_visualization` is async, wraps sync `fal_client.subscribe` in `asyncio.to_thread()`
- **State isolation**: Each request creates a new `SolarAgent` instance with its own result store
- **Token safety**: Tool returns to LLM are compact summaries — full data (base64 images, GeoJSON, heatmaps) is stored in `agent_ref.*` and sent via SSE only, never injected into LLM context
