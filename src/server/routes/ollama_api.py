"""
Ollama API endpoints for FastAPI server.
"""
from fastapi import APIRouter, HTTPException
import httpx
import os
from typing import Dict, Any

# Create router
router = APIRouter(prefix="/api/ollama", tags=["ollama"])

# Get Ollama server URL from environment or use default
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")

@router.get("/")
async def health_check():
    """Health check endpoint for Ollama API"""
    return {"status": "ok", "message": "Ollama API is running"}

@router.post("/generate")
async def generate(request: Dict[Any, Any]):
    """
    Generate text using Ollama models
    """
    try:
        # Extract model and prompt from request
        model = request.get("model", "llama4:latest")
        prompt = request.get("prompt", "")
        
        if not prompt:
            raise HTTPException(status_code=400, detail="Prompt is required")
        
        # Prepare payload for Ollama
        ollama_payload = {
            "model": model,
            "prompt": prompt,
            "stream": False
        }
        
        # Call Ollama API
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(f"{OLLAMA_BASE_URL}/api/generate", json=ollama_payload)
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Ollama API error: {response.text}"
                )
                
            return response.json()
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Request to Ollama timed out")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Error communicating with Ollama: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.get("/models")
async def list_models():
    """List available Ollama models"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Ollama API error: {response.text}"
                )
                
            return response.json()
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Request to Ollama timed out")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Error communicating with Ollama: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
