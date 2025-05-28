# assistant_ollama.py
"""
Python version of assistantOllama.js for use with FastAPI and the ollama Python module.
"""
from typing import List, Dict, Any
import ollama

class AssistantOllama:
    def __init__(self, default_model: str = 'llama2'):
        self.default_model = default_model

    def get_available_models(self) -> List[Dict[str, str]]:
        response = ollama.list()
        return [
            {
                'name': model['name'],
                'label': model['name'].replace(':', ' ').replace('@', ' ')
            }
            for model in response['models']
        ]

    def get_chat_response(self, model: str, message: str, context_enabled: bool = False) -> str:
        prompt = (
            f"You are a security expert. Context: Threat modeling. User: {message}"
            if context_enabled else message
        )
        response = ollama.generate(model=model or self.default_model, prompt=prompt, stream=False)
        return response['response']

assistant_ollama = AssistantOllama()
