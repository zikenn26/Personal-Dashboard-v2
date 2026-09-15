import React, { useState } from 'react';
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
  Search,
  CheckCircle2,
  CalendarDays,
  Clock,
  ArrowRight,
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
  soundEnabled,
}) => {
  const [activeTab, setActiveTab] = useState<'current' | 'analytics' | 'history'>('current');
  const [historySubTab, setHistorySubTab] = useState<'weeks' | 'activities'>('weeks');
  const [expandedWeekId, setExpandedWeekId] = useState<string | null>(null);
  const [activitySearch, setActivitySearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

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

  const handleToggle = (habitId: string, dayIndex: number, currentlyDone: boolean) => {
    Sound.toggle(soundEnabled);
    if (!currentlyDone) {
      Sound.success(soundEnabled);
    }
    onToggleHabitDay(habitId, dayIndex);

    // Check if completing this makes today 100% complete
    const todayCompletedCount = habits.filter((h) =>
      h.id === habitId ? !currentlyDone : h.completedDays[currentDayIndex]
    ).length;
    if (todayCompletedCount === habits.length) {
      triggerConfetti();
    }
  };

  const handleAddHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    Sound.success(soundEnabled);
    onAddHabit(newTitle.trim(), newCategory, newIcon, newColor);
    setNewTitle('');
    setShowAddModal(false);
  };

  // Current week stats calculation
  const totalWeeklyChecks = habits.reduce(
    (acc, h) => acc + h.completedDays.filter(Boolean).length,
    0
  );
  const maxWeeklyChecks = habits.length * 7;
  const weeklyCompletionRate = maxWeeklyChecks > 0 ? Math.round((totalWeeklyChecks / maxWeeklyChecks) * 100) : 0;

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
  const allHistoricalActivities = React.useMemo(() => {
    let list: HabitActivityLog[] = [...habitActivities];
    // Also include activities from archived weeks if not directly in habitActivities
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

  const filteredActivities = React.useMemo(() => {
    return allHistoricalActivities.filter((act) => {
      const matchSearch =
        act.habitTitle.toLowerCase().includes(activitySearch.toLowerCase()) ||
        act.category.toLowerCase().includes(activitySearch.toLowerCase()) ||
        act.dayName.toLowerCase().includes(activitySearch.toLowerCase()) ||
        act.date.includes(activitySearch);
      const matchCat = selectedCategory === 'all' || act.category.toLowerCase() === selectedCategory.toLowerCase();
      return matchSearch && matchCat;
    });
  }, [allHistoricalActivities, activitySearch, selectedCategory]);

  const categories = React.useMemo(() => {
    const set = new Set<string>();
    habits.forEach((h) => set.add(h.category));
    allHistoricalActivities.forEach((a) => set.add(a.category));
    return Array.from(set);
  }, [habits, allHistoricalActivities]);

  return (
    <div className="rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] bg-white dark:bg-[#111827] p-5 shadow-xs transition-colors notion-card space-y-4">
      {/* Top Header & Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F3F4F6] dark:border-[#1F2937]">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
            <Flame className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-base font-bold text-[#111827] dark:text-white flex items-center gap-2">
              <span>Habit Tracker & Weekly Routine</span>
            </h3>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
              {activeTab === 'current'
                ? `Current Week: ${currentWeekLabel} • Resets fresh every Monday`
                : 'Stored historical weekly records and available activity logs'}
            </p>
          </div>
        </div>

        {/* View Switcher Tabs & New Habit Action */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <div className="inline-flex p-1 rounded-xl bg-[#F3F4F6] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151]">
            <button
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                setActiveTab('current');
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'current'
                  ? 'bg-white dark:bg-[#111827] text-[#111827] dark:text-white shadow-2xs'
                  : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-[#6366F1]" />
              <span>Current Week</span>
            </button>

            <button
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                setActiveTab('analytics');
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'analytics'
                  ? 'bg-white dark:bg-[#111827] text-[#111827] dark:text-white shadow-2xs'
                  : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
              <span>30-Day Growth</span>
              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold">
                Chart
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                setActiveTab('history');
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'history'
                  ? 'bg-white dark:bg-[#111827] text-[#111827] dark:text-white shadow-2xs'
                  : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5 text-amber-500" />
              <span>Past Records</span>
              {habitHistory.length > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold">
                  {habitHistory.length}
                </span>
              )}
            </button>
          </div>

          <button
            onClick={() => {
              Sound.click(soundEnabled);
              setShowAddModal(true);
            }}
            className="px-3 py-1.5 text-xs font-semibold bg-[#111827] dark:bg-white text-white dark:text-[#111827] hover:opacity-90 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Habit</span>
          </button>
        </div>
      </div>

      {/* ==================== CURRENT WEEK VIEW ==================== */}
      {activeTab === 'current' && (
        <div className="space-y-4">
          {/* Automated Fresh Monday Notice Banner */}
          <div className="p-3 rounded-xl bg-gradient-to-r from-indigo-50/70 via-white to-amber-50/70 dark:from-indigo-950/30 dark:via-[#111827] dark:to-amber-950/20 border border-indigo-100 dark:border-indigo-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-base">🌱</span>
              <div>
                <b className="text-[#1F2937] dark:text-white font-semibold">
                  Fresh Week Cycle Activated
                </b>
                <p className="text-[11px] text-[#4B5563] dark:text-[#9CA3AF]">
                  Habits start fresh automatically every Monday at 00:00. Previous weeks' activities are safely preserved in Past Records.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                Week {currentWeekLabel.split(',')[0]}
              </span>
              {onSimulateMondayRollover && (
                <button
                  type="button"
                  onClick={() => {
                    Sound.click(soundEnabled);
                    onSimulateMondayRollover();
                  }}
                  className="px-2.5 py-1 text-[11px] font-medium text-[#4F46E5] dark:text-[#818CF8] hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
                  title="Archive current week and simulate the automated Monday fresh start"
                >
                  Simulate Monday Reset
                </button>
              )}
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-[#F9FAFB] dark:bg-[#1F2937]/40 border border-[#E5E7EB] dark:border-[#374151]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#9CA3AF] block">
                Today's Completion
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-lg font-bold text-[#111827] dark:text-white">
                  {todayCompletedCount}/{habits.length}
                </span>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {todayRate}%
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#F9FAFB] dark:bg-[#1F2937]/40 border border-[#E5E7EB] dark:border-[#374151]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#9CA3AF] block">
                Current Week Total
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-lg font-bold text-[#111827] dark:text-white">
                  {totalWeeklyChecks}
                </span>
                <span className="text-xs text-[#9CA3AF]">
                  / {maxWeeklyChecks} checks
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#F9FAFB] dark:bg-[#1F2937]/40 border border-[#E5E7EB] dark:border-[#374151]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#9CA3AF] block">
                Weekly Target Rate
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-lg font-bold text-[#6366F1] dark:text-[#818CF8]">
                  {weeklyCompletionRate}%
                </span>
                <span className="text-xs text-[#9CA3AF]">of 100%</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#F9FAFB] dark:bg-[#1F2937]/40 border border-[#E5E7EB] dark:border-[#374151]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#9CA3AF] block">
                Archived Records
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
                  {habitHistory.length}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className="text-xs text-[#6366F1] dark:text-[#818CF8] hover:underline font-semibold cursor-pointer"
                >
                  View records →
                </button>
              </div>
            </div>
          </div>

          {/* Habit Matrix Grid */}
          <div className="overflow-x-auto -mx-2 px-2 pb-2">
            <div className="min-w-[540px]">
              {/* Day column headers with calendar dates */}
              <div className="grid grid-cols-12 gap-1.5 items-center mb-2 text-center text-[10px] uppercase font-bold tracking-wider text-[#9CA3AF]">
                <div className="col-span-5 text-left pl-2">
                  Habit Routine (Current Week)
                </div>
                {daysInfo.map((day, idx) => {
                  const isWeekend = idx === 5 || idx === 6;
                  return (
                    <div
                      key={day.name}
                      className={`col-span-1 py-1 rounded-md transition-all ${
                        day.isToday
                          ? 'bg-[#EEF2FF] dark:bg-[#1E1B4B] text-[#6366F1] dark:text-[#818CF8] font-bold ring-2 ring-indigo-400 dark:ring-indigo-600 shadow-2xs'
                          : isWeekend
                          ? 'text-red-500 font-extrabold bg-red-50/60 dark:bg-red-950/30'
                          : ''
                      }`}
                      title={`${day.formattedDate}${day.isToday ? ' (TODAY)' : ''}`}
                    >
                      <div>{day.name}</div>
                      <div className="text-[8px] font-mono opacity-80 mt-0.5">
                        {day.dateStr.split('-')[2]}
                      </div>
                      {day.isToday && (
                        <div className="text-[7px] text-[#6366F1] dark:text-[#818CF8] font-extrabold tracking-tighter">
                          TODAY
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Habit Rows */}
              <div className="space-y-2">
                {habits.length === 0 ? (
                  <div className="p-8 text-center bg-[#F9FAFB] dark:bg-[#1F2937]/30 rounded-xl border border-dashed border-[#E5E7EB] dark:border-[#374151]">
                    <Flame className="w-8 h-8 text-amber-500 mx-auto mb-2 opacity-80" />
                    <h4 className="text-sm font-bold text-[#111827] dark:text-white">
                      No habits set for this week
                    </h4>
                    <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] max-w-sm mx-auto mt-1 mb-3">
                      Start fresh by creating your weekly habits. Check off each day and see your momentum build automatically.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowAddModal(true)}
                      className="px-3 py-1.5 text-xs font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-lg transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add First Habit</span>
                    </button>
                  </div>
                ) : (
                  habits.map((habit) => (
                    <div
                      key={habit.id}
                      className="grid grid-cols-12 gap-1.5 items-center p-2.5 rounded-xl bg-[#F9FAFB] dark:bg-[#1F2937]/50 border border-[#E5E7EB] dark:border-[#374151] group hover:border-[#D1D5DB] dark:hover:border-[#4B5563] transition-colors"
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
                          onClick={() => {
                            Sound.click(soundEnabled);
                            onDeleteHabit(habit.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-[#9CA3AF] hover:text-rose-500 transition-opacity rounded cursor-pointer"
                          title="Delete habit"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      {/* 7 Day Checkboxes */}
                      {habit.completedDays.map((isDone, dayIdx) => {
                        const day = daysInfo[dayIdx];
                        return (
                          <div key={dayIdx} className="col-span-1 flex justify-center">
                            <button
                              onClick={() => handleToggle(habit.id, dayIdx, isDone)}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                                isDone
                                  ? 'bg-[#6366F1] text-white shadow-2xs scale-100'
                                  : day.isToday
                                  ? 'border-2 border-dashed border-[#818CF8] bg-white dark:bg-[#111827] hover:bg-[#EEF2FF] dark:hover:bg-[#1E1B4B]'
                                  : 'border border-[#E5E7EB] dark:border-[#374151] bg-white dark:bg-[#111827] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937]'
                              }`}
                              title={`${habit.title} - ${day.formattedDate}`}
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
          <div className="pt-3 border-t border-[#F3F4F6] dark:border-[#1F2937] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#9CA3AF]">
            <div className="flex items-center gap-2">
              <div className="w-28 h-2 rounded-full bg-[#F3F4F6] dark:bg-[#1F2937] overflow-hidden">
                <div
                  className="h-full bg-[#6366F1] rounded-full transition-all duration-300"
                  style={{ width: `${weeklyCompletionRate}%` }}
                />
              </div>
              <span className="font-semibold text-[#4B5563] dark:text-[#9CA3AF]">
                {weeklyCompletionRate}% Weekly Routine Achieved
              </span>
            </div>

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
          </div>

          {/* Integrated 30-Day Streak & Completion Visualizer */}
          <div className="pt-2 border-t border-[#F3F4F6] dark:border-[#1F2937]">
            <HabitStreakChart
              habits={habits}
              habitHistory={habitHistory}
              habitActivities={habitActivities}
              soundEnabled={soundEnabled}
            />
          </div>
        </div>
      )}

      {/* ==================== 30-DAY GROWTH & ANALYTICS VIEW ==================== */}
      {activeTab === 'analytics' && (
        <div className="space-y-4">
          <HabitStreakChart
            habits={habits}
            habitHistory={habitHistory}
            habitActivities={habitActivities}
            soundEnabled={soundEnabled}
          />
        </div>
      )}

      {/* ==================== PAST RECORDS & ACTIVITIES VIEW ==================== */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Sub Navigation */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#F3F4F6] dark:border-[#1F2937]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  Sound.click(soundEnabled);
                  setHistorySubTab('weeks');
                }}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  historySubTab === 'weeks'
                    ? 'bg-[#111827] dark:bg-white text-white dark:text-[#111827]'
                    : 'text-[#6B7280] dark:text-[#9CA3AF] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937]'
                }`}
              >
                Weekly Records ({habitHistory.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  Sound.click(soundEnabled);
                  setHistorySubTab('activities');
                }}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  historySubTab === 'activities'
                    ? 'bg-[#111827] dark:bg-white text-white dark:text-[#111827]'
                    : 'text-[#6B7280] dark:text-[#9CA3AF] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937]'
                }`}
              >
                All Available Activities ({allHistoricalActivities.length})
              </button>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('current')}
              className="text-xs text-[#6366F1] dark:text-[#818CF8] hover:underline font-semibold flex items-center gap-1 cursor-pointer self-start sm:self-auto"
            >
              <span>Back to Current Week</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Historical Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-[#F9FAFB] dark:bg-[#1F2937]/40 border border-[#E5E7EB] dark:border-[#374151]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#9CA3AF] block">
                Archived Weeks
              </span>
              <span className="text-xl font-bold text-[#111827] dark:text-white mt-1 block">
                {totalArchivedWeeks}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#F9FAFB] dark:bg-[#1F2937]/40 border border-[#E5E7EB] dark:border-[#374151]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#9CA3AF] block">
                Avg. Weekly Rate
              </span>
              <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-1 block">
                {avgHistoricalRate}%
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#F9FAFB] dark:bg-[#1F2937]/40 border border-[#E5E7EB] dark:border-[#374151]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#9CA3AF] block">
                Activities Done
              </span>
              <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
                {totalHistoricalActivities}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#F9FAFB] dark:bg-[#1F2937]/40 border border-[#E5E7EB] dark:border-[#374151]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#9CA3AF] block">
                Routine Automation
              </span>
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                <span>🔄 Every Mon 00:00</span>
              </span>
            </div>
          </div>

          {/* SUB-VIEW 1: Weekly Records List */}
          {historySubTab === 'weeks' && (
            <div className="space-y-3">
              {habitHistory.length === 0 ? (
                <div className="p-8 text-center bg-[#F9FAFB] dark:bg-[#1F2937]/30 rounded-xl border border-dashed border-[#E5E7EB] dark:border-[#374151]">
                  <CalendarDays className="w-8 h-8 text-[#9CA3AF] mx-auto mb-2 opacity-70" />
                  <h4 className="text-sm font-bold text-[#111827] dark:text-white">
                    No past weekly records yet
                  </h4>
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] max-w-sm mx-auto mt-1 mb-3">
                    Every Monday, the current week will automatically reset and its completion records will appear here for you to review anytime.
                  </p>
                  {onSimulateMondayRollover && (
                    <button
                      type="button"
                      onClick={onSimulateMondayRollover}
                      className="px-3 py-1.5 text-xs font-semibold bg-[#6366F1] text-white rounded-lg cursor-pointer"
                    >
                      Archive Current Week & Simulate Monday
                    </button>
                  )}
                </div>
              ) : (
                habitHistory.map((week) => {
                  const isExpanded = expandedWeekId === week.id;
                  return (
                    <div
                      key={week.id}
                      className="rounded-xl border border-[#E5E7EB] dark:border-[#374151] bg-[#F9FAFB] dark:bg-[#1F2937]/40 overflow-hidden transition-all"
                    >
                      {/* Week Accordion Header */}
                      <div
                        onClick={() => {
                          Sound.click(soundEnabled);
                          setExpandedWeekId(isExpanded ? null : week.id);
                        }}
                        className="p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-white dark:hover:bg-[#1F2937]/80 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                            <CalendarDays className="w-4 h-4" />
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-[#111827] dark:text-white">
                                Week of {week.label}
                              </h4>
                              <span className="text-[10px] px-2 py-0.2 rounded-full bg-[#E5E7EB] dark:bg-[#374151] text-[#4B5563] dark:text-[#D1D5DB] font-medium">
                                Mon – Sun
                              </span>
                            </div>
                            <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">
                              {week.totalDone} of {week.totalPossible} activities completed • Archived{' '}
                              {new Date(week.archivedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2.5 py-1 text-xs font-bold rounded-lg ${
                              week.completionRate >= 80
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                : week.completionRate >= 50
                                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {week.completionRate}%
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-[#9CA3AF]" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
                          )}
                        </div>
                      </div>

                      {/* Expanded Matrix View of That Archived Week */}
                      {isExpanded && (
                        <div className="p-3.5 border-t border-[#E5E7EB] dark:border-[#374151] bg-white dark:bg-[#111827] space-y-2">
                          <p className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold mb-2">
                            Saved Habits & Activity Breakdown for this week:
                          </p>

                          <div className="grid grid-cols-12 gap-1 text-center text-[10px] uppercase font-bold text-[#9CA3AF] mb-1">
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
                                className="grid grid-cols-12 gap-1 items-center p-2 rounded-lg bg-[#F9FAFB] dark:bg-[#1F2937]/30 border border-[#E5E7EB] dark:border-[#374151]"
                              >
                                <div className="col-span-5 flex items-center gap-1.5 truncate pr-2">
                                  <span>{h.icon}</span>
                                  <span className="text-xs font-semibold text-[#111827] dark:text-white truncate">
                                    {h.title}
                                  </span>
                                  <span className="text-[9px] text-[#9CA3AF]">
                                    ({doneCount}/7)
                                  </span>
                                </div>

                                {h.completedDays.map((done, idx) => (
                                  <div key={idx} className="col-span-1 flex justify-center">
                                    <span
                                      className={`w-5 h-5 rounded-md flex items-center justify-center text-xs ${
                                        done
                                          ? 'bg-emerald-500 text-white font-bold'
                                          : 'border border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600'
                                      }`}
                                    >
                                      {done ? '✓' : '·'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            );
                          })}
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
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      selectedCategory === 'all'
                        ? 'bg-[#111827] dark:bg-white text-white dark:text-[#111827]'
                        : 'text-[#6B7280] dark:text-[#9CA3AF] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937]'
                    }`}
                  >
                    All
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                        selectedCategory === cat
                          ? 'bg-[#111827] dark:bg-white text-white dark:text-[#111827]'
                          : 'text-[#6B7280] dark:text-[#9CA3AF] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Activity Log List */}
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {filteredActivities.length === 0 ? (
                  <div className="p-8 text-center bg-[#F9FAFB] dark:bg-[#1F2937]/30 rounded-xl border border-dashed border-[#E5E7EB] dark:border-[#374151]">
                    <Clock className="w-8 h-8 text-[#9CA3AF] mx-auto mb-2 opacity-70" />
                    <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                      No activities match the search filter.
                    </p>
                  </div>
                ) : (
                  filteredActivities.map((act) => (
                    <div
                      key={act.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-[#1F2937]/40 border border-[#E5E7EB] dark:border-[#374151] hover:border-[#D1D5DB] transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="p-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#111827] dark:text-white truncate">
                            {act.icon} {act.habitTitle}
                          </p>
                          <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-1.5">
                            <span>{act.dayName}, {act.date}</span>
                            <span>•</span>
                            <span>{act.category}</span>
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                          Accomplished
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

      {/* Add Habit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleAddHabit}
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#F3F4F6] dark:border-[#1F2937]">
              <h4 className="text-sm font-bold text-[#111827] dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#6366F1]" />
                <span>Create New Habit Routine</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block mb-1">
                Habit Title
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Read 20 pages, 15m Meditation"
                autoFocus
                className="w-full px-3 py-2 rounded-lg text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#F3F4F6] focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Health, Code, etc."
                  className="w-full px-3 py-1.5 rounded-lg text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#F3F4F6] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block mb-1">
                  Emoji Icon
                </label>
                <div className="flex gap-1.5">
                  {['⚡', '🏃', '🧠', '🌙', '💧', '📚'].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setNewIcon(emoji)}
                      className={`p-1.5 rounded-md text-xs transition-transform ${
                        newIcon === emoji ? 'bg-[#EEF2FF] dark:bg-[#1E1B4B] scale-110' : 'hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937]'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 text-xs text-[#6B7280] dark:text-[#9CA3AF] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newTitle.trim()}
                className="px-4 py-1.5 text-xs font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-lg disabled:opacity-40 cursor-pointer shadow-2xs"
              >
                Add Habit
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
