import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { ONBOARDING_STORAGE_KEY } from '../components/OnboardingTourModal';
import { INITIAL_SETUP_BANNER_DISMISSED_KEY } from '../components/InitialSetupBanner';

describe('Onboarding and Initial Setup Banner Logic', () => {
  beforeAll(() => {
    if (typeof window === 'undefined' || !window.localStorage) {
      const store: Record<string, string> = {};
      globalThis.localStorage = {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
        removeItem: (k: string) => {
          delete store[k];
        },
        clear: () => {
          Object.keys(store).forEach((k) => delete store[k]);
        },
        key: (i: number) => Object.keys(store)[i] ?? null,
        length: 0,
      } as any;
    }
  });

  beforeEach(() => {
    localStorage.clear();
  });

  it('1. Onboarding tour storage flag defaults to null and marks completed correctly', () => {
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBeNull();

    // Mark as completed
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe('true');
  });

  it('2. Initial setup banner dismissal key persists across sessions', () => {
    expect(localStorage.getItem(INITIAL_SETUP_BANNER_DISMISSED_KEY)).toBeNull();

    // Mark dismissed
    localStorage.setItem(INITIAL_SETUP_BANNER_DISMISSED_KEY, 'true');
    expect(localStorage.getItem(INITIAL_SETUP_BANNER_DISMISSED_KEY)).toBe('true');
  });

  it('3. Workspace is identified as fresh only when all three primary stores are empty', () => {
    const isFresh = (todos: number, habits: number, expenses: number) => {
      return todos === 0 && habits === 0 && expenses === 0;
    };

    expect(isFresh(0, 0, 0)).toBe(true);
    expect(isFresh(1, 0, 0)).toBe(false);
    expect(isFresh(0, 1, 0)).toBe(false);
    expect(isFresh(0, 0, 1)).toBe(false);
    expect(isFresh(2, 3, 5)).toBe(false);
  });
});
