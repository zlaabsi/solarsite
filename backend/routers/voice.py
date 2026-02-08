import base64
import os
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.gradium_service import transcribe_audio_stream, synthesize_speech
from services.openai_service import generate_voice_response

router = APIRouter()


@router.websocket("/ws/voice")
async def voice_ws(ws: WebSocket):
    await ws.accept()
    api_key = os.getenv("GRADIUM_API_KEY", "")
    analysis_data = {}
    stt_only = False

    try:
        while True:
            msg = await ws.receive_json()

            if msg.get("type") == "set_mode":
                stt_only = msg.get("stt_only", False)
                continue

            if msg.get("type") == "set_context":
                analysis_data = msg.get("data", {})
                continue

            if msg.get("type") == "command":
                user_text = msg.get("text", "")
                result = await generate_voice_response(user_text, analysis_data)
                await ws.send_json({"type": "response", **result})

                if api_key:
                    audio = await synthesize_speech(
                        api_key, result.get("spoken_response", "")
                    )
                    await ws.send_json(
                        {
                            "type": "audio",
                            "data": base64.b64encode(audio).decode("utf-8"),
                        }
                    )

            elif msg.get("type") == "audio":
                chunk = msg.get("data", "")
                if api_key and chunk:

                    async def single_chunk():
                        yield chunk

                    async for text in transcribe_audio_stream(
                        api_key, single_chunk()
                    ):
                        await ws.send_json({"type": "transcript", "text": text})
                        if not stt_only:
                            result = await generate_voice_response(
                                text, analysis_data
                            )
                            await ws.send_json({"type": "response", **result})
                            audio = await synthesize_speech(
                                api_key, result.get("spoken_response", "")
                            )
                            await ws.send_json(
                                {
                                    "type": "audio",
                                    "data": base64.b64encode(audio).decode("utf-8"),
                                }
                            )

    except WebSocketDisconnect:
        pass
