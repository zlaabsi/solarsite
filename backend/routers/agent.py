import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from services.agent_service import SolarAgent

router = APIRouter()


class AgentRunRequest(BaseModel):
    latitude: float = 23.7145
    longitude: float = -15.9369
    area_hectares: float = 5.0
    mode: str = "test"  # "test" (SAM $0.02) or "demo" (Hunyuan $0.225)


@router.post("/api/agent/run")
async def run_agent(req: AgentRunRequest):
    agent = SolarAgent(mode=req.mode)

    async def event_stream():
        try:
            async for event in agent.run_stream(
                req.latitude, req.longitude, req.area_hectares
            ):
                yield f"data: {json.dumps(event, default=str)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
