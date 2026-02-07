# SolarSite

AI-powered solar farm site assessment tool. Built for the {Tech: Europe} Paris 2026 hackathon.

## Stack

- **Backend**: FastAPI, pvlib, PVGIS v5.3 (SARAH3), OpenAI Responses API (GPT-5-mini, GPT-Image-1.5), fal.ai (SAM 3D / Hunyuan 3D), Gradium WSS
- **Frontend**: React 18, MapLibre GL, deck.gl, Tailwind CSS, @google/model-viewer
- **AI Agent**: LangGraph ReAct agent (GPT-5-mini) with 3 tools, streamed via SSE

## Running

```bash
# Backend (port 8000)
cd backend && pip install -r requirements.txt && uvicorn main:app --reload

# Frontend (port 5173)
cd frontend && npm install && npm run dev
```

Requires `.env` files in `backend/` and `frontend/` — see `.env.example` at root.

## Architecture

### Backend

| File | Contents |
|------|----------|
| `services/agent_service.py` | LangGraph ReAct agent (GPT-5-mini) with 3 tools: select_zone, run_solar_analysis, generate_3d_visualization |
| `services/geo_utils.py` | Timezone lookup (timezonefinder) + terrain classification from elevation |
| `services/solar_engine.py` | pvlib solar positions + PVGIS v5.3 hourly data retrieval (SARAH3) |
| `services/panel_layout.py` | Shapely-based panel placement on polygon zones |
| `services/shadow_calc.py` | Inter-row shadow calculation (hourly shadow matrix) |
| `services/yield_calc.py` | Energy yield, LCOE, CO2 metrics, performance ratio |
| `services/heatmap_gen.py` | Seasonal irradiance heatmaps (summer/winter grids) |
| `services/openai_service.py` | GPT-5-mini vision + GPT-5-nano voice + GPT-Image-1.5 rendering |
| `services/fal_service.py` | Dual 3D: SAM 3D Objects (test, $0.02) / Hunyuan 3D v3.1 (demo, $0.225) |
| `services/gradium_service.py` | Gradium STT/TTS via WebSocket |
| `routers/agent.py` | `POST /api/agent/run` — SSE streaming endpoint |
| `routers/analyze.py` | `POST /api/analyze` — direct analysis endpoint |
| `routers/generate_3d.py` | `POST /api/generate-3d` — dual mode (test/demo) |
| `routers/image_analysis.py` | `POST /api/analyze-image` — terrain vision analysis |
| `routers/voice.py` | `WS /ws/voice` — real-time STT/TTS |

### Frontend

| File | Role |
|------|------|
| `src/App.jsx` | Root — hash routing between LandingPage (`#/`) and AppView (`#/demo`) |
| `src/components/LandingPage.jsx` | Marketing page with hero, features bento grid, scroll animations |
| `src/components/AppView.jsx` | Main app layout: ticker bar, nav, sidebar (320px), map area, overlays |
| `src/components/MapView.jsx` | MapLibre + deck.gl satellite map, terrain 3D, edit handles |
| `src/components/ModelViewer.jsx` | @google/model-viewer wrapper for GLB files |
| `src/components/ReportPanel.jsx` | Detailed site assessment report (table format) |
| `src/components/AgentPanel.jsx` | Agent launch/stop + step progress display |
| `src/components/Dashboard.jsx` | KPI metrics grid |
| `src/components/DrawingTool.jsx` | Polygon drawing controls (start/finish/cancel) |
| `src/components/VoiceControl.jsx` | Microphone toggle, transcript, voice playback |
| `src/components/TimeSlider.jsx` | Shadow sim controls (hour/month sliders, presets) |
| `src/components/SeasonCompare.jsx` | Summer vs winter irradiance comparison cards |
| `src/components/PanelOverlay.jsx` | deck.gl PolygonLayer factory for solar panels |
| `src/components/ShadowRenderer.jsx` | deck.gl shadow polygon layer factory |
| `src/components/HeatmapLayer.jsx` | deck.gl heatmap layer (blue-to-red gradient) |
| `src/hooks/useAgent.js` | SSE client for LangGraph agent events |
| `src/hooks/useSolarAnalysis.js` | Direct API calls (`/api/analyze`, `/api/generate-3d`, `/api/analyze-image`) |
| `src/hooks/usePolygonEdit.js` | Polygon translate/resize/rotate with geometry math |
| `src/hooks/useMapDraw.js` | Manual polygon drawing state (legacy) |
| `src/hooks/useVoice.js` | WebSocket voice I/O (MediaRecorder + AudioContext) |
| `src/utils/color-scales.js` | Irradiance-to-color gradient mapping |
| `src/utils/shadow-geometry.js` | Shadow polygon calculation from solar position |
| `src/utils/panel-grid.js` | Regular panel grid generation within polygon |

## Key conventions

- PVGIS returns POA components — `_add_derived_columns()` computes ghi/dni/poa_global
- OpenAI uses the Responses API (not Chat Completions) with `reasoning={"effort": "low"}`
- Gradium auth: `x-api-key` header (not Bearer)
- Default map center: 23.7145, -15.9369 (configurable — all GIS data is derived dynamically from coordinates)
- Timezone, terrain classification, and seasonal shadow losses are computed dynamically via geo_utils.py (timezonefinder + elevation-based classification)
- Financial parameters (CAPEX, OPEX, WACC, lifetime, CO2 factor) are configurable via API request fields with sensible defaults
- Dual 3D modes: test (GPT-Image-1.5 → SAM 3D, cheap) vs demo (Hunyuan 3D text-to-3D, realistic)
- Tool returns to LLM must be compact — never return base64 data URIs (store in agent_ref, send via SSE only)
- After agent analysis, the zone polygon can be edited (translate/resize/rotate) and re-analyzed via `POST /api/analyze`
- Polygon edits use `effectivePolygon`/`effectiveAnalysis` overrides in AppView — reset when agent runs again
- Azimuth derivation on rotation: `((180 + cumulativeRotationDeg) % 360 + 360) % 360`
