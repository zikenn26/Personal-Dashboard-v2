import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  UserProfile,
  TodoItem,
  HabitItem,
  JournalEntry,
  DashboardSection,
  Priority,
  TaskStatus,
  QuoteItem,
  LifeMilestone,
  ExpenseItem,
  MediaItem,
} from '../types';
import { Sound } from '../utils/audio';
import { triggerConfetti } from '../utils/confetti';
import { INITIAL_QUOTES } from '../utils/storage';
import { IndianCalendarWidget } from './IndianCalendarWidget';
import {
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowRight,
  Sparkles,
  Target,
  Flame,
  CreditCard,
  BookOpen,
  FileText,
  Quote,
  TrendingDown,
  TrendingUp,
  CheckSquare,
  Award,
  Edit3,
  X,
  ExternalLink,
  Sun,
  Layers,
  Send,
} from 'lucide-react';

interface SlidePhoto {
  id: string;
  url: string;
  title: string;
  subtitle?: string;
  tag?: string;
}

interface DashboardHomeViewProps {
  profile: UserProfile;
  todos: TodoItem[];
  habits: HabitItem[];
  journal: JournalEntry[];
  sections: DashboardSection[];
  photos: SlidePhoto[];
  quotes: QuoteItem[];
  milestones?: LifeMilestone[];
  expenses?: ExpenseItem[];
  media?: MediaItem[];
  onAddQuote: (quote: Omit<QuoteItem, 'id' | 'createdAt'>) => void;
  onDeleteQuote: (id: string) => void;
  onUpdateSections: (sections: DashboardSection[]) => void;
  onUpdatePhotos: (photos: SlidePhoto[]) => void;
  onNavigate: (view: any, tabOrFilter?: string) => void;
  onToggleTodo: (id: string) => void;
  onToggleHabitDay: (habitId: string, dayIndex: number) => void;
  onAddTodo?: (title: string, priority: Priority, category: string, dueDate?: string, status?: TaskStatus) => void;
  onAddExpense?: (item: Omit<ExpenseItem, 'id'>) => void;
  onAddHabit?: (title: string, category: string, icon: string, color: string) => void;
  soundEnabled: boolean;
}

const DEFAULT_QUOTES = INITIAL_QUOTES;

const formatTaskDueDate = (dueDate?: string): string => {
  if (!dueDate) return 'Today';
  const due = new Date(`${dueDate}T00:00:00`);
  const today = new Date();
  if (due.toDateString() === today.toDateString()) return 'Due Today';
  if (Number.isNaN(due.getTime())) return dueDate;
  return `Due ${due.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}`;
};

