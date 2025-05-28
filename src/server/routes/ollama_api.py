# ollama_api.py
"""
FastAPI router for Ollama endpoints. Provides endpoints for model listing, chat, and text generation.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
from src.server.services.ollama_service import ollama_service

router = APIRouter(prefix="/api/ollama", tags=["ollama"])

class ChatMessage(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: Optional[str] = None

class GenerateRequest(BaseModel):
    prompt: str
    model: Optional[str] = None

@router.get("/models")
def list_models():
    try:
        models = ollama_service.get_models()
        return {"models": models}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat")
def chat(request: ChatRequest):
    try:
        messages = [msg.dict() for msg in request.messages]
        response = ollama_service.chat(messages=messages, model=request.model)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate")
def generate(request: GenerateRequest):
    try:
        response = ollama_service.generate(prompt=request.prompt, model=request.model)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
