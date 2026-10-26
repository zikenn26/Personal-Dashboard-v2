import { ExpenseItem, OutboxMutation, ExpenseSyncStatus, ExpenseSyncStatusState } from '../types';
import { normalizeExpenseDateKey, getLocalDateKey } from '../utils/expenseUtils';

export interface ExpenseRepository {
  init(): Promise<void>;
  setWorkspace(workspaceKey: string): Promise<void>;
  getAll(): Promise<ExpenseItem[]>;
  getById(id: string): Promise<ExpenseItem | null>;
  save(expense: ExpenseItem): Promise<ExpenseItem>;
  saveBatch(expenses: ExpenseItem[]): Promise<ExpenseItem[]>;
  delete(id: string): Promise<void>;
  deleteBatch(ids: string[]): Promise<void>;
  clear(): Promise<void>;

  // Outbox mutations
  enqueueMutation(mutation: Omit<OutboxMutation, 'id' | 'timestamp' | 'retryCount'>): Promise<OutboxMutation>;
  getPendingOutbox(): Promise<OutboxMutation[]>;
  dequeueMutation(mutationId: string): Promise<void>;
  dequeueMutations(mutationIds: string[]): Promise<void>;
  clearOutbox(): Promise<void>;

  // Tombstones
  recordTombstone(id: string): Promise<void>;
  recordTombstones(ids: string[]): Promise<void>;
  getTombstones(): Promise<Set<string>>;
  isTombstoned(id: string): Promise<boolean>;

  // Sync Status
  getSyncStatus(): Promise<ExpenseSyncStatus>;
  setSyncStatus(status: Partial<ExpenseSyncStatus>): Promise<void>;
}

const DEFAULT_DB_NAME = 'lifeos_local_first_db';
const DB_VERSION = 1;
const STORE_EXPENSES = 'expenses';
const STORE_OUTBOX = 'expense_outbox';
const STORE_TOMBSTONES = 'expense_tombstones';
const STORE_META = 'expense_meta';

class IndexedDBExpenseRepository implements ExpenseRepository {
  private db: IDBDatabase | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private workspaceKey: string = 'default';

  // In-memory fallback / mirror for synchronous read-after-write & non-IDB environments (Node/SSR/Vitest)
  private memoryWorkspaces: Map<
    string,
    {
      expenses: Map<string, ExpenseItem>;
      outbox: Map<string, OutboxMutation>;
      tombstones: Set<string>;
      syncStatus: ExpenseSyncStatus;
    }
  > = new Map();

  private memoryExpenses: Map<string, ExpenseItem> = new Map();
  private memoryOutbox: Map<string, OutboxMutation> = new Map();
  private memoryTombstones: Set<string> = new Set();
  private memorySyncStatus: ExpenseSyncStatus = {
    state: 'synced',
    pendingCount: 0,
    lastSyncedAt: Date.now(),
    lastError: null,
  };

  private getEffectiveDbName(): string {
    if (!this.workspaceKey || this.workspaceKey === 'default') {
      return DEFAULT_DB_NAME;
    }
    const sanitized = this.workspaceKey.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `lifeos_expenses_${sanitized}`;
  }

  private saveCurrentToPartition(): void {
    this.memoryWorkspaces.set(this.workspaceKey, {
      expenses: new Map(this.memoryExpenses),
      outbox: new Map(this.memoryOutbox),
      tombstones: new Set(this.memoryTombstones),
      syncStatus: { ...this.memorySyncStatus },
    });
  }

  private loadFromPartition(key: string): void {
    const partition = this.memoryWorkspaces.get(key);
    if (partition) {
      this.memoryExpenses = new Map(partition.expenses);
      this.memoryOutbox = new Map(partition.outbox);
      this.memoryTombstones = new Set(partition.tombstones);
      this.memorySyncStatus = { ...partition.syncStatus };
    } else {
      this.memoryExpenses = new Map();
      this.memoryOutbox = new Map();
      this.memoryTombstones = new Set();
      this.memorySyncStatus = {
        state: 'synced',
        pendingCount: 0,
        lastSyncedAt: Date.now(),
        lastError: null,
      };
    }
  }

