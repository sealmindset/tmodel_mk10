"""
Assistant-specific Ollama API endpoints for FastAPI server.
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
import httpx
import os
from typing import Dict, Any, List, Optional
import json

# Create router
router = APIRouter(prefix="/api/assistant/ollama", tags=["assistant"])

# Get Ollama server URL from environment or use default
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")

@router.get("/")
async def health_check():
    """Health check endpoint for Assistant Ollama API"""
    return {"status": "ok", "message": "Assistant Ollama API is running"}

@router.post("/generate")
async def generate_assistant_response(request: Dict[Any, Any]):
    """
    Generate text for assistant using Ollama models with context
    """
    try:
        # Extract parameters from request
        model = request.get("model", "llama4:latest")
        prompt = request.get("prompt", "")
        context = request.get("context", [])
        
        if not prompt:
            raise HTTPException(status_code=400, detail="Prompt is required")
        
        # Format context and prompt for Ollama
        formatted_prompt = ""
        
        # Add previous conversation context if provided
        if context:
            for message in context:
                role = message.get("role", "").lower()
                content = message.get("content", "")
                
                if role == "user":
                    formatted_prompt += f"User: {content}\n\n"
                elif role == "assistant":
                    formatted_prompt += f"Assistant: {content}\n\n"
                else:
                    # Include system messages or other roles as context
                    formatted_prompt += f"{content}\n\n"
        
        # Add current prompt
        formatted_prompt += f"User: {prompt}\n\nAssistant:"
        
        # Prepare payload for Ollama
        ollama_payload = {
            "model": model,
            "prompt": formatted_prompt,
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
                
            ollama_response = response.json()
            
            # Format response for the assistant interface
            return {
                "response": ollama_response.get("response", ""),
                "model": model,
                "total_tokens": ollama_response.get("total_tokens", 0),
                "prompt_tokens": ollama_response.get("prompt_tokens", 0),
                "completion_tokens": ollama_response.get("completion_tokens", 0)
            }
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Request to Ollama timed out")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Error communicating with Ollama: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/chat")
async def chat_assistant(request: Dict[Any, Any]):
    """
    Chat with assistant using Ollama chat endpoint
    """
    try:
        # Extract parameters from request
        model = request.get("model", "llama4:latest")
        messages = request.get("messages", [])
        
        if not messages:
            raise HTTPException(status_code=400, detail="Messages are required")
        
        # Prepare payload for Ollama
        ollama_payload = {
            "model": model,
            "messages": messages,
            "stream": False
        }
        
        # Call Ollama API
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(f"{OLLAMA_BASE_URL}/api/chat", json=ollama_payload)
            
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

@router.get("/available")
async def check_ollama_available():
    """Check if Ollama is available and responding"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            return {
                "available": response.status_code == 200,
                "message": "Ollama is available" if response.status_code == 200 else "Ollama is not responding correctly"
            }
    except Exception as e:
        return {
            "available": False,
            "message": f"Ollama is not available: {str(e)}"
        }
