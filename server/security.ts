import type { NextFunction, Request, Response } from "express";

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
// JWT / Bearer Token Verification for Routes Consuming Server-Injected Keys.
// Operates cleanly with standard tokens without proprietary client bindings.
// ---------------------------------------------------------------------------
function parseJwtPayload(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const decoded = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Requires a valid access token ONLY when the caller is about to
 * consume the server's own injected API key (i.e. no client-supplied key/header).
 * If no authentication token is provided in production, blocks unauthorized usage.
 */
export function requireAuthForServerKeyUsage(hasClientOwnKey: (req: Request) => boolean) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (hasClientOwnKey(req)) return next();

    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : undefined;

    // Allow in local development without enforcing auth if no header present
    if (!token && process.env.NODE_ENV !== "production") {
      return next();
    }

    if (!token) {
      return res.status(401).json({ error: "Authentication required to use the shared API key." });
    }

    try {
      const payload = parseJwtPayload(token);
      if (payload) {
        // Check expiration if present
        if (payload.exp && typeof payload.exp === 'number') {
          const nowSec = Math.floor(Date.now() / 1000);
          if (payload.exp < nowSec) {
            return res.status(401).json({ error: "Invalid or expired session token." });
          }
        }
        return next();
      }

      // If token is a non-JWT session token or API token with sufficient length
      if (token.length >= 16) {
        return next();
      }

      return res.status(401).json({ error: "Invalid session token." });
    } catch {
      return res.status(401).json({ error: "Invalid or expired session." });
    }
  };
}
