import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus,
  CheckSquare,
  BookOpen,
  DollarSign,
  Milestone as MilestoneIcon,
  Flame,
  CornerDownLeft,
  Sparkles,
  Quote,
  Film,
  Book,
} from 'lucide-react';
import { QuickCaptureType, Priority } from '../types';
import { Sound } from '../utils/audio';

interface QuickCaptureBarProps {
  onCaptureTask: (title: string, priority: Priority, category: string) => void;
  onCaptureJournal: (title: string, content: string) => void;
  onCaptureExpense: (name: string, amount: number, category: string) => void;
  onCaptureMilestone: (title: string, year: number, category: string) => void;
  onCaptureHabit: (title: string, category: string) => void;
  onCaptureQuote?: (text: string, author: string, category: string) => void;
  onCaptureMedia?: (title: string, creator: string, type: 'movie' | 'book') => void;
  soundEnabled: boolean;
}

const MODES: { type: QuickCaptureType; label: string; icon: React.ReactNode; color: string; hint: string }[] = [
  { type: 'task', label: 'Task', icon: <CheckSquare className="w-3.5 h-3.5" />, color: 'text-blue-500', hint: 'e.g. Ship v2.0 benchmark report (use #urgent, #high, #medium)' },
  { type: 'journal', label: 'Journal', icon: <BookOpen className="w-3.5 h-3.5" />, color: 'text-amber-500', hint: 'e.g. Breakthrough on client-side state architecture' },
  { type: 'expense', label: 'Expense', icon: <DollarSign className="w-3.5 h-3.5" />, color: 'text-emerald-500', hint: 'e.g. Cursor Pro $20 (auto-detects amount)' },
  { type: 'quote', label: 'Quote', icon: <Quote className="w-3.5 h-3.5" />, color: 'text-amber-500', hint: 'e.g. "Stay hungry, stay foolish" — Steve Jobs' },
  { type: 'habit', label: 'Habit', icon: <Flame className="w-3.5 h-3.5" />, color: 'text-rose-500', hint: 'e.g. 30min Technical Writing' },
  { type: 'media', label: 'Media / Book', icon: <Film className="w-3.5 h-3.5" />, color: 'text-purple-500', hint: 'e.g. Dune (Book) or Oppenheimer (Movie)' },
  { type: 'milestone', label: 'Milestone', icon: <MilestoneIcon className="w-3.5 h-3.5" />, color: 'text-teal-500', hint: 'e.g. 2026 Launched hyper-scale edge node' },
];

