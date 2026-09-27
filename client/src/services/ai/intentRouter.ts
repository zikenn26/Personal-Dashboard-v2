import {
  ModuleAdapter,
  AIServiceContext,
  AIServiceResponse,
  AIProvider,
  SessionMemory,
} from './types';
import { MoneyAdapter } from './adapters/moneyAdapter';
import { TasksAdapter } from './adapters/tasksAdapter';
import { HabitsAdapter } from './adapters/habitsAdapter';
import { GoalsAdapter } from './adapters/goalsAdapter';
import { ExamsAdapter } from './adapters/examsAdapter';
import { JournalAdapter } from './adapters/journalAdapter';
import { ScheduleAdapter } from './adapters/scheduleAdapter';
import { ContextAdapter } from './adapters/contextAdapter';
import { sendGeminiMessage, GeminiChatMessage } from '../geminiService';

export class GeminiProvider implements AIProvider {
  name = 'gemini';

  async process(
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    context?: AIServiceContext
  ): Promise<{ reply: string; actionChips: string[]; options?: any[] }> {
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return {
          reply: `You're currently offline. Please check your network connection and try again.`,
          actionChips: ['Offline Mode', 'Check Connection'],
        };
      }

      const geminiHistory: GeminiChatMessage[] = history.map((h, i) => ({
        id: `hist-${i}`,
        role: h.role,
        content: h.content,
        timestamp: Date.now() - (history.length - i) * 1000,
      }));

      const res = await sendGeminiMessage({
        message,
        history: geminiHistory,
        context: { activeView: context?.activeView },
      });

      return {
        reply: res.reply,
        actionChips: res.actionChips || ['Zikenn AI'],
        options: res.options,
      };
    } catch (err: any) {
      const errMsg = (err?.message || '').toLowerCase();
      if (errMsg.includes('quota') || errMsg.includes('429') || errMsg.includes('rate limit')) {
        return {
          reply: `AI request limit reached for your current tier. Please wait a moment or check your API key in Settings.`,
          actionChips: ['Settings', 'Quota Limit'],
        };
      }
      if (errMsg.includes('network') || errMsg.includes('failed to fetch') || errMsg.includes('offline')) {
        return {
          reply: `Network connection error. Please verify your internet connection and try again.`,
          actionChips: ['Check Network'],
        };
      }
      return {
        reply: `I couldn't process that command. You can ask me to track spending (e.g. "Add ₹250 for lunch"), check tasks ("Show my tasks"), view habits ("My habits"), or track goals!`,
        actionChips: ['Tasks', 'Expenses', 'Habits'],
      };
    }
  }
}

export class IntentRouter {
  private adapters: ModuleAdapter[];
  private provider: AIProvider;

  constructor(provider?: AIProvider) {
    this.adapters = [
      new ContextAdapter(),
      new MoneyAdapter(),
      new TasksAdapter(),
      new HabitsAdapter(),
      new GoalsAdapter(),
      new ExamsAdapter(),
      new JournalAdapter(),
      new ScheduleAdapter(),
    ];
    this.provider = provider || new GeminiProvider();
  }

  public setProvider(provider: AIProvider): void {
    this.provider = provider;
  }

  public async route(input: string, context?: AIServiceContext): Promise<AIServiceResponse> {
    const trimmed = input.trim();
    const memory: SessionMemory = context?.sessionMemory ? { ...context.sessionMemory } : {};

    // 1. Check all registered module adapters
    for (const adapter of this.adapters) {
      if (adapter.canHandle(trimmed, context)) {
        const response = await adapter.handle(trimmed, context);
        if (response) {
          // Record message in history
          const updatedHistory = memory.history ? [...memory.history] : [];
          updatedHistory.push({ role: 'user', content: trimmed, timestamp: Date.now() - 1 });
          updatedHistory.push({ role: 'assistant', content: response.reply, timestamp: Date.now() });

          return {
            ...response,
            updatedSessionMemory: {
              ...response.updatedSessionMemory,
              history: updatedHistory,
            },
          };
        }
      }
    }

    // 2. Provider fallback (Conversational LLM / General Reasoning)
    const historyList = (memory.history || []).map((h) => ({
      role: h.role,
      content: h.content,
    }));

    const providerResult = await this.provider.process(trimmed, historyList, context);

    const updatedHistory = memory.history ? [...memory.history] : [];
    updatedHistory.push({ role: 'user', content: trimmed, timestamp: Date.now() - 1 });
    updatedHistory.push({ role: 'assistant', content: providerResult.reply, timestamp: Date.now() });

    return {
      reply: providerResult.reply,
      module: 'general',
      actionChips: providerResult.actionChips,
      options: providerResult.options,
      updatedSessionMemory: {
        ...memory,
        history: updatedHistory,
      },
    };
  }
}
