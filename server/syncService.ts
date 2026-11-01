import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Express, Request, Response } from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, "data");
const WORKSPACES_FILE = path.join(DATA_DIR, "workspaces_store.json");
const DEVICES_FILE = path.join(DATA_DIR, "devices_store.json");

interface StoredWorkspace {
  user_identifier: string;
  user_email: string;
  workspace_data: any;
  updated_at: string;
  sync_version: number;
}

interface DeviceSession {
  id: string;
  user_email: string;
  user_identifier: string;
  device_name: string;
  platform: string; // 'android_apk' | 'web_browser' | 'ai_studio_preview' | 'other'
  environment: string;
  app_version?: string;
  created_at: number;
  last_active: number;
  ip_address?: string;
  user_agent?: string;
  is_revoked?: boolean;
}

let workspacesStore: Record<string, StoredWorkspace> = {};
let devicesStore: Record<string, DeviceSession> = {};

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (e) {
    console.warn("[SyncService] Data dir creation notice:", e);
  }
}

function loadFromDisk(): void {
  ensureDataDir();
  try {
    if (fs.existsSync(WORKSPACES_FILE)) {
      const raw = fs.readFileSync(WORKSPACES_FILE, "utf-8");
      workspacesStore = JSON.parse(raw);
    }
  } catch (err) {
    console.warn("[SyncService] Failed to load workspaces_store.json:", err);
    workspacesStore = {};
  }

  try {
    if (fs.existsSync(DEVICES_FILE)) {
      const raw = fs.readFileSync(DEVICES_FILE, "utf-8");
      devicesStore = JSON.parse(raw);
    }
  } catch (err) {
    console.warn("[SyncService] Failed to load devices_store.json:", err);
    devicesStore = {};
  }
}

function persistWorkspacesToDisk(): void {
  try {
    ensureDataDir();
    fs.writeFileSync(WORKSPACES_FILE, JSON.stringify(workspacesStore, null, 2), "utf-8");
  } catch (err) {
    console.warn("[SyncService] Failed to persist workspaces:", err);
  }
}

function persistDevicesToDisk(): void {
  try {
    ensureDataDir();
    fs.writeFileSync(DEVICES_FILE, JSON.stringify(devicesStore, null, 2), "utf-8");
  } catch (err) {
    console.warn("[SyncService] Failed to persist devices:", err);
  }
}

// Initial load
loadFromDisk();

/**
 * Reconciles expense lists ensuring Android Native APK transactions (like the ₹2.53 lakh dataset)
 * remain authoritative and are never lost when merging with web client records.
 */
function reconcileExpenses(
  incomingExpenses: any[],
  existingExpenses: any[],
  isIncomingFromApk: boolean,
  deletedIds: Set<string>
): any[] {
  const expenseMap = new Map<string, any>();
  const refMap = new Map<string, string>(); // refId -> expenseId

  const addExp = (e: any, isMaster: boolean) => {
    if (!e || !e.id) return;
    const id = String(e.id).trim();
    if (deletedIds.has(id)) return;

    const ref = (e.smsReferenceId || e.referenceId || e.upiReference || "").trim().toUpperCase();
    if (ref && ref.length >= 4 && refMap.has(ref)) {
      const existingId = refMap.get(ref)!;
      const prev = expenseMap.get(existingId);
      if (prev) {
        if (isMaster) {
          expenseMap.set(id, e);
          if (existingId !== id) expenseMap.delete(existingId);
          refMap.set(ref, id);
        }
        return;
      }
    }

    if (expenseMap.has(id)) {
      const prev = expenseMap.get(id);
      if (isMaster) {
        expenseMap.set(id, e);
      } else {
        const prevTs = Number(prev.updatedAt || prev.createdAt || prev.date || 0);
        const newTs = Number(e.updatedAt || e.createdAt || e.date || 0);
        if (newTs > prevTs) {
          expenseMap.set(id, { ...prev, ...e });
        }
      }
    } else {
      expenseMap.set(id, e);
      if (ref && ref.length >= 4) {
        refMap.set(ref, id);
      }
    }
  };

  if (isIncomingFromApk) {
    existingExpenses.forEach((e) => addExp(e, false));
    incomingExpenses.forEach((e) => addExp(e, true));
  } else {
    existingExpenses.forEach((e) => {
      const isApkItem =
        e.source === "sms_auto" ||
        e.source === "sms_rescan" ||
        String(e.id).startsWith("exp-sms-") ||
        Boolean(e.rawSmsText || e.smsReferenceId || e.upiReference);
      addExp(e, isApkItem);
    });
    incomingExpenses.forEach((e) => addExp(e, false));
  }

  return Array.from(expenseMap.values());
}