export const DashboardHomeView: React.FC<DashboardHomeViewProps> = ({
  profile,
  todos = [],
  habits = [],
  journal = [],
  quotes = [],
  milestones = [],
  expenses = [],
  media = [],
  onAddQuote,
  onNavigate,
  onToggleTodo,
  onToggleHabitDay,
  onAddTodo,
  onAddExpense,
  onAddHabit,
  soundEnabled,
}) => {
  // Current Day of Week Index (0 = Monday, 6 = Sunday)
  const todayIndex = useMemo(() => {
    const day = new Date().getDay(); // 0 is Sunday
    return day === 0 ? 6 : day - 1;
  }, []);

  // Time-based Greeting & Live Clock (Timezone Synchronized)
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const { greeting, greetingEmoji, formattedTimeStr, timezoneStr } = useMemo(() => {
    const hour = currentTime.getHours();
    let g = 'Good morning';
    let emoji = '🌅';
    if (hour >= 5 && hour < 12) {
      g = 'Good morning';
      emoji = '🌅';
    } else if (hour >= 12 && hour < 17) {
      g = 'Good afternoon';
      emoji = '☀️';
    } else if (hour >= 17 && hour < 21) {
      g = 'Good evening';
      emoji = '🌆';
    } else {
      g = 'Good night';
      emoji = '🌙';
    }

    const timeStr = currentTime.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    const dateStr = currentTime.toLocaleDateString([], {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';

    return {
      greeting: g,
      greetingEmoji: emoji,
      formattedTimeStr: `${dateStr} • ${timeStr}`,
      timezoneStr: tz,
    };
  }, [currentTime]);

  // Inspirational Quotes with 10-Second Auto-Slideshow & Prev/Next Controls
  const allQuotesList = useMemo(() => {
    return quotes && quotes.length > 0 ? quotes : DEFAULT_QUOTES;
  }, [quotes]);
  const [currentQuoteIdx, setCurrentQuoteIdx] = useState(0);
  const [isQuoteAutoPlay, setIsQuoteAutoPlay] = useState(true);
  const activeQuote = allQuotesList[currentQuoteIdx % allQuotesList.length];

  // 10-Second Auto-Slideshow Interval
  useEffect(() => {
    if (!isQuoteAutoPlay || allQuotesList.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentQuoteIdx((prev) => (prev + 1) % allQuotesList.length);
    }, 10000); // 10 seconds auto-rotation
    return () => clearInterval(interval);
  }, [isQuoteAutoPlay, allQuotesList.length]);

  const handlePrevQuote = () => {
    Sound.click(soundEnabled);
    setCurrentQuoteIdx((prev) => (prev - 1 + allQuotesList.length) % allQuotesList.length);
  };

  const handleNextQuote = () => {
    Sound.click(soundEnabled);
    setCurrentQuoteIdx((prev) => (prev + 1) % allQuotesList.length);
  };

  // Add Quote Popover state & outside-click collapse handler
  const [showAddQuotePopover, setShowAddQuotePopover] = useState(false);
  const [newQuoteText, setNewQuoteText] = useState('');
  const [newQuoteAuthor, setNewQuoteAuthor] = useState('');
  const [newQuoteCategory, setNewQuoteCategory] = useState('Inspiration');
  const quotePopoverRef = useRef<HTMLDivElement>(null);
  const quoteButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showAddQuotePopover) return;

    const handleDocumentClick = (event: MouseEvent | TouchEvent) => {
      if (
        quotePopoverRef.current &&
        !quotePopoverRef.current.contains(event.target as Node) &&
        quoteButtonRef.current &&
        !quoteButtonRef.current.contains(event.target as Node)
      ) {
        setShowAddQuotePopover(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    document.addEventListener('touchstart', handleDocumentClick);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('touchstart', handleDocumentClick);
    };
  }, [showAddQuotePopover]);

  const handleSaveNewQuote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuoteText.trim()) return;
    onAddQuote({
      text: newQuoteText.trim(),
      author: newQuoteAuthor.trim() || 'Anonymous',
      category: newQuoteCategory,
    });
    setNewQuoteText('');
    setNewQuoteAuthor('');
    setShowAddQuotePopover(false);
    setCurrentQuoteIdx(0); // View newly added quote
    Sound.success(soundEnabled);
  };

  // Inline Quick Add Task for Today
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [showQuickTaskInput, setShowQuickTaskInput] = useState(false);

  const handleCreateQuickTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTaskTitle.trim() || !onAddTodo) return;
    onAddTodo(
      quickTaskTitle.trim(),
      'medium',
      'Today',
      new Date().toISOString().split('T')[0],
      'todo'
    );
    setQuickTaskTitle('');
    setShowQuickTaskInput(false);
    Sound.click(soundEnabled);
  };

  // Inline Quick Add Habit
  const [showQuickHabitInput, setShowQuickHabitInput] = useState(false);
  const [quickHabitTitle, setQuickHabitTitle] = useState('');

  const handleCreateQuickHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickHabitTitle.trim() || !onAddHabit) return;
    onAddHabit(quickHabitTitle.trim(), 'Daily', '⚡', '#6366F1');
    setQuickHabitTitle('');
    setShowQuickHabitInput(false);
    Sound.success(soundEnabled);
  };

  // Inline Quick Add Expense
  const [showQuickExpenseModal, setShowQuickExpenseModal] = useState(false);
  const [quickExpenseName, setQuickExpenseName] = useState('');
  const [quickExpenseAmount, setQuickExpenseAmount] = useState('');
  const [quickExpenseCat, setQuickExpenseCat] = useState<'Food' | 'Transport' | 'Subscriptions' | 'Shopping' | 'Utilities'>('Food');

  const handleCreateQuickExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickExpenseName.trim() || !quickExpenseAmount || !onAddExpense) return;
    onAddExpense({
      name: quickExpenseName.trim(),
      amount: Number(quickExpenseAmount),
      category: quickExpenseCat,
      date: new Date().toISOString().split('T')[0],
      billingCycle: 'one-time',
      icon: '💳',
      active: true,
    });
    setQuickExpenseName('');
    setQuickExpenseAmount('');
    setShowQuickExpenseModal(false);
    Sound.success(soundEnabled);
  };

  // Metric Computations
  const pendingTodos = useMemo(() => todos.filter((t) => !t.completed), [todos]);
  const highPriorityCount = useMemo(
    () => pendingTodos.filter((t) => t.priority === 'high' || t.priority === 'urgent').length,
    [pendingTodos]
  );

  const habitStats = useMemo(() => {
    if (habits.length === 0) return { completed: 0, total: 0, percentage: 0 };
    const completed = habits.filter((h) => h.completedDays[todayIndex]).length;
    const total = habits.length;
    const percentage = Math.round((completed / total) * 100);
    return { completed, total, percentage };
  }, [habits, todayIndex]);

  const todayDateStr = new Date().toISOString().split('T')[0];
  const todayJournalCount = useMemo(
    () => journal.filter((j) => j.date === todayDateStr).length,
    [journal, todayDateStr]
  );

  // Real Dynamic Spending Stats derived from expenses prop
  const spendingStats = useMemo(() => {
    // Current week boundary: Monday to Sunday
    const now = new Date();
    const currentDayOfWeek = (now.getDay() + 6) % 7; // 0 for Mon, 6 for Sun
    const monday = new Date(now);
    monday.setDate(now.getDate() - currentDayOfWeek);
    monday.setHours(0, 0, 0, 0);

    const dayTotals = [0, 0, 0, 0, 0, 0, 0];
    expenses.forEach((e) => {
      if (!e.date) return;
      const expDate = new Date(e.date + 'T00:00:00');
      const diffTime = expDate.getTime() - monday.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= 6) {
        dayTotals[diffDays] += (Number(e.amount) || 0);
      }
    });

    const weeklyTotal = dayTotals.reduce((a, b) => a + b, 0);
    const allTimeTotal = expenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    // If no expenses in the exact current week date range, show all-time sum or weekly
    const displayWeekly = weeklyTotal > 0 ? weeklyTotal : (expenses.length > 0 ? allTimeTotal : 0);

    const maxDay = Math.max(...dayTotals, 1);
    const dayPercentages = dayTotals.map((tot) => {
      if (tot === 0) return 0;
      return Math.min(100, Math.max(16, Math.round((tot / maxDay) * 100)));
    });

    // Dynamic Category Breakdown: Food, Transport, Subscriptions
    const foodTotal = expenses
      .filter((e) => {
        const c = (e.category || '').toLowerCase();
        return (
          c.includes('food') ||
          c.includes('grocer') ||
          c.includes('dining') ||
          c.includes('coffee') ||
          c.includes('snack')
        );
      })
      .reduce((a, c) => a + (Number(c.amount) || 0), 0);

    const transportTotal = expenses
      .filter((e) => {
        const c = (e.category || '').toLowerCase();
        return (
          c.includes('transit') ||
          c.includes('taxi') ||
          c.includes('transport') ||
          c.includes('fuel') ||
          c.includes('travel')
        );
      })
      .reduce((a, c) => a + (Number(c.amount) || 0), 0);

    const subsTotal = expenses
      .filter((e) => {
        const c = (e.category || '').toLowerCase();
        return (
          c.includes('subscript') ||
          c.includes('tech') ||
          c.includes('bill') ||
          c.includes('util') ||
          c.includes('rent')
        );
      })
      .reduce((a, c) => a + (Number(c.amount) || 0), 0);

    return {
      weekly: displayWeekly,
      dayTotals,
      dayPercentages,
      food: foodTotal,
      transport: transportTotal,
      subs: subsTotal,
      hasExpenses: expenses.length > 0,
    };
  }, [expenses]);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* ========================================================================= */}
      {/* 1. GREETING & HERO HEADER WITH FULL-LINE QUOTE */}
      {/* ========================================================================= */}
      <div className="space-y-1 pb-0">
        {/* Greeting Header with Timezone and Local Time Synchronization */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="workspace-heading font-extrabold text-[#37352F] dark:text-white tracking-tight flex items-center gap-2">
              <span>{greeting}, {profile.name}!</span>
              <span className="inline-block text-2xl">{greetingEmoji}</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#787774] dark:text-[#9CA3AF] mt-1 font-medium flex items-center gap-2">
              <span>Let&apos;s make today meaningful and productive.</span>
            </p>
          </div>

          {/* Local Time and Timezone Badge */}
          <div className="flex items-center gap-2 self-start sm:self-center px-3 py-1.5 rounded-xl bg-white dark:bg-[#1E293B] border border-[#EDECE9] dark:border-[#334155] shadow-2xs text-xs font-mono text-[#64748B] dark:text-[#94A3B8]">
            <Clock className="w-3.5 h-3.5 text-[#6366F1]" />
            <span>{formattedTimeStr}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-sans hidden md:inline">
              {timezoneStr}
            </span>
          </div>
        </div>

        {/* Full-Line Quote Banner with 10s Auto-Slideshow, Prev/Next Controls & Life Section Link (1.5x Scaled) */}
        <div
          onMouseEnter={() => setIsQuoteAutoPlay(false)}
          onMouseLeave={() => setIsQuoteAutoPlay(true)}
          className="relative w-full px-5 py-4 sm:px-6 sm:py-5 rounded-2xl bg-[#F8FAFC] dark:bg-[#1E293B] border border-[#EDECE9] dark:border-[#334155] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-6 transition-all group"
        >
          <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200/70 dark:border-amber-900/50 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400 shadow-2xs mt-0.5 sm:mt-0">
              <Quote className="w-5 h-5" />
            </div>
            <div className="min-w-0 space-y-1.5 flex-1">
              <p className="text-sm sm:text-base md:text-lg font-serif italic text-[#1E293B] dark:text-[#F3F4F6] leading-relaxed">
                &ldquo;{activeQuote.text}&rdquo;
              </p>
              <div className="flex items-center gap-2.5 text-xs text-[#64748B] dark:text-[#94A3B8] flex-wrap">
                <span className="font-semibold text-[#475569] dark:text-[#CBD5E1]">— {activeQuote.author}</span>
                {allQuotesList.length > 1 && (
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-[#EDECE9]/80 dark:bg-[#0F172A] text-[#64748B] dark:text-[#94A3B8] border border-[#E2E8F0] dark:border-[#334155]">
                    {currentQuoteIdx + 1} of {allQuotesList.length} • 10s auto
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center pl-14 sm:pl-0 flex-wrap">
            {/* Previous & Next Quote Buttons */}
            {allQuotesList.length > 1 && (
              <div className="flex items-center gap-1 bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] rounded-xl p-1 shadow-2xs">
                <button
                  type="button"
                  onClick={handlePrevQuote}
                  title="Previous quote"
                  className="p-1.5 rounded-lg text-[#64748B] hover:text-[#6366F1] dark:hover:text-white hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNextQuote}
                  title="Next quote"
                  className="p-1.5 rounded-lg text-[#64748B] hover:text-[#6366F1] dark:hover:text-white hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Quick Link to Life OS Quotes Section */}
            <button
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                onNavigate('quotes');
              }}
              title="Manage all quotes in Life section"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] text-[#475569] dark:text-[#CBD5E1] hover:text-[#6366F1] hover:bg-[#EEF2FF] dark:hover:bg-[#1E1B4B] transition-colors cursor-pointer shadow-2xs"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#6366F1]" />
              <span>Quotes Tab</span>
            </button>

            {/* Add Quote Button */}
            <button
              ref={quoteButtonRef}
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                setShowAddQuotePopover((prev) => !prev);
              }}
              title="Add quote to collection"
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                showAddQuotePopover
                  ? 'bg-[#6366F1] text-white'
                  : 'bg-[#6366F1] text-white hover:bg-[#4F46E5]'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>

          {/* Floating Collapsible Add Quote Popover Form (Collapses when clicking anywhere outside) */}
          {showAddQuotePopover && (
            <div
              ref={quotePopoverRef}
              className="absolute right-0 top-full mt-2 w-80 sm:w-96 z-50 p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#EDECE9] dark:border-[#334155] shadow-xl animate-in fade-in slide-in-from-top-2"
            >
              <div className="flex items-center justify-between pb-2 border-b border-[#EDECE9] dark:border-[#334155]">
                <div className="flex items-center gap-2">
                  <Quote className="w-3.5 h-3.5 text-[#6366F1]" />
                  <h4 className="text-xs font-bold text-[#37352F] dark:text-white">
                    Add New Inspirational Quote
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddQuotePopover(false)}
                  className="text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <form onSubmit={handleSaveNewQuote} className="space-y-2.5 pt-3">
                <div>
                  <label className="block text-[10px] font-semibold text-[#787774] dark:text-[#9CA3AF] mb-1">
                    Quote Text
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="e.g. The journey of a thousand miles begins with one step."
                    value={newQuoteText}
                    onChange={(e) => setNewQuoteText(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A] text-xs text-[#37352F] dark:text-white focus:outline-hidden focus:border-[#6366F1]"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-[#787774] dark:text-[#9CA3AF] mb-1">
                      Author
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Lao Tzu"
                      value={newQuoteAuthor}
                      onChange={(e) => setNewQuoteAuthor(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A] text-xs text-[#37352F] dark:text-white focus:outline-hidden focus:border-[#6366F1]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-[#787774] dark:text-[#9CA3AF] mb-1">
                      Category
                    </label>
                    <select
                      value={newQuoteCategory}
                      onChange={(e) => setNewQuoteCategory(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A] text-xs text-[#37352F] dark:text-white focus:outline-hidden"
                    >
                      <option value="Inspiration">Inspiration</option>
                      <option value="Focus">Focus</option>
                      <option value="Discipline">Discipline</option>
                      <option value="Wisdom">Wisdom</option>
                      <option value="Mindset">Mindset</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1 border-t border-[#EDECE9]/60 dark:border-[#334155]/60">
                  <button
                    type="button"
                    onClick={() => setShowAddQuotePopover(false)}
                    className="px-3 py-1 text-xs font-semibold text-gray-500 hover:text-gray-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Save Quote
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MAIN COMMAND CENTER GRID (3 Columns: Indian Calendar, Tasks & Spending, Habits & Quick Capture) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* ================= COLUMN 1: INDIAN CALENDAR & EVENT TRACKER (Organized & Decluttered) ================= */}
        <div className="space-y-6">
          <IndianCalendarWidget
            todos={todos}
            onAddTodo={onAddTodo}
            onToggleTodo={onToggleTodo}
            onNavigate={onNavigate}
            soundEnabled={soundEnabled}
          />
        </div>

        {/* ================= COLUMN 2: TASKS & SPENDING SNAPSHOT ================= */}
        <div className="space-y-6">
          {/* Card: Today's Tasks (Keeps completed tasks with strike-through instead of disappearing) */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#EDECE9] dark:border-[#334155] shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-emerald-500" />
                <h2 className="text-xs uppercase font-bold text-[#37352F] dark:text-white tracking-wider">
                  Today&apos;s Tasks
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  Sound.click(soundEnabled);
                  onNavigate('tasks');
                }}
                className="text-xs text-[#6366F1] dark:text-[#818CF8] hover:underline font-semibold cursor-pointer"
              >
                View all
              </button>
            </div>

            {/* Task list with strike-through for completed items */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {todos.length === 0 ? (
                <div className="p-6 text-center bg-[#F8FAFC] dark:bg-[#0F172A] rounded-xl border border-dashed border-[#E2E8F0] dark:border-[#334155]">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1 opacity-80" />
                  <p className="text-xs font-semibold text-[#37352F] dark:text-white">No tasks created yet</p>
                  <p className="text-[11px] text-[#787774] dark:text-[#9CA3AF] mt-0.5">
                    Add a task below to plan your day.
                  </p>
                </div>
              ) : (
                todos.slice(0, 5).map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all group ${
                      task.completed
                        ? 'bg-gray-50/70 dark:bg-[#0F172A]/50 border-gray-200/60 dark:border-gray-800/60 opacity-60'
                        : 'bg-[#F8FAFC] dark:bg-[#0F172A] border-[#E2E8F0] dark:border-[#334155] hover:border-[#CBD5E1]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => {
                          Sound.click(soundEnabled);
                          onToggleTodo(task.id);
                        }}
                        className={`transition-colors cursor-pointer shrink-0 ${
                          task.completed
                            ? 'text-emerald-500 hover:text-emerald-600'
                            : 'text-[#9CA3AF] hover:text-emerald-600'
                        }`}
                        title={task.completed ? 'Mark incomplete' : 'Mark complete'}
                      >
                        {task.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-100 dark:fill-emerald-950" />
                        ) : (
                          <Circle className="w-4 h-4" />
                        )}
                      </button>
                      <span
                        className={`text-xs truncate ${
                          task.completed
                            ? 'line-through text-gray-400 dark:text-gray-500 font-normal'
                            : 'text-[#37352F] dark:text-white font-medium'
                        }`}
                      >
                        {task.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                          task.completed
                            ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                            : task.priority === 'urgent' || task.priority === 'high'
                            ? 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400'
                            : task.priority === 'medium'
                            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                            : 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {task.priority === 'urgent' ? 'Urgent' : task.priority === 'high' ? 'High' : task.priority === 'medium' ? 'Medium' : 'Low'}
                      </span>
                      <span className="text-[10px] text-[#94A3B8] font-mono hidden sm:inline">
                        {formatTaskDueDate(task.dueDate)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Quick Add Task Field */}
            {showQuickTaskInput ? (
              <form onSubmit={handleCreateQuickTask} className="flex gap-2 pt-1">
                <input
                  type="text"
                  required
                  placeholder="Task title..."
                  value={quickTaskTitle}
                  onChange={(e) => setQuickTaskTitle(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs text-[#37352F] dark:text-white focus:outline-hidden focus:border-[#6366F1]"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#6366F1] text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuickTaskInput(false)}
                  className="px-2 py-1.5 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowQuickTaskInput(true)}
                className="w-full py-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-[#6366F1] hover:bg-[#EEF2FF] dark:hover:bg-[#1E1B4B] rounded-xl transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Task</span>
              </button>
            )}
          </div>

          {/* Card: Spending Snapshot */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#EDECE9] dark:border-[#334155] shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-purple-500" />
                <h2 className="text-xs uppercase font-bold text-[#37352F] dark:text-white tracking-wider">
                  Spending Snapshot
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  Sound.click(soundEnabled);
                  onNavigate('expenses');
                }}
                className="text-xs text-[#6366F1] dark:text-[#818CF8] hover:underline font-semibold cursor-pointer"
              >
                View all
              </button>
            </div>

            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-lg sm:text-xl font-extrabold text-[#37352F] dark:text-white">
                  ₹{spendingStats.weekly.toLocaleString()}
                </span>
                <span className="text-xs text-[#787774] dark:text-[#9CA3AF] ml-2 font-medium">
                  {spendingStats.hasExpenses ? 'This week' : 'No expenses logged'}
                </span>
              </div>
              {spendingStats.hasExpenses ? (
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-lg">
                  <CreditCard className="w-3 h-3" />
                  <span>{expenses.length} logged</span>
                </span>
              ) : (
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-lg">
                  Clean sheet
                </span>
              )}
            </div>

            {/* 7-Day Visualizer Bar Chart */}
            <div className="grid grid-cols-7 gap-1.5 pt-2 items-end h-16">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
                const isToday = i === todayIndex;
                const daySpend = spendingStats.dayTotals[i];
                const pct = spendingStats.dayPercentages[i];
                return (
                  <div key={day} className="flex flex-col items-center gap-1" title={`${day}: ₹${daySpend}`}>
                    <div className="w-full bg-gray-100 dark:bg-gray-800/80 rounded-sm h-12 flex items-end relative overflow-hidden">
                      <div
                        style={{ height: `${pct > 0 ? pct : 6}%` }}
                        className={`w-full rounded-sm transition-all duration-300 ${
                          pct === 0
                            ? 'bg-gray-300/40 dark:bg-gray-700/40'
                            : isToday
                            ? 'bg-[#6366F1]'
                            : 'bg-indigo-300 dark:bg-indigo-600'
                        }`}
                      />
                    </div>
                    <span
                      className={`text-[9px] font-mono ${
                        isToday ? 'font-bold text-[#6366F1]' : 'text-[#94A3B8]'
                      }`}
                    >
                      {day}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Category Breakdown list */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#EDECE9]/70 dark:border-[#334155]/60 text-center">
              <div className="p-1.5 rounded-lg bg-[#F8FAFC] dark:bg-[#0F172A]">
                <p className="text-[10px] text-[#787774] dark:text-[#9CA3AF]">Food</p>
                <p className="text-xs font-bold text-[#37352F] dark:text-white">₹{spendingStats.food.toLocaleString()}</p>
              </div>
              <div className="p-1.5 rounded-lg bg-[#F8FAFC] dark:bg-[#0F172A]">
                <p className="text-[10px] text-[#787774] dark:text-[#9CA3AF]">Transport</p>
                <p className="text-xs font-bold text-[#37352F] dark:text-white">₹{spendingStats.transport.toLocaleString()}</p>
              </div>
              <div className="p-1.5 rounded-lg bg-[#F8FAFC] dark:bg-[#0F172A]">
                <p className="text-[10px] text-[#787774] dark:text-[#9CA3AF]">Subscriptions</p>
                <p className="text-xs font-bold text-[#37352F] dark:text-white">₹{spendingStats.subs.toLocaleString()}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowQuickExpenseModal(true)}
              className="w-full py-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-[#6366F1] hover:bg-[#EEF2FF] dark:hover:bg-[#1E1B4B] rounded-xl transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Expense</span>
            </button>
          </div>
        </div>

        {/* ================= COLUMN 3: HABITS & QUICK CAPTURE ================= */}
        <div className="space-y-6">
          {/* Card: Today's Habits */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#EDECE9] dark:border-[#334155] shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-500" />
                <h2 className="text-xs uppercase font-bold text-[#37352F] dark:text-white tracking-wider">
                  Today&apos;s Habits
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  Sound.click(soundEnabled);
                  onNavigate('habits');
                }}
                className="text-xs text-[#6366F1] dark:text-[#818CF8] hover:underline font-semibold cursor-pointer"
              >
                View all
              </button>
            </div>

            <div className="space-y-2.5">
              {habits.length === 0 ? (
                <div className="p-6 text-center bg-[#F8FAFC] dark:bg-[#0F172A] rounded-xl border border-dashed border-[#E2E8F0] dark:border-[#334155]">
                  <Flame className="w-6 h-6 text-amber-500 mx-auto mb-1 opacity-80" />
                  <p className="text-xs font-semibold text-[#37352F] dark:text-white">Build daily momentum</p>
                  <p className="text-[11px] text-[#787774] dark:text-[#9CA3AF] mt-0.5">
                    Track small rituals that compound over time.
                  </p>
                </div>
              ) : (
                habits.slice(0, 5).map((habit) => {
                  const isDone = habit.completedDays[todayIndex];
                  return (
                    <div
                      key={habit.id}
                      onClick={() => onToggleHabitDay(habit.id, todayIndex)}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] hover:border-[#6366F1] cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm">{habit.icon || '⚡'}</span>
                        <span className="text-xs font-semibold text-[#37352F] dark:text-white">
                          {habit.title}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="cursor-pointer"
                        title={isDone ? 'Completed today' : 'Mark done'}
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-100 dark:fill-emerald-950" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600 hover:text-emerald-500" />
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick Add Habit Field */}
            {showQuickHabitInput ? (
              <form onSubmit={handleCreateQuickHabit} className="flex gap-2 pt-1">
                <input
                  type="text"
                  required
                  placeholder="Habit title (e.g. Deep Reading)..."
                  value={quickHabitTitle}
                  onChange={(e) => setQuickHabitTitle(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs text-[#37352F] dark:text-white focus:outline-hidden focus:border-[#6366F1]"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#6366F1] text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuickHabitInput(false)}
                  className="px-2 py-1.5 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowQuickHabitInput(true)}
                className="w-full py-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-[#6366F1] hover:bg-[#EEF2FF] dark:hover:bg-[#1E1B4B] rounded-xl transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Habit</span>
              </button>
            )}
          </div>

          {/* Card: Quick Capture 2x2 Action Cards */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#EDECE9] dark:border-[#334155] shadow-2xs space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#6366F1]" />
              <h2 className="text-xs uppercase font-bold text-[#37352F] dark:text-white tracking-wider">
                Quick Capture
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* + New Task */}
              <button
                type="button"
                onClick={() => {
                  Sound.click(soundEnabled);
                  onNavigate('tasks');
                }}
                className="p-3.5 rounded-2xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] hover:border-[#6366F1] dark:hover:border-[#6366F1] hover:bg-white dark:hover:bg-[#1E293B] shadow-2xs cursor-pointer transition-all flex flex-col items-center justify-center text-center gap-1.5 group"
              >
                <Plus className="w-5 h-5 text-[#6366F1] group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-[#37352F] dark:text-white">New Task</span>
              </button>

              {/* + Note */}
              <button
                type="button"
                onClick={() => {
                  Sound.click(soundEnabled);
                  onNavigate('docs');
                }}
                className="p-3.5 rounded-2xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-white dark:hover:bg-[#1E293B] shadow-2xs cursor-pointer transition-all flex flex-col items-center justify-center text-center gap-1.5 group"
              >
                <Plus className="w-5 h-5 text-emerald-500 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-[#37352F] dark:text-white">Note</span>
              </button>

              {/* + Expense */}
              <button
                type="button"
                onClick={() => {
                  Sound.click(soundEnabled);
                  setShowQuickExpenseModal(true);
                }}
                className="p-3.5 rounded-2xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] hover:border-amber-500 dark:hover:border-amber-500 hover:bg-white dark:hover:bg-[#1E293B] shadow-2xs cursor-pointer transition-all flex flex-col items-center justify-center text-center gap-1.5 group"
              >
                <Plus className="w-5 h-5 text-amber-500 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-[#37352F] dark:text-white">Expense</span>
              </button>

              {/* + New Habit */}
              <button
                type="button"
                onClick={() => {
                  Sound.click(soundEnabled);
                  setShowQuickHabitInput(true);
                }}
                className="p-3.5 rounded-2xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] hover:border-blue-500 dark:hover:border-blue-500 hover:bg-white dark:hover:bg-[#1E293B] shadow-2xs cursor-pointer transition-all flex flex-col items-center justify-center text-center gap-1.5 group"
              >
                <Plus className="w-5 h-5 text-blue-500 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-[#37352F] dark:text-white">New Habit</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Add Expense Modal */}
      {showQuickExpenseModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-[#1E293B] border border-[#EDECE9] dark:border-[#334155] rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-[#37352F] dark:text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#6366F1]" />
              <span>Record Quick Expense</span>
            </h3>

            <form onSubmit={handleCreateQuickExpense} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#787774] dark:text-[#9CA3AF] mb-1">
                  Item Description
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Grocery Coffee"
                  value={quickExpenseName}
                  onChange={(e) => setQuickExpenseName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs text-[#37352F] dark:text-white focus:outline-hidden focus:border-[#6366F1]"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#787774] dark:text-[#9CA3AF] mb-1">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 250"
                  value={quickExpenseAmount}
                  onChange={(e) => setQuickExpenseAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs text-[#37352F] dark:text-white focus:outline-hidden focus:border-[#6366F1]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#787774] dark:text-[#9CA3AF] mb-1">
                  Category
                </label>
                <select
                  value={quickExpenseCat}
                  onChange={(e) => setQuickExpenseCat(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs text-[#37352F] dark:text-white focus:outline-hidden"
                >
                  <option value="Food">Food &amp; Dining</option>
                  <option value="Transport">Transport &amp; Fuel</option>
                  <option value="Subscriptions">Subscriptions</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Utilities">Utilities &amp; Bills</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuickExpenseModal(false)}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-xs font-semibold rounded-xl text-gray-700 dark:text-gray-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Record Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
