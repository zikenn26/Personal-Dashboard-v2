import * as XLSX from 'xlsx';
import { ExpenseItem } from '../types';

export interface ParsedSpreadsheetResult {
  fileName: string;
  totalRows: number;
  headersFound: string[];
  columnMapping: {
    dateCol: string;
    amountCol: string;
    categoryCol: string;
    noteCol: string;
    accountCol?: string;
    subCategoryCol?: string;
    typeCol?: string;
  };
  expenses: Array<Omit<ExpenseItem, 'id'>>;
  incomeCount: number;
  skippedCount: number;
  totalAmount: number;
  dateRange: { min: string; max: string } | null;
}

// Map common Money Manager / Indian banking emojis & categories to clean app categories & icons
const CATEGORY_MAP: Record<string, { category: string; icon: string }> = {
  food: { category: 'Food & Dining', icon: '🍽️' },
  dining: { category: 'Food & Dining', icon: '🍽️' },
  restaurant: { category: 'Food & Dining', icon: '🍽️' },
  snack: { category: 'Snacks & Coffee', icon: '☕' },
  snacks: { category: 'Snacks & Coffee', icon: '☕' },
  coffee: { category: 'Snacks & Coffee', icon: '☕' },
  tea: { category: 'Snacks & Coffee', icon: '☕' },
  groceries: { category: 'Groceries', icon: '🛒' },
  grocery: { category: 'Groceries', icon: '🛒' },
  supermarket: { category: 'Groceries', icon: '🛒' },
  transport: { category: 'Transport', icon: '🚕' },
  travel: { category: 'Transport', icon: '✈️' },
  metro: { category: 'Transport', icon: '🚇' },
  cab: { category: 'Transport', icon: '🚖' },
  auto: { category: 'Transport', icon: '🛺' },
  fuel: { category: 'Transport', icon: '⛽' },
  petrol: { category: 'Transport', icon: '⛽' },
  household: { category: 'Bills & Utilities', icon: '🪑' },
  house: { category: 'Bills & Utilities', icon: '🏠' },
  rent: { category: 'Living & Rent', icon: '🏠' },
  bills: { category: 'Bills & Utilities', icon: '⚡' },
  recharge: { category: 'Bills & Utilities', icon: '📱' },
  education: { category: 'Education', icon: '📚' },
  books: { category: 'Education', icon: '📖' },
  study: { category: 'Education', icon: '🎓' },
  exam: { category: 'Education', icon: '📝' },
  'social life': { category: 'Entertainment', icon: '🧑‍🤝‍🧑' },
  social: { category: 'Entertainment', icon: '🧑‍🤝‍🧑' },
  friends: { category: 'Entertainment', icon: '🎉' },
  entertainment: { category: 'Entertainment', icon: '🎬' },
  movies: { category: 'Entertainment', icon: '🍿' },
  beauty: { category: 'Personal Care', icon: '💄' },
  salon: { category: 'Personal Care', icon: '💇' },
  'personal care': { category: 'Personal Care', icon: '🧴' },
  health: { category: 'Health & Fitness', icon: '🧘' },
  medical: { category: 'Health & Fitness', icon: '💊' },
  medicine: { category: 'Health & Fitness', icon: '💊' },
  fitness: { category: 'Health & Fitness', icon: '🏋️' },
  gift: { category: 'Shopping', icon: '🎁' },
  gifts: { category: 'Shopping', icon: '🎁' },
  shopping: { category: 'Shopping', icon: '🛍️' },
  clothes: { category: 'Shopping', icon: '👕' },
  subscriptions: { category: 'Subscriptions', icon: '💻' },
  tech: { category: 'Subscriptions', icon: '💻' },
  other: { category: 'Other', icon: '💳' },
};

/**
 * Smart Date Parser
 * Handles:
 * - DD/MM/YYYY HH:mm:ss (Money Manager default: e.g. 08/09/2026 16:48:25)
 * - DD/MM/YYYY or DD-MM-YYYY
 * - YYYY-MM-DD or YYYY/MM/DD
 * - MM/DD/YYYY
 * - Excel Date Serial numbers (e.g. 45543.69)
 */