export function handleGetWorkspace(req: any, res: any): void {
  try {
    const userIdentifier = ((req.query?.user_identifier || "") as string).trim();
    const userEmail = ((req.query?.user_email || "") as string).trim().toLowerCase();

    if (!userIdentifier && !userEmail) {
      return res.status(400).json({
        success: false,
        error: "Missing user_identifier or user_email query parameter",
      });
    }

    let record = userIdentifier ? workspacesStore[userIdentifier] : null;
    if (!record && userEmail) {
      record = Object.values(workspacesStore).find(
        (w) => w.user_email && w.user_email.toLowerCase() === userEmail
      ) || null;
    }

    if (!record || !record.workspace_data) {
      return res.status(200).json({
        success: true,
        exists: false,
        message: "No remote workspace snapshot exists yet",
        workspace_data: null,
        updated_at: null,
        sync_version: 0,
      });
    }

    return res.status(200).json({
      success: true,
      exists: true,
      user_identifier: record.user_identifier,
      user_email: record.user_email,
      workspace_data: record.workspace_data,
      updated_at: record.updated_at,
      sync_version: record.sync_version,
    });
  } catch (err: any) {
    console.error("[SyncService] Error retrieving workspace:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export function handlePostWorkspace(req: any, res: any): void {
  try {
    const {
      user_identifier,
      user_email,
      workspace_data,
      updated_at,
      sync_version,
      is_apk,
    } = req.body || {};

    if (!user_identifier || !workspace_data) {
      return res.status(400).json({
        success: false,
        error: "Missing user_identifier or workspace_data in request body",
      });
    }

    const activeKey = user_identifier.trim();
    const cleanEmail = (user_email || "").trim().toLowerCase();
    const isFromApk = Boolean(
      is_apk ||
      workspace_data?._meta?.apkInstalled ||
      workspace_data?._meta?.isNativeAndroid
    );

    const existingRecord = workspacesStore[activeKey];
    const now = new Date().toISOString();
    const incomingVersion = Number(sync_version || Date.now());

    let mergedWorkspace = { ...workspace_data };

    if (existingRecord && existingRecord.workspace_data) {
      const existingData = existingRecord.workspace_data;

      const deletedIds = new Set<string>();
      if (Array.isArray(existingData?._meta?.deletedExpenseIds)) {
        existingData._meta.deletedExpenseIds.forEach((id: string) => deletedIds.add(id));
      }
      if (Array.isArray(workspace_data?._meta?.deletedExpenseIds)) {
        workspace_data._meta.deletedExpenseIds.forEach((id: string) => deletedIds.add(id));
      }

      const existingExpenses = Array.isArray(existingData.expenses) ? existingData.expenses : [];
      const incomingExpenses = Array.isArray(workspace_data.expenses) ? workspace_data.expenses : [];

      const reconciledExpenses = reconcileExpenses(
        incomingExpenses,
        existingExpenses,
        isFromApk,
        deletedIds
      );

      mergedWorkspace.expenses = reconciledExpenses;

      const existingDevices = Array.isArray(existingData.devices) ? existingData.devices : [];
      const incomingDevices = Array.isArray(workspace_data.devices) ? workspace_data.devices : [];
      const devMap = new Map<string, any>();
      existingDevices.forEach((d) => d?.id && devMap.set(d.id, d));
      incomingDevices.forEach((d) => {
        if (d?.id) {
          const ex = devMap.get(d.id);
          devMap.set(d.id, ex ? { ...ex, ...d, lastActive: Math.max(ex.lastActive || 0, d.lastActive || 0) } : d);
        }
      });
      mergedWorkspace.devices = Array.from(devMap.values());

      if (!isFromApk && existingData.screenTime && (existingData.screenTime.isFromApk || existingData.screenTime.isNativeAndroid)) {
        mergedWorkspace.screenTime = existingData.screenTime;
      }
      if (!isFromApk && existingData.screenTimeHistory) {
        mergedWorkspace.screenTimeHistory = {
          ...existingData.screenTimeHistory,
          ...(mergedWorkspace.screenTimeHistory || {}),
        };
      }
    }

    const finalVersion = Math.max(
      incomingVersion,
      existingRecord ? existingRecord.sync_version + 1 : Date.now()
    );

    if (!mergedWorkspace._meta) mergedWorkspace._meta = {};
    mergedWorkspace._meta.syncVersion = finalVersion;
    mergedWorkspace._meta.serverSyncedAt = now;

    workspacesStore[activeKey] = {
      user_identifier: activeKey,
      user_email: cleanEmail || existingRecord?.user_email || "",
      workspace_data: mergedWorkspace,
      updated_at: updated_at || now,
      sync_version: finalVersion,
    };

    persistWorkspacesToDisk();

    return res.status(200).json({
      success: true,
      message: "Workspace successfully synchronized with server cloud hub",
      updated_at: now,
      sync_version: finalVersion,
      expense_count: Array.isArray(mergedWorkspace.expenses) ? mergedWorkspace.expenses.length : 0,
    });
  } catch (err: any) {
    console.error("[SyncService] Error saving workspace:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export function handleGetDevices(req: any, res: any): void {
  try {
    const email = ((req.query?.user_email || "") as string).trim().toLowerCase();
    const identifier = ((req.query?.user_identifier || "") as string).trim();

    const now = Date.now();
    const TWO_MINUTES_MS = 2 * 60 * 1000;

    const devices = Object.values(devicesStore)
      .filter((d) => {
        if (d.is_revoked) return false;
        if (email && d.user_email && d.user_email.toLowerCase() === email) return true;
        if (identifier && d.user_identifier === identifier) return true;
        return false;
      })
      .map((d) => ({
        ...d,
        isOnline: now - (d.last_active || 0) <= TWO_MINUTES_MS,
      }))
      .sort((a, b) => b.last_active - a.last_active);

    return res.status(200).json({
      success: true,
      devices,
      count: devices.length,
      active_count: devices.filter((d) => d.isOnline).length,
    });
  } catch (err: any) {
    console.error("[SyncService] Error listing devices:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export function handlePostHeartbeat(req: any, res: any): void {
  try {
    const {
      device_id,
      user_email,
      user_identifier,
      device_name,
      platform,
      environment,
      app_version,
    } = req.body || {};

    if (!device_id) {
      return res.status(400).json({ success: false, error: "Missing device_id" });
    }

    const id = String(device_id).trim();
    const now = Date.now();
    const cleanEmail = (user_email || "").trim().toLowerCase();
    const cleanIdentifier = (user_identifier || "").trim();

    const existing = devicesStore[id];

    devicesStore[id] = {
      id,
      user_email: cleanEmail || existing?.user_email || "gknayak@gmail.com",
      user_identifier: cleanIdentifier || existing?.user_identifier || "user_guest",
      device_name: device_name || existing?.device_name || "Active Session",
      platform: platform || existing?.platform || "web_browser",
      environment: environment || existing?.environment || "Web Browser",
      app_version: app_version || existing?.app_version || "1.0.0",
      created_at: existing ? existing.created_at : now,
      last_active: now,
      ip_address: req.ip || req.socket?.remoteAddress || undefined,
      user_agent: (req.headers?.["user-agent"] as string) || undefined,
      is_revoked: false,
    };

    persistDevicesToDisk();

    return res.status(200).json({
      success: true,
      message: "Heartbeat recorded successfully",
      device_id: id,
      timestamp: now,
    });
  } catch (err: any) {
    console.error("[SyncService] Error recording heartbeat:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export function handleDeleteDevice(req: any, res: any): void {
  try {
    const deviceId = req.params?.deviceId || req.url?.split("/").pop();
    if (deviceId && devicesStore[deviceId]) {
      devicesStore[deviceId].is_revoked = true;
      persistDevicesToDisk();
    }
    return res.status(200).json({ success: true, message: "Device revoked" });
  } catch (err: any) {
    console.error("[SyncService] Error revoking device:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export function registerSyncRoutes(app: Express): void {
  app.get("/api/sync/workspace", handleGetWorkspace);
  app.post("/api/sync/workspace", handlePostWorkspace);
  app.get("/api/sync/devices", handleGetDevices);
  app.post("/api/sync/devices/heartbeat", handlePostHeartbeat);
  app.delete("/api/sync/devices/:deviceId", handleDeleteDevice);
}

/**
 * Vite plugin for dev server support so /api/sync/* routes respond immediately in development mode.
 */
export function syncVitePlugin() {
  return {
    name: "sync-vite-plugin",
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

        if (!pathname.startsWith("/api/sync")) {
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
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS, HEAD");
        res.setHeader("Access-Control-Allow-Headers", "*");

        const method = (req.method || "").toUpperCase();
        if (method === "OPTIONS") {
          res.statusCode = 204;
          return res.end();
        }

        const urlObj = new URL(req.url || "", "http://localhost");
        const query: Record<string, string> = {};
        urlObj.searchParams.forEach((val, key) => {
          query[key] = val;
        });
        req.query = query;

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

        if (pathname === "/api/sync/workspace" && method === "GET") {
          return handleGetWorkspace(req, enhancedRes);
        }

        if (pathname === "/api/sync/workspace" && method === "POST") {
          return handlePostWorkspace(req, enhancedRes);
        }

        if (pathname === "/api/sync/devices" && method === "GET") {
          return handleGetDevices(req, enhancedRes);
        }

        if (pathname === "/api/sync/devices/heartbeat" && method === "POST") {
          return handlePostHeartbeat(req, enhancedRes);
        }

        if (pathname.startsWith("/api/sync/devices/") && method === "DELETE") {
          req.params = { deviceId: pathname.replace("/api/sync/devices/", "") };
          return handleDeleteDevice(req, enhancedRes);
        }

        return next();
      });
    },
  };
}
