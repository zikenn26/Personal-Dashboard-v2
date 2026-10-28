import type { NextFunction, Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Lightweight in-memory per-IP rate limiter (no external dependency required).
// Suitable for a single-process deployment; swap for a shared store (Redis)
// if the server is ever scaled horizontally.
// ---------------------------------------------------------------------------
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function rateLimit(options: { windowMs: number; max: number; keyPrefix: string }) {
  const { windowMs, max, keyPrefix } = options;
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (bucket.count >= max) {
      const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfterSec));
      return res.status(429).json({ error: "Too many requests, please try again later." });
    }

    bucket.count += 1;
    next();
  };
}

// ---------------------------------------------------------------------------
// Supabase JWT verification for routes that spend the server's own API keys.
// ---------------------------------------------------------------------------
let verifierClient: ReturnType<typeof createClient> | null = null;

function getVerifierClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  if (!verifierClient) {
    verifierClient = createClient(url, anonKey, { auth: { persistSession: false } });
  }
  return verifierClient;
}

/**
 * Requires a valid Supabase-issued access token ONLY when the caller is about to
 * consume the server's own injected API key (i.e. no client-supplied key/header).
 * If Supabase is not configured server-side, auth is skipped (local/offline mode).
 */
export function requireAuthForServerKeyUsage(hasClientOwnKey: (req: Request) => boolean) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (hasClientOwnKey(req)) return next();

    const client = getVerifierClient();
    if (!client) return next(); // Supabase not configured server-side; nothing to enforce.

    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : undefined;
    if (!token) {
      return res.status(401).json({ error: "Authentication required to use the shared API key." });
    }

    try {
      const { data, error } = await client.auth.getUser(token);
      if (error || !data.user) {
        return res.status(401).json({ error: "Invalid or expired session." });
      }
      next();
    } catch {
      return res.status(401).json({ error: "Invalid or expired session." });
    }
  };
}
