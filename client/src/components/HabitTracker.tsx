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
  Edit2,
  Search,
  LayoutGrid,
  List,
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

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export interface HabitTrackerProps {
  habits: HabitItem[];
  habitHistory?: HabitWeekRecord[];
  habitActivities?: HabitActivityLog[];
  onToggleHabitDay: (habitId: string, dayIndex: number) => void;
  onAddHabit: (title: string, category: string, icon: string, color: string) => void;
  onUpdateHabit?: (habit: HabitItem) => void;
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
  onUpdateHabit,
  onDeleteHabit,
  onToggleHistoricalHabitDay,
  onAddHistoricalHabit,
  onDeleteHistoricalHabit,
  soundEnabled,
}) => {
  // View mode & Search query
  const [viewMode, setViewMode] = useState<'cards' | 'matrix'>('cards');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Historical Week Selector state: 'current' or specific weekId
  const [selectedWeekId, setSelectedWeekId] = useState<string>('current');

  // Add Habit modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Health');
  const [newIcon, setNewIcon] = useState('⚡');
  const [newColor, setNewColor] = useState('#6366F1');

  // Edit Habit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState<HabitItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('Health');
  const [editIcon, setEditIcon] = useState('⚡');
  const [editColor, setEditColor] = useState('#6366F1');

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

  // Habits filtered by search query
  const filteredActiveHabits = useMemo(() => {
    if (!searchQuery.trim()) return activeHabits;
    const q = searchQuery.toLowerCase().trim();
    return activeHabits.filter(
      (h) => h.title.toLowerCase().includes(q) || (h.category && h.category.toLowerCase().includes(q))
    );
  }, [activeHabits, searchQuery]);

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

  // Edit habit handlers
  const handleStartEditHabit = (habit: HabitItem) => {
    Sound.click(soundEnabled);
    setEditingHabit(habit);
    setEditTitle(habit.title);
    setEditCategory(habit.category || 'Health');
    setEditIcon(habit.icon || '⚡');
    setEditColor(habit.color || '#6366F1');
    setShowEditModal(true);
  };

  const handleSaveEditHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHabit || !editTitle.trim()) return;
    Sound.success(soundEnabled);

    const updated: HabitItem = {
      ...editingHabit,
      title: editTitle.trim(),
      category: editCategory || 'Health',
      icon: editIcon || '⚡',
      color: editColor || '#6366F1',
    };

    if (onUpdateHabit) {
      onUpdateHabit(updated);
    }

    setShowEditModal(false);
    setEditingHabit(null);
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
      {/* 0. TOP BANNER & ACTION HEADER (Calm Editorial Life OS)                     */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#630ed4] dark:text-[#d2bbff]">
              Calm Editorial Life OS
            </span>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <span className="text-[11px] font-semibold text-[#4a4455] dark:text-[#ccc3d8]">
              Tactile Precision
            </span>
          </div>
          <h1 className="font-sans font-extrabold text-[28px] sm:text-[32px] leading-[34px] sm:leading-[38px] tracking-[-0.02em] text-[#1a1b23] dark:text-[#f1effa] flex items-center gap-2.5">
            <span className="p-2 rounded-2xl bg-[#EDE9FE] dark:bg-[#630ed4]/20 text-[#630ed4] dark:text-[#d2bbff] border border-[#d2bbff]/40 dark:border-[#630ed4]/40">
              <Flame className="w-5 h-5 fill-[#630ed4] dark:fill-[#d2bbff]" />
            </span>
            <span>Daily Routines &amp; Habits</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#4a4455] dark:text-[#ccc3d8] mt-1 font-normal tracking-[-0.01em]">
            {habits.length} habits tracked this week • Diminish cognitive friction, cultivate atomic consistency, and track compounding momentum.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            Sound.click(soundEnabled);
            setShowAddModal(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-[#630ed4] hover:bg-[#732ee4] active:scale-98 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-[0_2px_12px_rgba(99,14,212,0.25)] transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add Habit</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. WEEKLY MOMENTUM PROGRESS CARD (Editorial Hero)                         */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#fbf8ff] via-[#f4f2fd] to-[#EDE9FE] dark:from-[#121826] dark:via-[#1A2234] dark:to-[#0B0F19] text-[#1a1b23] dark:text-[#f1effa] border border-[#E8E5F3] dark:border-[#242D40] p-5 sm:p-6 shadow-[0_2px_12px_rgba(99,14,212,0.06)]">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#732ee4]/10 dark:bg-[#630ed4]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[#EDE9FE] dark:bg-[#630ed4]/30 text-[10px] font-bold uppercase tracking-[0.08em] text-[#4C1D95] dark:text-[#d2bbff] border border-[#d2bbff]/50 dark:border-[#630ed4]/40">
                Weekly Momentum
              </span>
              <div className="p-1 rounded-full bg-white dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40]">
                <Flame className="w-3.5 h-3.5 text-[#F59E0B] fill-[#F59E0B]" />
              </div>
            </div>
            <div className="flex items-baseline gap-2.5">
              <span className="font-extrabold text-[32px] sm:text-[36px] leading-[40px] tracking-[-0.03em] font-sans text-[#1a1b23] dark:text-white">
                {weeklyCompletionRate}%
              </span>
              <span className="text-xs sm:text-sm text-[#4a4455] dark:text-[#ccc3d8] font-medium tracking-[-0.01em]">
                ({totalWeeklyChecks} of {maxWeeklyChecks} completions this week)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#4C1D95] dark:text-[#d2bbff] bg-white dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] px-3 py-1.5 rounded-xl shadow-2xs">
              {activeHabits.length} active routines
            </span>
          </div>
        </div>

        {/* Progress Bar with Spring-Damper styling */}
        <div className="w-full h-2.5 bg-[#efecf8] dark:bg-[#1A2234] rounded-full mt-4 overflow-hidden relative border border-[#E8E5F3]/60 dark:border-[#242D40]">
          <div
            className="h-full bg-gradient-to-r from-[#630ed4] via-[#732ee4] to-[#4648d4] rounded-full transition-all duration-500 shadow-sm"
            style={{ width: `${weeklyCompletionRate}%` }}
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SEARCH & VIEW CONTROLS (Tactile Filter Controls)                       */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-[#7b7487] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search habits & routines..."
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] text-xs text-[#1a1b23] dark:text-[#f1effa] placeholder-[#7b7487] focus:outline-none focus:border-[#630ed4] shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#7b7487] hover:text-[#1a1b23] dark:hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* View Switcher: Cards vs Matrix */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="flex items-center bg-[#efecf8] dark:bg-[#1A2234] p-0.5 rounded-xl border border-[#E8E5F3] dark:border-[#242D40]">
            <button
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                setViewMode('cards');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-[#121826] text-[#630ed4] dark:text-[#d2bbff] shadow-xs'
                  : 'text-[#4a4455] dark:text-[#ccc3d8] hover:text-[#1a1b23] dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                setViewMode('matrix');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'matrix'
                  ? 'bg-white dark:bg-[#121826] text-[#630ed4] dark:text-[#d2bbff] shadow-xs'
                  : 'text-[#4a4455] dark:text-[#ccc3d8] hover:text-[#1a1b23] dark:hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Matrix</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. HERO TILE: STREAKS & STATS OF THE ENTIRE JOURNEY                       */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] p-6 sm:p-7 shadow-[0_2px_12px_rgba(99,14,212,0.04)] text-[#1a1b23] dark:text-[#f1effa]">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Left: Journey Brand & Streak Showcase */}
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#EDE9FE] dark:bg-[#630ed4]/20 border border-[#d2bbff]/60 dark:border-[#630ed4]/40 flex items-center justify-center shadow-xs shrink-0 text-[#630ed4] dark:text-[#d2bbff]">
              <Flame className="w-8 h-8 sm:w-9 sm:h-9 fill-[#F59E0B] text-[#F59E0B] animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#630ed4] dark:text-[#d2bbff]">
                  Lifetime Journey Streaks
                </span>
                <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-[#f4f2fd] dark:bg-[#1A2234] text-[#4a4455] dark:text-[#ccc3d8] border border-[#E8E5F3] dark:border-[#242D40]">
                  All-Time
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-[-0.03em] text-[#1a1b23] dark:text-white flex items-center gap-2.5 mt-0.5 font-sans">
                <span>{journeyStats.currentStreak} Days</span>
                <span className="text-base sm:text-lg font-medium text-[#4a4455] dark:text-[#ccc3d8]">Active Streak</span>
              </h2>
              <p className="text-xs text-[#4a4455] dark:text-[#ccc3d8] mt-1 tracking-[-0.01em]">
                Consistent habit building across all recorded weeks and daily check-ins
              </p>
            </div>
          </div>

          {/* Right: Key Streak & Journey Tiles Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
            {/* Longest / Best Streak */}
            <div className="p-3.5 rounded-2xl bg-[#fbf8ff] dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] hover:border-[#ccc3d8] dark:hover:border-[#334155] transition-all">
              <div className="flex items-center gap-1.5 text-[#4a4455] dark:text-[#ccc3d8] text-xs font-semibold mb-1">
                <Trophy className="w-3.5 h-3.5 text-[#F59E0B]" />
                <span>Best Streak</span>
              </div>
              <div className="text-xl sm:text-2xl font-extrabold text-[#1a1b23] dark:text-white font-sans tracking-[-0.02em]">
                {journeyStats.bestStreak} <span className="text-xs font-normal text-[#4a4455] dark:text-[#ccc3d8]">Days</span>
              </div>
            </div>

            {/* Total Check-ins of Entire Journey */}
            <div className="p-3.5 rounded-2xl bg-[#fbf8ff] dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] hover:border-[#ccc3d8] dark:hover:border-[#334155] transition-all">
              <div className="flex items-center gap-1.5 text-[#4a4455] dark:text-[#ccc3d8] text-xs font-semibold mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
                <span>Total Check-ins</span>
              </div>
              <div className="text-xl sm:text-2xl font-extrabold text-[#1a1b23] dark:text-white font-sans tracking-[-0.02em]">
                {journeyStats.totalChecks} <span className="text-xs font-normal text-[#4a4455] dark:text-[#ccc3d8]">Done</span>
              </div>
            </div>

            {/* Consistency Rate */}
            <div className="col-span-2 sm:col-span-1 p-3.5 rounded-2xl bg-[#fbf8ff] dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] hover:border-[#ccc3d8] dark:hover:border-[#334155] transition-all">
              <div className="flex items-center gap-1.5 text-[#4a4455] dark:text-[#ccc3d8] text-xs font-semibold mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-[#630ed4] dark:text-[#d2bbff]" />
                <span>Consistency</span>
              </div>
              <div className="text-xl sm:text-2xl font-extrabold text-[#1a1b23] dark:text-white font-sans tracking-[-0.02em]">
                {journeyStats.consistency}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. WEEK SELECTOR & MODIFICATION CONTROLS                                  */}
      {/* ========================================================================= */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Week Navigation Buttons & Dropdown Selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center rounded-xl border border-[#E8E5F3] dark:border-[#242D40] bg-[#fbf8ff] dark:bg-[#1A2234] p-1">
              <button
                type="button"
                onClick={handlePrevWeek}
                disabled={currentWeekIdx >= availableWeeks.length - 1}
                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#121826] text-[#4a4455] dark:text-[#ccc3d8] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
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
                className="bg-transparent text-xs sm:text-sm font-bold text-[#1a1b23] dark:text-white px-2 py-1 outline-none cursor-pointer"
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
                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#121826] text-[#4a4455] dark:text-[#ccc3d8] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
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
                className="px-3 py-1.5 rounded-xl bg-[#EDE9FE] dark:bg-[#630ed4]/25 text-[#4C1D95] dark:text-[#d2bbff] text-xs font-bold border border-[#d2bbff]/60 dark:border-[#630ed4]/40 hover:bg-[#d2bbff]/50 transition-colors flex items-center gap-1.5 cursor-pointer"
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
            className="px-4 py-2 rounded-xl bg-[#630ed4] hover:bg-[#732ee4] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-xs shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Habit {isViewingPastWeek ? 'to Past Week' : ''}</span>
          </button>
        </div>

        {/* Informative Banner when editing previous week */}
        {isViewingPastWeek && (
          <div className="p-3 rounded-xl bg-[#EDE9FE]/50 dark:bg-[#630ed4]/20 border border-[#d2bbff]/60 dark:border-[#630ed4]/40 text-xs text-[#4C1D95] dark:text-[#d2bbff] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#630ed4] dark:text-[#d2bbff] shrink-0" />
              <span>
                <strong>Modifying Past Week:</strong> You can retroactively check, uncheck, add, or delete habits for {activeWeekLabel}. All streak records and stats update instantly.
              </span>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-[#1A2234] border border-[#d2bbff]/60 dark:border-[#630ed4]/40 text-[#4C1D95] dark:text-[#d2bbff] shrink-0">
              Past Archive Active
            </span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 5. WEEKLY TREND BAR & DAILY BREAKDOWN                                     */}
        {/* ========================================================================= */}
        <div className="pt-2 border-t border-[#E8E5F3] dark:border-[#242D40] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#630ed4] dark:text-[#d2bbff]" />
              <span className="text-[11px] font-bold text-[#1a1b23] dark:text-white uppercase tracking-[0.08em]">
                Weekly Trend: {activeWeekLabel}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#4a4455] dark:text-[#ccc3d8]">
              <span className="text-[#630ed4] dark:text-[#d2bbff] font-extrabold">{weeklyCompletionRate}%</span>
              <span>Routine Achieved</span>
              <span>({totalWeeklyChecks} of {maxWeeklyChecks} checks)</span>
            </div>
          </div>

          {/* Full-width completion progress bar */}
          <div className="w-full h-2.5 rounded-full bg-[#efecf8] dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] overflow-hidden p-0.5">
            <div
              className="h-full bg-gradient-to-r from-[#630ed4] via-[#732ee4] to-[#10B981] rounded-full transition-all duration-500"
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
                      ? 'bg-[#EDE9FE] dark:bg-[#630ed4]/20 border-[#630ed4] text-[#4C1D95] dark:text-[#d2bbff]'
                      : 'bg-[#fbf8ff] dark:bg-[#1A2234] border-[#E8E5F3] dark:border-[#242D40]'
                  }`}
                >
                  <div className="text-[10px] sm:text-xs font-bold text-[#4a4455] dark:text-[#ccc3d8]">
                    {d.dayName}
                  </div>
                  <div className="text-xs sm:text-sm font-extrabold text-[#1a1b23] dark:text-white mt-0.5 font-mono">
                    {d.doneCount}/{d.totalCount}
                  </div>
                  <div className="text-[9px] font-semibold text-[#7b7487] mt-0.5 font-mono">
                    {d.rate}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 6. HABITS CONTENT: CARDS VIEW OR MATRIX VIEW                             */}
        {/* ========================================================================= */}
        <div className="pt-3 border-t border-[#E8E5F3] dark:border-[#242D40]">
          {filteredActiveHabits.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#7b7487] space-y-3">
              <Flame className="w-10 h-10 text-[#630ed4] dark:text-[#d2bbff] mx-auto mb-2 opacity-60" />
              <p className="text-sm font-bold text-[#1a1b23] dark:text-gray-200">
                {searchQuery ? 'No habits match your search' : 'No habits logged for this week.'}
              </p>
              <p className="text-xs text-[#4a4455] dark:text-[#ccc3d8]">
                {searchQuery ? 'Try searching for a different keyword or category.' : 'Build lasting daily routines. Tap “Add Habit” above!'}
              </p>
              {!searchQuery && (
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2 rounded-xl bg-[#630ed4] text-white text-xs font-bold cursor-pointer hover:bg-[#732ee4] inline-flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create First Habit</span>
                </button>
              )}
            </div>
          ) : viewMode === 'cards' ? (
            /* =================================================================== */
            /* VIEW MODE A: CALM EDITORIAL HABIT CARDS GRID                        */
            /* =================================================================== */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredActiveHabits.map((habit) => {
                const habitDoneCount = habit.completedDays.filter(Boolean).length;
                const habitPercent = Math.round((habitDoneCount / 7) * 100);
                return (
                  <div
                    key={habit.id}
                    className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-xs hover:border-[#ccc3d8] dark:hover:border-[#4a4455] hover:shadow-[0_4px_20px_rgba(99,14,212,0.06)] transition-all space-y-4 group"
                  >
                    {/* Top Header of Card */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 shadow-xs border border-[#E8E5F3] dark:border-[#242D40]"
                          style={{
                            backgroundColor: `${habit.color || '#630ed4'}18`,
                            color: habit.color || '#630ed4',
                          }}
                        >
                          <span>{habit.icon || '⚡'}</span>
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm sm:text-base font-bold text-[#1a1b23] dark:text-[#f1effa] truncate tracking-[-0.01em]">
                            {habit.title}
                          </h3>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fbf8ff] dark:bg-[#1A2234] text-[#4a4455] dark:text-[#ccc3d8] border border-[#E8E5F3] dark:border-[#242D40]">
                              {habit.category || 'General'}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#FEF3C7] dark:bg-[#78350F]/40 text-[#78350F] dark:text-[#FEF3C7] border border-[#F59E0B]/30 flex items-center gap-1 font-mono">
                              <Flame className="w-3 h-3 text-[#F59E0B] fill-[#F59E0B]" />
                              <span>{habit.streak || 0}d streak</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleStartEditHabit(habit)}
                          className="p-1.5 rounded-lg text-[#7b7487] hover:text-[#630ed4] dark:hover:text-[#d2bbff] hover:bg-[#EDE9FE] dark:hover:bg-[#1A2234] transition-colors cursor-pointer"
                          title="Edit habit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteHabitItem(habit.id)}
                          className="p-1.5 rounded-lg text-[#7b7487] hover:text-[#EF4444] dark:hover:text-rose-400 hover:bg-[#FEE2E2] dark:hover:bg-[#1A2234] transition-colors cursor-pointer"
                          title="Delete habit"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* 7-Day Completion Bubbles (Tactile Modernist precision) */}
                    <div className="grid grid-cols-7 gap-1 sm:gap-2 pt-1">
                      {activeDaysInfo.map((day, dayIdx) => {
                        const isDone = habit.completedDays[dayIdx];
                        const isToday = !isViewingPastWeek && dayIdx === currentDayIndex;
                        return (
                          <button
                            key={dayIdx}
                            type="button"
                            onClick={() => handleToggle(habit.id, dayIdx, isDone)}
                            className={`py-2 px-1 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer border ${
                              isDone
                                ? 'bg-[#10B981] text-white border-[#10B981] shadow-xs'
                                : isToday
                                ? 'border-2 border-[#630ed4] bg-[#EDE9FE]/50 dark:bg-[#630ed4]/20 text-[#630ed4] dark:text-[#d2bbff]'
                                : 'border-[#E8E5F3] dark:border-[#242D40] bg-[#fbf8ff] dark:bg-[#1A2234] text-[#4a4455] dark:text-[#ccc3d8] hover:bg-[#efecf8] dark:hover:bg-[#242D40]'
                            }`}
                            title={`${day.name} (${day.dateStr}): ${isDone ? 'Completed' : 'Pending'}`}
                          >
                            <span className="text-[10px] font-bold uppercase tracking-wider">{DAY_LABELS[dayIdx]}</span>
                            <span className="text-xs font-mono font-bold mt-0.5">
                              {day.dateStr ? day.dateStr.slice(-2) : dayIdx + 1}
                            </span>
                            <div className="mt-1">
                              {isDone ? (
                                <Check className="w-3 h-3 stroke-[3]" />
                              ) : (
                                <div className="w-1.5 h-1.5 rounded-full bg-[#ccc3d8] dark:bg-gray-600" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Weekly Completion Progress Bar */}
                    <div className="pt-2 border-t border-[#E8E5F3] dark:border-[#242D40] space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-[#4a4455] dark:text-[#ccc3d8]">
                        <span>{habitDoneCount}/7 days completed</span>
                        <span className="font-bold text-[#1a1b23] dark:text-white font-mono">{habitPercent}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#efecf8] dark:bg-[#1A2234] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#10B981] rounded-full transition-all duration-300"
                          style={{ width: `${habitPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* =================================================================== */
            /* VIEW MODE B: FULL MATRIX TABLE (Calm Editorial Precision)           */
            /* =================================================================== */
            <div className="overflow-x-auto">
              <div className="min-w-[650px] space-y-2">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-2 pb-2 border-b border-[#E8E5F3] dark:border-[#242D40] text-xs font-bold text-[#4a4455] dark:text-[#ccc3d8]">
                  <div className="col-span-5 pl-2">Habit Routine</div>
                  <div className="col-span-7 grid grid-cols-7 gap-1 text-center">
                    {activeDaysInfo.map((day, idx) => {
                      const isToday = !isViewingPastWeek && idx === currentDayIndex;
                      return (
                        <div
                          key={idx}
                          className={`p-1 rounded-lg ${
                            isToday
                              ? 'bg-[#EDE9FE] dark:bg-[#630ed4]/20 text-[#630ed4] dark:text-[#d2bbff] font-black'
                              : ''
                          }`}
                        >
                          <div className="text-[11px] font-bold">{day.name}</div>
                          <div className="text-[10px] text-[#7b7487] font-mono">{day.dateStr.slice(-2)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Table Habit Rows */}
                {filteredActiveHabits.map((habit) => {
                  const habitDoneCount = habit.completedDays.filter(Boolean).length;
                  return (
                    <div
                      key={habit.id}
                      className="grid grid-cols-12 gap-2 items-center p-2.5 rounded-xl hover:bg-[#fbf8ff] dark:hover:bg-[#1A2234] transition-colors border border-transparent hover:border-[#E8E5F3] dark:hover:border-[#242D40]"
                    >
                      {/* Left: Habit Info */}
                      <div className="col-span-5 flex items-center justify-between pr-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-xl shrink-0">{habit.icon || '⚡'}</span>
                          <div className="min-w-0">
                            <h4 className="text-xs sm:text-sm font-bold text-[#1a1b23] dark:text-white truncate">
                              {habit.title}
                            </h4>
                            <div className="flex items-center gap-2 text-[10px] text-[#4a4455] dark:text-[#ccc3d8]">
                              <span>{habit.category}</span>
                              <span>•</span>
                              <span className="font-semibold text-[#10B981] font-mono">
                                {habitDoneCount}/7 this week
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEditHabit(habit)}
                            className="text-[#7b7487] hover:text-[#630ed4] dark:hover:text-[#d2bbff] p-1 rounded-lg hover:bg-[#EDE9FE] dark:hover:bg-[#1A2234] transition-colors cursor-pointer"
                            title="Edit habit details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteHabitItem(habit.id)}
                            className="text-[#7b7487] hover:text-[#EF4444] p-1 rounded-lg hover:bg-[#FEE2E2] dark:hover:bg-[#1A2234] transition-colors cursor-pointer"
                            title="Delete habit"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
                                    ? 'bg-[#10B981] text-white shadow-xs scale-100'
                                    : isToday
                                    ? 'border-2 border-[#630ed4] dark:border-[#732ee4] bg-[#EDE9FE]/50 dark:bg-[#630ed4]/30 hover:bg-[#EDE9FE]'
                                    : 'border border-[#E8E5F3] dark:border-[#242D40] bg-white dark:bg-[#121826] hover:bg-[#efecf8] dark:hover:bg-[#1A2234]'
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
                })}
              </div>
            </div>
          )}
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

      {/* ========================================================================= */}
      {/* 6. EDIT HABIT MODAL                                                       */}
      {/* ========================================================================= */}
      {showEditModal && editingHabit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#F3F4F6] dark:border-[#334155] pb-3">
              <h3 className="text-base font-bold text-[#111827] dark:text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-[#6366F1]" />
                <span>Edit Habit</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingHabit(null);
                }}
                className="text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditHabit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#374151] dark:text-[#D1D5DB] mb-1">
                  Habit Title
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
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
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-xs text-[#111827] dark:text-white outline-none"
                  >
                    <option value="Health">Health</option>
                    <option value="Productivity">Productivity</option>
                    <option value="Learning">Learning</option>
                    <option value="Mindfulness">Mindfulness</option>
                    <option value="Fitness">Fitness</option>
                    <option value="Creativity">Creativity</option>
                    <option value="Finance">Finance</option>
                    <option value="Daily">Daily</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#374151] dark:text-[#D1D5DB] mb-1">
                    Emoji Icon
                  </label>
                  <input
                    type="text"
                    value={editIcon}
                    onChange={(e) => setEditIcon(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-xs text-center text-[#111827] dark:text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] dark:text-[#D1D5DB] mb-1">
                  Accent Color
                </label>
                <div className="flex items-center gap-2">
                  {['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#8B5CF6'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                        editColor === c ? 'scale-125 border-gray-900 dark:border-white shadow-xs' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="w-7 h-7 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer p-0 bg-transparent"
                    title="Custom color"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#F3F4F6] dark:border-[#334155]">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingHabit(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-[#E5E7EB] dark:border-[#334155] text-xs font-bold text-[#4B5563] dark:text-[#9CA3AF] hover:bg-[#F3F4F6] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-bold cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
