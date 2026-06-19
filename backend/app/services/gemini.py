"""Groq service integration replacing Gemini for interview assessments and conversations."""
import asyncio
import json
import logging
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class GeminiService:
    """Service wrapper for Groq API, maintaining API compatibility with calling code."""

    def __init__(self) -> None:
        """Initialize the Groq service with the API key from settings."""
        self.api_key = self._normalize_api_key(
            settings.GROQ_API_KEY
        ) or self._normalize_api_key(settings.GEMINI_API_KEY)
        if self.api_key:
            logger.info("Groq API client service successfully initialized.")
        else:
            logger.warning("GROQ_API_KEY is not set. API calls will fail.")

    def _normalize_api_key(self, api_key: str) -> str:
        """Treat empty and documented placeholder credentials as missing."""
        key = (api_key or "").strip()
        placeholders = {
            "your-gemini-api-key",
            "your-gemini-api-key-here",
            "your-groq-api-key",
            "your-groq-api-key-here",
        }
        if key.lower() in placeholders:
            return ""
        return key

    def _clean_json_response(self, text: str) -> str:
        """Clean markdown codeblocks from JSON response text if present."""
        text = text.strip()
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        return text.strip()

    def _map_model_name(self, model_name: str) -> str:
        """Map Gemini model names to Groq model names if required for backwards compatibility."""
        if "gemini-2.5-pro" in model_name or "pro" in model_name.lower():
            return settings.GROQ_PRO_MODEL
        if "gemini-2.5-flash" in model_name or "flash" in model_name.lower():
            return settings.GROQ_FLASH_MODEL
        return model_name

    async def _call_groq_api_with_retry(
        self,
        prompt: str,
        model_name: str,
        system_instruction: Optional[str] = None,
        json_mode: bool = False,
    ) -> str:
        """Call Groq Chat Completions API using httpx with automatic 429 retries."""
        if not self.api_key:
            raise ValueError("GROQ_API_KEY is not set. Cannot call Groq API.")

        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        # Structure OpenAI/Groq messages format
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": model_name,
            "messages": messages,
            "temperature": 0.7,
        }

        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        max_retries = 3
        backoff_seconds = 2.0

        for attempt in range(max_retries):
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        url,
                        headers=headers,
                        json=payload,
                        timeout=45.0,
                    )
                    
                    # Rate limit retry handling
                    if response.status_code == 429:
                        retry_after = response.headers.get("retry-after")
                        sleep_time = (
                            float(retry_after)
                            if retry_after
                            else (backoff_seconds * (attempt + 1))
                        )
                        logger.warning(
                            "Groq API rate-limited (429). Retrying in "
                            f"{sleep_time} seconds (attempt {attempt + 1}/{max_retries})..."
                        )
                        await asyncio.sleep(sleep_time)
                        continue

                    response.raise_for_status()
                    res_json = response.json()
                    return res_json["choices"][0]["message"]["content"]
            except Exception as e:
                if attempt < max_retries - 1:
                    sleep_time = backoff_seconds * (attempt + 1)
                    logger.warning(
                        f"Groq API encountered error: {e}. Retrying in {sleep_time} seconds..."
                    )
                    await asyncio.sleep(sleep_time)
                    continue
                logger.error(f"Groq API call failed after {max_retries} attempts: {e}")
                raise

        raise RuntimeError("Groq API call failed to return a response.")

    async def generate_text(
        self,
        prompt: str,
        model_name: str,
        system_instruction: Optional[str] = None,
    ) -> str:
        """Asynchronously generate raw text from Groq."""
        model_name = self._map_model_name(model_name)
        try:
            return await self._call_groq_api_with_retry(
                prompt=prompt,
                model_name=model_name,
                system_instruction=system_instruction,
                json_mode=False,
            )
        except Exception as e:
            if model_name == settings.GROQ_PRO_MODEL:
                logger.warning(
                    f"Groq Pro failed: {e}. Retrying text generation with Groq Flash fallback..."
                )
                try:
                    return await self._call_groq_api_with_retry(
                        prompt=prompt,
                        model_name=settings.GROQ_FLASH_MODEL,
                        system_instruction=system_instruction,
                        json_mode=False,
                    )
                except Exception as flash_err:
                    logger.error(f"Groq Flash fallback also failed: {flash_err}")
            logger.error(f"Error calling Groq text generation: {e}")
            raise

    async def generate_json(
        self,
        prompt: str,
        model_name: str,
        system_instruction: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Asynchronously generate a parsed JSON dictionary from Groq."""
        model_name = self._map_model_name(model_name)
        raw_response = ""
        try:
            raw_response = await self._call_groq_api_with_retry(
                prompt=prompt,
                model_name=model_name,
                system_instruction=system_instruction,
                json_mode=True,
            )
            cleaned_response = self._clean_json_response(raw_response)
            return json.loads(cleaned_response)
        except json.JSONDecodeError as e:
            logger.error(
                "Failed to parse Groq response as JSON. "
                f"Raw response: {raw_response}. Error: {e}"
            )
            try:
                start = cleaned_response.find("{")
                end = cleaned_response.rfind("}") + 1
                if start != -1 and end != -1:
                    return json.loads(cleaned_response[start:end])
            except Exception:
                pass
            raise ValueError(f"Groq response was not valid JSON: {e}")
        except Exception as e:
            if model_name == settings.GROQ_PRO_MODEL:
                logger.warning(
                    f"Groq Pro failed: {e}. Retrying JSON generation with Groq Flash fallback..."
                )
                try:
                    raw_response = await self._call_groq_api_with_retry(
                        prompt=prompt,
                        model_name=settings.GROQ_FLASH_MODEL,
                        system_instruction=system_instruction,
                        json_mode=True,
                    )
                    cleaned_response = self._clean_json_response(raw_response)
                    return json.loads(cleaned_response)
                except Exception as flash_err:
                    logger.error(f"Groq Flash fallback also failed: {flash_err}")
            logger.error(f"Error calling Groq JSON generation: {e}")
            raise

    async def generate_embedding(
        self,
        text: str,
        model_name: str = "models/text-embedding-04",
    ) -> List[float]:
        """Generate dummy vector embeddings (for database compatibility, not used in core logic)."""
        return [0.0] * 768
