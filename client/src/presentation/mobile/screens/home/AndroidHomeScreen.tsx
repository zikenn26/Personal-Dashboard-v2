import React, { useState } from 'react';
import { Quote as QuoteIcon, CheckSquare, CreditCard, Flame, FileText, BookOpen, Film, Briefcase } from 'lucide-react';
import {
  UserProfile,
  TodoItem,
  HabitItem,
  QuoteItem,
  ExpenseItem,
  WeeklyScheduleData,
  Priority,
  TaskStatus,
  MainNavView,
  JournalEntry,
} from '../../../../types';
import { INITIAL_QUOTES } from '../../../../utils/storage';
import { nativeService } from '../../../../services/nativeService';
import { HorizontalPager } from '../../gestures/HorizontalPager';
import { AndroidWeatherWidget } from './AndroidWeatherWidget';
import { AndroidDateStrip } from '../../components/AndroidDateStrip';
import { AndroidTasksCard } from './AndroidTasksCard';
import { AndroidScheduleCard } from './AndroidScheduleCard';
import { AndroidSpendingCard } from './AndroidSpendingCard';
import { AndroidHabitsCard } from './AndroidHabitsCard';
import { QuickTaskSheet } from '../../components/QuickTaskSheet';
import { QuickExpenseSheet } from '../../components/QuickExpenseSheet';
import { QuickHabitSheet } from '../../components/QuickHabitSheet';
import { QuickNoteSheet } from '../../components/QuickNoteSheet';

export interface AndroidHomeScreenProps {
  profile: UserProfile;
  todos: TodoItem[];
  habits: HabitItem[];
  quotes: QuoteItem[];
  expenses: ExpenseItem[];
  schedule?: WeeklyScheduleData;
  onNavigate: (view: MainNavView) => void;
  onToggleTodo: (id: string) => void;
  onUpdateTodo?: (id: string, updates: Partial<TodoItem>) => void;
  onDeleteTodo?: (id: string) => void;
  onToggleHabitDay: (habitId: string, dayIndex: number) => void;
  onAddTodo?: (title: string, priority: Priority, category: string, dueDate?: string, status?: TaskStatus) => void;
  onAddExpense?: (item: Omit<ExpenseItem, 'id'>) => void;
  onAddHabit?: (title: string, category: string, icon: string, color: string) => void;
  onAddDiaryEntry?: (entry: Omit<JournalEntry, 'id' | 'timestamp'>) => void;
}

