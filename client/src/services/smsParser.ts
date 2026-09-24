import { ExpenseCategory, ParsedSmsTransaction } from '../types';

/**
 * Normalizes merchant names by cleaning trailing punctuation, stop words,
 * and normalizing uppercase bank strings.
 */
function cleanMerchantName(raw: string): string {
  if (!raw) return '';

  let cleaned = raw
    .trim()
    .replace(/^[\s,.\-_:;]+|[\s,.\-_:;]+$/g, '')
    // Strip trailing reference, date, or balance noise
    .replace(/\s+(?:on|via|ref|upi|avl|bal|using|dated|rrn|txn|imps|neft|to|at)\b.*$/i, '')
    .replace(/\s+(?:A\/c|card|ending|\*+|xx+).*$/i, '')
    .trim();

  // Strip excessive whitespace
  cleaned = cleaned.replace(/\s+/g, ' ');

  // Clean VPA handles like xyz@okaxis -> xyz
  if (cleaned.includes('@')) {
    const handleMatch = cleaned.match(/^([A-Za-z0-9._\-]+)@/);
    if (handleMatch && handleMatch[1]) {
      cleaned = handleMatch[1];
    }
  }

  // Capitalize nicely if all uppercase
  if (cleaned === cleaned.toUpperCase() && cleaned.length > 2) {
    cleaned = cleaned
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  return cleaned || 'Bank Transaction';
}

/**
 * Automatically infers the most relevant ExpenseCategory based on the merchant,
 * payee, or SMS keywords.
 */
export function inferExpenseCategory(text: string, merchant: string = ''): ExpenseCategory {
  const combined = `${merchant} ${text}`.toLowerCase();

  // Groceries & Quick Commerce
  if (
    /\b(zepto|blinkit|instamart|bigbasket|dmart|supermarket|grocery|groceries|kirana|provision|nature'?s basket|spencers|more retail)\b/i.test(
      combined
    )
  ) {
    return 'Groceries & Food';
  }

  // Food & Dining / Snacks & Coffee
  if (
    /\b(starbucks|cafe|coffee|chai|tea stall|chaayos|blue tokai|barista|ccd|costa)\b/i.test(combined)
  ) {
    return 'Snacks & Coffee';
  }

  if (
    /\b(swiggy|zomato|mcdonald|kfc|dominos|pizza|burger|restaurant|dine|dining|eats|bakery|barbeque|bistro|dhaba|subway|biryani|kitchen)\b/i.test(
      combined
    )
  ) {
    return 'Dining Out';
  }

  // Transportation & Commute
  if (
    /\b(uber|ola|rapido|metro|petrol|fuel|diesel|cng|indian oil|bharat petroleum|hpcl|shell|fastag|toll|parking|taxi|transit|cab)\b/i.test(
      combined
    )
  ) {
    return 'Taxi & Transit';
  }

  // Travel (Flights, Trains, Hotels)
  if (
    /\b(irctc|railways|redbus|bus|train|flight|airline|indigo|air india|vistara|spicejet|makemytrip|goibibo|cleartrip|yatra|hotel|resort|airbnb|booking\.com)\b/i.test(
      combined
    )
  ) {
    return 'Travel & Leisure';
  }

  // Shopping & E-Commerce
  if (
    /\b(amazon|flipkart|myntra|meesho|ajio|zara|h&m|nykaa|retail|store|mall|croma|reliance digital|decathlon|uniqlo|lenskart|tata cliq)\b/i.test(
      combined
    )
  ) {
    return 'Shopping & Retail';
  }

  // Utilities & Bills
  if (
    /\b(electricity|water bill|gas bill|bescom|mseb|adani electricity|airtel|jio|vi|broadband|wifi|recharge|dth|tata play|dish tv|bill payment|bbps|cylinder)\b/i.test(
      combined
    )
  ) {
    return 'Bills & Utilities';
  }

  // Subscriptions & Tech
  if (
    /\b(netflix|spotify|prime video|hotstar|youtube|apple\.com|google play|openai|chatgpt|github|aws|domain|hosting)\b/i.test(
      combined
    )
  ) {
    return 'Tech & Subscriptions';
  }

  // Entertainment
  if (
    /\b(bookmyshow|pvr|inox|cinema|movie|steam|sonyliv|zee5|disney|playstation|game)\b/i.test(
      combined
    )
  ) {
    return 'Entertainment';
  }

  // Health & Wellness / Pharmacy
  if (
    /\b(apollo|pharmacy|chemist|medplus|practo|netmeds|hospital|clinic|lab|1mg|tata 1mg|pharmeasy|dental|gym|cult\.fit|cult fit|doctor|medicines)\b/i.test(
      combined
    )
  ) {
    return 'Health & Fitness';
  }

  // Education
  if (
    /\b(coursera|udemy|school|college|university|tuition|fees|coaching|books|stationery|exam fee)\b/i.test(
      combined
    )
  ) {
    return 'Education';
  }

  return 'Other';
}

/**
 * Formats a Date or timestamp into YYYY-MM-DD
 */
function formatDateToYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Attempts to parse date strings found in SMS bodies like "23-Sep-26", "23/09/2026", "23-09-26", etc.
 */
function extractDateFromSms(text: string, fallbackTimestamp: number): { date: string; time?: string } {
  const fallbackDate = new Date(fallbackTimestamp || Date.now());
  let date = formatDateToYMD(fallbackDate);
  let time = `${String(fallbackDate.getHours()).padStart(2, '0')}:${String(fallbackDate.getMinutes()).padStart(2, '0')}`;

  // 1. Time match: "14:35:20" or "02:30 PM"
  const timeMatch = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\s*(am|pm)?\b/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const mins = timeMatch[2];
    const meridiem = timeMatch[4]?.toLowerCase();
    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
    time = `${String(hours).padStart(2, '0')}:${mins}`;
  }

  // 2. Date match: "23-Sep-26" or "23-Sep-2026" or "23Sep26"
  const textMonthMatch = text.match(
    /\b(\d{1,2})[-/\s]?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-/\s]?(\d{2,4})\b/i
  );
  if (textMonthMatch) {
    const day = parseInt(textMonthMatch[1], 10);
    const monthStr = textMonthMatch[2].toLowerCase();
    let year = parseInt(textMonthMatch[3], 10);
    if (year < 100) year += 2000;

    const monthMap: Record<string, number> = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11,
    };
    const monthIdx = monthMap[monthStr.slice(0, 3)];
    if (monthIdx !== undefined) {
      const parsedD = new Date(year, monthIdx, day);
      if (!isNaN(parsedD.getTime())) {
        date = formatDateToYMD(parsedD);
      }
    }
  } else {
    // Numeric date match: "23/09/2026" or "23-09-26"
    const numericDateMatch = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
    if (numericDateMatch) {
      const day = parseInt(numericDateMatch[1], 10);
      const month = parseInt(numericDateMatch[2], 10) - 1;
      let year = parseInt(numericDateMatch[3], 10);
      if (year < 100) year += 2000;

      const parsedD = new Date(year, month, day);
      if (!isNaN(parsedD.getTime())) {
        date = formatDateToYMD(parsedD);
      }
    }
  }

  return { date, time };
}

