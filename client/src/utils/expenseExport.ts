import { ExpenseItem } from '../types';
import { isCreditTransaction } from './expenseUtils';
import { nativeService } from '../services/nativeService';

const escapeCsv = (val: any): string => {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
};

/**
 * Generates RFC 4180 compliant CSV string with UTF-8 BOM for universal
 * compatibility across Microsoft Excel, Google Sheets, LibreOffice, and mobile viewers.
 */
export function generateExpenseCSV(expenses: ExpenseItem[]): string {
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

  const rows = expenses.map((item) => {
    const isCredit = isCreditTransaction(item);
    return [
      escapeCsv(item.id),
      escapeCsv(item.date || ''),
      escapeCsv(item.time || ''),
      escapeCsv(item.name || ''),
      escapeCsv(item.category || ''),
      escapeCsv(item.amount ?? 0),
      escapeCsv(isCredit ? 'CREDIT' : 'DEBIT'),
      escapeCsv(item.paymentMethod || ''),
      escapeCsv(item.bankOrAccount || item.bankName || ''),
      escapeCsv(item.referenceId || item.smsReferenceId || item.upiReference || ''),
      escapeCsv(item.source || 'manual'),
      escapeCsv(item.notes || ''),
    ].join(',');
  });

  // Prepend UTF-8 Byte Order Mark (BOM) so Excel handles accents & symbols like ₹ correctly
  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

/**
 * Generates formatted JSON representation of expenses.
 */
export function generateExpenseJSON(expenses: ExpenseItem[]): string {
  return JSON.stringify(expenses, null, 2);
}

/**
 * Downloads a file onto the device using standard browser/WebView blob download.
 */
export function downloadExpenseFile(
  content: string,
  filename: string,
  mimeType: string = 'text/csv;charset=utf-8;'
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Shares exported expenses using Web Share API (Level 2 with File support)
 * or falls back to nativeService.shareContent / text share.
 */
export async function shareExpenseExport(options: {
  filename: string;
  content: string;
  mimeType: string;
  title: string;
  text?: string;
}): Promise<boolean> {
  const { filename, content, mimeType, title, text } = options;

  // Try Web Share API Level 2 with File attachment
  if (typeof navigator !== 'undefined' && 'canShare' in navigator) {
    try {
      const file = new File([content], filename, { type: mimeType });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title,
          text: text || title,
        });
        return true;
      }
    } catch {
      // User dismissed share dialog or permission denied
    }
  }

  // Fallback to text content sharing via nativeService / standard share
  return nativeService.shareContent({
    title,
    text: text || `${title}\n\n${content.slice(0, 1000)}...`,
  });
}
