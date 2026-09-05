import React, { useState, useEffect } from 'react';
import { Clock, Radio, Sun, Moon, Sparkles } from 'lucide-react';
import { Sound } from '../utils/audio';

interface InteractiveClockWidgetProps {
  soundEnabled?: boolean;
  className?: string;
}

export const InteractiveClockWidget: React.FC<InteractiveClockWidgetProps> = ({
  soundEnabled = true,
  className = '',
}) => {
  const [clockMode, setClockMode] = useState<'digital' | 'analog'>(() => {
    return (localStorage.getItem('lifeos_clock_mode') as 'digital' | 'analog') || 'analog';
  });
  const [time, setTime] = useState<Date>(new Date());

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleToggleMode = () => {
    Sound.click(soundEnabled);
    setClockMode((prev) => {
      const next = prev === 'analog' ? 'digital' : 'analog';
      localStorage.setItem('lifeos_clock_mode', next);
      return next;
    });
  };

  const seconds = time.getSeconds();
  const minutes = time.getMinutes();
  const hours = time.getHours();

  // Angular degrees for analog hands
  const secondDeg = seconds * 6;
  const minuteDeg = minutes * 6 + seconds * 0.1;
  const hourDeg = (hours % 12) * 30 + minutes * 0.5;

  // Formatting for digital mode
  const hours12 = hours % 12 || 12;
  const hoursStr = String(hours12).padStart(2, '0');
  const minutesStr = String(minutes).padStart(2, '0');
  const secondsStr = String(seconds).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';

  const dayName = time.toLocaleDateString(undefined, { weekday: 'long' });
  const dateStr = time.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'IST / Local';

  return (
    <div
      className={`p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#EDECE9] dark:border-[#334155] shadow-2xs transition-all flex flex-col justify-between relative overflow-hidden ${className}`}
    >
      {/* Top Header with Mode Toggle Button */}
      <div className="flex items-center justify-between pb-2 border-b border-[#EDECE9]/60 dark:border-[#334155]/60">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-[#6366F1]">
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-[#37352F] dark:text-white uppercase tracking-wider">
              {clockMode === 'analog' ? 'Analog Clock' : 'Digital Clock'}
            </h3>
          </div>
        </div>

        {/* Toggle Analog / Digital Pill */}
        <button
          type="button"
          onClick={handleToggleMode}
          title={`Switch to ${clockMode === 'analog' ? 'Digital' : 'Analog'} mode`}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] text-[#475569] dark:text-[#CBD5E1] hover:text-[#6366F1] dark:hover:text-indigo-400 hover:border-[#6366F1] transition-all cursor-pointer shadow-2xs"
        >
          <Radio className="w-3 h-3 text-[#6366F1]" />
          <span>{clockMode === 'analog' ? 'Digital Mode' : 'Analog Mode'}</span>
        </button>
      </div>

      {/* Clock Display Area */}
      <div className="py-2 flex items-center justify-center min-h-[140px]">
        {clockMode === 'analog' ? (
          /* ================= ANALOG CLOCK ================= */
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full">
            {/* SVG Analog Clock Face */}
            <div className="relative w-32 h-32 shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm">
                {/* Clock Face Circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="46"
                  className="fill-[#F8FAFC] dark:fill-[#0F172A] stroke-[#CBD5E1] dark:stroke-[#334155]"
                  strokeWidth="2.5"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  className="fill-none stroke-[#EDECE9] dark:stroke-[#1E293B]"
                  strokeWidth="1"
                />

                {/* 12 Hour Marks */}
                {[...Array(12)].map((_, i) => {
                  const angle = (i * 30 * Math.PI) / 180;
                  const isMain = i % 3 === 0;
                  const x1 = 50 + Math.sin(angle) * (isMain ? 36 : 39);
                  const y1 = 50 - Math.cos(angle) * (isMain ? 36 : 39);
                  const x2 = 50 + Math.sin(angle) * 42;
                  const y2 = 50 - Math.cos(angle) * 42;
                  return (
                    <line
                      key={i}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      className={
                        isMain
                          ? 'stroke-[#37352F] dark:stroke-white'
                          : 'stroke-[#94A3B8] dark:stroke-[#64748B]'
                      }
                      strokeWidth={isMain ? '2' : '1'}
                      strokeLinecap="round"
                    />
                  );
                })}

                {/* Numbers 12, 3, 6, 9 */}
                <text x="50" y="20" textAnchor="middle" className="text-[7px] font-bold fill-[#37352F] dark:fill-white select-none">12</text>
                <text x="83" y="52.5" textAnchor="middle" className="text-[7px] font-bold fill-[#37352F] dark:fill-white select-none">3</text>
                <text x="50" y="85" textAnchor="middle" className="text-[7px] font-bold fill-[#37352F] dark:fill-white select-none">6</text>
                <text x="17" y="52.5" textAnchor="middle" className="text-[7px] font-bold fill-[#37352F] dark:fill-white select-none">9</text>

                {/* Hour Hand */}
                <line
                  x1="50"
                  y1="50"
                  x2="50"
                  y2="28"
                  className="stroke-[#1E293B] dark:stroke-white"
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
                  className="stroke-[#6366F1] dark:stroke-[#818CF8]"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  transform={`rotate(${minuteDeg} 50 50)`}
                />

                {/* Second Hand */}
                <line
                  x1="50"
                  y1="56"
                  x2="50"
                  y2="14"
                  className="stroke-rose-500"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  transform={`rotate(${secondDeg} 50 50)`}
                />

                {/* Center Pivot Jewel */}
                <circle cx="50" cy="50" r="3" className="fill-[#1E293B] dark:fill-white" />
                <circle cx="50" cy="50" r="1.5" className="fill-rose-500" />
              </svg>
            </div>

            {/* Time readout side-info */}
            <div className="text-center sm:text-left space-y-1">
              <div className="flex items-baseline justify-center sm:justify-start gap-1 font-mono">
                <span className="text-2xl font-extrabold text-[#37352F] dark:text-white">
                  {hoursStr}:{minutesStr}
                </span>
                <span className="text-xs font-semibold text-rose-500">
                  :{secondsStr}
                </span>
                <span className="text-xs font-bold text-[#6366F1] dark:text-indigo-400 ml-1">
                  {ampm}
                </span>
              </div>
              <p className="text-xs font-bold text-[#475569] dark:text-[#CBD5E1]">
                {dayName}
              </p>
              <p className="text-[11px] text-[#787774] dark:text-[#9CA3AF]">
                {dateStr}
              </p>
            </div>
          </div>
        ) : (
          /* ================= DIGITAL CLOCK ================= */
          <div className="flex flex-col items-center justify-center text-center space-y-2 w-full py-2">
            <div className="flex items-center justify-center gap-1.5 font-mono">
              <div className="px-3 py-2 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] shadow-2xs">
                <span className="text-3xl sm:text-4xl font-black text-[#37352F] dark:text-white tracking-tight">
                  {hoursStr}
                </span>
              </div>
              <span className="text-2xl font-bold text-[#94A3B8] animate-pulse">:</span>
              <div className="px-3 py-2 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] shadow-2xs">
                <span className="text-3xl sm:text-4xl font-black text-[#37352F] dark:text-white tracking-tight">
                  {minutesStr}
                </span>
              </div>
              <span className="text-2xl font-bold text-[#94A3B8] animate-pulse">:</span>
              <div className="px-3 py-2 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] shadow-2xs">
                <span className="text-3xl sm:text-4xl font-black text-rose-500 tracking-tight">
                  {secondsStr}
                </span>
              </div>
              <div className="flex flex-col gap-1 ml-1 text-left">
                <span className="text-xs font-extrabold text-[#6366F1] dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-900">
                  {ampm}
                </span>
                <span className="text-[9px] font-mono text-[#94A3B8] px-1">
                  {hours >= 6 && hours < 18 ? '☀️ Day' : '🌙 Night'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs font-medium text-[#64748B] dark:text-[#94A3B8] pt-1">
              <span className="font-bold text-[#37352F] dark:text-white">{dayName}</span>
              <span>•</span>
              <span>{dateStr}</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info / Timezone */}
      <div className="pt-2 border-t border-[#EDECE9]/60 dark:border-[#334155]/60 flex items-center justify-between text-[10px] text-[#787774] dark:text-[#9CA3AF]">
        <span className="font-mono">{tz}</span>
        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Live Synchronized</span>
        </span>
      </div>
    </div>
  );
};
