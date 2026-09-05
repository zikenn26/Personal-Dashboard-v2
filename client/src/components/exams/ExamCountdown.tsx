import React, { useState, useEffect } from 'react';
import { Clock, AlertCircle } from 'lucide-react';

interface ExamCountdownProps {
  targetDateStr: string;
  label?: string;
  size?: 'sm' | 'md' | 'lg' | 'card' | 'list';
  showSeconds?: boolean;
}

interface TimeRemaining {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
}

export function calculateTimeRemaining(targetDateStr: string): TimeRemaining {
  if (!targetDateStr) {
    return { totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
  }

  // Parse YYYY-MM-DD or full ISO string
  const targetDate = new Date(targetDateStr.includes('T') ? targetDateStr : `${targetDateStr}T09:00:00`);
  const now = new Date();
  const diff = targetDate.getTime() - now.getTime();

  if (diff <= 0) {
    return { totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return { totalMs: diff, days, hours, minutes, seconds, isPast: false };
}

export const ExamCountdown: React.FC<ExamCountdownProps> = ({
  targetDateStr,
  label = 'Target Exam',
  size = 'md',
  showSeconds = true,
}) => {
  const [time, setTime] = useState<TimeRemaining>(() => calculateTimeRemaining(targetDateStr));

  useEffect(() => {
    setTime(calculateTimeRemaining(targetDateStr));
    const interval = setInterval(() => {
      setTime(calculateTimeRemaining(targetDateStr));
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDateStr]);

  if (time.isPast) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-semibold">
        <Clock className="w-3.5 h-3.5" />
        <span>Exam Concluded / Target Reached</span>
      </div>
    );
  }

  // Specialized Live Counter Card for Exam Cards
  if (size === 'card') {
    const isUrgent = time.days < 30;
    const isApproaching = time.days < 90;

    return (
      <div
        className={`p-3 rounded-xl border transition-all ${
          isUrgent
            ? 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60'
            : isApproaching
            ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60'
            : 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-200/80 dark:border-indigo-900/60'
        }`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isUrgent ? 'bg-rose-500' : isApproaching ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isUrgent ? 'bg-rose-600' : isApproaching ? 'bg-amber-600' : 'bg-emerald-600'
                }`}
              />
            </span>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-gray-400">
              Live Counter
            </span>
          </div>

          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${
              isUrgent
                ? 'bg-rose-100 dark:bg-rose-900/80 text-rose-700 dark:text-rose-300'
                : isApproaching
                ? 'bg-amber-100 dark:bg-amber-900/80 text-amber-700 dark:text-amber-300'
                : 'bg-indigo-100 dark:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300'
            }`}
          >
            {isUrgent ? 'Critical Countdown' : isApproaching ? 'Approaching' : 'On Track'}
          </span>
        </div>

        {/* Days Left Hero & Real-Time Ticking */}
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-1">
            <span
              className={`text-2xl font-black tracking-tight font-mono ${
                isUrgent
                  ? 'text-rose-600 dark:text-rose-400'
                  : isApproaching
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-indigo-600 dark:text-indigo-400'
              }`}
            >
              {time.days}
            </span>
            <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
              Days Left
            </span>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-mono text-gray-600 dark:text-gray-400 font-semibold bg-white/70 dark:bg-gray-900/60 px-2 py-0.5 rounded-md border border-black/5 dark:border-white/5">
            <span>{String(time.hours).padStart(2, '0')}h</span>
            <span className="text-gray-300 dark:text-gray-600">:</span>
            <span>{String(time.minutes).padStart(2, '0')}m</span>
            <span className="text-gray-300 dark:text-gray-600">:</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-bold">
              {String(time.seconds).padStart(2, '0')}s
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Horizontal List Row Variant
  if (size === 'list') {
    return (
      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-gray-50 dark:bg-gray-800/90 border border-gray-200/80 dark:border-gray-700/80 text-xs">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="font-bold text-gray-900 dark:text-white font-mono">
          {time.days} Days Left
        </span>
        {showSeconds && (
          <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400">
            ({String(time.hours).padStart(2, '0')}h {String(time.minutes).padStart(2, '0')}m {String(time.seconds).padStart(2, '0')}s)
          </span>
        )}
      </div>
    );
  }

  // Small Pill
  if (size === 'sm') {
    return (
      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/70 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs tracking-tight">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span>
          <strong className="text-sm font-extrabold font-mono">{time.days}</strong> days left
        </span>
        {showSeconds && (
          <span className="text-[10px] font-mono text-indigo-500/80">
            ({String(time.hours).padStart(2, '0')}h {String(time.minutes).padStart(2, '0')}m {String(time.seconds).padStart(2, '0')}s)
          </span>
        )}
      </div>
    );
  }

  // Large Hero Countdown
  if (size === 'lg') {
    return (
      <div className="flex flex-col gap-2.5 p-3.5 sm:p-4 rounded-xl bg-gray-50 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>Live Countdown: {label}</span>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Target Date: {new Date(targetDateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="flex flex-col p-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
            <span className="text-base sm:text-lg font-bold text-indigo-600 dark:text-indigo-400 tracking-tight font-mono">
              {time.days}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Days Left</span>
          </div>
          <div className="flex flex-col p-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
            <span className="text-base sm:text-lg font-bold text-purple-600 dark:text-purple-400 tracking-tight font-mono">
              {String(time.hours).padStart(2, '0')}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Hours</span>
          </div>
          <div className="flex flex-col p-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
            <span className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 tracking-tight font-mono">
              {String(time.minutes).padStart(2, '0')}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Mins</span>
          </div>
          <div className="flex flex-col p-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
            <span className="text-base sm:text-lg font-bold text-amber-600 dark:text-amber-400 tracking-tight font-mono">
              {String(time.seconds).padStart(2, '0')}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Secs</span>
          </div>
        </div>
      </div>
    );
  }

  // Medium (Default)
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/60 text-indigo-700 dark:text-indigo-300">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="text-xs font-extrabold font-mono">{time.days}d</span>
        <span className="text-[11px] text-indigo-500/80 font-mono">{String(time.hours).padStart(2, '0')}h</span>
        <span className="text-[11px] text-indigo-500/80 font-mono">{String(time.minutes).padStart(2, '0')}m</span>
        {showSeconds && (
          <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono font-bold">
            {String(time.seconds).padStart(2, '0')}s
          </span>
        )}
      </div>
    </div>
  );
};
