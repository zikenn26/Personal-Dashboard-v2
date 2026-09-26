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
      return {
        reply: `I checked your dashboard. Let me know if you'd like me to log an expense, add a task, check habits, or view goals!`,
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
