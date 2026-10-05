import { describe, it, expect, beforeEach } from 'vitest';
import { Storage, STORAGE_KEYS } from '../utils/storage';
import { ExpenseItem, ExcelImportLog } from '../types';

if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => {
      store[key] = String(val);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
    key: (idx: number) => Object.keys(store)[idx] || null,
    length: 0,
  } as any;
}

describe('Spreadsheet Deletion & Month Spending Preservation', () => {
  beforeEach(() => {
    localStorage.clear();
    Storage.setExpenses([]);
    Storage.setExcelImportLogs([]);
    Storage.setDeletedSheetIds([]);
    Storage.setTrash([]);
  });

  it('records a tombstone when an Excel sheet is deleted and prevents resurrection from cloud snapshot', () => {
    const oldLog: ExcelImportLog = {
      id: 'sheet_sep_1',
      fileName: 'Money Manager_30-09-2026.xlsx',
      uploadDate: '2026-09-30T10:00:00.000Z',
      addedCount: 50,
      skippedCount: 0,
      totalRowsInSheet: 50,
      totalAmountAdded: 25000,
      status: 'active',
    };

    Storage.setExcelImportLogs([oldLog]);
    expect(Storage.getExcelImportLogs()).toHaveLength(1);

    // Delete the sheet log
    Storage.deleteExcelImportLog(oldLog.id);
    expect(Storage.getExcelImportLogs()).toHaveLength(0);

    // Tombstone must be recorded
    expect(Storage.isSheetDeleted(oldLog.id)).toBe(true);
    expect(Storage.isSheetDeleted(oldLog.fileName)).toBe(true);

    // Now simulate older cloud snapshot arriving that still has the deleted sheet log and expenses
    const cloudPayload = {
      excelImportLogs: [oldLog],
      expenses: [
        {
          id: 'exp-old-1',
          name: 'Old September Expense',
          amount: 500,
          date: '2026-09-25',
          importBatchId: oldLog.id,
          sourceFile: oldLog.fileName,
          active: true,
        },
      ],
    };

    Storage.importAllDataPayload(cloudPayload);

    // The deleted sheet log must NOT be revived
    expect(Storage.getExcelImportLogs()).toHaveLength(0);
    // The deleted sheet's expenses must NOT be revived
    expect(Storage.getExpenses()).toHaveLength(0);
  });

  it('preserves current month spendings during cloud hydration even if cloud has older/fewer records', () => {
    const octExpense: ExpenseItem = {
      id: 'exp-oct-1',
      name: 'October Groceries',
      amount: 1250,
      date: '2026-10-02',
      category: 'Groceries',
      direction: 'DEBIT',
      active: true,
    };

    Storage.setExpenses([octExpense]);

    // Cloud has only September data
    const cloudPayload = {
      expenses: [
        {
          id: 'exp-sep-1',
          name: 'September Rent',
          amount: 15000,
          date: '2026-09-30',
          category: 'Living & Rent',
          direction: 'DEBIT',
          active: true,
        },
      ],
    };

    Storage.importAllDataPayload(cloudPayload);

    const merged = Storage.getExpenses();
    // Both October and September expenses must be present
    expect(merged.some((e) => e.id === 'exp-oct-1')).toBe(true);
    expect(merged.some((e) => e.id === 'exp-sep-1')).toBe(true);
  });

  it('rescues all trashed expenses for target month even if active spendings exist', () => {
    const activeOct: ExpenseItem = {
      id: 'exp-oct-active',
      name: 'Active Coffee',
      amount: 100,
      date: '2026-10-01',
      active: true,
    };
    Storage.setExpenses([activeOct]);

    const trashedOct: ExpenseItem = {
      id: 'exp-oct-trashed',
      name: 'Dhirisala Sai S',
      amount: 200,
      date: '2026-10-01',
      active: true,
    };

    Storage.moveToTrash('expenses', trashedOct, 'Dhirisala Sai S (₹200)');

    expect(Storage.getExpenses()).toHaveLength(1);
    expect(Storage.getTrash()).toHaveLength(1);

    const rescued = Storage.rescueTrashedExpensesForMonth('2026-10');
    expect(rescued).toBe(1);

    const updated = Storage.getExpenses();
    expect(updated).toHaveLength(2);
    expect(updated.some((e) => e.id === 'exp-oct-trashed')).toBe(true);
  });
});
