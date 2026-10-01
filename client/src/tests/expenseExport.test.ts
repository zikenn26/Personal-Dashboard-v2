import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  generateExpenseCSV,
  generateExpenseJSON,
  generateExpenseExcelBuffer,
} from '../utils/expenseExport';
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

  it('generates valid Excel (.xlsx) workbook buffer readable by SheetJS', () => {
    const buffer = generateExpenseExcelBuffer(sampleExpenses);
    expect(buffer).toBeInstanceOf(Uint8Array);
    expect(buffer.length).toBeGreaterThan(0);

    // Verify it is a valid Excel workbook
    const workbook = XLSX.read(buffer, { type: 'array' });
    expect(workbook.SheetNames).toContain('Transactions');

    const sheet = workbook.Sheets['Transactions'];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);
    expect(rows.length).toBe(2);
    expect(rows[0]['Merchant / Title']).toBe('Starbucks Coffee, Downtown');
    expect(rows[0]['Amount']).toBe(320);
    expect(rows[0]['Type']).toBe('DEBIT');
    expect(rows[1]['Merchant / Title']).toBe('Amazon Refund');
    expect(rows[1]['Amount']).toBe(1500);
    expect(rows[1]['Type']).toBe('CREDIT');
  });

  it('handles empty expense list gracefully for both CSV and Excel', () => {
    const csv = generateExpenseCSV([]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Transaction ID');

    const excelBuffer = generateExpenseExcelBuffer([]);
    expect(excelBuffer.length).toBeGreaterThan(0);
    const workbook = XLSX.read(excelBuffer, { type: 'array' });
    expect(workbook.SheetNames).toContain('Transactions');
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
