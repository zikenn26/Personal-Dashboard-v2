import React, { useEffect, useState } from 'react';
import { Smartphone, Clock, ArrowRight, ShieldAlert, Sparkles, RefreshCw, BarChart2 } from 'lucide-react';
import { screenTimeService } from '../../services/screenTimeService';
import { ScreenTimeData } from '../../types';
import { Sound } from '../../utils/audio';

export interface ScreenTimeCardProps {
  dragHandle?: React.ReactNode;
  onNavigate?: (view: string) => void;
  soundEnabled?: boolean;
}

export const ScreenTimeCard: React.FC<ScreenTimeCardProps> = ({
  dragHandle,
  onNavigate,
  soundEnabled,
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

    // Subscribe to background/resume updates
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
    Sound.click(soundEnabled);
    if (onNavigate) {
      onNavigate('screentime');
    }
  };

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    Sound.click(soundEnabled);
    setIsLoading(true);
    try {
      const res = await screenTimeService.getDailyUsage({ forceRefresh: true });
      setData(res);
    } finally {
      setIsLoading(false);
    }
  };

  const topApps = data?.topApps?.slice(0, 3) || [];

  return (
    <div
      onClick={handleCardClick}
      className="grid-tile p-3.5 sm:p-4 rounded-2xl bg-[#F7F7F5] dark:bg-[#23324C] border border-[#E5E5E2] dark:border-[#334155] shadow-xs flex flex-col justify-between space-y-3 w-full hover:border-violet-300 dark:hover:border-violet-700 transition-all cursor-pointer group"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#EDECE9] dark:border-[#334155]/60">
        <div className="flex items-center gap-2 min-w-0">
          {dragHandle}
          <div className="w-7 h-7 rounded-xl bg-violet-100 dark:bg-violet-950/70 border border-violet-200/70 dark:border-violet-900/40 flex items-center justify-center text-violet-600 dark:text-violet-400 shrink-0">
            <Smartphone className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs uppercase font-bold text-[#37352F] dark:text-white tracking-wider truncate">
              Screen Time
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isSupported && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading}
              title="Refresh Screen Time"
              className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-violet-500' : ''}`} />
            </button>
          )}

          <span className="text-[11px] font-medium text-violet-600 dark:text-violet-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            <span>Details</span>
            <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </div>

      {/* Hero Stat: Today's Total Usage */}
      <div className="space-y-1">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-medium text-[#787774] dark:text-[#94A3B8]">
            Today&apos;s Screen Usage
          </span>
          {data?.dailyAverageMinutes && data.dailyAverageMinutes > 0 ? (
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              Avg: {formatHoursAndMinutes(data.dailyAverageMinutes)}/day
            </span>
          ) : null}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-[#37352F] dark:text-white tracking-tight">
              {isLoading && !data
                ? '...'
                : data?.granted
                ? formatHoursAndMinutes(data.totalMinutes)
                : isSupported
                ? 'Permission Needed'
                : 'Android Feature'}
            </span>
            {data?.granted && data.totalMinutes > 0 && (
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-900/40">
                Live Stats
              </span>
            )}
          </div>

          <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center text-violet-500">
            <BarChart2 className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Top 2-3 Apps Breakdown */}
      {data?.granted && topApps.length > 0 ? (
        <div className="space-y-2 pt-1 border-t border-[#EDECE9] dark:border-[#334155]/60">
          <div className="text-[10px] uppercase font-bold tracking-wider text-[#787774] dark:text-[#94A3B8]">
            Top Apps Today
          </div>
          <div className="space-y-1.5">
            {topApps.map((app) => (
              <div key={app.packageName} className="flex items-center gap-2 text-xs">
                {app.icon ? (
                  <img
                    src={app.icon}
                    alt={app.appName}
                    className="w-5 h-5 rounded-md object-contain shrink-0"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-md bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-700 dark:text-gray-200 shrink-0">
                    {app.appName.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-[11px] mb-0.5">
                    <span className="font-medium text-[#37352F] dark:text-gray-200 truncate">
                      {app.appName}
                    </span>
                    <span className="font-semibold text-gray-600 dark:text-gray-300 shrink-0 ml-1">
                      {formatHoursAndMinutes(app.durationMinutes)}
                    </span>
                  </div>

                  {/* Percentage bar */}
                  <div className="w-full bg-gray-200 dark:bg-gray-700/80 rounded-full h-1 overflow-hidden">
                    <div
                      className="bg-violet-500 dark:bg-violet-400 h-1 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.max(4, app.percentageOfTotal || 0))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : !isSupported ? (
        <div className="p-2.5 rounded-xl bg-violet-50/70 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900/30 text-xs text-[#5F5E5B] dark:text-gray-300 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-violet-700 dark:text-violet-300 text-[11px]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Android Native UsageStats</span>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
            Captures device-wide screen time & app activity directly from Android OS without cloud upload.
          </p>
        </div>
      ) : (
        <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="text-[11px] leading-tight">
            Tap to grant Usage Access permission in Android Settings.
          </span>
        </div>
      )}
    </div>
  );
};
