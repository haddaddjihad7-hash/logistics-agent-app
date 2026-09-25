# API Reference

Base URL: `http://127.0.0.1:8000` in local development, or the Nginx host in Docker.

## Authentication and Limits

When `API_KEY` is set, protected routes require `X-API-Key: <key>` or `Authorization: Bearer <key>`. Public routes are `/`, `/docs`, `/openapi.json`, `/redoc`, `/api/health`, `/metrics`, and the demo `/api/stream`. Requests are rate-limited by client address using `RATE_LIMIT_REQUESTS` per `RATE_LIMIT_WINDOW_SECONDS`. Every response includes `X-Request-ID`.

## Endpoints

### `GET /`
Returns service metadata and model candidates. Public.

### `GET /api/health`
Returns API, Gemini, ChromaDB, PostgreSQL pool, and Redis status. Public. A dependency may be `degraded` while the API remains available.

### `POST /api/diagnose`
Runs the deterministic multi-agent workflow.

Request:

```json
{"text":"CRITICAL ALERT: HYD-PUMP-02 has 7.4 mm/s vibration","approval_id":null}
```

Response includes `diagnosis`, `execution_trace`, `final_synthesis`, agent-specific data, `confidence_score`, `approval_required`, and an optional `approval_id`. Empty text returns `400`; authentication failures return `401`; rate limits return `429`; workflow failures return `500`.

### `POST /api/diagnose/stream`
Accepts the same request as `/api/diagnose` and returns `text/event-stream`. Events are `workflow_started`, `state_transition`, `done`, or `error`. Each transition payload includes timestamp, agent, action, and observation. Clients should honor the SSE `retry` value and reconnect with backoff.

### `GET /api/stream`
Public demonstration SSE stream used by the command console for connection status.

### `GET /api/episodic/search?q=<query>&k=3`
Queries the ChromaDB episodic index and caches repeated results in Redis. Protected when `API_KEY` is configured.

### `GET /metrics`
Prometheus exposition format with request count and latency metrics. Public to allow the internal Prometheus container to scrape it; place it behind authenticated ingress in an internet-facing deployment.

## Docker Services

`docker compose up --build` starts Nginx (`80`), backend (`8000`), frontend (`3000`), PostgreSQL, Redis, Prometheus, and Grafana (`3001`). The recommended operator URL is `http://localhost`; direct backend/frontend ports remain useful for local debugging.

For HTTPS, provide `fullchain.pem` and `privkey.pem` and use the production overlay documented in [README.md](../README.md). The overlay publishes only Nginx and redirects port 80 to 443.
