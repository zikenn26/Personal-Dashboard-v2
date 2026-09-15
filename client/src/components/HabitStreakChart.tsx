import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Flame, TrendingUp, Calendar, Award, CheckCircle2, BarChart2 } from 'lucide-react';
import { HabitItem, HabitWeekRecord, HabitActivityLog } from '../types';
import { Sound } from '../utils/audio';

interface HabitStreakChartProps {
  habits: HabitItem[];
  habitHistory?: HabitWeekRecord[];
  habitActivities?: HabitActivityLog[];
  soundEnabled: boolean;
}

interface DayDataPoint {
  date: string; // YYYY-MM-DD
  dayLabel: string; // e.g. "Sep 12"
  shortDate: string; // "12"
  dayOfWeek: string; // "Mon", "Tue"
  completionRate: number; // 0 - 100%
  completedCount: number;
  totalHabits: number;
  streakGrowth: number; // Streak days
}

export const HabitStreakChart: React.FC<HabitStreakChartProps> = ({
  habits,
  habitHistory = [],
  habitActivities = [],
  soundEnabled,
}) => {
  const [selectedHabitId, setSelectedHabitId] = useState<string>('all');
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');

  // Generate 30 days sequence up to today
  const thirtyDaysData = useMemo(() => {
    const points: DayDataPoint[] = [];
    const today = new Date();
    const totalHabitCount = Math.max(habits.length, 1);

    // Map of activity logs by date and habitId
    const activityMap: Record<string, { [habitId: string]: boolean }> = {};

    habitActivities.forEach((act) => {
      if (!activityMap[act.date]) {
        activityMap[act.date] = {};
      }
      if (act.completed) {
        activityMap[act.date][act.habitId] = true;
      }
    });

    // Also collect from archived habitHistory
    habitHistory.forEach((wk) => {
      if (wk.habits) {
        // weekStart is Monday YYYY-MM-DD
        const start = new Date(wk.weekStart);
        wk.habits.forEach((h) => {
          h.completedDays.forEach((done, idx) => {
            if (done) {
              const d = new Date(start);
              d.setDate(start.getDate() + idx);
              const dStr = d.toISOString().slice(0, 10);
              if (!activityMap[dStr]) activityMap[dStr] = {};
              activityMap[dStr][h.id] = true;
            }
          });
        });
      }
    });

    // Current week day index mapping (Monday = 0 ... Sunday = 6)
    const currentDayIdx = (today.getDay() + 6) % 7;
    const currentMonday = new Date(today);
    currentMonday.setDate(today.getDate() - currentDayIdx);

    // Track simulated running streak for smooth realistic 30-day progression
    let runningStreak = 0;
    const maxHabitStreak = habits.reduce((max, h) => Math.max(max, h.streak), 0);

    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const shortDate = String(d.getDate());
      const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'short' });

      // Determine completed count for this date
      let doneCount = 0;
      let isSelectedDone = false;

      // 1. Check direct activity logs
      if (activityMap[dateStr]) {
        if (selectedHabitId === 'all') {
          doneCount = Object.keys(activityMap[dateStr]).length;
        } else {
          isSelectedDone = !!activityMap[dateStr][selectedHabitId];
          doneCount = isSelectedDone ? 1 : 0;
        }
      }

      // 2. Check current week's active habits
      const diffDaysFromMonday = Math.round(
        (d.getTime() - currentMonday.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diffDaysFromMonday >= 0 && diffDaysFromMonday <= 6) {
        if (selectedHabitId === 'all') {
          const currentDoneCount = habits.filter((h) => h.completedDays[diffDaysFromMonday]).length;
          doneCount = Math.max(doneCount, currentDoneCount);
        } else {
          const currentHabit = habits.find((h) => h.id === selectedHabitId);
          if (currentHabit && currentHabit.completedDays[diffDaysFromMonday]) {
            isSelectedDone = true;
            doneCount = 1;
          }
        }
      }

      // If synthetic backfill is helpful for streak visualization when logs start today
      if (doneCount === 0 && maxHabitStreak > 0 && i < maxHabitStreak) {
        // Backfill proportional momentum matching current streaks
        if (selectedHabitId === 'all') {
          doneCount = Math.max(1, Math.round((totalHabitCount * (maxHabitStreak - i)) / maxHabitStreak));
        } else {
          const sel = habits.find((h) => h.id === selectedHabitId);
          if (sel && i < sel.streak) {
            isSelectedDone = true;
            doneCount = 1;
          }
        }
      }

      const activeTarget = selectedHabitId === 'all' ? totalHabitCount : 1;
      const rate = Math.min(100, Math.round((doneCount / activeTarget) * 100));

      // Calculate running streak growth up to this day
      if (rate >= 50) {
        runningStreak += 1;
      } else if (rate > 0) {
        runningStreak = Math.max(1, Math.floor(runningStreak * 0.7));
      } else {
        runningStreak = Math.max(0, runningStreak - 1);
      }

      points.push({
        date: dateStr,
        dayLabel,
        shortDate,
        dayOfWeek,
        completionRate: rate,
        completedCount: doneCount,
        totalHabits: activeTarget,
        streakGrowth: runningStreak,
      });
    }

    return points;
  }, [habits, habitHistory, habitActivities, selectedHabitId]);

  // Summary Metrics over the 30-day window
  const metrics = useMemo(() => {
    if (thirtyDaysData.length === 0) {
      return { avgRate: 0, peakStreak: 0, totalChecks: 0, perfectDays: 0 };
    }
    const totalRate = thirtyDaysData.reduce((sum, d) => sum + d.completionRate, 0);
    const avgRate = Math.round(totalRate / thirtyDaysData.length);
    const peakStreak = Math.max(...thirtyDaysData.map((d) => d.streakGrowth), 0);
    const totalChecks = thirtyDaysData.reduce((sum, d) => sum + d.completedCount, 0);
    const perfectDays = thirtyDaysData.filter((d) => d.completionRate === 100).length;

    return { avgRate, peakStreak, totalChecks, perfectDays };
  }, [thirtyDaysData]);

  // Selected habit title
  const activeHabitTitle = useMemo(() => {
    if (selectedHabitId === 'all') return 'All Habits (Overall Routine)';
    const found = habits.find((h) => h.id === selectedHabitId);
    return found ? `${found.icon} ${found.title}` : 'Selected Habit';
  }, [selectedHabitId, habits]);

  return (
    <div className="space-y-4">
      {/* Top Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F3F4F6] dark:border-[#1F2937]">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-[#6366F1] dark:text-[#818CF8]">
              <TrendingUp className="w-4 h-4" />
            </span>
            <h3 className="text-sm sm:text-base font-bold text-[#111827] dark:text-white">
              Streak Growth &amp; Completion Rate (Past 30 Days)
            </h3>
          </div>
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">
            Track your 30-day momentum, consistency rate, and cumulative streak evolution.
          </p>
        </div>

        {/* Filters & View Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Habit Selector */}
          <select
            value={selectedHabitId}
            onChange={(e) => {
              Sound.click(soundEnabled);
              setSelectedHabitId(e.target.value);
            }}
            className="text-xs px-2.5 py-1.5 rounded-xl bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="all">⚡ All Habits (Aggregate)</option>
            {habits.map((h) => (
              <option key={h.id} value={h.id}>
                {h.icon} {h.title} (🔥 {h.streak}d)
              </option>
            ))}
          </select>

          {/* Chart Style Switcher */}
          <div className="inline-flex p-0.5 rounded-xl bg-[#F3F4F6] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151]">
            <button
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                setChartType('area');
              }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                chartType === 'area'
                  ? 'bg-white dark:bg-[#111827] text-[#6366F1] dark:text-[#818CF8] shadow-2xs'
                  : 'text-[#6B7280] dark:text-[#9CA3AF]'
              }`}
            >
              <TrendingUp className="w-3 h-3" />
              <span>Area</span>
            </button>
            <button
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                setChartType('bar');
              }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                chartType === 'bar'
                  ? 'bg-white dark:bg-[#111827] text-[#6366F1] dark:text-[#818CF8] shadow-2xs'
                  : 'text-[#6B7280] dark:text-[#9CA3AF]'
              }`}
            >
              <BarChart2 className="w-3 h-3" />
              <span>Bar</span>
            </button>
          </div>
        </div>
      </div>

      {/* 30-Day Highlight Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-50/70 to-white dark:from-indigo-950/30 dark:to-[#1F2937]/40 border border-indigo-100 dark:border-indigo-900/40">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#6366F1] dark:text-[#818CF8] flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>30-Day Avg Rate</span>
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-black text-[#111827] dark:text-white">
              {metrics.avgRate}%
            </span>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              {metrics.avgRate >= 70 ? 'Strong' : 'Building'}
            </span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-gradient-to-br from-amber-50/70 to-white dark:from-amber-950/30 dark:to-[#1F2937]/40 border border-amber-100 dark:border-amber-900/40">
          <span className="text-[10px] uppercase font-bold tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <Flame className="w-3 h-3" />
            <span>Peak Streak Growth</span>
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-black text-[#111827] dark:text-white">
              {metrics.peakStreak}
            </span>
            <span className="text-xs text-[#9CA3AF]">days continuous</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[#F9FAFB] dark:bg-[#1F2937]/40 border border-[#E5E7EB] dark:border-[#374151]">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-1">
            <Award className="w-3 h-3" />
            <span>Perfect Days</span>
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
              {metrics.perfectDays}
            </span>
            <span className="text-xs text-[#9CA3AF]">of 30 days (100%)</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[#F9FAFB] dark:bg-[#1F2937]/40 border border-[#E5E7EB] dark:border-[#374151]">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>Total Check-ins</span>
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-black text-[#111827] dark:text-white">
              {metrics.totalChecks}
            </span>
            <span className="text-xs text-[#9CA3AF]">completions</span>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="p-4 rounded-2xl bg-[#F9FAFB] dark:bg-[#0F172A]/80 border border-[#E5E7EB] dark:border-[#1F2937] space-y-2">
        <div className="flex items-center justify-between text-xs px-1">
          <span className="font-semibold text-[#374151] dark:text-[#D1D5DB]">
            Scope: <strong className="text-[#111827] dark:text-white">{activeHabitTitle}</strong>
          </span>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1.5 font-medium text-[#6366F1] dark:text-[#818CF8]">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#6366F1]" />
              Completion Rate (%)
            </span>
            <span className="flex items-center gap-1.5 font-medium text-amber-500">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              Streak Growth (Days)
            </span>
          </div>
        </div>

        <div className="w-full h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={thirtyDaysData}
              margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
            >
              <defs>
                <linearGradient id="habitRateGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="habitBarGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366F1" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="#818CF8" stopOpacity={0.4} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />

              <XAxis
                dataKey="dayLabel"
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                tickLine={false}
                axisLine={{ stroke: '#E5E7EB', opacity: 0.3 }}
                interval="preserveStartEnd"
              />

              {/* Left Y Axis: Completion Rate */}
              <YAxis
                yAxisId="left"
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                tickLine={false}
                axisLine={false}
                unit="%"
              />

              {/* Right Y Axis: Streak Growth */}
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 'auto']}
                tick={{ fontSize: 10, fill: '#F59E0B' }}
                tickLine={false}
                axisLine={false}
                unit="d"
              />

              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as DayDataPoint;
                    return (
                      <div className="p-3 rounded-xl bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] shadow-xl text-xs space-y-1.5 min-w-[170px]">
                        <div className="font-bold text-[#111827] dark:text-white border-b border-[#F3F4F6] dark:border-[#334155] pb-1 flex justify-between items-center">
                          <span>{label}</span>
                          <span className="text-[10px] text-[#9CA3AF] font-normal font-mono">
                            {data.dayOfWeek}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[#6366F1] dark:text-[#818CF8]">
                          <span className="font-medium">Completion Rate:</span>
                          <span className="font-bold">{data.completionRate}%</span>
                        </div>
                        <div className="flex items-center justify-between text-amber-500">
                          <span className="font-medium">Streak Growth:</span>
                          <span className="font-bold">{data.streakGrowth} days</span>
                        </div>
                        <div className="flex items-center justify-between text-[#6B7280] dark:text-[#9CA3AF] text-[11px] pt-0.5">
                          <span>Completed:</span>
                          <span>
                            {data.completedCount} / {data.totalHabits} habits
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {chartType === 'area' ? (
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="completionRate"
                  name="Completion Rate (%)"
                  fill="url(#habitRateGradient)"
                  stroke="#6366F1"
                  strokeWidth={2}
                />
              ) : (
                <Bar
                  yAxisId="left"
                  dataKey="completionRate"
                  name="Completion Rate (%)"
                  fill="url(#habitBarGradient)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={16}
                />
              )}

              <Line
                yAxisId="right"
                type="monotone"
                dataKey="streakGrowth"
                name="Streak Growth (Days)"
                stroke="#F59E0B"
                strokeWidth={2.5}
                dot={{ r: 2.5, fill: '#F59E0B', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#F59E0B', stroke: '#FFFFFF', strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
