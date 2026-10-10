import React, { useState, useEffect, useMemo } from 'react';
import {
  Smartphone,
  Clock,
  Calendar,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  BarChart3,
  TrendingUp,
  Award,
  Layers,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Info,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  Line,
  ComposedChart,
} from 'recharts';
import { screenTimeService } from '../../services/screenTimeService';
import { ScreenTimeData, AppUsageItem } from '../../types';
import { Sound } from '../../utils/audio';

export interface ScreenTimeViewProps {
  soundEnabled?: boolean;
  onNavigateHome?: () => void;
}

export const ScreenTimeView: React.FC<ScreenTimeViewProps> = ({
  soundEnabled,
  onNavigateHome,
}) => {
  const [data, setData] = useState<ScreenTimeData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [excludeSelf, setExcludeSelf] = useState<boolean>(true);

  const isSupported = screenTimeService.isSupported();

  const loadData = async (force = false) => {
    setIsLoading(true);
    try {
      const res = await screenTimeService.getDailyUsage({
        date: selectedDate,
        excludeSelf,
        forceRefresh: force,
      });
      setData(res);
    } catch (err) {
      console.error('[ScreenTimeView] load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    const unsubscribe = screenTimeService.subscribe((updated) => {
      setData(updated);
    });
    return () => unsubscribe();
  }, [selectedDate, excludeSelf]);

  const handleRefresh = async () => {
    Sound.click(soundEnabled);
    await loadData(true);
  };

  const handleRequestPermission = async () => {
    Sound.click(soundEnabled);
    await screenTimeService.requestPermission();
  };

  const formatHoursAndMinutes = (totalMinutes: number) => {
    if (!totalMinutes || totalMinutes <= 0) return '0m';
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  };

  // Categories list derived from apps
  const categories = useMemo(() => {
    const set = new Set<string>();
    data?.apps?.forEach((app) => {
      if (app.category) set.add(app.category);
    });
    return ['all', ...Array.from(set)];
  }, [data?.apps]);

  // Filtered Apps list
  const filteredApps = useMemo(() => {
    if (!data?.apps) return [];
    return data.apps.filter((app) => {
      const matchesSearch =
        app.appName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.packageName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat =
        selectedCategory === 'all' ||
        app.category?.toLowerCase() === selectedCategory.toLowerCase();
      return matchesSearch && matchesCat;
    });
  }, [data?.apps, searchQuery, selectedCategory]);

  // Category breakdown stats
  const categoryStats = useMemo(() => {
    if (!data?.apps) return [];
    const map = new Map<string, number>();
    data.apps.forEach((app) => {
      const cat = app.category || 'Other';
      map.set(cat, (map.get(cat) || 0) + app.durationMinutes);
    });
    const totalMins = data.totalMinutes || 1;
    return Array.from(map.entries())
      .map(([name, minutes]) => ({
        name,
        minutes,
        percentage: Math.round((minutes / totalMins) * 100),
      }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [data?.apps, data?.totalMinutes]);

  // Hourly Chart Data (filter to sensible active hours or all 24h)
  const hourlyChartData = useMemo(() => {
    if (!data?.hourlyUsage) return [];
    return data.hourlyUsage.map((h) => ({
      hour: h.hour,
      label: h.label,
      minutes: h.durationMinutes,
      formattedTime: formatHoursAndMinutes(h.durationMinutes),
    }));
  }, [data?.hourlyUsage]);

  // Past 7 Days Chart Data
  const weeklyChartData = useMemo(() => {
    if (!data?.past7Days) return [];
    return data.past7Days.map((d) => ({
      day: d.dayOfWeek,
      date: d.date,
      minutes: d.totalMinutes,
      formattedTime: formatHoursAndMinutes(d.totalMinutes),
      isToday: d.isToday,
      avg: data.dailyAverageMinutes,
    }));
  }, [data?.past7Days, data?.dailyAverageMinutes]);

  // Date Navigator Helpers
  const shiftDate = (days: number) => {
    Sound.click(soundEnabled);
    const curr = new Date(selectedDate);
    curr.setDate(curr.getDate() + days);
    const today = new Date();
    // Cannot shift into the future
    if (curr > today) return;
    setSelectedDate(curr.toISOString().split('T')[0]);
  };

  const isTodaySelected = selectedDate === new Date().toISOString().split('T')[0];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E5E5E2] dark:border-[#334155]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-violet-100 dark:bg-violet-950/80 border border-violet-200/80 dark:border-violet-900/40 flex items-center justify-center text-violet-600 dark:text-violet-400 shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-[#37352F] dark:text-white tracking-tight">
                Screen Time &amp; App Activity
              </h1>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200/60 dark:border-violet-900/40">
                {isSupported ? 'Android UsageStats' : 'Web Preview'}
              </span>
            </div>
            <p className="text-xs text-[#787774] dark:text-[#94A3B8]">
              Device-wide application usage tracked strictly on device with zero cloud telemetry.
            </p>
          </div>
        </div>

        {/* Date Navigator & Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center rounded-xl bg-[#F7F7F5] dark:bg-[#23324C] border border-[#E5E5E2] dark:border-[#334155] p-1">
            <button
              type="button"
              onClick={() => shiftDate(-1)}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#1E293B] text-gray-600 dark:text-gray-300 transition-colors"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-3 py-1 text-xs font-semibold text-[#37352F] dark:text-white flex items-center gap-1.5 min-w-[130px] justify-center">
              <Calendar className="w-3.5 h-3.5 text-violet-500" />
              <span>{isTodaySelected ? 'Today' : selectedDate}</span>
            </div>
            <button
              type="button"
              onClick={() => shiftDate(1)}
              disabled={isTodaySelected}
              className={`p-1.5 rounded-lg transition-colors ${
                isTodaySelected
                  ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                  : 'hover:bg-white dark:hover:bg-[#1E293B] text-gray-600 dark:text-gray-300'
              }`}
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#1E293B] hover:bg-gray-50 dark:hover:bg-[#28364F] text-[#37352F] dark:text-white border border-[#E5E5E2] dark:border-[#334155] text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-violet-500' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Web or Permission Banner */}
      {!isSupported ? (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-violet-50 via-indigo-50/50 to-purple-50 dark:from-violet-950/30 dark:via-indigo-950/20 dark:to-purple-950/30 border border-violet-200/80 dark:border-violet-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-violet-950 dark:text-violet-200">
                Native Android Feature Available
              </h3>
              <p className="text-xs text-violet-800/80 dark:text-violet-300/80 mt-0.5 leading-relaxed max-w-3xl">
                Device-wide screen time uses Android&apos;s native{' '}
                <code className="bg-violet-200/60 dark:bg-violet-900/60 px-1 py-0.5 rounded font-mono text-[11px]">
                  UsageStatsManager
                </code>{' '}
                API. In web browsers, security sandbox barriers prevent web pages from querying other installed desktop applications. Run the Android build on a device or emulator to see live app metrics.
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <span className="text-xs font-semibold text-violet-700 dark:text-violet-300 bg-white dark:bg-[#1E293B] px-3 py-1.5 rounded-xl border border-violet-200 dark:border-violet-800">
              Zero Mock Data Fabricated
            </span>
          </div>
        </div>
      ) : !data?.granted ? (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-950 dark:text-amber-200">
                Usage Access Permission Required
              </h3>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed max-w-2xl">
                Android requires explicit user approval under <strong>Settings &gt; Apps &gt; Special App Access &gt; Usage Access</strong> to allow Personal Dashboard to read foreground and background app transitions.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRequestPermission}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer whitespace-nowrap"
          >
            Grant Usage Access in Settings
          </button>
        </div>
      ) : null}

      {/* Top Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Screen Time */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#F7F7F5] dark:bg-[#23324C] border border-[#E5E5E2] dark:border-[#334155] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-[#787774] dark:text-[#94A3B8]">
            <span>Today&apos;s Screen Time</span>
            <Clock className="w-4 h-4 text-violet-500" />
          </div>
          <div className="my-2">
            <div className="text-3xl font-extrabold text-[#37352F] dark:text-white tracking-tight">
              {data?.granted ? formatHoursAndMinutes(data.totalMinutes) : isSupported ? 'Locked' : '0m'}
            </div>
          </div>
          <div className="text-[11px] text-[#787774] dark:text-[#94A3B8] flex items-center justify-between">
            <span>Selected Day Total</span>
            {data?.granted && data.totalMinutes > 0 && (
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                Active
              </span>
            )}
          </div>
        </div>

        {/* Metric 2: 7-Day Daily Average */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#F7F7F5] dark:bg-[#23324C] border border-[#E5E5E2] dark:border-[#334155] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-[#787774] dark:text-[#94A3B8]">
            <span>7-Day Daily Average</span>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <div className="my-2">
            <div className="text-3xl font-extrabold text-[#37352F] dark:text-white tracking-tight">
              {data?.granted ? formatHoursAndMinutes(data.dailyAverageMinutes) : '0m'}
            </div>
          </div>
          <div className="text-[11px] text-[#787774] dark:text-[#94A3B8]">
            {data?.totalMinutes && data.dailyAverageMinutes
              ? data.totalMinutes > data.dailyAverageMinutes
                ? `${Math.round(((data.totalMinutes - data.dailyAverageMinutes) / data.dailyAverageMinutes) * 100)}% above average`
                : `${Math.round(((data.dailyAverageMinutes - data.totalMinutes) / data.dailyAverageMinutes) * 100)}% below average`
              : 'Rolling 7-day average'}
          </div>
        </div>

        {/* Metric 3: Most Used App */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#F7F7F5] dark:bg-[#23324C] border border-[#E5E5E2] dark:border-[#334155] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-[#787774] dark:text-[#94A3B8]">
            <span>Most Used App</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="my-2">
            <div className="text-lg font-bold text-[#37352F] dark:text-white truncate">
              {data?.topApps?.[0]?.appName || 'None'}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {data?.topApps?.[0] ? formatHoursAndMinutes(data.topApps[0].durationMinutes) : 'No usage data'}
            </div>
          </div>
          <div className="text-[11px] text-[#787774] dark:text-[#94A3B8] truncate">
            {data?.topApps?.[0]?.percentageOfTotal ? `${data.topApps[0].percentageOfTotal}% of total screen time` : 'Top ranked application'}
          </div>
        </div>

        {/* Metric 4: Active Apps Count */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#F7F7F5] dark:bg-[#23324C] border border-[#E5E5E2] dark:border-[#334155] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-[#787774] dark:text-[#94A3B8]">
            <span>Applications Tracked</span>
            <Layers className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="my-2">
            <div className="text-3xl font-extrabold text-[#37352F] dark:text-white tracking-tight">
              {data?.apps?.length || 0}
            </div>
          </div>
          <div className="text-[11px] text-[#787774] dark:text-[#94A3B8]">
            {excludeSelf ? 'Excluding Personal Dashboard' : 'Including all apps'}
          </div>
        </div>
      </div>

      {/* Interactive Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Hourly Distribution (24 Hours) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#F7F7F5] dark:bg-[#23324C] border border-[#E5E5E2] dark:border-[#334155] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#37352F] dark:text-white">
                Hourly Usage Breakdown
              </h2>
              <p className="text-xs text-[#787774] dark:text-[#94A3B8]">
                Screen-on time by hour of the day (12 AM - 11 PM)
              </p>
            </div>
            <span className="text-xs font-bold text-violet-600 dark:text-violet-400">
              24-Hour View
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#888' }}
                  interval={2}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#888' }}
                  unit="m"
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="bg-white dark:bg-[#1E293B] p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg text-xs">
                          <p className="font-bold text-[#37352F] dark:text-white">{item.label}</p>
                          <p className="text-violet-600 dark:text-violet-400 font-semibold mt-0.5">
                            {item.formattedTime}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="minutes" fill="#8B5CF6" radius={[4, 4, 0, 0]}>
                  {hourlyChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.minutes > 30 ? '#7C3AED' : '#8B5CF6'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Past 7 Days Comparison */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#F7F7F5] dark:bg-[#23324C] border border-[#E5E5E2] dark:border-[#334155] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#37352F] dark:text-white">
                Last 7 Days Trend
              </h2>
              <p className="text-xs text-[#787774] dark:text-[#94A3B8]">
                Daily totals compared to your weekly average
              </p>
            </div>
            {data?.dailyAverageMinutes ? (
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                Avg: {formatHoursAndMinutes(data.dailyAverageMinutes)}
              </span>
            ) : null}
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weeklyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: '#888' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#888' }}
                  unit="m"
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="bg-white dark:bg-[#1E293B] p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg text-xs space-y-0.5">
                          <p className="font-bold text-[#37352F] dark:text-white">
                            {item.day} ({item.date}) {item.isToday ? '• Today' : ''}
                          </p>
                          <p className="text-violet-600 dark:text-violet-400 font-semibold">
                            Total: {item.formattedTime}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="minutes" fill="#6366F1" radius={[6, 6, 0, 0]}>
                  {weeklyChartData.map((entry, index) => (
                    <Cell
                      key={`bar-${index}`}
                      fill={entry.isToday ? '#7C3AED' : '#6366F1'}
                    />
                  ))}
                </Bar>
                <Line
                  type="monotone"
                  dataKey="avg"
                  stroke="#F59E0B"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Category Breakdown Pill Row */}
      {categoryStats.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#F7F7F5] dark:bg-[#23324C] border border-[#E5E5E2] dark:border-[#334155] shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#37352F] dark:text-white">
              Category Distribution
            </h2>
            <span className="text-xs text-[#787774] dark:text-[#94A3B8]">
              {categoryStats.length} active categories
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {categoryStats.map((cat) => (
              <div
                key={cat.name}
                className="p-3 rounded-xl bg-white dark:bg-[#1E293B] border border-[#EDECE9] dark:border-[#334155]/60 flex flex-col justify-between"
              >
                <span className="text-[11px] font-bold text-[#787774] dark:text-[#94A3B8] truncate">
                  {cat.name}
                </span>
                <div className="my-1">
                  <span className="text-base font-extrabold text-[#37352F] dark:text-white">
                    {formatHoursAndMinutes(cat.minutes)}
                  </span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1 overflow-hidden">
                  <div
                    className="bg-violet-500 h-1 rounded-full"
                    style={{ width: `${Math.min(100, Math.max(5, cat.percentage))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full App Usage List */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#F7F7F5] dark:bg-[#23324C] border border-[#E5E5E2] dark:border-[#334155] shadow-xs space-y-4">
        {/* App List Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#EDECE9] dark:border-[#334155]/60">
          <div>
            <h2 className="text-sm font-bold text-[#37352F] dark:text-white">
              App-wise Usage Breakdown
            </h2>
            <p className="text-xs text-[#787774] dark:text-[#94A3B8]">
              Detailed activity durations and session counts for {selectedDate}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search app or package..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-[#1E293B] border border-[#E5E5E2] dark:border-[#334155] text-xs text-[#37352F] dark:text-white placeholder-gray-400 focus:outline-hidden focus:border-violet-500 min-w-[180px]"
              />
            </div>

            {/* Category Filter */}
            {categories.length > 2 && (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#1E293B] border border-[#E5E5E2] dark:border-[#334155] text-xs text-[#37352F] dark:text-white focus:outline-hidden focus:border-violet-500"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c === 'all' ? 'All Categories' : c}
                  </option>
                ))}
              </select>
            )}

            {/* Exclude Self Toggle */}
            <label className="flex items-center gap-1.5 text-xs text-[#787774] dark:text-[#94A3B8] cursor-pointer ml-1 select-none">
              <input
                type="checkbox"
                checked={excludeSelf}
                onChange={(e) => setExcludeSelf(e.target.checked)}
                className="rounded border-gray-300 text-violet-600 focus:ring-violet-500 w-3.5 h-3.5"
              />
              <span>Hide Personal Dashboard</span>
            </label>
          </div>
        </div>

        {/* Apps List Table/Grid */}
        {filteredApps.length > 0 ? (
          <div className="space-y-2">
            {filteredApps.map((app) => (
              <div
                key={app.packageName}
                className="p-3 rounded-xl bg-white dark:bg-[#1E293B] border border-[#EDECE9] dark:border-[#334155]/60 flex items-center justify-between gap-3 hover:border-violet-300 dark:hover:border-violet-700 transition-all"
              >
                {/* Left: Rank, Icon, App Name, Category */}
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-5 text-center text-xs font-bold text-gray-400">
                    #{app.rank}
                  </span>

                  {app.icon ? (
                    <img
                      src={app.icon}
                      alt={app.appName}
                      className="w-9 h-9 rounded-xl object-contain shrink-0 border border-gray-100 dark:border-gray-800"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-950 flex items-center justify-center font-bold text-violet-700 dark:text-violet-300 text-sm shrink-0">
                      {app.appName.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-[#37352F] dark:text-white truncate">
                        {app.appName}
                      </h3>
                      {app.category && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                          {app.category}
                        </span>
                      )}
                      {app.isSystemApp && (
                        <span className="text-[10px] font-medium text-gray-400">
                          System
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-gray-400 truncate">
                      {app.packageName}
                    </p>
                  </div>
                </div>

                {/* Right: Duration, Percentage bar, Session Count */}
                <div className="flex items-center gap-4 shrink-0 text-right">
                  <div className="hidden sm:block text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-semibold text-gray-700 dark:text-gray-200">
                      {app.sessionCount}
                    </span>{' '}
                    sessions
                  </div>

                  <div className="w-24 sm:w-36 space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-[#37352F] dark:text-white">
                        {formatHoursAndMinutes(app.durationMinutes)}
                      </span>
                      <span className="text-gray-400 text-[11px]">
                        {app.percentageOfTotal || 0}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-violet-600 dark:bg-violet-400 h-1.5 rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, Math.max(3, app.percentageOfTotal || 0))}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center rounded-xl bg-white dark:bg-[#1E293B] border border-[#EDECE9] dark:border-[#334155]/60 space-y-2">
            <Smartphone className="w-8 h-8 text-gray-400 mx-auto opacity-50" />
            <h3 className="text-sm font-bold text-[#37352F] dark:text-white">
              No Application Usage Recorded
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              {!isSupported
                ? 'Device-wide app usage is queried via Android OS UsageStatsManager. Run the app on an Android device to view genuine screen time.'
                : data?.granted
                ? 'No foreground app activity was found for this specific date range.'
                : 'Grant Usage Access permission to view daily statistics.'}
            </p>
          </div>
        )}

        {/* Audit & Formula Verification Diagnostics */}
        {data?.diagnostics && (
          <div className="p-4 rounded-xl bg-violet-50/60 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/30 text-xs text-gray-700 dark:text-gray-300 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-violet-900 dark:text-violet-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Formula &amp; Diagnostics Engine
              </span>
              <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-white dark:bg-[#1E293B] border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300">
                Mode: {data.diagnostics.calculationMode || 'usageEventsUnion'}
              </span>
            </div>
            <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">
              Total Screen Time uses the <strong>Mathematical Union of Foreground Sessions</strong> on an interactive screen, clipping sessions to midnight boundaries and discarding overlapping Multi-Window/PiP intervals to match Android Digital Wellbeing.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
              <div className="p-2 rounded-lg bg-white/80 dark:bg-[#1E293B]/80 border border-violet-100 dark:border-violet-900/40">
                <span className="text-gray-400 block text-[10px]">RAW EVENTS</span>
                <span className="font-bold">{data.diagnostics.rawEventsCount ?? 0}</span>
              </div>
              <div className="p-2 rounded-lg bg-white/80 dark:bg-[#1E293B]/80 border border-violet-100 dark:border-violet-900/40">
                <span className="text-gray-400 block text-[10px]">MERGED INTERVALS</span>
                <span className="font-bold">{data.diagnostics.mergedIntervalsCount ?? 0}</span>
              </div>
              <div className="p-2 rounded-lg bg-white/80 dark:bg-[#1E293B]/80 border border-violet-100 dark:border-violet-900/40">
                <span className="text-gray-400 block text-[10px]">DUPLICATES DISCARDED</span>
                <span className="font-bold">{data.diagnostics.duplicatesDiscarded ?? 0}</span>
              </div>
              <div className="p-2 rounded-lg bg-white/80 dark:bg-[#1E293B]/80 border border-violet-100 dark:border-violet-900/40">
                <span className="text-gray-400 block text-[10px]">UNCLOSED SESSIONS CAPPED</span>
                <span className="font-bold">{data.diagnostics.openSessionsCapped ?? 0}</span>
              </div>
            </div>
          </div>
        )}

        {/* Limitations & Privacy Disclaimer */}
        <div className="pt-3 border-t border-[#EDECE9] dark:border-[#334155]/60 flex items-start gap-2 text-[11px] text-[#787774] dark:text-[#94A3B8]">
          <Info className="w-3.5 h-3.5 shrink-0 text-gray-400 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Privacy &amp; Data Source:</strong> All statistics are queried locally from the Android{' '}
            <code className="font-mono text-[10px]">UsageStatsManager</code>. No application usage records, durations, or package names are synced to Supabase or any external cloud servers.
          </p>
        </div>
      </div>
    </div>
  );
};
