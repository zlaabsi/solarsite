from fastapi import APIRouter
from models.schemas import Generate3DRequest, Generate3DResponse
from services.openai_service import generate_solar_farm_render
from services.fal_service import generate_3d_model

router = APIRouter()


@router.post("/api/generate-3d", response_model=Generate3DResponse)
async def generate_3d(req: Generate3DRequest):
    prompt = (
        f"Photorealistic aerial drone photograph of a large ground-mounted solar farm "
        f"with approximately {req.n_panels} panels on flat desert terrain. "
        f"Clear blue sky, realistic lighting, high detail."
    )
    render_image_url = await generate_solar_farm_render(prompt)
    model = generate_3d_model(render_image_url)

    return {
        "render_image_url": render_image_url,
        "model_glb_url": model["model_glb_url"],
        "thumbnail_url": model["thumbnail_url"],
    }
