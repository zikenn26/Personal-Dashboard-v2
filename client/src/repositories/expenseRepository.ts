import { ExpenseItem, OutboxMutation, ExpenseSyncStatus, ExpenseSyncStatusState } from '../types';
import { normalizeExpenseDateKey, getLocalDateKey } from '../utils/expenseUtils';
import { getSupabaseClient, getCustomWorkspaceIdentifier, fetchExpensesFromDedicatedTable } from '../utils/supabase';

export class DurableStorageError extends Error {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = 'DurableStorageError';
  }
}

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

  // Sync Status & Durability
  getSyncStatus(): Promise<ExpenseSyncStatus>;
  setSyncStatus(status: Partial<ExpenseSyncStatus>): Promise<void>;
  getDurabilityState(): 'durable' | 'degraded' | 'error';

  syncFromServer(): Promise<void>;
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
  private workspaceKey = 'default';

  private memoryExpenses: Map<string, ExpenseItem> = new Map();
  private memoryOutbox: Map<string, OutboxMutation> = new Map();
  private memoryTombstones: Set<string> = new Set();

  private memorySyncStatus: ExpenseSyncStatus = {
    state: 'synced',
    pendingCount: 0,
    lastSyncedAt: Date.now(),
    lastError: null,
  };

  private memoryWorkspaces: Map<string, any> = new Map();
  private lastDurabilityState: 'durable' | 'degraded' | 'error' = 'durable';

  constructor() {
    this.restoreDegradedBackup();
  }

  private persistDegradedBackup() {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(`lifeos_expenses_degraded_${this.workspaceKey}`, JSON.stringify(Array.from(this.memoryExpenses.values())));
        localStorage.setItem(`lifeos_outbox_degraded_${this.workspaceKey}`, JSON.stringify(Array.from(this.memoryOutbox.values())));
        localStorage.setItem(`lifeos_tombstones_degraded_${this.workspaceKey}`, JSON.stringify(Array.from(this.memoryTombstones)));
      } catch (e) {
        console.warn('Degraded backup failed to write to localStorage', e);
      }
    }
  }

  private restoreDegradedBackup() {
    if (typeof localStorage !== 'undefined') {
      try {
        const exp = localStorage.getItem(`lifeos_expenses_degraded_${this.workspaceKey}`);
        if (exp) {
          const parsed = JSON.parse(exp);
          if (Array.isArray(parsed)) {
            parsed.forEach((e: ExpenseItem) => this.memoryExpenses.set(e.id, e));
          }
        }

        const out = localStorage.getItem(`lifeos_outbox_degraded_${this.workspaceKey}`);
        if (out) {
          const parsedOut = JSON.parse(out);
          if (Array.isArray(parsedOut)) {
            parsedOut.forEach((m: OutboxMutation) => this.memoryOutbox.set(m.id, m));
          }
        }

        const tombs = localStorage.getItem(`lifeos_tombstones_degraded_${this.workspaceKey}`);
        if (tombs) {
          const parsedTombs = JSON.parse(tombs);
          if (Array.isArray(parsedTombs)) {
            parsedTombs.forEach((id: string) => this.memoryTombstones.add(id));
          }
        }
      } catch (e) {
        // ignore
      }
    }
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
      const idb = typeof window !== 'undefined' && window.indexedDB ? window.indexedDB : (typeof globalThis !== 'undefined' ? (globalThis as any).indexedDB : null);
      if (!idb) {
        this.lastDurabilityState = 'durable';
        this.isInitialized = true;
        return;
      }

      return new Promise<void>((resolve, reject) => {
        const req = idb.open(`${DEFAULT_DB_NAME}_${this.workspaceKey}`, DB_VERSION);

        req.onupgradeneeded = (e: any) => {
          const db = e.target.result as IDBDatabase;
          if (!db.objectStoreNames.contains(STORE_EXPENSES)) db.createObjectStore(STORE_EXPENSES, { keyPath: 'id' });
          if (!db.objectStoreNames.contains(STORE_OUTBOX)) db.createObjectStore(STORE_OUTBOX, { keyPath: 'id' });
          if (!db.objectStoreNames.contains(STORE_TOMBSTONES)) db.createObjectStore(STORE_TOMBSTONES, { keyPath: 'id' });
          if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META, { keyPath: 'key' });
        };

        req.onsuccess = (e: any) => {
          this.db = e.target.result as IDBDatabase;
          this.db.onerror = () => {};

          try {
            const tx = this.db.transaction([STORE_EXPENSES, STORE_OUTBOX, STORE_TOMBSTONES, STORE_META], 'readonly');

            const reqExp = tx.objectStore(STORE_EXPENSES).getAll();
            reqExp.onsuccess = () => {
              const res = reqExp.result as ExpenseItem[];
              res.forEach((r) => this.memoryExpenses.set(r.id, r));
            };

            const reqOut = tx.objectStore(STORE_OUTBOX).getAll();
            reqOut.onsuccess = () => {
              const res = reqOut.result as OutboxMutation[];
              res.forEach((r) => this.memoryOutbox.set(r.id, r));
            };

            const reqTomb = tx.objectStore(STORE_TOMBSTONES).getAll();
            reqTomb.onsuccess = () => {
              const res = reqTomb.result as any[];
              res.forEach((r) => this.memoryTombstones.add(r.id));
            };

            tx.oncomplete = () => {
              this.lastDurabilityState = 'durable';
              this.isInitialized = true;
              resolve();
            };
          } catch {
            this.lastDurabilityState = 'durable';
            this.isInitialized = true;
            resolve();
          }
        };

        req.onerror = () => {
          this.lastDurabilityState = 'error';
          this.isInitialized = true;
          resolve();
        };
      });
    })();
    return this.initPromise;
  }

  public getDurabilityState() {
    return this.lastDurabilityState;
  }

  public async getAll(): Promise<ExpenseItem[]> {
    await this.init();
    return Array.from(this.memoryExpenses.values());
  }

  public async getById(id: string): Promise<ExpenseItem | null> {
    await this.init();
    if (this.memoryTombstones.has(id)) {
      return null;
    }
    if (this.memoryExpenses.has(id)) {
      return this.memoryExpenses.get(id) || null;
    }
    if (this.db) {
      try {
        return await new Promise<ExpenseItem | null>((resolve) => {
          const tx = this.db!.transaction(STORE_EXPENSES, 'readonly');
          const req = tx.objectStore(STORE_EXPENSES).get(id);
          req.onsuccess = () => {
            if (this.memoryTombstones.has(id)) {
              resolve(null);
            } else {
              resolve(req.result || null);
            }
          };
          req.onerror = () => resolve(null);
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

    // Update local cache first (Local-First Durability)
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
        this.lastDurabilityState = 'durable';
      } catch (err) {
        console.warn('[EXPENSE_REPO] save IDB transaction notice:', err);
        try {
          this.persistDegradedBackup();
          this.lastDurabilityState = 'degraded';
        } catch {
          this.lastDurabilityState = 'error';
        }
      }
    } else {
      this.persistDegradedBackup();
    }

    // Call Supabase RPC in background/non-blocking manner if online
    const client = getSupabaseClient();
    if (client) {
      void (async () => {
        try {
          const wsId = getCustomWorkspaceIdentifier();
          await client.rpc('upsert_expense', {
            p_id: sanitized.id,
            p_workspace_identifier: wsId,
            p_name: sanitized.name,
            p_amount: sanitized.amount,
            p_category: sanitized.category,
            p_date: sanitized.date,
            p_time: sanitized.time,
            p_direction: sanitized.direction,
            p_payment_method: sanitized.paymentMethod || null,
            p_billing_cycle: sanitized.billingCycle || null,
            p_notes: sanitized.notes || null,
            p_bank_name: sanitized.bankName || null,
            p_masked_account: sanitized.maskedAccount || null,
            p_account_last4: sanitized.accountLast4 || null,
            p_reference_id: sanitized.referenceId || null,
            p_sms_reference_id: sanitized.smsReferenceId || null,
            p_upi_reference: sanitized.upiReference || null,
            p_raw_sms_text: sanitized.rawSmsText || null,
            p_merchant: sanitized.merchant || null,
            p_payee: sanitized.payee || null,
            p_source: sanitized.source || null,
            p_source_file: sanitized.sourceFile || null,
            p_import_batch_id: sanitized.importBatchId || null,
            p_active: sanitized.active,
            p_client_updated_at: Date.now(),
            p_expected_version: null,
          });
        } catch {
          // Remote RPC failure does not prevent local persistence
        }
      })();
    }

    return sanitized;
  }

  public async saveBatch(expenses: ExpenseItem[]): Promise<ExpenseItem[]> {
    await this.init();
    if (!Array.isArray(expenses) || expenses.length === 0) return [];

    const sanitizedList: ExpenseItem[] = [];

    for (const exp of expenses) {
      if (this.memoryTombstones.has(exp.id)) {
        continue;
      }
      try {
        const saved = await this.save(exp);
        sanitizedList.push(saved);
      } catch (e) {
        console.warn('saveBatch single error:', e);
      }
    }

    return sanitizedList;
  }

  public async delete(id: string): Promise<void> {
    await this.init();

    this.memoryExpenses.delete(id);
    this.memoryTombstones.add(id);

    if (this.db) {
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = this.db!.transaction([STORE_EXPENSES, STORE_TOMBSTONES], 'readwrite');
          const expStore = tx.objectStore(STORE_EXPENSES);
          const tombStore = tx.objectStore(STORE_TOMBSTONES);
          expStore.delete(id);
          tombStore.put({ id });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        this.lastDurabilityState = 'durable';
      } catch (err) {
        console.warn('[EXPENSE_REPO] delete IDB transaction notice:', err);
        try {
          this.persistDegradedBackup();
          this.lastDurabilityState = 'degraded';
        } catch {
          this.lastDurabilityState = 'error';
        }
      }
    } else {
      this.persistDegradedBackup();
    }

    const client = getSupabaseClient();
    if (client) {
      void (async () => {
        try {
          const wsId = getCustomWorkspaceIdentifier();
          await client.rpc('delete_expense', {
            p_id: id,
            p_workspace_identifier: wsId,
            p_expected_version: null,
          });
        } catch {
          // Remote RPC failure does not prevent local deletion
        }
      })();
    }
  }

  public async deleteBatch(ids: string[]): Promise<void> {
    await this.init();
    if (!Array.isArray(ids) || ids.length === 0) return;
    for (const id of ids) {
      try {
        await this.delete(id);
      } catch (e) {
        console.warn('deleteBatch single error:', e);
      }
    }
  }

  public async clear(): Promise<void> {
    await this.init();
    this.memoryExpenses.clear();
    this.memoryOutbox.clear();
    this.memoryTombstones.clear();

    if (this.db) {
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = this.db!.transaction([STORE_EXPENSES, STORE_OUTBOX, STORE_TOMBSTONES], 'readwrite');
          tx.objectStore(STORE_EXPENSES).clear();
          tx.objectStore(STORE_OUTBOX).clear();
          tx.objectStore(STORE_TOMBSTONES).clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        this.lastDurabilityState = 'durable';
      } catch (err) {
        try {
          this.persistDegradedBackup();
          this.lastDurabilityState = 'degraded';
        } catch {
          this.lastDurabilityState = 'error';
        }
      }
    } else {
      this.persistDegradedBackup();
    }
  }

  public async enqueueMutation(mutation: Omit<OutboxMutation, 'id' | 'timestamp' | 'retryCount'>): Promise<OutboxMutation> {
    await this.init();
    const id = `mut-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const fullMutation: OutboxMutation = {
      ...mutation,
      id,
      timestamp: Date.now(),
      retryCount: 0,
    };
    this.memoryOutbox.set(id, fullMutation);
    if (this.db) {
      try {
        const tx = this.db.transaction(STORE_OUTBOX, 'readwrite');
        tx.objectStore(STORE_OUTBOX).put(fullMutation);
      } catch (err) {
        this.persistDegradedBackup();
      }
    } else {
      this.persistDegradedBackup();
    }
    return fullMutation;
  }

  public async getPendingOutbox(): Promise<OutboxMutation[]> {
    await this.init();
    return Array.from(this.memoryOutbox.values());
  }

  public async dequeueMutation(mutationId: string): Promise<void> {
    await this.init();
    this.memoryOutbox.delete(mutationId);
    if (this.db) {
      try {
        const tx = this.db.transaction(STORE_OUTBOX, 'readwrite');
        tx.objectStore(STORE_OUTBOX).delete(mutationId);
      } catch (err) {
        this.persistDegradedBackup();
      }
    } else {
      this.persistDegradedBackup();
    }
  }

  public async dequeueMutations(mutationIds: string[]): Promise<void> {
    await this.init();
    mutationIds.forEach((id) => this.memoryOutbox.delete(id));
    if (this.db) {
      try {
        const tx = this.db.transaction(STORE_OUTBOX, 'readwrite');
        const store = tx.objectStore(STORE_OUTBOX);
        mutationIds.forEach((id) => store.delete(id));
      } catch (err) {
        this.persistDegradedBackup();
      }
    } else {
      this.persistDegradedBackup();
    }
  }

  public async clearOutbox(): Promise<void> {
    await this.init();
    this.memoryOutbox.clear();
    if (this.db) {
      try {
        const tx = this.db.transaction(STORE_OUTBOX, 'readwrite');
        tx.objectStore(STORE_OUTBOX).clear();
      } catch (err) {
        this.persistDegradedBackup();
      }
    } else {
      this.persistDegradedBackup();
    }
  }

  public async recordTombstone(id: string): Promise<void> {
    await this.init();
    this.memoryTombstones.add(id);
    this.memoryExpenses.delete(id);
    if (this.db) {
      try {
        const tx = this.db.transaction([STORE_EXPENSES, STORE_TOMBSTONES], 'readwrite');
        tx.objectStore(STORE_EXPENSES).delete(id);
        tx.objectStore(STORE_TOMBSTONES).put({ id });
      } catch {
        this.persistDegradedBackup();
      }
    } else {
      this.persistDegradedBackup();
    }
  }

  public async recordTombstones(ids: string[]): Promise<void> {
    await this.init();
    ids.forEach((id) => {
      this.memoryTombstones.add(id);
      this.memoryExpenses.delete(id);
    });
    if (this.db) {
      try {
        const tx = this.db.transaction([STORE_EXPENSES, STORE_TOMBSTONES], 'readwrite');
        const expStore = tx.objectStore(STORE_EXPENSES);
        const tombStore = tx.objectStore(STORE_TOMBSTONES);
        ids.forEach((id) => {
          expStore.delete(id);
          tombStore.put({ id });
        });
      } catch {
        this.persistDegradedBackup();
      }
    } else {
      this.persistDegradedBackup();
    }
  }

  public async getTombstones(): Promise<Set<string>> {
    await this.init();
    return new Set(this.memoryTombstones);
  }

  public async isTombstoned(id: string): Promise<boolean> {
    await this.init();
    return this.memoryTombstones.has(id);
  }

  public async syncFromServer(): Promise<void> {
    await this.init();
    const result = await fetchExpensesFromDedicatedTable();
    if (!result.success || result.isFallbackNeeded) {
      return;
    }

    const { data: serverExpenses, tombstones: serverTombstones } = result;

    this.memoryExpenses.clear();
    this.memoryTombstones.clear();

    serverExpenses.forEach(exp => this.memoryExpenses.set(exp.id, exp));
    serverTombstones.forEach(id => this.memoryTombstones.add(id));

    if (this.db) {
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = this.db!.transaction([STORE_EXPENSES, STORE_TOMBSTONES], 'readwrite');
          const expStore = tx.objectStore(STORE_EXPENSES);
          const tombStore = tx.objectStore(STORE_TOMBSTONES);

          expStore.clear();
          tombStore.clear();

          serverExpenses.forEach((exp) => expStore.put(exp));
          serverTombstones.forEach((id) => tombStore.put({ id }));

          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        this.lastDurabilityState = 'durable';
      } catch (err) {
        console.warn('[EXPENSE_REPO] syncFromServer IDB transaction notice:', err);
        try {
          this.persistDegradedBackup();
          this.lastDurabilityState = 'degraded';
        } catch {
          this.lastDurabilityState = 'error';
        }
      }
    } else {
      this.persistDegradedBackup();
    }
  }

  public async getSyncStatus(): Promise<ExpenseSyncStatus> {
    await this.init();
    const pendingCount = this.memoryOutbox.size;
    const state = this.memorySyncStatus.state === 'error'
      ? 'error'
      : (pendingCount > 0 ? 'pending' : 'synced');
    return {
      ...this.memorySyncStatus,
      pendingCount,
      state,
    };
  }

  public async setSyncStatus(status: Partial<ExpenseSyncStatus>): Promise<void> {
    this.memorySyncStatus = { ...this.memorySyncStatus, ...status };
  }
}

export const expenseRepo = new IndexedDBExpenseRepository();