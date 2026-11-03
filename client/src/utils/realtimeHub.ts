/**
 * Real-time Full-Duplex WebSocket Synchronization Hub
 * Maintains bi-directional socket connection with Neon PostgreSQL sync server
 * and instantly propagates mutations across all active tabs, devices, and platforms.
 */
import { Storage } from './storage';
import {
  getCustomWorkspaceIdentifier,
  getCustomWorkspaceEmail,
  broadcastWorkspaceUpdate as broadcastIntraBrowser,
  DEVICE_SESSION_ID,
} from './neonSync';
import { getDeviceInfo } from './devices';

export interface RealtimeSyncStatus {
  connected: boolean;
  connecting: boolean;
  lastSyncAt: number | null;
  lastError: string | null;
  socketId: string | null;
  room: string | null;
  connectedClients: number;
  latencyMs: number;
}

type SyncStatusListener = (status: RealtimeSyncStatus) => void;
type WorkspaceUpdateListener = (event: any) => void;

class RealtimeHub {
  private ws: WebSocket | null = null;
  private reconnectTimer: any = null;
  private pingTimer: any = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 20;
  private isDestroyed = false;
  private pingStartTime = 0;

  private status: RealtimeSyncStatus = {
    connected: false,
    connecting: false,
    lastSyncAt: null,
    lastError: null,
    socketId: null,
    room: null,
    connectedClients: 0,
    latencyMs: 0,
  };

  private statusListeners = new Set<SyncStatusListener>();
  private updateListeners = new Set<WorkspaceUpdateListener>();

