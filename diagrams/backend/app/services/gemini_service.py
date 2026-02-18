from google import genai
from app.utils.format_message import format_user_message
from typing import AsyncGenerator
import logging
import tiktoken

logger = logging.getLogger(__name__)


class GeminiService:
    MODEL = "gemini-2.5-flash"

    def __init__(self):
        self.encoding = tiktoken.get_encoding("cl100k_base")

    def call_gemini_api(
        self, system_prompt: str, data: dict, api_key: str | None = None
    ) -> str:
        if not api_key:
            raise ValueError("A Gemini API key is required. Please provide your API key in settings.")
        user_message = format_user_message(data)
        client = genai.Client(api_key=api_key)

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
        if not api_key:
            raise ValueError("A Gemini API key is required. Please provide your API key in settings.")
        user_message = format_user_message(data)
        client = genai.Client(api_key=api_key)

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
