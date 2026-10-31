/**
 * User Identity and Profile Utilities
 *
 * Implements standard name initials formatting and mock avatar detection.
 * Enforces initials consisting of less than 2 alphabets (max 2 characters).
 * e.g., "Gulshan Kumar Nayak" -> "GK", "Aditya" -> "A".
 */

export function getUserWorkspaceKey(user: { id?: string; email?: string } | null): string {
  if (!user) return 'user_guest';
  if (user.id === 'guest') return 'user_guest';
  // Canonical normalized email-based workspace key guarantees identical partition across all devices (Web, APK, Mobile)
  if (user.email && user.email.includes('@') && user.email !== 'guest@workspace.local') {
    const cleanEmail = user.email.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
    return `user_usr_${cleanEmail}`;
  }
  if (user.id) return `user_${user.id}`;
  return 'user_guest';
}


/**
 * Extracts the user's initials up to 2 alphabets.
 * Examples:
 * - "Gulshan Kumar Nayak" -> "GK"
 * - "Aditya" -> "A"
 * - "Alex Morgan" -> "AM"
 * - "John F. Kennedy" -> "JF"
 * - "" or undefined -> "U"
 */
export function getUserInitials(name?: string | null): string {
  if (!name || typeof name !== 'string') {
    return 'U';
  }

  // Remove leading/trailing whitespace and clean extra spaces
  const cleanName = name.trim();
  if (!cleanName) return 'U';

  // Split into words, filtering out empty items
  const words = cleanName
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z]/g, ''))
    .filter((w) => w.length > 0);

  if (words.length === 0) {
    // If only numbers/symbols were provided, take first alphanumeric character
    const fallbackChar = cleanName.replace(/[^a-zA-Z0-9]/g, '').charAt(0);
    return (fallbackChar || 'U').toUpperCase();
  }

  if (words.length === 1) {
    // Single word: return only 1 alphabet
    return words[0].charAt(0).toUpperCase();
  }

  // Two or more words: take the first letter of the first word and first letter of second word (max 2 characters)
  const first = words[0].charAt(0).toUpperCase();
  const second = words[1].charAt(0).toUpperCase();
  return `${first}${second}`;
}

/**
 * Checks if a given avatar URL is a dummy mock or stock placeholder image
 * that should be suppressed in favor of user initials.
 * Also protects non-Gulshan accounts from inheriting Gulshan's avatar.
 */
export function isDummyMockAvatar(url?: string | null, userEmail?: string | null): boolean {
  if (!url || typeof url !== 'string') return true;
  const trimmed = url.trim();
  if (!trimmed) return true;

  // Detect local stock mock avatar asset
  if (trimmed.includes('avatar_profile_default')) return true;

  // Allow custom data URLs and blob URLs uploaded directly by the user (not a dummy mock)
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('blob:')) {
    return false;
  }

  // Cross-account leakage prevention:
  // An avatar URL containing 'gknayak' or 'gulnayak' belongs strictly to Gulshan Kumar Nayak.
  // It must NEVER be used for any other user, guest, or newly created account.
  let activeEmail = (userEmail || '').toLowerCase().trim();
  if (!activeEmail && typeof window !== 'undefined') {
    try {
      const rawUser = localStorage.getItem('notion_os_auth_user_v1');
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        if (parsed?.email) activeEmail = parsed.email.toLowerCase().trim();
      }
    } catch {}
    if (!activeEmail) {
      try {
        const storedProfile = localStorage.getItem('lifeos_profile_v2');
        if (storedProfile) {
          const parsedProf = JSON.parse(storedProfile);
          if (parsedProf?.contactEmail) activeEmail = parsedProf.contactEmail.toLowerCase().trim();
        }
      } catch {}
    }
  }

  const isGknUser =
    activeEmail === 'gknayak@gmail.com' ||
    activeEmail === 'gknayak';

  // Only reject Gulshan assets if this is an explicitly DIFFERENT authenticated account (e.g. arpitapri125@gmail.com)
  const isDifferentUser = Boolean(
    activeEmail &&
    activeEmail.includes('@') &&
    activeEmail !== 'guest@workspace.local' &&
    !isGknUser
  );

  if (isDifferentUser && (trimmed.includes('gknayak') || trimmed.includes('gulnayak'))) {
    return true;
  }

  // Detect Unsplash headshot placeholder avatars
  if (
    trimmed.includes('photo-1534528741775') ||
    trimmed.includes('photo-1507003211169') ||
    trimmed.includes('photo-1500648767791') ||
    trimmed.includes('photo-1494790108377') ||
    trimmed.includes('photo-1522075469751')
  ) {
    return true;
  }

  // Detect third-party placeholder avatar services
  if (
    trimmed.includes('pravatar.cc') ||
    trimmed.includes('ui-avatars.com') ||
    trimmed.includes('dicebear.com') ||
    trimmed.includes('placeholder.com')
  ) {
    return true;
  }

  return false;
}

