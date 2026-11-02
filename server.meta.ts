import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

// ===================== META MODEL API HELPERS (plain fetch, no SDK) =====================
// Meta Model API is OpenAI-compatible. Base URL + model names can be overridden with env vars.
const META_BASE = (process.env.META_BASE_URL || "https://api.meta.ai/v1").replace(/\/$/, "");
const META_TEXT_MODEL = process.env.META_TEXT_MODEL || "muse-spark-1.3"; // reasoning + photo analysis
const META_IMAGE_MODEL = process.env.META_IMAGE_MODEL || "muse-image-1.0"; // restyle + generate
// Only sent if you set it (valid sizes not confirmed yet). Example: META_IMAGE_SIZE=1024x1024
const META_IMAGE_SIZE = process.env.META_IMAGE_SIZE || "";

function metaKey(): string {
  const key = process.env.META_API_KEY;
  if (!key) {
    throw new Error("META_API_KEY is missing. Add it as a secret / environment variable and restart.");
  }
  return key;
}

async function metaFetch(path: string, init: { method: string; headers?: Record<string, string>; body?: any }) {
  const res = await fetch(`${META_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${metaKey()}`, ...(init.headers || {}) },
  });
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Meta API ${path} failed (${res.status}): ${raw.slice(0, 600)}`);
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Meta API ${path} returned non-JSON: ${raw.slice(0, 200)}`);
  }
}

// Muse Spark: text, or text + image (content = string OR an array of text/image_url parts).
async function metaChat(content: any, opts: { temperature?: number; system?: string } = {}): Promise<string> {
  const messages: any[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content });
  const data = await metaFetch("/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: META_TEXT_MODEL,
      messages,
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
    }),
  });
  const msg = data?.choices?.[0]?.message?.content;
  if (Array.isArray(msg)) return msg.map((p: any) => p?.text ?? "").join("");
  return typeof msg === "string" ? msg : "";
}

// Muse Image returns either base64 or a URL. Always hand the frontend a data URL.
async function imageFromResponse(data: any): Promise<string> {
  const item = data?.data?.[0];
  if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
  if (item?.url) {
    const r = await fetch(item.url);
    if (!r.ok) throw new Error(`Could not download Muse Image result (${r.status})`);
    const buf = Buffer.from(await r.arrayBuffer());
    const mime = r.headers.get("content-type") || "image/png";
    return `data:${mime};base64,${buf.toString("base64")}`;
  }
  throw new Error("Muse Image returned no image: " + JSON.stringify(data).slice(0, 300));
}

// Muse Image: restyle the user's own photo (multipart /images/edits).
async function metaEditImage(img: { mimeType: string; data: string }, prompt: string): Promise<string> {
  const form = new FormData();
  form.append("model", META_IMAGE_MODEL);
  form.append("prompt", prompt);
  if (META_IMAGE_SIZE) form.append("size", META_IMAGE_SIZE);
  const ext = img.mimeType.includes("jpeg") ? "jpg" : img.mimeType.includes("webp") ? "webp" : "png";
  const bytes = Buffer.from(img.data, "base64");
  form.append("image", new Blob([bytes as any], { type: img.mimeType }), `room.${ext}`);
  const data = await metaFetch("/images/edits", { method: "POST", body: form });
  return imageFromResponse(data);
}

// Muse Image: generate from text only (used when no photo is supplied).
async function metaGenerateImage(prompt: string): Promise<string> {
  const data = await metaFetch("/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: META_IMAGE_MODEL,
      prompt,
      ...(META_IMAGE_SIZE ? { size: META_IMAGE_SIZE } : {}),
    }),
  });
  return imageFromResponse(data);
}
// ===================== END META MODEL API HELPERS =====================

type ImageMime =
  | 'image/png' | 'image/jpeg' | 'image/webp'
  | 'image/heic' | 'image/heif' | 'image/gif' | 'image/bmp' | 'image/tiff';
