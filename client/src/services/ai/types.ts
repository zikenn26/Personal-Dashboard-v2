import { InteractiveOption, ExecutableAction, ExecutionResult } from '../commandIntentEngine';

export interface SessionMemory {
  lastAction?: {
    type: string;
    entity: string;
    description: string;
    timestamp: number;
  };
  lastExpense?: {
    id: string;
    name: string;
    amount: number;
    category?: string;
  };
  lastTask?: {
    id: string;
    title: string;
  };
  lastModule?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }>;
}

export type TimeOfDay = 'morning' | 'midday' | 'evening' | 'night';

export interface AIServiceContext {
  activeView?: string;
  timeOfDay?: TimeOfDay;
  isWeekend?: boolean;
  sessionMemory?: SessionMemory;
  userEmail?: string;
}

export interface AIServiceResponse {
  reply: string;
  module:
    | 'money'
    | 'tasks'
    | 'habits'
    | 'goals'
    | 'exams'
    | 'journal'
    | 'schedule'
    | 'context'
    | 'general';
  actionChips: string[];
  options?: InteractiveOption[];
  pendingConfirmation?: boolean;
  executedActions?: ExecutableAction[];
  updatedSessionMemory: SessionMemory;
}

export interface SmartChipItem {
  id: string;
  label: string;
  prompt: string;
  category?: 'morning' | 'office' | 'evening' | 'weekend' | 'general';
  iconName?: string;
}

export interface ModuleAdapter {
  name: string;
  canHandle(input: string, context?: AIServiceContext): boolean;
  handle(input: string, context?: AIServiceContext): Promise<AIServiceResponse | null>;
}

export interface AIProvider {
  name: string;
  process(
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    context?: AIServiceContext
  ): Promise<{ reply: string; actionChips: string[]; options?: InteractiveOption[] }>;
}