/**
 * Validates whether an avatar URL strictly matches the authenticated user's email domain and identity.
 * Clears or rejects cached or local storage avatars if:
 * 1. It is a mock, stock, or placeholder image (Unsplash, DiceBear, Pravatar, etc.).
 * 2. It belongs to another account (e.g. gknayak or gulnayak for any user other than Gulshan).
 * 3. It encodes another username or email domain (e.g. Supabase storage path avatar_<otheruser>_<domain>).
 * 4. Its email domain does not match the authenticated user's email domain.
 */
export function isAvatarMatchingUserEmailDomain(url?: string | null, userEmail?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  let activeEmail = (userEmail || '').toLowerCase().trim();
  if (!activeEmail && typeof window !== 'undefined') {
    try {
      const rawUser = localStorage.getItem('notion_os_auth_user_v1');
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        if (parsed?.email) activeEmail = parsed.email.toLowerCase().trim();
      }
    } catch {}
    if (!activeEmail) {
      try {
        const storedProfile = localStorage.getItem('lifeos_profile_v2');
        if (storedProfile) {
          const parsedProf = JSON.parse(storedProfile);
          if (parsedProf?.contactEmail) activeEmail = parsedProf.contactEmail.toLowerCase().trim();
        }
      } catch {}
    }
  }

  // 1. First run dummy/mock/cross-account check
  if (isDummyMockAvatar(trimmed, activeEmail)) {
    return false;
  }

  // Allow custom data URLs and blob URLs uploaded directly by the user
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('blob:')) {
    return true;
  }

  const isGknUser =
    activeEmail === 'gknayak@gmail.com' ||
    activeEmail === 'gknayak';

  const isDifferentUser = Boolean(
    activeEmail &&
    activeEmail.includes('@') &&
    activeEmail !== 'guest@workspace.local' &&
    !isGknUser
  );

  const lowerUrl = trimmed.toLowerCase();

  // 2. Strict isolation for Gulshan's asset:
  if (isDifferentUser && lowerUrl.includes('gknayak')) {
    return false;
  }

  // If user is Gulshan or guest / default portfolio, Gulshan's authentic avatar is always accepted
  if (!isDifferentUser && lowerUrl.includes('gknayak')) {
    return true;
  }

  if (isGknUser) {
    return true;
  }

  // If no email available, accept if not dummy/mock
  if (!activeEmail || !activeEmail.includes('@')) {
    return true;
  }

  const [userLocalPart, userDomain] = activeEmail.split('@');
  const userDomainSanitized = userDomain.replace(/[^a-z0-9]/g, '_');
  const userLocalSanitized = userLocalPart.replace(/[^a-z0-9]/g, '_');

  // 3. If the URL contains an email domain identifier, ensure it matches the user's domain
  // e.g., avatar_<user>_<domain>_<timestamp>
  if (lowerUrl.includes('avatar_')) {
    const commonDomains = [
      'gmail_com',
      'yahoo_com',
      'outlook_com',
      'hotmail_com',
      'icloud_com',
      'proton_me',
      'workspace_local',
    ];
    for (const d of commonDomains) {
      if (lowerUrl.includes(`_${d}`) && d !== userDomainSanitized) {
        return false;
      }
    }

    // Check if filename specifies a different local user handle
    if (!lowerUrl.includes(userLocalSanitized)) {
      if (lowerUrl.includes('gknayak') || lowerUrl.includes('gulnayak') || lowerUrl.includes('arpitapri125')) {
        return false;
      }
    }
  }

  // 4. If URL has explicit email query param or path like ?email=... or /email/
  if (lowerUrl.includes('@')) {
    if (!lowerUrl.includes(`@${userDomain}`)) {
      return false;
    }
  }

  return true;
}

/**
 * Returns a stable, elegant background color class for user initials avatars
 * based on the user's name.
 */
