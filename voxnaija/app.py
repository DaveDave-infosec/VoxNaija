import io
import os
from pathlib import Path
import edge_tts
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="VoxNaija")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

VOICES = {
    "ng-female": "en-NG-EzinneNeural",
    "ng-male": "en-NG-AbeoNeural",
    "us-female": "en-US-JennyNeural",
    "us-male": "en-US-GuyNeural",
    "gb-female": "en-GB-SoniaNeural",
    "gb-male": "en-GB-RyanNeural",
}


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    voice: str
    rate: int = Field(default=0, ge=-50, le=50)
    pitch: int = Field(default=0, ge=-50, le=50)


@app.post("/api/generate")
async def generate(req: TTSRequest):
    if req.voice not in VOICES:
        raise HTTPException(status_code=400, detail="Invalid voice selection")

    voice_name = VOICES[req.voice]
    rate_str = f"{'+' if req.rate >= 0 else ''}{req.rate}%"
    pitch_str = f"{'+' if req.pitch >= 0 else ''}{req.pitch}Hz"

    try:
        communicate = edge_tts.Communicate(
            req.text, voice_name, rate=rate_str, pitch=pitch_str
        )
        audio_buffer = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_buffer.write(chunk["data"])
        audio_buffer.seek(0)
        audio_bytes = audio_buffer.read()

        if not audio_bytes:
            raise HTTPException(status_code=500, detail="No audio generated")

        return Response(content=audio_bytes, media_type="audio/mpeg")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")


# Local dev only — serve static files via FastAPI.
# On Vercel, the CDN serves /public/** automatically, so this block is skipped.
if not os.environ.get("VERCEL"):
    PUBLIC_DIR = Path(__file__).resolve().parent / "public"
    if PUBLIC_DIR.exists():
        app.mount("/", StaticFiles(directory=str(PUBLIC_DIR), html=True), name="static")
