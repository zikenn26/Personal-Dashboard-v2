import React, { useState, useEffect } from 'react';
import { Calendar, Globe } from 'lucide-react';

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
      {/* Flip Card Unit (Dark grey in light mode, obsidian/midnight in dark mode) */}
      <div className="relative w-8 sm:w-8.5 md:w-9 h-10 sm:h-11 md:h-11.5 rounded-lg bg-[#334155] dark:bg-[#0B0F19] text-white shadow-xs border border-slate-400/50 dark:border-indigo-500/30 dark:shadow-[0_0_10px_rgba(99,102,241,0.15)] font-mono font-black text-lg sm:text-xl flex flex-col items-center justify-center select-none overflow-hidden [perspective:300px]">
        {/* Top Half (static) */}
        <div className="absolute inset-x-0 top-0 h-1/2 overflow-hidden bg-gradient-to-b from-[#475569] to-[#334155] dark:from-[#1E293B] dark:to-[#0B0F19] flex items-end justify-center border-b border-slate-700/60 dark:border-black/70">
          <span className="translate-y-1/2 leading-none text-slate-100 dark:text-white drop-shadow-xs">
            {current}
          </span>
        </div>

        {/* Bottom Half (static) */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 overflow-hidden bg-gradient-to-b from-[#253243] to-[#334155] dark:from-[#060910] dark:to-[#131B2E] flex items-start justify-center">
          <span className="-translate-y-1/2 leading-none text-slate-100 dark:text-white drop-shadow-xs">
            {current}
          </span>
        </div>

        {/* Flipping Top flap */}
        {isFlipping && (
          <div className="absolute inset-x-0 top-0 h-1/2 overflow-hidden bg-gradient-to-b from-[#475569] to-[#334155] dark:from-[#1E293B] dark:to-[#0B0F19] flex items-end justify-center border-b border-slate-700/60 dark:border-black/70 origin-bottom animate-flip-top z-10">
            <span className="translate-y-1/2 leading-none text-slate-100 dark:text-white drop-shadow-xs">
              {previous}
            </span>
          </div>
        )}

        {/* Flipping Bottom flap */}
        {isFlipping && (
          <div className="absolute inset-x-0 bottom-0 h-1/2 overflow-hidden bg-gradient-to-b from-[#253243] to-[#334155] dark:from-[#060910] dark:to-[#131B2E] flex items-start justify-center origin-top animate-flip-bottom z-10">
            <span className="-translate-y-1/2 leading-none text-slate-100 dark:text-white drop-shadow-xs">
              {current}
            </span>
          </div>
        )}

        {/* Center Split Line & Mechanical Side Notches */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-[0.5px] h-[1px] bg-slate-900/80 dark:bg-black z-20" />
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1 bg-[#1E293B] dark:bg-black rounded-r-full z-20" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-1 bg-[#1E293B] dark:bg-black rounded-l-full z-20" />
      </div>

      {label && (
        <span className="text-[8px] sm:text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider mt-0.5">
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
  });

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
  const shortTz = timezone.split('/').pop()?.replace(/_/g, ' ') || timezone;

  return (
    <div className={`flex flex-col justify-between h-full min-h-[105px] ${className}`}>
      {/* Date & Timezone Header */}
      <div className="flex items-center justify-between gap-1.5 pb-1 border-b border-[#EDECE9] dark:border-[#334155]/60 text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-[#37352F] dark:text-white truncate">
          <Calendar className="w-3.5 h-3.5 text-[#6366F1] shrink-0" />
          <span className="truncate text-[11px] sm:text-xs">{dateStr}</span>
        </div>
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] text-[10px] font-mono text-[#64748B] dark:text-[#94A3B8] shrink-0">
          <Globe className="w-2.5 h-2.5 text-[#6366F1]" />
          <span>{shortTz}</span>
        </div>
      </div>

      {/* Mechanical Flip Clock Digits (Compact & High Contrast) */}
      <div className="flex items-center justify-center gap-1 sm:gap-1.5 py-1 my-auto">
        <FlipDigit value={hoursStr} label="Hrs" />

        <div className="flex flex-col items-center justify-center gap-1 px-0.5 pb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1] dark:bg-[#818CF8] animate-pulse" />
          <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1] dark:bg-[#818CF8] animate-pulse" />
        </div>

        <FlipDigit value={minutesStr} label="Min" />

        <div className="flex flex-col items-center justify-center gap-1 px-0.5 pb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1] dark:bg-[#818CF8] animate-pulse" />
          <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1] dark:bg-[#818CF8] animate-pulse" />
        </div>

        <FlipDigit value={secondsStr} label="Sec" />

        <div className="flex flex-col items-center justify-end pb-3 pl-0.5">
          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold bg-[#6366F1] text-white shadow-2xs">
            {ampm}
          </span>
        </div>
      </div>
    </div>
  );
};
