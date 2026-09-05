import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

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

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = Number(process.env.PORT) || 3000;

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}/`);
  });
}

startServer().catch(console.error);
