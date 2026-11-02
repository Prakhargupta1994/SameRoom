import express from "express";
import path from "path";
import fs from "fs";
import zlib from "zlib";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";

// ===================== META MODEL API HELPERS (plain fetch, no SDK) =====================
// Meta Model API is OpenAI-compatible. Base URL + model names can be overridden with env vars.
const META_BASE = (process.env.META_BASE_URL || "https://api.meta.ai/v1").replace(/\/$/, "");
const META_TEXT_MODEL = process.env.META_TEXT_MODEL || "muse-spark-1.3"; // reasoning + photo analysis
const META_IMAGE_MODEL = process.env.META_IMAGE_MODEL || "muse-image-1.0"; // restyle + generate
// Only sent if you set it (valid sizes not confirmed yet). Example: META_IMAGE_SIZE=1024x1024
const META_IMAGE_SIZE = process.env.META_IMAGE_SIZE || "";

// ---- errors that say what actually went wrong -------------------------------------------
class MetaError extends Error {
  status: number;
  hint: string;
  detail: string;
  constructor(status: number, hint: string, detail: string) {
    super(detail ? `${hint} (${detail})` : hint);
    this.name = "MetaError";
    this.status = status;
    this.hint = hint;
    this.detail = detail;
  }
}

function hintFor(status: number): string {
  if (status === 401 || status === 403) return "Meta rejected the API key. Check META_API_KEY and that it has Meta Model API access.";
  if (status === 404) return "Meta says not found. Usually a wrong model name or base URL: check META_TEXT_MODEL, META_IMAGE_MODEL and META_BASE_URL.";
  if (status === 400 || status === 415 || status === 422) return "Meta rejected the request. Often the image format or size, or an unfulfillable directive.";
  if (status === 408 || status === 504) return "Meta (or a gateway in front of it) timed out.";
  if (status === 429) return "Rate limit hit or credits used up on Meta API.";
  if (status >= 500) return "Meta had a server error. Try again in a moment.";
  return `Meta returned HTTP ${status}.`;
}

// Short, user-facing text for any error (shown in the app).
function clientMessage(e: any): string {
  return e?.message || "Something went wrong on the server.";
}

