# fastapi_app.py
"""
Entry point for FastAPI application, wiring up Ollama routers.
"""
from fastapi import FastAPI
from src.server.routes.ollama_api import router as ollama_router
from src.server.routes.assistant_ollama_api import router as assistant_ollama_router

app = FastAPI()

# Register routers
app.include_router(ollama_router)
app.include_router(assistant_ollama_router)

# Root endpoint
@app.get("/")
def root():
    return {"message": "Ollama FastAPI backend is running."}
