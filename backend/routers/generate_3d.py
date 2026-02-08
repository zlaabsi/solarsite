import asyncio
import logging

from fastapi import APIRouter, HTTPException
from models.schemas import Generate3DRequest, Generate3DResponse
from services.openai_service import generate_solar_farm_render, generate_contextual_render
from services.fal_service import generate_3d_test, generate_3d_demo

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/api/generate-3d", response_model=Generate3DResponse)
async def generate_3d(req: Generate3DRequest):
    prompt = (
        f"3D diorama: square desert terrain plot with a solar farm inside. "
        f"{req.n_panels} dark photovoltaic panels in rows on sandy ground. "
        f"Bare land around, clear sky, realistic miniature style."
    )

    try:
        if req.render_type == "demo":
            logger.info("3D demo mode — Hunyuan text-to-3D")
            model = await asyncio.to_thread(generate_3d_demo, prompt)
            return {
                "render_image_url": "",
                "model_glb_url": model["model_glb_url"],
                "thumbnail_url": model["thumbnail_url"],
            }

        # Test mode: try contextual render, fallback to generic
        render_image_url = None
        if req.map_screenshot:
            try:
                logger.info("3D test mode — contextual render from screenshot (%d chars)", len(req.map_screenshot))
                render_image_url = await generate_contextual_render(req.map_screenshot, req.n_panels)
                logger.info("Contextual render succeeded")
            except Exception as ctx_err:
                logger.warning("Contextual render failed, falling back to generic: %s", ctx_err)
                render_image_url = None

        if not render_image_url:
            logger.info("3D test mode — generic render")
            render_image_url = await generate_solar_farm_render(prompt)

        logger.info("Render image obtained, calling SAM 3D Objects...")
        model = await asyncio.to_thread(generate_3d_test, render_image_url)
        logger.info("3D model generated: %s", model.get("model_glb_url", "")[:80])
        return {
            "render_image_url": render_image_url,
            "model_glb_url": model["model_glb_url"],
            "thumbnail_url": model["thumbnail_url"],
        }
    except Exception as e:
        logger.error("generate_3d endpoint failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e
