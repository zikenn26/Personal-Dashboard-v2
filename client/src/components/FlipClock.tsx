import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Globe } from 'lucide-react';

interface FlipDigitProps {
  value: string;
  label?: string;
}

const FlipDigit: React.FC<FlipDigitProps> = ({ value, label }) => {
  const [current, setCurrent] = useState(value);
  const [previous, setPrevious] = useState(value);
  const [isFlipping, setIsFlipping] = useState(false);

  useEffect(() => {
    if (value !== current) {
      setPrevious(current);
      setCurrent(value);
      setIsFlipping(true);
      const timer = setTimeout(() => {
        setIsFlipping(false);
      }, 550);
      return () => clearTimeout(timer);
    }
  }, [value, current]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-10 sm:w-11 md:w-12 h-12 sm:h-13 md:h-14 rounded-lg bg-[#0F172A] text-white shadow-md border border-slate-700/80 font-mono font-extrabold text-xl sm:text-2xl flex flex-col items-center justify-center select-none overflow-hidden [perspective:350px]">
        {/* Top Half (static next/current) */}
        <div className="absolute inset-x-0 top-0 h-1/2 overflow-hidden bg-gradient-to-b from-[#1E293B] to-[#0F172A] flex items-end justify-center border-b border-black/50">
          <span className="translate-y-1/2 leading-none text-slate-100 drop-shadow-xs">{current}</span>
        </div>

        {/* Bottom Half (static next/current) */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 overflow-hidden bg-gradient-to-b from-[#0F172A] to-[#1E293B] flex items-start justify-center">
          <span className="-translate-y-1/2 leading-none text-slate-100 drop-shadow-xs">{current}</span>
        </div>

        {/* Flipping Top flap (folds down from top) */}
        {isFlipping && (
          <div className="absolute inset-x-0 top-0 h-1/2 overflow-hidden bg-gradient-to-b from-[#1E293B] to-[#0F172A] flex items-end justify-center border-b border-black/50 origin-bottom animate-flip-top z-10">
            <span className="translate-y-1/2 leading-none text-slate-100 drop-shadow-xs">{previous}</span>
          </div>
        )}

        {/* Flipping Bottom flap (reveals from top) */}
        {isFlipping && (
          <div className="absolute inset-x-0 bottom-0 h-1/2 overflow-hidden bg-gradient-to-b from-[#0F172A] to-[#1E293B] flex items-start justify-center origin-top animate-flip-bottom z-10">
            <span className="-translate-y-1/2 leading-none text-slate-100 drop-shadow-xs">{current}</span>
          </div>
        )}

        {/* Center Split Notch & Line */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-[0.5px] h-[1px] bg-black/70 z-20" />
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1 bg-slate-900 rounded-r-full z-20" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-1 bg-slate-900 rounded-l-full z-20" />
      </div>

      {label && (
        <span className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider mt-1">
          {label}
        </span>
      )}
    </div>
  );
};

export const FlipClock: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const rawHours = time.getHours();
  const hours12 = rawHours % 12 || 12;
  const hoursStr = String(hours12).padStart(2, '0');
  const minutesStr = String(time.getMinutes()).padStart(2, '0');
  const secondsStr = String(time.getSeconds()).padStart(2, '0');
  const ampm = rawHours >= 12 ? 'PM' : 'AM';

  const dateStr = time.toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
  const shortTz = timezone.split('/').pop()?.replace(/_/g, ' ') || timezone;

  return (
    <div className={`flex flex-col justify-between h-full min-h-[120px] ${className}`}>
      {/* Date & Timezone Header */}
      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[#EDECE9] dark:border-[#334155]/60 text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-[#37352F] dark:text-white truncate">
          <Calendar className="w-3.5 h-3.5 text-[#6366F1] shrink-0" />
          <span className="truncate">{dateStr}</span>
        </div>
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] text-[10px] font-mono text-[#64748B] dark:text-[#94A3B8] shrink-0">
          <Globe className="w-2.5 h-2.5 text-[#6366F1]" />
          <span>{shortTz}</span>
        </div>
      </div>

      {/* Mechanical Flip Clock Digits */}
      <div className="flex items-center justify-center gap-1.5 sm:gap-2 py-1 my-auto">
        <FlipDigit value={hoursStr} label="Hours" />

        <div className="flex flex-col items-center justify-center gap-1.5 px-0.5 pb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1] dark:bg-[#818CF8] animate-pulse" />
          <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1] dark:bg-[#818CF8] animate-pulse" />
        </div>

        <FlipDigit value={minutesStr} label="Mins" />

        <div className="flex flex-col items-center justify-center gap-1.5 px-0.5 pb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1] dark:bg-[#818CF8] animate-pulse" />
          <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1] dark:bg-[#818CF8] animate-pulse" />
        </div>

        <FlipDigit value={secondsStr} label="Secs" />

        <div className="flex flex-col items-center justify-end pb-4 pl-1">
          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#6366F1] text-white shadow-2xs">
            {ampm}
          </span>
        </div>
      </div>
    </div>
  );
};
