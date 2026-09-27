import { ExpenseCategory, ExpenseItem } from '../../types';
import { inferExpenseCategory } from '../commandMappingService';

export interface CreateExpenseIntent {
  intent: 'CREATE_EXPENSE';
  isValid: boolean;
  amount: number;
  currency: string;
  category?: string;
  merchant?: string | null;
  payee?: string | null;
  date?: string;
  time?: string;
  account?: string;
  notes?: string;
  source?: 'ai' | 'voice' | 'manual' | 'sms_auto';
  needsClarification?: boolean;
  clarificationPrompt?: string;
  error?: string;
}

const ACTION_VERBS = new Set([
  'add',
  'log',
  'record',
  'save',
  'create',
  'enter',
  'track',
  'spend',
  'spent',
  'paid',
]);

const CATEGORY_KEYWORDS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  brunch: 'Brunch',
  food: 'Dining Out',
  dining: 'Dining Out',
  groceries: 'Groceries',
  grocery: 'Groceries',
  coffee: 'Coffee',
  tea: 'Tea',
  chai: 'Tea',
  snacks: 'Snacks',
  snack: 'Snacks',
  cab: 'Taxi & Transit',
  taxi: 'Taxi & Transit',
  uber: 'Taxi & Transit',
  ola: 'Taxi & Transit',
  rapido: 'Taxi & Transit',
  metro: 'Taxi & Transit',
  bus: 'Taxi & Transit',
  transit: 'Taxi & Transit',
  fuel: 'Fuel',
  petrol: 'Fuel',
  diesel: 'Fuel',
  cng: 'Fuel',
  shopping: 'Shopping',
  clothes: 'Shopping',
  clothing: 'Shopping',
  bills: 'Bills & Utilities',
  bill: 'Bills & Utilities',
  electricity: 'Bills & Utilities',
  water: 'Bills & Utilities',
  gas: 'Bills & Utilities',
  wifi: 'Bills & Utilities',
  internet: 'Bills & Utilities',
  recharge: 'Bills & Utilities',
  mobile: 'Bills & Utilities',
  rent: 'Living & Rent',
  movie: 'Entertainment',
  movies: 'Entertainment',
  cinema: 'Entertainment',
  medicine: 'Health & Fitness',
  medicines: 'Health & Fitness',
  gym: 'Health & Fitness',
  doctor: 'Health & Fitness',
  books: 'Education',
  stationary: 'Education',
  stationery: 'Education',
  subscription: 'Tech & Subscriptions',
};

/**
 * Checks if a string is strictly an action verb that should NEVER become a merchant or title
 */
export function isActionVerb(word: string): boolean {
  if (!word) return false;
  return ACTION_VERBS.has(word.trim().toLowerCase());
}

/**
 * Parses user natural language utterances for expense creation intent.
 * Follows the pipeline:
 * USER UTTERANCE -> INTENT CLASSIFICATION -> STRUCTURED ARGUMENT EXTRACTION -> VALIDATION
 */
