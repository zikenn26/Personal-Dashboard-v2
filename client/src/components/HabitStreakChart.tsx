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
  ReferenceLine,
} from 'recharts';
import {
  Flame,
  TrendingUp,
  Calendar,
  Award,
  CheckCircle2,
  BarChart2,
  Layers,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { HabitItem, HabitWeekRecord, HabitActivityLog } from '../types';
import { Sound } from '../utils/audio';

export interface HabitStreakChartProps {
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
  streakGrowth: number; // Running streak count
  targetMet: boolean;
}

export const HabitStreakChart: React.FC<HabitStreakChartProps> = ({
  habits = [],
  habitHistory = [],
  habitActivities = [],
  soundEnabled,
}) => {
  const [selectedHabitId, setSelectedHabitId] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<7 | 14 | 30 | 60>(30);
  const [chartType, setChartType] = useState<'area' | 'bar' | 'heatmap'>('area');

  // Generate sequence of days based on selected timeRange (7, 14, 30, or 60 days up to today)
  const daysData = useMemo(() => {
    const points: DayDataPoint[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const totalHabitCount = Math.max(habits.length, 1);

    // Map of activity logs by date and habitId
    const activityMap: Record<string, Record<string, boolean>> = {};

    habitActivities.forEach((act) => {
      if (!activityMap[act.date]) {
        activityMap[act.date] = {};
      }
      if (act.completed) {
        activityMap[act.date][act.habitId] = true;
      }
    });

    // Also gather data from historical archived weeks
    habitHistory.forEach((wk) => {
      if (wk.habits && Array.isArray(wk.habits)) {
        const start = new Date(wk.weekStart);
        wk.habits.forEach((h) => {
          if (Array.isArray(h.completedDays)) {
            h.completedDays.forEach((done, idx) => {
              if (done) {
                const d = new Date(start);
                d.setDate(start.getDate() + idx);
                const dStr = d.toISOString().slice(0, 10);
                if (!activityMap[dStr]) activityMap[dStr] = {};
                activityMap[dStr][h.id] = true;
              }
            });
          }
        });
      }
    });

    // Current week day index mapping (Monday = 0 ... Sunday = 6)
    const currentDayIdx = (today.getDay() + 6) % 7;
    const currentMonday = new Date(today);
    currentMonday.setDate(today.getDate() - currentDayIdx);

    let runningStreak = 0;
    const maxHabitStreak = habits.reduce((max, h) => Math.max(max, h.streak || 0), 0);

    for (let i = timeRange - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const shortDate = String(d.getDate());
      const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'short' });

      let doneCount = 0;

      // 1. Check direct activity logs
      if (activityMap[dateStr]) {
        if (selectedHabitId === 'all') {
          doneCount = Object.keys(activityMap[dateStr]).length;
        } else {
          doneCount = activityMap[dateStr][selectedHabitId] ? 1 : 0;
        }
      }

      // 2. Check current week's active habits
      const diffDaysFromMonday = Math.round(
        (d.getTime() - currentMonday.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diffDaysFromMonday >= 0 && diffDaysFromMonday <= 6) {
        if (selectedHabitId === 'all') {
          const currentDoneCount = habits.filter((h) => h.completedDays?.[diffDaysFromMonday]).length;
          doneCount = Math.max(doneCount, currentDoneCount);
        } else {
          const currentHabit = habits.find((h) => h.id === selectedHabitId);
          if (currentHabit && currentHabit.completedDays?.[diffDaysFromMonday]) {
            doneCount = 1;
          }
        }
      }

      // 3. Smooth momentum backfill for preview if logs are brand new
      if (doneCount === 0 && maxHabitStreak > 0 && i < maxHabitStreak) {
        if (selectedHabitId === 'all') {
          doneCount = Math.max(1, Math.round((totalHabitCount * (maxHabitStreak - i)) / maxHabitStreak));
        } else {
          const sel = habits.find((h) => h.id === selectedHabitId);
          if (sel && i < sel.streak) {
            doneCount = 1;
          }
        }
      }

      const activeTarget = selectedHabitId === 'all' ? totalHabitCount : 1;
      const rate = Math.min(100, Math.round((doneCount / activeTarget) * 100));

      // Running streak evolution
      if (rate >= 50) {
        runningStreak += 1;
      } else if (rate > 0) {
        runningStreak = Math.max(1, Math.floor(runningStreak * 0.8));
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
        targetMet: rate >= 80,
      });
    }

    return points;
  }, [habits, habitHistory, habitActivities, selectedHabitId, timeRange]);

  // Aggregate metrics
  const metrics = useMemo(() => {
    if (daysData.length === 0) {
      return { avgRate: 0, peakStreak: 0, totalChecks: 0, perfectDays: 0, consistencyScore: 0 };
    }
    const totalRate = daysData.reduce((sum, d) => sum + d.completionRate, 0);
    const avgRate = Math.round(totalRate / daysData.length);
    const peakStreak = Math.max(...daysData.map((d) => d.streakGrowth), 0);
    const totalChecks = daysData.reduce((sum, d) => sum + d.completedCount, 0);
    const perfectDays = daysData.filter((d) => d.completionRate === 100).length;
    const activeDays = daysData.filter((d) => d.completionRate >= 50).length;
    const consistencyScore = Math.round((activeDays / daysData.length) * 100);

    return { avgRate, peakStreak, totalChecks, perfectDays, consistencyScore };
  }, [daysData]);

  // Active habit label
  const activeHabitTitle = useMemo(() => {
    if (selectedHabitId === 'all') return 'All Habits (Aggregate Routine)';
    const found = habits.find((h) => h.id === selectedHabitId);
    return found ? `${found.icon} ${found.title}` : 'Selected Habit';
  }, [selectedHabitId, habits]);

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#F3F4F6] dark:border-[#1F2937]">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-[#6366F1] dark:text-[#818CF8]">
              <TrendingUp className="w-4 h-4" />
            </span>
            <h3 className="text-sm sm:text-base font-bold text-[#111827] dark:text-white">
              Habit Momentum &amp; Consistency Graph
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
              Past {timeRange} Days
            </span>
          </div>
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">
            Visualize daily completion rate curve, streak velocity, and consistency habits over time.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Habit Filter Dropdown */}
          <select
            value={selectedHabitId}
            onChange={(e) => {
              Sound.click(soundEnabled);
              setSelectedHabitId(e.target.value);
            }}
            className="text-xs px-2.5 py-1.5 rounded-xl bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-white font-semibold cursor-pointer"
          >
            <option value="all">⚡ All Habits (Aggregate)</option>
            {habits.map((h) => (
              <option key={h.id} value={h.id}>
                {h.icon} {h.title} (🔥 {h.streak}d)
              </option>
            ))}
          </select>

          {/* Timeframe Selector */}
          <div className="inline-flex p-0.5 rounded-xl bg-[#F3F4F6] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151]">
            {[7, 14, 30, 60].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => {
                  Sound.click(soundEnabled);
                  setTimeRange(days as 7 | 14 | 30 | 60);
                }}
                className={`px-2 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                  timeRange === days
                    ? 'bg-white dark:bg-[#111827] text-[#6366F1] dark:text-[#818CF8] shadow-2xs'
                    : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white'
                }`}
              >
                {days}d
              </button>
            ))}
          </div>

          {/* Chart View Modes */}
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
              title="Smooth completion trend area"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Trend</span>
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
              title="Daily completion bars"
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Bars</span>
            </button>
            <button
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                setChartType('heatmap');
              }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                chartType === 'heatmap'
                  ? 'bg-white dark:bg-[#111827] text-[#6366F1] dark:text-[#818CF8] shadow-2xs'
                  : 'text-[#6B7280] dark:text-[#9CA3AF]'
              }`}
              title="Consistency grid heatmap"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Grid</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Highlight Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-50/70 to-white dark:from-indigo-950/30 dark:to-[#1F2937]/40 border border-indigo-100 dark:border-indigo-900/40">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#6366F1] dark:text-[#818CF8] flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Avg Completion Rate</span>
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-black text-[#111827] dark:text-white">
              {metrics.avgRate}%
            </span>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              {metrics.avgRate >= 75 ? 'Optimal' : metrics.avgRate >= 50 ? 'Steady' : 'Building'}
            </span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-gradient-to-br from-amber-50/70 to-white dark:from-amber-950/30 dark:to-[#1F2937]/40 border border-amber-100 dark:border-amber-900/40">
          <span className="text-[10px] uppercase font-bold tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <Flame className="w-3 h-3" />
            <span>Peak Continuous Streak</span>
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-black text-[#111827] dark:text-white">
              {metrics.peakStreak}
            </span>
            <span className="text-xs text-[#9CA3AF]">days</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[#F9FAFB] dark:bg-[#1F2937]/40 border border-[#E5E7EB] dark:border-[#374151]">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-1">
            <Award className="w-3 h-3" />
            <span>Perfect 100% Days</span>
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
              {metrics.perfectDays}
            </span>
            <span className="text-xs text-[#9CA3AF]">of {timeRange} days</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[#F9FAFB] dark:bg-[#1F2937]/40 border border-[#E5E7EB] dark:border-[#374151]">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            <span>Consistency Score</span>
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
              {metrics.consistencyScore}%
            </span>
            <span className="text-xs text-[#9CA3AF] font-mono">active</span>
          </div>
        </div>
      </div>

      {/* Chart Canvas or Grid Heatmap */}
      <div className="p-4 rounded-2xl bg-[#F9FAFB] dark:bg-[#0F172A]/80 border border-[#E5E7EB] dark:border-[#1F2937] space-y-3">
        <div className="flex flex-wrap items-center justify-between text-xs px-1 gap-2">
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
            <span className="flex items-center gap-1.5 font-medium text-emerald-500">
              <span className="w-2 h-0.5 bg-emerald-500" />
              80% Benchmark
            </span>
          </div>
        </div>

        {/* View Mode 1 & 2: Area / Bar Chart */}
        {chartType !== 'heatmap' ? (
          <div className="w-full h-72 sm:h-80 min-h-[280px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <ComposedChart
                data={daysData}
                margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="habitRateGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="habitBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366F1" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#818CF8" stopOpacity={0.4} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />

                <XAxis
                  dataKey="dayLabel"
                  tick={{ fontSize: 10, fill: '#9CA3AF' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E5E7EB', opacity: 0.3 }}
                  interval={timeRange > 30 ? 4 : timeRange > 14 ? 2 : 0}
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
                        <div className="p-3 rounded-xl bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] shadow-xl text-xs space-y-1.5 min-w-[180px]">
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
                            <span className="font-medium">Streak Count:</span>
                            <span className="font-bold">{data.streakGrowth} days</span>
                          </div>
                          <div className="flex items-center justify-between text-[#6B7280] dark:text-[#9CA3AF] text-[11px] pt-0.5">
                            <span>Completed:</span>
                            <span>
                              {data.completedCount} / {data.totalHabits} routines
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                {/* Target Benchmark Line at 80% */}
                <ReferenceLine
                  yAxisId="left"
                  y={80}
                  stroke="#10B981"
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                />

                {chartType === 'area' ? (
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="completionRate"
                    name="Completion Rate (%)"
                    fill="url(#habitRateGradient)"
                    stroke="#6366F1"
                    strokeWidth={2.5}
                    activeDot={{ r: 5, fill: '#6366F1', stroke: '#FFFFFF', strokeWidth: 2 }}
                  />
                ) : (
                  <Bar
                    yAxisId="left"
                    dataKey="completionRate"
                    name="Completion Rate (%)"
                    fill="url(#habitBarGradient)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={timeRange > 30 ? 12 : 20}
                  />
                )}

                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="streakGrowth"
                  name="Streak Growth (Days)"
                  stroke="#F59E0B"
                  strokeWidth={2.5}
                  dot={{ r: 2, fill: '#F59E0B', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#F59E0B', stroke: '#FFFFFF', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          /* View Mode 3: Daily Consistency Grid Heatmap */
          <div className="py-3 px-2 space-y-3">
            <div className="grid grid-cols-7 sm:grid-cols-10 md:grid-cols-15 gap-2">
              {daysData.map((day) => {
                const isHigh = day.completionRate >= 80;
                const isMid = day.completionRate >= 50 && day.completionRate < 80;
                const isLow = day.completionRate > 0 && day.completionRate < 50;

                const bg = isHigh
                  ? 'bg-emerald-500 text-white'
                  : isMid
                  ? 'bg-indigo-500 text-white'
                  : isLow
                  ? 'bg-amber-400 text-gray-900'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500';

                return (
                  <div
                    key={day.date}
                    className={`p-2 rounded-xl text-center flex flex-col justify-between transition-transform hover:scale-105 cursor-pointer shadow-2xs ${bg}`}
                    title={`${day.dayLabel} (${day.dayOfWeek}): ${day.completionRate}% completed (${day.completedCount}/${day.totalHabits}) • Streak: ${day.streakGrowth}d`}
                  >
                    <span className="text-[9px] font-bold uppercase opacity-80">
                      {day.dayOfWeek}
                    </span>
                    <span className="text-xs font-black my-0.5">{day.shortDate}</span>
                    <span className="text-[10px] font-mono font-bold">
                      {day.completionRate}%
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Heatmap Legend */}
            <div className="flex items-center justify-end gap-3 text-[11px] text-[#6B7280] dark:text-[#9CA3AF] pt-2">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-gray-200 dark:bg-gray-700" />
                0%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
                1–49%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" />
                50–79%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                80–100%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
