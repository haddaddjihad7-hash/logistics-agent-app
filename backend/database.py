"""Optional async PostgreSQL pool for high-frequency operational queries."""

import os
from typing import Any

_pool: Any = None


async def get_pool() -> Any:
    global _pool
    if _pool is None:
        try:
            import asyncpg
            _pool = await asyncpg.create_pool(
                dsn=os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@postgres:5432/multiagent"),
                min_size=1,
                max_size=int(os.environ.get("DB_POOL_MAX_SIZE", "10")),
                command_timeout=5,
            )
        except Exception:
            return None
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


async def database_health() -> str:
    pool = await get_pool()
    if pool is None:
        return "degraded"
    try:
        async with pool.acquire() as connection:
            await connection.fetchval("SELECT 1")
        return "online"
    except Exception:
        return "degraded"