  constructor() {
    if (typeof window !== 'undefined') {
      // Initialize on client
      setTimeout(() => this.connect(), 100);

      // Listen to page visibility to reconnect immediately when tab is focused
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
          this.reconnectAttempts = 0;
          this.connect();
        }
      });

      // Reconnect when online event fires
      window.addEventListener('online', () => {
        this.reconnectAttempts = 0;
        this.connect();
      });
    }
  }

  public getStatus(): RealtimeSyncStatus {
    return { ...this.status };
  }

  public subscribeStatus(listener: SyncStatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.getStatus());
    return () => this.statusListeners.delete(listener);
  }

  public subscribeUpdates(listener: WorkspaceUpdateListener): () => void {
    this.updateListeners.add(listener);
    return () => this.updateListeners.delete(listener);
  }

  private notifyStatus(): void {
    const s = this.getStatus();
    this.statusListeners.forEach((l) => {
      try {
        l(s);
      } catch {}
    });
  }

  public connect(): void {
    if (typeof window === 'undefined') return;

    // Reset destroyed flag on explicit connect request
    this.isDestroyed = false;

    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    const isSignedOut = localStorage.getItem('notion_os_auth_signed_out') === 'true';
    const userIdent = getCustomWorkspaceIdentifier();
    const userEmail = getCustomWorkspaceEmail();

    if (isSignedOut || !userIdent) {
      return;
    }

    try {
      this.status.connecting = true;
      this.notifyStatus();

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const deviceInfo = getDeviceInfo();
      const deviceId = DEVICE_SESSION_ID || `dev_${Math.random().toString(36).slice(2, 8)}`;
      const deviceName = deviceInfo.deviceName || 'Web Browser';
      const platform = (window as any).Capacitor ? 'android_apk' : 'web_browser';

      const wsUrl = `${protocol}//${host}/api/sync/ws?userIdentifier=${encodeURIComponent(
        userIdent
      )}&userEmail=${encodeURIComponent(userEmail)}&deviceId=${encodeURIComponent(
        deviceId
      )}&deviceName=${encodeURIComponent(
        deviceName
      )}&platform=${encodeURIComponent(platform)}`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.status.connected = true;
        this.status.connecting = false;
        this.status.lastError = null;
        this.reconnectAttempts = 0;
        this.notifyStatus();
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleIncomingMessage(data);
        } catch (err) {
          console.warn('[RealtimeHub] Error parsing socket payload:', err);
        }
      };

      this.ws.onclose = () => {
        this.status.connected = false;
        this.status.connecting = false;
        this.stopHeartbeat();
        this.notifyStatus();
        this.scheduleReconnect();
      };

      this.ws.onerror = (err: any) => {
        this.status.lastError = 'WebSocket connection error';
        this.notifyStatus();
      };
    } catch (err: any) {
      this.status.connected = false;
      this.status.connecting = false;
      this.status.lastError = err?.message || 'Connection failed';
      this.notifyStatus();
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.isDestroyed || typeof window === 'undefined') return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 15000);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.pingStartTime = Date.now();
        this.ws.send(JSON.stringify({ type: 'PING' }));
      }
    }, 20000);
  }

  private stopHeartbeat(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /**
   * Send a real-time mutation directly through the WebSocket hub
   */
  public sendMutation(
    module: string,
    action: 'UPSERT' | 'DELETE' | 'BATCH',
    payload: any,
    vectorTimestamp = Date.now()
  ): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      const userIdent = getCustomWorkspaceIdentifier();
      const userEmail = getCustomWorkspaceEmail();
      const deviceId = DEVICE_SESSION_ID;

      this.ws.send(
        JSON.stringify({
          type: 'MUTATION',
          userIdentifier: userIdent,
          userEmail,
          deviceId,
          module,
          action,
          payload,
          vectorTimestamp,
        })
      );
      return true;
    } catch (err) {
      console.warn('[RealtimeHub] Failed to send mutation:', err);
      return false;
    }
  }

  private handleIncomingMessage(msg: any): void {
    if (!msg || typeof msg !== 'object') return;

    switch (msg.type) {
      case 'SESSION_TERMINATED': {
        const readableDevice = msg.newDeviceName || 'another device';
        const terminationMessage =
          msg.message || `Logged out because your account was signed in on ${readableDevice}`;
        console.warn(`[RealtimeHub] Singleton session terminated: ${terminationMessage}`);

        if (typeof window !== 'undefined') {
          localStorage.setItem('notion_os_auth_termination_notice', terminationMessage);
          localStorage.setItem('notion_os_auth_signed_out', 'true');
          window.dispatchEvent(
            new CustomEvent('session_terminated', {
              detail: {
                message: terminationMessage,
                newDevice: readableDevice,
                newDeviceId: msg.newDeviceId,
                timestamp: msg.serverTimestamp || new Date().toISOString(),
              },
            })
          );
        }

        // Clean up socket and prevent reconnecting until re-authenticated
        this.destroy();
        break;
      }

      case 'CONNECTED':
      case 'SUBSCRIBED': {
        this.status.socketId = msg.socketId || this.status.socketId;
        this.status.room = msg.room || this.status.room;
        this.status.connectedClients = msg.connectedClientsInRoom || 1;
        this.notifyStatus();
        break;
      }

      case 'PONG': {
        if (this.pingStartTime > 0) {
          this.status.latencyMs = Math.max(1, Date.now() - this.pingStartTime);
          this.notifyStatus();
        }
        break;
      }

      case 'WORKSPACE_UPDATED': {
        // Disregard if from the same tab session
        if (msg.sourceDeviceId && msg.sourceDeviceId === DEVICE_SESSION_ID) {
          return;
        }

        const incomingIdent = (msg.userIdentifier || '').toLowerCase().trim();
        const activeIdent = (getCustomWorkspaceIdentifier() || '').toLowerCase().trim();

        if (incomingIdent && activeIdent && incomingIdent !== activeIdent) {
          // Message belongs to a different workspace, reject
          return;
        }

        this.status.lastSyncAt = Date.now();
        this.notifyStatus();

        // Apply incoming data into Storage
        this.applyIncomingWorkspaceUpdate(msg);

        // Notify UI update listeners
        this.updateListeners.forEach((listener) => {
          try {
            listener(msg);
          } catch {}
        });

        // Fire global custom DOM event for React components
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('workspace_synced', {
              detail: {
                timestamp: msg.timestamp || new Date().toISOString(),
                module: msg.module || 'all',
                source: 'websocket',
              },
            })
          );
        }

        // Bridge with intra-browser broadcast
        try {
          broadcastIntraBrowser(msg.fullWorkspace || msg.payload || {});
        } catch {}
        break;
      }

      default:
        break;
    }
  }

  private applyIncomingWorkspaceUpdate(msg: any): void {
    try {
      const full = msg.fullWorkspace;
      const mod = msg.module;
      const payload = msg.payload;

      if (full && typeof full === 'object') {
        Storage.importAllDataPayload(full);
        return;
      }

      if (mod === 'todos' || mod === 'tasks') {
        if (Array.isArray(payload)) {
          Storage.setTodos(payload);
        }
      } else if (mod === 'habits') {
        if (Array.isArray(payload)) {
          Storage.setHabits(payload);
        }
      } else if (mod === 'expenses') {
        if (Array.isArray(payload)) {
          Storage.setExpenses(payload);
        }
      } else if (mod === 'schedule') {
        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
          Storage.setSchedule(payload);
        }
      } else if (mod === 'scratchpad' || mod === 'notes') {
        if (typeof payload === 'string') {
          Storage.setScratchpad(payload);
        }
      } else if (mod === 'profile') {
        if (payload && typeof payload === 'object') {
          Storage.setProfile(payload);
        }
      }
    } catch (err) {
      console.warn('[RealtimeHub] Error applying incoming workspace update:', err);
    }
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
  }
}

export const realtimeHub = new RealtimeHub();
