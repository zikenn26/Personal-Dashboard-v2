import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkle,
  Sparkles,
  Send,
  Loader2,
  Trash2,
  Maximize2,
  CheckCircle2,
  CornerDownLeft,
  User,
  ShieldCheck,
  Zap,
  AlertCircle,
  KeyRound,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  X,
  RefreshCw,
  Mic,
  MicOff,
  Radio,
  Volume2,
  VolumeX,
  Bot,
  Sliders,
  ChevronDown,
  Activity,
} from 'lucide-react';
import {
  ChatMessage,
  sendSecretaryMessage,
  getActiveGroqModel,
  SUPPORTED_GROQ_MODELS,
  testGroqApiKey,
} from '../services/groqService';
import {
  sendGeminiMessage,
  speakTextWithGemini,
  stopGeminiSpeech,
  GEMINI_MODELS,
  GEMINI_ROLES,
  checkGeminiHealth,
  GeminiChatMessage,
} from '../services/geminiService';
import {
  matchCommandTrigger,
  executeCommandMapping,
} from '../services/commandMappingService';
import {
  executeInteractiveOption,
  InteractiveOption,
} from '../services/commandIntentEngine';
import { Storage } from '../utils/storage';
import { Sound } from '../utils/audio';
import { GeminiLiveVoiceModal } from './GeminiLiveVoiceModal';
import { WaveformVisualizer } from './WaveformVisualizer';

interface AISecretaryWidgetProps {
  dragHandle?: React.ReactNode;
  onNavigate?: (view: any, tabOrFilter?: string) => void;
  className?: string;
  isExpandedView?: boolean;
  isPopup?: boolean;
  onClosePopup?: () => void;
  onOpenCommandMappings?: () => void;
}

const STORAGE_KEY = 'ai_secretary_chat_history_v2';
const PROVIDER_KEY = 'zikenn_ai_provider';
const GEMINI_MODEL_KEY = 'zikenn_gemini_model';
const GEMINI_ROLE_KEY = 'zikenn_gemini_role';

const INITIAL_SUGGESTIONS = [
  'What are my pending tasks?',
  'Log an expense: ₹250 for lunch',
  'Check off today’s morning habit',
  'Add task "Complete weekly review" (urgent)',
];

