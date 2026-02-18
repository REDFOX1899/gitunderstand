from google import genai
from app.utils.format_message import format_user_message
from typing import AsyncGenerator
import logging
import os
import tiktoken

logger = logging.getLogger(__name__)


class GeminiService:
    MODEL = "gemini-2.5-flash"

    def __init__(self):
        self.encoding = tiktoken.get_encoding("cl100k_base")
        self.server_api_key = os.environ.get("GEMINI_API_KEY")

    def _get_api_key(self, api_key: str | None) -> str:
        """Return user key if provided, else fall back to server key."""
        key = api_key or self.server_api_key
        if not key:
            raise ValueError("A Gemini API key is required. Please provide your API key in settings.")
        return key

    def call_gemini_api(
        self, system_prompt: str, data: dict, api_key: str | None = None
    ) -> str:
        effective_key = self._get_api_key(api_key)
        user_message = format_user_message(data)
        client = genai.Client(api_key=effective_key)

        response = client.models.generate_content(
            model=self.MODEL,
            contents=user_message,
            config=genai.types.GenerateContentConfig(
                system_instruction=system_prompt,
                max_output_tokens=8192,
                temperature=0,
            ),
        )
        return response.text

    async def call_gemini_api_stream(
        self,
        system_prompt: str,
        data: dict,
        api_key: str | None = None,
    ) -> AsyncGenerator[str, None]:
        effective_key = self._get_api_key(api_key)
        user_message = format_user_message(data)
        client = genai.Client(api_key=effective_key)

        response = client.models.generate_content_stream(
            model=self.MODEL,
            contents=user_message,
            config=genai.types.GenerateContentConfig(
                system_instruction=system_prompt,
                max_output_tokens=8192,
                temperature=0,
            ),
        )

        for chunk in response:
            if chunk.text:
                yield chunk.text

    def count_tokens(self, prompt: str) -> int:
        return len(self.encoding.encode(prompt))
