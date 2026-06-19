"""Prompts module for loading AI agent prompt templates."""
import os

def load_prompt(name: str) -> str:
    """Load a prompt template by file name."""
    path = os.path.join(os.path.dirname(__file__), f"{name}.txt")
    with open(path, "r", encoding="utf-8") as f:
        return f.read()