  public async setWorkspace(workspaceKey: string): Promise<void> {
    const cleanKey = (workspaceKey || 'default').trim();
    if (this.workspaceKey === cleanKey && this.isInitialized) return;

    this.saveCurrentToPartition();

    if (this.db) {
      try {
        this.db.close();
      } catch {}
      this.db = null;
    }

    this.workspaceKey = cleanKey;
    this.isInitialized = false;
    this.initPromise = null;
    this.loadFromPartition(cleanKey);
    await this.init();
  }

  public async init(): Promise<void> {
    if (this.isInitialized && this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      // Check if IndexedDB is available in the current environment
      if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') {
        this.isInitialized = true;
        return;
      }

      try {
        const targetDbName = this.getEffectiveDbName();
        this.db = await new Promise<IDBDatabase>((resolve, reject) => {
          const req = window.indexedDB.open(targetDbName, DB_VERSION);

          req.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;

            if (!db.objectStoreNames.contains(STORE_EXPENSES)) {
              const expStore = db.createObjectStore(STORE_EXPENSES, { keyPath: 'id' });
              expStore.createIndex('date', 'date', { unique: false });
              expStore.createIndex('category', 'category', { unique: false });
              expStore.createIndex('updatedAt', 'updatedAt', { unique: false });
            }

            if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
              const outboxStore = db.createObjectStore(STORE_OUTBOX, { keyPath: 'id' });
              outboxStore.createIndex('timestamp', 'timestamp', { unique: false });
            }

            if (!db.objectStoreNames.contains(STORE_TOMBSTONES)) {
              db.createObjectStore(STORE_TOMBSTONES, { keyPath: 'id' });
            }

            if (!db.objectStoreNames.contains(STORE_META)) {
              db.createObjectStore(STORE_META, { keyPath: 'key' });
            }
          };

          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
        });

