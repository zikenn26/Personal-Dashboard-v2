import * as XLSX from 'xlsx';
import { ExpenseItem } from '../types';
import { isCreditTransaction, getLocalDateKey } from './expenseUtils';
import { nativeService } from '../services/nativeService';

export const EXCEL_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const EXCEL_HEADERS = [
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
  return '\uFEFF' + [EXCEL_HEADERS.join(','), ...rows].join('\r\n');
}

/**
 * Generates an Excel workbook (.xlsx) object using SheetJS/XLSX.
 */
export function generateExpenseWorkbook(expenses: ExpenseItem[]): XLSX.WorkBook {
  const data = expenses.map((item) => {
    const isCredit = isCreditTransaction(item);
    return {
      'Transaction ID': item.id,
      'Date': item.date || '',
      'Time': item.time || '',
      'Merchant / Title': item.name || '',
      'Category': item.category || '',
      'Amount': Number(item.amount) || 0,
      'Type': isCredit ? 'CREDIT' : 'DEBIT',
      'Payment Method': item.paymentMethod || '',
      'Bank / Account': item.bankOrAccount || item.bankName || '',
      'Reference ID': item.referenceId || item.smsReferenceId || item.upiReference || '',
      'Source': item.source || 'manual',
      'Notes': item.notes || '',
    };
  });

  const worksheet =
    data.length > 0
      ? XLSX.utils.json_to_sheet(data, { header: EXCEL_HEADERS })
      : XLSX.utils.aoa_to_sheet([EXCEL_HEADERS]);

  // Set friendly column widths
  worksheet['!cols'] = [
    { wch: 18 }, // ID
    { wch: 12 }, // Date
    { wch: 8 },  // Time
    { wch: 25 }, // Merchant
    { wch: 16 }, // Category
    { wch: 12 }, // Amount
    { wch: 10 }, // Type
    { wch: 16 }, // Payment Method
    { wch: 22 }, // Bank / Account
    { wch: 22 }, // Reference ID
    { wch: 12 }, // Source
    { wch: 25 }, // Notes
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');
  return workbook;
}

/**
 * Generates an Excel workbook (.xlsx) binary buffer using SheetJS/XLSX.
 */
export function generateExpenseExcelBuffer(expenses: ExpenseItem[]): Uint8Array {
  const workbook = generateExpenseWorkbook(expenses);
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(buffer);
}

/**
 * Generates formatted JSON representation of expenses.
 */
export function generateExpenseJSON(expenses: ExpenseItem[]): string {
  return JSON.stringify(expenses, null, 2);
}

/**
 * Downloads a file onto the device using standard browser/WebView blob download with mobile Web Share and data URI fallback.
 */
export async function downloadExpenseFile(
  content: string | Uint8Array,
  filename: string,
  mimeType: string = 'text/csv;charset=utf-8;'
): Promise<void> {
  const blobPart = content instanceof Uint8Array ? content : content;
  const blob = new Blob([blobPart], { type: mimeType });

  // 1. Mobile Web Share API Level 2 (Android / iOS / Mobile WebView)
  if (typeof navigator !== 'undefined' && 'canShare' in navigator && typeof File !== 'undefined') {
    try {
      const file = new File([blob], filename, { type: mimeType });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename,
        });
        return;
      }
    } catch {
      // User cancelled share or device declined, fall through to browser link download
    }
  }

  try {
    // 2. Check for legacy IE/Edge msSaveOrOpenBlob
    if (typeof window !== 'undefined' && (window.navigator as any)?.msSaveOrOpenBlob) {
      (window.navigator as any).msSaveOrOpenBlob(blob, filename);
      return;
    }

    // 3. Off-screen anchor download (ensures element is in layout tree without display: none)
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.setAttribute('download', filename);
    link.target = '_self';
    link.rel = 'noopener';
    link.style.position = 'fixed';
    link.style.left = '-9999px';
    link.style.top = '-9999px';
    link.style.opacity = '0';
    document.body.appendChild(link);

    // Trigger file save across modern browsers
    try {
      link.click();
    } catch {
      const clickEvt = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      });
      link.dispatchEvent(clickEvt);
    }

    // Give browser download manager ample time to stream blob before revoking
    setTimeout(() => {
      try {
        if (link.parentNode) {
          document.body.removeChild(link);
        }
        URL.revokeObjectURL(url);
      } catch {}
    }, 60000);
  } catch (blobErr) {
    console.warn('[EXPORT] Blob download failed, attempting data URI fallback:', blobErr);
    // 4. Data URI fallback for sandboxed iframes
    try {
      let dataUri = '';
      if (typeof content === 'string') {
        dataUri = `data:${mimeType};base64,` + btoa(unescape(encodeURIComponent(content)));
      } else if (content instanceof Uint8Array) {
        let binary = '';
        const len = content.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(content[i]);
        }
        dataUri = `data:${mimeType};base64,` + btoa(binary);
      }
      if (dataUri) {
        const link = document.createElement('a');
        link.href = dataUri;
        link.download = filename;
        link.setAttribute('download', filename);
        link.style.position = 'fixed';
        link.style.left = '-9999px';
        link.style.top = '-9999px';
        link.style.opacity = '0';
        document.body.appendChild(link);
        try {
          link.click();
        } catch {
          link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        }
        setTimeout(() => {
          try {
            if (link.parentNode) document.body.removeChild(link);
          } catch {}
        }, 15000);
      }
    } catch (fallbackErr) {
      console.error('[EXPORT] All download methods failed:', fallbackErr);
    }
  }
}

