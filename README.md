# Space Lift

**Space Lift turns a few phone photos of any room — or the outside of your house — into photorealistic redesigns in seconds, grounded in real interior-design rules rather than guesswork.** Snap 3–4 angles (or a short video pan), pick a style, and get back a restyled, true-to-your-space render you can compare, refine by talking to it, and share.

Here is why it works:

- **It redesigns real spaces, interiors *and* exteriors, in 14 designer styles.** Living rooms, bedrooms, kitchens, offices, house facades, and gardens are all supported, across styles from Japandi and Mid-Century Modern to Modern Farmhouse and Mediterranean — each render keeps your actual walls, windows, and layout instead of inventing a stock room.
- **Every design is backed by real data, not vibes.** Each style ships a full 60-30-10 colour formula with genuine paint codes (Farrow & Ball, Benjamin Moore, Sherwin-Williams), target lighting temperatures in Kelvin, material lists, and ergonomic clearances — plus a bed-fit calculator that checks whether a single/double/queen/king actually fits the room.
- **Results stay consistent across angles and can be refined by conversation.** A master-render-plus-reference system keeps furniture, palette, and materials identical from one camera angle to the next, and a running "Tweak with Gemini" chat lets you layer changes ("paint the wall terracotta", then "add a plant") without losing earlier edits.
- **It is fast and keeps your key private.** Photos are downscaled in the browser and only the one image each request needs is uploaded (roughly a 10× smaller payload), while every AI call runs through a small backend so your Gemini API key is never exposed to the browser.

---

## Features

- Multi-angle capture (camera, photo upload, or video-pan frame extraction)
- 14 interior/exterior design styles, each with a 60-30-10 palette, paint codes, lighting spec, and clearance rules
- Five makeover modes: Paint Only, Architectural Restyle, Declutter & Polish, Virtual Staging, Custom
- Exterior / facade & garden modes (body-trim-accent repaint, landscaping, curb appeal)
- Before/after split comparison and cross-angle consistency
- Conversational "Tweak with Gemini" (voice or text) with memory of previous tweaks
- Room-dimension & bed-fit estimator (with an honest "estimate only" note)
- Time-of-day lighting simulator (golden hour / noon / blue hour)
- Tap-to-tag furniture → shopping list with cost/dimensions, status tracking, and copy/export
- Cinematic video walkthrough (Gemini Omni) and a contained 3D parallax viewer
- One-tap **Share** (native share sheet with the image; downloads as fallback)
- Consolidated PDF design dossier export
- Favorites saved locally

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript, Vite, Tailwind CSS, Framer Motion, lucide-react, jsPDF |
| Backend | Node.js + Express |
| AI | Google Gemini (image model for restyle, text model for analysis/prompts, Omni for video) via `@google/genai` |
| Storage | Browser `localStorage` (favorites, tags) — no database |

## Architecture (in one picture)

```
Browser (App.tsx)  ──HTTPS──►  Express server (server.ts)  ──►  Google Gemini
  UI + state                     hides API key,                  image / text /
  photo capture                  calls Gemini,                   video models
  shrinks images                 streams video
        ▲                              │
        └──────── rendered image ──────┘
```

The **frontend** owns everything you see and do; the **backend** is a thin, secure bridge to Gemini (it keeps the API key server-side, makes the AI calls, and streams generated video). The browser never talks to Gemini directly.

## Getting started

Prerequisites: Node.js 18+ and a Google Gemini API key.

```bash
# 1. install
npm install

# 2. add your key (create a .env file in the project root)
echo "GEMINI_API_KEY=your_key_here" > .env

# 3. run (Vite + Express together)
npm run dev
```

Then open the app at `http://localhost:3000`.

> Built originally in Google AI Studio, where the key is injected automatically. Running it anywhere else just needs the `GEMINI_API_KEY` environment variable. Script names (`dev`, `build`, `start`) may differ slightly in your `package.json` — adjust to match.

## Project structure

```
.
├── App.tsx        # Frontend: all UI, screens, state, and the design/style data
├── server.ts      # Backend: Express API that talks to Gemini and streams video
├── SKILL.md       # A reusable interior + exterior design "advisor" prompt (for Gemini / AI Studio)
├── README.md
└── .gitignore
```

## How it works (the pipeline)

1. You add 3–4 photos; the browser **downscales** each to ~1024px to keep uploads small.
2. You choose a room/exterior type, a style, and a makeover mode.
3. The app sends **one** target photo + a text prompt (built from the style's palette/materials) to `POST /api/generate`.
4. The server calls the Gemini image model and returns a restyled photo, which the app caches per style/angle.
5. Extra angles reuse a **reference render** of the first ("master") angle so the design stays consistent.
6. You can compare before/after, tweak by chatting, tag furniture, estimate dimensions, generate a video tour, share, or export a PDF.

## Roadmap ideas

- Dedicated exterior style presets (villa, stucco, brick-and-black, regional contemporary)
- Fast mode (skip the reference image for parallel, lower-latency angles)
- Persist renders (IndexedDB) for instant reloads
- Shareable design links (requires saving renders server-side)

