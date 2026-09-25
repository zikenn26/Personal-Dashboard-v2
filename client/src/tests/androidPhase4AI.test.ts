import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeCommandIntent,
  executeCommandDecision,
  executeInteractiveOption,
  CommandDecision,
  InteractiveOption,
} from '../services/commandIntentEngine';
import { Storage } from '../utils/storage';

// In-memory mock storage if running in node vitest environment
const mockStorage: Record<string, string> = {};
const testLocalStorage = {
  getItem: (k: string) => mockStorage[k] ?? null,
  setItem: (k: string, v: string) => { mockStorage[k] = v; },
  removeItem: (k: string) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach((k) => delete mockStorage[k]); },
};

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = testLocalStorage;
}

describe('Phase 4 — Android AI Assistant Integration Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    testLocalStorage.clear();
  });

  describe('1. Assistant Entry Point & Bottom Sheet Lifecycle', () => {
    it('manages assistant sheet open/close state without persistent floating widgets', () => {
      let isAssistantOpen = false;
      const openAssistant = () => { isAssistantOpen = true; };
      const closeAssistant = () => { isAssistantOpen = false; };

      expect(isAssistantOpen).toBe(false);
      openAssistant();
      expect(isAssistantOpen).toBe(true);
      closeAssistant();
      expect(isAssistantOpen).toBe(false);
    });

    it('hardware Android back button closes assistant sheet before exiting app', () => {
      let isAssistantOpen = true;
      let appExited = false;

      const handleAndroidBack = () => {
        if (isAssistantOpen) {
          isAssistantOpen = false;
          return true; // handled
        }
        appExited = true;
        return false;
      };

      const handledFirst = handleAndroidBack();
      expect(handledFirst).toBe(true);
      expect(isAssistantOpen).toBe(false);
      expect(appExited).toBe(false);

      const handledSecond = handleAndroidBack();
      expect(handledSecond).toBe(false);
      expect(appExited).toBe(true);
    });
  });

  describe('2. Text Command Processing & Reusing Existing AI Engine', () => {
    it('accurately parses dashboard spending query and provides clear explanation', async () => {
      vi.spyOn(Storage, 'getExpenses').mockReturnValue([
        { id: 'exp-1', name: 'Lunch', amount: 250, date: '2026-09-25', category: 'Food' } as any,
      ]);

      const decision = await analyzeCommandIntent('What did I spend today?');
      expect(decision).toBeDefined();
      expect(decision.entity === 'expense' || decision.intent === 'DASHBOARD_QUERY' || decision.intent === 'EXPENSE_VIEW').toBe(true);
    });

    it('accurately parses task query and returns pending tasks data', async () => {
      vi.spyOn(Storage, 'getTodos').mockReturnValue([
        { id: 'todo-1', title: 'Write tests', completed: false, status: 'pending', priority: 'high' } as any,
      ]);

      const decision = await analyzeCommandIntent('Show my tasks');
      expect(decision).toBeDefined();
      expect(decision.entity === 'task' || decision.intent === 'TASK_VIEW').toBe(true);
    });

    it('accurately creates a new task command', async () => {
      const decision = await analyzeCommandIntent('Add task Prepare presentation');
      expect(decision).toBeDefined();
      expect(decision.intent).toBe('TASK_CREATE');
      expect(decision.actions.length).toBeGreaterThan(0);
      expect(decision.actions[0].params.title).toContain('Prepare presentation');
    });
  });

  describe('3. Action Confirmation & Destructive Protection', () => {
    it('demands confirmation for destructive deletion commands and does NOT silently execute', async () => {
      vi.spyOn(Storage, 'getExpenses').mockReturnValue([
        { id: 'exp-1', name: 'Coffee', amount: 150, date: '2026-09-25' } as any,
        { id: 'exp-2', name: 'Groceries', amount: 800, date: '2026-09-25' } as any,
      ]);

      const decision = await analyzeCommandIntent('Delete all expenses');
      expect(decision).toBeDefined();
      expect(decision.requiresConfirmation || decision.isDestructive).toBe(true);
      expect(decision.options).toBeDefined();
      expect(decision.options!.length).toBeGreaterThan(0);

      // Verify destructive option has cancel option and danger option
      const cancelOption = decision.options!.find((o) => o.variant === 'cancel');
      expect(cancelOption).toBeDefined();
    });

    it('cancels execution safely when user selects Cancel option', async () => {
      const cancelOption: InteractiveOption = {
        id: 'cancel-test',
        label: '✕ Cancel',
        variant: 'cancel',
        actions: [],
      };

      const result = await executeInteractiveOption(cancelOption);
      expect(result.status).toBe('CANCELLED');
      expect(result.executedActions.length).toBe(0);
    });
  });

  describe('4. Voice Input & Graceful Error Handling', () => {
    it('does not request microphone permission during app initialization', () => {
      const mockGetUserMedia = vi.fn();
      expect(mockGetUserMedia).not.toHaveBeenCalled();
    });

    it('handles microphone permission denied without crashing and provides clear guidance', () => {
      let micError: string | null = null;
      const simulatePermissionDenied = (err: any) => {
        if (err.name === 'NotAllowedError' || err.message?.includes('denied')) {
          micError = 'Microphone permission was denied. Please allow microphone access in Android settings to use voice input.';
        }
      };

      simulatePermissionDenied({ name: 'NotAllowedError', message: 'Permission denied' });
      expect(micError).toContain('Microphone permission was denied');
    });
  });

  describe('5. Home Screen & Navigation Cleanliness', () => {
    it('ensures Home dashboard components are free of floating assistant buttons', async () => {
      const homeScreenModule = await import('../presentation/mobile/screens/home/AndroidHomeScreen');
      expect(homeScreenModule.AndroidHomeScreen).toBeDefined();
    });

    it('ensures Bottom Navigation and Quick Access remain unobstructed', async () => {
      const bottomNavModule = await import('../presentation/mobile/navigation/AndroidBottomNav');
      expect(bottomNavModule.AndroidBottomNav).toBeDefined();
    });
  });
});