/**
 * Convenience helper to download CSV directly.
 */
export async function downloadExpenseCSV(expenses: ExpenseItem[], filename?: string): Promise<void> {
  const dateStr = getLocalDateKey();
  const name = filename || `expense_transactions_${dateStr}.csv`;
  const csv = generateExpenseCSV(expenses);
  await downloadExpenseFile(csv, name, 'text/csv;charset=utf-8;');
}

/**
 * Convenience helper to download Excel (.xlsx) directly using Blob with
 * 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' and anchor link download.
 */
export async function downloadExpenseExcel(expenses: ExpenseItem[], filename?: string): Promise<void> {
  const dateStr = getLocalDateKey();
  const name = filename || `expense_transactions_${dateStr}.xlsx`;
  const workbook = generateExpenseWorkbook(expenses);

  // Binary array buffer through SheetJS
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const uint8Array = new Uint8Array(buffer);

  // Trigger file save using Blob with explicit MIME type 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  // and anchor link creation with download attribute
  try {
    await downloadExpenseFile(
      uint8Array,
      name,
      EXCEL_MIME_TYPE
    );
  } catch (err) {
    console.warn('[EXPORT] downloadExpenseFile notice, falling back to XLSX.writeFile:', err);
    if (typeof window !== 'undefined') {
      XLSX.writeFile(workbook, name, { bookType: 'xlsx' });
    }
  }
}

/**
 * Shares exported expenses using Web Share API (Level 2 with File support)
 * or falls back to nativeService.shareContent / text share.
 */
export async function shareExpenseExport(options: {
  filename: string;
  content: string | Uint8Array;
  mimeType: string;
  title: string;
  text?: string;
}): Promise<boolean> {
  const { filename, content, mimeType, title, text } = options;

  // Try Web Share API Level 2 with File attachment
  if (typeof navigator !== 'undefined' && 'canShare' in navigator) {
    try {
      const blobPart = content instanceof Uint8Array ? content : content;
      const file = new File([blobPart], filename, { type: mimeType });
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
  const fallbackText =
    typeof content === 'string'
      ? `${title}\n\n${content.slice(0, 1000)}...`
      : `${title}\n\nExported Excel file: ${filename}`;

  return nativeService.shareContent({
    title,
    text: text || fallbackText,
  });
}
