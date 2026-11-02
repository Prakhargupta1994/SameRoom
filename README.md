# Space Lift — Architectural Room & Exterior Visualizer

> A high-performance, production-ready interior and exterior architectural restyling web app powered exclusively by the **Meta Model API** (`muse-spark-1.3` and `muse-image-1.0`).

---

## 🌟 Key Features

### 🛋️ 1. In-Place Architectural Restyling & Preservation
- **Preserves Exact Structure**: Retains room geometry, walls, window frames, door openings, floor boundaries, and camera perspective while applying authentic architectural styles.
- **20 Architectural Styles**: Includes Japandi, Mid-Century Modern, Industrial, Biophilic, Luxury Contemporary, Bohemian Chic, Pure Minimalist, Warm Scandinavian, Coastal Hampton, Modern Farmhouse, Art Deco Glam, Transitional, Warm Mediterranean, Vibrant Maximalist, Parisian Haussmann, Indian Haveli, Courtyard (Aangan), Verandah (Thinnai), and Exterior Terraces.
- **Multiple Styling Modes**:
  - `Paint & Colors Only`: 100% of existing furniture and layout preserved; walls and trim repainted using 60-30-10 rules.
  - `Architectural Restyle`: Keeps walls and windows intact; upgrades furnishings and lighting to match the style.
  - `Declutter & Polish`: Cleans up loose clutter, balances lighting, and tidies the space while preserving core furniture.
  - `Virtual Staging`: Tailored for empty or move-in spaces, placing proportion-matched furniture.
  - `Custom Vision`: Allows natural language directives (e.g., *"Keep my wooden bed, paint walls sage green, add linen curtains"*).

### 📐 2. 60-30-10 Architectural Specification Engine
- **Authentic Paint Codes**: Farrow & Ball, Benjamin Moore, and Sherwin-Williams formulas.
- **Material & Lighting Topology**: Kelvin temperature guidance (2200K–4000K), CRI specifications, and fixture classifications.
- **Circulation & Clearance Code**: Standard residential walkways (36"–42"), coffee table clearance (14"–18"), and bed clearances.

### 🌐 3. Interactive Spatial Features
- **3D Spatial Orbit Pan**: Direct-DOM 60 FPS viewport manipulation without React component re-renders.
- **Before/After Split Comparison**: High-precision interactive comparison slider.
- **Tap-to-Annotate & Shopping List**: Drop pins on furniture and decor items, track wishlist/sourcing/purchased status, and export PDF dossiers.
- **ZIP Design Pack Export**: Complete 4-angle image pack with palette JSON and inventory manifests.

---

## 🚀 Production Scaling Architecture

The backend (`server.ts`) includes a multi-layered scaling engine designed to protect API budgets, prevent concurrency bottlenecks, and deliver sub-second responses:

```
User Request
    │
    ▼
┌───────────────────────────────────────────┐
│ 1. Sliding-Window IP Rate Limiter         │  ──> [429] Retry-After
└───────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────┐
│ 2. Daily API Call Quota (Budget Cap)      │  ──> [429] Daily budget reached
└───────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────┐
│ 3. Byte-Bounded LRU Cache (64MB)          │  ──> [200] Instant hit (~10ms)
└───────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────┐
│ 4. In-Flight Request Deduplication        │  ──> Coalesces identical concurrent jobs
└───────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────┐
│ 5. Concurrency Limiter (4 active, 16 max) │  ──> [503] Graceful backpressure
└───────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────┐
│ 6. Meta Model API (muse-image-1.0)        │  ──> ~11-13s fresh diffusion render
└───────────────────────────────────────────┘
```

1. **Sliding-Window IP Rate Limiting (`rateCheck`)**:
   - `render`: 40 renders per device per 10 minutes.
   - `analyze`: 20 room analyses per device per 10 minutes.
   - `health`: 10 test calls per device per 10 minutes.
   - Automatically responds with `HTTP 429` and standard `Retry-After` header.
2. **Daily Budget Cap (`takeDailyBudget`)**:
   - Hard daily ceiling (`DAILY_META_CALL_CAP = 800`) resets automatically at 00:00 UTC to protect against runaway usage.
3. **Byte-Budgeted LRU Cache (`createLruCache`)**:
   - Stores rendered data URLs up to `CACHE_MAX_MB = 64 MB` in memory.
   - Duplicate views or angle switches return in **10ms** without re-calling the Meta API.
4. **In-Flight Promise Deduplication (`inflightRenders`)**:
   - Simultaneous requests for identical prompts/images share the single in-flight Promise.
5. **Bounded Concurrency Queue (`imageLimiter`)**:
   - Maximum 4 concurrent image generation tasks; up to 16 in waiting queue.
   - Rejects excess requests with `503 Service Unavailable` and a 5-second `Retry-After`.
6. **Automatic Retries on Upstream Failures**:
   - Transient `429` or `502+` upstream responses from Meta are retried once with backoff before failing cleanly.

---

## 🛠️ API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health status and active models |
| `GET` | `/api/meta-health` | Self-test endpoint (supports `?image=1` and `?edit=1`) |
| `GET` | `/api/stats` | Real-time queue, cache, quota, and rate-limiting metrics |
| `POST` | `/api/generate` | Architectural room & exterior restyling via `muse-image-1.0` |
| `POST` | `/api/analyze-room` | Spatial depth and 0.5x ultra-wide lens analysis via `muse-spark-1.3` |
| `POST` | `/api/generate-prompt` | Generates architectural styling prompts from room descriptions |
| `POST` | `/api/describe` | Analyzes uploaded images for style or furniture items |
| `POST` | `/api/share` | Generates a shareable URL snapshot of a room concept |
| `GET` | `/api/share/:id` | Retrieves a shared room concept |

---

## ⚙️ Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Required
META_API_KEY="your_meta_api_key_here"

# Model Configuration (defaults shown)
META_BASE_URL="https://api.meta.ai/v1"
META_TEXT_MODEL="muse-spark-1.3"
META_IMAGE_MODEL="muse-image-1.0"
META_TIMEOUT_MS=150000

# Production Scaling Knobs (defaults shown)
RATE_WINDOW_SECONDS=600
RATE_LIMIT_RENDERS=40
RATE_LIMIT_ANALYSES=20
RATE_LIMIT_HEALTH=10
DAILY_META_CALL_CAP=800
META_MAX_CONCURRENCY=4
META_MAX_QUEUE=16
CACHE_MAX_MB=64

# Server Configuration
PORT=3000
HOST="0.0.0.0"
```

---

## 💻 Local Development

### Prerequisites
- Node.js 18+ or Bun
- npm or bun

### Setup
```bash
# 1. Clone the repository
git clone <your-repo-url>
cd <repo-folder>

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env and insert your META_API_KEY

# 4. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build
```bash
# Build the client bundle
npm run build

# Start the full-stack production server
npm start
```

---

## 📦 Pushing to GitHub

To push this codebase to your own GitHub repository:

```bash
# 1. Add your GitHub remote repository
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPOSITORY_NAME>.git

# 2. Stage and commit all files
git add .
git commit -m "feat: complete Space Lift architectural visualizer with Meta Model API & scaling layer"

# 3. Push to GitHub
git push -u origin main
```

---

## 📄 License
Apache-2.0