export function parseSmartDate(val: unknown): { date: string; time?: string } | null {
  if (val === null || val === undefined || val === '') return null;

  // 1. If it's an Excel Date Serial Number (e.g. 45543)
  if (typeof val === 'number' && val > 20000 && val < 60000) {
    try {
      const parsed = XLSX.SSF.parse_date_code(val);
      if (parsed && parsed.y && parsed.m && parsed.d) {
        const yStr = String(parsed.y);
        const mStr = String(parsed.m).padStart(2, '0');
        const dStr = String(parsed.d).padStart(2, '0');
        const timeStr = parsed.H !== undefined ? `${String(parsed.H).padStart(2, '0')}:${String(parsed.M || 0).padStart(2, '0')}` : undefined;
        return { date: `${yStr}-${mStr}-${dStr}`, time: timeStr };
      }
    } catch {
      // Fallback
    }
    const msSince1900 = (val - 25569) * 86400 * 1000;
    const d = new Date(msSince1900);
    if (!isNaN(d.getTime())) {
      return { date: d.toISOString().split('T')[0] };
    }
  }

  // 2. If it's already a JS Date object
  if (val instanceof Date && !isNaN(val.getTime())) {
    const yStr = val.getFullYear();
    const mStr = String(val.getMonth() + 1).padStart(2, '0');
    const dStr = String(val.getDate()).padStart(2, '0');
    const timeStr = `${String(val.getHours()).padStart(2, '0')}:${String(val.getMinutes()).padStart(2, '0')}`;
    return { date: `${yStr}-${mStr}-${dStr}`, time: timeStr };
  }

  const str = String(val).trim();
  if (!str) return null;

  // 3. Match DD/MM/YYYY or DD-MM-YYYY with optional time
  // e.g. "08/09/2026 16:48:25" or "08/09/2026" or "8/9/2026"
  const ddmmyyyyMatch = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1], 10);
    const month = parseInt(ddmmyyyyMatch[2], 10);
    const year = parseInt(ddmmyyyyMatch[3], 10);

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const yStr = String(year);
      const mStr = String(month).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      const timeStr = ddmmyyyyMatch[4] !== undefined ? `${String(ddmmyyyyMatch[4]).padStart(2, '0')}:${String(ddmmyyyyMatch[5] || '00').padStart(2, '0')}` : undefined;
      return { date: `${yStr}-${mStr}-${dStr}`, time: timeStr };
    }
  }

  // 4. Match YYYY-MM-DD or YYYY/MM/DD
  const yyyymmddMatch = str.match(/^(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?/);
  if (yyyymmddMatch) {
    const year = parseInt(yyyymmddMatch[1], 10);
    const month = parseInt(yyyymmddMatch[2], 10);
    const day = parseInt(yyyymmddMatch[3], 10);

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const yStr = String(year);
      const mStr = String(month).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      const timeStr = yyyymmddMatch[4] !== undefined ? `${String(yyyymmddMatch[4]).padStart(2, '0')}:${String(yyyymmddMatch[5] || '00').padStart(2, '0')}` : undefined;
      return { date: `${yStr}-${mStr}-${dStr}`, time: timeStr };
    }
  }

  // 5. Fallback to standard JavaScript Date parser
  const parsedTimestamp = Date.parse(str);
  if (!isNaN(parsedTimestamp)) {
    const d = new Date(parsedTimestamp);
    const yStr = d.getFullYear();
    const mStr = String(d.getMonth() + 1).padStart(2, '0');
    const dStr = String(d.getDate()).padStart(2, '0');
    return { date: `${yStr}-${mStr}-${dStr}` };
  }

  return null;
}

/**
 * Clean and normalize Category and Emoji
 * E.g. "🍜 Food" -> category "Food & Dining", icon "🍜"
 * E.g. "📙 Education" -> category "Education", icon "📙"
 */
