import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer, IncomingMessage } from "http";
import { pool } from "./db.js";

interface ClientSocketMeta {
  id: string;
  userIdentifier: string;
  userEmail: string;
  deviceId: string;
  deviceName?: string;
  platform: string;
  isAlive: boolean;
  connectedAt: number;
}

// Map socket instance to its client metadata
const socketMetaMap = new WeakMap<WebSocket, ClientSocketMeta>();

// Map normalized user identifier to set of active WebSockets
const userRooms = new Map<string, Set<WebSocket>>();

let syncWss: WebSocketServer | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;
let broadcastCount = 0;

// In-memory atomic serial execution queue and cache per user workspace
const userWorkspaceQueues = new Map<string, Promise<any>>();
const userWorkspaceMemoryCache = new Map<string, { workspace: any; version: number }>();

export function enqueueUserMutation<T>(userIdent: string, task: () => Promise<T>): Promise<T> {
  const key = normalizeRoomKey(userIdent);
  const previous = userWorkspaceQueues.get(key) || Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(() => task());
  userWorkspaceQueues.set(key, next);
  return next;
}

export function normalizeRoomKey(identifier: string): string {
  const clean = String(identifier || "").toLowerCase().trim();
  if (!clean) return "user_guest";
  return clean.replace(/[^a-z0-9_@.-]/g, "_");
}

/**
 * Broadcast an event to all connected clients in a user's room.
 */
export function broadcastWorkspaceUpdate(
  userIdentifier: string,
  event: {
    type: string;
    userIdentifier?: string;
    module?: string;
    action?: string;
    payload?: any;
    vectorTimestamp?: number;
    syncVersion?: number;
    sourceDeviceId?: string;
    timestamp?: string;
    fullWorkspace?: any;
  },
  excludeSocket?: WebSocket
): number {
  const roomKey = normalizeRoomKey(userIdentifier);
  const roomSockets = userRooms.get(roomKey);
  if (!roomSockets || roomSockets.size === 0) {
    return 0;
  }

  const payloadString = JSON.stringify({
    ...event,
    serverTimestamp: new Date().toISOString(),
    vectorTimestamp: event.vectorTimestamp || Date.now(),
  });

  let sentCount = 0;
  for (const client of roomSockets) {
    if (client !== excludeSocket && client.readyState === WebSocket.OPEN) {
      try {
        client.send(payloadString);
        sentCount++;
      } catch (err) {
        console.warn("[SyncWS] Failed to send to client socket:", err);
      }
    }
  }

  broadcastCount++;
  return sentCount;
}

/**
 * Forcefully terminates any active WebSocket connections for a user on other devices.
 * Sends SESSION_TERMINATED to those sockets and closes them to ensure singleton session enforcement.
 */
export function revokePreviousUserSessions(
  identifiers: string[],
  currentDeviceId: string,
  newDeviceName: string
): number {
  let revokedCount = 0;
  const cleanDevice = String(currentDeviceId || "").trim();
  const readableDevice = String(newDeviceName || "Another Device").trim();

  const terminationPayload = JSON.stringify({
    type: "SESSION_TERMINATED",
    reason: "new_login",
    newDeviceId: cleanDevice,
    newDeviceName: readableDevice,
    message: `Logged out because your account was signed in on ${readableDevice}`,
    serverTimestamp: new Date().toISOString(),
  });

  const socketsToClose: WebSocket[] = [];
  const roomKeys = new Set(identifiers.filter(Boolean).map((id) => normalizeRoomKey(id)));

  for (const [roomKey, sockets] of userRooms.entries()) {
    if (!roomKeys.has(roomKey)) continue;

    for (const client of sockets) {
      const meta = socketMetaMap.get(client);
      // Skip if it's the exact same device connecting
      if (meta && cleanDevice && meta.deviceId === cleanDevice) {
        continue;
      }

      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(terminationPayload);
        } catch (err) {
          console.warn("[SyncWS] Failed to send termination payload to socket:", err);
        }
      }
      socketsToClose.push(client);
      revokedCount++;
    }
  }

  for (const sock of socketsToClose) {
    try {
      const meta = socketMetaMap.get(sock);
      if (meta) {
        leaveRoom(meta.userIdentifier, sock);
      }
      sock.close(4001, `Session Terminated: Logged in on ${readableDevice}`);
    } catch {}
  }

  if (revokedCount > 0) {
    console.info(`[SyncWS] Singleton enforcement revoked ${revokedCount} older socket session(s) for user.`);
  }

  return revokedCount;
}

/**
 * Setup WebSocket Server attached to HTTP server for real-time synchronization.
 */
