import { describe, it, expect } from 'vitest';
import { generateExpenseCSV, generateExpenseJSON } from '../utils/expenseExport';
import { ExpenseItem } from '../types';

describe('expenseExport utility', () => {
  const sampleExpenses: ExpenseItem[] = [
    {
      id: 'exp-1',
      name: 'Starbucks Coffee, Downtown',
      amount: 320,
      category: 'Food & Dining',
      date: '2026-10-01',
      time: '09:30',
      paymentMethod: 'UPI',
      bankOrAccount: 'HDFC Bank',
      referenceId: 'UPI-987654321',
      source: 'sms_auto',
      notes: 'Morning latte with "hazelnut" syrup',
    },
    {
      id: 'exp-2',
      name: 'Amazon Refund',
      amount: 1500,
      category: 'Refunds & Returns',
      date: '2026-10-01',
      time: '14:15',
      direction: 'CREDIT',
      paymentMethod: 'Bank Transfer',
      bankOrAccount: 'ICICI Bank',
      referenceId: 'REF-12345',
      source: 'manual',
    },
  ];

  it('generates compliant CSV with UTF-8 BOM and correct headers', () => {
    const csv = generateExpenseCSV(sampleExpenses);

    // Starts with UTF-8 BOM for Excel
    expect(csv.startsWith('\uFEFF')).toBe(true);

    // Contains standard headers
    expect(csv).toContain('Transaction ID');
    expect(csv).toContain('Merchant / Title');
    expect(csv).toContain('Amount');
    expect(csv).toContain('Type');

    // Contains transaction rows
    expect(csv).toContain('"exp-1"');
    expect(csv).toContain('"Starbucks Coffee, Downtown"');
    expect(csv).toContain('"DEBIT"');
    expect(csv).toContain('"Morning latte with ""hazelnut"" syrup"');

    // Contains credit transaction correctly identified
    expect(csv).toContain('"exp-2"');
    expect(csv).toContain('"CREDIT"');
  });

  it('handles empty expense list gracefully', () => {
    const csv = generateExpenseCSV([]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Transaction ID');
  });

  it('generates valid JSON string', () => {
    const jsonStr = generateExpenseJSON(sampleExpenses);
    const parsed = JSON.parse(jsonStr);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(2);
    expect(parsed[0].id).toBe('exp-1');
    expect(parsed[1].name).toBe('Amazon Refund');
  });
});
