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
  WeeklyScheduleData,
} from '../types';
import { Sound } from '../utils/audio';
import { triggerConfetti } from '../utils/confetti';
import { INITIAL_QUOTES, INITIAL_SCHEDULE, Storage, DEFAULT_HOME_GRID_ORDER, DEFAULT_HOME_COLUMNS } from '../utils/storage';
import { IndianCalendarWidget } from './IndianCalendarWidget';
import { DynamicScheduleCard } from './DynamicScheduleCard';
import { CommandCenterGrid } from './CommandCenterGrid';
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
  GripVertical,
  RotateCcw,
  LayoutGrid,
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
  schedule?: WeeklyScheduleData;
  onUpdateSchedule?: (schedule: WeeklyScheduleData) => void;
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
  schedule = INITIAL_SCHEDULE,
  onAddQuote,
  onNavigate,
  onToggleTodo,
  onToggleHabitDay,
  onAddTodo,
  onAddExpense,
  onAddHabit,
  onUpdateSchedule,
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

  // Drag-and-Drop Home Grid Columns State (3-column responsive smart-packing grid)
  const [columns, setColumns] = useState<[string[], string[], string[]]>(() => {
    return Storage.getHomeGridColumns();
  });

  const isDefaultOrder = useMemo(() => {
    return (
      JSON.stringify(columns[0]) === JSON.stringify(DEFAULT_HOME_COLUMNS[0]) &&
      JSON.stringify(columns[1]) === JSON.stringify(DEFAULT_HOME_COLUMNS[1]) &&
      JSON.stringify(columns[2]) === JSON.stringify(DEFAULT_HOME_COLUMNS[2])
    );
  }, [columns]);

  const handleResetGridLayout = () => {
    Sound.click(soundEnabled);
    const resetCols: [string[], string[], string[]] = [
      [...DEFAULT_HOME_COLUMNS[0]],
      [...DEFAULT_HOME_COLUMNS[1]],
      [...DEFAULT_HOME_COLUMNS[2]],
    ];
    setColumns(resetCols);
    Storage.setHomeGridColumns(resetCols);
  };

  const handleColumnsChange = (newCols: [string[], string[], string[]]) => {
    setColumns(newCols);
    Storage.setHomeGridColumns(newCols);
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
      {/* 2. MAIN DASHBOARD GRID (Smart Space-Efficient Packing Grid) */}
      {/* ========================================================================= */}
      <CommandCenterGrid
        columns={columns}
        onColumnsChange={handleColumnsChange}
        isDefaultOrder={isDefaultOrder}
        handleResetGridLayout={handleResetGridLayout}
        todos={todos}
        onAddTodo={onAddTodo}
        onToggleTodo={onToggleTodo}
        onNavigate={onNavigate}
        habits={habits}
        todayIndex={todayIndex}
        onToggleHabitDay={onToggleHabitDay}
        showQuickHabitInput={showQuickHabitInput}
        setShowQuickHabitInput={setShowQuickHabitInput}
        quickHabitTitle={quickHabitTitle}
        setQuickHabitTitle={setQuickHabitTitle}
        handleCreateQuickHabit={handleCreateQuickHabit}
        quickTaskTitle={quickTaskTitle}
        setQuickTaskTitle={setQuickTaskTitle}
        showQuickTaskInput={showQuickTaskInput}
        setShowQuickTaskInput={setShowQuickTaskInput}
        handleCreateQuickTask={handleCreateQuickTask}
        spendingStats={spendingStats}
        expenses={expenses}
        setShowQuickExpenseModal={setShowQuickExpenseModal}
        schedule={schedule}
        onUpdateSchedule={onUpdateSchedule}
        soundEnabled={soundEnabled}
      />

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