const META_TIMEOUT_MS = Number(process.env.META_TIMEOUT_MS) || 150000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- a small built-in test photo (no files needed) --------------------------------------
function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
// 640x480 PNG: wall, floor, window and sofa blocks for health-check testing.
function makeTestRoomPng(): Buffer {
  const W = 640, H = 480;
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    const row = y * (W * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < W; x++) {
      let r = 232, g = 226, b = 214; // wall
      if (y > 340) { r = 150; g = 110; b = 80; } // floor
      if (x >= 420 && x < 580 && y >= 70 && y < 230) {
        r = 200; g = 225; b = 245; // window
        if (x < 426 || x >= 574 || y < 76 || y >= 224) { r = 120; g = 120; b = 120; } // frame
      }
      if (x >= 60 && x < 340 && y >= 270 && y < 365) { r = 110; g = 120; b = 135; } // sofa
      const i = row + 1 + x * 3;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function metaKey(): string {
  const key = process.env.META_API_KEY;
  if (!key) {
    throw new Error("META_API_KEY is missing. Add it as a secret / environment variable and restart.");
  }
  return key;
}

async function metaFetch(path: string, init: { method: string; headers?: Record<string, string>; body?: any }) {
  const started = Date.now();
  const secs = () => ((Date.now() - started) / 1000).toFixed(1);
  let lastErr: any;
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), META_TIMEOUT_MS);
    try {
      const res = await fetch(`${META_BASE}${path}`, {
        ...init,
        signal: ctrl.signal,
        headers: { Authorization: `Bearer ${metaKey()}`, ...(init.headers || {}) },
      });
      const raw = await res.text();
      clearTimeout(timer);
      if (!res.ok) {
        const err = new MetaError(res.status, hintFor(res.status), raw.replace(/\s+/g, " ").slice(0, 300));
        if ((res.status === 429 || res.status >= 502) && attempt === 0) {
          console.warn(`[meta] ${path} -> ${res.status} after ${secs()}s, retrying once`);
          lastErr = err;
          await sleep(1500);
          continue;
        }
        throw err;
      }
      let json: any;
      try {
        json = JSON.parse(raw);
      } catch {
        throw new MetaError(res.status, "Meta returned a reply that is not JSON.", raw.replace(/\s+/g, " ").slice(0, 200));
      }
      console.log(`[meta] ${init.method} ${path} -> ${res.status} in ${secs()}s`);
      return json;
    } catch (e: any) {
      clearTimeout(timer);
      if (e instanceof MetaError) {
        console.error(`[meta] ${path} failed after ${secs()}s: ${e.message}`);
        throw e;
      }
      const timedOut = e?.name === "AbortError";
      const err = new MetaError(
        timedOut ? 504 : 0,
        timedOut ? `No answer from Meta after ${Math.round(META_TIMEOUT_MS / 1000)}s.` : "Could not reach Meta (network error).",
        timedOut ? "" : String(e?.cause?.code || e?.message || e)
      );
      if (!timedOut && attempt === 0) {
        console.warn(`[meta] ${path} network error after ${secs()}s, retrying once: ${err.message}`);
        lastErr = err;
        await sleep(1500);
        continue;
      }
      console.error(`[meta] ${path} failed after ${secs()}s: ${err.message}`);
      throw err;
    }
  }
  throw lastErr;
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
  if (item?.b64_json) {
    let mime = "image/png";
    if (item.b64_json.startsWith("UklGR")) mime = "image/webp";
    else if (item.b64_json.startsWith("/9j/")) mime = "image/jpeg";
    return `data:${mime};base64,${item.b64_json}`;
  }
  if (item?.url) {
    const r = await fetch(item.url);
    if (!r.ok) throw new Error(`Could not download Muse Image result (${r.status})`);
    const buf = Buffer.from(await r.arrayBuffer());
    let mime = r.headers.get("content-type") || "image/png";
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
  const startTime = Date.now();
  console.log(`[Meta Muse Image] Dispatching edit request (prompt length: ${prompt.length})...`);
  const data = await metaFetch("/images/edits", { method: "POST", body: form });
  console.log(`[Meta Muse Image] Edit succeeded in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  return imageFromResponse(data);
}

// Muse Image: generate from text only (used when no photo is supplied).
async function metaGenerateImage(prompt: string): Promise<string> {
  const startTime = Date.now();
  console.log(`[Meta Muse Image] Dispatching text-to-image request...`);
  const data = await metaFetch("/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: META_IMAGE_MODEL,
      prompt,
      ...(META_IMAGE_SIZE ? { size: META_IMAGE_SIZE } : {}),
    }),
  });
  console.log(`[Meta Muse Image] Generation succeeded in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  return imageFromResponse(data);
}
// ===================== END META MODEL API HELPERS =====================

// ===================== PRODUCTION LAYER: limits, cache, queue, stats =====================
const envNum = (name: string, def: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : def;
};
const RATE_WINDOW_MS = envNum("RATE_WINDOW_SECONDS", 600) * 1000;
const RATE_LIMITS: Record<string, number> = {
  render: envNum("RATE_LIMIT_RENDERS", 40), // image renders per device per window
  analyze: envNum("RATE_LIMIT_ANALYSES", 20), // room analyses per device per window
  health: envNum("RATE_LIMIT_HEALTH", 10), // credit-spending health checks per device per window
};
const DAILY_META_CALL_CAP = envNum("DAILY_META_CALL_CAP", 800); // hard ceiling on Meta calls per UTC day
const META_MAX_CONCURRENCY = envNum("META_MAX_CONCURRENCY", 4); // image calls running at once
const META_MAX_QUEUE = envNum("META_MAX_QUEUE", 16); // image calls allowed to wait in line
const CACHE_MAX_BYTES = envNum("CACHE_MAX_MB", 64) * 1024 * 1024;

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

function clientIp(req: any): string {
  const fwd = String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || req.socket?.remoteAddress || "unknown";
}

// Sliding-window rate limit. Returns 0 if allowed, otherwise seconds to wait.
const rateLog = new Map<string, number[]>();
function rateCheck(bucket: string, ip: string): number {
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const hits = (rateLog.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_LIMITS[bucket]) {
    rateLog.set(key, hits);
    return Math.max(1, Math.ceil((hits[0] + RATE_WINDOW_MS - now) / 1000));
  }
  hits.push(now);
  rateLog.set(key, hits);
  return 0;
}
const rateSweeper: any = setInterval(() => {
  const now = Date.now();
  for (const [k, hits] of rateLog) {
    const kept = hits.filter((t) => now - t < RATE_WINDOW_MS);
    if (kept.length) rateLog.set(k, kept);
    else rateLog.delete(k);
  }
}, 60 * 1000);
rateSweeper?.unref?.();

const tooFast = (wait: number) =>
  `Too many requests from this device. Please wait about ${wait} second${wait === 1 ? "" : "s"} and try again.`;

// Server-wide daily budget: protects the API credits even if many devices show up.
let budgetDay = new Date().toISOString().slice(0, 10);
let budgetUsed = 0;
function takeDailyBudget(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== budgetDay) {
    budgetDay = today;
    budgetUsed = 0;
  }
  if (budgetUsed >= DAILY_META_CALL_CAP) return false;
  budgetUsed++;
  return true;
}
const DAILY_CAP_MESSAGE = "Today's render budget for this demo is used up. Please try again tomorrow.";

