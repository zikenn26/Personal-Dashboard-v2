import React, { useEffect, useState } from 'react';
import { Smartphone, Clock, ChevronRight, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';
import { screenTimeService } from '../../../../services/screenTimeService';
import { ScreenTimeData } from '../../../../types';
import { nativeService } from '../../../../services/nativeService';

export interface AndroidScreenTimeCardProps {
  onNavigateToScreenTime: () => void;
}

export const AndroidScreenTimeCard: React.FC<AndroidScreenTimeCardProps> = ({
  onNavigateToScreenTime,
}) => {
  const [data, setData] = useState<ScreenTimeData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const isSupported = screenTimeService.isSupported();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setIsLoading(true);
        const res = await screenTimeService.getDailyUsage();
        if (mounted) setData(res);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void load();

    const unsubscribe = screenTimeService.subscribe((updated) => {
      if (mounted) setData(updated);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const formatHoursAndMinutes = (totalMinutes: number) => {
    if (!totalMinutes || totalMinutes <= 0) return '0m';
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  };

  const handleCardClick = () => {
    void nativeService.triggerHaptic('selection');
    onNavigateToScreenTime();
  };

  const handleGrantPermission = async (e: React.MouseEvent) => {
    e.stopPropagation();
    void nativeService.triggerHaptic('impactMedium');
    await screenTimeService.requestPermission();
  };

  const topApps = data?.topApps?.slice(0, 3) || [];

  return (
    <div
      onClick={handleCardClick}
      className="p-4 rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-xs space-y-3 cursor-pointer active:scale-[0.99] transition-all"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-2xl bg-violet-100 dark:bg-violet-950/70 border border-violet-200/70 dark:border-violet-900/40 flex items-center justify-center text-violet-600 dark:text-violet-400">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
              Screen Time
            </h3>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              {data?.formattedDate || 'Today'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-violet-600 dark:text-violet-400 text-xs font-semibold">
          <span>Overview</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Main Stat & Progress */}
      <div className="flex items-baseline justify-between pt-1">
        <div>
          <div className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            {isLoading && !data
              ? '...'
              : data?.granted
              ? formatHoursAndMinutes(data.totalMinutes)
              : isSupported
              ? 'Access Needed'
              : 'Android Telemetry'}
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {data?.granted
              ? data.dailyAverageMinutes > 0
                ? `Daily avg: ${formatHoursAndMinutes(data.dailyAverageMinutes)}`
                : 'Aggregated from UsageStats'
              : isSupported
              ? 'Tap to grant Usage Access'
              : 'Available in Android APK'}
          </p>
        </div>

        {data?.granted && data.totalMinutes > 0 && (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200/70 dark:border-violet-900/50">
            {topApps.length} Apps Active
          </span>
        )}
      </div>

      {/* Top Apps List or Permission Action */}
      {data?.granted && topApps.length > 0 ? (
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-2">
          {topApps.map((app) => (
            <div key={app.packageName} className="flex items-center gap-2.5">
              {app.icon ? (
                <img
                  src={app.icon}
                  alt={app.appName}
                  className="w-6 h-6 rounded-lg object-contain shrink-0"
                />
              ) : (
                <div className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-700 dark:text-gray-300 shrink-0">
                  {app.appName.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-gray-800 dark:text-gray-200 truncate text-[11px]">
                    {app.appName}
                  </span>
                  <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 shrink-0 ml-1">
                    {formatHoursAndMinutes(app.durationMinutes)}
                  </span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1 overflow-hidden">
                  <div
                    className="bg-violet-600 dark:bg-violet-400 h-1 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.max(5, app.percentageOfTotal || 0))}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : isSupported && !data?.granted ? (
        <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/40 space-y-2">
          <div className="flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Usage Access Required
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-snug">
                Grant permission in Settings to read genuine screen time without battery drain.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleGrantPermission}
            className="w-full py-1.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            Grant in Android Settings
          </button>
        </div>
      ) : (
        <div className="p-3 rounded-2xl bg-gray-50 dark:bg-[#161D2C] border border-gray-100 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-300">
          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
            Real screen time is queried on device using Android&apos;s UsageStatsManager.
          </p>
        </div>
      )}
    </div>
  );
};
