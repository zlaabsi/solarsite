from fastapi import APIRouter, UploadFile, File, Form
from services.openai_service import analyze_terrain_image

router = APIRouter()


@router.post("/api/analyze-image")
async def analyze_image(
    image: UploadFile = File(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
):
    image_bytes = await image.read()
    result = await analyze_terrain_image(image_bytes, latitude, longitude)
    return result
