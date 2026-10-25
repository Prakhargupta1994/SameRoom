import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;
function getAiClient() {
  if (!aiClient) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is missing');
    }
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        timeout: 300000, // 5 minutes
        headers: {
          'User-Agent': 'aistudio-build',
        }
      },
    });
  }
  return aiClient;
}

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

  // Dev server healthcheck
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // In-memory cache for shared room styles
  const sharedStylesMap = new Map<string, any>();

  // Share room style endpoint
  app.post("/api/share", (req, res) => {
    try {
      const shareData = req.body;
      if (!shareData || !shareData.styleName) {
        return res.status(400).json({ error: "Invalid share data: styleName is required" });
      }

      // Generate a short, url-friendly share ID
      const shareId = "r_" + Math.random().toString(36).substring(2, 8) + Date.now().toString(36).substring(4);
      const record = {
        ...shareData,
        shareId,
        createdAt: Date.now()
      };

      // Keep up to 300 recent shared room styles
      if (sharedStylesMap.size >= 300) {
        const oldest = sharedStylesMap.keys().next().value;
        if (oldest) sharedStylesMap.delete(oldest);
      }
      sharedStylesMap.set(shareId, record);

      return res.status(200).json({
        success: true,
        shareId,
        shareData: record
      });
    } catch (err: any) {
      console.error("Error creating room share:", err);
      return res.status(500).json({ error: err.message || "Failed to create share" });
    }
  });

  // Retrieve shared room style endpoint
  app.get("/api/share/:id", (req, res) => {
    try {
      const { id } = req.params;
      const data = sharedStylesMap.get(id);
      if (!data) {
        return res.status(404).json({ error: "Shared room style not found or expired" });
      }
      return res.status(200).json({ success: true, data });
    } catch (err: any) {
      console.error("Error retrieving shared style:", err);
      return res.status(500).json({ error: err.message || "Failed to load shared style" });
    }
  });

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
        // NEW — cross-angle consistency controls
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

      let customDirectivesGuidance = "";
      if (customDirectives && customDirectives.trim()) {
        customDirectivesGuidance = `
MANDATORY FURNITURE, APPLIANCE & ROOM LAYOUT DIRECTIVES (USER SPECIFIED - MUST HONOR):
- SPECIFIC USER DIRECTIVES: "${customDirectives.trim()}"
- APPLIANCE & FURNITURE PLACEMENT: If the user requests adding appliances or furniture (e.g., refrigerator/fridge, sofa, sectional, dining table, chairs, kitchen island, desk, bed, TV, or coffee bar), YOU MUST EXPLICITLY PLACE AND RENDER THESE ITEMS IN THE ROOM.
- SPATIAL ARRANGEMENT: Accurately follow the user's layout positioning (e.g., "fridge in the left corner", "L-shaped sofa facing window", "kitchen island in center with barstools").
- STYLE HARMONIZATION: Design the added furniture/appliances in the aesthetic and materials of the chosen style (${prompt}).`;
      }

      // NEW — cross-angle consistency: a reference render of the same room from another
      // angle, plus a locked design manifest, so every angle shares one identity.
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
        // Determine the target photo for this viewpoint
        let targetIndex = 0;
        if (mode === "angle") {
          targetIndex = Math.min(Math.max(0, targetAngleIndex), parsedImages.length - 1);
        }
        const targetImage = parsedImages[targetIndex];

        const isExterior = /exterior|garden|landscape|courtyard|aangan|verandah|thinnai|terrace|patio|facade|elevation|backyard|outdoors/i.test(humanRoom);
        let editDirective = "";

        if (stylingMode === "paint_only") {
          editDirective = `PHOTO EDITING TASK: In-place ${isExterior ? "exterior facade/wall color & paint" : "wall color & paint"} makeover of THIS EXACT ${humanRoom.toUpperCase()} shown in the photograph.
STRICTEST ARCHITECTURAL & FURNITURE PRESERVATION (CRITICAL):
1. PRESERVE 100% OF EXISTING ${isExterior ? "BUILDING ELEVATION, BOUNDARY WALLS & OUTDOOR ELEMENTS" : "FURNITURE & LAYOUT"}: Keep every ${isExterior ? "building mass, door, window, wall, tree, and hardscape boundary" : "sofa, chair, bed, desk, table, lamp, rug, shelving, window frame, door, and floor"} exactly as they appear in this photo. DO NOT remove, replace, or relocate unless requested in directives below.
2. ONLY REPAINT AND RE-TINT:
   - Repaint the main ${isExterior ? "facade walls, exterior plaster, and boundary surfaces" : "walls and ceiling"} in: ${tweakColor || paletteHint || prompt}.
   - Keep architectural moldings, trims, and structural accents crisp and clean.
   - Adjust soft accent tones subtly to harmonize with the new paint.
3. PRESERVE CAMERA VIEWPOINT: The camera angle, perspective, and natural daylight direction must remain 100% identical.
4. Output must look unquestionably like the user's actual ${isExterior ? "exterior property/garden" : "room"} in this photo, with newly painted architectural surfaces. Photorealistic, clean architectural lighting.
${customDirectivesGuidance}
${opticalGuidance}
${colorTweakGuidance}
${lightingGuidance}`;
        } else if (stylingMode === "declutter_polish") {
          editDirective = `PHOTO EDITING TASK: In-place declutter and styling refresh of THIS EXACT ${humanRoom.toUpperCase()} in the photograph.
PRESERVATION & POLISH RULES:
1. Retain the user's actual ${isExterior ? "grounds, facade walls, paving, and garden structure" : "room layout, key furniture pieces, floor, walls, and window locations"} from this photograph.
2. Clean up loose clutter, organize surfaces, neaten garden paths or seating.
3. Elevate styling with: ${prompt} (${paletteHint}).
4. Add balanced, warm natural lighting matching the existing environment.
5. The result must be recognizably the user's own property, elevated and professionally styled.
${customDirectivesGuidance}
${opticalGuidance}
${furnitureScaleGuidance}
${colorTweakGuidance}
${lightingGuidance}`;
        } else if (stylingMode === "virtual_staging") {
          editDirective = `PHOTO EDITING TASK: Virtual staging of THIS EXACT EMPTY/SEMI-EMPTY ${humanRoom.toUpperCase()} shown in the photograph.
PRESERVATION & STAGING RULES:
1. PRESERVE THE ARCHITECTURAL SHELL: The ${isExterior ? "building facade, boundary walls, floor/ground boundaries, and perspective" : "walls, ceiling, window frames, door openings, floor boundaries, and perspective"} must match this photograph exactly.
2. Stage and furnish the ${humanRoom} in ${prompt} (${paletteHint}):
   - Place appropriately scaled ${isExterior ? "outdoor furniture, planters, pergola, or landscape features" : "furniture tailored specifically to this room's exact dimensions and circulation pathways"}.
   - Match daylight angle and shadows shown in the photo.
3. Photorealistic high-resolution architectural photography.
${customDirectivesGuidance}
${opticalGuidance}
${furnitureScaleGuidance}
${colorTweakGuidance}
${lightingGuidance}`;
        } else if (stylingMode === "custom") {
          editDirective = `PHOTO EDITING TASK: Custom user styling and tweaking of THIS EXACT ${humanRoom.toUpperCase()} shown in the photograph.
USER TWEAK INSTRUCTIONS: "${customDirectives || tweakColor || prompt}".
STYLE & COLOR CONTEXT: ${prompt || ''} (${paletteHint || ''}).
CRITICAL RULES:
1. Retain the exact architecture, camera angle, walls, boundaries, and perspective from this photo unless specifically requested by the user.
2. Apply the requested tweaks faithfully to this specific space.
${customDirectivesGuidance}
${opticalGuidance}
${furnitureScaleGuidance}
${colorTweakGuidance}
${lightingGuidance}
3. Photorealistic, natural lighting.`;
        } else if (isExterior) {
          // Exterior architectural & garden restyle
          editDirective = `PHOTO EDITING TASK: In-place architectural EXTERIOR, GARDEN & LANDSCAPE restyle of THIS EXACT ${humanRoom.toUpperCase()} shown in the photograph.
CRITICAL STRUCTURAL PRESERVATION:
1. Maintain the EXACT camera angle, building envelope, elevation massing, window/door placements, rooflines, boundary walls, and plot perimeter visible in this photo. DO NOT generate an unrelated stock photo house.
2. IN-PLACE EXTERIOR & LANDSCAPE RESTYLING IN ${prompt}:
   - Redesign facade surfaces, exterior wall cladding, stone/brick finishes in: ${tweakColor || paletteHint || prompt}.
   - Transform landscaping, garden lawns, paving (Kota/Dholpur stone, slate pavers, travertine, or cobblestone), and outdoor features (pergolas, teakwood jhula/swings, terracotta jali screens, water fountains/urlis, outdoor seating, lush tropical plants like champa, frangipani, and bougainvillea).
   - Keep natural sunlight direction, sky lighting, and shadows consistent with the original photo.
3. Ultra high-resolution architectural exterior & landscape photography, photorealistic, natural daylight.
${customDirectivesGuidance}
${opticalGuidance}
${furnitureScaleGuidance}
${colorTweakGuidance}
${lightingGuidance}`;
        } else {
          // Default: interior architectural_restyle
          editDirective = `PHOTO EDITING TASK: In-place architectural interior restyle of THIS EXACT ${humanRoom.toUpperCase()} shown in the photograph.
CRITICAL STRUCTURAL PRESERVATION:
1. Maintain the EXACT camera angle, perspective, walls, ceiling height, window openings, window panes, door frames, and floor boundaries visible in this photo. DO NOT generate an unrelated stock photo room.
2. IN-PLACE RESTYLING IN ${prompt}:
   - Redesign wall paint/surfaces in: ${tweakColor || paletteHint || prompt}.
   - Update furniture, area rugs, drapery, and lighting fixtures to match the aesthetic, scaled precisely to fit this specific room's proportions and walkways.
   - Keep window daylight orientation and shadows consistent with the original photo.
3. Ultra high-resolution architectural interior photography, photorealistic, cinematic natural light.
${customDirectivesGuidance}
${opticalGuidance}
${furnitureScaleGuidance}
${colorTweakGuidance}
${lightingGuidance}`;
        }

        const finalDirective = editDirective + consistencyGuidance;

        // Build the parts. When a reference render of the same room (from another
        // already-approved angle) is supplied, include it so the model matches the
        // established design identity rather than inventing a fresh room each time.
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

      const ai = getAiClient();
      const validAspectRatios = ["1:1", "3:4", "4:3", "9:16", "16:9"];
      const chosenAspect = validAspectRatios.includes(aspectRatio)
        ? aspectRatio
        : mode === "overview"
        ? "16:9"
        : "4:3";

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-image',
        contents: { parts },
        config: {
          imageConfig: { aspectRatio: chosenAspect as any }
        },
      });
      let base64EncodeString = "";
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          base64EncodeString = part.inlineData.data;
          break;
        }
      }

      if (!base64EncodeString) {
        return res.status(500).json({ error: "No image generated" });
      }

      const imageUrl = `data:image/png;base64,${base64EncodeString}`;
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

      const ai = getAiClient();
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

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: [
          { inlineData: { mimeType: parsed.inlineData.mimeType, data: parsed.inlineData.data } },
          { text: prompt }
        ],
        config: {
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      });

      const text = response.text || "{}";
      const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const data = JSON.parse(cleaned);
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

  // Endpoint to generate prompt
  app.post('/api/generate-prompt', async (req, res) => {
    try {
      const { productDesc, atmosphereDesc, productImages = [], atmosphereImages = [] }: GenerateBody = req.body;
      const ai = getAiClient();

      const promptWriterSystemInstruction = `## Role
You are an elite product-film director, editor and Gemini Omni prompt engineer in one box. You receive a handful of plain inputs from an everyday seller and return one flawless, timestamped Omni directive prompt that yields a premium, short-form product showcase reel built from several shots. You direct like a luxury commercial and cut like a master editor. Your taste is the product: restrained, expensive, clarifying. Never slop, never gimmick, never overclaim.
Inputs you receive
1–4 product reference images — e-commerce style, white background; any mix of front, side, top, detail views.
A short product description — what it is, plus key aesthetic details (plain language).
A simple style brief — often only a few words (e.g. "white studio", "clinical skincare lab"). May include a camera or shot request.
Optional extra notes — treat any later or added input as an override.
Non-negotiable taste
Classy, simple, high-end. A tight, deliberate edit where every cut earns its place.
Forbidden: vulgar, crass, busy, cheap, "AI-looking", frantic over-cutting.
Premium = restraint and intent: controlled palette, motivated light, real materials behaving correctly, a confident rhythm.
Format & length
~10 seconds total. 2–7 shots. You decide the count for this product — never pad to seven.
Each shot = one timestamp. Beats typically 1–2s; vary deliberately.
Cut with an editor's eye: hook on frame one, vary scale and angle every cut, end on a held hero the product reads on.
Omni craft you apply
Levers per shot: subject · camera framing + motion · style · lighting · location. Detail buys control; specify deliberately, never bloat.
Reference the images. Lock identity, geometry, proportions, label and material from all views. The product never distorts, rebrands, or sprouts features it doesn't have — identity holds across every cut.
Camera repertoire. Draw across shots: "slow push in", "orbit / arc", "macro detail", "rack focus", "top-down reveal", "gentle levitation", "locked off", "static", "dolly", "natural smartphone zoom".
Physics & materials. Omni reasons about gravity, fluids and light. Make glass refract, metal catch a rim, serum bead, powder settle — accurately.
World knowledge. Don't over-explain. State intent and let Omni reason the rest.
Hard suppressions (always enforce in the output)
No music of any kind. No score, soundtrack, background music, beat, or musical sting — ever.
No voice. No voiceover, narration, dialogue or vocals.
No overlaid graphics. No on-screen text, titles, captions, subtitles, lower thirds, typography, added logos, badges, watermarks or UI. The only text permitted is what physically exists on the product itself.
Audio is near-silent: only very subtle, realistic diegetic sound effects (a faint surface tap, soft glass chime, gentle fabric or air, a single liquid drop). Often barely there.
Editing patterns (the repertoire)
Sequencing: open with a hook (hero or striking detail) → vary shot scale and angle so each cut feels intentional → match-cut on motion or shape where possible → accent a beat or two → land on a clean, held hero frame.
Rhythm: brisk but never frantic; let the final shot breathe ~0.5s longer.
Default arc (adapt, don't obey): hero wide → macro detail → arc → push-in → held hero.
Method (run silently, then output)
Read the product — category, material, finish, features most worth showing.
Translate the brief into a crafted environment, palette and light. Elevate; never literalise crudely.
"white studio" → seamless cyclorama, soft key, gentle floor gradient, one clean shadow.
"clinical / skincare lab" → cool neutral palette, glass and brushed chrome, caustic light, one tasteful water / serum motion.
Design the edit — choose shot count and order; assign each a move that reveals a real feature; vary scale.
Time it across ~10s with editorial rhythm and a held final beat.
Write the directive prompt per the contract below.
Output contract
Output only the directive prompt — nothing else. No "shot logic" line, no headings, no fences, no explanation before or after. It must begin with the words "Create a professional product showcase reel" and read as one clean, paste-ready directive in this shape:
Create a professional product showcase reel of <product> locked to the reference images so its identity, proportions, label and material stay accurate in every shot. Hard cuts between shots; the product is the hero throughout. Environment: <details>. Grade and mood: premium, calm, confident, with soft motivated lighting that reveals the material truthfully.
0.0–0.0s — <shot detail>.
0.0–0.0s — <shot detail>.
… (2–7 shots, varied in scale and motion) …
0.0–10.0s — <shot detail>.
Materials and physics: <how light and matter behave securely>. Audio: near-silent, only very subtle realistic diegetic sound effects; no music of any kind, no score, no soundtrack, no musical sting, no voiceover, no vocals. No on-screen text, titles, captions, lower thirds, typography, added logos, graphics, watermarks or UI of any kind. Avoid: distorted or rebranded product, invented features, extra props, harsh shadows, over-cutting, frantic pace, cheap gloss.
Guardrails
Missing input → make the smallest premium assumption and fold it silently into the directive.
The product is the star; the environment and the edit exist only to serve it.
Never pad the shot count; fewer, better beats beat seven busy ones.
Specs (duration, shot ceiling, image count, aspect) are a dated snapshot — defer to any current limits the operator supplies.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: [
          { text: `Product: ${productDesc || '(no description provided — infer from the reference images)'}\nAtmosphere: ${atmosphereDesc || '(no description provided — infer from the reference images)'}\n\nProduct reference images:` },
          ...productImages.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
          { text: 'Atmosphere reference images:' },
          ...atmosphereImages.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
        ],
        config: { systemInstruction: promptWriterSystemInstruction },
      });

      res.json({ prompt: response.text });
    } catch (e: any) {
      console.error('Error generating prompt:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // Quickly auto-describe an uploaded product/atmosphere in the same voice as the
  // hard-coded examples, so every selection carries a description / style brief.
  app.post('/api/describe', async (req, res) => {
    try {
      const { type, images = [] }: { type?: 'product' | 'atmosphere'; images?: InlineImage[] } = req.body;
      if (images.length === 0) {
        res.status(400).json({ error: 'No images provided' });
        return;
      }
      const ai = getAiClient();

      const productInstruction = `You write ultra-concise product descriptions for a premium product-film tool.
Given product reference image(s), output ONE short description (1–2 sentences, plain language): what the product is, plus its key aesthetic and material details. Match the voice of these examples:
"An oversized cup holder-friendly mug that comes with the last straw you will ever need."
"Premium luxury running sneakers. Sculptural modular sole and an upper made out of suede nubuck leather and mesh sculptural panels."
"A bottle of perfume called 'Nerelle'. The ornate bottle features real stone minerals, sodalite, and malachite."
Output ONLY the description text — no labels, no quotes, no preamble.`;

      const atmosphereInstruction = `You write ultra-concise environment "style briefs" for a premium product-film tool.
Given a reference image of an empty scene or backdrop, output ONE short style brief (1–3 sentences) describing the environment, materials, lighting and mood. Where the product would sit, refer to it as the literal token "the {product_id}" so it can be substituted later. Match the voice of these examples:
"Minimalist craft luxury. A pristine Carrara marble plinth rests against a soft sage backdrop. Crisp directional sunlight casts soft shadows, creating an earthy yet elevated aesthetic. The {product_id} is seen in perfect detail, conveying texture, calm, and sophisticated gradients."
"Mediterranean, modern luxury. Warm, porous travertine blocks create a structured geometric podium beneath a brilliant azure sky, presenting the {product_id} perfectly. Soft dappled leaf shadows contrast the sharp architectural lines, evoking a serene, sun-drenched coastal escape."
"Mediterranean minimalism utilizing a warm sun-drenched, polished plaster corner with a soft rose-tinted floor. Crisp palm frond silhouettes cast dramatic yet serene shadows evoking a premium organic golden-hour mood."
Output ONLY the style brief text — no labels, no quotes, no preamble.`;

      const isAtmosphere = type === 'atmosphere';
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: [
          { text: isAtmosphere ? 'Describe this scene/backdrop as a style brief:' : 'Describe this product:' },
          ...images.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
        ],
        config: {
          systemInstruction: isAtmosphere ? atmosphereInstruction : productInstruction,
          maxOutputTokens: 512,
          temperature: 0.7,
        },
      });

      res.json({ description: (response.text || '').trim() });
    } catch (e: any) {
      console.error('Error describing image:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // Endpoint to start omni generation (the cinematic room walkthrough / "3D-feel" tour)
  app.post('/api/generate-video', async (req, res) => {
    try {
      const { prompt, productImages = [], atmosphereImages = [] }: GenerateBody & { prompt?: string } = req.body;
      const ai = getAiClient();

      console.log(`Sending request to Gemini Omni (${productImages.length} product, ${atmosphereImages.length} atmosphere images)...`);

      const interaction = await ai.interactions.create({
        model: 'gemini-omni-flash-preview',
        input: [
            ...productImages.map(img => ({ type: 'image' as const, data: img.data, mime_type: img.mimeType })),
            ...atmosphereImages.map(img => ({ type: 'image' as const, data: img.data, mime_type: img.mimeType })),
            { type: 'text', text: prompt }
        ],
        response_format: { type: 'video', delivery: 'uri' },
        store: true,
        background: false,
        stream: false
      });

      console.log(`Interaction created: ${interaction.id}`);

      if (!interaction.output_video || !interaction.output_video.uri) {
        throw new Error('No video URI returned from interaction.');
      }

      const fileIdMatch = interaction.output_video.uri.match(/files\/([a-zA-Z0-9_-]+)/);
      const fileId = fileIdMatch ? fileIdMatch[1] : null;

      res.json({ interactionId: interaction.id, uri: interaction.output_video.uri, fileId });
    } catch (e: any) {
      console.error('Error generating video:', e);
      res.status(500).json({ error: e?.body || e.message });
    }
  });

  // Endpoint to edit an existing video via Omni's stateful interaction chaining.
  app.post('/api/edit-video', async (req, res) => {
    try {
      const { previousInteractionId, instructions }: { previousInteractionId?: string; instructions?: string } = req.body;
      if (!previousInteractionId || !instructions) {
        res.status(400).json({ error: 'previousInteractionId and instructions are required' });
        return;
      }
      const ai = getAiClient();

      console.log(`Editing interaction ${previousInteractionId}...`);
      const interaction = await ai.interactions.create({
        model: 'gemini-omni-flash-preview',
        previous_interaction_id: previousInteractionId,
        input: [{ type: 'text', text: instructions }],
        response_format: { type: 'video', delivery: 'uri' },
        store: true,
        background: false,
        stream: false
      });

      if (!interaction.output_video || !interaction.output_video.uri) {
        throw new Error('No video URI returned from interaction.');
      }

      const fileIdMatch = interaction.output_video.uri.match(/files\/([a-zA-Z0-9_-]+)/);
      const fileId = fileIdMatch ? fileIdMatch[1] : null;

      res.json({ interactionId: interaction.id, uri: interaction.output_video.uri, fileId });
    } catch (e: any) {
      console.error('Error editing video:', e);
      res.status(500).json({ error: e?.body || e.message });
    }
  });

  // Endpoint to poll file status
  app.get('/api/file-status/:fileId', async (req, res) => {
    try {
      const { fileId } = req.params;
      const ai = getAiClient();

      const fInfo = await ai.files.get({ name: `files/${fileId}` });
      const state = (fInfo.state as any)?.name || fInfo.state;
      res.json({ state });
    } catch (e: any) {
      console.error('Error getting file status:', e);
      res.status(500).json({ error: e.message });
    }
  });

  const videoCache = new Map<string, Buffer>();

  app.get('/api/video/:fileId', async (req, res) => {
    try {
      const { fileId } = req.params;
      let buffer = videoCache.get(fileId);

      if (!buffer) {
        const apiKey = process.env.GEMINI_API_KEY;
        const url = `https://generativelanguage.googleapis.com/v1beta/files/${fileId}:download?alt=media&key=${apiKey}`;
        const upstream = await fetch(url);
        if (!upstream.ok) {
          return res.status(upstream.status).send(`Failed to fetch video: ${upstream.statusText}`);
        }
        buffer = Buffer.from(await upstream.arrayBuffer());
        if (videoCache.size >= 12) {
          const oldest = videoCache.keys().next().value;
          if (oldest) videoCache.delete(oldest);
        }
        videoCache.set(fileId, buffer);
      }

      const total = buffer.length;
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=31536000');

      const range = req.headers.range;
      if (range) {
        const match = /bytes=(\d*)-(\d*)/.exec(range);
        let start = match && match[1] ? parseInt(match[1], 10) : 0;
        let end = match && match[2] ? parseInt(match[2], 10) : total - 1;
        if (Number.isNaN(start)) start = 0;
        if (Number.isNaN(end) || end >= total) end = total - 1;
        if (start > end || start >= total) {
          res.status(416).setHeader('Content-Range', `bytes */${total}`).end();
          return;
        }
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
        res.setHeader('Content-Length', end - start + 1);
        res.end(buffer.subarray(start, end + 1));
      } else {
        res.setHeader('Content-Length', total);
        res.end(buffer);
      }
    } catch (e: any) {
      console.error('Error streaming video:', e);
      res.status(500).send(e.message);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(port, host, () => {
    console.log(`Server running on http://${host === "0.0.0.0" ? "localhost" : host}:${port}`);
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