        // Preload memory cache from IndexedDB
        await this.hydrateMemoryFromIDB();
        this.isInitialized = true;
      } catch (err) {
        console.warn('[EXPENSE_REPO] IndexedDB unavailable or failed to initialize, using durable fallback:', err);
        this.isInitialized = true;
      }
    })();

    return this.initPromise;
  }

  private async hydrateMemoryFromIDB(): Promise<void> {
    if (!this.db) return;
    try {
      const expenses = await this.getAllFromStore<ExpenseItem>(STORE_EXPENSES);
      this.memoryExpenses.clear();
      expenses.forEach((e) => {
        if (e && e.id) this.memoryExpenses.set(String(e.id).trim(), e);
      });

      const outbox = await this.getAllFromStore<OutboxMutation>(STORE_OUTBOX);
      this.memoryOutbox.clear();
      outbox.forEach((m) => {
        if (m && m.id) this.memoryOutbox.set(m.id, m);
      });

      const tombstones = await this.getAllFromStore<{ id: string; deletedAt: number }>(STORE_TOMBSTONES);
      this.memoryTombstones.clear();
      tombstones.forEach((t) => {
        if (t && t.id) this.memoryTombstones.add(String(t.id).trim());
      });

      this.memorySyncStatus.pendingCount = this.memoryOutbox.size;
      if (this.memoryOutbox.size > 0 && this.memorySyncStatus.state === 'synced') {
        this.memorySyncStatus.state = 'pending';
      }
    } catch (e) {
      console.warn('[EXPENSE_REPO] Hydration from IDB notice:', e);
    }
  }

  private getAllFromStore<T>(storeName: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve([]);
      try {
        const tx = this.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  public async getAll(): Promise<ExpenseItem[]> {
    await this.init();
    if (this.db) {
      try {
        const items = await this.getAllFromStore<ExpenseItem>(STORE_EXPENSES);
        // Sync memory mirror
        this.memoryExpenses.clear();
        items.forEach((e) => {
          if (e && e.id) this.memoryExpenses.set(String(e.id).trim(), e);
        });
        return Array.from(this.memoryExpenses.values());
      } catch (err) {
        console.warn('[EXPENSE_REPO] getAll fallback to memory mirror:', err);
      }
    }
    return Array.from(this.memoryExpenses.values());
  }

  public async getById(id: string): Promise<ExpenseItem | null> {
    await this.init();
    const cleanId = String(id).trim();
    if (this.memoryExpenses.has(cleanId)) {
      return this.memoryExpenses.get(cleanId)!;
    }

    if (this.db) {
      try {
        return await new Promise<ExpenseItem | null>((resolve, reject) => {
          const tx = this.db!.transaction(STORE_EXPENSES, 'readonly');
          const store = tx.objectStore(STORE_EXPENSES);
          const req = store.get(cleanId);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => reject(req.error);
        });
      } catch {
        return null;
      }
    }
    return null;
  }

  public async save(expense: ExpenseItem): Promise<ExpenseItem> {
    await this.init();
    const nowMs = Date.now();
    const cleanId = String(expense.id || `exp-${nowMs}-${Math.random().toString(36).slice(2, 7)}`).trim();

    const isCredit =
      expense.direction === 'CREDIT' ||
      expense.transactionType === 'CREDIT' ||
      expense.transactionType === 'income' ||
      (expense as any).type === 'income' ||
      (expense as any).type === 'CREDIT' ||
      (expense as any).type === 'credit';
    const direction: 'DEBIT' | 'CREDIT' = isCredit ? 'CREDIT' : 'DEBIT';
    const rawAmount = Number(expense.amount);
    const safeAmount = Number.isFinite(rawAmount) ? Math.round(Math.abs(rawAmount) * 100) / 100 : 0;

    const sanitized: ExpenseItem = {
      ...expense,
      id: cleanId,
      amount: safeAmount,
      name: (expense.name || 'Expense').trim() || 'Expense',
      category: (expense.category || 'Other').trim() || 'Other',
      date: normalizeExpenseDateKey(expense.date) || getLocalDateKey(),
      direction,
      transactionType: direction,
      active: expense.active !== false,
      createdAt: expense.createdAt || nowMs,
      updatedAt: expense.updatedAt || nowMs,
    };

    // Remove from tombstones if it was previously tombstoned
    this.memoryTombstones.delete(cleanId);
    this.memoryExpenses.set(cleanId, sanitized);

    if (this.db) {
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = this.db!.transaction([STORE_EXPENSES, STORE_TOMBSTONES], 'readwrite');
          const expStore = tx.objectStore(STORE_EXPENSES);
          const tombStore = tx.objectStore(STORE_TOMBSTONES);
          tombStore.delete(cleanId);
          expStore.put(sanitized);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch (err) {
        console.warn('[EXPENSE_REPO] save IDB transaction notice:', err);
      }
    }

    return sanitized;
  }

  public async saveBatch(expenses: ExpenseItem[]): Promise<ExpenseItem[]> {
    await this.init();
    if (!Array.isArray(expenses) || expenses.length === 0) return [];

    const nowMs = Date.now();
    const sanitizedList: ExpenseItem[] = [];

    for (const exp of expenses) {
      if (!exp || typeof exp !== 'object') continue;
      const cleanId = String(exp.id || `exp-${nowMs}-${Math.random().toString(36).slice(2, 7)}`).trim();
      const isCredit =
        exp.direction === 'CREDIT' ||
        exp.transactionType === 'CREDIT' ||
        exp.transactionType === 'income' ||
        (exp as any).type === 'income' ||
        (exp as any).type === 'CREDIT' ||
        (exp as any).type === 'credit';
      const direction: 'DEBIT' | 'CREDIT' = isCredit ? 'CREDIT' : 'DEBIT';
      const rawAmount = Number(exp.amount);
      const safeAmount = Number.isFinite(rawAmount) ? Math.round(Math.abs(rawAmount) * 100) / 100 : 0;

      const sanitized: ExpenseItem = {
        ...exp,
        id: cleanId,
        amount: safeAmount,
        name: (exp.name || 'Expense').trim() || 'Expense',
        category: (exp.category || 'Other').trim() || 'Other',
        date: normalizeExpenseDateKey(exp.date) || getLocalDateKey(),
        direction,
        transactionType: direction,
        active: exp.active !== false,
        createdAt: exp.createdAt || nowMs,
        updatedAt: exp.updatedAt || nowMs,
      };

      if (this.memoryTombstones.has(cleanId)) {
        console.warn('[TOMBSTONE_DIAGNOSTIC] saveBatch skipped tombstoned expense to prevent resurrection:', cleanId);
        continue;
      }

      this.memoryExpenses.set(cleanId, sanitized);
      sanitizedList.push(sanitized);
    }

    if (this.db) {
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = this.db!.transaction(STORE_EXPENSES, 'readwrite');
          const expStore = tx.objectStore(STORE_EXPENSES);
          sanitizedList.forEach((item) => {
            expStore.put(item);
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch (err) {
        console.warn('[EXPENSE_REPO] saveBatch IDB transaction notice:', err);
      }
    }

    return sanitizedList;
  }

  public async delete(id: string): Promise<void> {
    await this.init();
    const cleanId = String(id).trim();
    this.memoryExpenses.delete(cleanId);
    this.memoryTombstones.add(cleanId);
    console.info('[TOMBSTONE_DIAGNOSTIC] Recorded deletion tombstone for:', cleanId);

    if (this.db) {
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = this.db!.transaction([STORE_EXPENSES, STORE_TOMBSTONES], 'readwrite');
          const expStore = tx.objectStore(STORE_EXPENSES);
          const tombStore = tx.objectStore(STORE_TOMBSTONES);
          expStore.delete(cleanId);
          tombStore.put({ id: cleanId, deletedAt: Date.now() });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch (err) {
        console.warn('[EXPENSE_REPO] delete IDB notice:', err);
      }
    }
  }

  public async deleteBatch(ids: string[]): Promise<void> {
    await this.init();
    const cleanIds = ids.map((id) => String(id).trim()).filter(Boolean);
    const now = Date.now();

    cleanIds.forEach((id) => {
      this.memoryExpenses.delete(id);
      this.memoryTombstones.add(id);
    });
    console.info('[TOMBSTONE_DIAGNOSTIC] Recorded deletion tombstones for:', cleanIds);

    if (this.db) {
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = this.db!.transaction([STORE_EXPENSES, STORE_TOMBSTONES], 'readwrite');
          const expStore = tx.objectStore(STORE_EXPENSES);
          const tombStore = tx.objectStore(STORE_TOMBSTONES);
          cleanIds.forEach((id) => {
            expStore.delete(id);
            tombStore.put({ id, deletedAt: now });
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch (err) {
        console.warn('[EXPENSE_REPO] deleteBatch IDB notice:', err);
      }
    }
  }

  public async clear(): Promise<void> {
    await this.init();
    this.memoryExpenses.clear();
    if (this.db) {
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = this.db!.transaction(STORE_EXPENSES, 'readwrite');
          tx.objectStore(STORE_EXPENSES).clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch (err) {
        console.warn('[EXPENSE_REPO] clear IDB notice:', err);
      }
    }
  }

  // Outbox Management
  public async enqueueMutation(mutation: Omit<OutboxMutation, 'id' | 'timestamp' | 'retryCount'>): Promise<OutboxMutation> {
    await this.init();
    const fullMutation: OutboxMutation = {
      ...mutation,
      id: `mut-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.memoryOutbox.set(fullMutation.id, fullMutation);
    this.memorySyncStatus.pendingCount = this.memoryOutbox.size;
    this.memorySyncStatus.state = 'pending';

    if (this.db) {
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = this.db!.transaction(STORE_OUTBOX, 'readwrite');
          tx.objectStore(STORE_OUTBOX).put(fullMutation);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch (err) {
        console.warn('[EXPENSE_REPO] enqueueMutation IDB notice:', err);
      }
    }

    return fullMutation;
  }

  public async getPendingOutbox(): Promise<OutboxMutation[]> {
    await this.init();
    if (this.db) {
      try {
        const outbox = await this.getAllFromStore<OutboxMutation>(STORE_OUTBOX);
        this.memoryOutbox.clear();
        outbox.forEach((m) => {
          if (m && m.id) this.memoryOutbox.set(m.id, m);
        });
        return outbox.sort((a, b) => a.timestamp - b.timestamp);
      } catch (err) {
        console.warn('[EXPENSE_REPO] getPendingOutbox IDB fallback:', err);
      }
    }
    return Array.from(this.memoryOutbox.values()).sort((a, b) => a.timestamp - b.timestamp);
  }

  public async dequeueMutation(mutationId: string): Promise<void> {
    await this.init();
    this.memoryOutbox.delete(mutationId);
    this.memorySyncStatus.pendingCount = this.memoryOutbox.size;
    if (this.memoryOutbox.size === 0 && this.memorySyncStatus.state === 'pending') {
      this.memorySyncStatus.state = 'synced';
    }

    if (this.db) {
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = this.db!.transaction(STORE_OUTBOX, 'readwrite');
          tx.objectStore(STORE_OUTBOX).delete(mutationId);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch (err) {
        console.warn('[EXPENSE_REPO] dequeueMutation IDB notice:', err);
      }
    }
  }

  public async dequeueMutations(mutationIds: string[]): Promise<void> {
    if (!Array.isArray(mutationIds) || mutationIds.length === 0) return;
    await this.init();
    mutationIds.forEach((id) => this.memoryOutbox.delete(id));
    this.memorySyncStatus.pendingCount = this.memoryOutbox.size;
    if (this.memoryOutbox.size === 0 && this.memorySyncStatus.state === 'pending') {
      this.memorySyncStatus.state = 'synced';
    }

    if (this.db) {
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = this.db!.transaction(STORE_OUTBOX, 'readwrite');
          const store = tx.objectStore(STORE_OUTBOX);
          mutationIds.forEach((id) => store.delete(id));
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch (err) {
        console.warn('[EXPENSE_REPO] dequeueMutations IDB notice:', err);
      }
    }
  }

  public async clearOutbox(): Promise<void> {
    await this.init();
    this.memoryOutbox.clear();
    this.memorySyncStatus.pendingCount = 0;
    this.memorySyncStatus.state = 'synced';

    if (this.db) {
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = this.db!.transaction(STORE_OUTBOX, 'readwrite');
          tx.objectStore(STORE_OUTBOX).clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch (err) {
        console.warn('[EXPENSE_REPO] clearOutbox IDB notice:', err);
      }
    }
  }

  // Tombstone Management
  public async recordTombstone(id: string): Promise<void> {
    await this.init();
    const cleanId = String(id).trim();
    if (!cleanId) return;
    this.memoryTombstones.add(cleanId);

    if (this.db) {
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = this.db!.transaction(STORE_TOMBSTONES, 'readwrite');
          tx.objectStore(STORE_TOMBSTONES).put({ id: cleanId, deletedAt: Date.now() });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch {}
    }
  }

  public async recordTombstones(ids: string[]): Promise<void> {
    if (!Array.isArray(ids) || ids.length === 0) return;
    await this.init();
    const cleanIds = ids.map((id) => String(id).trim()).filter(Boolean);
    if (cleanIds.length === 0) return;

    cleanIds.forEach((id) => {
      this.memoryTombstones.add(id);
      this.memoryExpenses.delete(id);
    });

    if (this.db) {
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = this.db!.transaction([STORE_EXPENSES, STORE_TOMBSTONES], 'readwrite');
          const expStore = tx.objectStore(STORE_EXPENSES);
          const tombStore = tx.objectStore(STORE_TOMBSTONES);
          const now = Date.now();
          cleanIds.forEach((id) => {
            expStore.delete(id);
            tombStore.put({ id, deletedAt: now });
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch (err) {
        console.warn('[EXPENSE_REPO] recordTombstones IDB notice:', err);
      }
    }
  }

  public async getTombstones(): Promise<Set<string>> {
    await this.init();
    if (this.db) {
      try {
        const list = await this.getAllFromStore<{ id: string }>(STORE_TOMBSTONES);
        this.memoryTombstones.clear();
        list.forEach((t) => {
          if (t && t.id) this.memoryTombstones.add(String(t.id).trim());
        });
      } catch {}
    }
    return new Set(this.memoryTombstones);
  }

  public async isTombstoned(id: string): Promise<boolean> {
    await this.init();
    const cleanId = String(id).trim();
    return this.memoryTombstones.has(cleanId);
  }

  // Sync Status
  public async getSyncStatus(): Promise<ExpenseSyncStatus> {
    await this.init();
    return { ...this.memorySyncStatus };
  }

  public async setSyncStatus(status: Partial<ExpenseSyncStatus>): Promise<void> {
    this.memorySyncStatus = {
      ...this.memorySyncStatus,
      ...status,
    };
  }
}

export const expenseRepo: ExpenseRepository = new IndexedDBExpenseRepository();
