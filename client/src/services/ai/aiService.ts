import {
  AIServiceContext,
  AIServiceResponse,
  SessionMemory,
  SmartChipItem,
  AIProvider,
} from './types';
import { IntentRouter } from './intentRouter';
import { ContextAdapter } from './adapters/contextAdapter';
import {
  InteractiveOption,
  executeInteractiveOption,
  ExecutionResult,
} from '../commandIntentEngine';

export class AIService {
  private static instance: AIService | null = null;
  private router: IntentRouter;

  private constructor() {
    this.router = new IntentRouter();
  }

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  public setProvider(provider: AIProvider): void {
    this.router.setProvider(provider);
  }

  public createInitialSessionMemory(): SessionMemory {
    return {
      history: [],
    };
  }

  public getSmartActionChips(context?: AIServiceContext): SmartChipItem[] {
    return ContextAdapter.getSmartActionChips(context);
  }

  public async processMessage(
    message: string,
    context?: AIServiceContext
  ): Promise<AIServiceResponse> {
    return this.router.route(message, context);
  }

  public async executeOption(option: InteractiveOption): Promise<ExecutionResult> {
    return executeInteractiveOption(option);
  }
}

export const aiService = AIService.getInstance();