export const AISecretaryWidget: React.FC<AISecretaryWidgetProps> = ({
  dragHandle,
  onNavigate,
  className = '',
  isExpandedView = false,
  isPopup = false,
  onClosePopup,
  onOpenCommandMappings,
}) => {
  // Engine Provider: 'gemini' (Default, with voice assist & commands) vs 'groq'
  const [provider, setProvider] = useState<'gemini' | 'groq'>(() => {
    return (localStorage.getItem(PROVIDER_KEY) as 'gemini' | 'groq') || 'gemini';
  });

  // Gemini Configuration State
  const [selectedGeminiModel, setSelectedGeminiModel] = useState<string>(() => {
    const saved = localStorage.getItem(GEMINI_MODEL_KEY);
    if (!saved || saved === 'gemini-3.8-flash') {
      return 'gemini-3.1-flash-lite';
    }
    return saved;
  });
  const [selectedRole, setSelectedRole] = useState<string>(() => {
    return localStorage.getItem(GEMINI_ROLE_KEY) || 'chief_of_staff';
  });
  const [isLiveVoiceModalOpen, setIsLiveVoiceModalOpen] = useState(false);
  const [isLiveListening, setIsLiveListening] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);

  // Voice Command Speech-to-Text State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Chat Messages State
  const [messages, setMessages] = useState<Array<ChatMessage | GeminiChatMessage>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return [
      {
        id: 'welcome',
        role: 'assistant',
        content:
          'Hello! I am your AI Secretary & Chief of Staff. You can speak to me using Live Voice, give voice commands, or type requests to manage your tasks, habits, and dashboard.',
        timestamp: Date.now(),
      },
    ];
  });

  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [executingOptionId, setExecutingOptionId] = useState<string | null>(null);
  const [disabledOptionMessageIds, setDisabledOptionMessageIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Settings & Keys panel
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [groqKeyInput, setGroqKeyInput] = useState(() => Storage.getGroqApiKey() || '');
  const [activeGroqModel, setActiveGroqModel] = useState(() => getActiveGroqModel());
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [groqKeySaved, setGroqKeySaved] = useState(false);
  const [groqTestStatus, setGroqTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [groqTestMsg, setGroqTestMsg] = useState('');

  // Persist chat history
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50)));
    } catch {
      // ignore
    }
  }, [messages]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const latestTranscriptRef = useRef<string>('');

  // Handle Voice Command Dictation (Speech Recognition)
  const handleToggleVoiceDictation = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      latestTranscriptRef.current = '';
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        Sound.click(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        latestTranscriptRef.current = transcript;
        setInputPrompt(transcript);
        // Play subtle confirmation sound that speech was successfully registered
        Sound.voiceRegistered(true);
      };

      recognition.onerror = (event: any) => {
        console.warn('Voice command recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = async () => {
        setIsListening(false);
        const spoken = latestTranscriptRef.current?.trim();
        if (spoken) {
          // Check if custom voice trigger matches
          const commandMatch = matchCommandTrigger(spoken);
          if (commandMatch) {
            Sound.voiceProcessing(true);
            const execResult = await executeCommandMapping(
              commandMatch.mapping,
              commandMatch.extractedParams
            );
            const assistantMessage: ChatMessage = {
              id: 'cmd-res-' + Date.now(),
              role: 'assistant',
              content: `🎯 **Voice Command Executed**: "${commandMatch.mapping.triggerPhrase}"\n\n• ${execResult.message}`,
              actionChips: execResult.actionChip ? [execResult.actionChip] : undefined,
              timestamp: Date.now(),
            };
            setMessages((prev) => [...prev, assistantMessage]);
            setInputPrompt('');
            Sound.success(true);
            speakTextWithGemini(`Done! ${execResult.message}`, 'Zephyr');
          } else {
            // Auto-send query to Zikenn AI
            handleSendMessage(spoken);
          }
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start voice recognition:', err);
      setIsListening(false);
    }
  };

  // Handle Reading Assistant Message Aloud via Gemini TTS
  const handleToggleSpeech = async (msgId: string, text: string) => {
    if (speakingMsgId === msgId) {
      stopGeminiSpeech();
      setSpeakingMsgId(null);
      return;
    }

    setSpeakingMsgId(msgId);
    await speakTextWithGemini(text, 'Zephyr', () => {
      setSpeakingMsgId(null);
    });
  };

  // Send Message (Supports both Gemini and Groq)
  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend !== undefined ? textToSend : inputPrompt).trim();
    if (!prompt || isLoading) return;

    // Play subtle audio feedback confirming AI begins processing
    Sound.voiceProcessing(true);

    // Stop active mic dictation if running
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    const userMessage: ChatMessage = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputPrompt('');
    setIsLoading(true);

    try {
      // 1. Intercept configured custom voice triggers & command mappings first
      const commandMatch = matchCommandTrigger(prompt);
      if (commandMatch) {
        const execResult = await executeCommandMapping(
          commandMatch.mapping,
          commandMatch.extractedParams
        );
        const assistantMessage: ChatMessage = {
          id: 'cmd-res-' + Date.now(),
          role: 'assistant',
          content: `🎯 **Custom Voice Trigger Activated**: "${commandMatch.mapping.triggerPhrase}"\n\nDirectly executed \`${commandMatch.mapping.actionType}\` with your configured parameters:\n• ${execResult.message}`,
          actionChips: execResult.actionChip ? [execResult.actionChip] : undefined,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setIsLoading(false);
        return;
      }

      if (provider === 'gemini') {
        const geminiHistory: GeminiChatMessage[] = messages.map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: m.timestamp,
        }));

        const result = await sendGeminiMessage({
          message: prompt,
          history: geminiHistory,
          model: selectedGeminiModel,
          roleId: selectedRole,
        });

        const assistantMessage: GeminiChatMessage = {
          id: 'gemini-' + Date.now(),
          role: 'assistant',
          content: result.reply,
          actionChips: result.actionChips,
          options: result.options,
          modelUsed: result.model,
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        // Groq Fallback Engine
        const groqHistory: ChatMessage[] = messages.map((m) => ({
          id: m.id,
          role: m.role as any,
          content: m.content,
          timestamp: m.timestamp,
        }));

        const res = await sendSecretaryMessage(prompt, groqHistory);

        const assistantMessage: ChatMessage = {
          id: 'groq-' + Date.now(),
          role: 'assistant',
          content: res.reply,
          actionChips: res.actionChips,
          options: res.options,
          pendingConfirmation: res.pendingConfirmation,
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: 'err-' + Date.now(),
        role: 'assistant',
        content: `Error: ${err?.message || 'Failed to process message.'}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleOptionClick = async (option: InteractiveOption, parentMsgId?: string) => {
    if (isLoading || executingOptionId) return;
    setExecutingOptionId(option.id);
    setIsLoading(true);
    if (parentMsgId) {
      setDisabledOptionMessageIds((prev) => new Set(prev).add(parentMsgId));
    }
    try {
      const res = await executeInteractiveOption(option);
      const assistantMessage: ChatMessage = {
        id: 'opt-' + Date.now(),
        role: 'assistant',
        content: res.message,
        actionChips: res.actionChips,
        options: res.options,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: 'err-' + Date.now(),
        role: 'assistant',
        content: `Error: ${err?.message || 'Failed to execute option.'}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setExecutingOptionId(null);
    }
  };

  const handleClearChat = () => {
    stopGeminiSpeech();
    setSpeakingMsgId(null);
    const reset: ChatMessage[] = [
      {
        id: 'welcome-' + Date.now(),
        role: 'assistant',
        content:
          'Chat history cleared. How can I assist you with your productivity, tasks, or study today?',
        timestamp: Date.now(),
      },
    ];
    setMessages(reset);
  };

  const handleSaveGroqKey = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = groqKeyInput.trim();
    Storage.setGroqApiKey(clean);
    setGroqKeySaved(true);
    setTimeout(() => setGroqKeySaved(false), 2000);
  };

  const handleTestGroqKey = async () => {
    if (!groqKeyInput.trim()) return;
    setGroqTestStatus('testing');
    setGroqTestMsg('Validating key with Groq API...');
    const result = await testGroqApiKey(groqKeyInput.trim());
    if (result.success) {
      setGroqTestStatus('success');
      setGroqTestMsg('Key verified successfully!');
      Storage.setGroqApiKey(groqKeyInput.trim());
    } else {
      setGroqTestStatus('error');
      setGroqTestMsg(result.message || 'Key validation failed.');
    }
  };

  return (
    <div
      className={
        isPopup
          ? `h-full flex flex-col w-full bg-white dark:bg-[#1E293B] ${className}`
          : `grid-tile rounded-2xl bg-[#F7F7F5] dark:bg-[#23324C] border border-[#E5E5E2] dark:border-[#334155] shadow-xs flex flex-col w-full ${
              isExpandedView ? 'h-[calc(100vh-140px)] min-h-[500px]' : 'min-h-[380px] max-h-[500px]'
            } ${className}`
      }
    >
      {/* Widget Header */}
      <div className="p-3 sm:px-3.5 pb-2.5 border-b border-[#EDECE9] dark:border-[#334155]/60 flex items-center justify-between gap-2 shrink-0 bg-[#FAF9F6] dark:bg-[#23324C]">
        <div className="flex items-center gap-2.5 min-w-0">
          {dragHandle}
          <div className="w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-900/40 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-black dark:text-white truncate">
                AI Voice & Secretary
              </h3>
              <span
                className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"
                title="AI System Online"
              />
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
              {provider === 'gemini'
                ? `${GEMINI_MODELS.find((m) => m.id === selectedGeminiModel)?.name || 'Gemini'} • Voice Ready`
                : 'Groq Engine Active'}
            </p>
          </div>
        </div>

        {/* Top Right Controls */}
        <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 shrink-0">
          {/* Live Voice Assist Trigger Button with Waveform Visualizer */}
          <button
            type="button"
            onClick={() => setIsLiveVoiceModalOpen(true)}
            className={`px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-[11px] flex items-center gap-1.5 shadow-xs transition-all cursor-pointer hover:scale-105 active:scale-95 ${
              isLiveListening ? 'ring-2 ring-cyan-400 shadow-cyan-500/40' : ''
            }`}
            title="Launch Real-Time Gemini 3.8 Live Voice Conversation"
          >
            {isLiveListening ? (
              <WaveformVisualizer isActive={true} size="xs" colorTheme="cyan" barCount={4} />
            ) : (
              <Radio className="w-3.5 h-3.5 animate-pulse text-indigo-200" />
            )}
            <span className="hidden sm:inline">
              {isLiveListening ? 'Listening...' : 'Live Voice'}
            </span>
          </button>

          {/* Custom Voice Triggers / Command Mappings */}
          {onOpenCommandMappings && (
            <button
              type="button"
              onClick={onOpenCommandMappings}
              title="Voice Command Triggers & Mappings"
              className="p-1.5 rounded-lg hover:bg-amber-100/70 dark:hover:bg-amber-950/50 transition-colors cursor-pointer text-gray-500 hover:text-amber-600 dark:hover:text-amber-400"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
            </button>
          )}

          {/* Settings & Models Toggle */}
          <button
            type="button"
            onClick={() => setIsConfigOpen(!isConfigOpen)}
            title="AI Configuration & Models"
            className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs ${
              isConfigOpen
                ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300'
                : 'hover:bg-gray-200/60 dark:hover:bg-gray-800 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>

          {/* Clear Chat */}
          <button
            type="button"
            onClick={handleClearChat}
            title="Clear Chat History"
            className="p-1.5 rounded-lg hover:bg-gray-200/60 dark:hover:bg-gray-800 transition-colors cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Expand to Full View */}
          {((isPopup && onNavigate) || (!isExpandedView && !isPopup && onNavigate)) && (
            <button
              type="button"
              onClick={() => {
                if (onClosePopup) onClosePopup();
                if (onNavigate) onNavigate('assistant');
              }}
              title="Expand to Full View"
              className="p-1.5 rounded-lg hover:bg-gray-200/60 dark:hover:bg-gray-800 transition-colors cursor-pointer text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}

          {isPopup && onClosePopup && (
            <button
              type="button"
              onClick={onClosePopup}
              title="Close Zikenn AI"
              className="p-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950/60 transition-colors cursor-pointer text-gray-400 hover:text-rose-600 dark:hover:text-rose-400"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Model & AI Settings Configuration Drawer */}
      {isConfigOpen && (
        <div className="p-3.5 bg-indigo-50/70 dark:bg-[#1E1B4B]/50 border-b border-indigo-100 dark:border-indigo-900/50 animate-in slide-in-from-top-2 duration-150 shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                AI Engine & Persona Settings
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsConfigOpen(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Engine Selector Tabs */}
          <div className="flex gap-1.5 bg-white/60 dark:bg-black/20 p-1 rounded-xl border border-indigo-200/60 dark:border-indigo-800/40">
            <button
              type="button"
              onClick={() => {
                setProvider('gemini');
                localStorage.setItem(PROVIDER_KEY, 'gemini');
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                provider === 'gemini'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-indigo-50/50 dark:hover:bg-white/5'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Gemini AI (Voice & Live)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setProvider('groq');
                localStorage.setItem(PROVIDER_KEY, 'groq');
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                provider === 'groq'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-indigo-50/50 dark:hover:bg-white/5'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Groq (Legacy)</span>
            </button>
          </div>

          {/* Gemini Specific Controls */}
          {provider === 'gemini' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Gemini Model */}
              <div>
                <label className="text-[10px] font-bold text-indigo-900 dark:text-indigo-200 block mb-1">
                  Gemini Model:
                </label>
                <select
                  value={selectedGeminiModel}
                  onChange={(e) => {
                    const m = e.target.value;
                    setSelectedGeminiModel(m);
                    localStorage.setItem(GEMINI_MODEL_KEY, m);
                  }}
                  className="w-full py-1.5 px-2 rounded-lg text-[11px] bg-white dark:bg-[#0F172A] border border-indigo-200 dark:border-indigo-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  {GEMINI_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.badge})
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 block truncate">
                  {GEMINI_MODELS.find((m) => m.id === selectedGeminiModel)?.desc}
                </span>
              </div>

              {/* Gemini Persona / System Role */}
              <div>
                <label className="text-[10px] font-bold text-indigo-900 dark:text-indigo-200 block mb-1">
                  AI Persona / System Role:
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => {
                    const r = e.target.value;
                    setSelectedRole(r);
                    localStorage.setItem(GEMINI_ROLE_KEY, r);
                  }}
                  className="w-full py-1.5 px-2 rounded-lg text-[11px] bg-white dark:bg-[#0F172A] border border-indigo-200 dark:border-indigo-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  {GEMINI_ROLES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 block truncate">
                  {GEMINI_ROLES.find((r) => r.id === selectedRole)?.description}
                </span>
              </div>
            </div>
          ) : (
            /* Groq Configuration Panel */
            <form onSubmit={handleSaveGroqKey} className="space-y-2">
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <input
                    type={showGroqKey ? 'text' : 'password'}
                    value={groqKeyInput}
                    onChange={(e) => {
                      setGroqKeyInput(e.target.value);
                      setGroqTestStatus('idle');
                    }}
                    placeholder="Paste your Groq API key (gsk_...)"
                    className="w-full pl-2.5 pr-8 py-1.5 rounded-lg text-xs font-mono bg-white dark:bg-[#0F172A] border border-indigo-200 dark:border-indigo-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGroqKey(!showGroqKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                  >
                    {showGroqKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                </div>

                <button
                  type="submit"
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer shrink-0"
                >
                  {groqKeySaved ? <Check className="w-3.5 h-3.5" /> : <KeyRound className="w-3.5 h-3.5" />}
                  <span>{groqKeySaved ? 'Saved' : 'Save'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleTestGroqKey}
                  disabled={groqTestStatus === 'testing' || !groqKeyInput.trim()}
                  className="px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-800 hover:bg-gray-50 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>{groqTestStatus === 'testing' ? '...' : 'Test'}</span>
                </button>
              </div>

              {groqTestStatus !== 'idle' && (
                <div
                  className={`text-[10px] px-2.5 py-1 rounded-md flex items-center gap-1.5 ${
                    groqTestStatus === 'success'
                      ? 'bg-emerald-100/70 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : groqTestStatus === 'error'
                      ? 'bg-rose-100/70 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                      : 'bg-indigo-100/70 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                  }`}
                >
                  {groqTestStatus === 'success' ? (
                    <Check className="w-3 h-3 shrink-0 text-emerald-600" />
                  ) : groqTestStatus === 'error' ? (
                    <AlertCircle className="w-3 h-3 shrink-0 text-rose-600" />
                  ) : (
                    <RefreshCw className="w-3 h-3 shrink-0 animate-spin text-indigo-600" />
                  )}
                  <span className="truncate">{groqTestMsg}</span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1 border-t border-indigo-100 dark:border-indigo-900/40">
                <span className="text-[10px] font-semibold text-indigo-900 dark:text-indigo-200 shrink-0">
                  Groq Model:
                </span>
                <select
                  value={activeGroqModel}
                  onChange={(e) => {
                    const m = e.target.value;
                    setActiveGroqModel(m);
                    Storage.setGroqModel(m);
                  }}
                  className="flex-1 py-1 px-2 rounded-md text-[11px] bg-white dark:bg-[#0F172A] border border-indigo-200 dark:border-indigo-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  {SUPPORTED_GROQ_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </form>
          )}

          {/* Quick access to Voice Command Mapping */}
          {onOpenCommandMappings && (
            <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/40">
              <button
                type="button"
                onClick={onOpenCommandMappings}
                className="w-full py-1.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-200 text-xs font-semibold flex items-center justify-between transition-colors border border-amber-200/60 dark:border-amber-800/40 cursor-pointer shadow-2xs"
              >
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
                  <span>Custom Voice Triggers &amp; Command Mapping</span>
                </span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                  Configure →
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Chat Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs text-[#37352F] dark:text-gray-200">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const isSpeaking = speakingMsgId === msg.id;

          return (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-900/40 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 leading-relaxed ${
                  isUser
                    ? 'bg-[#6366F1] text-white rounded-br-xs shadow-2xs'
                    : 'bg-white dark:bg-[#0F172A] border border-[#E5E5E2] dark:border-[#334155] rounded-bl-xs text-[#111827] dark:text-gray-100 shadow-2xs'
                }`}
              >
                {/* Action Confirmation & Context Fetching Chips */}
                {msg.actionChips && msg.actionChips.length > 0 && (
                  <div className="flex flex-col gap-1.5 mb-2.5 pb-2 border-b border-gray-100 dark:border-gray-800/80">
                    {msg.actionChips.map((chip, idx) => {
                      const isContextFetch = chip.startsWith('⚡');
                      const isMutation = chip.startsWith('✓');
                      const isWarning = chip.startsWith('⚠️');

                      if (isContextFetch) {
                        return (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-indigo-50/90 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60 shadow-2xs"
                          >
                            <Zap className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                            <span>{chip.replace(/^⚡\s*/, '')}</span>
                          </span>
                        );
                      }

                      if (isWarning) {
                        return (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-amber-50/90 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/60 shadow-2xs"
                          >
                            <AlertCircle className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span>{chip.replace(/^⚠️\s*/, '')}</span>
                          </span>
                        );
                      }

                      return (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-emerald-50/90 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 shadow-2xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>{chip.replace(/^✓\s*/, '')}</span>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Main Message Text */}
                <div className="whitespace-pre-wrap font-sans text-xs">
                  {msg.content}
                </div>

                {/* Interactive Selection Options (Pills) */}
                {(msg as any).options && (msg as any).options.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-800/80 flex flex-wrap gap-1.5">
                    {disabledOptionMessageIds.has(msg.id) ? (
                      <span className="text-[11px] italic text-gray-400 dark:text-gray-500 py-0.5">
                        Selection processed
                      </span>
                    ) : (
                      (msg as any).options.map((opt: InteractiveOption) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleOptionClick(opt, msg.id)}
                          disabled={isLoading || executingOptionId !== null}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                            opt.variant === 'danger' || opt.isDestructive
                              ? 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60'
                              : opt.variant === 'cancel' || opt.id.startsWith('cancel') || opt.id === 'opt-cancel'
                              ? 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                              : 'bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60'
                          }`}
                        >
                          {(opt.variant === 'danger' || opt.isDestructive) && <Trash2 className="w-3 h-3 text-rose-500" />}
                          <span>{opt.label}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {/* Speaker TTS Read Aloud Control (Assistant messages only) */}
                {!isUser && (
                  <div className="mt-2 pt-1.5 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between text-[10px] text-gray-400">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-gray-400">
                      {(msg as any).modelUsed || (provider === 'gemini' ? 'Gemini 3.8' : 'Groq')}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleSpeech(msg.id, msg.content)}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer ${
                        isSpeaking ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                      }`}
                      title={isSpeaking ? 'Stop speaking' : 'Read aloud with Gemini TTS'}
                    >
                      {isSpeaking ? (
                        <>
                          <VolumeX className="w-3 h-3 animate-pulse text-indigo-500" />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3 h-3" />
                          <span>Listen</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {isUser && (
                <div className="w-6 h-6 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex gap-2.5 justify-start">
            <div className="w-6 h-6 rounded-lg bg-[#6366F1] text-white flex items-center justify-center shrink-0 mt-0.5 animate-pulse">
              <Sparkle className="w-3.5 h-3.5 fill-white/20" />
            </div>
            <div className="bg-white dark:bg-[#0F172A] border border-[#E5E5E2] dark:border-[#334155] rounded-xl rounded-bl-xs px-3.5 py-2.5 flex items-center gap-2 shadow-2xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6366F1] dark:text-[#818CF8]" />
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                {provider === 'gemini'
                  ? 'Gemini processing command & dashboard tools...'
                  : 'Groq processing query...'}
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      {messages.length <= 2 && (
        <div className="hidden sm:flex px-4 pb-2 flex-wrap gap-1.5 shrink-0">
          {INITIAL_SUGGESTIONS.map((sugg, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSendMessage(sugg)}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-white dark:bg-[#0F172A] border border-[#E5E5E2] dark:border-[#334155] text-gray-600 dark:text-gray-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer text-left"
            >
              {sugg}
            </button>
          ))}
        </div>
      )}

      {/* Input Form Footer with Voice Dictation */}
      <div className="p-3 sm:px-4 bg-white dark:bg-[#0F172A] border-t border-[#EDECE9] dark:border-[#334155]/60 rounded-b-2xl shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          {/* Voice Command Dictation Button with Waveform Visualizer */}
          <button
            type="button"
            onClick={handleToggleVoiceDictation}
            className={`h-8 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              isListening
                ? 'bg-rose-600 text-white animate-pulse shadow-md shadow-rose-600/30 ring-2 ring-rose-400'
                : 'bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60'
            }`}
            title={isListening ? 'Stop voice dictation' : 'Click to speak voice command'}
          >
            {isListening ? (
              <>
                <WaveformVisualizer isActive={true} size="xs" colorTheme="white" barCount={4} />
                <MicOff className="w-3.5 h-3.5" />
              </>
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>

          <input
            ref={inputRef}
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isListening
                ? 'Listening to your voice command...'
                : "Ask anything or give a command (e.g. 'Add task...', 'Log expense')..."
            }
            disabled={isLoading}
            className={`flex-1 bg-transparent px-2.5 py-1.5 text-xs text-[#111827] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-hidden disabled:opacity-50 ${
              isListening ? 'font-medium text-indigo-600 dark:text-indigo-300' : ''
            }`}
          />

          <button
            type="submit"
            disabled={!inputPrompt.trim() || isLoading}
            className="w-8 h-8 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] disabled:bg-gray-200 dark:disabled:bg-gray-800 text-white disabled:text-gray-400 flex items-center justify-center transition-colors cursor-pointer disabled:cursor-not-allowed shrink-0 shadow-2xs"
            title="Send Message"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </form>

        <div className="flex items-center justify-between mt-1 px-1 text-[10px] text-gray-400 dark:text-gray-500">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            Live Voice & Function Calling Enabled
          </span>
          <div className="flex items-center gap-2">
            {isListening && (
              <span className="text-rose-500 font-semibold animate-pulse">
                ● Recording Voice...
              </span>
            )}
            <span>Press Enter to send</span>
          </div>
        </div>
      </div>

      {/* Live Voice Modal */}
      <GeminiLiveVoiceModal
        isOpen={isLiveVoiceModalOpen}
        onClose={() => setIsLiveVoiceModalOpen(false)}
        onNavigate={onNavigate}
        onListeningChange={(listening) => setIsLiveListening(listening)}
        onOpenCommandMappings={onOpenCommandMappings}
      />
    </div>
  );
};
