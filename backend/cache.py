"""Best-effort Redis cache with graceful local development fallback."""

import json
import os
from typing import Any

_client: Any = None


async def get_client() -> Any:
    global _client
    if _client is None:
        try:
            from redis.asyncio import Redis
            _client = Redis.from_url(os.environ.get("REDIS_URL", "redis://redis:6379/0"), decode_responses=True)
        except Exception:
            return None
    return _client


async def get_json(key: str) -> Any:
    client = await get_client()
    if client is None:
        return None
    try:
        value = await client.get(key)
        return json.loads(value) if value else None
    except Exception:
        return None


async def set_json(key: str, value: Any, ttl: int = 300) -> None:
    client = await get_client()
    if client is None:
        return
    try:
        await client.set(key, json.dumps(value), ex=ttl)
    except Exception:
        return
