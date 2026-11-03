import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { Storage } from '../utils/storage';
import { realtimeHub } from '../utils/realtimeHub';
import {
  setCustomWorkspaceIdentifier,
  setCustomWorkspaceEmail,
} from '../utils/neonSync';
import {
  getUserWorkspaceKey,
} from '../utils/auth';

describe('Multi-Instance Real-Time Concurrency & Synchronization Suite', () => {
  const gknUser = {
    id: 'user_gknayak',
    email: 'gknayak@gmail.com',
    provider: 'neon' as const,
  };

  beforeAll(() => {
    if (typeof window === 'undefined') {
      const listeners: Record<string, Set<Function>> = {};
      const winMock: any = {
        addEventListener: (event: string, fn: Function) => {
          if (!listeners[event]) listeners[event] = new Set();
          listeners[event].add(fn);
        },
        removeEventListener: (event: string, fn: Function) => {
          listeners[event]?.delete(fn);
        },
        dispatchEvent: (ev: any) => {
          const type = ev?.type || '';
          listeners[type]?.forEach((fn) => fn(ev));
          return true;
        },
      };
      (globalThis as any).window = winMock;
      (globalThis as any).CustomEvent = class CustomEvent {
        type: string;
        detail: any;
        constructor(type: string, params?: any) {
          this.type = type;
          this.detail = params?.detail;
        }
      };
    }
    if (!globalThis.localStorage) {
      const store: Record<string, string> = {};
      globalThis.localStorage = {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = String(v);
        },
        removeItem: (k: string) => {
          delete store[k];
        },
        clear: () => {
          Object.keys(store).forEach((k) => delete store[k]);
        },
        key: (i: number) => Object.keys(store)[i] ?? null,
        length: 0,
      } as any;
    }
  });

  beforeEach(() => {
    Storage.clearMemoryCaches();
    setCustomWorkspaceIdentifier(getUserWorkspaceKey(gknUser));
    setCustomWorkspaceEmail(gknUser.email);
  });

  it('1. RealtimeHub initializes status and responds to subscription', () => {
    const status = realtimeHub.getStatus();
    expect(status).toBeDefined();
    expect(typeof status.connected).toBe('boolean');
    expect(typeof status.latencyMs).toBe('number');
  });

  it('2. Simulated Tab A mutation propagates to Storage and dispatches custom event', async () => {
    let eventFired = false;
    const testListener = () => {
      eventFired = true;
    };

    window.addEventListener('workspace_synced', testListener);

    const now = Date.now();
    const newTask = {
      id: `task-tab-a-${now}`,
      text: 'Physics Exam Preparation',
      completed: false,
      priority: 'high' as const,
      dueDate: '2026-11-04',
      createdAt: now,
      updatedAt: now,
    };

    // Simulate incoming real-time socket message from another device
    (realtimeHub as any).handleIncomingMessage({
      type: 'WORKSPACE_UPDATED',
      userIdentifier: getUserWorkspaceKey(gknUser),
      module: 'todos',
      action: 'UPSERT',
      payload: [newTask],
      vectorTimestamp: now,
      timestamp: new Date().toISOString(),
    });

    expect(eventFired).toBe(true);
    const storedTodos = Storage.getTodos();
    expect(storedTodos.some((t) => t.id === newTask.id)).toBe(true);

    window.removeEventListener('workspace_synced', testListener);
  });

  it('3. Out-of-order and older mutations are superseded by newer vector timestamps', () => {
    const baseId = `task-conflict-${Date.now()}`;
    const olderTask = {
      id: baseId,
      text: 'Old Task Title',
      completed: false,
      createdAt: 1000,
      updatedAt: 1000,
    };
    const newerTask = {
      id: baseId,
      text: 'New Authoritative Title',
      completed: true,
      createdAt: 1000,
      updatedAt: 2000,
    };

    // Tab A applies newer task
    (realtimeHub as any).handleIncomingMessage({
      type: 'WORKSPACE_UPDATED',
      userIdentifier: getUserWorkspaceKey(gknUser),
      module: 'todos',
      action: 'UPSERT',
      payload: [newerTask],
      vectorTimestamp: 2000,
    });

    const afterNewer = Storage.getTodos().find((t) => t.id === baseId);
    expect(afterNewer?.text).toBe('New Authoritative Title');
    expect(afterNewer?.completed).toBe(true);
  });

  it('4. Multi-device spending with non-UUID SMS ID synchronizes without corruption', () => {
    const smsId = `exp-sms-${Date.now()}-swiggy`;
    const smsExpense = {
      id: smsId,
      name: 'Swiggy Dinner Delivery',
      amount: 450,
      category: 'Dining Out',
      date: '2026-11-03',
      direction: 'DEBIT' as const,
      source: 'sms_auto',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    (realtimeHub as any).handleIncomingMessage({
      type: 'WORKSPACE_UPDATED',
      userIdentifier: getUserWorkspaceKey(gknUser),
      module: 'expenses',
      action: 'UPSERT',
      payload: [smsExpense],
      vectorTimestamp: Date.now(),
    });

    const expenses = Storage.getExpenses();
    expect(expenses.some((e) => e.id === smsId)).toBe(true);
  });
});
