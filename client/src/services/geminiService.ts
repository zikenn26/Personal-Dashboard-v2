import { executeSecretaryTool, sendSecretaryMessage } from './groqService';
import { Storage } from '../utils/storage';
import {
  parseNaturalLanguageIntent,
  executeCommandMapping,
  matchCommandTrigger,
  getRegisteredHandlers,
  inferExpenseCategory,
  broadcastDataChanged,
} from './commandMappingService';

// Backend server error detection tracker
let backendServerErrorDetected = false;

export function isBackendApiFailing(): boolean {
  return backendServerErrorDetected;
}

export function setBackendServerError(failing: boolean): void {
  backendServerErrorDetected = failing;
}

export function resetBackendApiStatus(): void {
  backendServerErrorDetected = false;
}

export interface GeminiChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  actionChips?: string[];
  modelUsed?: string;
  timestamp: number;
}

export const GEMINI_MODELS = [
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    badge: 'Recommended',
    desc: 'Lowest latency, high availability for instant answers and dashboard actions',
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    badge: 'Multimodal',
    desc: 'High speed, multimodal intelligence, and tool execution for daily tasks',
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    badge: 'General',
    desc: 'Versatile general-purpose model for conversational workflow',
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro Preview',
    badge: 'Complex Reasoning',
    desc: 'Deep reasoning, complex scheduling, and thorough analysis (Requires paid key)',
  },
] as const;

export const GEMINI_ROLES = [
  {
    id: 'chief_of_staff',
    name: 'Executive Chief of Staff',
    description: 'Direct, organized, and proactive assistant managing your time, tasks, and habits.',
    instruction:
      'Adopt the role of an elite Executive Chief of Staff. You are decisive, efficient, and proactive. Prioritize clarity, action, and strategic productivity.',
  },
  {
    id: 'exam_mentor',
    name: 'UPSC & Exam Mentor',
    description: 'Disciplined academic mentor specializing in syllabus pacing, revision, and analytical rigor.',
    instruction:
      'Adopt the role of a high-achieving Competitive Exam Mentor (e.g. UPSC, GATE, GRE). Encourage consistent daily study targets, test review, revision schedules, and high mental clarity.',
  },
  {
    id: 'financial_advisor',
    name: 'Wealth & Expense Advisor',
    description: 'Prudent financial tracker analyzing spending patterns and budgeting discipline.',
    instruction:
      'Adopt the role of a prudent Personal Financial Advisor. Analyze expenses accurately, highlight budget overruns, and encourage sustainable wealth creation.',
  },
  {
    id: 'mindful_coach',
    name: 'Mindful Life Coach',
    description: 'Empathetic guide focusing on wellness, habit consistency, and daily journaling.',
    instruction:
      'Adopt the role of an empathetic, grounded Life Coach. Focus on consistency, emotional resilience, reflective journaling, and steady habit growth without burnout.',
  },
] as const;

export interface GeminiHealthResponse {
  status: string;
  hasApiKey: boolean;
  defaultModel: string;
  liveModel: string;
}

// 1. Health check
export async function checkGeminiHealth(): Promise<GeminiHealthResponse> {
  try {
    const res = await fetch('/api/gemini/health');
    if (!res.ok) {
      if (res.status === 405 || res.status >= 400) {
        backendServerErrorDetected = true;
      }
      throw new Error(`Health check failed with status ${res.status}`);
    }
    const health = await res.json();
    if (health.status === 'ok') {
      backendServerErrorDetected = false;
    }
    return health;
  } catch {
    backendServerErrorDetected = true;
    return {
      status: 'offline',
      hasApiKey: false,
      defaultModel: 'gemini-3.1-flash-lite',
      liveModel: 'gemini-3.8-live',
    };
  }
}

/**
 * Robust Local Client-Side Fallback Handler & Simplified Mock Storage Operation
 * Automatically used when the backend API returns a 405 or other server-side errors.
 * Ensures zero-error voice interactions and immediate local execution.
 */