export function setupSyncWebSocket(server: HttpServer): WebSocketServer {
  const attachUpgrade = (wss: WebSocketServer) => {
    server.on("upgrade", (request: IncomingMessage, socket, head) => {
      try {
        const parsedUrl = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);
        const pathname = parsedUrl.pathname.replace(/\/+$/, "") || "/";

        if (pathname === "/api/sync/ws" || pathname === "/ws/sync") {
          wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit("connection", ws, request);
          });
        }
      } catch (err) {
        console.warn("[SyncWS] Upgrade parsing notice:", err);
      }
    });
  };

  if (syncWss) {
    attachUpgrade(syncWss);
    return syncWss;
  }

  syncWss = new WebSocketServer({ noServer: true });
  attachUpgrade(syncWss);

  syncWss.on("connection", (clientWs: WebSocket, request?: IncomingMessage) => {
    const socketId = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    let initialUser = "user_guest";
    let initialEmail = "guest@workspace.local";
    let initialDeviceId = `device_${Math.random().toString(36).slice(2, 8)}`;
    let initialDeviceName = "Web Browser";
    let initialPlatform = "web";

    try {
      if (request?.url) {
        const urlObj = new URL(request.url, `http://${request.headers?.host || "localhost"}`);
        const qIdent = urlObj.searchParams.get("userIdentifier") || urlObj.searchParams.get("user_identifier");
        const qEmail = urlObj.searchParams.get("userEmail") || urlObj.searchParams.get("user_email");
        const qDev = urlObj.searchParams.get("deviceId") || urlObj.searchParams.get("device_id");
        const qDevName = urlObj.searchParams.get("deviceName") || urlObj.searchParams.get("device_name");
        const qPlat = urlObj.searchParams.get("platform");

        if (qIdent) initialUser = qIdent;
        if (qEmail) initialEmail = qEmail;
        if (qDev) initialDeviceId = qDev;
        if (qDevName) initialDeviceName = qDevName;
        if (qPlat) initialPlatform = qPlat;
      }
    } catch {}

    const meta: ClientSocketMeta = {
      id: socketId,
      userIdentifier: initialUser,
      userEmail: initialEmail,
      deviceId: initialDeviceId,
      deviceName: initialDeviceName,
      platform: initialPlatform,
      isAlive: true,
      connectedAt: Date.now(),
    };

    socketMetaMap.set(clientWs, meta);

    // Enforce singleton session if connected with an authenticated user
    if (initialEmail && initialEmail !== "guest@workspace.local" && !initialUser.startsWith("user_guest")) {
      revokePreviousUserSessions([initialUser, initialEmail], initialDeviceId, initialDeviceName);
    }

    // Join room
    joinRoom(initialUser, clientWs);

    // Send welcome & subscription confirmation
    clientWs.send(
      JSON.stringify({
        type: "CONNECTED",
        socketId,
        userIdentifier: initialUser,
        room: normalizeRoomKey(initialUser),
        connectedClientsInRoom: userRooms.get(normalizeRoomKey(initialUser))?.size || 1,
        serverTime: new Date().toISOString(),
      })
    );

    clientWs.on("pong", () => {
      const m = socketMetaMap.get(clientWs);
      if (m) m.isAlive = true;
    });

    clientWs.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await handleClientMessage(clientWs, message);
      } catch (err) {
        console.warn("[SyncWS] Message handler error:", err);
        clientWs.send(
          JSON.stringify({
            type: "ERROR",
            error: "Invalid JSON or payload format",
          })
        );
      }
    });

    clientWs.on("close", () => {
      const m = socketMetaMap.get(clientWs);
      if (m) {
        leaveRoom(m.userIdentifier, clientWs);
      }
    });

    clientWs.on("error", (err) => {
      console.warn("[SyncWS] Client socket error:", err);
      const m = socketMetaMap.get(clientWs);
      if (m) {
        leaveRoom(m.userIdentifier, clientWs);
      }
    });
  });

  // Keep-alive heartbeat interval every 25 seconds
  if (!heartbeatInterval) {
    heartbeatInterval = setInterval(() => {
      if (!syncWss) return;
      for (const client of syncWss.clients) {
        const meta = socketMetaMap.get(client);
        if (!meta) continue;

        if (!meta.isAlive) {
          leaveRoom(meta.userIdentifier, client);
          client.terminate();
          continue;
        }

        meta.isAlive = false;
        try {
          client.ping();
        } catch {
          client.terminate();
        }
      }
    }, 25000);
  }

  console.log("[SyncWS] Full-duplex WebSocket live sync hub initialized on /api/sync/ws");
  return syncWss;
}

function joinRoom(userIdentifier: string, ws: WebSocket) {
  const roomKey = normalizeRoomKey(userIdentifier);
  let room = userRooms.get(roomKey);
  if (!room) {
    room = new Set<WebSocket>();
    userRooms.set(roomKey, room);
  }
  room.add(ws);
}

