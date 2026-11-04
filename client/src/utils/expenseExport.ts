import * as XLSX from 'xlsx';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
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

function toBase64(content: string | Uint8Array): string {
  if (typeof content === 'string') {
    return btoa(unescape(encodeURIComponent(content)));
  }
  let binary = '';
  const len = content.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(content[i]);
  }
  return btoa(binary);
}

/**
 * Downloads a file onto the device.
 * - On Native Android APK: saves to device storage via @capacitor/filesystem and opens the native save/share sheet.
 * - In Web Browser: uses standard browser blob download with DOM <a> fallback.
 */
export async function downloadExpenseFile(
  content: string | Uint8Array,
  filename: string,
  mimeType: string = 'text/csv;charset=utf-8;'
): Promise<void> {
  // 1. Native Android APK execution path
  if (Capacitor.isNativePlatform()) {
    try {
      try {
        const perm = await Filesystem.checkPermissions();
        if (perm.publicStorage !== 'granted') {
          await Filesystem.requestPermissions();
        }
      } catch (permErr) {
        console.warn('[EXPORT] Permission check warning:', permErr);
      }

      const base64Data = toBase64(content);
      let fileUri = '';

      try {
        const res = await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true,
        });
        fileUri = res.uri;
      } catch (docErr) {
        console.warn('[EXPORT] Write to Documents failed, attempting Cache:', docErr);
        const res = await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Cache,
          recursive: true,
        });
        fileUri = res.uri;
      }

      if (fileUri) {
        await Share.share({
          title: filename,
          text: `Exported expenses: ${filename}`,
          url: fileUri,
          files: [fileUri],
          dialogTitle: `Save or Open ${filename}`,
        });
        return;
      }
    } catch (nativeErr) {
      console.warn('[EXPORT] Native file save failed, attempting web fallback:', nativeErr);
    }
  }

  // 2. Standard Web Browser / Desktop DOM anchor download
  const blobPart = content instanceof Uint8Array ? content : content;
  const blob = new Blob([blobPart], { type: mimeType });

  try {
    if (typeof window !== 'undefined' && (window.navigator as any)?.msSaveOrOpenBlob) {
      (window.navigator as any).msSaveOrOpenBlob(blob, filename);
      return;
    }

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
 * Convenience helper to download Excel (.xlsx) directly with dual fallback:
 * - On Native Android: converts to buffer and writes to device storage via downloadExpenseFile.
 * - In Web Browser: uses SheetJS native XLSX.writeFile or Blob Anchor.
 */
export async function downloadExpenseExcel(expenses: ExpenseItem[], filename?: string): Promise<void> {
  const dateStr = getLocalDateKey();
  const name = filename || `expense_transactions_${dateStr}.xlsx`;
  const workbook = generateExpenseWorkbook(expenses);

  if (!Capacitor.isNativePlatform() && typeof window !== 'undefined') {
    try {
      XLSX.writeFile(workbook, name, { bookType: 'xlsx' });
      return;
    } catch (sheetJsErr) {
      console.warn('[EXPORT] XLSX.writeFile direct attempt encountered issue, falling back to Blob:', sheetJsErr);
    }
  }

  try {
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const uint8Array = new Uint8Array(buffer);
    await downloadExpenseFile(uint8Array, name, EXCEL_MIME_TYPE);
  } catch (err) {
    console.error('[EXPORT] Excel export failed across all methods:', err);
    throw err;
  }
}

/**
 * Universal bundle export helper: Generates both XLSX and CSV files simultaneously
 * so the user has immediate access to their data in any program.
 */
export async function downloadExpenseBundle(expenses: ExpenseItem[]): Promise<void> {
  const dateStr = getLocalDateKey();
  await downloadExpenseExcel(expenses, `expense_transactions_${dateStr}.xlsx`);
  // Stagger slightly so browser doesn't block parallel downloads
  setTimeout(() => {
    void downloadExpenseCSV(expenses, `expense_transactions_${dateStr}.csv`);
  }, 400);
}

/**
 * Shares exported expenses using Native Capacitor Share (Android APK),
 * Web Share API (Level 2 with File support), or falls back to nativeService.shareContent.
 */
export async function shareExpenseExport(options: {
  filename: string;
  content: string | Uint8Array;
  mimeType: string;
  title: string;
  text?: string;
}): Promise<boolean> {
  const { filename, content, mimeType, title, text } = options;

  // 1. Native Android APK Share with file URL
  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = toBase64(content);
      const res = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true,
      });
      await Share.share({
        title,
        text: text || title,
        url: res.uri,
        files: [res.uri],
        dialogTitle: title,
      });
      return true;
    } catch (nativeErr) {
      console.warn('[EXPORT] Native share file failed, attempting Web Share fallback:', nativeErr);
    }
  }

  // 2. Try Web Share API Level 2 with File attachment
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

  // 3. Fallback to text content sharing via nativeService / standard share
  const fallbackText =
    typeof content === 'string'
      ? `${title}\n\n${content.slice(0, 1000)}...`
      : `${title}\n\nExported Excel file: ${filename}`;

  return nativeService.shareContent({
    title,
    text: text || fallbackText,
  });
}
