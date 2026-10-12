import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Request, Response } from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data directory and file path for persistent screen time storage
const DATA_DIR = path.resolve(__dirname, "data");
const STORE_FILE = path.join(DATA_DIR, "screentime_store.json");

interface ScreenTimeStore {
  latest: any | null;
  history: Record<string, any>;
  lastSyncedTimestamp: number;
}

let inMemoryStore: ScreenTimeStore = {
  latest: null,
  history: {},
  lastSyncedTimestamp: 0,
};

/**
 * Validates that an incoming or persisted payload originates from the Android native APK
 * and is not synthetic, corrupted, or stale unverified mock data.
 */
export function isValidNativeAndroidPayload(payload: any): boolean {
  if (!payload || typeof payload !== "object") return false;
  if (!payload.hasData || typeof payload.totalMinutes !== "number" || payload.totalMinutes < 0) return false;

  // Reject known unverified mock/dummy patterns (e.g. legacy 185m with single Instagram app)
  if (
    payload.totalMinutes === 185 &&
    Array.isArray(payload.apps) &&
    payload.apps.length === 1 &&
    payload.apps[0]?.packageName === "com.instagram.android"
  ) {
    return false;
  }
  if (payload.dataSource === "simulatedBaseline") {
    return false;
  }

  // Must originate from Android native APK
  const isNative = Boolean(
    payload.isFromApk ||
    payload.isNativeAndroid ||
    payload.dataSource === "usageEventsUnion" ||
    payload.dataSource === "usageStatsFallback" ||
    payload.dataSource === "android_native_apk"
  );

  return isNative;
}

// Initialize persistent storage from disk
function loadStoreFromDisk(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const cleanLatest = isValidNativeAndroidPayload(parsed.latest) ? parsed.latest : null;
        const cleanHistory: Record<string, any> = {};
        if (parsed.history && typeof parsed.history === "object") {
          Object.entries(parsed.history).forEach(([d, val]) => {
            if (isValidNativeAndroidPayload(val)) {
              cleanHistory[d] = val;
            }
          });
        }
        inMemoryStore = {
          latest: cleanLatest,
          history: cleanHistory,
          lastSyncedTimestamp: cleanLatest ? (parsed.lastSyncedTimestamp || 0) : 0,
        };
        persistStoreToDisk();
      }
    }
  } catch (err) {
    console.warn("[ScreenTimeService] Notice reading screentime_store.json:", err);
  }
}

function persistStoreToDisk(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(inMemoryStore, null, 2), "utf-8");
  } catch (err) {
    console.warn("[ScreenTimeService] Notice writing screentime_store.json:", err);
  }
}

// Initial load
loadStoreFromDisk();

/**
 * Sanitizes screen time data to prevent multi-megabyte base64 icons from bloating storage.
 */
function sanitizeScreenTimePayload(data: any): any {
  if (!data || typeof data !== "object") return data;
  const clone = { ...data };

  if (Array.isArray(clone.apps)) {
    clone.apps = clone.apps.map((app: any, idx: number) => {
      if (!app || typeof app !== "object") return app;
      const cleanApp = { ...app };
      // Keep icon only for top 5 apps and truncate if raw base64 string exceeds 4KB
      if (idx >= 5) {
        delete cleanApp.icon;
      } else if (cleanApp.icon && typeof cleanApp.icon === "string" && cleanApp.icon.length > 4096) {
        delete cleanApp.icon;
      }
      return cleanApp;
    });
  }

  if (Array.isArray(clone.topApps)) {
    clone.topApps = clone.topApps.map((app: any, idx: number) => {
      if (!app || typeof app !== "object") return app;
      const cleanApp = { ...app };
      if (idx >= 5 || (cleanApp.icon && typeof cleanApp.icon === "string" && cleanApp.icon.length > 4096)) {
        delete cleanApp.icon;
      }
      return cleanApp;
    });
  }

  return clone;
}

export function handleScreenTimeSync(req: Request, res: Response): void {
  try {
    const body = req.body || {};
    const { screenTime, history, date } = body;

    let updated = false;

    if (screenTime && typeof screenTime === "object" && screenTime.hasData) {
      if (!isValidNativeAndroidPayload(screenTime)) {
        res.status(400).json({
          success: false,
          error: "Rejected unverified screen time payload: only authenticated Android native APK data is accepted.",
        });
        return;
      }
      const sanitized = sanitizeScreenTimePayload(screenTime);
      const targetDate = sanitized.date || date || new Date().toISOString().split("T")[0];
      sanitized.date = targetDate;
      sanitized.lastSyncedTimestamp = Date.now();

      inMemoryStore.latest = sanitized;
      inMemoryStore.history[targetDate] = sanitized;
      inMemoryStore.lastSyncedTimestamp = Date.now();
      updated = true;
    }

    if (history && typeof history === "object") {
      Object.entries(history).forEach(([d, val]) => {
        if (val && typeof val === "object" && isValidNativeAndroidPayload(val)) {
          const sanitized = sanitizeScreenTimePayload(val);
          inMemoryStore.history[d] = sanitized;
          updated = true;
        }
      });
    }

    if (updated) {
      persistStoreToDisk();
    }

    res.json({
      success: true,
      timestamp: inMemoryStore.lastSyncedTimestamp || Date.now(),
      hasData: Boolean(inMemoryStore.latest),
    });
  } catch (err: any) {
    console.error("[ScreenTimeService] Sync error:", err);
    res.status(500).json({ success: false, error: err?.message || "Sync failed" });
  }
}