function leaveRoom(userIdentifier: string, ws: WebSocket) {
  const roomKey = normalizeRoomKey(userIdentifier);
  const room = userRooms.get(roomKey);
  if (room) {
    room.delete(ws);
    if (room.size === 0) {
      userRooms.delete(roomKey);
    }
  }
}

/**
 * Process client WebSocket messages
 */
async function handleClientMessage(ws: WebSocket, msg: any): Promise<void> {
  const meta = socketMetaMap.get(ws);
  if (!meta) return;

  const type = msg.type || "";

  switch (type) {
    case "PING": {
      meta.isAlive = true;
      ws.send(JSON.stringify({ type: "PONG", timestamp: Date.now() }));
      break;
    }

    case "SUBSCRIBE": {
      const newIdent = String(msg.userIdentifier || meta.userIdentifier).trim();
      const newEmail = String(msg.userEmail || meta.userEmail).trim();
      const newDevice = String(msg.deviceId || meta.deviceId).trim();
      const newDeviceName = String(msg.deviceName || meta.deviceName || "").trim();
      const newPlatform = String(msg.platform || meta.platform).trim();

      if (newIdent !== meta.userIdentifier) {
        leaveRoom(meta.userIdentifier, ws);
        joinRoom(newIdent, ws);
      }

      meta.userIdentifier = newIdent;
      meta.userEmail = newEmail;
      meta.deviceId = newDevice;
      if (newDeviceName) meta.deviceName = newDeviceName;
      meta.platform = newPlatform;

      // Singleton session enforcement on subscribe
      if (newEmail && newEmail !== "guest@workspace.local" && !newIdent.startsWith("user_guest")) {
        revokePreviousUserSessions([newIdent, newEmail], newDevice, newDeviceName || meta.deviceName || "Another Device");
      }

      const roomKey = normalizeRoomKey(newIdent);
      ws.send(
        JSON.stringify({
          type: "SUBSCRIBED",
          userIdentifier: newIdent,
          room: roomKey,
          connectedClientsInRoom: userRooms.get(roomKey)?.size || 1,
          timestamp: new Date().toISOString(),
        })
      );
      break;
    }

    case "REQUEST_STATE": {
      const roomKey = normalizeRoomKey(meta.userIdentifier);
      try {
        const queryRes = await pool.query(
          "SELECT workspace_data, updated_at, sync_version FROM workspaces WHERE user_identifier = $1",
          [meta.userIdentifier]
        );

        if (queryRes.rows.length > 0) {
          const row = queryRes.rows[0];
          ws.send(
            JSON.stringify({
              type: "STATE_RESPONSE",
              userIdentifier: meta.userIdentifier,
              workspace_data: row.workspace_data,
              sync_version: row.sync_version,
              updated_at: row.updated_at,
            })
          );
        } else {
          ws.send(
            JSON.stringify({
              type: "STATE_RESPONSE",
              userIdentifier: meta.userIdentifier,
              workspace_data: null,
              sync_version: 0,
              updated_at: null,
            })
          );
        }
      } catch (err: any) {
        ws.send(
          JSON.stringify({
            type: "ERROR",
            error: err?.message || "Failed to fetch state",
          })
        );
      }
      break;
    }

    case "MUTATION": {
      // Millisecond vector clock LWW mutation with atomic mutex queue
      const userIdent = String(msg.userIdentifier || meta.userIdentifier).trim();
      const userEmail = String(msg.userEmail || meta.userEmail).trim().toLowerCase();
      const moduleName = String(msg.module || "all").trim();
      const action = String(msg.action || "UPSERT").toUpperCase();
      const payload = msg.payload;
      const vectorTimestamp = Number(msg.vectorTimestamp) || Date.now();
      const sourceDeviceId = String(msg.deviceId || meta.deviceId).trim();

      await enqueueUserMutation(userIdent, async () => {
        try {
          const roomKey = normalizeRoomKey(userIdent);
          let cached = userWorkspaceMemoryCache.get(roomKey);

          if (!cached) {
            const selectRes = await pool.query(
              "SELECT workspace_data, sync_version FROM workspaces WHERE user_identifier = $1",
              [userIdent]
            );
            if (selectRes.rows.length > 0) {
              cached = {
                workspace: selectRes.rows[0].workspace_data || {},
                version: Number(selectRes.rows[0].sync_version) || 0,
              };
            } else {
              cached = { workspace: {}, version: 0 };
            }
          }

          const currentWorkspace = cached.workspace;
          const currentVersion = cached.version;
          const nextVersion = Math.max(currentVersion + 1, vectorTimestamp);

          // Apply module-specific merge with last-write-wins timestamps
          if (moduleName === "todos" || moduleName === "tasks") {
            currentWorkspace.todos = mergeCollectionLWW(
              currentWorkspace.todos || [],
              Array.isArray(payload) ? payload : [payload],
              action
            );
          } else if (moduleName === "habits") {
            currentWorkspace.habits = mergeCollectionLWW(
              currentWorkspace.habits || [],
              Array.isArray(payload) ? payload : [payload],
              action
            );
          } else if (moduleName === "expenses") {
            currentWorkspace.expenses = mergeCollectionLWW(
              currentWorkspace.expenses || [],
              Array.isArray(payload) ? payload : [payload],
              action
            );
          } else if (moduleName === "schedule") {
            currentWorkspace.schedule = mergeCollectionLWW(
              currentWorkspace.schedule || [],
              Array.isArray(payload) ? payload : [payload],
              action
            );
          } else if (moduleName === "notes") {
            currentWorkspace.notes = mergeCollectionLWW(
              currentWorkspace.notes || [],
              Array.isArray(payload) ? payload : [payload],
              action
            );
          } else if (moduleName === "profile") {
            currentWorkspace.profile = { ...(currentWorkspace.profile || {}), ...payload };
          } else if (moduleName === "workspace" || moduleName === "all") {
            if (payload && typeof payload === "object") {
              Object.assign(currentWorkspace, payload);
            }
          }

          if (!currentWorkspace._meta) currentWorkspace._meta = {};
          currentWorkspace._meta.syncVersion = nextVersion;
          currentWorkspace._meta.lastAuthoritativeDevice = sourceDeviceId;
          currentWorkspace._meta.serverSyncedAt = new Date().toISOString();

          // Update cache immediately
          userWorkspaceMemoryCache.set(roomKey, {
            workspace: currentWorkspace,
            version: nextVersion,
          });

          // Acknowledge back to sender with reconciled authoritative payload
          ws.send(
            JSON.stringify({
              type: "MUTATION_ACK",
              module: moduleName,
              payload: currentWorkspace[moduleName] || payload,
              syncVersion: nextVersion,
              vectorTimestamp,
              success: true,
            })
          );

          // Broadcast to all other tabs and devices in the user's room
          const nowIso = new Date().toISOString();
          broadcastWorkspaceUpdate(
            userIdent,
            {
              type: "WORKSPACE_UPDATED",
              userIdentifier: userIdent,
              module: moduleName,
              action,
              payload: currentWorkspace[moduleName] || payload,
              fullWorkspace: currentWorkspace,
              vectorTimestamp,
              syncVersion: nextVersion,
              sourceDeviceId,
              timestamp: nowIso,
            },
            ws
          );

          // Save to Neon PostgreSQL
          void pool
            .query(
              `INSERT INTO workspaces (user_identifier, user_email, workspace_data, updated_at, sync_version)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (user_identifier) DO UPDATE SET
                 user_email = EXCLUDED.user_email,
                 workspace_data = EXCLUDED.workspace_data,
                 updated_at = EXCLUDED.updated_at,
                 sync_version = EXCLUDED.sync_version`,
              [userIdent, userEmail || userIdent, JSON.stringify(currentWorkspace), nowIso, nextVersion]
            )
            .catch((dbErr: any) => {
              console.error("[SyncWS] Background DB save notice:", dbErr);
            });
        } catch (dbErr: any) {
          console.error("[SyncWS] Mutation handling error:", dbErr);
          ws.send(
            JSON.stringify({
              type: "ERROR",
              error: dbErr?.message || "Database update failed",
              module: moduleName,
            })
          );
        }
      });
      break;
    }

    default:
      console.warn("[SyncWS] Unknown message type:", type);
      break;
  }
}

