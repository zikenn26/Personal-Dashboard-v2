import React, { useState, useMemo } from 'react';
import {
  Flame,
  Plus,
  Trash2,
  Check,
  Edit2,
  Sparkles,
  RotateCcw,
  X,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Maximize2,
  TrendingUp,
} from 'lucide-react';
import { HabitItem, HabitWeekRecord, HabitActivityLog } from '../types';
import { Sound } from '../utils/audio';
import {
  getMonthCalendarData,
  isHabitDateCompleted,
  toggleHabitDate,
  formatDateIso,
  getMondayOfWeek,
} from '../utils/habitWeekManager';

export interface HabitTrackerProps {
  habits: HabitItem[];
  habitHistory?: HabitWeekRecord[];
  habitActivities?: HabitActivityLog[];
  onToggleHabitDay: (habitId: string, dayIndex: number) => void;
  onToggleHabitDate?: (habitId: string, dateStr: string) => void;
  onAddHabit: (title: string, category: string, icon: string, color: string) => void;
  onUpdateHabit: (habit: HabitItem) => void;
  onDeleteHabit: (habitId: string) => void;
  onResetWeek?: () => void;
  onSimulateMondayRollover?: () => void;
  onToggleHistoricalHabitDay?: (weekId: string, habitId: string, dayIndex: number) => void;
  onAddHistoricalHabit?: (weekId: string, title: string, category: string, icon: string, color: string) => void;
  onDeleteHistoricalHabit?: (weekId: string, habitId: string) => void;
  soundEnabled?: boolean;
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const EMOJI_OPTIONS = ['⚡', '💧', '🏃', '📚', '🧘', '🥗', '💻', '🌅', '💤', '🎯', '✨', '💪', '🍎', '🏋️', '💊', '🚶'];
const COLOR_OPTIONS = [
  { name: 'Purple', hex: '#7b2cbf' },
  { name: 'Violet', hex: '#6100a4' },
  { name: 'Mint', hex: '#006b55' },
  { name: 'Emerald', hex: '#10B981' },
  { name: 'Amber', hex: '#F59E0B' },
  { name: 'Rose', hex: '#EF4444' },
  { name: 'Blue', hex: '#3B82F6' },
];

export const HabitTracker: React.FC<HabitTrackerProps> = ({
  habits,
  onToggleHabitDay,
  onToggleHabitDate,
  onAddHabit,
  onUpdateHabit,
  onDeleteHabit,
  onResetWeek,
  soundEnabled = true,
}) => {
  const [timeframe, setTimeframe] = useState<'today' | 'week' | 'month'>('today');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<HabitItem | null>(null);

  // Month navigation state
  const today = useMemo(() => new Date(), []);
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth());

  // Individual habit detailed calendar modal state
  const [expandedHabitId, setExpandedHabitId] = useState<string | null>(null);

  // Form states for Add Habit modal
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Daily');
  const [newIcon, setNewIcon] = useState('⚡');
  const [newColor, setNewColor] = useState('#7b2cbf');

  // Form states for Edit Habit modal
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('Daily');
  const [editIcon, setEditIcon] = useState('⚡');
  const [editColor, setEditColor] = useState('#7b2cbf');

  // Today's day index: Monday is 0, Sunday is 6
  const todayDayIdx = useMemo(() => {
    const day = today.getDay();
    return (day + 6) % 7;
  }, [today]);

  const currentMonday = useMemo(() => getMondayOfWeek(today), [today]);
  const todayDateStr = useMemo(() => formatDateIso(today), [today]);

