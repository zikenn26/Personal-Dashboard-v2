import React, { useState, useEffect, useMemo } from 'react';
import {
  Smartphone,
  Clock,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ShieldAlert,
  Search,
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
import { ScreenTimeData } from '../../../../types';
import { nativeService } from '../../../../services/nativeService';
import {
  getLocalDateString,
  shiftLocalDateString,
  formatYAxisHours,
  getAppHourlyUsage,
} from '../../../../utils/screenTimeCalculator';

export interface AndroidScreenTimeScreenProps {
  onBack?: () => void;
}

export const AndroidScreenTimeScreen: React.FC<AndroidScreenTimeScreenProps> = ({
  onBack,
}) => {
  const [data, setData] = useState<ScreenTimeData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return getLocalDateString();
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedAppPackage, setSelectedAppPackage] = useState<string | null>(null);

  const isSupported = screenTimeService.isSupported();
  const isTodaySelected = selectedDate === getLocalDateString();

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
      if (updated.date === selectedDate) {
        setData(updated);
      }
    });

    // Check periodically or on visibility for midnight rollover
    const interval = setInterval(() => {
      const today = getLocalDateString();
      if (isTodaySelected && selectedDate !== today) {
        setSelectedDate(today);
      }
    }, 15000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [selectedDate, isTodaySelected]);

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
    const nextDate = shiftLocalDateString(selectedDate, days);
    const today = getLocalDateString();
    if (nextDate > today) return;
    setSelectedDate(nextDate);
  };

  const selectedApp = useMemo(() => {
    if (!selectedAppPackage || !data?.apps) return null;
    return data.apps.find((a) => a.packageName === selectedAppPackage) || null;
  }, [selectedAppPackage, data?.apps]);

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
    const buckets = getAppHourlyUsage(data, selectedAppPackage);
    return buckets.map((h) => ({
      hour: h.hour,
      label: h.label,
      minutes: h.durationMinutes,
      formattedTime: formatHoursAndMinutes(h.durationMinutes),
    }));
  }, [data, selectedAppPackage]);

  const weeklyChartData = useMemo(() => {
    if (!data?.past7Days || data.past7Days.length === 0) return [];
    
    if (selectedAppPackage) {
      return data.past7Days.map((d) => {
        let appMins = d.appMinutes?.[selectedAppPackage] ?? 0;
        if (d.isToday && selectedApp) {
          appMins = selectedApp.durationMinutes;
        }
        return {
          day: d.dayOfWeek,
          minutes: appMins,
          isToday: d.isToday,
        };
      });
    }

    return data.past7Days.map((d) => ({
      day: d.dayOfWeek,
      minutes: d.totalMinutes,
      isToday: d.isToday,
    }));
  }, [data?.past7Days, selectedAppPackage, selectedApp]);

  const weeklyAverageMinutes = useMemo(() => {
    if (weeklyChartData.length === 0) return 0;
    const total = weeklyChartData.reduce((acc, curr) => acc + curr.minutes, 0);
    return Math.round(total / weeklyChartData.length);
  }, [weeklyChartData]);

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
        </div>
      </div>

      {/* Permission Alert Banner (Native Android only) */}
      {screenTimeService.isNativeAndroid() && !data?.granted && (
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

      {/* Awaiting APK sync banner (Mobile Chrome / Web) */}
      {!screenTimeService.isNativeAndroid() && !data?.hasData && (
        <div className="p-4 rounded-3xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200/70 dark:border-violet-900/40 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-2xl bg-violet-600 text-white flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-violet-900 dark:text-violet-200">
                Awaiting Data from Android APK
              </h3>
              <p className="text-[11px] text-violet-700 dark:text-violet-300 leading-relaxed mt-0.5">
                Chrome Android cannot access device UsageStats. Real screen time is recorded exclusively by the installed APK. Open the Personal Dashboard APK on your phone to sync your real stats.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="w-full py-2 px-3 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs shadow-xs active:scale-98 transition-all cursor-pointer"
          >
            Check for APK Sync
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

          {!data?.isNativeAndroid && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">
              {data?.hasData ? 'From APK' : 'Awaiting APK'}
            </span>
          )}
        </div>

        <div className="space-y-1">
          <div className="text-4xl font-black tracking-tight">
            {isLoading && !data
              ? '...'
              : (data?.totalMinutes !== undefined && data.totalMinutes > 0) || (data?.granted && data?.hasData)
              ? formatHoursAndMinutes(data?.totalMinutes || 0)
              : screenTimeService.isNativeAndroid()
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
              : 'Daily screen time'}
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
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <BarChart2 className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
              <div className="min-w-0 flex items-center gap-1.5">
                <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider truncate">
                  {selectedApp ? `${selectedApp.appName} Hourly` : 'Hourly Distribution'}
                </h3>
                {selectedApp && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 text-[10px] font-bold truncate">
                    {selectedApp.appName}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void nativeService.triggerHaptic('selection');
                        setSelectedAppPackage(null);
                      }}
                      className="ml-0.5 hover:opacity-70 cursor-pointer"
                      title="Clear app filter"
                    >
                      ✕
                    </button>
                  </span>
                )}
              </div>
            </div>
            <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 shrink-0">
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
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="bg-white dark:bg-[#1E293B] px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-md text-xs space-y-0.5">
                          <p className="font-bold text-gray-900 dark:text-white">{item.label}</p>
                          <p className="text-violet-600 dark:text-violet-400 font-semibold text-[11px]">
                            {selectedApp ? `${selectedApp.appName}: ` : 'Total: '}
                            {item.formattedTime || formatHoursAndMinutes(item.minutes)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
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
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <div className="min-w-0 flex items-center gap-1.5">
                <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider truncate">
                  Last 7 Days
                </h3>
                {selectedApp && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 text-[10px] font-bold truncate">
                    {selectedApp.appName}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void nativeService.triggerHaptic('selection');
                        setSelectedAppPackage(null);
                      }}
                      className="ml-0.5 hover:opacity-70 cursor-pointer"
                      title="Clear app filter"
                    >
                      ✕
                    </button>
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {weeklyAverageMinutes > 0 ? (
                <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                  Avg: {formatHoursAndMinutes(weeklyAverageMinutes)}
                </span>
              ) : null}
              {selectedApp && (
                <button
                  type="button"
                  onClick={() => {
                    void nativeService.triggerHaptic('selection');
                    setSelectedAppPackage(null);
                  }}
                  className="text-[10px] text-violet-600 dark:text-violet-400 font-bold hover:underline cursor-pointer"
                >
                  All Apps
                </button>
              )}
            </div>
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
                  tickFormatter={formatYAxisHours}
                  domain={[0, (dataMax: number) => Math.max(60, Math.ceil(dataMax / 60) * 60)]}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="bg-white dark:bg-[#1E293B] px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-md text-xs space-y-0.5">
                          <p className="font-bold text-gray-900 dark:text-white">
                            {item.day} {item.isToday ? '• Today' : ''}
                          </p>
                          <p className="text-violet-600 dark:text-violet-400 font-semibold text-[11px]">
                            {selectedApp ? `${selectedApp.appName}: ` : 'Total: '}
                            {formatHoursAndMinutes(item.minutes)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="minutes" fill={selectedApp ? '#8B5CF6' : '#6366F1'} radius={[4, 4, 0, 0]}>
                  {weeklyChartData.map((entry, index) => (
                    <Cell
                      key={`w-${index}`}
                      fill={entry.isToday ? '#7C3AED' : selectedApp ? '#8B5CF6' : '#6366F1'}
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
          <span className="text-[10px] text-gray-400">
            {selectedAppPackage ? 'Tap again to reset' : 'Tap an app to see 7d trend'}
          </span>
        </div>

        {filteredApps.length > 0 ? (
          <div className="space-y-2">
            {filteredApps.map((app) => {
              const isSelected = selectedAppPackage === app.packageName;
              return (
                <div
                  key={app.packageName}
                  onClick={() => {
                    void nativeService.triggerHaptic('selection');
                    setSelectedAppPackage((prev) => (prev === app.packageName ? null : app.packageName));
                  }}
                  className={`p-3 rounded-2xl border shadow-2xs flex items-center justify-between gap-3 cursor-pointer transition-all active:scale-[0.99] ${
                    isSelected
                      ? 'bg-violet-50 dark:bg-violet-950/40 border-violet-500 dark:border-violet-600 ring-2 ring-violet-500/20'
                      : 'bg-white dark:bg-[#121826] border-[#E8E5F3] dark:border-[#242D40] hover:border-violet-300 dark:hover:border-violet-800'
                  }`}
                  title={isSelected ? 'Click to show all apps' : `Click to view 7-day trend for ${app.appName}`}
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
                      <div className="flex items-center gap-1.5">
                        <p className={`text-xs font-bold truncate ${isSelected ? 'text-violet-700 dark:text-violet-300' : 'text-gray-900 dark:text-white'}`}>
                          {app.appName}
                        </p>
                        {isSelected && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-600 text-white shrink-0">
                            7d active
                          </span>
                        )}
                      </div>
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
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-center rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] space-y-2">
            <Smartphone className="w-8 h-8 text-violet-400 mx-auto opacity-60" />
            <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
              No Application Usage Data
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {data?.granted && data?.hasData
                ? 'No foreground app activity found for this day.'
                : screenTimeService.isNativeAndroid()
                ? 'Grant Usage Access in Android Settings to activate.'
                : 'No screen time recorded yet. Open the Android APK version to sync real stats.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
