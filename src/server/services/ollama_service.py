# ollama_service.py
"""
Service for interacting with the local Ollama instance using the Python ollama module.
"""
from typing import List, Dict, Any
import ollama

class OllamaService:
    def __init__(self, default_model: str = 'llama2'):
        self.default_model = default_model

    def get_models(self) -> List[str]:
        """Return a list of available Ollama model names."""
        response = ollama.list()
        return [model['name'] for model in response['models']]

    def chat(self, messages: List[Dict[str, str]], model: str = None) -> str:
        """Send a chat message to an Ollama model and return the response text."""
        if not model:
            model = self.default_model
        response = ollama.chat(model=model, messages=messages)
        return response['message']['content']

    def generate(self, prompt: str, model: str = None) -> str:
        """Generate a completion from an Ollama model."""
        if not model:
            model = self.default_model
        response = ollama.generate(model=model, prompt=prompt)
        return response['response']

ollama_service = OllamaService()