  // Calendar info for the selected month
  const monthData = useMemo(() => {
    return getMonthCalendarData(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth]);

  const activeExpandedHabit = useMemo(() => {
    if (!expandedHabitId) return null;
    return habits.find((h) => h.id === expandedHabitId) || null;
  }, [expandedHabitId, habits]);

  // Progress metrics for today and the week
  const todayCompletedCount = useMemo(() => {
    return habits.filter((h) => h.completedDays && h.completedDays[todayDayIdx]).length;
  }, [habits, todayDayIdx]);

  const { totalCompleted, totalPossible, completionRate } = useMemo(() => {
    let completed = 0;
    const possible = habits.length * 7;
    habits.forEach((h) => {
      if (h.completedDays) {
        completed += h.completedDays.filter(Boolean).length;
      }
    });
    const rate = possible > 0 ? Math.round((completed / possible) * 100) : 0;
    return { totalCompleted: completed, totalPossible: possible, completionRate: rate };
  }, [habits]);

  const maxStreak = useMemo(() => {
    if (habits.length === 0) return 0;
    return Math.max(...habits.map((h) => h.streak || 0));
  }, [habits]);

  // Total month stats across all habits
  const monthOverallStats = useMemo(() => {
    let completed = 0;
    const possible = habits.length * monthData.daysInMonth;
    habits.forEach((h) => {
      monthData.days.forEach((d) => {
        if (isHabitDateCompleted(h, d.dateStr, currentMonday)) {
          completed++;
        }
      });
    });
    const rate = possible > 0 ? Math.round((completed / possible) * 100) : 0;
    return { completed, possible, rate };
  }, [habits, monthData, currentMonday]);

  const handleToggleToday = (habitId: string) => {
    Sound.click(soundEnabled);
    onToggleHabitDay(habitId, todayDayIdx);
  };

  const handleToggleDay = (habitId: string, dayIdx: number) => {
    Sound.click(soundEnabled);
    onToggleHabitDay(habitId, dayIdx);
  };

  const handleToggleDate = (habitId: string, dateStr: string) => {
    Sound.click(soundEnabled);
    if (onToggleHabitDate) {
      onToggleHabitDate(habitId, dateStr);
    } else if (onUpdateHabit) {
      const target = habits.find((h) => h.id === habitId);
      if (target) {
        const updated = toggleHabitDate(target, dateStr, currentMonday);
        onUpdateHabit(updated);
      }
    }
  };

  const handlePrevMonth = () => {
    Sound.click(soundEnabled);
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    Sound.click(soundEnabled);
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const handleResetToCurrentMonth = () => {
    Sound.click(soundEnabled);
    setSelectedYear(today.getFullYear());
    setSelectedMonth(today.getMonth());
  };

  const openEditModal = (habit: HabitItem) => {
    setEditingHabit(habit);
    setEditTitle(habit.title);
    setEditCategory(habit.category || 'Daily');
    setEditIcon(habit.icon || '⚡');
    setEditColor(habit.color || '#7b2cbf');
  };

  const handleCreateHabitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newTitle.trim();
    if (!clean) return;
    Sound.success(soundEnabled);
    onAddHabit(clean, newCategory, newIcon, newColor);
    setNewTitle('');
    setIsAddModalOpen(false);
  };

  const handleSaveEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHabit) return;
    const clean = editTitle.trim();
    if (!clean) return;
    Sound.success(soundEnabled);
    onUpdateHabit({
      ...editingHabit,
      title: clean,
      category: editCategory,
      icon: editIcon,
      color: editColor,
    });
    setEditingHabit(null);
  };

  const handleDeleteHabitClick = () => {
    if (!editingHabit) return;
    Sound.click(soundEnabled);
    onDeleteHabit(editingHabit.id);
    setEditingHabit(null);
  };

  const isCurrentViewingMonth =
    selectedYear === today.getFullYear() && selectedMonth === today.getMonth();

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* 1. Header matching the rest of the web dashboard (Goals, Spending, Tasks) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E7EB] dark:border-[#1F2937]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#7b2cbf] to-[#6100a4] text-white flex items-center justify-center shadow-xs">
            <Flame className="w-4 h-4 fill-current" />
          </div>
          <div>
            <h1 className="workspace-heading font-extrabold text-sm sm:text-base text-[#111827] dark:text-white tracking-tight leading-snug">
              Habits Tracker
            </h1>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] leading-tight">
              Track daily routines, build consistency, and sustain long-term momentum
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onResetWeek && (
            <button
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                onResetWeek();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-[#374151] hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-medium text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
              title="Reset all days for this week"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Week</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#7b2cbf] hover:bg-[#6100a4] text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Habit</span>
          </button>
        </div>
      </div>

      {/* 2. Controls & Overview Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Timeframe Segmented Switch */}
        <div className="bg-[#efebff] dark:bg-[#1a1738] rounded-full p-0.5 inline-flex items-center border border-[#cfc2d5]/30 dark:border-[#2f2956]">
          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              setTimeframe('today');
            }}
            className={`py-1 px-3 rounded-full text-xs font-semibold transition-all duration-150 cursor-pointer ${
              timeframe === 'today'
                ? 'bg-[#7b2cbf] text-white shadow-xs'
                : 'text-[#7e7384] dark:text-[#9e96b3] hover:text-[#181445] dark:hover:text-white'
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              setTimeframe('week');
            }}
            className={`py-1 px-3 rounded-full text-xs font-semibold transition-all duration-150 cursor-pointer ${
              timeframe === 'week'
                ? 'bg-[#7b2cbf] text-white shadow-xs'
                : 'text-[#7e7384] dark:text-[#9e96b3] hover:text-[#181445] dark:hover:text-white'
            }`}
          >
            Week
          </button>
          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              setTimeframe('month');
            }}
            className={`py-1 px-3 rounded-full text-xs font-semibold transition-all duration-150 cursor-pointer ${
              timeframe === 'month'
                ? 'bg-[#7b2cbf] text-white shadow-xs'
                : 'text-[#7e7384] dark:text-[#9e96b3] hover:text-[#181445] dark:hover:text-white'
            }`}
          >
            Month
          </button>
        </div>

        {/* Section title & Month Navigator or Streak Badge */}
        {timeframe === 'month' ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-[#efebff] dark:bg-[#1a1738] px-2.5 py-1 rounded-lg border border-[#cfc2d5]/30 dark:border-[#2f2956]">
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Previous month"
                className="p-1 rounded text-[#6100a4] dark:text-[#deb7ff] hover:bg-white/60 dark:hover:bg-[#28224d] cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-bold text-[#181445] dark:text-white px-1">
                {monthData.monthName} {monthData.year}
              </span>
              {!isCurrentViewingMonth && (
                <button
                  type="button"
                  onClick={handleResetToCurrentMonth}
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#7b2cbf] text-white cursor-pointer"
                >
                  Today
                </button>
              )}
              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Next month"
                className="p-1 rounded text-[#6100a4] dark:text-[#deb7ff] hover:bg-white/60 dark:hover:bg-[#28224d] cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#efebff] dark:bg-[#252045] text-[#6100a4] dark:text-[#deb7ff] text-xs font-semibold border border-[#cfc2d5]/40 dark:border-[#383060]">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{monthOverallStats.rate}% overall</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#111827] dark:text-white">
              {timeframe === 'today' ? "Today's Habits" : "This Week's Habits"}
            </span>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#efebff] dark:bg-[#252045] text-[#6100a4] dark:text-[#deb7ff] text-[11px] font-semibold border border-[#cfc2d5]/40 dark:border-[#383060]">
              <Flame className="w-3 h-3 fill-[#7b2cbf] text-[#7b2cbf] dark:fill-[#deb7ff] dark:text-[#deb7ff]" />
              <span>
                {timeframe === 'today'
                  ? `${todayCompletedCount} of ${habits.length} done`
                  : `${maxStreak}d Streak`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Momentum Progress Card (Shown on Today/Week) */}
      {timeframe !== 'month' && (
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#7b2cbf] to-[#6100a4] text-white shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-[#e4c2ff] uppercase tracking-wider">
              {timeframe === 'today' ? "Today's Progress" : 'Weekly Momentum'}
            </span>
            <div className="p-0.5 rounded-full bg-white/20">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-xl font-extrabold">
              {timeframe === 'today'
                ? `${habits.length > 0 ? Math.round((todayCompletedCount / habits.length) * 100) : 0}%`
                : `${completionRate}%`}
            </span>
            <span className="text-[11px] text-[#e4c2ff]">
              {timeframe === 'today'
                ? `(${todayCompletedCount} of ${habits.length} completed)`
                : `(${totalCompleted} of ${totalPossible} total)`}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-black/25 rounded-full mt-2.5 overflow-hidden">
            <div
              className="h-full bg-[#6dfad2] rounded-full transition-all duration-500"
              style={{
                width: `${
                  timeframe === 'today'
                    ? habits.length > 0
                      ? Math.round((todayCompletedCount / habits.length) * 100)
                      : 0
                    : completionRate
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {/* 4. Habit Items List / Calendar Grid */}
      {habits.length === 0 ? (
        <div className="p-8 text-center rounded-xl bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155]">
          <Flame className="w-8 h-8 text-[#7b2cbf] mx-auto mb-2 opacity-60" />
          <p className="text-xs font-bold text-[#111827] dark:text-white">
            No habits tracked yet
          </p>
          <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] mt-1 mb-3">
            Build good daily routines. Add your first habit!
          </p>
          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7b2cbf] text-white text-xs font-semibold shadow-xs cursor-pointer hover:bg-[#6100a4] transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Habit</span>
          </button>
        </div>
      ) : timeframe === 'month' ? (
        /* MONTH VIEW (WEB): Interactive Calendar Cards for each Habit */
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-[#6B7280] dark:text-[#9CA3AF] px-1">
            <span>
              Click any date cell to mark or unmark completion directly.
            </span>
            <span>
              {habits.length} habits in {monthData.monthName}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {habits.map((habit) => {
              const completedDatesInMonth = monthData.days.filter((d) =>
                isHabitDateCompleted(habit, d.dateStr, currentMonday)
              ).length;
              const monthRate = Math.round(
                (completedDatesInMonth / monthData.daysInMonth) * 100
              );

              return (
                <div
                  key={habit.id}
                  className="p-3.5 rounded-xl bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] shadow-2xs space-y-3 hover:border-[#7b2cbf] dark:hover:border-[#deb7ff] transition-all"
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0 shadow-2xs"
                        style={{
                          backgroundColor: habit.color ? `${habit.color}20` : '#f1dbff',
                          color: habit.color || '#6100a4',
                        }}
                      >
                        <span>{habit.icon || '⚡'}</span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-xs sm:text-sm text-[#111827] dark:text-white truncate">
                          {habit.title}
                        </h3>
                        <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">
                          {completedDatesInMonth}/{monthData.daysInMonth} days ({monthRate}%)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          Sound.click(soundEnabled);
                          setExpandedHabitId(habit.id);
                        }}
                        className="p-1 rounded text-gray-400 hover:text-[#7b2cbf] hover:bg-[#efebff] dark:hover:bg-[#28224d] transition-colors cursor-pointer"
                        title="Open full interactive calendar"
                        aria-label={`Open calendar for ${habit.title}`}
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(habit)}
                        className="p-1 rounded text-gray-400 hover:text-[#7b2cbf] hover:bg-[#efebff] dark:hover:bg-[#28224d] transition-colors cursor-pointer"
                        title="Edit habit"
                        aria-label={`Edit ${habit.title}`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Interactive Calendar Grid inside Card */}
                  <div className="bg-gray-50/70 dark:bg-[#111827]/70 p-2 rounded-lg border border-[#E5E7EB]/80 dark:border-[#28224d]">
                    {/* Weekday headers */}
                    <div className="grid grid-cols-7 gap-1 text-center mb-1">
                      {DAY_LABELS.map((d, i) => (
                        <span key={i} className="text-[9px] font-bold text-gray-400 dark:text-gray-500">
                          {d}
                        </span>
                      ))}
                    </div>

                    {/* Day cells */}
                    <div className="grid grid-cols-7 gap-1 text-center">
                      {/* Leading blanks */}
                      {Array.from({ length: monthData.leadingBlankCount }).map((_, i) => (
                        <div key={`blank-${i}`} className="h-5 sm:h-6" />
                      ))}

                      {/* Days */}
                      {monthData.days.map((d) => {
                        const isDone = isHabitDateCompleted(habit, d.dateStr, currentMonday);
                        return (
                          <button
                            key={d.dateStr}
                            type="button"
                            onClick={() => handleToggleDate(habit.id, d.dateStr)}
                            className={`h-5 sm:h-6 rounded-md flex items-center justify-center text-[10px] font-semibold transition-all cursor-pointer relative active:scale-90 ${
                              isDone
                                ? 'bg-[#7b2cbf] text-white shadow-2xs font-bold'
                                : d.isToday
                                ? 'bg-[#efebff] dark:bg-[#28224d] text-[#7b2cbf] dark:text-[#deb7ff] font-bold border border-[#7b2cbf]'
                                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                            title={`${d.dateStr}: ${isDone ? 'Marked completed (click to unmark)' : 'Not completed (click to mark)'}`}
                          >
                            <span>{d.dayNum}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Card Footer Progress Bar */}
                  <div>
                    <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#7b2cbf] rounded-full transition-all duration-300"
                        style={{ width: `${monthRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* TODAY & WEEK VIEWS: Standard compact habit list */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {habits.map((habit) => {
            const isDoneToday = Boolean(habit.completedDays && habit.completedDays[todayDayIdx]);
            const completedThisWeek = habit.completedDays
              ? habit.completedDays.filter(Boolean).length
              : 0;

            return (
              <div
                key={habit.id}
                className="p-3 rounded-xl bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] hover:border-[#cfc2d5] dark:hover:border-[#4B5563] shadow-2xs space-y-2.5 transition-all"
              >
                {/* Header row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 shadow-2xs"
                      style={{
                        backgroundColor: habit.color ? `${habit.color}20` : '#f1dbff',
                        color: habit.color || '#6100a4',
                      }}
                    >
                      <span>{habit.icon || '⚡'}</span>
                    </div>

                    <div className="min-w-0">
                      <h3 className="font-semibold text-xs sm:text-sm text-[#111827] dark:text-white truncate">
                        {habit.title}
                      </h3>
                      <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-1.5 truncate">
                        <span>{habit.category || 'Daily'}</span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5 text-[#7b2cbf] dark:text-[#deb7ff] font-semibold">
                          <Flame className="w-2.5 h-2.5 fill-current" />
                          {habit.streak}d streak
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditModal(habit)}
                      className="p-1 rounded-md text-[#6B7280] hover:text-[#7b2cbf] hover:bg-[#efebff] dark:hover:bg-[#252045] transition-all cursor-pointer"
                      title="Edit habit"
                      aria-label={`Edit ${habit.title}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Today Checkmark Button */}
                    {timeframe === 'today' && (
                      <button
                        type="button"
                        onClick={() => handleToggleToday(habit.id)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center cursor-pointer active:scale-90 transition-transform ${
                          isDoneToday
                            ? 'bg-[#6dfad2] text-[#00725b] border border-[#006b55]/20 shadow-2xs'
                            : 'border border-[#9CA3AF]/50 hover:border-[#7b2cbf] text-transparent hover:text-[#7b2cbf]/30'
                        }`}
                        aria-label={isDoneToday ? 'Completed today' : 'Mark completed today'}
                      >
                        <Check className="w-4 h-4 stroke-[2.5]" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Week view: 7-day strip */}
                {timeframe === 'week' && (
                  <div className="pt-0.5">
                    <div className="flex items-center justify-between gap-1">
                      {habit.completedDays.map((isDone, idx) => {
                        const isToday = idx === todayDayIdx;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleToggleDay(habit.id, idx)}
                            className={`flex-1 py-1 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer ${
                              isDone
                                ? 'bg-[#7b2cbf] text-white shadow-2xs scale-[1.02]'
                                : 'bg-[#F3F4F6] dark:bg-[#111827] text-[#6B7280] dark:text-[#9CA3AF] hover:bg-[#E5E7EB] dark:hover:bg-[#1F2937]'
                            } ${isToday ? 'ring-1 ring-[#7b2cbf] ring-offset-1 dark:ring-offset-[#1E293B]' : ''}`}
                          >
                            <span className="text-[9px] font-bold uppercase">{DAY_LABELS[idx]}</span>
                            <div className="w-3 h-3 mt-0.5 flex items-center justify-center">
                              {isDone ? (
                                <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                              ) : (
                                <div className="w-1 h-1 rounded-full bg-[#D1D5DB] dark:bg-[#4B5563]" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[#6B7280] dark:text-[#9CA3AF] mt-1 px-0.5">
                      <span>Tap day to toggle</span>
                      <span className="font-semibold text-[#7b2cbf] dark:text-[#deb7ff]">
                        {completedThisWeek}/7 done
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Expanded Individual Habit Calendar Modal (Desktop Web) */}
      {activeExpandedHabit && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB] dark:border-[#334155]">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 shadow-xs"
                  style={{
                    backgroundColor: activeExpandedHabit.color
                      ? `${activeExpandedHabit.color}25`
                      : '#f1dbff',
                    color: activeExpandedHabit.color || '#6100a4',
                  }}
                >
                  <span>{activeExpandedHabit.icon || '⚡'}</span>
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-[#111827] dark:text-white">
                    {activeExpandedHabit.title}
                  </h3>
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-1.5">
                    <span>{activeExpandedHabit.category || 'Daily'}</span>
                    <span>•</span>
                    <span className="text-[#7b2cbf] dark:text-[#deb7ff] font-semibold">
                      {activeExpandedHabit.streak}d streak
                    </span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setExpandedHabitId(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Habit fast switcher tab strip (if multiple habits) */}
            {habits.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {habits.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => {
                      Sound.click(soundEnabled);
                      setExpandedHabitId(h.id);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1 ${
                      h.id === activeExpandedHabit.id
                        ? 'bg-[#7b2cbf] text-white shadow-2xs'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                    }`}
                  >
                    <span>{h.icon || '⚡'}</span>
                    <span>{h.title}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Month Navigator */}
            <div className="flex items-center justify-between bg-gray-50 dark:bg-[#111827] px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Previous month"
                className="p-1 rounded-md text-[#7b2cbf] hover:bg-white dark:hover:bg-gray-800 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="text-center">
                <span className="text-xs sm:text-sm font-bold text-[#111827] dark:text-white">
                  {monthData.monthName} {monthData.year}
                </span>
                <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">
                  Click any day to mark or unmark
                </p>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Next month"
                className="p-1 rounded-md text-[#7b2cbf] hover:bg-white dark:hover:bg-gray-800 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Large Interactive Calendar Grid */}
            <div className="bg-gray-50/50 dark:bg-[#111827]/50 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
              {/* Day of week headers */}
              <div className="grid grid-cols-7 gap-1.5 text-center mb-1.5">
                {WEEKDAY_NAMES.map((d, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase"
                  >
                    {d}
                  </span>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-1.5 text-center">
                {/* Leading blanks */}
                {Array.from({ length: monthData.leadingBlankCount }).map((_, i) => (
                  <div key={`blank-${i}`} className="h-9 sm:h-10" />
                ))}

                {/* Month days */}
                {monthData.days.map((d) => {
                  const isDone = isHabitDateCompleted(
                    activeExpandedHabit,
                    d.dateStr,
                    currentMonday
                  );

                  return (
                    <button
                      key={d.dateStr}
                      type="button"
                      onClick={() => handleToggleDate(activeExpandedHabit.id, d.dateStr)}
                      className={`h-9 sm:h-10 rounded-lg flex flex-col items-center justify-center text-xs font-semibold transition-all cursor-pointer relative active:scale-95 ${
                        isDone
                          ? 'bg-[#7b2cbf] text-white font-bold shadow-xs'
                          : d.isToday
                          ? 'bg-[#efebff] dark:bg-[#201c40] text-[#7b2cbf] dark:text-[#deb7ff] font-bold border-2 border-[#7b2cbf]'
                          : 'bg-white dark:bg-[#1E293B] text-gray-800 dark:text-gray-200 hover:bg-[#e9e5ff] dark:hover:bg-[#28224d] border border-gray-200/60 dark:border-gray-700'
                      }`}
                      title={`${d.dateStr}: ${isDone ? 'Completed' : 'Not completed'}`}
                    >
                      <span>{d.dayNum}</span>
                      {isDone && (
                        <Check className="w-3 h-3 text-[#6dfad2] stroke-[3]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Monthly stats breakdown */}
            {(() => {
              const completedCountInMonth = monthData.days.filter((d) =>
                isHabitDateCompleted(activeExpandedHabit, d.dateStr, currentMonday)
              ).length;
              const rate = Math.round(
                (completedCountInMonth / monthData.daysInMonth) * 100
              );

              return (
                <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-[#111827] text-xs">
                  <div>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 block">
                      Month Completion
                    </span>
                    <span className="font-extrabold text-sm text-[#7b2cbf] dark:text-[#deb7ff]">
                      {rate}%
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 block">
                      Days Logged
                    </span>
                    <span className="font-bold text-xs text-gray-900 dark:text-white">
                      {completedCountInMonth} / {monthData.daysInMonth} days
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Action buttons */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleToggleDate(activeExpandedHabit.id, todayDateStr)}
                className="py-2 px-3 text-xs rounded-lg bg-[#efebff] dark:bg-[#201c40] text-[#7b2cbf] dark:text-[#deb7ff] font-semibold hover:bg-[#e3dfff] dark:hover:bg-[#28224d] transition-colors cursor-pointer"
              >
                {isHabitDateCompleted(activeExpandedHabit, todayDateStr, currentMonday)
                  ? 'Unmark Today'
                  : 'Mark Today Done'}
              </button>

              <button
                type="button"
                onClick={() => setExpandedHabitId(null)}
                className="py-2 px-4 text-xs rounded-lg bg-[#7b2cbf] hover:bg-[#6100a4] text-white font-semibold shadow-xs cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Habit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] shadow-xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#111827] dark:text-white">
                New Habit
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateHabitSubmit} className="space-y-3.5">
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 block mb-1">
                  Habit Title
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Read 20 pages, Morning Jog..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#7b2cbf]"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 block mb-1">
                  Category
                </label>
                <input
                  type="text"
                  placeholder="e.g. Health, Learning, Focus..."
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#7b2cbf]"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 block mb-1">
                  Icon
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setNewIcon(emoji)}
                      className={`w-7 h-7 rounded-md flex items-center justify-center text-sm cursor-pointer transition-transform ${
                        newIcon === emoji ? 'bg-[#7b2cbf] text-white scale-110 shadow-xs' : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 block mb-1">
                  Color
                </label>
                <div className="flex items-center gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setNewColor(c.hex)}
                      className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                        newColor === c.hex ? 'ring-2 ring-offset-2 ring-[#7b2cbf] scale-110' : ''
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim()}
                  className="px-3 py-1.5 text-xs rounded-lg bg-[#7b2cbf] hover:bg-[#6100a4] text-white font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  Create Habit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Habit Modal */}
      {editingHabit && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] shadow-xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#111827] dark:text-white">
                Edit Habit
              </h3>
              <button
                type="button"
                onClick={() => setEditingHabit(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditSubmit} className="space-y-3.5">
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 block mb-1">
                  Habit Title
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#7b2cbf]"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 block mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#7b2cbf]"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 block mb-1">
                  Icon
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setEditIcon(emoji)}
                      className={`w-7 h-7 rounded-md flex items-center justify-center text-sm cursor-pointer transition-transform ${
                        editIcon === emoji ? 'bg-[#7b2cbf] text-white scale-110 shadow-xs' : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 block mb-1">
                  Color
                </label>
                <div className="flex items-center gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setEditColor(c.hex)}
                      className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                        editColor === c.hex ? 'ring-2 ring-offset-2 ring-[#7b2cbf] scale-110' : ''
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleDeleteHabitClick}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingHabit(null)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!editTitle.trim()}
                    className="px-3 py-1.5 text-xs rounded-lg bg-[#7b2cbf] hover:bg-[#6100a4] text-white font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
