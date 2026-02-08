# SolarSite AI Agent

## Overview

SolarSite uses a **LangGraph ReAct agent** that autonomously performs a complete solar farm site assessment. The agent selects a zone and runs analysis. 3D generation is handled separately by the frontend after analysis completes, using a MapLibre screenshot for contextual rendering.

## Architecture

```
Frontend (useAgent.js)          Backend (agent_service.py)        Frontend (AppView)
       │                               │                                │
       │  POST /api/agent/run          │                                │
       │──────────────────────────────>│                                │
       │                               │  create_react_agent(gpt-5-mini, tools)
       │                               │                                │
       │  SSE: tool_start              │  ┌─────────────────┐          │
       │<──────────────────────────────│  │  select_zone     │          │
       │  SSE: polygon                 │  │  (Shapely box)   │          │
       │<──────────────────────────────│  └─────────────────┘          │
       │                               │                                │
       │  SSE: tool_start              │  ┌─────────────────────────┐  │
       │<──────────────────────────────│  │  run_solar_analysis      │  │
       │                               │  │  PVGIS + layout + shadow │  │
       │  SSE: analysis                │  │  + yield + heatmaps      │  │
       │<──────────────────────────────│  └─────────────────────────┘  │
       │  SSE: done                    │                                │
       │<──────────────────────────────│                                │
       │                               │                                │  1.5s delay (map renders)
       │                               │                                │  MapLibre screenshot
       │                               │  POST /api/generate-3d         │
       │                               │<──────────────────────────────│
       │                               │  (screenshot + n_panels)       │
       │                               │  GPT-Image-1.5 edit → SAM 3D  │
       │                               │──────────────────────────────>│
       │                               │  { model_glb_url }            │  Mini 3D viewer (sidebar)
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

## SSE Event Types

| Event | Payload | Frontend action |
|-------|---------|-----------------|
| `thinking` | `{content: "..."}` | Show agent reasoning text |
| `tool_start` | `{tool: "tool_name"}` | Add step with spinner |
| `tool_result` | `{tool, result}` | (internal) |
| `polygon` | `{data: GeoJSON}` | Render zone on map |
| `analysis` | `{data: AnalysisResult}` | Render panels + KPIs, trigger 3D generation |
| `error` | `{message: "..."}` | Show error |
| `done` | `{}` | Mark complete |

## Post-Agent: Contextual 3D Generation

After the agent completes and the map renders panels, the frontend automatically:
1. Waits ~1.5s for MapLibre to finish rendering
2. Captures a screenshot of the map via `MapView.captureScreenshot()` (uses `canvas.toDataURL()`)
3. Sends the screenshot + `n_panels` to `POST /api/generate-3d` with `map_screenshot` field
4. Backend uses `images.edit()` (GPT-Image-1.5) to add solar panels to the satellite screenshot
5. SAM 3D Objects converts the edited image to a GLB 3D model
6. The GLB is displayed in a mini 3D viewer at the bottom of the sidebar (320px × 220px)

The map always stays visible — the 3D viewer never replaces the map view.

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
| Chat assistant | `gpt-5-mini` | Chat Completions API (streaming) |
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

## Chat Widget (Multi-Turn Conversational AI)

### Architecture

```
Text input ──→ POST /api/chat (SSE) ──→ GPT-5-mini ──→ streamed tokens + action
Voice input ──→ WS /ws/voice (stt_only) ──→ Gradium STT ──→ transcript ──→ POST /api/chat
```

### Chat Service (`chat_service.py`)

- `stream_chat_response(message, history, analysis_data)` -- async generator
- System prompt includes compact analysis data (heatmaps + panels_geojson stripped for token efficiency)
- GPT-5-mini via **Chat Completions API** (`client.chat.completions.create(stream=True)`) -- uses Chat Completions instead of Responses API for SDK v1.59.9 compatibility
- Yields `{"type": "token", "content": "..."}` per `chunk.choices[0].delta.content`
- Action parsing: last line `ACTION:{"action": "run_analysis"|"toggle_heatmap"|"show_report"}` extracted and sent in `done` event
- Fallback: non-streaming single response if stream fails

### Chat Router (`routers/chat.py`)

- `POST /api/chat` — SSE stream endpoint
- Request: `{message, history[{role, content}], analysis_data?}`
- Mirrors agent.py SSE pattern

### Voice STT-Only Mode (`routers/voice.py`)

- `set_mode` message: `{"type": "set_mode", "stt_only": true}`
- When `stt_only=true`, skips GPT-5-nano response generation and TTS synthesis
- Only returns `{"type": "transcript", "text": "..."}` events
- Used by chat widget to get transcription without wasting GPT-5-nano calls

### Frontend (`useChat.js` + `ChatWidget.jsx`)

- `useChat({onAction})` — manages messages, SSE streaming, Gradium STT
- `ChatWidget` — floating bottom-right panel (360x480px), Atlas design language
- Actions dispatched to AppView: `run_analysis`, `toggle_heatmap`, `show_report`

## Implementation Details

- **LLM**: `gpt-5-mini` (temperature=0) via `langchain-openai`
- **Agent**: `create_react_agent` from `langgraph.prebuilt`
- **Streaming**: `astream_events(version="v2")` for real-time SSE
- **Sync tools**: LangGraph auto-handles thread pooling for sync tools (`select_zone`, `run_solar_analysis`)
- **State isolation**: Each request creates a new `SolarAgent` instance with its own result store
- **Token safety**: Tool returns to LLM are compact summaries — full data (base64 images, GeoJSON, heatmaps) is stored in `agent_ref.*` and sent via SSE only, never injected into LLM context
- **Map screenshot**: MapView exposes `captureScreenshot()` via `forwardRef`/`useImperativeHandle`, requires `preserveDrawingBuffer: true` on MapLibre Map component
- **Contextual 3D**: `generate_contextual_render()` uses `images.edit()` with the satellite screenshot as base image