export function parseCategoryAndEmoji(rawCategory: string): { category: string; icon: string; rawClean: string } {
  const str = (rawCategory || '').trim();
  if (!str) {
    return { category: 'Other', icon: '💳', rawClean: 'Other' };
  }

  // Extract leading emoji if present
  // Regex matches extended emoji characters
  const emojiMatch = str.match(/^([\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D\s]+)/u);
  const leadingEmoji = emojiMatch ? emojiMatch[1].trim() : '';

  // Clean the text without the leading emoji
  const cleanText = str
    .replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, '')
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D]+/gu, '')
    .trim();

  const searchKey = cleanText.toLowerCase();

  // Try direct lookup
  if (CATEGORY_MAP[searchKey]) {
    return {
      category: CATEGORY_MAP[searchKey].category,
      icon: leadingEmoji || CATEGORY_MAP[searchKey].icon,
      rawClean: cleanText || str,
    };
  }

  // Try partial lookup
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (searchKey.includes(key) || key.includes(searchKey)) {
      return {
        category: val.category,
        icon: leadingEmoji || val.icon,
        rawClean: cleanText || str,
      };
    }
  }

  // Default fallback: keep the clean text as the category name!
  const finalCat = cleanText || str || 'Other';
  return {
    category: finalCat,
    icon: leadingEmoji || '💳',
    rawClean: finalCat,
  };
}

/**
 * Smart Amount Parser
 * Strips currency symbols (₹, $, Rs), commas, and handles decimals
 */
export function parseSmartAmount(val: unknown): number | null {
  if (typeof val === 'number') {
    return isNaN(val) ? null : Math.abs(val);
  }
  if (!val) return null;

  const str = String(val)
    .replace(/[₹$€£\s,Rs\.]/gi, (match) => (match === '.' ? '.' : ''))
    .trim();

  // Re-check if valid decimal
  const cleanStr = String(val).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleanStr);
  if (isNaN(parsed) || parsed === 0) return null;
  return Math.abs(parsed);
}

/**
 * Main parser function: Reads Excel/CSV ArrayBuffer, detects headers, maps columns,
 * and extracts clean ExpenseItems.
 */
