import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { registerGeminiRoutes, setupGeminiLiveWebSocket } from "./geminiService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Global CORS and headers configuration
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD");
    res.setHeader("Access-Control-Allow-Headers", "*");
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    next();
  });

  // Setup Gemini Live WebSocket server on /live
  setupGeminiLiveWebSocket(server);

  // Register Gemini Chat, Commands, TTS and Health routes on /api/gemini/*
  registerGeminiRoutes(app);

  // Proxy /api/groq to Groq API backend
  app.all("/api/groq*", async (req, res) => {
    try {
      const subPath = req.originalUrl.replace(/^\/api\/groq/, "");
      const targetUrl = `https://api.groq.com/openai/v1${subPath}`;
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
      res.status(502).json({ error: "Groq proxy error", message: err?.message });
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
      res.status(502).json({ error: "Supabase proxy error", message: err?.message });
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
      res.status(502).json({ error: "Weather proxy error", message: err?.message });
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

  const PORT = 3000;

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}/`);
  });
}

startServer().catch(console.error);