export function parseExpenseCommand(input: string): CreateExpenseIntent {
  const text = input.trim();
  const lower = text.toLowerCase();

  // Today's date string YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];

  const result: CreateExpenseIntent = {
    intent: 'CREATE_EXPENSE',
    isValid: false,
    amount: 0,
    currency: 'INR',
    date: todayStr,
    merchant: null,
    payee: null,
  };

  // 1. Identify Action / Intent Words at beginning of utterance
  // e.g. "add 39 rs breakfast", "log ₹250 for lunch", "record 500 for groceries", "spent 150 on coffee"
  const actionMatch = lower.match(
    /^(?:please\s+)?(?:i\s+)?(add|log|record|save|create|enter|track|spend|spent|paid)\b/i
  );
  const actionVerb = actionMatch ? actionMatch[1].toLowerCase() : null;

  // 2. Extract Amount and Currency
  // Look for currency indicators: rs, rs., inr, rupees, ₹, $, etc.
  const amountRegex =
    /(?:(?:rs\.?|inr|rupees|bucks|₹|\$|€|£)\s*)?(\d+(?:,\d+)*(?:\.\d{1,2})?)\s*(?:rs\.?|inr|rupees|bucks)?/i;
  const amountMatch = text.match(amountRegex);

  let amount = 0;
  let amountMatchStr = '';

  if (amountMatch && amountMatch[1]) {
    amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    amountMatchStr = amountMatch[0];
  }

  // If no amount found, check if user said e.g. "add groceries", "log lunch"
  if (isNaN(amount) || amount <= 0) {
    // Strip action verb
    let remainderWithoutAction = text;
    if (actionVerb) {
      remainderWithoutAction = text.replace(new RegExp(`^(?:please\\s+)?(?:i\\s+)?${actionVerb}\\s+`, 'i'), '').trim();
    }
    if (remainderWithoutAction && !isActionVerb(remainderWithoutAction)) {
      result.needsClarification = true;
      result.clarificationPrompt = `How much did you spend on ${remainderWithoutAction}? Please specify an amount (e.g., "Add ₹250 for ${remainderWithoutAction}").`;
      return result;
    }
    result.error = 'No valid amount found in expense command';
    return result;
  }

  result.amount = amount;

  // 3. Remove the action verb and the amount from the text to isolate the remainder
  let remainder = text;

  // Remove leading action verb if present
  if (actionVerb) {
    remainder = remainder.replace(new RegExp(`^(?:please\\s+)?(?:i\\s+)?${actionVerb}\\s+`, 'i'), '').trim();
  }

  // Remove amount match
  if (amountMatchStr) {
    remainder = remainder.replace(amountMatchStr, ' ').trim();
  }

  // Also clean currency residues
  remainder = remainder
    .replace(/\b(?:rs\.?|inr|rupees|bucks|₹|\$|€|£)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 4. Ambiguity Check: If remainder is empty (e.g. "add 100", "Add ₹500.", "log 250")
  if (!remainder) {
    result.needsClarification = true;
    result.clarificationPrompt = `What should I categorize the ₹${amount} expense as?`;
    return result;
  }

  // 5. Semantic Parsing: Distinguish ACTION, MERCHANT, CATEGORY, DATE, ACCOUNT
  // Parse prepositions:
  // "for [Category/Purpose]"
  // "on [Category/Purpose]"
  // "at [Merchant]"
  // "to [Merchant/Payee]"

  let categoryStr: string | undefined;
  let merchantStr: string | null = null;
  let payeeStr: string | null = null;

  // Check for combined: "for breakfast at Starbucks" or "at Starbucks for breakfast"
  const forAtMatch = remainder.match(/^(?:for|on)\s+([^@]+?)\s+at\s+(.+)$/i);
  const atForMatch = remainder.match(/^at\s+(.+?)\s+(?:for|on)\s+([^@]+)$/i);
  const forToMatch = remainder.match(/^(?:for|on)\s+([^@]+?)\s+to\s+(.+)$/i);
  const toForMatch = remainder.match(/^to\s+(.+?)\s+(?:for|on)\s+([^@]+)$/i);

  if (forAtMatch) {
    categoryStr = forAtMatch[1].trim();
    merchantStr = forAtMatch[2].trim();
  } else if (atForMatch) {
    merchantStr = atForMatch[1].trim();
    categoryStr = atForMatch[2].trim();
  } else if (forToMatch) {
    categoryStr = forToMatch[1].trim();
    payeeStr = forToMatch[2].trim();
    merchantStr = payeeStr;
  } else if (toForMatch) {
    payeeStr = toForMatch[1].trim();
    merchantStr = payeeStr;
    categoryStr = toForMatch[2].trim();
  } else {
    // Single preposition checks:
    // "at [Merchant]" -> e.g. "at Starbucks", "at Amazon"
    const atMatch = remainder.match(/^at\s+(.+)$/i);
    // "to [Merchant/Payee]" -> e.g. "to Amazon", "to Rahul"
    const toMatch = remainder.match(/^to\s+(.+)$/i);
    // "for [Category]" or "on [Category]" -> e.g. "for lunch", "for groceries", "on coffee"
    const forMatch = remainder.match(/^(?:for|on|towards)\s+(.+)$/i);

    if (atMatch) {
      merchantStr = atMatch[1].trim();
    } else if (toMatch) {
      payeeStr = toMatch[1].trim();
      merchantStr = payeeStr;
    } else if (forMatch) {
      categoryStr = forMatch[1].trim();
    } else {
      // No explicit prepositions, e.g. "breakfast", "lunch", "groceries", "Starbucks"
      const lowerRem = remainder.toLowerCase();

      // Check if remainder is a known category keyword
      if (CATEGORY_KEYWORDS[lowerRem]) {
        categoryStr = CATEGORY_KEYWORDS[lowerRem];
      } else {
        // If it starts with a known category word followed by merchant, or merchant alone
        const words = lowerRem.split(' ');
        if (words.length === 1 && CATEGORY_KEYWORDS[words[0]]) {
          categoryStr = CATEGORY_KEYWORDS[words[0]];
        } else {
          // If user says "300 Rahul" or "500 to Rahul"
          // If first word is category:
          if (CATEGORY_KEYWORDS[words[0]]) {
            categoryStr = CATEGORY_KEYWORDS[words[0]];
            merchantStr = remainder.slice(words[0].length).trim();
          } else {
            // Check if inferExpenseCategory knows it as a non-other category
            const inferred = inferExpenseCategory(remainder);
            if (inferred !== 'Other') {
              categoryStr = remainder.charAt(0).toUpperCase() + remainder.slice(1);
            } else {
              // Treated as merchant / payee
              merchantStr = remainder;
            }
          }
        }
      }
    }
  }

  // 6. Safeguards: Action verbs must NEVER become merchant or title or category!
  if (merchantStr && isActionVerb(merchantStr)) {
    merchantStr = null;
  }
  if (categoryStr && isActionVerb(categoryStr)) {
    categoryStr = undefined;
  }
  if (payeeStr && isActionVerb(payeeStr)) {
    payeeStr = null;
  }

  // Clean strings
  if (categoryStr) {
    // Normalize casing (Title Case)
    categoryStr =
      CATEGORY_KEYWORDS[categoryStr.toLowerCase()] ||
      categoryStr.charAt(0).toUpperCase() + categoryStr.slice(1);
  }
  if (merchantStr) {
    merchantStr = merchantStr.charAt(0).toUpperCase() + merchantStr.slice(1);
  }
  if (payeeStr) {
    payeeStr = payeeStr.charAt(0).toUpperCase() + payeeStr.slice(1);
  }

  // If user says "add 500 to Rahul", merchant/payee is Rahul, NOT category
  if (payeeStr && !categoryStr) {
    categoryStr = undefined; // Do not classify Rahul as a category unless explicit
  }

  // Final Validation
  result.isValid = true;
  result.category = categoryStr;
  result.merchant = merchantStr;
  result.payee = payeeStr;

  return result;
}

/**
 * Builds a canonical ExpenseItem from a validated CreateExpenseIntent.
 * Guarantees that action verbs never become transaction titles.
 */
export function buildExpenseItemFromIntent(
  intent: CreateExpenseIntent,
  existingAccount?: string
): ExpenseItem {
  // Title / Name determination:
  // If merchant is known: merchant (e.g. "Starbucks", "Amazon", "Rahul")
  // Else if category is known: category (e.g. "Breakfast", "Lunch", "Groceries")
  // Otherwise fallback to "Expense"
  let title = 'Expense';
  if (intent.merchant && !isActionVerb(intent.merchant)) {
    title = intent.merchant;
  } else if (intent.payee && !isActionVerb(intent.payee)) {
    title = intent.payee;
  } else if (intent.category && !isActionVerb(intent.category)) {
    title = intent.category;
  }

  // Never allow action verbs as title
  if (isActionVerb(title)) {
    title = intent.category || 'Expense';
  }

  // Inferred category if none explicitly matched to a canonical ExpenseCategory
  let category: ExpenseCategory | string = intent.category || 'Other';
  if (category && CATEGORY_KEYWORDS[category.toLowerCase()]) {
    category = CATEGORY_KEYWORDS[category.toLowerCase()];
  } else if (title) {
    category = inferExpenseCategory(title);
  }

  const notesParts: string[] = [];
  if (intent.category && intent.merchant && intent.category !== intent.merchant) {
    notesParts.push(`${intent.category} at ${intent.merchant}`);
  }
  if (intent.notes) {
    notesParts.push(intent.notes);
  }

  return {
    id: `exp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: title,
    amount: intent.amount,
    category,
    date: intent.date || new Date().toISOString().split('T')[0],
    time: intent.time,
    merchant: intent.merchant || undefined,
    payee: intent.payee || undefined,
    billingCycle: 'one-time',
    active: true,
    source: (intent.source === 'voice' ? 'ai' : intent.source) || 'ai',
    direction: 'DEBIT',
    transactionType: 'DEBIT',
    bankOrAccount: intent.account || existingAccount,
    notes: notesParts.join(' • ') || undefined,
  };
}
