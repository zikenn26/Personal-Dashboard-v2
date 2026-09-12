import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  Trash2,
  Maximize2,
  CheckCircle2,
  CornerDownLeft,
  Bot,
  User,
  ShieldCheck,
  Zap,
  AlertCircle,
} from 'lucide-react';
import {
  ChatMessage,
  sendSecretaryMessage,
  GROQ_MODEL,
} from '../services/groqService';

interface AISecretaryWidgetProps {
  dragHandle?: React.ReactNode;
  onNavigate?: (view: any) => void;
  className?: string;
  isExpandedView?: boolean;
}

const STORAGE_KEY = 'ai_secretary_chat_history_v1';

const INITIAL_SUGGESTIONS = [
  'What are my pending tasks?',
  'Analyze my spending',
  'Check off today’s habits',
  'Add task "Submit project report" (urgent)',
];

export const AISecretaryWidget: React.FC<AISecretaryWidgetProps> = ({
  dragHandle,
  onNavigate,
  className = '',
  isExpandedView = false,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [
      {
        id: 'welcome',
        role: 'assistant',
        content:
          'Hello! I am your AI Executive Secretary powered by Groq. I can autonomously fetch your live tasks, habits, spending, goals, and journal, or directly execute actions for you. How can I assist today?',
        timestamp: Date.now(),
      },
    ];
  });

  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Save conversation history to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages]);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputPrompt).trim();
    if (!text || isLoading) return;

    setInputPrompt('');
    setIsLoading(true);

    const userMessage: ChatMessage = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    // Optimistically show user message immediately
    const nextHistoryWithUser = [...messages, userMessage];
    setMessages(nextHistoryWithUser);

    try {
      const result = await sendSecretaryMessage(text, messages);
      if (result.updatedHistory && result.updatedHistory.length > 0) {
        setMessages(result.updatedHistory);
      } else {
        const fallbackMsg: ChatMessage = {
          id: 'msg-reply-' + Date.now(),
          role: 'assistant',
          content: result.reply || 'I processed your request.',
          actionChips: result.actionChips,
          timestamp: Date.now(),
        };
        setMessages([...nextHistoryWithUser, fallbackMsg]);
      }
    } catch (err: any) {
      const errorReply: ChatMessage = {
        id: 'msg-err-' + Date.now(),
        role: 'assistant',
        content: `⚠️ Error: ${err.message || 'Unable to connect to AI Secretary.'}`,
        timestamp: Date.now(),
      };
      setMessages([...nextHistoryWithUser, errorReply]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    const reset: ChatMessage[] = [
      {
        id: 'msg-reset-' + Date.now(),
        role: 'assistant',
        content:
          'Chat history cleared. I am ready for your next question or task instruction.',
        timestamp: Date.now(),
      },
    ];
    setMessages(reset);
  };

  return (
    <div
      className={`rounded-2xl bg-[#F7F7F5] dark:bg-[#1E293B] border border-[#E5E5E2] dark:border-[#334155] shadow-xs flex flex-col w-full ${
        isExpandedView ? 'h-[calc(100vh-140px)] min-h-[500px]' : 'min-h-[360px] max-h-[480px]'
      } ${className}`}
    >
      {/* Widget Header */}
      <div className="p-4 sm:px-5 pb-3 border-b border-[#EDECE9] dark:border-[#334155]/60 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5">
          {dragHandle}
          <div className="w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-900/40 flex items-center justify-center text-[#6366F1] dark:text-[#818CF8] shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#37352F] dark:text-white">
                AI Secretary
              </h3>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100/70 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Groq AI
              </span>
            </div>
            <p className="text-[11px] text-[#787774] dark:text-gray-400">
              Autonomous context fetch & actions
            </p>
          </div>
        </div>

        {/* Top Right Controls */}
        <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
          <button
            type="button"
            onClick={handleClearChat}
            title="Clear Chat History"
            className="p-1.5 rounded-lg hover:bg-gray-200/60 dark:hover:bg-gray-800 transition-colors cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {!isExpandedView && onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('assistant')}
              title="Expand to Full View"
              className="p-1.5 rounded-lg hover:bg-gray-200/60 dark:hover:bg-gray-800 transition-colors cursor-pointer text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Chat Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs text-[#37352F] dark:text-gray-200">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-6 h-6 rounded-lg bg-[#6366F1] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 leading-relaxed ${
                  isUser
                    ? 'bg-[#6366F1] text-white rounded-br-xs shadow-2xs'
                    : 'bg-white dark:bg-[#0F172A] border border-[#E5E5E2] dark:border-[#334155] rounded-bl-xs text-[#111827] dark:text-gray-100 shadow-2xs'
                }`}
              >
                {/* Action Confirmation & Lazy Context Fetching Chips */}
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
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="bg-white dark:bg-[#0F172A] border border-[#E5E5E2] dark:border-[#334155] rounded-xl rounded-bl-xs px-3.5 py-2.5 flex items-center gap-2 shadow-2xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6366F1] dark:text-[#818CF8]" />
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                Fetching live context & processing...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts (Only if 2 or fewer messages) */}
      {messages.length <= 2 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5 shrink-0">
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

      {/* Input Form Footer */}
      <div className="p-3 sm:px-4 bg-white dark:bg-[#0F172A] border-t border-[#EDECE9] dark:border-[#334155]/60 rounded-b-2xl shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Instruct secretary (e.g., 'Add task...', 'Analyze spending')..."
            disabled={isLoading}
            className="flex-1 bg-transparent px-2.5 py-1.5 text-xs text-[#111827] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-hidden disabled:opacity-50"
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
            Vault secrets protected
          </span>
          <span>Press Enter to send</span>
        </div>
      </div>
    </div>
  );
};
