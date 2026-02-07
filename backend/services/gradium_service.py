import asyncio
import base64
import json
import websockets

GRADIUM_STT_ENDPOINT = "wss://eu.api.gradium.ai/api/speech/asr"
GRADIUM_TTS_ENDPOINT = "wss://eu.api.gradium.ai/api/speech/tts"


async def transcribe_audio_stream(api_key: str, audio_chunks):
    async with websockets.connect(
        GRADIUM_STT_ENDPOINT,
        extra_headers={"x-api-key": api_key},
    ) as ws:
        setup = json.dumps(
            {
                "type": "setup",
                "model_name": "default",
                "input_format": "pcm",
            }
        )
        await ws.send(setup)

        async for chunk in audio_chunks:
            await ws.send(json.dumps({"type": "audio", "audio": chunk}))
            try:
                response = await asyncio.wait_for(ws.recv(), timeout=0.05)
                msg = json.loads(response)
                if msg.get("type") == "text":
                    yield msg["text"]
            except asyncio.TimeoutError:
                continue


async def synthesize_speech(
    api_key: str, text: str, voice_id: str = None
) -> bytes:
    audio_chunks = []
    async with websockets.connect(
        GRADIUM_TTS_ENDPOINT,
        extra_headers={"x-api-key": api_key},
    ) as ws:
        setup = {
            "type": "setup",
            "model_name": "default",
            "output_format": "wav",
        }
        if voice_id:
            setup["voice_id"] = voice_id
        await ws.send(json.dumps(setup))

        await ws.send(json.dumps({"type": "text", "text": text}))

        async for message in ws:
            msg = json.loads(message)
            if msg.get("type") == "audio":
                audio_chunks.append(base64.b64decode(msg["audio"]))
            if msg.get("type") == "done":
                break

    return b"".join(audio_chunks)
