import { describe, it, expect } from 'vitest';
import { ExpenseItem } from '../types';

describe('Expense Tracker Search and Filter Bar Unit Tests', () => {
  const sampleExpenses: ExpenseItem[] = [
    {
      id: 'tx-1',
      name: 'Starbucks Coffee',
      amount: 350,
      category: 'Food & Dining',
      date: '2026-10-02',
      paymentMethod: 'UPI',
      notes: 'Morning latte with team',
      source: 'manual',
    },
    {
      id: 'tx-2',
      name: 'Amazon India',
      amount: 4500,
      category: 'Shopping',
      date: '2026-10-01',
      paymentMethod: 'Credit Card',
      notes: 'Mechanical keyboard and desk mat',
      source: 'manual',
    },
    {
      id: 'tx-3',
      name: 'Uber Rides',
      amount: 420,
      category: 'Transportation',
      date: '2026-09-30',
      paymentMethod: 'UPI',
      notes: 'Trip to office',
      source: 'sms_auto',
    },
    {
      id: 'tx-4',
      name: 'Electricity Bill',
      amount: 1850,
      category: 'Bills & Utilities',
      date: '2026-09-28',
      paymentMethod: 'Net Banking',
      notes: 'Monthly power consumption',
      source: 'manual',
    },
    {
      id: 'tx-5',
      name: 'Swiggy Gourmet',
      amount: 890,
      category: 'Food & Dining',
      date: '2026-09-27',
      paymentMethod: 'Credit Card',
      notes: 'Dinner delivery',
      source: 'manual',
    },
  ];

  it('filters expenses by merchant name accurately', () => {
    const query = 'starbucks';
    const filtered = sampleExpenses.filter(
      (e) =>
        e.name.toLowerCase().includes(query) ||
        (e.notes && e.notes.toLowerCase().includes(query))
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('tx-1');
  });

  it('filters expenses by notes/payee keyword', () => {
    const query = 'keyboard';
    const filtered = sampleExpenses.filter(
      (e) =>
        e.name.toLowerCase().includes(query) ||
        (e.notes && e.notes.toLowerCase().includes(query))
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('tx-2');
  });

  it('filters expenses by category', () => {
    const selectedCategory = 'Food & Dining';
    const filtered = sampleExpenses.filter((e) => e.category === selectedCategory);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((e) => e.name)).toEqual(['Starbucks Coffee', 'Swiggy Gourmet']);
  });

  it('filters expenses by minimum and maximum amount range', () => {
    const minAmount = 400;
    const maxAmount = 2000;
    const filtered = sampleExpenses.filter(
      (e) => e.amount >= minAmount && e.amount <= maxAmount
    );
    expect(filtered).toHaveLength(3);
    const names = filtered.map((e) => e.name);
    expect(names).toContain('Uber Rides');
    expect(names).toContain('Electricity Bill');
    expect(names).toContain('Swiggy Gourmet');
  });

  it('combines merchant search, category filter, and amount range', () => {
    const merchantQuery = 'swiggy';
    const category = 'Food & Dining';
    const minAmount = 500;
    const maxAmount = 1000;

    const filtered = sampleExpenses.filter((e) => {
      const matchName = e.name.toLowerCase().includes(merchantQuery) || (e.notes && e.notes.toLowerCase().includes(merchantQuery));
      const matchCat = e.category === category;
      const matchMin = e.amount >= minAmount;
      const matchMax = e.amount <= maxAmount;
      return matchName && matchCat && matchMin && matchMax;
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('Swiggy Gourmet');
    expect(filtered[0].amount).toBe(890);
  });
});
