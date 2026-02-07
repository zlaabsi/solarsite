import base64
import json
from openai import AsyncOpenAI

MODEL_VISION = "gpt-4.1-mini"
MODEL_TEXT = "gpt-4.1-mini"


async def analyze_terrain_image(image_bytes: bytes, lat: float, lon: float) -> dict:
    client = AsyncOpenAI()
    b64 = base64.b64encode(image_bytes).decode("utf-8")

    response = await client.responses.create(
        model=MODEL_VISION,
        input=[
            {
                "role": "system",
                "content": [
                    {
                        "type": "input_text",
                        "text": (
                            "You are a solar site assessment expert. "
                            "Return ONLY valid JSON with keys: "
                            "terrain_type, slope_estimate_deg, obstacles, "
                            "vegetation_coverage_pct, soil_assessment, "
                            "access_roads_visible, water_features_visible, "
                            "overall_suitability, recommendations."
                        ),
                    }
                ],
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": f"Analyze terrain at {lat}, {lon}.",
                    },
                    {
                        "type": "input_image",
                        "image_url": f"data:image/jpeg;base64,{b64}",
                    },
                ],
            },
        ],
    )

    text = response.output_text
    text = text.replace("```json", "").replace("```", "").strip()
    return json.loads(text)


async def generate_solar_farm_render(prompt: str) -> str:
    client = AsyncOpenAI()
    result = await client.images.generate(
        model="gpt-image-1.5",
        prompt=prompt,
        quality="low",
        size="1792x1024",
    )
    return result.data[0].url


async def generate_voice_response(user_text: str, analysis_data: dict) -> dict:
    client = AsyncOpenAI()
    response = await client.responses.create(
        model=MODEL_TEXT,
        input=[
            {
                "role": "system",
                "content": [
                    {
                        "type": "input_text",
                        "text": (
                            "You are SolarSite's voice assistant. "
                            "Respond with JSON {spoken_response, action}. "
                            "Actions: set_time, zoom_to, toggle_heatmap, show_report, or null. "
                            f"Analysis data: {json.dumps(analysis_data)}"
                        ),
                    }
                ],
            },
            {
                "role": "user",
                "content": [{"type": "input_text", "text": user_text}],
            },
        ],
    )
    text = response.output_text
    text = text.replace("```json", "").replace("```", "").strip()
    return json.loads(text)
