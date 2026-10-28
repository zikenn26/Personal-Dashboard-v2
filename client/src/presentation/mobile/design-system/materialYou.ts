/**
 * Material You Design Tokens & Styling Helpers
 * 
 * Provides Material You M3-inspired color scales, rounded card radii,
 * elevation shadows, and safe-area utilities for the Android-first UI.
 */

export const MaterialYouTokens = {
  colors: {
    // Primary & Tonal Accents
    primary: '#7C3AED', // Violet 600
    primaryDark: '#6D28D9', // Violet 700
    primaryLight: '#8B5CF6', // Violet 500
    primaryContainer: '#EDE9FE', // Violet 100
    onPrimaryContainer: '#4C1D95', // Violet 900
    primaryContainerDark: '#2E1065', // Violet 950
    onPrimaryContainerDark: '#DDD6FE', // Violet 200

    // Secondary & Pastel Highlights
    secondary: '#9333EA',
    secondaryContainer: '#F3E8FF',
    onSecondaryContainer: '#581C87',

    // Surfaces & Backgrounds (Light)
    surfaceBackgroundLight: '#F7F6FC', // Subtle lavender-tinted background
    surfaceCardLight: '#FFFFFF', // Clean white card surface
    surfaceCardSubtleLight: '#F3F2F8',
    surfaceBorderLight: '#E8E5F3',
    surfaceBorderSubtleLight: '#F0EEF8',

    // Surfaces & Backgrounds (Dark)
    surfaceBackgroundDark: '#0B0F19', // Deep dark backdrop
    surfaceCardDark: '#121826', // Elevated card surface
    surfaceCardSubtleDark: '#1A2234',
    surfaceBorderDark: '#242D40',
    surfaceBorderSubtleDark: '#1E2638',

    // Text hierarchy
    textPrimaryLight: '#18181B', // Zinc 900
    textSecondaryLight: '#52525B', // Zinc 600
    textTertiaryLight: '#71717A', // Zinc 500
    textMutedLight: '#A1A1AA', // Zinc 400

    textPrimaryDark: '#F4F4F5', // Zinc 100
    textSecondaryDark: '#D4D4D8', // Zinc 300
    textTertiaryDark: '#A1A1AA', // Zinc 400
    textMutedDark: '#71717A', // Zinc 500

    // Status colors
    success: '#10B981',
    successContainer: '#D1FAE5',
    warning: '#F59E0B',
    warningContainer: '#FEF3C7',
    danger: '#EF4444',
    dangerContainer: '#FEE2E2',
    info: '#3B82F6',
    infoContainer: '#DBEAFE',
  },

  radius: {
    sheet: 'rounded-t-[28px]',
    card: 'rounded-3xl', // 24px
    innerCard: 'rounded-2xl', // 16px
    button: 'rounded-full', // Pill shape
    chip: 'rounded-full',
    gridItem: 'rounded-2xl',
  },

  shadows: {
    card: 'shadow-[0_2px_12px_rgba(124,58,237,0.06)]',
    cardHover: 'shadow-[0_4px_20px_rgba(124,58,237,0.12)]',
    cardDark: 'shadow-[0_2px_12px_rgba(0,0,0,0.3)]',
    sheet: 'shadow-[0_-4px_24px_rgba(0,0,0,0.15)]',
    fab: 'shadow-[0_4px_16px_rgba(124,58,237,0.3)]',
    appBar: 'shadow-[0_1px_3px_rgba(0,0,0,0.04)]',
    bottomNav: 'shadow-[0_-2px_12px_rgba(0,0,0,0.06)]',
  },
} as const;

/**
 * Common class combinations for Material You cards
 */
export const CARD_SURFACE_CLASSES =
  'bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] rounded-3xl shadow-[0_2px_12px_rgba(124,58,237,0.05)] transition-all';

export const CARD_HEADER_CLASSES = 'flex items-center justify-between px-4 pt-4 pb-2';

export const CARD_TITLE_CLASSES =
  'text-base font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2';

export const CARD_BODY_CLASSES = 'px-4 pb-4 pt-0';