export function handleScreenTimeDaily(req: Request, res: Response): void {
  try {
    const targetDate = (req.query.date as string) || (inMemoryStore.latest?.date) || new Date().toISOString().split("T")[0];

    // Check specific history date first
    if (inMemoryStore.history[targetDate]) {
      res.json({
        success: true,
        data: inMemoryStore.history[targetDate],
      });
      return;
    }

    // Check latest record
    if (inMemoryStore.latest && (inMemoryStore.latest.date === targetDate || !req.query.date)) {
      res.json({
        success: true,
        data: inMemoryStore.latest,
      });
      return;
    }

    // Check if past7Days in latest record has usage for targetDate
    if (inMemoryStore.latest && Array.isArray(inMemoryStore.latest.past7Days)) {
      const match = inMemoryStore.latest.past7Days.find((d: any) => d.date === targetDate);
      if (match) {
        // Construct day summary
        const synth: any = {
          ...inMemoryStore.latest,
          date: targetDate,
          formattedDate: targetDate,
          totalMinutes: match.totalMinutes,
          totalMillis: match.totalMillis,
          hasData: true,
          granted: true,
        };
        res.json({
          success: true,
          data: synth,
        });
        return;
      }
    }

    res.status(404).json({
      success: false,
      message: `No screen time data recorded for date ${targetDate}`,
    });
    return;
  } catch (err: any) {
    console.error("[ScreenTimeService] Daily error:", err);
    res.status(500).json({ success: false, error: err?.message || "Internal error" });
  }
}

export function handleScreenTimeLatest(_req: Request, res: Response): void {
  try {
    if (inMemoryStore.latest) {
      res.json({
        success: true,
        data: inMemoryStore.latest,
        lastSyncedTimestamp: inMemoryStore.lastSyncedTimestamp,
      });
    } else {
      res.status(404).json({
        success: false,
        message: "No screen time data synchronized yet",
      });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Internal error" });
  }
}

export function handleScreenTimeHistory(_req: Request, res: Response): void {
  try {
    res.json({
      success: true,
      history: inMemoryStore.history,
      latest: inMemoryStore.latest,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Internal error" });
  }
}

/**
 * Express router registration for production server (server/index.ts)
 */
export function registerScreenTimeRoutes(app: any): void {
  app.post("/api/screentime/sync", handleScreenTimeSync);
  app.get("/api/screentime/daily", handleScreenTimeDaily);
  app.get("/api/screentime/latest", handleScreenTimeLatest);
  app.get("/api/screentime/history", handleScreenTimeHistory);
}

/**
 * Vite dev server plugin to handle /api/screentime/* routes in development
 */
export function screenTimeVitePlugin() {
  return {
    name: "vite-plugin-screentime",
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        let pathname = "";
        try {
          const rawUrl = req.url || "";
          pathname = rawUrl.startsWith("/")
            ? rawUrl.split("?")[0]
            : new URL(rawUrl, "http://localhost").pathname;
        } catch {
          pathname = (req.url || "").split("?")[0];
        }

        pathname = pathname.replace(/\/+$/, "") || "/";

        if (!pathname.startsWith("/api/screentime")) {
          return next();
        }

        const enhancedRes = Object.assign(res, {
          status(code: number) {
            this.statusCode = code;
            return this;
          },
          json(data: any) {
            if (!this.headersSent) {
              this.setHeader("Content-Type", "application/json");
            }
            this.end(JSON.stringify(data));
          },
        });

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD");
        res.setHeader("Access-Control-Allow-Headers", "*");

        const method = (req.method || "").toUpperCase();
        if (method === "OPTIONS") {
          res.statusCode = 204;
          return res.end();
        }

        // Parse query params
        const urlObj = new URL(req.url || "", "http://localhost");
        const query: Record<string, string> = {};
        urlObj.searchParams.forEach((val, key) => {
          query[key] = val;
        });
        req.query = query;

        // Parse body for POST requests
        if (method === "POST") {
          let bodyData = "";
          for await (const chunk of req) {
            bodyData += chunk;
          }
          try {
            req.body = bodyData ? JSON.parse(bodyData) : {};
          } catch {
            req.body = {};
          }
        }

        if (pathname === "/api/screentime/sync" && method === "POST") {
          return handleScreenTimeSync(req, enhancedRes);
        }

        if (pathname === "/api/screentime/daily" && method === "GET") {
          return handleScreenTimeDaily(req, enhancedRes);
        }

        if (pathname === "/api/screentime/latest" && method === "GET") {
          return handleScreenTimeLatest(req, enhancedRes);
        }

        if (pathname === "/api/screentime/history" && method === "GET") {
          return handleScreenTimeHistory(req, enhancedRes);
        }

        return next();
      });
    },
  };
}
