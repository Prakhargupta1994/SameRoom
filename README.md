# SameRoom

**SameRoom turns a photo of your actual room into a photorealistic redesign of that same room, powered by Meta's Muse Image and Muse Spark, and it is built to hold up under real traffic.** Your walls, windows and layout stay; everything else can change, just by asking.

- **It redesigns your real space.** Muse Image edits your own photo in place, so the result is unmistakably your room, not a stock render.
- **It understands the room.** Muse Spark reads the photo, estimates its size and checks which bed sizes actually fit, returning structured data the app displays.
- **It protects itself and its budget.** Per-device rate limits, a server-wide daily cap on Meta calls, a bounded request queue and a render cache keep it fast, fair and affordable.
- **It fails clearly, never silently.** Every Meta call has a time limit, one automatic retry and a plain-English error, with a self-test and live stats built in.

---

## How Meta's models are used

| Model | Endpoint | Role |
|---|---|---|
| **Muse Image** (`muse-image-1.0`) | `POST /v1/images/edits` | Restyles the user's own photo (paint, furniture, decor, lighting) |
| **Muse Image** | `POST /v1/images/generations` | Fallback when no photo is supplied |
| **Muse Spark** (`muse-spark-1.3`) | `POST /v1/chat/completions` (text + image) | Reads the room photo: dimensions, ceiling height, bed fit, placement (JSON) |

All calls use Meta Model API's OpenAI-compatible endpoints with plain `fetch` from the Express backend. The API key never reaches the browser.

## Production readiness

| Concern | What SameRoom does |
|---|---|
| Secrets | Meta key lives only on the server (environment secret) |
| Resilience | Per-call time limit, one retry on 429 / 5xx / network errors, readable errors, browser-side time limit with a Try again button |
| Abuse and cost | Per-device sliding-window limits for renders, analyses and credit-spending health checks; server-wide daily cap on Meta calls |
| Efficiency | Photos downscaled in the browser before upload; one image per request; LRU render cache (repeat views are instant and free); identical in-flight requests share one Meta call; room analyses cached |
| Backpressure | At most N image calls run at once, a bounded queue waits behind them, and anything beyond gets a clear "busy, try again" (503) instead of piling up |
| Observability | Timing log per Meta call, `/api/stats` live counters, `/api/meta-health` self-test with a built-in test photo |

### Scaling past one server
The web tier is stateless except for the in-memory limits and caches, so the path to many users is:
1. Move rate-limit counters, the daily budget and the caches to **Redis**, then run several instances behind a **load balancer**.
2. Move renders to a **job queue with workers** (start, then poll) so web requests return immediately and long renders can't hit gateway timeouts.
3. Store finished renders in **object storage behind a CDN** instead of returning base64.
4. Tie quotas to **user accounts** instead of devices.

Cost grows with the number of Meta calls, so every cache hit is a call that isn't paid for twice. `/api/stats` shows the hit rate live.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `META_API_KEY` | (required) | Meta Model API key |
| `META_BASE_URL` | `https://api.meta.ai/v1` | API base URL |
| `META_TEXT_MODEL` / `META_IMAGE_MODEL` | `muse-spark-1.3` / `muse-image-1.0` | Model names |
| `META_TIMEOUT_MS` | `150000` | Time limit per Meta call |
| `META_MAX_CONCURRENCY` / `META_MAX_QUEUE` | `4` / `16` | Image calls at once / allowed to wait |
| `RATE_WINDOW_SECONDS` | `600` | Rate-limit window |
| `RATE_LIMIT_RENDERS` / `RATE_LIMIT_ANALYSES` / `RATE_LIMIT_HEALTH` | `40` / `20` / `10` | Per-device limits per window |
| `DAILY_META_CALL_CAP` | `800` | Server-wide Meta calls per UTC day |
| `CACHE_MAX_MB` | `64` | Render cache size |

## Run it

Requires Node.js 18+ and a Meta Model API key. `npm install`, set `META_API_KEY`, then `npm run dev` (script names may differ slightly in `package.json`). Check `/api/meta-health?image=1&edit=1` and `/api/stats` once it's running.

## History

SameRoom grew out of my earlier prototype, Space Lift (https://github.com/Prakhargupta1994/Space-Lift), built on Google Gemini, which supplied the interface and design library. The Meta Model API integration and the production layer above were built during the Meta Global AI Developer Hackathon (Oct 26 – Nov 4, 2026).

## Roadmap
SAM 3.1 surface masks for per-surface edits · reference-image consistency across angles · Redis-backed limits and cache · render job queue with workers.
