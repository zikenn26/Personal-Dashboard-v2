import { executeSecretaryTool } from './groqService';
import { Storage } from '../utils/storage';

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
    if (!res.ok) throw new Error('Health check failed');
    return await res.json();
  } catch {
    return {
      status: 'offline',
      hasApiKey: false,
      defaultModel: 'gemini-3.1-flash-lite',
      liveModel: 'gemini-3.8-live',
    };
  }
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

  const response = await fetch('/api/gemini/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Server returned HTTP ${response.status}`);
  }

  const data = await response.json();
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
