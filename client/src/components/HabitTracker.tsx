import React, { useState, useMemo, useEffect } from 'react';
import {
  Flame,
  Plus,
  Trash2,
  Sparkles,
  Check,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Trophy,
  CheckCircle2,
  TrendingUp,
  X,
  RotateCcw,
} from 'lucide-react';
import { HabitItem, HabitWeekRecord, HabitActivityLog } from '../types';
import { Sound } from '../utils/audio';
import { triggerConfetti } from '../utils/confetti';
import {
  DAYS_OF_WEEK,
  getMondayOfWeek,
  getWeekId,
  formatWeekRange,
  getWeekDaysInfo,
} from '../utils/habitWeekManager';

export interface HabitTrackerProps {
  habits: HabitItem[];
  habitHistory?: HabitWeekRecord[];
  habitActivities?: HabitActivityLog[];
  onToggleHabitDay: (habitId: string, dayIndex: number) => void;
  onAddHabit: (title: string, category: string, icon: string, color: string) => void;
  onDeleteHabit: (habitId: string) => void;
  onResetWeek?: () => void;
  onSimulateMondayRollover?: () => void;
  onToggleHistoricalHabitDay?: (weekId: string, habitId: string, dayIndex: number) => void;
  onAddHistoricalHabit?: (weekId: string, title: string, category: string, icon: string, color: string) => void;
  onDeleteHistoricalHabit?: (weekId: string, habitId: string) => void;
  soundEnabled: boolean;
}