export const AndroidHomeScreen: React.FC<AndroidHomeScreenProps> = ({
  profile,
  todos,
  habits,
  quotes,
  expenses,
  schedule,
  onNavigate,
  onToggleTodo,
  onUpdateTodo,
  onDeleteTodo,
  onToggleHabitDay,
  onAddTodo,
  onAddExpense,
  onAddHabit,
  onAddDiaryEntry,
}) => {
  // Active modal sheets for Quick Access
  const [isTaskSheetOpen, setIsTaskSheetOpen] = useState(false);
  const [isExpenseSheetOpen, setIsExpenseSheetOpen] = useState(false);
  const [isHabitSheetOpen, setIsHabitSheetOpen] = useState(false);
  const [isNoteSheetOpen, setIsNoteSheetOpen] = useState(false);

  // Time-aware greeting & sun/moon emoji matching Screen B
  const { greetingText, timeEmoji } = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return { greetingText: 'Good morning', timeEmoji: '🌅' };
    if (hour < 17) return { greetingText: 'Good afternoon', timeEmoji: '☀️' };
    return { greetingText: 'Good evening', timeEmoji: '🌙' };
  })();

  const fullName = profile?.name || 'Gulshan Kumar Nayak';

  // Use existing quotes or fallback to INITIAL_QUOTES
  const availableQuotes = quotes && quotes.length > 0 ? quotes : INITIAL_QUOTES;

  return (
    <div className="w-full max-w-lg mx-auto space-y-2.5 px-3.5 pb-24 pt-0">
      {/* 1. COMPACT GREETING matching Screen B */}
      <div className="pt-1 px-1">
        <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 block leading-tight">
          {greetingText},
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
            {fullName}!
          </h2>
          <span className="text-lg">{timeEmoji}</span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Stay consistent. You&apos;re doing great!
        </p>
      </div>

      {/* 2. QUOTE CAROUSEL (Horizontal swipe with pager dots) */}
      <div className="w-full">
        <HorizontalPager showDots={true} className="w-full">
          {availableQuotes.map((q) => (
            <div
              key={q.id}
              className="w-full p-4 rounded-3xl bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-700 text-white shadow-md shadow-violet-500/20 relative overflow-hidden"
            >
              {/* Subtle decorative watermark */}
              <QuoteIcon className="w-20 h-20 text-white/10 absolute -right-3 -bottom-3 pointer-events-none" />

              <div className="relative z-10 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                  <QuoteIcon className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium leading-relaxed italic text-violet-50">
                    &ldquo;{q.text}&rdquo;
                  </p>
                  {q.author && (
                    <p className="text-[11px] font-bold text-violet-200 mt-2 tracking-wide uppercase">
                      — {q.author}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </HorizontalPager>
      </div>

      {/* 3. WEATHER / CURRENT INFORMATION (Screen B) */}
      <AndroidWeatherWidget />

      {/* 4. CALENDAR GRID / DATE STRIP (Temporarily hidden, underlying component preserved) */}
      {/* <AndroidDateStrip /> */}

      {/* 5. QUICK ACCESS GRID (Row 1: Actions, Row 2: Navigation) */}
      <div className="space-y-2 pt-1">
        <span className="text-xs font-bold text-gray-600 dark:text-gray-300 tracking-tight px-1">
          Quick Access
        </span>

        {/* 2 Rows x 4 Columns */}
        <div className="grid grid-cols-4 gap-2">
          {/* ROW 1: ACTIONS */}
          {/* 1. Add Task */}
          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              setIsTaskSheetOpen(true);
            }}
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-2xs hover:border-violet-300 dark:hover:border-violet-600/50 active:scale-95 transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-950/80 text-violet-600 dark:text-violet-400 flex items-center justify-center mb-1.5 shadow-2xs group-hover:scale-105 transition-transform">
              <CheckSquare className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200 text-center leading-tight">
              Add Task
            </span>
          </button>

          {/* 2. Add Expense */}
          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              setIsExpenseSheetOpen(true);
            }}
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-2xs hover:border-emerald-300 dark:hover:border-emerald-600/50 active:scale-95 transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-1.5 shadow-2xs group-hover:scale-105 transition-transform">
              <CreditCard className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200 text-center leading-tight">
              Add Expense
            </span>
          </button>

          {/* 3. Add Habit */}
          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              setIsHabitSheetOpen(true);
            }}
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-2xs hover:border-amber-300 dark:hover:border-amber-600/50 active:scale-95 transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-1.5 shadow-2xs group-hover:scale-105 transition-transform">
              <Flame className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200 text-center leading-tight">
              Add Habit
            </span>
          </button>

          {/* 4. Add Note */}
          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              setIsNoteSheetOpen(true);
            }}
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-2xs hover:border-rose-300 dark:hover:border-rose-600/50 active:scale-95 transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-1.5 shadow-2xs group-hover:scale-105 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200 text-center leading-tight">
              Add Note
            </span>
          </button>

          {/* ROW 2: CORE DESTINATIONS */}
          {/* 1. Journal */}
          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              onNavigate('journal');
            }}
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-2xs hover:border-pink-300 active:scale-95 transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-pink-100 dark:bg-pink-950/80 text-pink-600 dark:text-pink-400 flex items-center justify-center mb-1.5 shadow-2xs group-hover:scale-105 transition-transform">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200 text-center leading-tight">
              Journal
            </span>
          </button>

          {/* 2. Quotes */}
          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              onNavigate('quotes');
            }}
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-2xs hover:border-violet-300 active:scale-95 transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-950/80 text-violet-600 dark:text-violet-400 flex items-center justify-center mb-1.5 shadow-2xs group-hover:scale-105 transition-transform">
              <QuoteIcon className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200 text-center leading-tight">
              Quotes
            </span>
          </button>

          {/* 3. Library */}
          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              onNavigate('media');
            }}
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-2xs hover:border-blue-300 active:scale-95 transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-1.5 shadow-2xs group-hover:scale-105 transition-transform">
              <Film className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200 text-center leading-tight">
              Library
            </span>
          </button>

          {/* 4. Portfolio */}
          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              onNavigate('workfolio');
            }}
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-2xs hover:border-indigo-300 active:scale-95 transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-1.5 shadow-2xs group-hover:scale-105 transition-transform">
              <Briefcase className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200 text-center leading-tight">
              Portfolio
            </span>
          </button>
        </div>
      </div>

      {/* 6. TODAY'S TASKS CARD */}
      <AndroidTasksCard
        todos={todos}
        onToggleTodo={onToggleTodo}
        onUpdateTodo={onUpdateTodo}
        onDeleteTodo={onDeleteTodo}
        onNavigateToTasks={() => onNavigate('tasks')}
        onOpenAddTask={() => setIsTaskSheetOpen(true)}
      />

      {/* 7. THIS WEEK'S SCHEDULE CARD */}
      <AndroidScheduleCard
        schedule={schedule}
        onNavigateToSchedule={() => onNavigate('tasks')}
      />

      {/* 8. SPENDING SNAPSHOT CARD */}
      <AndroidSpendingCard
        expenses={expenses}
        onNavigateToMoney={() => onNavigate('expenses')}
        onOpenAddExpense={() => setIsExpenseSheetOpen(true)}
      />

      {/* 9. HABITS & MOMENTUM CARD */}
      <AndroidHabitsCard
        habits={habits}
        onToggleHabitDay={onToggleHabitDay}
        onNavigateToHabits={() => onNavigate('habits')}
        onOpenAddHabit={() => setIsHabitSheetOpen(true)}
      />

      {/* QUICK MODAL BOTTOM SHEETS */}
      {onAddTodo && (
        <QuickTaskSheet
          isOpen={isTaskSheetOpen}
          onClose={() => setIsTaskSheetOpen(false)}
          onAddTodo={onAddTodo}
        />
      )}

      {onAddExpense && (
        <QuickExpenseSheet
          isOpen={isExpenseSheetOpen}
          onClose={() => setIsExpenseSheetOpen(false)}
          onAddExpense={onAddExpense}
        />
      )}

      {onAddHabit && (
        <QuickHabitSheet
          isOpen={isHabitSheetOpen}
          onClose={() => setIsHabitSheetOpen(false)}
          onAddHabit={onAddHabit}
        />
      )}

      {onAddDiaryEntry && (
        <QuickNoteSheet
          isOpen={isNoteSheetOpen}
          onClose={() => setIsNoteSheetOpen(false)}
          onAddDiaryEntry={onAddDiaryEntry}
        />
      )}
    </div>
  );
};
