import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Globe, Sun, Moon, Clock, Compass, Layers } from 'lucide-react';
import { Sound } from '../utils/audio';

type ClockStyle = 'chronometer' | 'analog' | 'cards';

interface SoftFlipUnitProps {
  value: string;
  label: string;
}

const SoftFlipUnit: React.FC<SoftFlipUnitProps> = ({ value, label }) => {
  const [settled, setSettled] = useState(value);
  const [previous, setPrevious] = useState(value);
  const [isFlipping, setIsFlipping] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (value !== settled) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setPrevious(settled);
      setIsFlipping(true);

      timerRef.current = setTimeout(() => {
        setSettled(value);
        setIsFlipping(false);
      }, 460);

      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
  }, [value, settled]);

  const topStaticValue = isFlipping ? value : settled;
  const bottomStaticValue = isFlipping ? previous : settled;

  return (
    <div className="flex flex-col items-center select-none">
      {/* Soft Slate 3D Card (No harsh black) */}
      <div className="relative w-15 sm:w-18 md:w-20 lg:w-18 xl:w-22 h-15 sm:h-18 md:h-20 lg:h-[72px] xl:h-[78px] rounded-xl bg-white dark:bg-[#1A253A] text-slate-800 dark:text-white shadow-sm border border-slate-200 dark:border-indigo-400/30 font-mono font-black text-2xl sm:text-3xl md:text-4xl lg:text-3xl xl:text-4xl flex flex-col items-center justify-center [perspective:600px] overflow-hidden">
        {/* Top Half */}
        <div className="absolute inset-x-0 top-0 h-1/2 overflow-hidden bg-slate-50 dark:bg-[#1E2B43] flex items-end justify-center border-b border-slate-200/90 dark:border-slate-950/80">
          <span className="translate-y-1/2 leading-none text-slate-800 dark:text-white font-mono tracking-tight">
            {topStaticValue}
          </span>
        </div>

        {/* Bottom Half */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 overflow-hidden bg-white dark:bg-[#151F33] flex items-start justify-center">
          <span className="-translate-y-1/2 leading-none text-slate-800 dark:text-white font-mono tracking-tight">
            {bottomStaticValue}
          </span>
        </div>

        {/* Flipping Top */}
        {isFlipping && (
          <div className="mechanical-flap-top absolute inset-x-0 top-0 h-1/2 overflow-hidden bg-slate-100 dark:bg-[#1E2B43] flex items-end justify-center border-b border-slate-200/90 dark:border-slate-950/80 z-20">
            <span className="translate-y-1/2 leading-none text-slate-800 dark:text-white font-mono tracking-tight">
              {previous}
            </span>
            <div className="mechanical-shadow-top absolute inset-0 bg-slate-900/40 pointer-events-none" />
          </div>
        )}

        {/* Flipping Bottom */}
        {isFlipping && (
          <div className="mechanical-flap-bottom absolute inset-x-0 bottom-0 h-1/2 overflow-hidden bg-white dark:bg-[#151F33] flex items-start justify-center z-30">
            <span className="-translate-y-1/2 leading-none text-slate-800 dark:text-white font-mono tracking-tight">
              {value}
            </span>
            <div className="mechanical-highlight-bottom absolute inset-0 bg-white/20 pointer-events-none" />
          </div>
        )}

        {/* Central hairline dividing seam */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-[0.5px] h-[1px] bg-slate-300 dark:bg-slate-950/80 z-40" />
      </div>

      <span className="text-[9px] uppercase font-mono font-bold text-slate-400 dark:text-slate-400 tracking-wider mt-1">
        {label}
      </span>
    </div>
  );
};

export const FlipClock: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [time, setTime] = useState<Date>(() => new Date());
  const [clockStyle, setClockStyle] = useState<ClockStyle>(() => {
    return (localStorage.getItem('dashboard_clock_style') as ClockStyle) || 'chronometer';
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectStyle = (style: ClockStyle) => {
    Sound.click(true);
    setClockStyle(style);
    localStorage.setItem('dashboard_clock_style', style);
  };

  const hours = time.getHours();
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();

  // Strict 24-Hour Time Format
  const hoursStr = String(hours).padStart(2, '0');
  const minutesStr = String(minutes).padStart(2, '0');
  const secondsStr = String(seconds).padStart(2, '0');

  // Circadian calculations
  const totalSecondsToday = hours * 3600 + minutes * 60 + seconds;
  const dayProgress = Math.min(100, Math.max(0, Math.round((totalSecondsToday / 86400) * 100)));
  const isDaytime = hours >= 6 && hours < 18;

  // Analog angles
  const secondDeg = seconds * 6;
  const minuteDeg = minutes * 6 + seconds * 0.1;
  const hourDeg = (hours % 12) * 30 + minutes * 0.5;

  const dateStr = time.toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
  const shortTz = timezone.split('/').pop()?.replace(/_/g, ' ') || timezone;

  return (
    <div className={`flex flex-col justify-between h-full min-h-[125px] ${className}`}>
      {/* Top Meta Bar: Calendar Date, Timezone & Style Selector */}
      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-200/80 dark:border-slate-700/60 text-xs shrink-0">
        <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-white truncate">
          <Calendar className="w-3.5 h-3.5 text-[#6366F1] shrink-0" />
          <span className="truncate text-xs sm:text-[13px]">{dateStr}</span>
        </div>

        {/* Style Selector Tabs */}
        <div className="flex items-center gap-1 bg-slate-100/90 dark:bg-[#162033] p-0.5 rounded-lg border border-slate-200 dark:border-slate-700/60 shrink-0">
          <button
            type="button"
            onClick={() => handleSelectStyle('chronometer')}
            title="Precision 24H Chronometer Mode"
            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
              clockStyle === 'chronometer'
                ? 'bg-white dark:bg-[#23324C] text-[#6366F1] dark:text-indigo-300 shadow-2xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <Clock className="w-2.5 h-2.5" />
            <span>24H Chrono</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectStyle('analog')}
            title="Swiss Analog Dial Mode"
            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
              clockStyle === 'analog'
                ? 'bg-white dark:bg-[#23324C] text-[#6366F1] dark:text-indigo-300 shadow-2xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <Compass className="w-2.5 h-2.5" />
            <span>Dial</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectStyle('cards')}
            title="Soft Modern Flip Mode"
            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
              clockStyle === 'cards'
                ? 'bg-white dark:bg-[#23324C] text-[#6366F1] dark:text-indigo-300 shadow-2xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <Layers className="w-2.5 h-2.5" />
            <span>Cards</span>
          </button>
        </div>
      </div>

      {/* Main Clock Face Render Area */}
      <div className="flex-1 flex items-center justify-center py-2 my-auto">
        {/* ================================================================= */}
        {/* 1. PRECISION 24H CHRONOMETER MODE (Default, Modern & Elegant)     */}
        {/* ================================================================= */}
        {clockStyle === 'chronometer' && (
          <div className="w-full flex items-center justify-between gap-3 sm:gap-4 px-1 sm:px-2">
            {/* Bold 24H Digital Readout */}
            <div className="flex flex-col justify-center">
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl sm:text-5xl lg:text-[46px] xl:text-5xl font-mono font-black tracking-tight text-slate-800 dark:text-white tabular-nums leading-none">
                  {hoursStr}:{minutesStr}
                </span>
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/60 text-[#6366F1] dark:text-[#818CF8] border border-indigo-200/60 dark:border-indigo-800/40">
                  24H
                </span>
              </div>
              <span className="text-[10px] uppercase font-mono font-bold text-slate-500 dark:text-slate-400 tracking-wider mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                <span>Precision Time</span>
              </span>
            </div>

            {/* 60-Second Radial Chronometer Gauge (SVG) */}
            <div className="relative w-15 h-15 sm:w-16 sm:h-16 lg:w-15 lg:h-15 xl:w-16 xl:h-16 flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 44 44">
                {/* Background Ring */}
                <circle
                  cx="22"
                  cy="22"
                  r="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.2"
                  className="text-slate-200/90 dark:text-slate-700/60"
                />
                {/* Animated Seconds Progress Arc */}
                <circle
                  cx="22"
                  cy="22"
                  r="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.2"
                  strokeDasharray={113.1}
                  strokeDashoffset={113.1 * (1 - seconds / 60)}
                  strokeLinecap="round"
                  className="text-[#6366F1] dark:text-[#818CF8] transition-all duration-300 drop-shadow-[0_0_6px_rgba(99,102,241,0.5)]"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-sm sm:text-base font-mono font-black text-slate-800 dark:text-white tabular-nums leading-none">
                  {secondsStr}
                </span>
                <span className="text-[7px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tighter mt-0.5">
                  SEC
                </span>
              </div>
            </div>

            {/* Circadian Day Progress Indicator */}
            <div className="hidden sm:flex flex-1 min-w-[125px] max-w-[175px] flex-col justify-center bg-white/80 dark:bg-[#182338] rounded-xl p-2.5 border border-slate-200/80 dark:border-slate-700/60 shadow-2xs">
              <div className="flex items-center justify-between text-[11px] font-medium text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5 font-semibold text-xs">
                  {isDaytime ? (
                    <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  ) : (
                    <Moon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  )}
                  <span>{isDaytime ? 'Daytime' : 'Night'}</span>
                </span>
                <span className="font-mono text-[10px] font-bold text-[#6366F1] dark:text-[#818CF8]">
                  {dayProgress}%
                </span>
              </div>

              {/* Progress Bar of Day Elapsed */}
              <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700/80 overflow-hidden my-1.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-500 transition-all duration-1000"
                  style={{ width: `${dayProgress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 dark:text-slate-400">
                <span>00:00</span>
                <span className="truncate max-w-[70px]">{shortTz}</span>
                <span>23:59</span>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 2. SWISS ANALOG DIAL MODE                                         */}
        {/* ================================================================= */}
        {clockStyle === 'analog' && (
          <div className="w-full flex items-center justify-center gap-4 sm:gap-6 px-2">
            {/* SVG Analog Watch Face */}
            <div className="relative w-20 h-20 sm:w-22 sm:h-22 shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm">
                {/* Watch Face Disc */}
                <circle
                  cx="50"
                  cy="50"
                  r="46"
                  className="fill-white dark:fill-[#1A253A] stroke-slate-200 dark:stroke-indigo-400/30"
                  strokeWidth="2"
                />

                {/* Hour Ticks */}
                {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
                  <line
                    key={deg}
                    x1="50"
                    y1="10"
                    x2="50"
                    y2={deg % 90 === 0 ? "15" : "12"}
                    className={deg % 90 === 0 ? "stroke-slate-700 dark:stroke-slate-200" : "stroke-slate-300 dark:stroke-slate-500"}
                    strokeWidth={deg % 90 === 0 ? "2.5" : "1.2"}
                    strokeLinecap="round"
                    transform={`rotate(${deg} 50 50)`}
                  />
                ))}

                {/* Hour Hand */}
                <line
                  x1="50"
                  y1="50"
                  x2="50"
                  y2="28"
                  className="stroke-slate-800 dark:stroke-white"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  transform={`rotate(${hourDeg} 50 50)`}
                />

                {/* Minute Hand */}
                <line
                  x1="50"
                  y1="50"
                  x2="50"
                  y2="18"
                  className="stroke-slate-700 dark:stroke-slate-200"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  transform={`rotate(${minuteDeg} 50 50)`}
                />

                {/* Second Hand with Counterweight (Red/Indigo) */}
                <line
                  x1="50"
                  y1="58"
                  x2="50"
                  y2="14"
                  className="stroke-rose-500 dark:stroke-indigo-400"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  transform={`rotate(${secondDeg} 50 50)`}
                />

                {/* Center Pivot Point */}
                <circle cx="50" cy="50" r="2.5" className="fill-rose-500 dark:fill-indigo-400" />
                <circle cx="50" cy="50" r="1" className="fill-white" />
              </svg>
            </div>

            {/* Accompanying 24H Digital & Timezone Readout */}
            <div className="flex flex-col justify-center">
              <div className="text-2xl sm:text-3xl font-mono font-black text-slate-800 dark:text-white tabular-nums">
                {hoursStr}:{minutesStr}:{secondsStr}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                <Globe className="w-3 h-3 text-[#6366F1]" />
                <span className="font-semibold">{shortTz}</span>
                <span>•</span>
                <span className="font-mono text-[11px] font-bold text-[#6366F1] dark:text-[#818CF8]">{dayProgress}% of day</span>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 3. SOFT SLATE FLIP CARDS MODE (Clean & Non-Black)                 */}
        {/* ================================================================= */}
        {clockStyle === 'cards' && (
          <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 md:gap-3">
            <SoftFlipUnit value={hoursStr} label="Hours" />
            
            <div className="flex flex-col items-center justify-center gap-1.5 pb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1] dark:bg-[#818CF8] animate-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1] dark:bg-[#818CF8] animate-pulse" />
            </div>

            <SoftFlipUnit value={minutesStr} label="Minutes" />

            <div className="flex flex-col items-center justify-center gap-1.5 pb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1] dark:bg-[#818CF8] animate-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1] dark:bg-[#818CF8] animate-pulse" />
            </div>

            <SoftFlipUnit value={secondsStr} label="Seconds" />
          </div>
        )}
      </div>
    </div>
  );
};

