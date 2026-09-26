import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Mic,
  MicOff,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RotateCcw,
} from 'lucide-react';
import { nativeService } from '../../../services/nativeService';
import {
  aiService,
  SessionMemory,
  SmartChipItem,
} from '../../../services/ai';
import { InteractiveOption } from '../../../services/commandIntentEngine';
import { MainNavView, UserProfile } from '../../../types';

export interface AndroidAssistantSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (view: MainNavView) => void;
  profile?: UserProfile;
  activeView?: string;
}

interface AssistantMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: number;
  chips?: string[];
  options?: InteractiveOption[];
  isError?: boolean;
}

export const AndroidAssistantSheet: React.FC<AndroidAssistantSheetProps> = ({
  isOpen,
  onClose,
  onNavigate,
  profile,
  activeView = 'home',
}) => {
  const [sessionMemory, setSessionMemory] = useState<SessionMemory>(() =>
    aiService.createInitialSessionMemory()
  );

  const [messages, setMessages] = useState<AssistantMessage[]>(() => [
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Hello ${
        profile?.name ? profile.name.split(' ')[0] : 'there'
      }! I'm Zikenn AI, your personal dashboard assistant. How can I help you today?`,
      timestamp: Date.now(),
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [micError, setMicError] = useState<string | null>(null);

  // Dynamic context-aware smart action chips
  const [smartChips, setSmartChips] = useState<SmartChipItem[]>([]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<any>(null);

  // Update dynamic action chips whenever sheet opens or activeView changes
  useEffect(() => {
    if (isOpen) {
      const chips = aiService.getSmartActionChips({ activeView });
      setSmartChips(chips);
    }
  }, [isOpen, activeView]);

  // Auto-scroll chat to latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setMicError(null);
    } else {
      // Stop listening if sheet closes
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsListening(false);
      // Reset session memory on close as required by OS-level assistant specs
      setSessionMemory(aiService.createInitialSessionMemory());
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, interimTranscript, isProcessing]);

  // Register with Android hardware back button
  useEffect(() => {
    if (!isOpen) return;
    const unregister = nativeService.registerBackButtonHandler(() => {
      onClose();
      return true; // handled
    });
    return unregister;
  }, [isOpen, onClose]);

  // Handle command submission
  const handleSendCommand = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isProcessing) return;

    void nativeService.triggerHaptic('selection');
    setInputText('');
    setInterimTranscript('');

    const userMsg: AssistantMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      // Process message through unified AIService layer
      const response = await aiService.processMessage(text, {
        activeView,
        sessionMemory,
      });

      // Update session memory for continuity in subsequent commands
      setSessionMemory(response.updatedSessionMemory);

      void nativeService.triggerHaptic(
        response.pendingConfirmation ? 'warning' : 'success'
      );

      const assistantMsg: AssistantMessage = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: response.reply,
        timestamp: Date.now(),
        chips: response.actionChips,
        options: response.options,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('Error in Android Assistant processing:', err);
      void nativeService.triggerHaptic('error');
      setMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          text: 'An error occurred while processing your request. Please try again.',
          timestamp: Date.now(),
          isError: true,
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle interactive confirmation option click
  const handleSelectOption = async (option: InteractiveOption) => {
    void nativeService.triggerHaptic('selection');
    setIsProcessing(true);

    try {
      const result = await aiService.executeOption(option);
      void nativeService.triggerHaptic(result.success ? 'success' : 'warning');

      setMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          text: result.message,
          timestamp: Date.now(),
          chips: result.actionChips,
        },
      ]);
    } catch (err) {
      void nativeService.triggerHaptic('error');
      setMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          text: 'Failed to execute confirmation option.',
          timestamp: Date.now(),
          isError: true,
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Voice Recognition Handler
  const handleToggleVoice = async () => {
    if (isListening) {
      // Stop listening
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      return;
    }

    setMicError(null);
    setInterimTranscript('');

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      // Fallback: Test microphone permission via mediaDevices
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((track) => track.stop());
          setMicError(
            'Speech recognition is not supported in this browser environment. You can type commands directly.'
          );
        } catch (err: any) {
          setMicError(
            'Microphone permission was denied. Please allow microphone access in Android settings to use voice input.'
          );
        }
      } else {
        setMicError('Audio input is not supported on this device.');
      }
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        void nativeService.triggerHaptic('selection');
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let finalStr = '';
        let interimStr = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalStr += transcript;
          } else {
            interimStr += transcript;
          }
        }
        if (interimStr) {
          setInterimTranscript(interimStr);
        }
        if (finalStr) {
          setIsListening(false);
          setInterimTranscript('');
          void handleSendCommand(finalStr);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          void nativeService.triggerHaptic('error');
          setMicError(
            'Microphone permission was denied. Please allow microphone access in Android settings to use voice input.'
          );
        } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setMicError(`Voice recognition error: ${event.error}. Please try typing instead.`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Failed to initialize speech recognition:', err);
      setIsListening(false);
      setMicError('Could not start voice recognition. Please verify microphone permission in settings.');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-xs transition-opacity duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Zikenn AI Assistant"
    >
      <div
        className="w-full max-w-lg mx-auto bg-[#F7F6FC] dark:bg-[#0B0F19] rounded-t-3xl border-t border-[#E8E5F3] dark:border-[#242D40] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden transition-transform duration-200 animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle & Header */}
        <div className="pt-2 px-4 pb-2 border-b border-[#E8E5F3] dark:border-[#1E2638] bg-white/80 dark:bg-[#121826]/80 backdrop-blur-md shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700 mx-auto mb-2" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white shadow-xs">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                  Zikenn AI
                </h3>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  Personal Dashboard Assistant
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                void nativeService.triggerHaptic('selection');
                onClose();
              }}
              className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              aria-label="Close Assistant"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Chat History & Suggested Actions */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3 min-h-[180px]">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.sender === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[85%] p-3 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-2xs ${
                  msg.sender === 'user'
                    ? 'bg-violet-600 text-white rounded-tr-xs'
                    : msg.isError
                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-900/60 rounded-tl-xs'
                    : 'bg-white dark:bg-[#1A2234] text-gray-800 dark:text-gray-100 border border-[#E8E5F3] dark:border-[#242D40] rounded-tl-xs'
                }`}
              >
                {msg.text}

                {/* Executed Action Chips */}
                {msg.chips && msg.chips.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    {msg.chips.map((chip, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 dark:bg-violet-950/80 text-violet-700 dark:text-violet-300"
                      >
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        {chip}
                      </span>
                    ))}
                  </div>
                )}

                {/* Destructive / Important Confirmation Options */}
                {msg.options && msg.options.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-gray-200 dark:border-gray-700/60 space-y-2">
                    <p className="text-[11px] font-bold text-gray-600 dark:text-gray-300">
                      Confirm action:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {msg.options.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleSelectOption(opt)}
                          disabled={isProcessing}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-xs ${
                            opt.variant === 'danger'
                              ? 'bg-rose-600 hover:bg-rose-700 text-white'
                              : opt.variant === 'cancel'
                              ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                              : 'bg-violet-600 hover:bg-violet-700 text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400 text-xs px-2 py-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Thinking & processing...</span>
            </div>
          )}

          {/* Live Voice Listening Banner */}
          {isListening && (
            <div className="p-3 rounded-2xl bg-violet-100/80 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-800/60 text-violet-900 dark:text-violet-200 flex items-center gap-2.5 animate-pulse">
              <div className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-bold block">Listening... speak now</span>
                <span className="text-xs italic truncate block text-violet-700 dark:text-violet-300">
                  {interimTranscript || 'Say: "What did I spend today?" or "Add a task"'}
                </span>
              </div>
            </div>
          )}

          {/* Microphone Permission / Error Notice */}
          {micError && (
            <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 flex items-start gap-2 text-xs">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{micError}</span>
              </div>
              <button
                type="button"
                onClick={() => setMicError(null)}
                className="text-amber-700 hover:text-amber-900 font-bold ml-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Context-Aware Smart Action Chips */}
          <div className="pt-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5 px-1">
              Context Suggestions
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {smartChips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => handleSendCommand(chip.prompt)}
                  disabled={isProcessing}
                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-gray-700 dark:text-gray-300 hover:border-violet-400 dark:hover:border-violet-600 hover:text-violet-600 dark:hover:text-violet-300 whitespace-nowrap shrink-0 transition-all cursor-pointer active:scale-95 shadow-2xs"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-white dark:bg-[#121826] border-t border-[#E8E5F3] dark:border-[#242D40] shrink-0 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSendCommand();
            }}
            className="flex items-center gap-2"
          >
            {/* Compact Voice Microphone Control */}
            <button
              type="button"
              onClick={handleToggleVoice}
              aria-label={isListening ? 'Stop listening' : 'Start voice input'}
              className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 transition-all cursor-pointer active:scale-95 shadow-2xs ${
                isListening
                  ? 'bg-rose-600 text-white ring-4 ring-rose-200 dark:ring-rose-950 animate-pulse'
                  : 'bg-violet-100 dark:bg-violet-950/80 text-violet-700 dark:text-violet-300 hover:bg-violet-200'
              }`}
              title="Voice Input"
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            {/* Text Input */}
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isListening ? 'Listening...' : 'Ask anything...'}
              disabled={isProcessing}
              className="flex-1 px-3.5 py-2 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-xs sm:text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={!inputText.trim() || isProcessing}
              aria-label="Send message"
              className="w-9 h-9 rounded-2xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center shrink-0 transition-all cursor-pointer active:scale-95 shadow-xs"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AndroidAssistantSheet;