export const HabitTracker: React.FC<HabitTrackerProps> = ({
  habits,
  habitHistory = [],
  habitActivities = [],
  onToggleHabitDay,
  onAddHabit,
  onDeleteHabit,
  onToggleHistoricalHabitDay,
  onAddHistoricalHabit,
  onDeleteHistoricalHabit,
  soundEnabled,
}) => {
  // Historical Week Selector state: 'current' or specific weekId
  const [selectedWeekId, setSelectedWeekId] = useState<string>('current');

  // Add Habit modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Health');
  const [newIcon, setNewIcon] = useState('⚡');
  const [newColor, setNewColor] = useState('#6366F1');

  // Compute current Monday & week info
  const currentMonday = getMondayOfWeek();
  const currentWeekLabel = formatWeekRange(currentMonday);
  const currentWeekId = getWeekId(currentMonday);
  const daysInfo = getWeekDaysInfo(currentMonday);

  // Filter out any historical week that refers to the current week to eliminate redundancy and keep consistency
  const validPastWeeks = useMemo(() => {
    return habitHistory.filter((w) => {
      if (!w) return false;
      const isSameId = w.id === `week-${currentWeekId}` || w.id === currentWeekId;
      const isSameStart = w.weekStart === currentWeekId;
      const isSameLabel =
        w.label?.trim().toLowerCase() === currentWeekLabel?.trim().toLowerCase() ||
        (Boolean(w.label?.toLowerCase().includes('sep 14')) && Boolean(currentWeekLabel?.toLowerCase().includes('sep 14')));
      return !isSameId && !isSameStart && !isSameLabel;
    });
  }, [habitHistory, currentWeekId, currentWeekLabel]);

  // If selectedWeekId is no longer in validPastWeeks, fallback to 'current'
  useEffect(() => {
    if (selectedWeekId !== 'current') {
      const exists = validPastWeeks.some((w) => w.id === selectedWeekId);
      if (!exists) {
        setSelectedWeekId('current');
      }
    }
  }, [selectedWeekId, validPastWeeks]);

  // Compute current day of week index (0=Mon ... 6=Sun)
  const currentDayIndex = (new Date().getDay() + 6) % 7;

  // Is viewing a previous week?
  const isViewingPastWeek = selectedWeekId !== 'current';
  const selectedPastWeekRecord = useMemo(() => {
    if (!isViewingPastWeek) return null;
    return validPastWeeks.find((w) => w.id === selectedWeekId) || null;
  }, [isViewingPastWeek, selectedWeekId, validPastWeeks]);

  // Active habits list depending on whether we are on current week or a past week
  const activeHabits: HabitItem[] = useMemo(() => {
    if (isViewingPastWeek && selectedPastWeekRecord) {
      return selectedPastWeekRecord.habits || [];
    }
    return habits;
  }, [isViewingPastWeek, selectedPastWeekRecord, habits]);

  // Active days info for headers
  const activeDaysInfo = useMemo(() => {
    if (isViewingPastWeek && selectedPastWeekRecord) {
      try {
        const monday = new Date(selectedPastWeekRecord.weekStart);
        return getWeekDaysInfo(monday);
      } catch {
        return daysInfo;
      }
    }
    return daysInfo;
  }, [isViewingPastWeek, selectedPastWeekRecord, daysInfo]);

  // Active week label
  const activeWeekLabel = useMemo(() => {
    if (isViewingPastWeek && selectedPastWeekRecord) {
      return selectedPastWeekRecord.label;
    }
    return currentWeekLabel;
  }, [isViewingPastWeek, selectedPastWeekRecord, currentWeekLabel]);

  // Available weeks list for navigation
  const availableWeeks = useMemo(() => {
    return [
      { id: 'current', label: currentWeekLabel, isCurrent: true, completionRate: 0 },
      ...validPastWeeks.map((w) => ({
        id: w.id,
        label: w.label,
        isCurrent: false,
        completionRate: w.completionRate,
      })),
    ];
  }, [currentWeekLabel, validPastWeeks]);

  const currentWeekIdx = availableWeeks.findIndex((w) => w.id === selectedWeekId);

  const handlePrevWeek = () => {
    Sound.click(soundEnabled);
    if (currentWeekIdx < availableWeeks.length - 1) {
      setSelectedWeekId(availableWeeks[currentWeekIdx + 1].id);
    }
  };

  const handleNextWeek = () => {
    Sound.click(soundEnabled);
    if (currentWeekIdx > 0) {
      setSelectedWeekId(availableWeeks[currentWeekIdx - 1].id);
    }
  };

  // Toggle habit day (handles both current week & historical weeks)
  const handleToggle = (habitId: string, dayIndex: number, currentlyDone: boolean) => {
    Sound.toggle(soundEnabled);
    if (!currentlyDone) {
      Sound.success(soundEnabled);
    }

    if (isViewingPastWeek && selectedWeekId !== 'current') {
      if (onToggleHistoricalHabitDay) {
        onToggleHistoricalHabitDay(selectedWeekId, habitId, dayIndex);
      }
    } else {
      onToggleHabitDay(habitId, dayIndex);
      const todayCompletedCount = habits.filter((h) =>
        h.id === habitId ? !currentlyDone : h.completedDays[currentDayIndex]
      ).length;
      if (todayCompletedCount === habits.length) {
        triggerConfetti();
      }
    }
  };

  // Add habit (handles both current week & historical weeks)
  const handleAddHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    Sound.success(soundEnabled);

    if (isViewingPastWeek && selectedWeekId !== 'current') {
      if (onAddHistoricalHabit) {
        onAddHistoricalHabit(
          selectedWeekId,
          newTitle.trim(),
          newCategory,
          newIcon,
          newColor
        );
      }
    } else {
      onAddHabit(newTitle.trim(), newCategory, newIcon, newColor);
    }

    setNewTitle('');
    setShowAddModal(false);
  };

  // Delete habit (handles both current week & historical weeks)
  const handleDeleteHabitItem = (habitId: string) => {
    Sound.click(soundEnabled);
    if (isViewingPastWeek && selectedWeekId !== 'current') {
      if (onDeleteHistoricalHabit) {
        onDeleteHistoricalHabit(selectedWeekId, habitId);
      }
    } else {
      onDeleteHabit(habitId);
    }
  };

  // Active week stats calculation
  const totalWeeklyChecks = activeHabits.reduce(
    (acc, h) => acc + h.completedDays.filter(Boolean).length,
    0
  );
  const maxWeeklyChecks = activeHabits.length * 7;
  const weeklyCompletionRate =
    maxWeeklyChecks > 0 ? Math.round((totalWeeklyChecks / maxWeeklyChecks) * 100) : 0;

  // Compute daily completion breakdown for the weekly trend bar
  const dailyCompletions = useMemo(() => {
    return Array.from({ length: 7 }, (_, dayIdx) => {
      const doneCount = activeHabits.filter((h) => h.completedDays[dayIdx]).length;
      const totalCount = activeHabits.length;
      const rate = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
      return {
        dayIdx,
        dayName: DAYS_OF_WEEK[dayIdx],
        doneCount,
        totalCount,
        rate,
      };
    });
  }, [activeHabits]);

  // ==================== STREAKS OF THE ENTIRE JOURNEY ====================
  const journeyStats = useMemo(() => {
    const activeDates = new Set<string>();

    // 1. Current week active dates
    const monday = getMondayOfWeek();
    habits.forEach((h) => {
      h.completedDays.forEach((done, idx) => {
        if (done) {
          const d = new Date(monday);
          d.setDate(monday.getDate() + idx);
          activeDates.add(d.toISOString().slice(0, 10));
        }
      });
    });

    // 2. Historical weeks active dates & check-ins
    let historicalDoneChecks = 0;
    let historicalPossibleChecks = 0;

    validPastWeeks.forEach((wk) => {
      historicalDoneChecks += (wk.totalDone || 0);
      historicalPossibleChecks += (wk.totalPossible || (wk.habits ? wk.habits.length * 7 : 0));
      if (wk.habits && Array.isArray(wk.habits)) {
        try {
          const wkMon = new Date(wk.weekStart);
          wk.habits.forEach((h) => {
            if (Array.isArray(h.completedDays)) {
              h.completedDays.forEach((done, idx) => {
                if (done) {
                  const d = new Date(wkMon);
                  d.setDate(wkMon.getDate() + idx);
                  activeDates.add(d.toISOString().slice(0, 10));
                }
              });
            }
          });
        } catch {
          // Ignore parse errors
        }
      }
    });

    // 3. Activity logs fallback
    habitActivities.forEach((act) => {
      if (act.completed && act.date) {
        activeDates.add(act.date);
      }
    });

    // Current week checks
    const currentWeekDone = habits.reduce(
      (acc, h) => acc + h.completedDays.filter(Boolean).length,
      0
    );
    const currentWeekPossible = habits.length * 7;
    const totalChecksAcrossJourney = historicalDoneChecks + currentWeekDone;
    const totalPossibleChecks = historicalPossibleChecks + currentWeekPossible;
    const journeyConsistency =
      totalPossibleChecks > 0
        ? Math.round((totalChecksAcrossJourney / totalPossibleChecks) * 100)
        : currentWeekPossible > 0
        ? Math.round((currentWeekDone / currentWeekPossible) * 100)
        : 0;

    // 4. Calculate longest streak across journey
    const sortedDates = Array.from(activeDates).sort();
    let bestStreak = 0;
    let tempStreak = 0;
    let prevDate: Date | null = null;

    sortedDates.forEach((dStr) => {
      const cur = new Date(dStr + 'T00:00:00');
      if (!prevDate) {
        tempStreak = 1;
      } else {
        const diffDays = Math.round((cur.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          tempStreak += 1;
        } else if (diffDays > 1) {
          tempStreak = 1;
        }
      }
      if (tempStreak > bestStreak) {
        bestStreak = tempStreak;
      }
      prevDate = cur;
    });

    // 5. Calculate current ongoing streak
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    let currentStreak = 0;
    if (activeDates.has(todayStr) || activeDates.has(yesterdayStr)) {
      const startCheck = activeDates.has(todayStr) ? today : yesterday;
      let d = new Date(startCheck);
      while (activeDates.has(d.toISOString().slice(0, 10))) {
        currentStreak += 1;
        d.setDate(d.getDate() - 1);
      }
    }

    if (currentStreak > bestStreak) {
      bestStreak = currentStreak;
    }

    return {
      currentStreak: Math.max(currentStreak, activeDates.size > 0 ? 1 : 0),
      bestStreak: Math.max(bestStreak, currentStreak, activeDates.size > 0 ? 1 : 0),
      totalChecks: totalChecksAcrossJourney,
      consistency: journeyConsistency,
      totalActiveDays: activeDates.size,
    };
  }, [habits, validPastWeeks, habitActivities]);

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. HERO TILE: STREAKS & STATS OF THE ENTIRE JOURNEY                       */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1E1B4B] via-[#0F172A] to-[#090D16] border border-indigo-900/50 p-6 sm:p-7 shadow-xl text-white">
        {/* Subtle Ambient Glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Left: Journey Brand & Streak Showcase */}
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/25 shrink-0">
              <Flame className="w-8 h-8 sm:w-9 sm:h-9 text-white fill-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-bold tracking-widest text-amber-400">
                  Lifetime Journey Streaks
                </span>
                <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  All-Time
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5 mt-0.5">
                <span>{journeyStats.currentStreak} Days</span>
                <span className="text-base sm:text-lg font-medium text-slate-300">Active Streak</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Consistent habit building across all recorded weeks and daily check-ins
              </p>
            </div>
          </div>

          {/* Right: Key Streak & Journey Tiles Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
            {/* Longest / Best Streak */}
            <div className="p-3.5 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-white/20 transition-all">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold mb-1">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>Best Streak</span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-white">
                {journeyStats.bestStreak} <span className="text-xs font-normal text-slate-400">Days</span>
              </div>
            </div>

            {/* Total Check-ins of Entire Journey */}
            <div className="p-3.5 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-white/20 transition-all">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Total Check-ins</span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-white">
                {journeyStats.totalChecks} <span className="text-xs font-normal text-slate-400">Done</span>
              </div>
            </div>

            {/* Consistency Rate */}
            <div className="col-span-2 sm:col-span-1 p-3.5 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-white/20 transition-all">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                <span>Consistency</span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-white">
                {journeyStats.consistency}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. WEEK SELECTOR & MODIFICATION CONTROLS                                  */}
      {/* ========================================================================= */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Week Navigation Buttons & Dropdown Selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center rounded-xl border border-[#E5E7EB] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A] p-1">
              <button
                type="button"
                onClick={handlePrevWeek}
                disabled={currentWeekIdx >= availableWeeks.length - 1}
                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#1E293B] text-[#4B5563] dark:text-[#9CA3AF] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="View previous week"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Direct Week Selector Dropdown */}
              <select
                value={selectedWeekId}
                onChange={(e) => {
                  Sound.click(soundEnabled);
                  setSelectedWeekId(e.target.value);
                }}
                className="bg-transparent text-xs sm:text-sm font-bold text-[#111827] dark:text-white px-2 py-1 outline-none cursor-pointer"
              >
                <option value="current">⚡ Current Week ({currentWeekLabel})</option>
                {validPastWeeks.map((past) => (
                  <option key={past.id} value={past.id}>
                    📅 {past.label} ({past.completionRate}% Done)
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleNextWeek}
                disabled={currentWeekIdx <= 0}
                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#1E293B] text-[#4B5563] dark:text-[#9CA3AF] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="View next week"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Quick jump to current week if on past week */}
            {isViewingPastWeek && (
              <button
                type="button"
                onClick={() => {
                  Sound.click(soundEnabled);
                  setSelectedWeekId('current');
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-bold border border-amber-300 dark:border-amber-700 hover:bg-amber-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Return to Current Week</span>
              </button>
            )}
          </div>

          {/* Add Habit Button */}
          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              setShowAddModal(true);
            }}
            className="px-4 py-2 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Habit {isViewingPastWeek ? 'to Past Week' : ''}</span>
          </button>
        </div>

        {/* Informative Banner when editing previous week */}
        {isViewingPastWeek && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                <strong>Modifying Past Week:</strong> You can retroactively check, uncheck, add, or delete habits for {activeWeekLabel}. All streak records and stats update instantly.
              </span>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-800/80 text-amber-900 dark:text-amber-100 shrink-0">
              Past Archive Active
            </span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. WEEKLY TREND BAR & DAILY BREAKDOWN                                     */}
        {/* ========================================================================= */}
        <div className="pt-2 border-t border-[#F3F4F6] dark:border-[#334155] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#6366F1]" />
              <span className="text-xs font-bold text-[#111827] dark:text-white uppercase tracking-wider">
                Weekly Trend: {activeWeekLabel}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#4B5563] dark:text-[#9CA3AF]">
              <span className="text-[#6366F1] font-black">{weeklyCompletionRate}%</span>
              <span>Routine Achieved</span>
              <span>({totalWeeklyChecks} of {maxWeeklyChecks} checks)</span>
            </div>
          </div>

          {/* Full-width completion progress bar */}
          <div className="w-full h-3 rounded-full bg-[#F3F4F6] dark:bg-[#0F172A] border border-[#E5E7EB] dark:border-[#334155] overflow-hidden p-0.5">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${weeklyCompletionRate}%` }}
            />
          </div>

          {/* Daily Trend Mini-Cards (Mon - Sun) */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 pt-1">
            {dailyCompletions.map((d) => {
              const isToday = !isViewingPastWeek && d.dayIdx === currentDayIndex;
              return (
                <div
                  key={d.dayIdx}
                  className={`p-2 rounded-xl text-center border transition-all ${
                    isToday
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700'
                      : 'bg-[#F9FAFB] dark:bg-[#0F172A]/50 border-[#E5E7EB] dark:border-[#334155]'
                  }`}
                >
                  <div className="text-[10px] sm:text-xs font-bold text-[#6B7280] dark:text-[#9CA3AF]">
                    {d.dayName}
                  </div>
                  <div className="text-xs sm:text-sm font-black text-[#111827] dark:text-white mt-0.5">
                    {d.doneCount}/{d.totalCount}
                  </div>
                  <div className="text-[9px] font-semibold text-[#9CA3AF] mt-0.5">
                    {d.rate}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. WEEKLY HABIT MATRIX TABLE                                              */}
        {/* ========================================================================= */}
        <div className="pt-2 border-t border-[#F3F4F6] dark:border-[#334155] overflow-x-auto">
          <div className="min-w-[650px] space-y-2">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 pb-2 border-b border-[#F3F4F6] dark:border-[#334155] text-xs font-bold text-[#6B7280] dark:text-[#9CA3AF]">
              <div className="col-span-5 pl-2">Habit Routine</div>
              <div className="col-span-7 grid grid-cols-7 gap-1 text-center">
                {activeDaysInfo.map((day, idx) => {
                  const isToday = !isViewingPastWeek && idx === currentDayIndex;
                  return (
                    <div
                      key={idx}
                      className={`p-1 rounded-lg ${
                        isToday
                          ? 'bg-indigo-50 dark:bg-indigo-950/50 text-[#6366F1] font-black'
                          : ''
                      }`}
                    >
                      <div className="text-[11px]">{day.name}</div>
                      <div className="text-[10px] text-[#9CA3AF] font-mono">{day.dateStr.slice(-2)}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Table Habit Rows */}
            {activeHabits.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#9CA3AF] space-y-3">
                <p>No habits logged for this week.</p>
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2 rounded-xl bg-[#6366F1] text-white text-xs font-bold cursor-pointer hover:bg-[#4F46E5] inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create First Habit</span>
                </button>
              </div>
            ) : (
              activeHabits.map((habit) => {
                const habitDoneCount = habit.completedDays.filter(Boolean).length;
                return (
                  <div
                    key={habit.id}
                    className="grid grid-cols-12 gap-2 items-center p-2.5 rounded-xl hover:bg-[#F9FAFB] dark:hover:bg-[#0F172A] transition-colors border border-transparent hover:border-[#E5E7EB] dark:hover:border-[#334155]"
                  >
                    {/* Left: Habit Info */}
                    <div className="col-span-5 flex items-center justify-between pr-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xl shrink-0">{habit.icon || '⚡'}</span>
                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-[#111827] dark:text-white truncate">
                            {habit.title}
                          </h4>
                          <div className="flex items-center gap-2 text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">
                            <span>{habit.category}</span>
                            <span>•</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {habitDoneCount}/7 this week
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Delete button */}
                      <button
                        type="button"
                        onClick={() => handleDeleteHabitItem(habit.id)}
                        className="text-[#9CA3AF] hover:text-rose-500 p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer shrink-0"
                        title="Delete habit"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Right: 7 Checkboxes */}
                    <div className="col-span-7 grid grid-cols-7 gap-1">
                      {habit.completedDays.map((isDone, dayIdx) => {
                        const day = activeDaysInfo[dayIdx];
                        const isToday = !isViewingPastWeek && dayIdx === currentDayIndex;
                        return (
                          <div key={dayIdx} className="flex justify-center">
                            <button
                              type="button"
                              onClick={() => handleToggle(habit.id, dayIdx, isDone)}
                              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                                isDone
                                  ? 'bg-[#6366F1] text-white shadow-xs scale-100'
                                  : isToday
                                  ? 'border-2 border-indigo-400 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-100'
                                  : 'border border-[#E5E7EB] dark:border-[#374151] bg-white dark:bg-[#111827] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937]'
                              }`}
                              title={`${habit.title} - ${day?.formattedDate || DAYS_OF_WEEK[dayIdx]}`}
                            >
                              {isDone && <Check className="w-4 h-4 stroke-[3]" />}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. ADD HABIT MODAL                                                        */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#F3F4F6] dark:border-[#334155] pb-3">
              <h3 className="text-base font-bold text-[#111827] dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#6366F1]" />
                <span>Add Habit {isViewingPastWeek ? `(${activeWeekLabel})` : ''}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddHabit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#374151] dark:text-[#D1D5DB] mb-1">
                  Habit Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Morning 20m Yoga, Read 10 Pages..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-xs sm:text-sm text-[#111827] dark:text-white outline-none focus:ring-2 focus:ring-[#6366F1]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#374151] dark:text-[#D1D5DB] mb-1">
                    Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-xs text-[#111827] dark:text-white outline-none"
                  >
                    <option value="Health">Health</option>
                    <option value="Productivity">Productivity</option>
                    <option value="Learning">Learning</option>
                    <option value="Mindfulness">Mindfulness</option>
                    <option value="Fitness">Fitness</option>
                    <option value="Creativity">Creativity</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#374151] dark:text-[#D1D5DB] mb-1">
                    Emoji Icon
                  </label>
                  <input
                    type="text"
                    value={newIcon}
                    onChange={(e) => setNewIcon(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-xs text-center text-[#111827] dark:text-white outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#F3F4F6] dark:border-[#334155]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#E5E7EB] dark:border-[#334155] text-xs font-bold text-[#4B5563] dark:text-[#9CA3AF] hover:bg-[#F3F4F6] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-bold cursor-pointer"
                >
                  Save Habit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
