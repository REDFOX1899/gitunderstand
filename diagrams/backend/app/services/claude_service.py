from anthropic import Anthropic
from app.utils.format_message import format_user_message
from typing import AsyncGenerator
import logging
import tiktoken
import aiohttp
import json
import os

logger = logging.getLogger(__name__)


class ClaudeService:
    MODEL = "claude-sonnet-4-5-20250929"

    def __init__(self):
        self.api_key = (os.getenv("ANTHROPIC_API_KEY") or "").strip()
        self.default_client = Anthropic()
        self.encoding = tiktoken.get_encoding("cl100k_base")
        self.base_url = "https://api.anthropic.com/v1/messages"
        self._session: aiohttp.ClientSession | None = None

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
        return self._session

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()
            self._session = None

    def call_claude_api(
        self, system_prompt: str, data: dict, api_key: str | None = None
    ) -> str:
        user_message = format_user_message(data)
        client = Anthropic(api_key=api_key) if api_key else self.default_client

        message = client.messages.create(
            model=self.MODEL,
            max_tokens=8192,
            temperature=0,
            system=system_prompt,
            messages=[
                {"role": "user", "content": [{"type": "text", "text": user_message}]}
            ],
        )
        return message.content[0].text  # type: ignore

    async def call_claude_api_stream(
        self,
        system_prompt: str,
        data: dict,
        api_key: str | None = None,
    ) -> AsyncGenerator[str, None]:
        user_message = format_user_message(data)

        headers = {
            "Content-Type": "application/json",
            "x-api-key": api_key or self.api_key,
            "anthropic-version": "2023-06-01",
        }

        payload = {
            "model": self.MODEL,
            "max_tokens": 8192,
            "temperature": 0,
            "system": system_prompt,
            "messages": [
                {"role": "user", "content": user_message}
            ],
            "stream": True,
        }

        session = await self._get_session()
        async with session.post(
            self.base_url, headers=headers, json=payload
        ) as response:
            if response.status != 200:
                error_text = await response.text()
                logger.error("Anthropic API error (status %d): %s", response.status, error_text)
                raise ValueError(
                    f"Anthropic API returned status {response.status}: {error_text}"
                )

            async for line in response.content:
                line = line.decode("utf-8").strip()
                if not line:
                    continue

                if line.startswith("data: "):
                    json_str = line[6:]
                    if json_str == "[DONE]":
                        break
                    try:
                        event_data = json.loads(json_str)
                        event_type = event_data.get("type")

                        if event_type == "content_block_delta":
                            delta = event_data.get("delta", {})
                            if delta.get("type") == "text_delta":
                                text = delta.get("text", "")
                                if text:
                                    yield text
                        elif event_type == "error":
                            error_msg = event_data.get("error", {}).get("message", "Unknown error")
                            raise ValueError(f"Anthropic API error: {error_msg}")
                    except json.JSONDecodeError:
                        continue

    def count_tokens(self, prompt: str) -> int:
        return len(self.encoding.encode(prompt))