interface InlineImage {
  data: string; // base64, without the data: URI prefix
  mimeType: ImageMime;
}
interface GenerateBody {
  productDesc?: string;
  atmosphereDesc?: string;
  productImages?: InlineImage[];
  atmosphereImages?: InlineImage[];
}

async function startServer() {
  const app = express();
  let port = Number(process.env.PORT) || 3000;
  let host = process.env.HOST || "0.0.0.0";

  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === "--port" && process.argv[i + 1]) {
      const parsed = parseInt(process.argv[i + 1], 10);
      if (!isNaN(parsed)) port = parsed;
    } else if (process.argv[i] === "--host" && process.argv[i + 1]) {
      host = process.argv[i + 1];
    }
  }

  app.use(express.json({ limit: "50mb" }));

  function parseBase64Image(dataUri: string) {
    if (!dataUri) return null;
    const match = dataUri.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,([^"]*)$/);
    if (match && match.length === 3) {
      return {
        inlineData: {
          mimeType: match[1] as ImageMime,
          data: match[2],
        },
      };
    }
    return null;
  }

  // Healthcheck endpoint
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok", provider: "meta" });
  });

  // Self-test. Open /api/meta-health in the browser to check your key + text model.
  // Add ?image=1 to also test Muse Image (costs about $0.01).
  app.get("/api/meta-health", async (req, res) => {
    const out: any = { baseUrl: META_BASE, textModel: META_TEXT_MODEL, imageModel: META_IMAGE_MODEL };
    try {
      out.reply = await metaChat("Reply with exactly: Meta API works.");
      out.textOk = true;
    } catch (e: any) {
      out.textOk = false;
      out.textError = e.message;
    }
    if (req.query.image === "1") {
      try {
        const img = await metaGenerateImage("A simple bright living room, photorealistic.");
        out.imageOk = true;
        out.imageApproxKB = Math.round(img.length / 1024);
      } catch (e: any) {
        out.imageOk = false;
        out.imageError = e.message;
      }
    }
    res.status(out.textOk === false || out.imageOk === false ? 500 : 200).json(out);
  });

  // In-memory cache for shared room styles
  const sharedStylesMap = new Map<string, any>();
  app.post("/api/share", (req, res) => {
    try {
      const shareData = req.body;
      if (!shareData || !shareData.styleName) {
        return res.status(400).json({ error: "Invalid share data: styleName is required" });
      }
      const shareId = "r_" + Math.random().toString(36).substring(2, 8) + Date.now().toString(36).substring(4);
      const record = { ...shareData, shareId, createdAt: Date.now() };
      if (sharedStylesMap.size >= 300) {
        const oldest = sharedStylesMap.keys().next().value;
        if (oldest) sharedStylesMap.delete(oldest);
      }
      sharedStylesMap.set(shareId, record);
      return res.status(200).json({ success: true, shareId, shareData: record });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to create share" });
    }
  });

  app.get("/api/share/:id", (req, res) => {
    try {
      const { id } = req.params;
      const record = sharedStylesMap.get(id);
      if (!record) return res.status(404).json({ error: "Shared style not found or expired" });
      return res.status(200).json(record);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to load shared style" });
    }
  });

  app.post("/api/generate", async (req, res) => {
    try {
      const {
        prompt,
        imageBase64,
        imagesBase64,
        mode = "single",
        targetAngleIndex = 0,
        aspectRatio = "4:3",
        roomType = "room",
        stylingMode = "architectural_restyle",
        preservationLevel = "strict",
        customDirectives = "",
        paletteSpecs,
        bedSize,
        lensCalibration,
        tweakColor,
        lightingTimeOfDay,
        // cross-angle consistency controls
        referenceRenderBase64,
        designManifest = ""
      } = req.body;
      if (!prompt && !customDirectives && !tweakColor) {
        return res.status(400).json({ error: "Prompt, custom directives, or color tweak required" });
      }

      // Collect all available base64 room photos
      const rawImages: string[] = [];
      if (Array.isArray(imagesBase64) && imagesBase64.length > 0) {
        rawImages.push(...imagesBase64.filter(Boolean));
      } else if (imageBase64) {
        rawImages.push(imageBase64);
      }

      const parsedImages = rawImages.map(parseBase64Image).filter(Boolean) as { inlineData: { mimeType: ImageMime; data: string } }[];

      let parts: any[] = [];
      const humanRoom = roomType && roomType !== "auto" && roomType !== "room" ? roomType : "room";
      const isExterior = /exterior|facade|elevation|garden|landscape|yard|curb|outdoor/i.test(roomType || "");

      // Palette hints if provided
      let paletteHint = "";
      if (paletteSpecs) {
        const dom = paletteSpecs.dominant ? `60% Main Walls: ${paletteSpecs.dominant.name} (${paletteSpecs.dominant.hex || ''})` : "";
        const sec = paletteSpecs.secondary ? `30% Trim & Millwork: ${paletteSpecs.secondary.name} (${paletteSpecs.secondary.hex || ''})` : "";
        const acc = paletteSpecs.accent ? `10% Accent Details: ${paletteSpecs.accent.name} (${paletteSpecs.accent.hex || ''})` : "";
        paletteHint = [dom, sec, acc].filter(Boolean).join("; ");
      }

      // Lens and dimension guidance
      let opticalGuidance = "";
      if (lensCalibration === "0.5x" || lensCalibration === "ultra_wide") {
        opticalGuidance = `
CAMERA OPTICS & DISTANCE CALIBRATION (0.5x ULTRA-WIDE LENS):
- The original room photo was captured on a 0.5x ultra-wide smartphone lens (~13mm focal length, ~120° FOV).
- Ultra-wide lenses cause optical barrel expansion: the center of the room appears deeper/further away than in real life, and peripheral edges stretch.
- ACCOUNT FOR THIS OPTICAL DISTORTION: Calculate true physical spatial depth (typically 10-15 ft / 3-4.5m room depth).
- Do not stretch furniture unnaturally. Maintain physically accurate real-world scale and human proportions.`;
      }

      let furnitureScaleGuidance = "";
      if (bedSize) {
        furnitureScaleGuidance = `
SPECIFIC FURNITURE DIMENSIONS (BED SCALING CODE):
- Requested Bed Scale: ${bedSize}.
  * If Single / Twin: 38" wide × 75" long (~1.0m × 1.9m) — occupies narrow footprint, leaving ample side clearance.
  * If Full / Double: 54" wide × 75" long (~1.4m × 1.9m) — moderate footprint.
  * If Queen: 60" wide × 80" long (~1.5m × 2.0m) — standard master bed scale, requires at least 24"-30" side clearance to walls.
  * If King: 76" wide × 80" long (~1.9m × 2.0m) — wide footprint, dominant central placement.
- Position and scale the bed strictly according to these physical dimensions relative to the room's walls, door swings, and window sills.`;
      }

      let colorTweakGuidance = "";
      if (tweakColor) {
        colorTweakGuidance = `
SPECIFIC COLOR REFINEMENT DIRECTIVE:
- Paint / Color tone adjustment requested by user: "${tweakColor}".
- Apply this exact color tone to the designated surface (e.g. accent wall, main walls, or textiles) with realistic architectural light bounce and natural shadows.`;
      }

      let lightingGuidance = "";
      if (lightingTimeOfDay === "golden_hour") {
        lightingGuidance = `
LIGHTING TEMPERATURE DIRECTIVE (GOLDEN HOUR - ~2800K WARM AMBER):
- Bathe the interior in low-angle, warm honey-golden sunlight streaming through windows.
- Cast long, soft directional shadows across the floor. Warm incandescent/amber pools of light (~2700K) from sconces and lamps.`;
      } else if (lightingTimeOfDay === "bright_noon") {
        lightingGuidance = `
LIGHTING TEMPERATURE DIRECTIVE (BRIGHT NOON - ~5500K CRISP DAYLIGHT):
- High-noon overhead sun delivering pure, crisp, neutral daylight through windows.
- Pristine color rendering, high visual clarity, balanced soft daylight wash with crisp true-to-life architectural surfaces.`;
      } else if (lightingTimeOfDay === "blue_hour") {
        lightingGuidance = `
LIGHTING TEMPERATURE DIRECTIVE (BLUE HOUR - ~8500K TWILIGHT INDIGO):
- Capture the room at blue hour / twilight immediately after sunset.
- Deep cyan and indigo twilight atmosphere visible outside windows, contrasting with warm glowing interior lamps (2700K). Cozy, cinematic evening mood.`;
      }

      const referenceRender = referenceRenderBase64 ? parseBase64Image(referenceRenderBase64) : null;
      let consistencyGuidance = "";
      if (designManifest) {
        consistencyGuidance = `
CROSS-ANGLE CONSISTENCY (CRITICAL — this same room is rendered from several camera angles; every angle MUST match):
- Render the SAME furniture, SAME materials, SAME wall colours and SAME layout in every angle. Do NOT add, remove, or reposition pieces between angles.
- LOCKED DESIGN MANIFEST (do not deviate):
${designManifest}
- Only the camera viewpoint changes between renders. Keep the design identity identical.`;
      }

      if (parsedImages.length > 0) {
        let targetIndex = 0;
        if (mode === "angle") {
          targetIndex = Math.min(Math.max(0, targetAngleIndex), parsedImages.length - 1);
        }
        const targetImage = parsedImages[targetIndex];

        let editDirective = "";

        if (isExterior) {
          if (stylingMode === "paint_only") {
            editDirective = `PHOTO EDITING TASK: Exterior repaint of THIS EXACT building facade shown in the photograph.
- Repaint ONLY the exterior wall body, trim/fascia, and front door using: ${tweakColor || paletteHint || prompt} (treat the palette as body = 60%, trim = 30%, front door/accents = 10%).
- Keep the exact structure, rooflines, windows, doors, driveway and landscaping unchanged.
- Preserve the camera angle, perspective and daylight direction. Photorealistic, natural outdoor light with soft real shadows.`;
          } else if (stylingMode === "virtual_staging") {
            editDirective = `PHOTO EDITING TASK: Exterior curb-appeal staging of THIS EXACT property shown in the photograph.
- Keep the building structure, rooflines, windows and property boundaries exactly as shown.
- Add tasteful landscaping, a clean pathway, planting and subtle exterior lighting that suit ${prompt} (${paletteHint}).
- Photorealistic exterior architectural photography matching the existing daylight.`;
          } else if (stylingMode === "declutter_polish") {
            editDirective = `PHOTO EDITING TASK: Clean-up and polish of THIS EXACT building exterior in the photograph.
- Keep the structure and layout; tidy the yard, clean the facade and driveway, neaten the planting, and refresh in ${prompt} tones (${paletteHint}).
- Warm, natural outdoor lighting. The result must clearly be the same property, elevated.`;
          } else if (stylingMode === "custom" || customDirectives || tweakColor) {
            editDirective = `PHOTO EDITING TASK: Custom exterior restyle of THIS EXACT building facade shown in the photograph.
USER INSTRUCTIONS: "${customDirectives || tweakColor || prompt}".
STYLE & COLOUR CONTEXT: ${prompt || ''} (${paletteHint || ''}).
- Retain the exact structure, camera angle, rooflines, window/door openings and boundaries unless the user asks otherwise.
- Photorealistic, natural outdoor light.`;
          } else {
            editDirective = `PHOTO EDITING TASK: In-place EXTERIOR / facade restyle of THIS EXACT building shown in the photograph.
CRITICAL STRUCTURAL PRESERVATION:
1. Maintain the EXACT camera angle, perspective, building massing, rooflines, window and door openings, and property boundaries. Do NOT generate an unrelated house.
2. RESTYLE THE FACADE IN ${prompt}:
   - Update wall cladding/paint (body), trim/fascia, front door and roof accents using the palette (body 60% / trim 30% / accent 10%): ${tweakColor || paletteHint || prompt}.
   - Refresh landscaping, pathway and exterior lighting to match the aesthetic.
   - Keep daylight orientation and shadows consistent with the original photo.
3. Ultra high-resolution exterior architectural photography, photorealistic, natural light.`;
          }
          editDirective += `\n${opticalGuidance}\n${colorTweakGuidance}\n${lightingGuidance}`;
        } else if (stylingMode === "paint_only") {
          editDirective = `PHOTO EDITING TASK: In-place wall color & paint makeover of THIS EXACT ${humanRoom.toUpperCase()} shown in the photograph.
STRICTEST ARCHITECTURAL & FURNITURE PRESERVATION (CRITICAL):
1. PRESERVE 100% OF EXISTING FURNITURE & LAYOUT: Keep every sofa, chair, bed, desk, table, lamp, rug, shelving, window frame, door, and floor exactly as they appear in this photo. DO NOT remove, replace, or relocate the user's furniture.
2. ONLY REPAINT AND RE-TINT:
   - Repaint the main walls and ceiling in: ${tweakColor || paletteHint || prompt}.
   - Keep architectural moldings, baseboards, and window trim crisp and clean.
   - Adjust soft textile accent tones (pillows, throw blankets) subtly to harmonize with the new wall paint.
3. PRESERVE CAMERA VIEWPOINT: The camera angle, perspective, window positions, and daylight direction must remain 100% identical.
4. Output must look unquestionably like the user's actual room in this photo, with newly painted walls. Photorealistic, clean architectural lighting.
${opticalGuidance}
${colorTweakGuidance}
${lightingGuidance}`;
        } else if (stylingMode === "declutter_polish") {
          editDirective = `PHOTO EDITING TASK: In-place declutter and styling refresh of THIS EXACT ${humanRoom.toUpperCase()} in the photograph.
PRESERVATION & POLISH RULES:
1. Retain the user's actual room layout, key furniture pieces, floor, walls, and window locations from this photograph.
2. Clean up loose clutter, organize surfaces, neaten pillows and textiles.
3. Elevate styling with: ${prompt} (${paletteHint}).
4. Add balanced, warm natural lighting matching the existing windows.
5. The result must be recognizably the user's own home, elevated and professionally styled.
${opticalGuidance}
${furnitureScaleGuidance}
${colorTweakGuidance}
${lightingGuidance}`;
        } else if (stylingMode === "virtual_staging") {
          editDirective = `PHOTO EDITING TASK: Virtual staging of THIS EXACT EMPTY/SEMI-EMPTY ${humanRoom.toUpperCase()} shown in the photograph.
PRESERVATION & STAGING RULES:
1. PRESERVE THE ROOM SHELL: The walls, ceiling, window frames, door openings, floor boundaries, and perspective must match this photograph exactly.
2. Stage and furnish the room in ${prompt} (${paletteHint}):
   - Place appropriately scaled furniture tailored specifically to this room's exact dimensions and circulation pathways.
   - Match daylight angle and shadows from the windows shown in the photo.
3. Photorealistic high-resolution interior photography.
${opticalGuidance}
${furnitureScaleGuidance}
${colorTweakGuidance}
${lightingGuidance}`;
        } else if (stylingMode === "custom" || customDirectives || tweakColor) {
          editDirective = `PHOTO EDITING TASK: Custom user styling and tweaking of THIS EXACT ${humanRoom.toUpperCase()} shown in the photograph.
USER TWEAK INSTRUCTIONS: "${customDirectives || tweakColor || prompt}".
STYLE & COLOR CONTEXT: ${prompt || ''} (${paletteHint || ''}).
CRITICAL RULES:
1. Retain the exact room architecture, camera angle, walls, window locations, and perspective from this photo unless specifically requested by the user.
2. Apply the requested tweaks faithfully to this specific space.
${opticalGuidance}
${furnitureScaleGuidance}
${colorTweakGuidance}
${lightingGuidance}
3. Photorealistic, natural lighting.`;
        } else {
          // Default: architectural_restyle
          editDirective = `PHOTO EDITING TASK: In-place architectural interior restyle of THIS EXACT ${humanRoom.toUpperCase()} shown in the photograph.
CRITICAL STRUCTURAL PRESERVATION:
1. Maintain the EXACT camera angle, perspective, walls, ceiling height, window openings, window panes, door frames, and floor boundaries visible in this photo. DO NOT generate an unrelated stock photo room.
2. IN-PLACE RESTYLING IN ${prompt}:
   - Redesign wall paint/surfaces in: ${tweakColor || paletteHint || prompt}.
   - Update furniture, area rugs, drapery, and lighting fixtures to match the aesthetic, scaled precisely to fit this specific room's proportions and walkways.
   - Keep window daylight orientation and shadows consistent with the original photo.
3. Ultra high-resolution architectural interior photography, photorealistic, cinematic natural light.
${opticalGuidance}
${furnitureScaleGuidance}
${colorTweakGuidance}
${lightingGuidance}`;
        }

        const finalDirective = editDirective + consistencyGuidance;
        parts = [targetImage];
        if (referenceRender) {
          parts.push({
            text: "REFERENCE RENDER — this is the already-approved design of THIS SAME ROOM seen from another camera angle. Match its furniture, materials, palette, fixtures and overall mood EXACTLY. Only the camera viewpoint differs from the first image; do not redesign anything."
          });
          parts.push(referenceRender);
        }
        parts.push({ text: finalDirective });
      } else {
        parts = [{ text: `Interior architectural photography of a ${humanRoom} in ${prompt}. Photorealistic, cinematic lighting. ${opticalGuidance} ${furnitureScaleGuidance} ${colorTweakGuidance} ${lightingGuidance} ${consistencyGuidance}` }];
      }

      // ---- Meta: Muse Image does the restyle ----
      const baseImage = parts.find((p: any) => p.inlineData)?.inlineData;
      const directiveText = parts
        .filter((p: any) => p.text && !String(p.text).startsWith("REFERENCE RENDER"))
        .map((p: any) => p.text)
        .join("\n\n");

      const imageUrl = baseImage
        ? await metaEditImage(baseImage, directiveText)
        : await metaGenerateImage(directiveText);

      res.json({ imageUrl, mode, targetAngleIndex });
    } catch (error: any) {
      console.error("Error generating image:", error);
      res.status(500).json({ error: error.message || "Failed to generate image" });
    }
  });

  // Architectural Spatial & Lens Distortion Analyzer (Estimates dimensions & bed clearances)
  app.post("/api/analyze-room", async (req, res) => {
    try {
      const { imageBase64, isUltraWide = true } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "Room photo is required for dimension analysis" });
      }

      const parsed = parseBase64Image(imageBase64);
      if (!parsed) {
        return res.status(400).json({ error: "Invalid image format" });
      }

      const prompt = `You are a licensed interior architect and 3D computer vision spatial analyst.
Analyze this room photograph with specific focus on:
1. CAMERA PERSPECTIVE & LENS DISTORTION:
   - The user took this photo on a smartphone (often 0.5x ultra-wide lens, ~13-14mm focal length, ~120° FOV).
   - Assess vanishing lines, ceiling corner angles, and peripheral stretching.
   - Note how the 0.5x focal length affects perceived depth (e.g., center wall appears farther than actual).
2. ESTIMATED PHYSICAL ROOM DIMENSIONS:
   - Use standard architectural references visible in the shot: standard door height (80" / 6'8"), typical ceiling height (8ft - 9ft / 2.4 - 2.7m), standard baseboards (4"-6"), switch plate height (48" from floor).
   - Estimate Width × Length (in feet and meters), and approximate floor area (sq ft / sq m).
3. BED SIZING & FURNITURE FIT ANALYSIS:
   - Single / Twin Bed (38" × 75" / 1.0m × 1.9m): Walkway clearance and fit assessment.
   - Full / Double Bed (54" × 75" / 1.4m × 1.9m): Fit assessment.
   - Queen Bed (60" × 80" / 1.5m × 2.0m): Walkway clearance (requires min 24"-30" side clearance).
   - King Bed (76" × 80" / 1.9m × 2.0m): Feasibility and impact on doors/closet swings.
   - Recommended wall placement for the bed.

Return a clean JSON object ONLY (valid JSON, no markdown backticks, no fences):
{
  "cameraOptics": {
    "isUltraWideDetected": true,
    "focalLengthDesc": "0.5x Ultra-wide (~13mm eq, ~120° FOV)",
    "depthDistortionNote": "Objects at room center are ~25-30% closer than they appear in ultra-wide perspective."
  },
  "estimatedDimensions": {
    "widthFt": "11 - 12 ft",
    "lengthFt": "13 - 15 ft",
    "ceilingHeight": "8.5 ft standard residential",
    "areaSqFt": "155 - 175 sq ft",
    "areaSqM": "14.5 - 16.2 sq m"
  },
  "bedFitAssessment": {
    "singleTwin": "Ample clearance (~4.5-5.5 ft open floor), leaves room for large desk & wardrobe.",
    "fullDouble": "Comfortable fit with 32\" walking clearance on both sides.",
    "queen": "Recommended optimal fit (60\"x80\"). Allows 26\"-28\" on either side for nightstands and comfortable circulation.",
    "king": "Tight fit. Will restrict door/closet access or push nightstands flush against adjacent walls.",
    "recommendedSize": "Queen",
    "recommendedPlacement": "Against the main solid anchor wall opposite the entryway, headboard centered between daylight path."
  },
  "structuralAnchorsDetected": ["Standard doorway opening", "Window sill height", "Floor-to-ceiling corner joint"]
}`;

      const text = await metaChat(
        [
          { type: "text", text: prompt + "\n\nReturn ONLY the JSON object. No markdown, no code fences, no commentary." },
          { type: "image_url", image_url: { url: `data:${parsed.inlineData.mimeType};base64,${parsed.inlineData.data}` } },
        ],
        { temperature: 0.2 }
      );
      const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
      const first = cleaned.indexOf("{");
      const last = cleaned.lastIndexOf("}");
      const data = JSON.parse(first >= 0 && last > first ? cleaned.slice(first, last + 1) : cleaned);
      res.json(data);
    } catch (e: any) {
      console.error("Error analyzing room dimensions:", e);
      res.status(500).json({
        error: e.message || "Failed to analyze room",
        fallback: {
          cameraOptics: {
            isUltraWideDetected: true,
            focalLengthDesc: "0.5x Ultra-wide (~13mm)",
            depthDistortionNote: "Ultra-wide lens stretches corners and deepens center perspective."
          },
          estimatedDimensions: {
            widthFt: "11 - 13 ft",
            lengthFt: "13 - 16 ft",
            ceilingHeight: "8.5 ft",
            areaSqFt: "150 - 180 sq ft"
          },
          bedFitAssessment: {
            singleTwin: "Leaves massive open space.",
            fullDouble: "Great balance of sleep space and circulation.",
            queen: "Recommended standard fit with balanced 28\" side walkways.",
            king: "Possible if placed along the longest wall, leaves tight corners.",
            recommendedSize: "Queen",
            recommendedPlacement: "Headboard centered against the primary solid wall."
          }
        }
      });
    }
  });

  // Video tour endpoint
  app.post("/api/generate-video", (_req, res) => {
    res.status(501).json({ error: "Video tour is not available in the Meta build." });
  });

  const rootPath = process.cwd();
  const distPath = path.join(rootPath, "dist");
  const hasDist = fs.existsSync(distPath) && fs.existsSync(path.join(distPath, "index.html"));

  const testImgPath = path.join(rootPath, "test-image2.jpeg");
  if (fs.existsSync(testImgPath)) {
    app.get("/test-image2.jpeg", (_req, res) => {
      res.sendFile(testImgPath);
    });
  }

  if (hasDist) {
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        } else {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      }
    }));
    app.get("*", (_req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(port, host, () => {
    console.log(`Server (Meta model engine) running on http://${host === "0.0.0.0" ? "localhost" : host}:${port}`);
  });

  server.on("error", (err: any) => {
    console.error("Server listen error:", err);
  });
}

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

startServer().catch(console.error);
