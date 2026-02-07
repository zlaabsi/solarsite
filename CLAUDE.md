# SolarSite

AI-powered solar farm site assessment tool. Built for the {Tech: Europe} Paris 2026 hackathon.

## Stack

- **Backend**: FastAPI, pvlib, PVGIS v5.3 (SARAH3), OpenAI Responses API, fal.ai Trellis 2, Gradium WSS
- **Frontend**: React 18, MapLibre GL, deck.gl, Tailwind CSS
- **AI Agent**: LangGraph ReAct agent with 3 tools, streamed via SSE

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

| Directory | Contents |
|-----------|----------|
| `services/agent_service.py` | LangGraph ReAct agent (select_zone, run_solar_analysis, generate_3d_visualization) |
| `services/solar_engine.py` | pvlib solar positions + PVGIS hourly data retrieval |
| `services/panel_layout.py` | Shapely-based panel placement on polygon zones |
| `services/shadow_calc.py` | Inter-row shadow calculation |
| `services/yield_calc.py` | Energy yield, LCOE, CO2 metrics |
| `services/heatmap_gen.py` | Seasonal irradiance heatmaps |
| `services/openai_service.py` | GPT-4.1-mini vision + GPT Image rendering |
| `services/fal_service.py` | fal.ai Trellis 2 image-to-3D |
| `services/gradium_service.py` | Gradium STT/TTS via WebSocket |
| `routers/agent.py` | `POST /api/agent/run` — SSE streaming endpoint |
| `routers/analyze.py` | `POST /api/analyze` — direct analysis endpoint |
| `routers/generate_3d.py` | `POST /api/generate-3d` |
| `routers/image_analysis.py` | `POST /api/analyze-image` |
| `routers/voice.py` | `WS /ws/voice` |

### Frontend

| File | Role |
|------|------|
| `src/App.jsx` | Root — integrates agent hook, map, sidebar |
| `src/hooks/useAgent.js` | SSE client for LangGraph agent events |
| `src/hooks/useSolarAnalysis.js` | Direct API calls (fallback) |
| `src/hooks/useMapDraw.js` | Manual polygon drawing (legacy) |
| `src/hooks/useVoice.js` | WebSocket voice control |
| `src/components/AgentPanel.jsx` | Agent launch button + step progress |
| `src/components/MapView.jsx` | MapLibre + deck.gl satellite 3D map |
| `src/components/Dashboard.jsx` | KPI metrics display |

## Key conventions

- PVGIS returns POA components — `_add_derived_columns()` computes ghi/dni/poa_global
- OpenAI uses the Responses API (not Chat Completions)
- Gradium auth: `x-api-key` header (not Bearer)
- Default location: Dakhla, Morocco (23.7145, -15.9369)
