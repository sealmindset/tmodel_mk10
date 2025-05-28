# ollama_util.py
"""
Utility class for advanced Ollama operations, inspired by the original Node.js OllamaUtil class.
Handles model management, chat, completions, and status checks.
"""
from typing import List, Dict, Any, Optional
import ollama

class OllamaUtil:
    def __init__(self, default_model: str = 'llama4:latest'):
        self.default_model = default_model
        self.api_url = None  # Not used with Python module, but kept for compatibility

    def get_models(self) -> List[Dict[str, Any]]:
        response = ollama.list()
        return response['models']

    def get_model_names(self) -> List[str]:
        return [model['name'] for model in self.get_models()]

    def get_completion(self, prompt: str, model: Optional[str] = None, max_tokens: int = 100) -> str:
        if not model:
            model = self.default_model
        response = ollama.generate(model=model, prompt=prompt, options={"num_predict": max_tokens})
        return response['response']

    def get_chat_completion(self, messages: List[Dict[str, str]], model: Optional[str] = None, max_tokens: int = 100) -> str:
        if not model:
            model = self.default_model
        response = ollama.chat(model=model, messages=messages, options={"num_predict": max_tokens})
        return response['message']['content']

    def check_status(self) -> bool:
        try:
            models = self.get_models()
            return bool(models)
        except Exception:
            return False

ollama_util = OllamaUtil()
