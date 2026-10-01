import { describe, expect, it, beforeEach } from 'vitest';
import { Storage } from '../utils/storage';
import { ExpenseItem } from '../types';
import { isCreditTransaction } from '../utils/expenseUtils';

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

describe('Expense Tracker CSV Export & Category Filter Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    Storage.setExpenses([]);
  });

  it('correctly formats and escapes CSV output for expense transaction history', () => {
    const expenses: ExpenseItem[] = [
      {
        id: 'exp-1',
        name: 'Grocery Store, "Special" Items',
        amount: 1540.5,
        category: 'Groceries',
        date: '2026-09-28',
        time: '14:30',
        paymentMethod: 'UPI',
        bankOrAccount: 'HDFC Bank (Acct XX1234)',
        referenceId: 'UPI-778899',
        source: 'sms_auto',
        notes: 'Monthly bulk pantry refill, snacks',
      },
      {
        id: 'exp-2',
        name: 'Salary Credit',
        amount: 85000,
        category: 'Income',
        type: 'income',
        date: '2026-09-30',
        time: '10:00',
        paymentMethod: 'IMPS',
        bankOrAccount: 'ICICI Bank (Acct XX5678)',
        referenceId: 'IMPS-112233',
        source: 'manual',
        notes: 'September Salary',
      },
    ];

    const escapeCsv = (str: any) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    const headers = [
      'Transaction ID',
      'Date',
      'Time',
      'Merchant / Title',
      'Category',
      'Amount',
      'Type',
      'Payment Method',
      'Bank / Account',
      'Reference ID',
      'Source',
      'Notes',
    ];

    const rows = expenses.map((t) => {
      const isCredit = isCreditTransaction(t);
      return [
        escapeCsv(t.id),
        escapeCsv(t.date || ''),
        escapeCsv(t.time || ''),
        escapeCsv(t.name || ''),
        escapeCsv(t.category || ''),
        escapeCsv(t.amount),
        escapeCsv(isCredit ? 'CREDIT' : 'DEBIT'),
        escapeCsv(t.paymentMethod || ''),
        escapeCsv(t.bankOrAccount || ''),
        escapeCsv(t.referenceId || ''),
        escapeCsv(t.source || 'manual'),
        escapeCsv(t.notes || ''),
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\r\n');

    expect(csv).toContain('Transaction ID,Date,Time,Merchant / Title');
    expect(csv).toContain('"Grocery Store, ""Special"" Items"');
    expect(csv).toContain('"DEBIT"');
    expect(csv).toContain('"CREDIT"');
    expect(csv).toContain('85000');
    expect(csv).toContain('1540.5');
  });

  it('filters transactions accurately by Category including Food, Transport, and Utilities', () => {
    const expenses: ExpenseItem[] = [
      { id: '1', name: 'Zomato Food', amount: 350, category: 'Food & Dining', date: '2026-09-28' },
      { id: '2', name: 'Uber Ride', amount: 220, category: 'Transport', date: '2026-09-28' },
      { id: '3', name: 'Electricity Bill', amount: 1800, category: 'Bills & Utilities', date: '2026-09-27' },
      { id: '4', name: 'Swiggy Dinner', amount: 500, category: 'Food', date: '2026-09-26' },
      { id: '5', name: 'Ola Cab', amount: 190, category: 'Travel', date: '2026-09-25' },
      { id: '6', name: 'Water Utility', amount: 400, category: 'Utilities', date: '2026-09-24' },
      { id: '7', name: 'Grocery Mart', amount: 1200, category: 'Groceries', date: '2026-09-23' },
    ];

    const filterByCategory = (list: ExpenseItem[], selectedCategoryFilter: string) => {
      if (selectedCategoryFilter === 'all') return list;
      const filterLower = selectedCategoryFilter.toLowerCase().trim();
      return list.filter((e) => {
        const cat = (e.category || '').toLowerCase().trim();
        if (cat === filterLower) return true;
        if (filterLower === 'food' || filterLower === 'food & dining') {
          return cat.includes('food') || cat.includes('dining') || cat.includes('restaurant') || cat.includes('cafe') || cat.includes('snack');
        }
        if (filterLower === 'transport' || filterLower === 'travel') {
          return cat.includes('transport') || cat.includes('travel') || cat.includes('cab') || cat.includes('auto') || cat.includes('uber') || cat.includes('ola');
        }
        if (filterLower === 'utilities' || filterLower === 'bills' || filterLower === 'bills & utilities') {
          return cat.includes('utilit') || cat.includes('bill') || cat.includes('electric') || cat.includes('water') || cat.includes('recharge');
        }
        if (filterLower === 'groceries') {
          return cat.includes('grocer') || cat.includes('supermarket') || cat.includes('mart');
        }
        return cat.includes(filterLower) || filterLower.includes(cat);
      });
    };

    // Filter by Food
    const foodItems = filterByCategory(expenses, 'Food');
    expect(foodItems.map((e) => e.name)).toEqual(['Zomato Food', 'Swiggy Dinner']);

    // Filter by Transport
    const transportItems = filterByCategory(expenses, 'Transport');
    expect(transportItems.map((e) => e.name)).toEqual(['Uber Ride', 'Ola Cab']);

    // Filter by Utilities
    const utilityItems = filterByCategory(expenses, 'Utilities');
    expect(utilityItems.map((e) => e.name)).toEqual(['Electricity Bill', 'Water Utility']);

    // Filter by Groceries
    const groceryItems = filterByCategory(expenses, 'Groceries');
    expect(groceryItems.map((e) => e.name)).toEqual(['Grocery Mart']);

    // Filter by All
    const allItems = filterByCategory(expenses, 'all');
    expect(allItems).toHaveLength(7);
  });
});
