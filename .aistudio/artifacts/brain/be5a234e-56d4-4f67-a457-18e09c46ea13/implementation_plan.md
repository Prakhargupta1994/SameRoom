# Space Lift: Multi-Angle Room Studio & Architectural 60-30-10 Color Engine

A comprehensive interior design and architectural transformation studio. Users can capture or upload their space via **multiple still photo angles** or a **smooth room video pan** (with automatic keyframe extraction), restyle the entire space cohesively with Gemini Nano Banana 2 Lite / Gemini 3.1 Flash Lite Image, and explore an authentic **60-30-10 architectural color palette & material library** complete with paint swatches, material finishes, and lighting temperature guidelines.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following user preferences were confirmed during Phase 1:
> - **Capture Method**: Support **both multi-photo capture (1–4 key angles)** AND **video recording/upload** with automatic video frame extraction (extracting 3–4 evenly-spaced sharp angles across the pan).
> - **Architectural & Color Engine**: Integrate a **60-30-10 architectural color palette library** complete with real paint codes, hex values, material pairings, and lighting Kelvin temperature recommendations.

- **Confirmed Decision 1**: Dual capture pipeline — Users can snap/upload 1–4 still photos OR record/upload a continuous video pan of the room that extracts key angle frames in the browser using HTML5 Canvas.
- **Confirmed Decision 2**: Architectural Design System — Each of the 10 styles includes a dedicated 60-30-10 breakdown (60% dominant wall/floor neutral, 30% secondary furniture/cabinetry tone, 10% accent decor/textile) with real architectural paint codes, wood/stone finishes, and ambient lighting rules.
- **Confirmed Decision 3**: Master Room Overview & Angle Synthesis — Synthesizes all perspectives into a unified Master Overview plus angle-specific restyled views with an interactive Before/After split slider.

---

### 1. Overview & Core Concept

- **What It Does**: Transforms everyday living spaces by understanding room geometry, depth, ceiling height, and daylight from multiple vantage points. Produces both a wide-angle **Master Room Overview** and coordinated **individual angle makeovers**, accompanied by a professional **60-30-10 architectural color blueprint**.
- **Target Audience**: Homeowners, renters, interior designers, and architects seeking realistic, architecturally sound room transformations without generic AI slop.
- **Key Value**: Eliminates the mismatch of styling only one angle in isolation; guarantees material, lighting, and palette harmony across the entire room.

---

### 2. User Experience & Visual Design

#### A. Key User Flows
1. **Room Ingestion (Photos or Video)**:
   - **Mode A (Photos)**: Snap up to 4 angles using the multi-shot camera HUD (Main View, Opposite View, Window View, Corner Nook) or batch upload images.
   - **Mode B (Video Pan)**: Record a 5–10 second room pan or upload an MP4/MOV video. The client-side extractor samples sharp frames at 0%, 33%, 66%, and 100% of the pan, presenting them as the 4 room angles.
   - **Instant Demo**: 1-click "3-Angle Demo Room" button for zero-friction testing.
2. **Whole Room Styling & Master Synthesis**:
   - Tap **"Style Whole Room (N Angles)"**.
   - Gemini analyzes all reference angles simultaneously to preserve genuine architectural pillars, windows, ceiling beams, and door locations while updating furnishings, surfaces, and lighting.
3. **Exploration & Visualizer**:
   - **View Switcher Tabs**: `Master Overview` · `Angle 1 (Main)` · `Angle 2 (Opposite)` · `Angle 3 (Window)` · `Angle 4 (Corner)` · `4-Angle Grid`.
   - **Before/After Split Slider**: Interactive drag handle allowing users to reveal the original room beneath the redesigned styling for any angle.
   - **Vertical Swipe**: Seamlessly swipe up/down through the 10 curated interior design aesthetics.
4. **Architectural 60-30-10 Specs Drawer**:
   - Tap **"Room Palette & Specs"** to open the architectural drawer:
     - **60% Dominant**: Primary wall paint & flooring finish (with paint code, finish type, and hex swatch).
     - **30% Secondary**: Large furniture, rugs, cabinetry, and drapery tones.
     - **10% Accent**: Cushions, ceramics, metal hardware, and art accents.
     - **Lighting & Spatial Rules**: Kelvin temperatures (e.g. 2700K warm diffused), window light orientation (North vs. South), and circulation walkways.

#### B. Visual Identity & Aesthetic Direction
- **Background & Canvas**: Natural warm architectural oatmeal `#EAE9E4` with clean white cards and hairline borders (`border-[#222222]/10`).
- **Typography**: 
  - Display: `Syncopate` (architectural wide geometric) for brand wordmark and hero title.
  - Body: `Inter` / Clean sans with tabular numbers (`tabular-nums`) for technical specs and ratios.