export async function executeLocalClientVoiceFallback(
  rawMessage: string,
  history: GeminiChatMessage[] = []
): Promise<{
  reply: string;
  actionChips: string[];
  model: string;
  updatedHistory: GeminiChatMessage[];
}> {
  // Strip leading and trailing punctuation, quotes, question marks, and excessive whitespace
  const message = rawMessage.trim();
  const cleaned = message
    .replace(/^[\s"“”'‘’`«»„.?!,;:\-_(){}\[\]]+/, '')
    .replace(/[\s"“”'‘’`«»„.?!,;:\-_(){}\[\]]+$/, '')
    .trim();

  // 1. Match configured trigger phrases and natural language regex intents
  const match = matchCommandTrigger(cleaned) || matchCommandTrigger(message);
  if (match) {
    try {
      const res = await executeCommandMapping(match.mapping, match.extractedParams);
      const userMessage: GeminiChatMessage = {
        id: 'msg-user-' + Date.now(),
        role: 'user',
        content: message,
        timestamp: Date.now() - 1,
      };
      const assistantMessage: GeminiChatMessage = {
        id: 'msg-local-' + Date.now(),
        role: 'assistant',
        content: res.message,
        actionChips: res.actionChip ? [res.actionChip] : ['⚡ Executed Locally'],
        modelUsed: 'Offline Voice Engine',
        timestamp: Date.now(),
      };

      return {
        reply: res.message,
        actionChips: res.actionChip ? [res.actionChip] : ['⚡ Executed Locally'],
        model: 'Offline Voice Engine',
        updatedHistory: [...history, userMessage, assistantMessage],
      };
    } catch (err) {
      console.warn('executeCommandMapping failed inside fallback:', err);
    }
  }

  // 2. Comprehensive simplified mock & local storage operation handler
  const lower = cleaned.toLowerCase();
  const handlers = getRegisteredHandlers();
  let reply = '';
  let actionChip = '';

  // 2a. Tasks intent: Add, Complete, Remove, or List
  if (
    /\b(?:task|todo|to-do|remind|schedule|errand|item)\b/i.test(lower) ||
    /^(?:add|create|make|insert|put)\s+/i.test(lower)
  ) {
    if (/\b(?:complete|finish|done|check\s*off)\b/i.test(lower)) {
      const allTodos = Storage.getTodos();
      const pending = allTodos.filter((t) => !t.completed);
      const target =
        pending.find((t) => lower.includes(t.title.toLowerCase())) || pending[0];
      if (target) {
        if (handlers.onToggleTodo) {
          handlers.onToggleTodo(target.id);
        } else {
          target.completed = true;
          target.status = 'complete';
          Storage.setTodos(allTodos);
          broadcastDataChanged('tasks');
        }
        reply = `Marked task "${target.title}" as completed!`;
        actionChip = `✓ Completed: ${target.title}`;
      } else {
        reply = 'You currently have no pending tasks to complete.';
        actionChip = '✓ No Pending Tasks';
      }
    } else if (/\b(?:delete|remove|clear)\b/i.test(lower)) {
      const allTodos = Storage.getTodos();
      const targetIdx = allTodos.findIndex((t) => lower.includes(t.title.toLowerCase()));
      if (targetIdx !== -1) {
        const removed = allTodos.splice(targetIdx, 1)[0];
        Storage.setTodos(allTodos);
        broadcastDataChanged('tasks');
        reply = `Removed task "${removed.title}".`;
        actionChip = `✓ Removed: ${removed.title}`;
      } else {
        reply = 'Could not find that task to remove.';
        actionChip = '⚠️ Task Not Found';
      }
    } else {
      // Add Task - Extract clear title
      let title = cleaned
        .replace(
          /^(?:hey\s+)?(?:zikenn|gemini|assistant)?\s*(?:please\s+)?(?:can\s+you\s+)?(?:add|create|make|schedule|put|insert)\s+(?:a\s+)?(?:new\s+)?(?:task|todo|item)?\s*(?:to|for|called|titled|:\s*)?/i,
          ''
        )
        .replace(/^(?:to\s+|called\s+|titled\s+|for\s+|:\s*|\-\s*)+/i, '')
        .replace(/[\s"“”'‘’`«»„.?!,;:\-_(){}\[\]]+$/, '')
        .trim();
      if (!title) title = 'New Voice Task';
      title = title.charAt(0).toUpperCase() + title.slice(1);

      // Infer priority
      let priority: 'low' | 'medium' | 'high' = 'medium';
      if (/\b(?:urgent|asap|critical|high\s+priority)\b/i.test(lower)) priority = 'high';
      else if (/\b(?:low\s+priority|someday|minor)\b/i.test(lower)) priority = 'low';

      if (handlers.onAddTodo) {
        handlers.onAddTodo(title, priority, 'Personal', '', 'todo');
      } else {
        const allTodos = Storage.getTodos();
        allTodos.unshift({
          id: `todo-${Date.now()}`,
          title,
          completed: false,
          status: 'todo',
          priority,
          category: 'Personal',
          createdAt: Date.now(),
        });
        Storage.setTodos(allTodos);
        broadcastDataChanged('tasks');
      }
      reply = `Added task "${title}" to your task list.`;
      actionChip = `✓ Added: ${title}`;
    }
  }
  // 2b. Expenses intent: Add / Log spending
  else if (
    /\b(?:expense|spent|spend|paid|cost|rupees|rs|₹|bucks|inr)\b/i.test(lower)
  ) {
    const amountMatch = lower.match(/(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)\s*(?:rs|rupees|inr|bucks)?/i);
    const amount = amountMatch && amountMatch[1] ? parseFloat(amountMatch[1]) : 100;
    let name = cleaned
      .replace(
        /^(?:hey\s+)?(?:zikenn|gemini|assistant)?\s*(?:please\s+)?(?:add|log|record|track|enter)?\s*(?:an?\s+)?(?:expense|spent|spend|paid)?\s*(?:of)?\s*(?:rs\.?|inr|₹)?\s*\d+(?:\.\d+)?\s*(?:rs|rupees|inr|bucks)?\s*(?:for|on|towards)?/i,
        ''
      )
      .trim();
    if (!name) name = 'Voice Expense';
    name = name.charAt(0).toUpperCase() + name.slice(1);
    const category = inferExpenseCategory(name);

    if (handlers.onAddExpense) {
      handlers.onAddExpense({
        name,
        amount,
        category,
        date: new Date().toISOString().split('T')[0],
        billingCycle: 'one-time',
        icon: '💳',
        active: true,
      });
    } else {
      const allExpenses = Storage.getExpenses();
      allExpenses.unshift({
        id: `exp-${Date.now()}`,
        name,
        amount,
        category,
        date: new Date().toISOString().split('T')[0],
        billingCycle: 'one-time',
        icon: '💳',
        active: true,
      });
      Storage.setExpenses(allExpenses);
      broadcastDataChanged('expenses');
    }
    reply = `Logged expense of ₹${amount} for "${name}".`;
    actionChip = `✓ Expense: ₹${amount}`;
  }
  // 2c. Habit intent: Complete / Streak
  else if (
    /\b(?:habit|routine|streak|water|workout|exercise|meditat|read)\b/i.test(lower)
  ) {
    const habits = Storage.getHabits();
    const todayIdx = (new Date().getDay() + 6) % 7;
    const target = habits.find((h) => lower.includes(h.title.toLowerCase())) || habits[0];
    if (target) {
      target.completedDays[todayIdx] = true;
      Storage.setHabits(habits);
      broadcastDataChanged('habits');
      handlers.onToggleHabit?.(target.id);
      reply = `Completed habit "${target.title}" for today!`;
      actionChip = `✓ Habit Done: ${target.title}`;
    } else {
      reply = `You have ${habits.length} habits tracked. Daily momentum is on track!`;
      actionChip = '✓ Habits Checked';
    }
  }
  // 2d. Navigation intent: Open / Go to view
  else if (/\b(?:open|go to|show|navigate to|switch to|view)\b/i.test(lower)) {
    let targetView = 'home';
    if (/\b(?:task|tasks|kanban|todo|todos)\b/i.test(lower)) targetView = 'tasks';
    else if (/\b(?:expense|expenses|spending|budget)\b/i.test(lower)) targetView = 'expenses';
    else if (/\b(?:habit|habits|routine)\b/i.test(lower)) targetView = 'habits';
    else if (/\b(?:journal|diary|log|notes)\b/i.test(lower)) targetView = 'journal';
    else if (/\b(?:workfolio|portfolio|resume|projects)\b/i.test(lower)) targetView = 'workfolio';
    else if (/\b(?:schedule|calendar|agenda)\b/i.test(lower)) targetView = 'schedule';
    else if (/\b(?:quote|quotes|mantra)\b/i.test(lower)) targetView = 'quotes';
    else if (/\b(?:exam|exams|syllabus)\b/i.test(lower)) targetView = 'exams';
    else if (/\b(?:home|dashboard|today)\b/i.test(lower)) targetView = 'home';

    if (handlers.onNavigate) {
      handlers.onNavigate(targetView);
    }
    reply = `Opened ${targetView} for you.`;
    actionChip = `⚡ View: ${targetView}`;
  }
  // 2e. Status / Overview
  else if (/\b(?:status|summary|overview|how am i doing|pending|agenda)\b/i.test(lower)) {
    const pendingCount = Storage.getTodos().filter((t) => !t.completed).length;
    const habits = Storage.getHabits();
    const todayIdx = (new Date().getDay() + 6) % 7;
    const doneHabits = habits.filter((h) => h.completedDays[todayIdx]).length;
    reply = `Daily status: You have ${pendingCount} pending task(s) and ${doneHabits}/${habits.length} habits completed today. Operating 100% offline!`;
    actionChip = `✓ Status: ${pendingCount} Tasks, ${doneHabits} Habits`;
  }
  // 2f. General offline friendly response
  else {
    reply = `Command received: "${cleaned}". Voice actions for adding tasks, expenses, habits, and navigation work directly in offline mode.`;
    actionChip = '⚡ Local Voice Ready';
  }

  const userMessage: GeminiChatMessage = {
    id: 'msg-user-' + Date.now(),
    role: 'user',
    content: message,
    timestamp: Date.now() - 1,
  };
  const assistantMessage: GeminiChatMessage = {
    id: 'msg-offline-' + Date.now(),
    role: 'assistant',
    content: reply,
    actionChips: [actionChip],
    modelUsed: 'Local Fallback Handler',
    timestamp: Date.now(),
  };

  return {
    reply,
    actionChips: [actionChip],
    model: 'Local Fallback Handler',
    updatedHistory: [...history, userMessage, assistantMessage],
  };
}

// 2. Multi-turn Chat & Voice Command Execution
export async function sendGeminiMessage(params: {
  message: string;
  history: GeminiChatMessage[];
  model?: string;
  roleId?: string;
  customSystemInstruction?: string;
}): Promise<{
  reply: string;
  actionChips: string[];
  model: string;
  updatedHistory: GeminiChatMessage[];
}> {
  const { message, history, model = 'gemini-3.1-flash-lite', roleId, customSystemInstruction } = params;

  // If backend server returned a 405 or other error previously, route directly through local fallback
  if (backendServerErrorDetected) {
    console.info('Backend previously detected offline/405; executing voice command via local client fallback.');
    return await executeLocalClientVoiceFallback(message, history);
  }

  // Selected role instruction
  const matchedRole = GEMINI_ROLES.find((r) => r.id === roleId);
  const roleInstruction = customSystemInstruction || matchedRole?.instruction || '';

  // Current Dashboard State Context
  const todos = Storage.getTodos();
  const habits = Storage.getHabits();
  const expenses = Storage.getExpenses();

  const pendingTasks = todos.filter((t) => !t.completed).length;
  const today = new Date().getDay();
  const todayIdx = today === 0 ? 6 : today - 1;
  const completedHabits = habits.filter((h) => h.completedDays?.[todayIdx]).length;
  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const recentExpensesSummary = expenses
    .slice(0, 8)
    .map((e) => `"${e.name}" (₹${e.amount} on ${e.date || 'today'})`)
    .join(', ');

  const recentTasksSummary = todos
    .slice(0, 8)
    .map((t) => `"${t.title}" [${t.status || (t.completed ? 'completed' : 'pending')}]`)
    .join(', ');

  const payload = {
    message,
    history: history.map((h) => ({
      role: h.role,
      content: h.content,
    })),
    model,
    roleSystemInstruction: roleInstruction,
    dashboardContext: {
      pendingTasksCount: pendingTasks,
      completedHabitsCount: completedHabits,
      totalHabitsCount: habits.length,
      totalExpenses: Math.round(totalExpenses),
      recentExpensesSummary,
      recentTasksSummary,
    },
  };

  let data: any;
  try {
    const response = await fetch('/api/gemini/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Detect 405 or other server-side errors immediately
    if (response.status === 405 || response.status >= 500 || response.status === 404 || !response.ok) {
      console.warn(
        `Backend API returned HTTP ${response.status}. Automatically switching voice command processing to local client-side fallback handler.`
      );
      backendServerErrorDetected = true;
      return await executeLocalClientVoiceFallback(message, history);
    }

    data = await response.json();
  } catch (backendError: any) {
    console.warn(
      'Gemini chat backend error or offline, automatically switching voice command processing to local client fallback handler:',
      backendError?.message
    );
    backendServerErrorDetected = true;
    return await executeLocalClientVoiceFallback(message, history);
  }
  const actionChips: string[] = [];

  // Execute any function calls on local state
  if (Array.isArray(data.functionCalls) && data.functionCalls.length > 0) {
    for (const fc of data.functionCalls) {
      try {
        let toolName = fc.name;
        const args = fc.args || {};

        // Map function names to existing executeSecretaryTool if needed
        if (toolName === 'createTask') toolName = 'add_task';
        if (toolName === 'deleteTask') toolName = 'delete_task';
        if (toolName === 'updateTask') toolName = 'update_task';
        if (toolName === 'logExpense') toolName = 'add_expense';
        if (toolName === 'deleteExpense') toolName = 'delete_expense';
        if (toolName === 'updateExpense') toolName = 'update_expense';
        if (toolName === 'toggleHabit') {
          // find habit id by title if habitTitle passed
          if (args.habitTitle && !args.id) {
            const h = habits.find((it) =>
              it.title.toLowerCase().includes(args.habitTitle.toLowerCase())
            );
            if (h) args.id = h.id;
          }
          toolName = 'toggle_habit';
        }
        if (toolName === 'navigateView') toolName = 'navigate_view';

        const execRes = await executeSecretaryTool(toolName, args);
        if (execRes.actionChip) {
          actionChips.push(execRes.actionChip);
        }
      } catch (err) {
        console.warn('Tool execution failed:', fc.name, err);
      }
    }
  }

  let finalReply = data.reply?.trim();
  if (!finalReply) {
    if (actionChips.length > 0) {
      finalReply = actionChips.map((c) => c.replace(/^[✓⚡⚠️\s]+/, '')).join('. ') + '.';
    } else {
      finalReply = 'Action completed successfully.';
    }
  }

  const assistantMessage: GeminiChatMessage = {
    id: 'msg-gemini-' + Date.now(),
    role: 'assistant',
    content: finalReply,
    actionChips,
    modelUsed: data.model || model,
    timestamp: Date.now(),
  };

  const userMessage: GeminiChatMessage = {
    id: 'msg-user-' + Date.now(),
    role: 'user',
    content: message,
    timestamp: Date.now() - 1,
  };

  return {
    reply: finalReply,
    actionChips,
    model: data.model || model,
    updatedHistory: [...history, userMessage, assistantMessage],
  };
}

// 3. Audio Text-to-Speech Playback
let ttsAudioCtx: AudioContext | null = null;
let currentTtsSource: AudioBufferSourceNode | null = null;

export async function speakTextWithGemini(
  text: string,
  voice: 'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir' = 'Zephyr',
  onFinished?: () => void
): Promise<void> {
  // Stop existing playback
  stopGeminiSpeech();

  try {
    const res = await fetch('/api/gemini/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
    });

    if (!res.ok) {
      throw new Error(`TTS server returned ${res.status}`);
    }

    const data = await res.json();
    if (!data.audio) throw new Error('No audio data received');

    // Decode PCM 16-bit 24kHz
    if (!ttsAudioCtx) {
      ttsAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });
    }

    if (ttsAudioCtx.state === 'suspended') {
      await ttsAudioCtx.resume();
    }

    const binary = atob(data.audio);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    const audioBuffer = ttsAudioCtx.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    const source = ttsAudioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ttsAudioCtx.destination);
    source.onended = () => {
      currentTtsSource = null;
      if (onFinished) onFinished();
    };

    currentTtsSource = source;
    source.start(0);
  } catch (err) {
    console.warn('Gemini TTS failed, falling back to browser SpeechSynthesis:', err);
    // Fallback to browser SpeechSynthesis
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.onend = () => {
        if (onFinished) onFinished();
      };
      window.speechSynthesis.speak(utterance);
    } else if (onFinished) {
      onFinished();
    }
  }
}

export function stopGeminiSpeech() {
  if (currentTtsSource) {
    try {
      currentTtsSource.stop();
      currentTtsSource.disconnect();
    } catch {
      // ignore
    }
    currentTtsSource = null;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export interface AudioTranscriptionResult {
  transcript: string;
  error?: string;
  statusCode?: number;
  isMissingApiKey?: boolean;
  isOffline?: boolean;
}

export async function transcribeAudioWithGemini(
  base64Audio: string,
  mimeType: string = 'audio/wav'
): Promise<AudioTranscriptionResult> {
  try {
    const res = await fetch('/api/gemini/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio: base64Audio, mimeType }),
    });

    if (res.status === 503) {
      const errData = await res.json().catch(() => ({}));
      return {
        transcript: '',
        error: errData.error || 'GEMINI_API_KEY is not configured on the server.',
        statusCode: 503,
        isMissingApiKey: true,
      };
    }

    if (res.status === 404) {
      return {
        transcript: '',
        error: 'Transcription API route was not found (backend server is offline on this deployment).',
        statusCode: 404,
        isOffline: true,
      };
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        transcript: '',
        error: errData.error || `Transcription failed with HTTP ${res.status}`,
        statusCode: res.status,
      };
    }

    const data = await res.json();
    return {
      transcript: data.transcript || '',
      statusCode: 200,
    };
  } catch (e: any) {
    console.warn('Gemini Transcribe network error:', e);
    return {
      transcript: '',
      error: e?.message || 'Network error connecting to transcription server',
      isOffline: true,
    };
  }
}

export async function transcribeAudioWithGroqWhisper(audioBlob: Blob): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('file', audioBlob, 'speech.wav');
    formData.append('model', 'whisper-large-v3');
    formData.append('language', 'en');
    formData.append('response_format', 'json');

    // 1. Try server proxy route first
    try {
      const proxyRes = await fetch('/api/groq/audio/transcriptions', {
        method: 'POST',
        body: formData,
      });
      if (proxyRes.ok) {
        const data = await proxyRes.json();
        if (data.text?.trim()) return data.text.trim();
      }
    } catch {}

    // 2. Try direct Groq endpoint if user has client-configured key
    const clientKey = Storage.getGroqApiKey?.() || (import.meta as any).env?.VITE_GROQ_API_KEY;
    if (clientKey?.trim()) {
      const directRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${clientKey.trim()}`,
        },
        body: formData,
      });
      if (directRes.ok) {
        const data = await directRes.json();
        if (data.text?.trim()) return data.text.trim();
      }
    }
  } catch (err) {
    console.warn('Groq Whisper transcription fallback error:', err);
  }
  return '';
}