// LRU cache sized in bytes (renders are large data URLs).
function createLruCache(maxBytes: number, maxEntries = 500) {
  const map = new Map<string, string>();
  let bytes = 0;
  return {
    get(k: string): string | undefined {
      const v = map.get(k);
      if (v === undefined) return undefined;
      map.delete(k);
      map.set(k, v); // mark as recently used
      return v;
    },
    set(k: string, v: string) {
      if (v.length > maxBytes) return;
      const old = map.get(k);
      if (old !== undefined) {
        bytes -= old.length;
        map.delete(k);
      }
      map.set(k, v);
      bytes += v.length;
      while ((bytes > maxBytes || map.size > maxEntries) && map.size) {
        const oldestKey = map.keys().next().value as string;
        bytes -= (map.get(oldestKey) || "").length;
        map.delete(oldestKey);
      }
    },
    get size() {
      return map.size;
    },
    get bytes() {
      return bytes;
    },
  };
}
const renderCache = createLruCache(CACHE_MAX_BYTES);
const analysisCache = createLruCache(4 * 1024 * 1024);
const inflightRenders = new Map<string, Promise<string>>(); // identical requests share one Meta call

// Bounded concurrency + bounded queue for image calls (backpressure instead of pile-ups).
class BusyError extends Error {}
function createLimiter(maxActive: number, maxQueue: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  const pump = () => {
    while (active < maxActive && waiting.length) {
      active++;
      const start = waiting.shift() as () => void;
      start();
    }
  };
  return {
    run<T>(fn: () => Promise<T>): Promise<T> {
      if (active >= maxActive && waiting.length >= maxQueue) {
        return Promise.reject(new BusyError("SameRoom is busy right now. Please try again in a few seconds."));
      }
      return new Promise<T>((resolve, reject) => {
        waiting.push(() => {
          fn()
            .then(resolve, reject)
            .finally(() => {
              active--;
              pump();
            });
        });
        pump();
      });
    },
    get active() {
      return active;
    },
    get waiting() {
      return waiting.length;
    },
  };
}
const imageLimiter = createLimiter(META_MAX_CONCURRENCY, META_MAX_QUEUE);

