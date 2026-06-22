"""Text-to-Speech endpoint using Edge TTS (Indian Neural Voices) for ultra-low latency."""
import io
import logging
from typing import Optional

import edge_tts
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()

# Voice mapping for interviewer personas in Edge TTS (Indian accented English)
EDGE_VOICE_MAP = {
    "Alex": "en-IN-PrabhatNeural",      # Male - warm conversational HR
    "Vikram": "en-IN-PrabhatNeural",    # Male - deep systems architect
    "Sarah": "en-IN-NeerjaNeural",      # Female - technical lead
}

DEFAULT_EDGE_VOICE = "en-IN-PrabhatNeural"


class TTSRequest(BaseModel):
    text: str
    interviewer: Optional[str] = "Alex"


@router.post("/speak")
async def speak(request: TTSRequest):
    """Generate speech audio from text using Edge TTS neural voices."""
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Text is required.")

    voice = EDGE_VOICE_MAP.get(request.interviewer, DEFAULT_EDGE_VOICE)
    clean_text = request.text.strip()[:1500]

    try:
        communicate = edge_tts.Communicate(clean_text, voice)
        audio_buffer = io.BytesIO()
        
        # Accumulate the stream into a buffer for standard StreamingResponse compatibility
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_buffer.write(chunk["data"])
        
        audio_buffer.seek(0)
        return StreamingResponse(
            audio_buffer,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline; filename=speech.mp3",
                "Cache-Control": "no-cache",
            },
        )
    except Exception as e:
        logger.error(f"Edge TTS generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")


@router.get("/speak")
async def speak_stream(text: str, interviewer: str = "Alex"):
    """Stream speech audio chunk-by-chunk using Edge TTS for progressive playback."""
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="Text is required.")

    voice = EDGE_VOICE_MAP.get(interviewer, DEFAULT_EDGE_VOICE)
    clean_text = text.strip()[:1500]

    try:
        communicate = edge_tts.Communicate(clean_text, voice)

        async def audio_generator():
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    yield chunk["data"]

        return StreamingResponse(
            audio_generator(),
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline; filename=speech.mp3",
                "Cache-Control": "no-cache",
            },
        )
    except Exception as e:
        logger.error(f"Edge TTS streaming failed: {e}")
        raise HTTPException(status_code=500, detail=f"TTS streaming failed: {str(e)}")

