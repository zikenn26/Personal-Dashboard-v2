import React, { useState, useEffect, useMemo } from 'react';
import {
  Smartphone,
  Clock,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Search,
  Sparkles,
  Award,
  Layers,
  Info,
  TrendingUp,
  BarChart2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import { screenTimeService } from '../../../../services/screenTimeService';
import { ScreenTimeData, AppUsageItem } from '../../../../types';
import { nativeService } from '../../../../services/nativeService';

export interface AndroidScreenTimeScreenProps {
  onBack?: () => void;
}

export const AndroidScreenTimeScreen: React.FC<AndroidScreenTimeScreenProps> = ({
  onBack,
}) => {
  const [data, setData] = useState<ScreenTimeData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const isSupported = screenTimeService.isSupported();

  const loadData = async (force = false) => {
    setIsLoading(true);
    try {
      const res = await screenTimeService.getDailyUsage({
        date: selectedDate,
        forceRefresh: force,
      });
      setData(res);
    } catch (err) {
      console.error('[AndroidScreenTimeScreen] load error:', err);
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
  }, [selectedDate]);

  const handleRefresh = async () => {
    void nativeService.triggerHaptic('selection');
    await loadData(true);
  };

  const handleGrantPermission = async () => {
    void nativeService.triggerHaptic('impactMedium');
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

  const shiftDate = (days: number) => {
    void nativeService.triggerHaptic('selection');
    const curr = new Date(selectedDate);
    curr.setDate(curr.getDate() + days);
    const today = new Date();
    if (curr > today) return;
    setSelectedDate(curr.toISOString().split('T')[0]);
  };

  const isTodaySelected = selectedDate === new Date().toISOString().split('T')[0];

  const filteredApps = useMemo(() => {
    if (!data?.apps) return [];
    return data.apps.filter((app) => {
      const matchesSearch =
        app.appName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.packageName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat =
        selectedCategory === 'All' ||
        app.category?.toLowerCase() === selectedCategory.toLowerCase();
      return matchesSearch && matchesCat;
    });
  }, [data?.apps, searchQuery, selectedCategory]);

  const hourlyChartData = useMemo(() => {
    if (!data?.hourlyUsage) return [];
    return data.hourlyUsage.map((h) => ({
      hour: h.hour,
      label: h.label,
      minutes: h.durationMinutes,
    }));
  }, [data?.hourlyUsage]);

  const weeklyChartData = useMemo(() => {
    if (!data?.past7Days) return [];
    return data.past7Days.map((d) => ({
      day: d.dayOfWeek,
      minutes: d.totalMinutes,
      isToday: d.isToday,
    }));
  }, [data?.past7Days]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    data?.apps?.forEach((a) => {
      if (a.category) set.add(a.category);
    });
    return ['All', ...Array.from(set)];
  }, [data?.apps]);

  return (
    <div className="w-full max-w-lg mx-auto px-3.5 pb-24 pt-2 space-y-3.5">
      {/* Top Bar with Date Switcher and Refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] rounded-2xl p-1 shadow-2xs">
          <button
            type="button"
            onClick={() => shiftDate(-1)}
            className="p-1 rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
            title="Previous Day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="px-2.5 text-xs font-bold text-gray-900 dark:text-white min-w-[90px] text-center">
            {isTodaySelected ? 'Today' : selectedDate}
          </div>
          <button
            type="button"
            onClick={() => shiftDate(1)}
            disabled={isTodaySelected}
            className={`p-1 rounded-xl transition-colors ${
              isTodaySelected
                ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
            title="Next Day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {isSupported && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-2 rounded-2xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] text-gray-600 dark:text-gray-300 shadow-2xs active:scale-95 transition-all cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-violet-500' : ''}`} />
            </button>
          )}

          {onBack && (
            <button
              type="button"
              onClick={() => {
                void nativeService.triggerHaptic('click');
                onBack();
              }}
              className="px-3 py-1.5 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-bold active:scale-95 transition-all"
            >
              Home
            </button>
          )}
        </div>
      </div>

      {/* Permission Alert Banner */}
      {isSupported && !data?.granted && (
        <div className="p-4 rounded-3xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-900/40 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-2xl bg-amber-600 text-white flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Usage Access Required
              </h3>
              <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed mt-0.5">
                Android restricts application usage stats by default. Grant permission under Special App Access to view foreground app metrics.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleGrantPermission}
            className="w-full py-2 px-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs active:scale-98 transition-all cursor-pointer"
          >
            Open Android Settings
          </button>
        </div>
      )}

      {/* Hero Card: Today's Total Screen Time */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center">
              <Clock className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-semibold text-violet-100">
              {data?.formattedDate || 'Selected Day'}
            </span>
          </div>

          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">
            {isSupported ? 'Android OS Stats' : 'Web Preview'}
          </span>
        </div>

        <div className="space-y-1">
          <div className="text-4xl font-black tracking-tight">
            {isLoading && !data
              ? '...'
              : data?.granted
              ? formatHoursAndMinutes(data.totalMinutes)
              : isSupported
              ? 'Permission Needed'
              : '0m'}
          </div>
          <p className="text-xs text-violet-200">
            {data?.dailyAverageMinutes && data.dailyAverageMinutes > 0
              ? `Daily average: ${formatHoursAndMinutes(data.dailyAverageMinutes)} (${
                  data.totalMinutes > data.dailyAverageMinutes
                    ? `+${Math.round(((data.totalMinutes - data.dailyAverageMinutes) / data.dailyAverageMinutes) * 100)}%`
                    : `-${Math.round(((data.dailyAverageMinutes - data.totalMinutes) / data.dailyAverageMinutes) * 100)}%`
                })`
              : 'Accurate foreground app activity logged on device'}
          </p>
        </div>

        {/* Quick Highlights Row */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/20 text-xs">
          <div className="p-2.5 rounded-2xl bg-white/10 space-y-0.5">
            <span className="text-[10px] text-violet-200">Most Active App</span>
            <p className="font-bold truncate text-white">
              {data?.topApps?.[0]?.appName || 'None'}
            </p>
          </div>
          <div className="p-2.5 rounded-2xl bg-white/10 space-y-0.5">
            <span className="text-[10px] text-violet-200">Apps Tracked</span>
            <p className="font-bold text-white">
              {data?.apps?.length || 0} applications
            </p>
          </div>
        </div>
      </div>

      {/* Hourly Usage Bar Chart */}
      {hourlyChartData.length > 0 && (
        <div className="p-4 rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                Hourly Distribution
              </h3>
            </div>
            <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">
              24-Hour Timeline
            </span>
          </div>

          <div className="h-36 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyChartData} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: '#888' }}
                  interval={3}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: '#888' }}
                  unit="m"
                  axisLine={false}
                  tickLine={false}
                />
                <Bar dataKey="minutes" fill="#8B5CF6" radius={[3, 3, 0, 0]}>
                  {hourlyChartData.map((entry, index) => (
                    <Cell
                      key={`h-${index}`}
                      fill={entry.minutes > 20 ? '#7C3AED' : '#8B5CF6'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Weekly Trend (7 Days) */}
      {weeklyChartData.length > 0 && (
        <div className="p-4 rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                Last 7 Days
              </h3>
            </div>
            {data?.dailyAverageMinutes ? (
              <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                Avg: {formatHoursAndMinutes(data.dailyAverageMinutes)}
              </span>
            ) : null}
          </div>

          <div className="h-32 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyChartData} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: '#888' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: '#888' }}
                  unit="m"
                  axisLine={false}
                  tickLine={false}
                />
                <Bar dataKey="minutes" fill="#6366F1" radius={[4, 4, 0, 0]}>
                  {weeklyChartData.map((entry, index) => (
                    <Cell
                      key={`w-${index}`}
                      fill={entry.isToday ? '#7C3AED' : '#6366F1'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Category Pills & Search */}
      <div className="space-y-2">
        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search apps..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-4 py-2 rounded-2xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] text-xs text-gray-900 dark:text-white placeholder-gray-400 shadow-2xs focus:outline-hidden focus:border-violet-500"
          />
        </div>

        {/* Category Filter Chips */}
        {categories.length > 2 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  void nativeService.triggerHaptic('selection');
                  setSelectedCategory(cat);
                }}
                className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-violet-600 text-white'
                    : 'bg-white dark:bg-[#121826] text-gray-600 dark:text-gray-300 border border-[#E8E5F3] dark:border-[#242D40]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* App-wise List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
            All Applications ({filteredApps.length})
          </h3>
        </div>

        {filteredApps.length > 0 ? (
          <div className="space-y-2">
            {filteredApps.map((app) => (
              <div
                key={app.packageName}
                className="p-3 rounded-2xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-2xs flex items-center justify-between gap-3"
              >
                {/* Left: Rank, Icon, App Name, Category */}
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-bold text-gray-400 w-4 text-center">
                    #{app.rank}
                  </span>

                  {app.icon ? (
                    <img
                      src={app.icon}
                      alt={app.appName}
                      className="w-8 h-8 rounded-xl object-contain shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-950 flex items-center justify-center font-bold text-violet-700 dark:text-violet-300 text-xs shrink-0">
                      {app.appName.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                      {app.appName}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                      {app.category && <span>{app.category}</span>}
                      <span>•</span>
                      <span>{app.sessionCount} sessions</span>
                    </div>
                  </div>
                </div>

                {/* Right: Duration & Percentage bar */}
                <div className="text-right shrink-0 w-24 space-y-1">
                  <div className="text-xs font-bold text-gray-900 dark:text-white">
                    {formatHoursAndMinutes(app.durationMinutes)}
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-violet-600 dark:bg-violet-400 h-1.5 rounded-full"
                      style={{
                        width: `${Math.min(100, Math.max(4, app.percentageOfTotal || 0))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] space-y-2">
            <Smartphone className="w-8 h-8 text-violet-400 mx-auto opacity-60" />
            <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
              No Application Usage Data
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {!isSupported
                ? 'Usage tracking runs natively on Android via UsageStatsManager.'
                : data?.granted
                ? 'No foreground app sessions found for this day.'
                : 'Grant Usage Access in Android Settings to activate.'}
            </p>
          </div>
        )}
      </div>

      {/* Limitations note */}
      <div className="p-3 rounded-2xl bg-gray-50 dark:bg-[#121826]/60 border border-gray-100 dark:border-gray-800 text-[11px] text-gray-500 dark:text-gray-400 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gray-400" />
        <p className="leading-snug">
          Screen time is calculated using native Android UsageEvents clipped to local midnight boundaries. Data is stored solely on device and never uploaded to cloud databases.
        </p>
      </div>
    </div>
  );
};
