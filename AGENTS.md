# SolarSite AI Agent

## Overview

SolarSite uses a **LangGraph ReAct agent** that autonomously performs a complete solar farm site assessment. No manual interaction required — the agent selects a zone, runs analysis, and generates a 3D model.

## Architecture

```
Frontend (useAgent.js)          Backend (agent_service.py)
       │                               │
       │  POST /api/agent/run          │
       │──────────────────────────────>│
       │                               │  create_react_agent(gpt-4.1-mini, tools)
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
       │  SSE: tool_start              │  ┌──────────────────────────┐
       │<──────────────────────────────│  │  generate_3d_visualization│
       │                               │  │  GPT Image → fal.ai 3D   │
       │  SSE: model_3d               │  └──────────────────────────┘
       │<──────────────────────────────│
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
- **Action**: Calls PVGIS v5.3 for irradiance data, generates panel layout, computes shadows, calculates yield/LCOE
- **Output**: Full analysis (site info, layout with panels GeoJSON, solar data, shadows, heatmaps, yield KPIs)
- **SSE event**: `analysis` — frontend renders panels + dashboard
- **Duration**: ~15-30s (PVGIS HTTP calls)

### 3. `generate_3d_visualization`
- **Input**: n_panels, latitude, longitude
- **Action**: Generates photorealistic render via GPT Image (`gpt-image-1`), converts to 3D GLB mesh via fal.ai Trellis 2
- **Output**: render_image_url, model_glb_url, thumbnail_url
- **SSE event**: `model_3d` — frontend loads GLB in model-viewer

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

## Implementation Details

- **LLM**: `gpt-4.1-mini` (temperature=0) via `langchain-openai`
- **Agent**: `create_react_agent` from `langgraph.prebuilt`
- **Streaming**: `astream_events(version="v2")` for real-time SSE
- **Sync tools**: LangGraph auto-handles thread pooling for sync tools (`select_zone`, `run_solar_analysis`)
- **Async tools**: `generate_3d_visualization` is async, wraps sync `fal_client.subscribe` in `asyncio.to_thread()`
- **State isolation**: Each request creates a new `SolarAgent` instance with its own result store