export async function parseExpensesFromExcel(
  data: ArrayBuffer,
  fileName: string,
  batchId: string = `batch_${Date.now()}`
): Promise<ParsedSpreadsheetResult> {
  // Suppress benign SheetJS ZIP parser console.error warnings (e.g. "Bad uncompressed size: ... != 0")
  // that occur on valid streaming XLSX exports where local file header sizes are 0
  const origConsoleError = console.error;
  let workbook: XLSX.WorkBook;
  try {
    console.error = (...args: unknown[]) => {
      const msg = typeof args[0] === 'string' ? args[0] : '';
      if (
        msg.includes('Bad uncompressed size') ||
        msg.includes('Bad compressed size') ||
        msg.includes('Bad CRC32 checksum')
      ) {
        // Harmless streaming ZIP data descriptor notice, ignore
        return;
      }
      origConsoleError.apply(console, args);
    };

    workbook = XLSX.read(data, {
      type: 'array',
      cellDates: true,
    });
  } finally {
    console.error = origConsoleError;
  }

  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) {
    throw new Error('No worksheets found in the uploaded file.');
  }

  // Convert to array of arrays
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });

  if (rawRows.length === 0) {
    throw new Error('Spreadsheet appears to be completely empty.');
  }

  // 1. Locate the header row (typically row 0 or row 1)
  let headerRowIndex = 0;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    const row = rawRows[i] as unknown[];
    const rowStrings = row.map((cell) => String(cell || '').trim());
    const rowCombined = rowStrings.join(' ').toLowerCase();

    // Check if row has hallmarks of Money Manager or financial headers
    const hasDate = rowCombined.includes('date') || rowCombined.includes('time');
    const hasCategory = rowCombined.includes('category');
    const hasAmount = rowCombined.includes('inr') || rowCombined.includes('amount') || rowCombined.includes('price') || rowCombined.includes('debit') || rowCombined.includes('rs');
    const hasNote = rowCombined.includes('note') || rowCombined.includes('description') || rowCombined.includes('merchant');

    if ((hasDate && hasCategory) || (hasDate && hasAmount) || (hasCategory && hasAmount) || (hasDate && hasNote)) {
      headerRowIndex = i;
      headers = rowStrings;
      break;
    }
  }

  // If no clear header found, use the first row
  if (headers.length === 0) {
    headers = (rawRows[0] as unknown[]).map((cell) => String(cell || '').trim());
  }

  // 2. Identify Column Indices
  let dateColIdx = -1;
  let accountColIdx = -1;
  let categoryColIdx = -1;
  let subCategoryColIdx = -1;
  let noteColIdx = -1;
  let amountColIdx = -1;
  let typeColIdx = -1;

  headers.forEach((h, idx) => {
    const colName = h.toLowerCase().trim();
    if (!colName) return;

    if (dateColIdx === -1 && /date|time|timestamp|period/i.test(colName)) {
      dateColIdx = idx;
    } else if (typeColIdx === -1 && /income\/expense|income.*expense|flow|i\/e|trans.*type|^type$/i.test(colName)) {
      typeColIdx = idx;
    } else if (subCategoryColIdx === -1 && /sub.*cat/i.test(colName)) {
      subCategoryColIdx = idx;
    } else if (categoryColIdx === -1 && /category|^cat$|group/i.test(colName)) {
      categoryColIdx = idx;
    } else if (noteColIdx === -1 && /note|desc|merchant|item|title|detail|remark|payee|narration/i.test(colName)) {
      noteColIdx = idx;
    } else if (amountColIdx === -1 && /inr|amount|price|cost|total|debit|rs|rupee|expense$/i.test(colName)) {
      // Don't mistake "Income/Expense" for amount
      if (!colName.includes('income')) {
        amountColIdx = idx;
      }
    } else if (accountColIdx === -1 && /account|payment|method|wallet|mode|source|bank/i.test(colName)) {
      accountColIdx = idx;
    }
  });

  // Fallback defaults matching Money Manager export standard:
  // Col 0: Date, Col 1: Account, Col 2: Category, Col 3: Subcategory, Col 4: Note, Col 5: INR, Col 6: Income/Expense
  if (dateColIdx === -1 && headers.length > 0) dateColIdx = 0;
  if (amountColIdx === -1) {
    // Look for column with numeric values in sample rows
    for (let col = 0; col < headers.length; col++) {
      if (col === dateColIdx) continue;
      const sampleVal = rawRows[headerRowIndex + 1]?.[col];
      if (parseSmartAmount(sampleVal) !== null) {
        amountColIdx = col;
        break;
      }
    }
  }
  if (categoryColIdx === -1 && headers.length > 2) categoryColIdx = 2;
  if (noteColIdx === -1 && headers.length > 4) noteColIdx = 4;

  const dataRows = rawRows.slice(headerRowIndex + 1);
  const expenses: Array<Omit<ExpenseItem, 'id'>> = [];
  let incomeCount = 0;
  let skippedCount = 0;
  let totalAmount = 0;
  let minDate = '';
  let maxDate = '';

  for (let rIdx = 0; rIdx < dataRows.length; rIdx++) {
    const row = dataRows[rIdx] as unknown[];
    if (!row || row.length === 0) continue;

    // Check Income/Expense column if present
    if (typeColIdx !== -1) {
      const typeVal = String(row[typeColIdx] || '').trim().toLowerCase();
      if (typeVal.includes('income')) {
        incomeCount++;
        continue; // Skip income rows since this is the spending/expense tracker
      }
    }

    // Parse Amount
    const rawAmount = amountColIdx !== -1 ? row[amountColIdx] : null;
    const amount = parseSmartAmount(rawAmount);
    if (amount === null || amount <= 0) {
      skippedCount++;
      continue;
    }

    // Parse Date
    const rawDate = dateColIdx !== -1 ? row[dateColIdx] : null;
    const dateParsed = parseSmartDate(rawDate);
    const date = dateParsed ? dateParsed.date : new Date().toISOString().split('T')[0];

    // Track min / max date
    if (!minDate || date < minDate) minDate = date;
    if (!maxDate || date > maxDate) maxDate = date;

    // Parse Category & Icon
    const rawCategory = categoryColIdx !== -1 ? String(row[categoryColIdx] || '') : '';
    const { category, icon, rawClean } = parseCategoryAndEmoji(rawCategory);

    // Parse Note / Description / Merchant
    const rawNote = noteColIdx !== -1 ? String(row[noteColIdx] || '').trim() : '';
    const rawSubCat = subCategoryColIdx !== -1 ? String(row[subCategoryColIdx] || '').trim() : '';
    const rawAccount = accountColIdx !== -1 ? String(row[accountColIdx] || '').trim() : '';

    // Smart name resolution:
    // If note is present ("Hunger box", "Instamart", "Flipkart books", "Rent") -> use Note
    // If note is blank -> use Subcategory, else Category
    let expenseName = rawNote;
    if (!expenseName) {
      expenseName = rawSubCat || rawClean || category || 'Expense';
    }

    // Compose extra notes if subcategory or account is present
    const noteParts: string[] = [];
    if (rawNote && (rawSubCat || rawClean !== category)) {
      if (rawSubCat) noteParts.push(`Subcat: ${rawSubCat}`);
      if (rawClean && rawClean !== category) noteParts.push(`Type: ${rawClean}`);
    }
    if (rawAccount && rawAccount.toLowerCase() !== 'accounts') {
      noteParts.push(`Account: ${rawAccount}`);
    }
    if (dateParsed?.time) {
      noteParts.push(`Time: ${dateParsed.time}`);
    }

    // Payment method mapping
    let paymentMethod = 'Other';
    if (rawAccount) {
      const accLower = rawAccount.toLowerCase();
      if (accLower.includes('cash')) paymentMethod = 'Cash';
      else if (accLower.includes('card') || accLower.includes('credit')) paymentMethod = 'Credit Card';
      else if (accLower.includes('debit')) paymentMethod = 'Debit Card';
      else if (accLower.includes('upi') || accLower.includes('gpay') || accLower.includes('phonepe') || accLower.includes('paytm')) paymentMethod = 'Apple / Google Pay';
      else if (accLower.includes('bank') || accLower.includes('account')) paymentMethod = 'Bank Transfer';
    }

    totalAmount += amount;

    expenses.push({
      name: expenseName,
      amount: Math.round(amount * 100) / 100,
      category,
      date,
      paymentMethod,
      icon,
      notes: noteParts.length > 0 ? noteParts.join(' • ') : undefined,
      billingCycle: 'one-time',
      active: true,
      sourceFile: fileName,
      importBatchId: batchId,
    });
  }

  return {
    fileName,
    totalRows: dataRows.length,
    headersFound: headers,
    columnMapping: {
      dateCol: headers[dateColIdx] || 'Date',
      amountCol: headers[amountColIdx] || 'Amount/INR',
      categoryCol: headers[categoryColIdx] || 'Category',
      noteCol: headers[noteColIdx] || 'Note',
      accountCol: accountColIdx !== -1 ? headers[accountColIdx] : undefined,
      subCategoryCol: subCategoryColIdx !== -1 ? headers[subCategoryColIdx] : undefined,
      typeCol: typeColIdx !== -1 ? headers[typeColIdx] : undefined,
    },
    expenses,
    incomeCount,
    skippedCount,
    totalAmount: Math.round(totalAmount),
    dateRange: minDate && maxDate ? { min: minDate, max: maxDate } : null,
  };
}