- **Zero-Pill Discipline**: Unboxed metadata text with typographic separators (`·`), clean segmented controls for functional view switching, and zero candy badges.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Client-Side Video Keyframe Extraction vs. Server Processing**
  - *Chosen Approach*: Extract 3–4 keyframes directly in the browser using an invisible `<video>` element and `<canvas>`.
  - *Why*: Instantaneous feedback, zero extra server bandwidth or video upload lag, works completely offline/locally before sending image parts to Gemini.
- **Decision 2: Multimodal Gemini Context Injection**
  - *Chosen Approach*: Pass all extracted room angle images as inline parts to `gemini-3.1-flash-lite-image`. When rendering `mode: 'overview'`, all angles are evaluated for global coherence. When rendering `mode: 'angle'`, the target angle is set as the primary reference while other angles provide ambient context.
  - *Why*: Keeps physical structural elements (windows, beams) intact while matching materials (oak, boucle, brass) across viewpoints.
- **Decision 3: Dedicated 60-30-10 Architectural Data Model**
  - *Chosen Approach*: Hardcode curated, industry-standard architectural color specifications (inspired by Benjamin Moore and Farrow & Ball classics) alongside lighting Kelvin recommendations for all 10 styles.
  - *Why*: Provides actionable, real-world utility for home redesign rather than vague AI text.

---

### 4. Technical Architecture & Component Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (React 19)                              │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                      Capture & Ingestion Layer                      │   │
│   │  [Multi-Angle Camera]    [File Upload]    [Video Keyframe Extractor]│   │
│   │         │                     │                       │             │   │
│   │         └───────────────┬─────┴───────────────────────┘             │   │
│   │                         ▼                                           │   │
│   │             photos: RoomAnglePhoto[] (1-4)                          │   │
│   └─────────────────────────┬───────────────────────────────────────────┘   │
│                             │                                               │
│   ┌─────────────────────────▼───────────────────────────────────────────┐   │
│   │                     Visualizer & Studio Engine                      │   │
│   │  [View Selector: Overview | Angles 1-4 | Matrix Grid]               │   │
│   │  [Interactive Before / After Split Slider]                          │   │
│   │  [Omni Video Walkthrough Generator]                                 │   │
│   │  [60-30-10 Architectural Palette & Material Drawer]                 │   │
│   └─────────────────────────┬───────────────────────────────────────────┘   │
└─────────────────────────────┼───────────────────────────────────────────────┘
                              │ HTTP POST (Base64 room images + styling prompts)
┌─────────────────────────────▼───────────────────────────────────────────────┐
│                           SERVER (Express / TSX)                            │
│                                                                             │
│   POST /api/generate ─────────────────► Gemini 3.1 Flash Lite Image         │
│   (Synthesizes all room angles          - Multi-image parts                 │
│    into Overview or Angle Makeover)     - 16:9 for Overview, 4:3 for Angles │
│                                                                             │
│   POST /api/generate-video ───────────► Gemini Omni Flash Preview           │
│   (Multi-angle cinematic walkthrough)                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Key Implementation Steps:
1. **Video Ingestion & Canvas Keyframe Extractor**:
   - Add `<input type="file" accept="video/*">` and camera video recording toggle.
   - Build a lightweight `extractFramesFromVideo(fileOrBlob)` helper that loads the video into an off-screen `<video>` element, seeks to 10%, 40%, 70%, 95% timestamps, draws frames to an HTML5 canvas, and outputs 3–4 clean `RoomAnglePhoto` objects.
2. **60-30-10 Palette & Architectural Library**:
   - Enrich all 10 styles with structured 60-30-10 breakdowns:
     - 60% Dominant (e.g., Farrow & Ball "Pointing" No. 2003 / Benjamin Moore "Swiss Coffee" OC-45).
     - 30% Secondary (e.g., "French Bleached Oak", "Charcoal Cast Iron", "Warm Walnut").
     - 10% Accent (e.g., "Aged Burnished Brass", "Terracotta Umber", "Emerald Moss").
     - Lighting Kelvin guide (2700K ambient, 3000K task) and circulation advice.
3. **Split Comparison & Multi-View Polish**:
   - Polish interactive draggable Before/After slider on any angle.
   - Fix TypeScript linting on file reader (`filesToRead.map((file: File, ...))`).
4. **End-to-End Build & Compilation Verification**:
   - Run `lint_applet` and `compile_applet` to ensure zero compilation or type warnings.
