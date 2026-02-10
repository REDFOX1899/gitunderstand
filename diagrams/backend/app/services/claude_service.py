from anthropic import Anthropic, AsyncAnthropic
from dotenv import load_dotenv
from app.utils.format_message import format_user_message
from typing import AsyncGenerator

load_dotenv()


class ClaudeService:
    MODEL = "claude-sonnet-4-5-20250929"

    def __init__(self):
        self.default_client = Anthropic()
        self.async_client = AsyncAnthropic()

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
        client = AsyncAnthropic(api_key=api_key) if api_key else self.async_client

        async with client.messages.stream(
            model=self.MODEL,
            max_tokens=8192,
            temperature=0,
            system=system_prompt,
            messages=[
                {"role": "user", "content": [{"type": "text", "text": user_message}]}
            ],
        ) as stream:
            async for text in stream.text_stream:
                yield text

    def count_tokens(self, prompt: str) -> int:
        response = self.default_client.messages.count_tokens(
            model=self.MODEL,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.input_tokens
