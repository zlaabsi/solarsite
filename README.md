# SolarSite

AI-powered solar farm site assessment tool. Combines satellite imagery, photovoltaic modeling, and conversational AI to evaluate solar farm viability anywhere in the world.

Built for the **{Tech: Europe} Paris 2026** hackathon.

## What It Does

1. **Autonomous Site Assessment** -- An AI agent selects an optimal zone and runs a complete solar analysis (irradiance, panel layout, shadows, energy yield, LCOE)
2. **Interactive Map** -- Satellite imagery with 3D terrain, panel overlays, shadow simulation, and irradiance heatmaps
3. **3D Visualization** -- Contextual solar farm renders generated from map screenshots, displayed as interactive GLB models
4. **Conversational AI** -- Chat widget to ask questions about results, trigger actions, and use voice input
5. **Zone Editing** -- Move, resize, or rotate the analysis zone and instantly re-analyze

## Stack

| Layer | Technologies |
|-------|-------------|
| **Backend** | FastAPI, pvlib, PVGIS v5.3 (SARAH3) |
| **AI / LLM** | OpenAI (GPT-5-mini, GPT-5-nano, GPT-Image-1.5), LangGraph ReAct agent |
| **3D** | fal.ai (SAM 3D Objects, Hunyuan 3D v3.1), @google/model-viewer |
| **Voice** | Gradium WSS (STT / TTS) |
| **Frontend** | React 18, MapLibre GL, deck.gl, Tailwind CSS |

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- API keys: OpenAI, fal.ai, MapTiler, Gradium (optional)

### Environment

Create `backend/.env`:

```env
OPENAI_API_KEY=sk-...
FAL_KEY=...
GRADIUM_API_KEY=...          # optional, for voice
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
VITE_MAPTILER_KEY=...
```

### Run

```bash
# Backend (port 8000)
cd backend && pip install -r requirements.txt && uvicorn main:app --reload

# Frontend (port 5173)
cd frontend && npm install && npm run dev
```

Open `http://localhost:5173` in your browser.

## Architecture

```
                    Frontend (React)                           Backend (FastAPI)
              ┌──────────────────────────┐             ┌───────────────────────────┐
              │  AppView                 │             │  Routers                  │
              │  ├── MapView (MapLibre)  │  SSE        │  ├── /api/agent/run       │
              │  ├── ChatWidget          │◄───────────►│  ├── /api/chat            │
              │  ├── Sidebar (KPIs, 3D)  │  REST       │  ├── /api/analyze         │
              │  └── Overlays            │◄───────────►│  ├── /api/generate-3d     │
              │                          │  WebSocket  │  ├── /api/analyze-image   │
              │  Hooks                   │◄───────────►│  └── /ws/voice            │
              │  ├── useAgent (SSE)      │             │                           │
              │  ├── useChat (SSE+WS)    │             │  Services                 │
              │  ├── useSolarAnalysis    │             │  ├── agent_service (LG)   │
              │  ├── usePolygonEdit      │             │  ├── chat_service         │
              │  └── useVoice            │             │  ├── solar_engine (pvlib) │
              └──────────────────────────┘             │  ├── panel_layout         │
                                                       │  ├── shadow_calc          │
                                                       │  ├── yield_calc           │
                                                       │  ├── heatmap_gen          │
                                                       │  ├── openai_service       │
                                                       │  ├── fal_service          │
                                                       │  └── gradium_service      │
                                                       └───────────────────────────┘
```

## API Reference

### `POST /api/agent/run` -- AI Agent

Runs the autonomous site assessment agent. Returns SSE stream.

```json
{"latitude": 23.7145, "longitude": -15.9369, "area_hectares": 5.0, "mode": "test"}
```

SSE events: `thinking`, `tool_start`, `polygon`, `analysis`, `done`, `error`

### `POST /api/chat` -- Conversational AI

Multi-turn chat with analysis context. Returns SSE stream.

```json
{
  "message": "What is the LCOE for this site?",
  "history": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}],
  "analysis_data": { ... }
}
```

SSE events: `token` (streaming text), `done` (final text + optional action)

### `POST /api/analyze` -- Direct Analysis

Runs solar analysis on a specific polygon without the agent.

```json
{
  "latitude": 23.7145, "longitude": -15.9369,
  "polygon_geojson": {"type": "Polygon", "coordinates": [...]},
  "panel_tilt_deg": 25, "panel_azimuth_deg": 180
}
```

### `POST /api/generate-3d` -- 3D Model Generation

Generates a 3D GLB model of the solar farm.

```json
{
  "latitude": 23.7145, "longitude": -15.9369,
  "n_panels": 500, "render_type": "test",
  "map_screenshot": "base64..."
}
```

### `POST /api/analyze-image` -- Terrain Vision

Analyzes a terrain image using GPT-5-mini vision.

### `WS /ws/voice` -- Voice I/O

WebSocket endpoint for real-time speech-to-text (Gradium STT) and text-to-speech. Supports `stt_only` mode for chat widget integration.

## AI Features

### ReAct Agent (LangGraph)
- **Model**: GPT-5-mini via LangGraph `create_react_agent`
- **Tools**: `select_zone` (Shapely polygon), `run_solar_analysis` (PVGIS + pvlib pipeline)
- **Streaming**: Real-time SSE with thinking, tool progress, and results

### Chat Widget
- **Model**: GPT-5-mini via Chat Completions API (streaming)
- **Input**: Text + voice (Gradium STT in `stt_only` mode)
- **Actions**: Can trigger analysis, toggle heatmap, show report via `ACTION:` directives
- **Multi-turn**: Full conversation history maintained, analysis data injected as context

### 3D Generation
- **Test mode**: GPT-Image-1.5 contextual edit + SAM 3D Objects (~$0.02)
- **Demo mode**: Hunyuan 3D v3.1 text-to-3D (~$0.225)

### Solar Analysis Pipeline
- PVGIS v5.3 (SARAH3) for irradiance data
- pvlib for solar positions and POA calculations
- Shapely for panel layout optimization
- Hourly shadow matrix computation
- LCOE, performance ratio, CO2 avoidance metrics

## License

MIT
