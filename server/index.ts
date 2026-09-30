import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { registerGeminiRoutes, setupGeminiLiveWebSocket } from "./geminiService.js";
import { rateLimit, requireAuthForServerKeyUsage } from "./security.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Restrict CORS to explicitly allow-listed origins instead of "*"
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    } else if (allowedOrigins.length === 0 && process.env.NODE_ENV !== "production") {
      // Dev convenience only: no allow-list configured outside production
      res.setHeader("Access-Control-Allow-Origin", origin || "*");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-gemini-api-key");
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    next();
  });

  // Security headers: CSP, HSTS, and standard hardening headers on every response
  app.use((_req, res, next) => {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'"
    );
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    next();
  });

  // Setup Gemini Live WebSocket server on /live
  setupGeminiLiveWebSocket(server);

  // Register Gemini Chat, Commands, TTS and Health routes on /api/gemini/*
  registerGeminiRoutes(app);

  // Baseline rate limiting on every API route to blunt abuse/DoS attempts
  app.use("/api/", rateLimit({ windowMs: 60_000, max: 60, keyPrefix: "api" }));

  const hasClientOwnGroqKey = (req: express.Request): boolean => {
    const auth = req.headers.authorization;
    return Boolean(auth && auth !== "Bearer" && auth !== "Bearer ");
  };

  // Proxy /api/groq to Groq API backend
  app.all("/api/groq*", requireAuthForServerKeyUsage(hasClientOwnGroqKey), async (req, res) => {
    try {
      const subPath = req.originalUrl.replace(/^\/api\/groq/, "");
      const targetUrl = `https://api.groq.com/openai/v1${subPath}`;
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (k.toLowerCase() !== "host" && typeof v === "string") {
          headers[k] = v;
        }
      }
      // If client did not supply their own Groq key, inject the server-side environment key
      if (!headers.authorization || headers.authorization === "Bearer" || headers.authorization === "Bearer ") {
        const serverKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
        if (serverKey) {
          headers.authorization = `Bearer ${serverKey.trim()}`;
        }
      }
      const fetchOpts: RequestInit = {
        method: req.method,
        headers,
      };
      if (!["GET", "HEAD"].includes(req.method)) {
        const chunks: any[] = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        fetchOpts.body = Buffer.concat(chunks);
      }
      const upstreamRes = await fetch(targetUrl, fetchOpts);
      res.status(upstreamRes.status);
      upstreamRes.headers.forEach((value, name) => {
        if (name.toLowerCase() !== "content-encoding") {
          res.setHeader(name, value);
        }
      });
      const buf = await upstreamRes.arrayBuffer();
      res.send(Buffer.from(buf));
    } catch (err: any) {
      console.error("[groq proxy]", err);
      res.status(502).json({ error: "Upstream service unavailable" });
    }
  });

  // Proxy /api/supabase to Supabase backend to prevent CORS/sandbox issues in iframes
  const rawSupabaseUrl =
    process.env.VITE_SUPABASE_URL || "https://amlegmbvqzbhqqqbrvjx.supabase.co";
  app.all("/api/supabase*", async (req, res) => {
    try {
      const subPath = req.originalUrl.replace(/^\/api\/supabase/, "");
      const targetUrl = `${rawSupabaseUrl.replace(/\/+$/, "")}${subPath}`;
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (k.toLowerCase() !== "host" && typeof v === "string") {
          headers[k] = v;
        }
      }
      const fetchOpts: RequestInit = {
        method: req.method,
        headers,
      };
      if (!["GET", "HEAD"].includes(req.method)) {
        const chunks: any[] = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        fetchOpts.body = Buffer.concat(chunks);
      }
      const upstreamRes = await fetch(targetUrl, fetchOpts);
      res.status(upstreamRes.status);
      upstreamRes.headers.forEach((value, name) => {
        if (name.toLowerCase() !== "content-encoding") {
          res.setHeader(name, value);
        }
      });
      const buf = await upstreamRes.arrayBuffer();
      res.send(Buffer.from(buf));
    } catch (err: any) {
      console.error("[supabase proxy]", err);
      res.status(502).json({ error: "Upstream service unavailable" });
    }
  });

  // Proxy /api/weather to Open-Meteo to bypass browser sandbox / CORS restrictions
  app.get("/api/weather*", async (req, res) => {
    try {
      const queryString = req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : "";
      const targetUrl = `https://api.open-meteo.com/v1/forecast${queryString}`;
      const upstreamRes = await fetch(targetUrl);
      const data = await upstreamRes.json();
      res.status(upstreamRes.status).json(data);
    } catch (err: any) {
      console.error("[weather proxy]", err);
      res.status(502).json({ error: "Upstream service unavailable" });
    }
  });

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle undefined API routes with JSON so clients never get HTML or empty responses
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: "API endpoint not found", path: req.originalUrl });
  });

  // Handle client-side routing - serve index.html for all other routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  // Global error handler: never leak stack traces or internal details to clients
  app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(`[unhandled error] ${req.method} ${req.originalUrl}:`, err);
    if (res.headersSent) return;
    res.status(500).json({ error: "Internal server error" });
  });

  const PORT = 3000;

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}/`);
  });
}

startServer().catch(console.error);