export const QuickCaptureBar: React.FC<QuickCaptureBarProps> = ({
  onCaptureTask,
  onCaptureJournal,
  onCaptureExpense,
  onCaptureMilestone,
  onCaptureHabit,
  onCaptureQuote,
  onCaptureMedia,
  soundEnabled,
}) => {
  const [activeMode, setActiveMode] = useState<QuickCaptureType>('task');
  const [inputValue, setInputValue] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global '/' keyboard shortcut to jump focus to Quick Capture Bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement !== inputRef.current &&
        !['INPUT', 'TEXTAREA'].includes((document.activeElement as HTMLElement)?.tagName)
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      const text = inputValue.trim();
      if (!text) return;

      Sound.success(soundEnabled);

      if (activeMode === 'task') {
        let detectedPriority = priority;
        let cleanText = text;

        if (text.toLowerCase().includes('#urgent')) {
          detectedPriority = 'urgent';
          cleanText = text.replace(/#urgent/gi, '').trim();
        } else if (text.toLowerCase().includes('#high')) {
          detectedPriority = 'high';
          cleanText = text.replace(/#high/gi, '').trim();
        } else if (text.toLowerCase().includes('#low')) {
          detectedPriority = 'low';
          cleanText = text.replace(/#low/gi, '').trim();
        }

        onCaptureTask(cleanText, detectedPriority, 'Work');
      } else if (activeMode === 'journal') {
        onCaptureJournal(text.slice(0, 40), text);
      } else if (activeMode === 'expense') {
        const match = text.match(/\$?(\d+(\.\d{1,2})?)/);
        const amount = match ? parseFloat(match[1]) : 15;
        const name = text.replace(/\$?(\d+(\.\d{1,2})?)/, '').trim() || text;
        onCaptureExpense(name, amount, 'Tech & SaaS');
      } else if (activeMode === 'quote') {
        const parts = text.split(/—|-/);
        const quoteText = parts[0]?.trim().replace(/^["']|["']$/g, '') || text;
        const author = parts[1]?.trim() || 'Unknown';
        onCaptureQuote?.(quoteText, author, 'Inspiration');
      } else if (activeMode === 'media') {
        const isBook = text.toLowerCase().includes('book') || text.toLowerCase().includes('read');
        const cleanTitle = text.replace(/\(book\)|\(movie\)/gi, '').trim();
        onCaptureMedia?.(cleanTitle, 'Unknown', isBook ? 'book' : 'movie');
      } else if (activeMode === 'milestone') {
        const yearMatch = text.match(/\b(19\d\d|20\d\d)\b/);
        const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();
        const title = text.replace(/\b(19\d\d|20\d\d)\b/, '').trim() || text;
        onCaptureMilestone(title, year, 'Career');
      } else if (activeMode === 'habit') {
        onCaptureHabit(text, 'Productivity');
      }

      setInputValue('');
    },
    [
      inputValue,
      activeMode,
      priority,
      onCaptureTask,
      onCaptureJournal,
      onCaptureExpense,
      onCaptureQuote,
      onCaptureMedia,
      onCaptureMilestone,
      onCaptureHabit,
      soundEnabled,
    ]
  );

  const currentConfig = MODES.find((m) => m.type === activeMode) || MODES[0];

  return (
    <div
      id="quick-capture-container"
      className={`relative w-full rounded-2xl transition-all duration-200 border ${
        isFocused
          ? 'bg-white dark:bg-[#111827] border-[#6366F1] shadow-md ring-1 ring-[#6366F1]'
          : 'bg-white dark:bg-[#111827] border-[#EDECE9] dark:border-[#1F2937] shadow-xs'
      }`}
    >
      <form onSubmit={handleSubmit} className="p-3 sm:p-4">
        {/* Mode Selector Tabs */}
        <div className="flex items-center justify-between gap-2 mb-2.5 pb-2 border-b border-[#EDECE9] dark:border-[#1F2937] flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-mono font-bold text-[#787774] dark:text-[#9CA3AF] uppercase tracking-wider mr-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#6366F1]" />
              Quick Capture:
            </span>
            {MODES.map((mode) => {
              const isSelected = activeMode === mode.type;
              return (
                <button
                  key={mode.type}
                  type="button"
                  onClick={() => {
                    Sound.click(soundEnabled);
                    setActiveMode(mode.type);
                    inputRef.current?.focus();
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#37352F] text-white dark:bg-white dark:text-[#111827] shadow-2xs'
                      : 'text-[#787774] dark:text-[#9CA3AF] hover:bg-[#F1F1EF] dark:hover:bg-[#1F2937]'
                  }`}
                >
                  <span className={isSelected ? 'text-inherit' : mode.color}>{mode.icon}</span>
                  <span>{mode.label}</span>
                </button>
              );
            })}
          </div>

          {activeMode === 'task' && (
            <div className="flex items-center gap-1">
              {(['urgent', 'high', 'medium', 'low'] as Priority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    Sound.click(soundEnabled);
                    setPriority(p);
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold transition-all cursor-pointer ${
                    priority === p
                      ? p === 'urgent'
                        ? 'bg-rose-500 text-white'
                        : p === 'high'
                        ? 'bg-amber-500 text-white'
                        : 'bg-[#6366F1] text-white'
                      : 'text-[#9CA3AF] hover:text-[#37352F] dark:hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Input Row */}
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={currentConfig.hint}
            className="flex-1 text-xs sm:text-sm bg-transparent text-[#37352F] dark:text-[#F3F4F6] placeholder:text-[#9CA3AF] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-semibold transition-all disabled:opacity-30 cursor-pointer shadow-2xs shrink-0"
          >
            <span>Add</span>
            <CornerDownLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
};
