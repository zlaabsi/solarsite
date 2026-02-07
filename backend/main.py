from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import analyze, image_analysis, generate_3d, voice, agent

app = FastAPI(title="SolarSite API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze.router)
app.include_router(image_analysis.router)
app.include_router(generate_3d.router)
app.include_router(voice.router)
app.include_router(agent.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