/**
 * Computes a deterministic fingerprint string to identify identical transactions
 * across duplicate SMS deliveries or re-scans.
 */
function computeTransactionFingerprint(
  amount: number,
  type: string,
  date: string,
  merchant: string,
  accountLast4?: string,
  refId?: string
): string {
  const cleanMerchant = merchant.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanRef = (refId || '').trim();
  const cleanAcc = (accountLast4 || '').trim();
  return `sms_${type}_${amount.toFixed(2)}_${date}_${cleanRef || `${cleanMerchant}_${cleanAcc}`}`;
}

/**
 * Main parser: evaluates an SMS message body, identifies whether it is an actual
 * financial transaction, extracts all structured fields, filters out OTPs/ads/spams,
 * and creates a normalized ParsedSmsTransaction object.
 */
export function parseSmsTransaction(
  body: string,
  sender: string = '',
  timestamp: number = Date.now()
): ParsedSmsTransaction {
  const fallbackTime = timestamp || Date.now();
  const { date: defaultDate, time: defaultTime } = extractDateFromSms(body, fallbackTime);

  const baseResult: ParsedSmsTransaction = {
    isTransaction: false,
    type: 'expense',
    amount: 0,
    currency: '₹',
    merchant: '',
    category: 'Other',
    date: defaultDate,
    time: defaultTime,
    rawSms: body,
    sender,
    timestamp: fallbackTime,
    fingerprint: '',
  };

  if (!body || body.trim().length === 0) {
    baseResult.ignoreReason = 'Empty SMS text';
    return baseResult;
  }

  const text = body.trim();
  const lower = text.toLowerCase();

  // --------------------------------------------------------------------------
  // STEP 1: PRE-FILTER & REJECTION (OTPs, Ads, Spam, Upcoming Due Reminders)
  // --------------------------------------------------------------------------

  // Reject OTP and authentication codes
  if (
    (/\b(otp|one time password|verification code|security code)\b/i.test(lower) &&
      /\b(do not share|valid for|is your|use this|secret code|to authenticate)\b/i.test(lower)) ||
    lower.includes('is your one time password') ||
    lower.includes('is your verification code')
  ) {
    baseResult.ignoreReason = 'Authentication OTP / Security Code';
    return baseResult;
  }

  // Reject promotional ads & loan pre-approvals
  if (
    /\b(pre-approved loan|instant loan|apply for credit card|apply now|win cash|cashback offer|flat \d+% off|limited period offer|upgrade your card|congratulations! you won)\b/i.test(
      lower
    ) &&
    !/\b(debited|credited|spent|withdrawn)\b/i.test(lower)
  ) {
    baseResult.ignoreReason = 'Promotional / Marketing Offer';
    return baseResult;
  }

  // Reject upcoming bill payment reminders (NOT yet paid)
  if (
    /\b(bill of rs\.?|bill amount of|due date|pay before|pay your bill|bill generated)\b/i.test(lower) &&
    /\b(is due on|pay now|avoid late fee|minimum amount due)\b/i.test(lower) &&
    !/\b(thank you for paying|payment received|has been debited|paid successfully)\b/i.test(lower)
  ) {
    baseResult.ignoreReason = 'Upcoming Bill Due Reminder (Unpaid)';
    return baseResult;
  }

  // Reject telecom pack expiration / data quota alerts
  if (
    /\b(data pack|recharge plan|pack expires|data balance|daily quota|validity expires)\b/i.test(lower) &&
    !/\b(debited|payment of rs)\b/i.test(lower)
  ) {
    baseResult.ignoreReason = 'Telecom Service / Quota Notice';
    return baseResult;
  }

  // Reject failed / declined transactions
  if (
    /\b(declined|transaction failed|payment failed|unsuccessful|failed due to|insufficient balance)\b/i.test(
      lower
    )
  ) {
    baseResult.ignoreReason = 'Transaction was declined or failed';
    return baseResult;
  }

  // --------------------------------------------------------------------------
  // STEP 2: TRANSACTION TYPE IDENTIFICATION (Debit / Expense vs Credit / Income)
  // --------------------------------------------------------------------------

  const isDebit =
    /\b(debited|debited by|paid|spent|withdrawn|transferred to|sent to|purchase of|purchase at|charged|deducted|used at|txn of|payment of|dr to|vpa debit|pos txn|atm wdl)\b/i.test(
      lower
    );

  const isCredit =
    /\b(credited|credited to|credited with|received|deposited|refund of|cashback of|cr to)\b/i.test(
      lower
    );

  if (!isDebit && !isCredit) {
    baseResult.ignoreReason = 'No financial transaction verb found';
    return baseResult;
  }

  const transactionType: 'expense' | 'income' = isCredit && !isDebit ? 'income' : 'expense';

  // --------------------------------------------------------------------------
  // STEP 3: AMOUNT & CURRENCY EXTRACTION
  // --------------------------------------------------------------------------

  let amount = 0;
  let currency = '₹';

  // Pattern A: "Rs. 450.00", "INR 1,200", "₹500", "USD 25.50", "AED 100"
  const amountPrefixMatch = text.match(
    /(?:rs\.?|inr|₹|\$|usd|eur|€|gbp|£|aed)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i
  );

  // Pattern B: "450.00 Rs", "1200 INR", "500 rupees"
  const amountSuffixMatch = text.match(
    /\b([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:rs\.?|inr|₹|rupees)\b/i
  );

  // Pattern C: Bare amount following transaction verbs like "debited by 1200.00", "credited with 45000"
  const bareAmountMatch = text.match(
    /\b(?:debited\s+by|debited\s+for|credited\s+by|credited\s+with|spent|withdrawn|amount\s+of|dr\s+by|cr\s+by)\s+([0-9,]+(?:\.[0-9]{1,2})?)/i
  );

  if (amountPrefixMatch && amountPrefixMatch[1]) {
    const rawNum = amountPrefixMatch[1].replace(/,/g, '');
    amount = parseFloat(rawNum);
    if (/[$]|usd/i.test(amountPrefixMatch[0])) currency = '$';
    else if (/[€]|eur/i.test(amountPrefixMatch[0])) currency = '€';
    else if (/[£]|gbp/i.test(amountPrefixMatch[0])) currency = '£';
    else if (/aed/i.test(amountPrefixMatch[0])) currency = 'AED';
    else currency = '₹';
  } else if (amountSuffixMatch && amountSuffixMatch[1]) {
    const rawNum = amountSuffixMatch[1].replace(/,/g, '');
    amount = parseFloat(rawNum);
    currency = '₹';
  } else if (bareAmountMatch && bareAmountMatch[1]) {
    const rawNum = bareAmountMatch[1].replace(/,/g, '');
    amount = parseFloat(rawNum);
    currency = '₹';
  }

  // Sanity check on amount
  if (isNaN(amount) || amount <= 0) {
    baseResult.ignoreReason = 'No valid transaction amount extracted';
    return baseResult;
  }

  // --------------------------------------------------------------------------
  // STEP 4: BANK, ACCOUNT & CARD EXTRACTION
  // --------------------------------------------------------------------------

  let bankOrAccount: string | undefined;
  let accountLast4: string | undefined;

  // Account last digits: "A/c **1234", "account ending with 4567", "A/C 9876"
  const accMatch = text.match(/\b(?:a\/c|acct|account)\s*(?:no\.?)?\s*(?:ending\s*)?[xX*]*(\d{3,5})\b/i);
  if (accMatch) {
    accountLast4 = accMatch[1];
  }

  // Card last digits: "Card ending 4412", "Card XX2004", "Card **9012"
  const cardMatch = text.match(/\bcard\s*(?:ending\s*)?[xX*]*(\d{4})\b/i);
  if (cardMatch) {
    accountLast4 = cardMatch[1];
  }

  // Bank name extraction from sender or body
  const knownBanks = [
    { name: 'HDFC Bank', test: /(hdfc|hdfcbk)/i },
    { name: 'State Bank of India', test: /(sbi|sbiinb|sbiupi)/i },
    { name: 'ICICI Bank', test: /(icici|icicib|icicit)/i },
    { name: 'Axis Bank', test: /(axis|axisbk)/i },
    { name: 'Union Bank of India', test: /(unionb|union\s*bank)/i },
    { name: 'IRCTC', test: /(irctc|irctci)/i },
    { name: 'Kotak Bank', test: /(kotak|kotakb)/i },
    { name: 'Punjab National Bank', test: /(pnb|pnbsms)/i },
    { name: 'Bank of Baroda', test: /(bob|baroda)/i },
    { name: 'IDFC FIRST Bank', test: /(idfc)/i },
    { name: 'IndusInd Bank', test: /(indusind)/i },
    { name: 'Yes Bank', test: /(yes\s*bank)/i },
    { name: 'Canara Bank', test: /(canara)/i },
    { name: 'Standard Chartered', test: /(scb|standard\s*chartered)/i },
    { name: 'Citi Bank', test: /(citi|citibank)/i },
    { name: 'Chase Bank', test: /(chase)/i },
    { name: 'American Express', test: /\b(amex|american\s*express)\b/i },
    { name: 'Paytm Payments Bank', test: /\b(paytm)\b/i },
    { name: 'PhonePe', test: /\b(phonepe)\b/i },
    { name: 'Google Pay', test: /\b(gpay|google\s*pay)\b/i },
    { name: 'CRED', test: /\b(cred)\b/i },
  ];

  const matchedBank = knownBanks.find((b) => b.test.test(sender) || b.test.test(text));
  if (matchedBank) {
    bankOrAccount = matchedBank.name;
    if (accountLast4) {
      bankOrAccount += cardMatch ? ` (Card *${accountLast4})` : ` (A/c *${accountLast4})`;
    }
  } else if (accountLast4) {
    bankOrAccount = cardMatch ? `Card *${accountLast4}` : `A/c *${accountLast4}`;
  }

  // --------------------------------------------------------------------------
  // STEP 5: REFERENCE ID & UPI EXTRACTION
  // --------------------------------------------------------------------------

  let referenceId: string | undefined;
  const refMatch = text.match(
    /\b(?:upi\s*(?:ref|txn|reference|id|no)|ref(?:\s+no)?|rrn|txn\s+id|transaction\s+id|imps\s+ref)\s*[:#\s]*([A-Za-z0-9_-]{5,})\b/i
  ) || text.match(/\bupi[:#\s]+([A-Za-z0-9_-]{5,})\b/i);
  if (refMatch && refMatch[1] && refMatch[1].length >= 4) {
    referenceId = refMatch[1];
  }

  // --------------------------------------------------------------------------
  // STEP 6: PAYMENT METHOD DETECTION
  // --------------------------------------------------------------------------

  let paymentMethod = 'Bank Transfer';
  if (/\b(upi|vpa|gpay|phonepe|paytm upi)\b/i.test(lower)) {
    paymentMethod = 'UPI';
  } else if (/\b(debit\s*card|atm)\b/i.test(lower)) {
    paymentMethod = 'Debit Card';
  } else if (/\b(credit\s*card)\b/i.test(lower) || cardMatch) {
    paymentMethod = 'Credit Card';
  } else if (/\b(net\s*banking|netbanking|imps|neft|rtgs)\b/i.test(lower)) {
    paymentMethod = 'Net Banking';
  } else if (/\b(wallet)\b/i.test(lower)) {
    paymentMethod = 'Digital Wallet';
  }

  // --------------------------------------------------------------------------
  // STEP 7: MERCHANT / PAYEE EXTRACTION
  // --------------------------------------------------------------------------

  let rawMerchant = '';

  // Case A: ATM cash withdrawal
  if (/\b(atm|cash withdrawal|atm wdl)\b/i.test(lower)) {
    rawMerchant = 'ATM Cash Withdrawal';
  } else if (transactionType === 'income') {
    // Income credit: "by Salary", "from Zomato Refund", "deposited by Client"
    const fromMatch = text.match(/\b(?:from|by)\s+([A-Za-z0-9\s._@\-]+?)(?:\s+(?:on|via|ref|upi|avl|bal|\.|\n|$))/i);
    rawMerchant = fromMatch ? `${fromMatch[1]} Refund/Deposit` : 'Income Deposit';
  } else {
    // Debit merchant patterns
    const merchantPatterns = [
      /\b(?:paid to|transfer to|transferred to|sent to)\s+([A-Za-z0-9\s._@\-]+?)(?:\s+(?:via|on|ref|using|upi|dated|rrn|avl|\.|\n|$))/i,
      /\b(?:towards|for)\s+(?:vpa\s+)?([A-Za-z0-9\s._@\-]+?)(?:\s+(?:via|on|ref|using|upi|dated|rrn|avl|bal|\(|\.|\n|$))/i,
      /\bat\s+([A-Za-z0-9\s&'.-]+?)(?:\s+(?:on|via|ref|using|upi|dated|rrn|avl|bal|\.|\n|$))/i,
      /\b(?:purchase at|purchase of [A-Za-z0-9.]+\s+at|used at)\s+([A-Za-z0-9\s._@\-]+?)(?:\s+(?:on|via|ref|using|upi|dated|rrn|avl|\.|\n|$))/i,
      /\b(?:to|vpa)\s+([A-Za-z0-9\s._@\-]+?)(?:\s+(?:on|via|ref|using|upi|dated|rrn|avl|bal|\.|\n|$))/i,
      /\binfo:\s*([A-Za-z0-9\s._@\-]+?)(?:\s+(?:on|via|ref|\.|\n|$))/i,
    ];

    for (const pat of merchantPatterns) {
      const match = text.match(pat);
      if (match && match[1]) {
        const candidate = cleanMerchantName(match[1].trim());
        if (
          candidate &&
          candidate.length >= 2 &&
          !/^(card|a\/c|account|debit|credit|bank|atm|inr|rs)/i.test(candidate)
        ) {
          rawMerchant = candidate;
          break;
        }
      }
    }
  }

  // Clean merchant name
  let merchant = cleanMerchantName(rawMerchant);

  // If merchant extraction yielded generic noise or nothing, try sender or fallback
  if (!merchant || /^(bank|transaction|account|card|upi|rs|inr)$/i.test(merchant)) {
    // If sender is a TRAI Service Header like "VM-IRCTCi-S", extract entity "IRCTC"
    const traiMatch = sender.match(/^[A-Za-z]{2}-([A-Za-z0-9]+)-[sS]$/);
    if (traiMatch && !/^(bank|sms|alert|txn|otp|info)/i.test(traiMatch[1])) {
      const entity = traiMatch[1];
      if (/irctc/i.test(entity)) {
        merchant = 'IRCTC';
      } else if (!/(sbi|hdfc|icici|axis|kotak|pnb|bob|idfc|canara|unionb)/i.test(entity)) {
        merchant = cleanMerchantName(entity);
      }
    }

    if (!merchant || /^(bank|transaction|account|card|upi|rs|inr)$/i.test(merchant)) {
      if (sender && !/^(bank|sms|alert|txn|otp|info|vm-|vk-|bz-|ad-|ax-|id-)/i.test(sender)) {
        merchant = cleanMerchantName(sender);
      } else {
        merchant = paymentMethod === 'UPI' ? 'UPI Payment' : `${paymentMethod} Expense`;
      }
    }
  }

  // --------------------------------------------------------------------------
  // STEP 8: CATEGORY & DATE EXTRACTION
  // --------------------------------------------------------------------------

  const category = inferExpenseCategory(text, merchant);
  const { date, time } = extractDateFromSms(text, fallbackTime);

  // Compute deterministic fingerprint
  const fingerprint = computeTransactionFingerprint(
    amount,
    transactionType,
    date,
    merchant,
    accountLast4,
    referenceId
  );

  return {
    isTransaction: true,
    type: transactionType,
    amount,
    currency,
    merchant,
    category,
    paymentMethod,
    bankOrAccount,
    accountLast4,
    referenceId,
    date,
    time,
    rawSms: text,
    sender,
    timestamp: fallbackTime,
    fingerprint,
  };
}
