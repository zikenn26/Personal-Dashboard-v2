/**
 * User Identity and Profile Utilities
 *
 * Implements standard name initials formatting and mock avatar detection.
 * Enforces initials consisting of less than 2 alphabets (max 2 characters).
 * e.g., "Gulshan Kumar Nayak" -> "GK", "Aditya" -> "A".
 */

export function getUserWorkspaceKey(user: { id?: string; email?: string } | null): string {
  if (!user || !user.email) return 'user_guest';
  const cleanEmail = user.email.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `user_${cleanEmail}`;
}

export function isGulshanUser(emailOrWs?: string | null): boolean {
  if (!emailOrWs) return false;
  const lower = emailOrWs.toLowerCase().trim();
  return (
    lower === 'gknayak@gmail.com' ||
    lower === 'gulnayak1206@gmail.com' ||
    lower === 'user_gknayak_gmail_com' ||
    lower === 'user_gulnayak1206_gmail_com'
  );
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
 */
export function isDummyMockAvatar(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return true;
  const trimmed = url.trim();
  if (!trimmed) return true;

  // Detect local stock mock avatar asset
  if (trimmed.includes('avatar_profile_default')) return true;

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
