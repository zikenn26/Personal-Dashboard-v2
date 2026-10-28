import { useState, useEffect } from 'react';
import { getSupabaseClient, isSupabaseConfigured, Auth } from '../utils/supabase';

export type ConnectionState =
  | 'initializing'
  | 'online_read_ready'
  | 'online_write_ready'
  | 'offline_read_only'
  | 'backend_unavailable'
  | 'authentication_required'
  | 'reconciling'
  | 'conflict';

type ConnectionStateListener = (state: ConnectionState) => void;

class ConnectionPolicyManagerClass {
  private state: ConnectionState = 'initializing';
  private listeners: Set<ConnectionStateListener> = new Set();
  private pingInterval: any = null;
  private isChecking = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.checkConnection);
      window.addEventListener('offline', this.checkConnection);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.checkConnection();
        }
      });
      this.checkConnection();

      // Ping backend periodically to ensure it's actually reachable
      this.pingInterval = setInterval(this.checkConnection, 30000);
    }
  }

  public getState(): ConnectionState {
    return this.state;
  }

  public isOnlineWriteReady(): boolean {
    return this.state === 'online_write_ready';
  }

  public subscribe(listener: ConnectionStateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setState(newState: ConnectionState) {
    if (this.state !== newState) {
      this.state = newState;
      this.listeners.forEach((listener) => {
        try {
          listener(this.state);
        } catch (e) {
          console.error('Error in ConnectionStateListener:', e);
        }
      });

      // Dispatch custom event for vanilla JS listeners if needed
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('connection-policy-changed', {
            detail: { state: this.state },
          })
        );
      }
    }
  }

  public checkConnection = async () => {
    if (this.isChecking) return;
    this.isChecking = true;

    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        this.setState('offline_read_only');
        return;
      }

      if (!isSupabaseConfigured()) {
        this.setState('backend_unavailable');
        return;
      }

      const isValidSession = await Auth.verifyCurrentSession();
      if (!isValidSession) {
        this.setState('authentication_required');
        return;
      }

      const client = getSupabaseClient();
      if (!client) {
        this.setState('backend_unavailable');
        return;
      }

      // Ping Supabase to verify actual connectivity (not just network interface up)
      try {
        const { error } = await client.from('user_workspaces').select('id').limit(1);
        if (error) {
          // If error is related to network or quota
          this.setState('backend_unavailable');
        } else {
          this.setState('online_write_ready');
        }
      } catch (err) {
        this.setState('backend_unavailable');
      }
    } finally {
      this.isChecking = false;
    }
  };

  public setReconciling() {
    this.setState('reconciling');
  }

  public setConflict() {
    this.setState('conflict');
  }
}

export const ConnectionPolicyManager = new ConnectionPolicyManagerClass();

export function useConnectionPolicy(): ConnectionState {
  const [state, setState] = useState<ConnectionState>(ConnectionPolicyManager.getState());

  useEffect(() => {
    return ConnectionPolicyManager.subscribe(setState);
  }, []);

  return state;
}