/**
 * Deterministic Last-Write-Wins collection merge by item ID and timestamp
 */
function mergeCollectionLWW(existing: any[], incoming: any[], action: string): any[] {
  const map = new Map<string, any>();

  for (const item of existing) {
    if (item && item.id) {
      map.set(String(item.id), item);
    }
  }

  for (const item of incoming) {
    if (!item || !item.id) continue;
    const id = String(item.id);

    if (action === "DELETE" || item.isDeleted || item.deleted) {
      map.delete(id);
      continue;
    }

    const existingItem = map.get(id);
    if (!existingItem) {
      map.set(id, item);
    } else {
      const existingTime = Number(existingItem.updatedAt || existingItem.updated_at || existingItem.createdAt || 0);
      const incomingTime = Number(item.updatedAt || item.updated_at || item.createdAt || Date.now());

      if (incomingTime >= existingTime) {
        map.set(id, { ...existingItem, ...item });
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Returns diagnostic metrics about current active WebSocket rooms.
 */
export function getSyncWsStats() {
  const roomStats: Record<string, number> = {};
  for (const [room, set] of userRooms.entries()) {
    roomStats[room] = set.size;
  }

  return {
    totalSockets: syncWss?.clients?.size || 0,
    totalRooms: userRooms.size,
    broadcastCount,
    rooms: roomStats,
  };
}