export function getInitialsColorClass(name?: string | null): {
  bg: string;
  text: string;
  border: string;
} {
  const palettes = [
    {
      bg: 'bg-violet-600 dark:bg-violet-600',
      text: 'text-white',
      border: 'border-violet-400/40',
    },
    {
      bg: 'bg-indigo-600 dark:bg-indigo-600',
      text: 'text-white',
      border: 'border-indigo-400/40',
    },
    {
      bg: 'bg-purple-600 dark:bg-purple-600',
      text: 'text-white',
      border: 'border-purple-400/40',
    },
    {
      bg: 'bg-emerald-600 dark:bg-emerald-600',
      text: 'text-white',
      border: 'border-emerald-400/40',
    },
    {
      bg: 'bg-blue-600 dark:bg-blue-600',
      text: 'text-white',
      border: 'border-blue-400/40',
    },
    {
      bg: 'bg-amber-600 dark:bg-amber-600',
      text: 'text-white',
      border: 'border-amber-400/40',
    },
  ];

  if (!name) return palettes[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % palettes.length;
  return palettes[index];
}

import type { HabitItem, ExpenseItem } from '../types';

// Authoritative Study & Gym habits for primary user Gulshan Kumar Nayak (gknayak@gmail.com)
export const OWNER_GKN_HABITS: HabitItem[] = [
  {
    id: 'hb-1790839137566',
    icon: '🏋️',
    color: '#6366F1',
    title: 'Gym',
    streak: 1,
    category: 'Health & Fitness',
    updatedAt: 1791912673006,
    completedDays: [false, false, false, false, false, false, false],
    completedDates: [
      '2026-10-01',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-12',
      '2026-10-13',
    ],
  },
  {
    id: 'hb-1790936989123-g51jr',
    icon: '📚',
    color: '#10B981',
    title: 'Study',
    streak: 3,
    category: 'Learning',
    updatedAt: 1792578312789,
    completedDays: [false, false, true, false, false, false, false],
    completedDates: [
      '2026-10-01',
      '2026-10-02',
      '2026-10-04',
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-21',
    ],
  },
];

// Authoritative verified expenses for primary user Gulshan Kumar Nayak (gknayak@gmail.com)
export const OWNER_GKN_EXPENSES: ExpenseItem[] = [
  {
    id: 'exp-gkn-001',
    name: 'Swiggy Food Delivery',
    amount: 450,
    category: 'Food & Dining',
    date: '2026-10-24',
    direction: 'DEBIT',
    transactionType: 'expense',
    paymentMethod: 'UPI',
    bankName: 'HDFC Bank',
    maskedAccount: '**4120',
    referenceId: '429384928342',
    upiReference: '429384928342',
    payee: 'SWIGGY',
    source: 'sms_auto',
    active: true,
  },
  {
    id: 'exp-gkn-002',
    name: 'Chaayos Cafe',
    amount: 250,
    category: 'Food & Dining',
    date: '2026-10-24',
    direction: 'DEBIT',
    transactionType: 'expense',
    paymentMethod: 'UPI',
    bankName: 'Kotak Bank',
    maskedAccount: '**3344',
    referenceId: '556677889900',
    upiReference: '556677889900',
    payee: 'CHAAYOS',
    source: 'sms_auto',
    active: true,
  },
  {
    id: 'exp-gkn-003',
    name: 'UPI Transfer to Arpita Priyadar',
    amount: 303,
    category: 'Personal Transfer',
    date: '2026-10-25',
    direction: 'DEBIT',
    transactionType: 'expense',
    paymentMethod: 'UPI',
    bankName: 'ICICI Bank',
    maskedAccount: 'XX070',
    referenceId: '663416590461',
    upiReference: '663416590461',
    payee: 'ARPITA PRIYADAR',
    source: 'sms_auto',
    active: true,
  },
  {
    id: 'exp-gkn-004',
    name: 'Supermarket Groceries & Essentials',
    amount: 1450,
    category: 'Groceries',
    date: '2026-10-22',
    direction: 'DEBIT',
    transactionType: 'expense',
    paymentMethod: 'UPI',
    bankName: 'HDFC Bank',
    maskedAccount: '**4120',
    referenceId: '131834525249',
    upiReference: '131834525249',
    payee: 'Supermarket',
    source: 'manual',
    active: true,
  },
  {
    id: 'exp-gkn-005',
    name: 'Petrol / Fuel Refill',
    amount: 500,
    category: 'Transport',
    date: '2026-10-20',
    direction: 'DEBIT',
    transactionType: 'expense',
    paymentMethod: 'UPI',
    bankName: 'Kotak Bank',
    maskedAccount: '**3344',
    referenceId: '132241653425',
    upiReference: '132241653425',
    payee: 'Indian Oil Petrol Pump',
    source: 'manual',
    active: true,
  },
  {
    id: 'exp-gkn-006',
    name: 'Zomato Lunch Order',
    amount: 300,
    category: 'Food & Dining',
    date: '2026-10-18',
    direction: 'DEBIT',
    transactionType: 'expense',
    paymentMethod: 'UPI',
    bankName: 'HDFC Bank',
    maskedAccount: '**4120',
    referenceId: '776655443322',
    upiReference: '776655443322',
    payee: 'Zomato',
    source: 'sms_auto',
    active: true,
  },
  {
    id: 'exp-gkn-007',
    name: 'Monthly Freelance & Salary Credit',
    amount: 65000,
    category: 'Salary',
    date: '2026-10-01',
    direction: 'CREDIT',
    transactionType: 'income',
    paymentMethod: 'Bank Transfer',
    bankName: 'HDFC Bank',
    maskedAccount: '**4120',
    referenceId: '998877665544',
    payee: 'Client Direct Deposit',
    source: 'manual',
    active: true,
  },
];