const stats = {
  renderStarted: 0,
  renderCompleted: 0,
  renderFailed: 0,
  renderCacheHits: 0,
  renderCoalesced: 0,
  renderSecondsTotal: 0,
  analysisStarted: 0,
  analysisCacheHits: 0,
  rateLimited: 0,
  dailyCapHits: 0,
  busyRejected: 0,
};
// ===================== END PRODUCTION LAYER =====================

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

  // Live counters for the production layer (no secrets).
  app.get("/api/stats", (_req, res) => {
    res.json({
      uptimeSeconds: Math.round(process.uptime()),
      renders: {
        started: stats.renderStarted,
        completed: stats.renderCompleted,
        failed: stats.renderFailed,
        cacheHits: stats.renderCacheHits,
        sharedDuplicates: stats.renderCoalesced,
        avgSeconds: stats.renderCompleted ? +(stats.renderSecondsTotal / stats.renderCompleted).toFixed(1) : null,
      },
      analyses: { started: stats.analysisStarted, cacheHits: stats.analysisCacheHits },
      protection: {
        rateLimited: stats.rateLimited,
        dailyCapHits: stats.dailyCapHits,
        busyRejected: stats.busyRejected,
      },
      dailyBudget: { day: budgetDay, used: budgetUsed, cap: DAILY_META_CALL_CAP },
      queue: { active: imageLimiter.active, waiting: imageLimiter.waiting, maxConcurrent: META_MAX_CONCURRENCY, maxWaiting: META_MAX_QUEUE },
      cache: { renders: renderCache.size, approxMB: +(renderCache.bytes / 1048576).toFixed(1) },
      rateLimits: { windowSeconds: RATE_WINDOW_MS / 1000, ...RATE_LIMITS },
    });
  });

  // Basic Health check
  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      provider: "meta",
      engine: "Meta Model API",
      textModel: META_TEXT_MODEL,
      imageModel: META_IMAGE_MODEL,
      metaConfigured: Boolean(process.env.META_API_KEY),
    });
  });

  // Self-test. Open /api/meta-health in the browser.
  //   (no params)  -> checks your key + the text model
  //   ?image=1     -> also checks Muse Image text-to-image (spends a little credit)
  //   ?edit=1      -> also checks the photo-edit endpoint the app uses, with a built-in test photo
  app.get("/api/meta-health", async (req, res) => {
    if (req.query.image === "1" || req.query.edit === "1") {
      const w = rateCheck("health", clientIp(req));
      if (w) {
        res.setHeader("Retry-After", String(w));
        return res.status(429).json({ error: tooFast(w), retryAfterSeconds: w });
      }
    }
    const out: any = {
      baseUrl: META_BASE,
      textModel: META_TEXT_MODEL,
      imageModel: META_IMAGE_MODEL,
      keySet: !!process.env.META_API_KEY,
      timeoutSeconds: META_TIMEOUT_MS / 1000,
    };
    const run = async (key: string, fn: () => Promise<any>) => {
      const t0 = Date.now();
      try {
        Object.assign(out, await fn());
        out[`${key}Ok`] = true;
      } catch (e: any) {
        out[`${key}Ok`] = false;
        out[`${key}Error`] = clientMessage(e);
      }
      out[`${key}Seconds`] = +((Date.now() - t0) / 1000).toFixed(1);
    };
    await run("text", async () => ({ reply: await metaChat("Reply with exactly: Meta API works.") }));
    if (req.query.image === "1") {
      await run("image", async () => {
        const img = await metaGenerateImage("A simple bright living room, photorealistic.");
        return { imageApproxKB: Math.round(img.length / 1024) };
      });
    }
    if (req.query.edit === "1") {
      await run("edit", async () => {
        const png = makeTestRoomPng();
        const img = await metaEditImage(
          { mimeType: "image/png", data: png.toString("base64") },
          "Restyle this simple room photo in warm Japandi style. Keep the same walls, window and sofa positions."
        );
        return { editApproxKB: Math.round(img.length / 1024) };
      });
    }
    const failed = out.textOk === false || out.imageOk === false || out.editOk === false;
    res.status(failed ? 500 : 200).json(out);
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

      const shareId = "r_" + Math.random().toString(36).substring(2, 8) + Date.now().toString(36).substring(4);
      const record = {
        ...shareData,
        shareId,
        createdAt: Date.now()
      };

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
      if (rawImages.length > 0 && parsedImages.length === 0) {
        return res.status(400).json({
          error: "Could not read the photo. Please use a JPG, WebP, or PNG.",
        });
      }

      const humanRoom = roomType && roomType !== "auto" && roomType !== "room" ? roomType : "room";
      const isExterior = /exterior|facade|elevation|garden|landscape|yard|curb|outdoor|patio|balcony|courtyard|aangan|verandah|thinnai|terrace/i.test(humanRoom);

      // Palette hints if provided
      let paletteHint = "";
      if (paletteSpecs) {
        const dom = paletteSpecs.dominant ? `60% Main: ${paletteSpecs.dominant.name} (${paletteSpecs.dominant.hex || ''})` : "";
        const sec = paletteSpecs.secondary ? `30% Secondary: ${paletteSpecs.secondary.name} (${paletteSpecs.secondary.hex || ''})` : "";
        const acc = paletteSpecs.accent ? `10% Accent: ${paletteSpecs.accent.name} (${paletteSpecs.accent.hex || ''})` : "";
        paletteHint = [dom, sec, acc].filter(Boolean).join("; ");
      }

      if (parsedImages.length > 0) {
        let targetIndex = 0;
        if (mode === "angle") {
          targetIndex = Math.min(Math.max(0, targetAngleIndex), parsedImages.length - 1);
        }
        const targetImage = parsedImages[targetIndex];

        // Synthesize a concise, high-impact architectural directive tailored for Meta Muse Image (<400 chars for optimal latency)
        const promptSnippets: string[] = [];
        if (stylingMode === "paint_only") {
          promptSnippets.push(`Architectural repaint of this exact ${humanRoom}. Strictly preserve all original furniture, layout, walls, and windows.`);
          if (tweakColor) promptSnippets.push(`Repaint surfaces in ${tweakColor}.`);
          else if (paletteHint) promptSnippets.push(`Repaint using palette: ${paletteHint}.`);
          else promptSnippets.push(`Repaint in ${prompt}.`);
        } else if (stylingMode === "declutter_polish") {
          promptSnippets.push(`Professional declutter and architectural styling refresh of this exact ${humanRoom} in ${prompt}. Retain existing room layout, perspective, walls, and flooring.`);
        } else if (stylingMode === "virtual_staging") {
          promptSnippets.push(`Virtual staging of this exact ${humanRoom} in ${prompt}. Preserve exact room walls, windows, door frames, and perspective. Add tastefully scaled furniture.`);
        } else if (isExterior) {
          promptSnippets.push(`Architectural exterior and landscape restyling of this exact property in ${prompt}. Preserve exact building elevation massing, window/door placements, rooflines, and boundary walls.`);
        } else {
          promptSnippets.push(`In-place architectural interior restyling of this exact ${humanRoom} in ${prompt}. Preserve exact room walls, ceiling height, window openings, door frames, and perspective.`);
        }

        if (paletteHint && stylingMode !== "paint_only") {
          promptSnippets.push(`Palette: ${paletteHint}.`);
        }
        if (customDirectives && customDirectives.trim()) {
          promptSnippets.push(`User directives: ${customDirectives.trim()}.`);
        }
        if (tweakColor && stylingMode !== "paint_only") {
          promptSnippets.push(`Apply ${tweakColor} tone.`);
        }
        if (bedSize && bedSize !== "None") {
          promptSnippets.push(`Scaled for ${bedSize} bed.`);
        }
        if (lightingTimeOfDay === "golden_hour") {
          promptSnippets.push(`Warm golden hour natural sunlight (~2800K).`);
        } else if (lightingTimeOfDay === "bright_noon") {
          promptSnippets.push(`Crisp bright noon daylight (~5500K).`);
        } else if (lightingTimeOfDay === "blue_hour") {
          promptSnippets.push(`Cinematic blue hour twilight with warm interior lighting.`);
        }
        promptSnippets.push(`High resolution architectural photography, photorealistic, natural lighting.`);

        const conciseDirective = promptSnippets.join(" ");

        // Production layer: cache check -> join identical in-flight call -> rate limit -> daily cap -> queue
        const cacheKey = sha256(`${META_IMAGE_MODEL}\n${targetImage.inlineData.data}\n${conciseDirective}`);
        const cachedUrl = renderCache.get(cacheKey);
        if (cachedUrl) {
          stats.renderCacheHits++;
          console.log(`[Cache Hit] Returning cached render for ${humanRoom} (${stylingMode})`);
          return res.json({ imageUrl: cachedUrl, mode, targetAngleIndex, provider: "meta", cached: true });
        }

        let job = inflightRenders.get(cacheKey);
        if (job) {
          stats.renderCoalesced++;
          console.log(`[In-Flight Deduplication] Reusing active render promise for ${humanRoom}`);
        } else {
          const wait = rateCheck("render", clientIp(req));
          if (wait) {
            stats.rateLimited++;
            res.setHeader("Retry-After", String(wait));
            return res.status(429).json({ error: tooFast(wait), retryAfterSeconds: wait });
          }
          if (!takeDailyBudget()) {
            stats.dailyCapHits++;
            return res.status(429).json({ error: DAILY_CAP_MESSAGE });
          }

          console.log(
            `[generate] room="${humanRoom}" mode=${stylingMode} photo=${Math.round((targetImage.inlineData.data.length * 0.75) / 1024)}KB promptChars=${conciseDirective.length} queue=${imageLimiter.active}/${imageLimiter.waiting}`
          );
          stats.renderStarted++;
          const t0 = Date.now();
          job = imageLimiter
            .run(() => metaEditImage(targetImage.inlineData, conciseDirective))
            .then(
              (url) => {
                renderCache.set(cacheKey, url);
                stats.renderCompleted++;
                stats.renderSecondsTotal += (Date.now() - t0) / 1000;
                return url;
              },
              (e) => {
                stats.renderFailed++;
                throw e;
              }
            )
            .finally(() => inflightRenders.delete(cacheKey));
          inflightRenders.set(cacheKey, job);
        }

        const imageUrl = await job;
        res.json({ imageUrl, mode, targetAngleIndex, provider: "meta" });
      } else {
        const textPrompt = `High resolution architectural photography of a ${humanRoom} in ${prompt}. Photorealistic, natural lighting.`;
        const cacheKey = sha256(`${META_IMAGE_MODEL}\ntext_only\n${textPrompt}`);
        const cachedUrl = renderCache.get(cacheKey);
        if (cachedUrl) {
          stats.renderCacheHits++;
          return res.json({ imageUrl: cachedUrl, mode, targetAngleIndex, provider: "meta", cached: true });
        }

        const wait = rateCheck("render", clientIp(req));
        if (wait) {
          stats.rateLimited++;
          res.setHeader("Retry-After", String(wait));
          return res.status(429).json({ error: tooFast(wait), retryAfterSeconds: wait });
        }
        if (!takeDailyBudget()) {
          stats.dailyCapHits++;
          return res.status(429).json({ error: DAILY_CAP_MESSAGE });
        }

        stats.renderStarted++;
        const t0 = Date.now();
        const imageUrl = await imageLimiter.run(() => metaGenerateImage(textPrompt));
        renderCache.set(cacheKey, imageUrl);
        stats.renderCompleted++;
        stats.renderSecondsTotal += (Date.now() - t0) / 1000;

        res.json({ imageUrl, mode, targetAngleIndex, provider: "meta" });
      }
    } catch (error: any) {
      console.error("Error generating image:", error?.message || error);
      if (error instanceof BusyError) {
        stats.busyRejected++;
        res.setHeader("Retry-After", "5");
        return res.status(503).json({ error: error.message });
      }
      const upstream = error instanceof MetaError;
      res.status(upstream ? 502 : 500).json({
        error: clientMessage(error) || "Failed to generate image",
        upstreamStatus: upstream ? error.status : undefined,
      });
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
      const analyzeKey = sha256(`analyze\n${META_TEXT_MODEL}\n${parsed.inlineData.data}`);
      const cachedAnalysis = analysisCache.get(analyzeKey);
      if (cachedAnalysis) {
        stats.analysisCacheHits++;
        return res.json({ ...JSON.parse(cachedAnalysis), cached: true });
      }
      const waitA = rateCheck("analyze", clientIp(req));
      if (waitA) {
        stats.rateLimited++;
        res.setHeader("Retry-After", String(waitA));
        return res.status(429).json({ error: tooFast(waitA), retryAfterSeconds: waitA });
      }
      if (!takeDailyBudget()) {
        stats.dailyCapHits++;
        return res.status(429).json({ error: DAILY_CAP_MESSAGE });
      }
      stats.analysisStarted++;

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
      analysisCache.set(analyzeKey, JSON.stringify(data));
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

  // Prompt generation assistant using Meta Muse Spark
  app.post('/api/generate-prompt', async (req, res) => {
    try {
      const { productDesc, atmosphereDesc }: GenerateBody = req.body;
      const prompt = await metaChat(
        `You are a licensed interior architect and design prompt writer. Combine the spatial item description ("${productDesc || ''}") and atmosphere ("${atmosphereDesc || ''}") into a single cohesive architectural photo directive. Output ONLY the styling prompt string.`,
        { temperature: 0.7 }
      );
      res.json({ prompt: prompt.trim() });
    } catch (e: any) {
      console.error('Error generating prompt:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // Describe an uploaded product or room atmosphere using Meta Muse Spark
  app.post('/api/describe', async (req, res) => {
    try {
      const { type, images = [] }: { type?: 'product' | 'atmosphere'; images?: InlineImage[] } = req.body;
      if (images.length === 0) {
        res.status(400).json({ error: 'No images provided' });
        return;
      }

      const instruction = type === 'atmosphere'
        ? 'Describe this scene or room backdrop as a concise architectural style brief (1-2 sentences):'
        : 'Describe this furniture piece or decor item concisely (1-2 sentences):';

      const description = await metaChat([
        { type: 'text', text: instruction },
        { type: 'image_url', image_url: { url: `data:${images[0].mimeType};base64,${images[0].data}` } }
      ]);

      res.json({ description: description.trim() });
    } catch (e: any) {
      console.error('Error describing image:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // Video tour endpoints
  app.post('/api/generate-video', (_req, res) => {
    res.status(501).json({ error: 'Video tour is not available with the Meta API.' });
  });

  app.post('/api/edit-video', (_req, res) => {
    res.status(501).json({ error: 'Video tour editing is not available with the Meta API.' });
  });

  app.get('/api/file-status/:fileId', (_req, res) => {
    res.status(404).json({ error: 'File tracking is not supported on Meta API.' });
  });

  app.get('/api/video/:fileId', (_req, res) => {
    res.status(404).json({ error: 'Video playback is not supported on Meta API.' });
  });

  const rootPath = process.cwd();
  const distPath = path.join(rootPath, "dist");
  const hasDist = fs.existsSync(distPath) && fs.existsSync(path.join(distPath, "index.html"));

  // Serve test-image2.jpeg if requested directly
  const testImgPath = path.join(rootPath, "test-image2.jpeg");
  if (fs.existsSync(testImgPath)) {
    app.get("/test-image2.jpeg", (_req, res) => {
      res.sendFile(testImgPath);
    });
  }

  // Vite middleware for development
  if (!hasDist || process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        }
      }
    }));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, host, () => {
    console.log(`Server running on http://${host}:${port} [Meta API Mode with Production Scaling Layer]`);
  });
}

startServer().catch(console.error);