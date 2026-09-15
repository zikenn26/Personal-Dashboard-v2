import React, { useState, useMemo } from 'react';
import {
  Flame,
  Plus,
  Trash2,
  Sparkles,
  RotateCcw,
  Check,
  Calendar,
  History,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Search,
  CheckCircle2,
  CalendarDays,
  Clock,
  ArrowRight,
  Edit3,
  ExternalLink,
} from 'lucide-react';
import { HabitItem, HabitWeekRecord, HabitActivityLog } from '../types';
import { Sound } from '../utils/audio';
import { triggerConfetti } from '../utils/confetti';
import {
  DAYS_OF_WEEK,
  getMondayOfWeek,
  formatWeekRange,
  getWeekDaysInfo,
} from '../utils/habitWeekManager';
import { HabitStreakChart } from './HabitStreakChart';

export interface HabitTrackerProps {
  habits: HabitItem[];
  habitHistory?: HabitWeekRecord[];
  habitActivities?: HabitActivityLog[];
  onToggleHabitDay: (habitId: string, dayIndex: number) => void;
  onAddHabit: (title: string, category: string, icon: string, color: string) => void;
  onDeleteHabit: (habitId: string) => void;
  onResetWeek: () => void;
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
  onResetWeek,
  onSimulateMondayRollover,
  onToggleHistoricalHabitDay,
  onAddHistoricalHabit,
  onDeleteHistoricalHabit,
  soundEnabled,
}) => {
  const [activeTab, setActiveTab] = useState<'current' | 'analytics' | 'history'>('current');
  const [historySubTab, setHistorySubTab] = useState<'weeks' | 'activities'>('weeks');
  const [expandedWeekId, setExpandedWeekId] = useState<string | null>(null);
  const [activitySearch, setActivitySearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Historical Week Selector state
  const [selectedWeekId, setSelectedWeekId] = useState<string>('current');

  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Health');
  const [newIcon, setNewIcon] = useState('⚡');
  const [newColor, setNewColor] = useState('#3b82f6');

  // Compute current Monday & week days info
  const currentMonday = getMondayOfWeek();
  const currentWeekLabel = formatWeekRange(currentMonday);
  const daysInfo = getWeekDaysInfo(currentMonday);

  // Compute current day of week index (0=Mon ... 6=Sun)
  const currentDayIndex = (new Date().getDay() + 6) % 7;

  // Is viewing a previous week?
  const isViewingPastWeek = selectedWeekId !== 'current';
  const selectedPastWeekRecord = useMemo(() => {
    if (!isViewingPastWeek) return null;
    return habitHistory.find((w) => w.id === selectedWeekId) || null;
  }, [isViewingPastWeek, selectedWeekId, habitHistory]);

  // Active habits list depending on whether we are on the current week or a past week
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
      } catch (e) {
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
      ...habitHistory.map((w) => ({
        id: w.id,
        label: w.label,
        isCurrent: false,
        completionRate: w.completionRate,
      })),
    ];
  }, [currentWeekLabel, habitHistory]);

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

  // Toggle habit day (handles both current week & historical weeks!)
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

  // Add habit (handles both current week & historical weeks!)
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

  // Delete habit (handles both current week & historical weeks!)
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

  const todayCompletedCount = habits.filter((h) => h.completedDays[currentDayIndex]).length;
  const todayRate = habits.length > 0 ? Math.round((todayCompletedCount / habits.length) * 100) : 0;

  // Historical aggregated statistics
  const totalArchivedWeeks = habitHistory.length;
  const totalHistoricalActivities = habitHistory.reduce((acc, r) => acc + (r.totalDone || 0), 0);
  const avgHistoricalRate =
    totalArchivedWeeks > 0
      ? Math.round(
          habitHistory.reduce((acc, r) => acc + (r.completionRate || 0), 0) / totalArchivedWeeks
        )
      : 0;

  // Filter historical activities
  const allHistoricalActivities = useMemo(() => {
    let list: HabitActivityLog[] = [...habitActivities];
    habitHistory.forEach((wk) => {
      if (wk.activities && wk.activities.length > 0) {
        wk.activities.forEach((act) => {
          if (!list.some((existing) => existing.id === act.id)) {
            list.push(act);
          }
        });
      }
    });
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [habitActivities, habitHistory]);

  const filteredActivities = useMemo(() => {
    return allHistoricalActivities.filter((act) => {
      const matchSearch =
        act.habitTitle.toLowerCase().includes(activitySearch.toLowerCase()) ||
        act.category.toLowerCase().includes(activitySearch.toLowerCase()) ||
        act.dayName.toLowerCase().includes(activitySearch.toLowerCase()) ||
        act.date.includes(activitySearch);

      const matchCategory =
        selectedCategory === 'all' ||
        act.category.toLowerCase() === selectedCategory.toLowerCase();

      return matchSearch && matchCategory;
    });
  }, [allHistoricalActivities, activitySearch, selectedCategory]);

  return (
    <div className="space-y-6">
      {/* Top Header Card with Tabs & Actions */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#F3F4F6] dark:bg-[#0F172A] border border-[#E5E7EB] dark:border-[#334155] overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              setActiveTab('current');
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'current'
                ? 'bg-white dark:bg-[#1E293B] text-[#111827] dark:text-white shadow-2xs'
                : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-[#6366F1]" />
            <span>Habit Matrix</span>
            {isViewingPastWeek && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              setActiveTab('analytics');
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'analytics'
                ? 'bg-white dark:bg-[#1E293B] text-[#111827] dark:text-white shadow-2xs'
                : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <span>Momentum Graph</span>
          </button>

          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              setActiveTab('history');
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'history'
                ? 'bg-white dark:bg-[#1E293B] text-[#111827] dark:text-white shadow-2xs'
                : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5 text-amber-500" />
            <span>Past Archives</span>
            {totalArchivedWeeks > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                {totalArchivedWeeks}
              </span>
            )}
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              setShowAddModal(true);
            }}
            className="px-3.5 py-1.5 text-xs font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isViewingPastWeek ? 'Add Habit to Past Week' : 'New Habit'}</span>
          </button>
        </div>
      </div>

      {/* ==================== HABIT MATRIX VIEW (Current OR Selected Previous Week) ==================== */}
      {activeTab === 'current' && (
        <div className="space-y-4">
          {/* Week Selector & Historical Notice Bar */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Navigation Buttons + Dropdown */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <button
                type="button"
                onClick={handlePrevWeek}
                disabled={currentWeekIdx >= availableWeeks.length - 1}
                className="p-1.5 sm:p-2 rounded-xl border border-[#E5E7EB] dark:border-[#374151] hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer text-[#374151] dark:text-[#D1D5DB]"
                title="Go to Previous Week"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex-1 md:flex-initial min-w-[220px]">
                <select
                  value={selectedWeekId}
                  onChange={(e) => {
                    Sound.click(soundEnabled);
                    setSelectedWeekId(e.target.value);
                  }}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#F9FAFB] dark:bg-[#0F172A] border border-[#E5E7EB] dark:border-[#374151] text-xs font-bold text-[#111827] dark:text-white cursor-pointer"
                >
                  <option value="current">⚡ Current Week ({currentWeekLabel})</option>
                  {habitHistory.map((wk) => (
                    <option key={wk.id} value={wk.id}>
                      📅 {wk.label} • {wk.completionRate}% Done ({wk.habits.length} habits)
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleNextWeek}
                disabled={selectedWeekId === 'current' || currentWeekIdx <= 0}
                className="p-1.5 sm:p-2 rounded-xl border border-[#E5E7EB] dark:border-[#374151] hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer text-[#374151] dark:text-[#D1D5DB]"
                title="Go forward toward Current Week"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Status Indicator & Return Button */}
            <div className="flex items-center gap-2 justify-between md:justify-end">
              {isViewingPastWeek ? (
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs font-bold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>Editing Past Week</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      Sound.click(soundEnabled);
                      setSelectedWeekId('current');
                    }}
                    className="px-3 py-1 text-xs font-bold rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white transition-colors cursor-pointer shadow-2xs"
                  >
                    Jump to Current Week
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Current Active Week</span>
                  </span>

                  {onSimulateMondayRollover && (
                    <button
                      type="button"
                      onClick={() => {
                        Sound.click(soundEnabled);
                        onSimulateMondayRollover();
                      }}
                      className="px-2.5 py-1 text-[11px] font-semibold text-[#4F46E5] dark:text-[#818CF8] hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-xl border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
                      title="Archive current week and simulate a fresh Monday reset"
                    >
                      Simulate Monday Reset
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Historical Editing Banner when viewing a previous week */}
          {isViewingPastWeek && (
            <div className="p-3 rounded-xl bg-gradient-to-r from-amber-50/90 via-amber-50/50 to-orange-50/80 dark:from-amber-950/50 dark:via-[#1E293B] dark:to-orange-950/40 border border-amber-200 dark:border-amber-800/80 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <span className="text-base shrink-0">✏️</span>
                <div>
                  <p className="font-bold text-amber-900 dark:text-amber-100">
                    Editing Habits for Week: <span className="underline">{activeWeekLabel}</span>
                  </p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                    Click any day checkbox (Mon–Sun) to toggle completions. You can also add or delete habits for this past week. All changes update your archived statistics and momentum graphs automatically.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  Sound.click(soundEnabled);
                  setSelectedWeekId('current');
                }}
                className="shrink-0 text-xs font-bold text-amber-800 dark:text-amber-200 hover:underline cursor-pointer"
              >
                Back to Current
              </button>
            </div>
          )}

          {/* Quick Routine KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-[#F9FAFB] dark:bg-[#1E293B]/60 border border-[#E5E7EB] dark:border-[#334155]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#9CA3AF] block">
                {isViewingPastWeek ? 'Week Completion Rate' : "Today's Completion"}
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-lg font-bold text-[#111827] dark:text-white">
                  {isViewingPastWeek
                    ? `${weeklyCompletionRate}%`
                    : `${todayCompletedCount}/${habits.length}`}
                </span>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {isViewingPastWeek ? `${totalWeeklyChecks} done` : `${todayRate}%`}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#F9FAFB] dark:bg-[#1E293B]/60 border border-[#E5E7EB] dark:border-[#334155]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#9CA3AF] block">
                Week Total Checks
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-lg font-bold text-[#111827] dark:text-white">
                  {totalWeeklyChecks}
                </span>
                <span className="text-xs text-[#9CA3AF]">/ {maxWeeklyChecks} checks</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#F9FAFB] dark:bg-[#1E293B]/60 border border-[#E5E7EB] dark:border-[#334155]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#9CA3AF] block">
                Target Achievement
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-lg font-bold text-[#6366F1] dark:text-[#818CF8]">
                  {weeklyCompletionRate}%
                </span>
                <span className="text-xs text-[#9CA3AF]">
                  {weeklyCompletionRate >= 80 ? 'Mastery' : 'In Progress'}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#F9FAFB] dark:bg-[#1E293B]/60 border border-[#E5E7EB] dark:border-[#334155]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#9CA3AF] block">
                Week Status
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-sm font-bold text-[#111827] dark:text-white">
                  {isViewingPastWeek ? 'Archived Record' : 'Active Cycle'}
                </span>
                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                  {activeHabits.length} habits
                </span>
              </div>
            </div>
          </div>

          {/* Habit Matrix Container */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#F3F4F6] dark:border-[#334155]">
              <div>
                <h3 className="text-sm font-bold text-[#111827] dark:text-white">
                  {isViewingPastWeek
                    ? `Archived Routine Matrix (${activeWeekLabel})`
                    : 'Weekly Routine Matrix'}
                </h3>
                <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">
                  {isViewingPastWeek
                    ? 'Click on any day checkbox to retroactively edit or log habit completion.'
                    : 'Track each daily routine from Monday through Sunday.'}
                </p>
              </div>

              {isViewingPastWeek && (
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Habit to This Week</span>
                </button>
              )}
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto pb-2">
              <div className="min-w-[620px] space-y-2">
                {/* Table Header: Days of the week */}
                <div className="grid grid-cols-12 gap-1.5 text-center text-[11px] font-semibold text-[#6B7280] dark:text-[#9CA3AF] pb-1 border-b border-[#F3F4F6] dark:border-[#334155]">
                  <div className="col-span-5 text-left pl-2">HABIT ROUTINE</div>
                  {activeDaysInfo.map((day, idx) => {
                    const isWeekend = idx >= 5;
                    return (
                      <div
                        key={day.dateStr}
                        className={`col-span-1 p-1 rounded-lg ${
                          !isViewingPastWeek && day.isToday
                            ? 'bg-[#EEF2FF] dark:bg-[#1E1B4B] text-[#6366F1] dark:text-[#818CF8] font-bold ring-2 ring-indigo-400 dark:ring-indigo-600 shadow-2xs'
                            : isWeekend
                            ? 'text-red-500 font-extrabold bg-red-50/60 dark:bg-red-950/30'
                            : ''
                        }`}
                        title={`${day.formattedDate}${!isViewingPastWeek && day.isToday ? ' (TODAY)' : ''}`}
                      >
                        <div>{day.name}</div>
                        <div className="text-[8px] font-mono opacity-80 mt-0.5">
                          {day.dateStr.split('-')[2]}
                        </div>
                        {!isViewingPastWeek && day.isToday && (
                          <div className="text-[7px] text-[#6366F1] dark:text-[#818CF8] font-extrabold tracking-tighter">
                            TODAY
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Habit Rows */}
                <div className="space-y-2 pt-1">
                  {activeHabits.length === 0 ? (
                    <div className="p-8 text-center bg-[#F9FAFB] dark:bg-[#0F172A]/40 rounded-xl border border-dashed border-[#E5E7EB] dark:border-[#374151]">
                      <Flame className="w-8 h-8 text-amber-500 mx-auto mb-2 opacity-80" />
                      <h4 className="text-sm font-bold text-[#111827] dark:text-white">
                        No habits recorded for this week
                      </h4>
                      <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] max-w-sm mx-auto mt-1 mb-3">
                        {isViewingPastWeek
                          ? 'This archived week currently has no habits listed. Click below to add a habit to this week.'
                          : 'Start fresh by creating your weekly habits. Check off each day and see your momentum build automatically.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowAddModal(true)}
                        className="px-3.5 py-1.5 text-xs font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Habit</span>
                      </button>
                    </div>
                  ) : (
                    activeHabits.map((habit) => (
                      <div
                        key={habit.id}
                        className="grid grid-cols-12 gap-1.5 items-center p-2.5 rounded-xl bg-[#F9FAFB] dark:bg-[#0F172A]/60 border border-[#E5E7EB] dark:border-[#374151] group hover:border-[#D1D5DB] dark:hover:border-[#4B5563] transition-colors"
                      >
                        {/* Habit Title & Icon */}
                        <div className="col-span-5 flex items-center justify-between pr-2 min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base shrink-0">{habit.icon}</span>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-[#111827] dark:text-[#E5E7EB] truncate">
                                {habit.title}
                              </p>
                              <div className="flex items-center gap-1.5 text-[10px] text-[#9CA3AF]">
                                <span className="font-mono text-amber-500 font-semibold flex items-center gap-0.5">
                                  🔥 {habit.streak}d streak
                                </span>
                                <span>• {habit.category}</span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteHabitItem(habit.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-[#9CA3AF] hover:text-rose-500 transition-opacity rounded cursor-pointer"
                            title="Delete habit"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* 7 Day Checkboxes */}
                        {habit.completedDays.map((isDone, dayIdx) => {
                          const day = activeDaysInfo[dayIdx] || daysInfo[dayIdx];
                          return (
                            <div key={dayIdx} className="col-span-1 flex justify-center">
                              <button
                                type="button"
                                onClick={() => handleToggle(habit.id, dayIdx, isDone)}
                                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                                  isDone
                                    ? 'bg-[#6366F1] hover:bg-[#4F46E5] text-white shadow-2xs scale-100'
                                    : !isViewingPastWeek && day?.isToday
                                    ? 'border-2 border-dashed border-[#818CF8] bg-white dark:bg-[#111827] hover:bg-[#EEF2FF] dark:hover:bg-[#1E1B4B]'
                                    : 'border border-[#E5E7EB] dark:border-[#374151] bg-white dark:bg-[#111827] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937]'
                                }`}
                                title={`${habit.title} - ${day?.formattedDate || DAYS_OF_WEEK[dayIdx]}`}
                              >
                                {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Footer Stats & Reset Options */}
            <div className="pt-3 border-t border-[#F3F4F6] dark:border-[#334155] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#9CA3AF]">
              <div className="flex items-center gap-2">
                <div className="w-28 h-2 rounded-full bg-[#F3F4F6] dark:bg-[#1F2937] overflow-hidden">
                  <div
                    className="h-full bg-[#6366F1] rounded-full transition-all duration-300"
                    style={{ width: `${weeklyCompletionRate}%` }}
                  />
                </div>
                <span className="font-semibold text-[#4B5563] dark:text-[#9CA3AF]">
                  {weeklyCompletionRate}% Routine Achieved
                </span>
              </div>

              {!isViewingPastWeek && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      Sound.click(soundEnabled);
                      onResetWeek();
                    }}
                    className="flex items-center gap-1 text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white transition-colors cursor-pointer text-xs"
                    title="Reset current week checkboxes"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Manual Week Reset</span>
                  </button>
                </div>
              )}
            </div>

            {/* Integrated Enhanced Momentum Graph */}
            <div className="pt-2 border-t border-[#F3F4F6] dark:border-[#334155]">
              <HabitStreakChart
                habits={habits}
                habitHistory={habitHistory}
                habitActivities={habitActivities}
                soundEnabled={soundEnabled}
              />
            </div>
          </div>
        </div>
      )}

      {/* ==================== MOMENTUM GRAPH & ANALYTICS VIEW ==================== */}
      {activeTab === 'analytics' && (
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] shadow-xs">
          <HabitStreakChart
            habits={habits}
            habitHistory={habitHistory}
            habitActivities={habitActivities}
            soundEnabled={soundEnabled}
          />
        </div>
      )}

      {/* ==================== PAST RECORDS & ARCHIVES VIEW ==================== */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Sub-Tabs: Weekly Bundles vs Chronological Activities */}
          <div className="flex items-center justify-between gap-3 p-1 rounded-xl bg-[#F3F4F6] dark:bg-[#0F172A] border border-[#E5E7EB] dark:border-[#334155] w-fit">
            <button
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                setHistorySubTab('weeks');
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                historySubTab === 'weeks'
                  ? 'bg-white dark:bg-[#1E293B] text-[#111827] dark:text-white shadow-2xs'
                  : 'text-[#6B7280] dark:text-[#9CA3AF]'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5 text-amber-500" />
              <span>Weekly Archived Bundles ({totalArchivedWeeks})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                setHistorySubTab('activities');
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                historySubTab === 'activities'
                  ? 'bg-white dark:bg-[#1E293B] text-[#111827] dark:text-white shadow-2xs'
                  : 'text-[#6B7280] dark:text-[#9CA3AF]'
              }`}
            >
              <History className="w-3.5 h-3.5 text-indigo-500" />
              <span>All Logged Check-ins ({allHistoricalActivities.length})</span>
            </button>
          </div>

          {/* SUB-VIEW 1: Weekly Archived Bundles (Editable!) */}
          {historySubTab === 'weeks' && (
            <div className="space-y-3">
              {habitHistory.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-[#1E293B] rounded-2xl border border-[#E5E7EB] dark:border-[#334155] space-y-2">
                  <Calendar className="w-8 h-8 text-[#9CA3AF] mx-auto opacity-70" />
                  <h4 className="text-sm font-bold text-[#111827] dark:text-white">
                    No Archived Weeks Yet
                  </h4>
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] max-w-sm mx-auto">
                    At the end of each week (every Monday at 00:00), your habit data automatically archives here. You can also click &ldquo;Simulate Monday Reset&rdquo; anytime to archive the current week.
                  </p>
                </div>
              ) : (
                habitHistory.map((week) => {
                  const isExpanded = expandedWeekId === week.id;
                  return (
                    <div
                      key={week.id}
                      className="rounded-2xl bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] overflow-hidden shadow-xs"
                    >
                      {/* Accordion Summary Row */}
                      <div
                        onClick={() => {
                          Sound.click(soundEnabled);
                          setExpandedWeekId(isExpanded ? null : week.id);
                        }}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-gray-50/70 dark:hover:bg-gray-800/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm shrink-0">
                            {week.completionRate}%
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-[#111827] dark:text-white">
                                {week.label}
                              </h4>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-[#4B5563] dark:text-[#9CA3AF]">
                                {week.habits.length} habits
                              </span>
                            </div>
                            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">
                              {week.totalDone} of {week.totalPossible} routines achieved
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              Sound.click(soundEnabled);
                              setSelectedWeekId(week.id);
                              setActiveTab('current');
                            }}
                            className="px-2.5 py-1 text-xs font-bold text-[#6366F1] dark:text-[#818CF8] bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            title="Open this past week in the main interactive tracker"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit in Main Tracker</span>
                          </button>

                          <div className="p-1 text-[#9CA3AF]">
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Matrix View of That Archived Week (Fully Interactive!) */}
                      {isExpanded && (
                        <div className="p-4 border-t border-[#E5E7EB] dark:border-[#334155] bg-gray-50/50 dark:bg-[#0F172A]/50 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] font-bold text-[#4B5563] dark:text-[#9CA3AF]">
                              Interactive check-ins for {week.label}: (Click any day to toggle)
                            </p>

                            <button
                              type="button"
                              onClick={() => {
                                Sound.click(soundEnabled);
                                setSelectedWeekId(week.id);
                                setShowAddModal(true);
                              }}
                              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Habit to this Week</span>
                            </button>
                          </div>

                          <div className="overflow-x-auto">
                            <div className="min-w-[500px] space-y-2">
                              <div className="grid grid-cols-12 gap-1 text-center text-[10px] uppercase font-bold text-[#9CA3AF] pb-1 border-b border-[#E5E7EB] dark:border-[#334155]">
                                <div className="col-span-5 text-left pl-2">Habit</div>
                                {DAYS_OF_WEEK.map((d, i) => (
                                  <div
                                    key={d}
                                    className={`col-span-1 ${i >= 5 ? 'text-red-500 font-bold' : ''}`}
                                  >
                                    {d}
                                  </div>
                                ))}
                              </div>

                              {week.habits.map((h) => {
                                const doneCount = h.completedDays.filter(Boolean).length;
                                return (
                                  <div
                                    key={h.id}
                                    className="grid grid-cols-12 gap-1 items-center p-2 rounded-xl bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] group"
                                  >
                                    <div className="col-span-5 flex items-center justify-between pr-2 min-w-0">
                                      <div className="flex items-center gap-1.5 truncate">
                                        <span>{h.icon}</span>
                                        <span className="text-xs font-semibold text-[#111827] dark:text-white truncate">
                                          {h.title}
                                        </span>
                                        <span className="text-[10px] text-[#9CA3AF]">
                                          ({doneCount}/7)
                                        </span>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          Sound.click(soundEnabled);
                                          if (onDeleteHistoricalHabit) {
                                            onDeleteHistoricalHabit(week.id, h.id);
                                          }
                                        }}
                                        className="opacity-0 group-hover:opacity-100 p-1 text-[#9CA3AF] hover:text-rose-500 transition-opacity rounded cursor-pointer"
                                        title="Delete from this past week"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>

                                    {h.completedDays.map((done, idx) => (
                                      <div key={idx} className="col-span-1 flex justify-center">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            Sound.toggle(soundEnabled);
                                            if (onToggleHistoricalHabitDay) {
                                              onToggleHistoricalHabitDay(week.id, h.id, idx);
                                            }
                                          }}
                                          title={`Toggle ${DAYS_OF_WEEK[idx]} for ${h.title}`}
                                          className={`w-6 h-6 rounded-md flex items-center justify-center text-xs transition-all cursor-pointer ${
                                            done
                                              ? 'bg-emerald-500 hover:bg-emerald-600 text-white font-bold shadow-2xs'
                                              : 'border border-gray-200 dark:border-gray-700 hover:border-emerald-400 text-gray-300 dark:text-gray-600'
                                          }`}
                                        >
                                          {done ? '✓' : '·'}
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* SUB-VIEW 2: All Available Activities Feed */}
          {historySubTab === 'activities' && (
            <div className="space-y-3">
              {/* Search & Category Filter */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                  <input
                    type="text"
                    placeholder="Search past activities by habit name, date, day..."
                    value={activitySearch}
                    onChange={(e) => setActivitySearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] text-[#111827] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  <button
                    type="button"
                    onClick={() => {
                      Sound.click(soundEnabled);
                      setSelectedCategory('all');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      selectedCategory === 'all'
                        ? 'bg-[#6366F1] text-white'
                        : 'bg-white dark:bg-[#1E293B] text-[#6B7280] dark:text-[#9CA3AF] border border-[#E5E7EB] dark:border-[#334155]'
                    }`}
                  >
                    All
                  </button>
                  {['Health', 'Focus', 'Productivity', 'Daily'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        Sound.click(soundEnabled);
                        setSelectedCategory(cat);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                        selectedCategory === cat
                          ? 'bg-[#6366F1] text-white'
                          : 'bg-white dark:bg-[#1E293B] text-[#6B7280] dark:text-[#9CA3AF] border border-[#E5E7EB] dark:border-[#334155]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Activities List */}
              <div className="space-y-2">
                {filteredActivities.length === 0 ? (
                  <div className="p-8 text-center bg-white dark:bg-[#1E293B] rounded-2xl border border-[#E5E7EB] dark:border-[#334155] space-y-1">
                    <p className="text-xs font-bold text-[#111827] dark:text-white">
                      No check-ins matched your criteria
                    </p>
                    <p className="text-[11px] text-[#9CA3AF]">
                      Try clearing your search query or selecting &ldquo;All&rdquo;.
                    </p>
                  </div>
                ) : (
                  filteredActivities.map((act) => (
                    <div
                      key={act.id}
                      className="p-3 rounded-xl bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-base shrink-0">{act.icon}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#111827] dark:text-white truncate">
                            {act.habitTitle}
                          </p>
                          <p className="text-[11px] text-[#9CA3AF]">
                            {act.dayName} • {act.date} • {act.category}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
                          Completed ✓
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== CREATE HABIT MODAL ==================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#F3F4F6] dark:border-[#334155]">
              <h3 className="text-sm font-bold text-[#111827] dark:text-white">
                {isViewingPastWeek
                  ? `Add Habit to ${activeWeekLabel}`
                  : 'Create New Habit'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddHabit} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-[#374151] dark:text-[#D1D5DB] block mb-1">
                  Routine Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Read 20 pages, 30m Workout"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#F9FAFB] dark:bg-[#0F172A] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-[#374151] dark:text-[#D1D5DB] block mb-1">
                    Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-[#F9FAFB] dark:bg-[#0F172A] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-white cursor-pointer"
                  >
                    <option value="Health">Health</option>
                    <option value="Productivity">Productivity</option>
                    <option value="Focus">Focus</option>
                    <option value="Daily">Daily</option>
                    <option value="Mindset">Mindset</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#374151] dark:text-[#D1D5DB] block mb-1">
                    Emoji Icon
                  </label>
                  <input
                    type="text"
                    value={newIcon}
                    onChange={(e) => setNewIcon(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-[#F9FAFB] dark:bg-[#0F172A] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-white text-center"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl text-gray-500 hover:text-gray-800 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim()}
                  className="px-4 py-1.5 text-xs font-bold rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-40 text-white transition-colors cursor-pointer shadow-2xs"
                >
                  Create Habit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
