# assistant_ollama_api.py
"""
FastAPI router for assistant Ollama endpoints, adapted from assistantOllama.js.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from src.server.services.assistant_ollama import assistant_ollama

router = APIRouter(prefix="/api/assistant/ollama", tags=["assistant-ollama"])

class ChatRequest(BaseModel):
    model: Optional[str] = None
    message: str
    context_enabled: Optional[bool] = False

@router.get("/models")
def get_available_models():
    try:
        models = assistant_ollama.get_available_models()
        return {"models": models}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat")
def get_chat_response(request: ChatRequest):
    try:
        response = assistant_ollama.get_chat_response(
            model=request.model,
            message=request.message,
            context_enabled=request.context_enabled
        )
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
