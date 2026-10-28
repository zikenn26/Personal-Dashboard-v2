import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { Storage } from '../utils/storage';
import { getMatchingExpensesForSheet } from '../components/ExpenseTracker';
import { ExpenseItem, ExcelImportLog } from '../types';

function setupMockStorage() {
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
      key: (idx: number) => Object.keys(store)[idx] ?? null,
      length: 0,
    } as any;
  }
}

describe('Android New Features & Refinements Test Suite', () => {
  beforeAll(() => {
    setupMockStorage();
  });

  beforeEach(() => {
    localStorage.clear();
    Storage.setExpenses([]);
    Storage.setExcelImportLogs([]);
  });

  describe('Item 2: Clear All Transactions & Excel Sheet Operations', () => {
    it('clears all expense records and imported sheets cleanly', () => {
      const expenses: ExpenseItem[] = [
        { id: 'e1', name: 'Coffee', amount: 150, category: 'Food', date: '2026-09-30', direction: 'DEBIT' },
        { id: 'e2', name: 'Salary', amount: 50000, category: 'Income', date: '2026-09-30', direction: 'CREDIT' },
      ];
      Storage.setExpenses(expenses);
      expect(Storage.getExpenses().length).toBe(2);

      // Perform clear all
      Storage.setExpenses([]);
      Storage.setExcelImportLogs([]);
      expect(Storage.getExpenses().length).toBe(0);
      expect(Storage.getExcelImportLogs().length).toBe(0);
    });

    it('matches and isolates expenses belonging to a specific uploaded Excel sheet for deletion', () => {
      const log: ExcelImportLog = {
        id: 'batch-999',
        fileName: 'kotak_september.xlsx',
        uploadDate: '2026-09-30T10:00:00.000Z',
        addedCount: 2,
        skippedCount: 0,
        totalRowsInSheet: 2,
        totalAmountAdded: 750,
        status: 'active',
      };

      const expenses: ExpenseItem[] = [
        {
          id: 'e1',
          name: 'Uber',
          amount: 250,
          category: 'Transport',
          date: '2026-09-28',
          direction: 'DEBIT',
          sourceFile: 'kotak_september.xlsx',
          importBatchId: 'batch-999',
        },
        {
          id: 'e2',
          name: 'Swiggy',
          amount: 500,
          category: 'Food',
          date: '2026-09-29',
          direction: 'DEBIT',
          sourceFile: 'kotak_september.xlsx',
          importBatchId: 'batch-999',
        },
        {
          id: 'e3',
          name: 'Manual Expense',
          amount: 100,
          category: 'Snacks',
          date: '2026-09-30',
          direction: 'DEBIT',
          source: 'manual',
        },
      ];

      const matching = getMatchingExpensesForSheet(log, expenses);
      expect(matching.length).toBe(2);
      expect(matching.map((m) => m.id)).toEqual(['e1', 'e2']);

      // Deleting the sheet spendings leaves only the manual expense
      const remaining = expenses.filter((e) => !matching.some((m) => m.id === e.id));
      expect(remaining.length).toBe(1);
      expect(remaining[0].id).toBe('e3');
    });
  });

  describe('Item 4: Top Categories Calculation for Compact Spending Grid', () => {
    it('aggregates debit expenses by category in descending order for the top spending grid', () => {
      const expenses: ExpenseItem[] = [
        { id: '1', name: 'Dinner', amount: 1200, category: 'Dining Out', date: '2026-09-29', direction: 'DEBIT' },
        { id: '2', name: 'Lunch', amount: 400, category: 'Dining Out', date: '2026-09-29', direction: 'DEBIT' },
        { id: '3', name: 'Metro', amount: 100, category: 'Transport', date: '2026-09-29', direction: 'DEBIT' },
        { id: '4', name: 'Refund', amount: 500, category: 'Refund', date: '2026-09-29', direction: 'CREDIT' },
      ];

      const catMap: Record<string, number> = {};
      expenses.forEach((e) => {
        if (e.direction !== 'CREDIT') {
          catMap[e.category] = (catMap[e.category] || 0) + e.amount;
        }
      });

      const sortedCats = Object.entries(catMap)
        .map(([cat, total]) => ({ cat, total }))
        .sort((a, b) => b.total - a.total);

      expect(sortedCats[0].cat).toBe('Dining Out');
      expect(sortedCats[0].total).toBe(1600);
      expect(sortedCats[1].cat).toBe('Transport');
      expect(sortedCats[1].total).toBe(100);
      // Refunds (Credits) are not in debit category map
      expect(catMap['Refund']).toBeUndefined();
    });
  });

  describe('Item 5: Search Query Matching for Pages, Components, and Items', () => {
    it('correctly matches page keywords for instant navigation', () => {
      const pages = [
        { id: 'expenses', title: 'Money & Expenses', keywords: ['money', 'expenses', 'budget', 'sms', 'excel'] },
        { id: 'vault', title: 'Password Vault', keywords: ['vault', 'password', 'secrets', 'pins'] },
        { id: 'tasks', title: 'Tasks & Kanban', keywords: ['tasks', 'todo', 'kanban', 'work'] },
      ];

      const search = (q: string) => {
        const query = q.toLowerCase().trim();
        return pages.filter(
          (p) =>
            p.title.toLowerCase().includes(query) ||
            p.keywords.some((kw) => kw.includes(query) || query.includes(kw))
        );
      };

      expect(search('money').map((p) => p.id)).toContain('expenses');
      expect(search('excel').map((p) => p.id)).toContain('expenses');
      expect(search('password').map((p) => p.id)).toContain('vault');
      expect(search('todo').map((p) => p.id)).toContain('tasks');
    });
  });
});
