import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Globe, Bell, BellRing, Trash2, X, Check, Volume2, RotateCcw, Clock } from 'lucide-react';
import { Sound } from '../utils/audio';

type ClockStyle = 'chronometer' | 'analog' | 'cards';

interface QuickAlarm {
  id: string;
  targetTimestamp: number; // Unix epoch ms
  targetTimeStr: string;   // "14:35"
  label: string;           // "Quick Alert"
  createdTimestamp: number;// when the alarm was scheduled (for timeline progress)
}

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
      {/* Soft Slate 3D Card */}
      <div className="relative w-12 sm:w-14 md:w-15 lg:w-12 xl:w-14 h-12 sm:h-13 md:h-15 lg:h-[52px] xl:h-[58px] rounded-lg bg-white dark:bg-[#1A253A] text-slate-800 dark:text-white shadow-2xs border border-slate-200 dark:border-indigo-400/30 font-mono font-black text-xl sm:text-2xl lg:text-xl xl:text-2xl flex flex-col items-center justify-center [perspective:600px] overflow-hidden">
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

      <span className="text-[8px] sm:text-[9px] uppercase font-mono font-bold text-slate-400 dark:text-slate-400 tracking-wider mt-0.5">
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

  // Alarm State (Simple, robust, inline)
  const [showAlarmModal, setShowAlarmModal] = useState<boolean>(false);
  const [activeAlarm, setActiveAlarm] = useState<QuickAlarm | null>(() => {
    try {
      const saved = localStorage.getItem('dashboard_quick_alarm');
      if (saved) {
        const parsed: QuickAlarm = JSON.parse(saved);
        if (parsed && parsed.targetTimestamp > Date.now()) {
          return parsed;
        }
      }
    } catch {
      // Ignore
    }
    return null;
  });

  const [ringingAlarm, setRingingAlarm] = useState<QuickAlarm | null>(null);
  
  // Specific Time selection state (e.g. "14:30")
  const [selectedTime, setSelectedTime] = useState<string>(() => {
    const nextHour = (new Date().getHours() + 1) % 24;
    return `${String(nextHour).padStart(2, '0')}:00`;
  });

  // Configurable snooze interval (5 or 10 minutes)
  const [snoozeInterval, setSnoozeInterval] = useState<number>(() => {
    const saved = localStorage.getItem('dashboard_alarm_snooze_interval');
    return saved ? parseInt(saved, 10) : 5;
  });

  const [alarmLabel, setAlarmLabel] = useState<string>('');
  const [notificationPermission, setNotificationPermission] = useState<string>(() => {
    return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';
  });

  // Clock tick & Alarm monitor (Every second)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setTime(now);

      // Check if scheduled alarm has arrived
      if (activeAlarm && now.getTime() >= activeAlarm.targetTimestamp) {
        triggerAlarm(activeAlarm);
        setActiveAlarm(null);
        localStorage.removeItem('dashboard_quick_alarm');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeAlarm]);

  // Periodic gentle chime when alarm is ringing
  useEffect(() => {
    if (!ringingAlarm) return;
    let chimeCount = 0;
    const chimeInterval = setInterval(() => {
      chimeCount++;
      if (chimeCount <= 5) {
        Sound.softAlarm(true);
      } else {
        clearInterval(chimeInterval);
      }
    }, 3600);

    return () => clearInterval(chimeInterval);
  }, [ringingAlarm]);

  const triggerAlarm = (alarm: QuickAlarm) => {
    setRingingAlarm(alarm);
    Sound.softAlarm(true);

    // Browser Notification
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          new Notification(`⏰ ${alarm.label || 'Alarm!'}`, {
            body: `It is now ${alarm.targetTimeStr}. Your scheduled alert has arrived!`,
            icon: '/favicon.ico',
          });
        } catch {
          // Ignore
        }
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().then((perm) => {
          setNotificationPermission(perm);
          if (perm === 'granted') {
            try {
              new Notification(`⏰ ${alarm.label || 'Alarm!'}`, {
                body: `It is now ${alarm.targetTimeStr}. Your scheduled alert has arrived!`,
              });
            } catch {
              // Ignore
            }
          }
        }).catch(() => {});
      }
    }
  };

  const handleRequestNotificationPermission = () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      Notification.requestPermission().then((perm) => {
        setNotificationPermission(perm);
        if (perm === 'granted') {
          Sound.success(true);
        }
      }).catch(() => {});
    }
  };

  // Set alarm from Suggested Minutes preset (e.g. +5m, +10m, +15m, +25m, +45m)
  const handleSetMinutePreset = (minutes: number) => {
    const now = Date.now();
    const targetTimestamp = now + minutes * 60 * 1000;
    const targetDate = new Date(targetTimestamp);
    const targetTimeStr = `${String(targetDate.getHours()).padStart(2, '0')}:${String(targetDate.getMinutes()).padStart(2, '0')}`;
    
    const newAlarm: QuickAlarm = {
      id: now.toString(),
      targetTimestamp,
      targetTimeStr,
      label: alarmLabel.trim() || `In ${minutes}m`,
      createdTimestamp: now,
    };

    setActiveAlarm(newAlarm);
    localStorage.setItem('dashboard_quick_alarm', JSON.stringify(newAlarm));
    Sound.success(true);
    setShowAlarmModal(false);
    setAlarmLabel('');

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((perm) => setNotificationPermission(perm)).catch(() => {});
    }
  };

  // Set alarm for a Specific Time (e.g. "14:30")
  const handleSetSpecificTime = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTime) return;

    const [hStr, mStr] = selectedTime.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);

    const now = new Date();
    const targetDate = new Date(now);
    targetDate.setHours(h, m, 0, 0);

    // If time is already past today, set for tomorrow
    if (targetDate.getTime() <= now.getTime()) {
      targetDate.setDate(targetDate.getDate() + 1);
    }

    const newAlarm: QuickAlarm = {
      id: Date.now().toString(),
      targetTimestamp: targetDate.getTime(),
      targetTimeStr: selectedTime,
      label: alarmLabel.trim() || 'Scheduled Alarm',
      createdTimestamp: Date.now(),
    };

    setActiveAlarm(newAlarm);
    localStorage.setItem('dashboard_quick_alarm', JSON.stringify(newAlarm));
    Sound.success(true);
    setShowAlarmModal(false);
    setAlarmLabel('');

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((perm) => setNotificationPermission(perm)).catch(() => {});
    }
  };

  // Delete / Cancel ongoing alarm
  const handleCancelAlarm = () => {
    setActiveAlarm(null);
    localStorage.removeItem('dashboard_quick_alarm');
    Sound.click(true);
  };

  const handleDismissRinging = () => {
    setRingingAlarm(null);
    Sound.click(true);
  };

  // Snooze function: automatically delays by the configured 5-10 minute interval
  const handleSnooze = (overrideMinutes?: number) => {
    const mins = overrideMinutes || snoozeInterval || 5;
    const now = Date.now();
    const targetTimestamp = now + mins * 60 * 1000;
    const targetDate = new Date(targetTimestamp);
    const targetTimeStr = `${String(targetDate.getHours()).padStart(2, '0')}:${String(targetDate.getMinutes()).padStart(2, '0')}`;

    const newAlarm: QuickAlarm = {
      id: now.toString(),
      targetTimestamp,
      targetTimeStr,
      label: ringingAlarm?.label ? `(Snoozed ${mins}m) ${ringingAlarm.label}` : `Snoozed (${mins}m)`,
      createdTimestamp: now,
    };

    setActiveAlarm(newAlarm);
    localStorage.setItem('dashboard_quick_alarm', JSON.stringify(newAlarm));
    setRingingAlarm(null);
    Sound.success(true);
  };

  const handleUpdateSnoozeInterval = (val: number) => {
    setSnoozeInterval(val);
    localStorage.setItem('dashboard_alarm_snooze_interval', val.toString());
    Sound.click(true);
  };

  // Toggle clock format by clicking anywhere on the clock
  const cycleClockStyle = () => {
    Sound.click(true);
    setClockStyle((prev) => {
      const next = prev === 'chronometer' ? 'analog' : prev === 'analog' ? 'cards' : 'chronometer';
      localStorage.setItem('dashboard_clock_style', next);
      return next;
    });
  };

  const hours = time.getHours();
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();

  // Strict 24-Hour Time Format
  const hoursStr = String(hours).padStart(2, '0');
  const minutesStr = String(minutes).padStart(2, '0');
  const secondsStr = String(seconds).padStart(2, '0');

  // Analog angles
  const secondDeg = seconds * 6;
  const minuteDeg = minutes * 6 + seconds * 0.1;
  const hourDeg = (hours % 12) * 30 + minutes * 0.5;

  const dateStr = time.toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
  const shortTz = timezone.split('/').pop()?.replace(/_/g, ' ') || timezone;

  // Active alarm remaining time calculation
  const remainingMs = activeAlarm ? Math.max(0, activeAlarm.targetTimestamp - time.getTime()) : 0;
  const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
  const remainingHours = Math.floor(remainingMinutes / 60);
  const remainingMinsFormatted = remainingHours > 0 
    ? `${remainingHours}h ${remainingMinutes % 60}m` 
    : `${remainingMinutes}m`;

  // Timeline progress calculation (0% to 100%)
  const timelineProgress = activeAlarm ? (() => {
    const totalDuration = activeAlarm.targetTimestamp - (activeAlarm.createdTimestamp || (activeAlarm.targetTimestamp - 60 * 60 * 1000));
    const elapsed = time.getTime() - (activeAlarm.createdTimestamp || (activeAlarm.targetTimestamp - 60 * 60 * 1000));
    if (totalDuration <= 0) return 100;
    return Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));
  })() : 0;

  return (
    <div className={`relative flex flex-col justify-between h-full min-h-[125px] ${className}`}>
      {/* ========================================================================= */}
      {/* TOP META BAR: Calendar Date + Active Alarm Indicator & Action             */}
      {/* ========================================================================= */}
      <div className="flex items-center justify-between gap-1.5 pb-1 border-b border-slate-200/80 dark:border-slate-700/60 text-xs shrink-0 z-10">
        {/* Calendar Date */}
        <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-white truncate">
          <Calendar className="w-3.5 h-3.5 text-[#6366F1] shrink-0" />
          <span className="truncate text-xs sm:text-[13px]">{dateStr}</span>
        </div>

        {/* Right Actions: Active Alarm Pill & Trigger */}
        <div className="flex items-center gap-1.5 shrink-0">
          {activeAlarm ? (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800/60 text-[10px] font-mono font-bold text-[#6366F1] dark:text-[#818CF8]">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAlarmModal(true);
                }}
                title={`Alarm set for ${activeAlarm.targetTimeStr} (${remainingMinsFormatted} left) • Click to edit`}
                className="flex items-center gap-1 hover:underline cursor-pointer"
              >
                <BellRing className="w-2.5 h-2.5 animate-bounce text-[#6366F1] dark:text-[#818CF8]" />
                <span>{activeAlarm.targetTimeStr}</span>
                <span className="text-[9px] opacity-75">({remainingMinsFormatted})</span>
              </button>
              
              {/* Direct 1-click Delete Button for ongoing alarm */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancelAlarm();
                }}
                title="Delete this ongoing alarm"
                className="p-0.5 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-100/60 dark:hover:bg-rose-950/60 transition-colors cursor-pointer"
              >
                <Trash2 className="w-2.5 h-2.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowAlarmModal(true);
              }}
              title="Set alarm or timer"
              className="p-1 rounded-md text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5" />
            </button>
          )}

          {/* 24H Badge */}
          <div className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/50">
            24H
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MAIN CLOCK DISPLAY (Clicking anywhere toggles clock format seamlessly)   */}
      {/* ========================================================================= */}
      <div
        onClick={cycleClockStyle}
        title="Click to toggle clock style (Chrono / Analog / Cards)"
        className="flex-1 flex items-center justify-center py-1.5 my-auto cursor-pointer group transition-transform active:scale-[0.99] select-none"
      >
        {/* ================================================================= */}
        {/* 1. PRECISION 24H CHRONOMETER MODE (Compact & Clean)               */}
        {/* ================================================================= */}
        {clockStyle === 'chronometer' && (
          <div className="w-full flex items-center justify-center gap-4 sm:gap-6 px-1">
            {/* Bold 24H Digital Readout */}
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl sm:text-4xl lg:text-3xl xl:text-4xl font-mono font-black tracking-tight text-slate-800 dark:text-white tabular-nums leading-none group-hover:text-[#6366F1] dark:group-hover:text-indigo-400 transition-colors">
                {hoursStr}:{minutesStr}
              </span>
            </div>

            {/* 60-Second Radial Chronometer Gauge (SVG) */}
            <div className="relative w-12 h-12 sm:w-14 sm:h-14 lg:w-12 lg:h-12 xl:w-13 xl:h-13 flex items-center justify-center shrink-0">
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
                <span className="text-xs sm:text-sm font-mono font-black text-slate-800 dark:text-white tabular-nums leading-none">
                  {secondsStr}
                </span>
                <span className="text-[7px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-tighter mt-0.5">
                  SEC
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 2. SWISS ANALOG DIAL MODE (Clean, No Extra Daytime/Precision)     */}
        {/* ================================================================= */}
        {clockStyle === 'analog' && (
          <div className="w-full flex items-center justify-center gap-3.5 sm:gap-4 px-1">
            {/* SVG Analog Watch Face */}
            <div className="relative w-16 h-16 sm:w-18 sm:h-18 lg:w-16 lg:h-16 xl:w-18 xl:h-18 shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-2xs">
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

                {/* Second Hand with Counterweight */}
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

            {/* Accompanying 24H Digital Readout */}
            <div className="flex flex-col justify-center">
              <div className="text-xl sm:text-2xl font-mono font-black text-slate-800 dark:text-white tabular-nums group-hover:text-[#6366F1] dark:group-hover:text-indigo-400 transition-colors">
                {hoursStr}:{minutesStr}:{secondsStr}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                <Globe className="w-2.5 h-2.5 text-[#6366F1] shrink-0" />
                <span className="truncate max-w-[90px]">{shortTz}</span>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 3. SOFT SLATE FLIP CARDS MODE (Clean & Proportional)              */}
        {/* ================================================================= */}
        {clockStyle === 'cards' && (
          <div className="flex items-center justify-center gap-1 sm:gap-1.5 md:gap-2">
            <SoftFlipUnit value={hoursStr} label="Hours" />

            <div className="flex flex-col items-center justify-center gap-1 pb-2">
              <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-[#6366F1] dark:bg-[#818CF8] animate-pulse" />
              <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-[#6366F1] dark:bg-[#818CF8] animate-pulse" />
            </div>

            <SoftFlipUnit value={minutesStr} label="Mins" />

            <div className="flex flex-col items-center justify-center gap-1 pb-2">
              <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-[#6366F1] dark:bg-[#818CF8] animate-pulse" />
              <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-[#6366F1] dark:bg-[#818CF8] animate-pulse" />
            </div>

            <SoftFlipUnit value={secondsStr} label="Secs" />
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* VISUAL TIMELINE INDICATOR: Displays Upcoming Scheduled Alarms at a glance */}
      {/* ========================================================================= */}
      <div className="pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
        {activeAlarm ? (
          <div className="space-y-1">
            {/* Timeline header: Now -> Target Alarm */}
            <div className="flex items-center justify-between text-[10px] font-mono leading-none">
              <span className="text-slate-400 dark:text-slate-500">
                Now {hoursStr}:{minutesStr}
              </span>
              <div className="flex items-center gap-1 font-bold text-[#6366F1] dark:text-[#818CF8]">
                <BellRing className="w-2.5 h-2.5 animate-pulse" />
                <span>{activeAlarm.targetTimeStr}</span>
                <span className="text-slate-400 font-normal">({remainingMinsFormatted})</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancelAlarm();
                  }}
                  title="Delete scheduled alarm"
                  className="p-0.5 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer ml-0.5"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>

            {/* Visual Timeline Bar with Progress & Target Pin */}
            <div className="relative w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              {/* Progress track */}
              <div
                className="h-full bg-gradient-to-r from-indigo-400 to-[#6366F1] dark:from-indigo-600 dark:to-[#818CF8] rounded-full transition-all duration-500"
                style={{ width: `${Math.max(8, timelineProgress)}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 dark:text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-2.5 h-2.5 text-slate-400" />
              <span>Timeline: No alarms active</span>
            </span>
            <button
              type="button"
              onClick={() => setShowAlarmModal(true)}
              className="text-[#6366F1] dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
            >
              + Set Alarm
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SIMPLE INLINE ALARM CONFIGURATION DRAWER                                  */}
      {/* ========================================================================= */}
      {showAlarmModal && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 z-30 rounded-2xl bg-white/95 dark:bg-[#1A253A]/95 backdrop-blur-md p-3 flex flex-col justify-between shadow-xl border border-indigo-200 dark:border-indigo-800/50 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-700/60">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-white">
              <Bell className="w-3.5 h-3.5 text-[#6366F1]" />
              <span>Set Alarm</span>
            </div>
            <button
              type="button"
              onClick={() => setShowAlarmModal(false)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* If an alarm is already running, show ongoing info with Delete button */}
          {activeAlarm ? (
            <div className="flex-1 flex flex-col justify-center py-2 text-center gap-1.5">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Ongoing alarm scheduled for:
              </div>
              <div className="text-2xl font-mono font-black text-[#6366F1] dark:text-indigo-400">
                {activeAlarm.targetTimeStr}
                <span className="text-xs font-normal text-slate-400 ml-1.5">
                  ({remainingMinsFormatted} left)
                </span>
              </div>
              {activeAlarm.label && (
                <div className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate px-2">
                  "{activeAlarm.label}"
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={handleCancelAlarm}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete Alarm</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAlarmModal(false)}
                  className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer transition-colors"
                >
                  Keep Running
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between py-1 gap-2">
              {/* 1. PRESENT SUGGESTED MINUTES PRESETS */}
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Quick Suggested Minutes
                </span>
                <div className="grid grid-cols-5 gap-1">
                  {[5, 10, 15, 25, 45].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => handleSetMinutePreset(mins)}
                      className="py-1 px-0.5 rounded-md text-[11px] font-mono font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/80 text-slate-700 dark:text-slate-200 hover:text-[#6366F1] dark:hover:text-indigo-300 border border-slate-200/80 dark:border-slate-700/60 transition-colors cursor-pointer text-center"
                    >
                      +{mins}m
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. NEW FEATURE: SELECT SPECIFIC TIME FOR ALARM */}
              <form onSubmit={handleSetSpecificTime} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 space-y-1.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Select Specific Time (24H)
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="time"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="flex-1 px-2 py-1 text-xs font-mono font-bold rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1 text-xs font-semibold rounded-md bg-[#6366F1] hover:bg-[#4F46E5] text-white transition-colors cursor-pointer shrink-0"
                  >
                    Set Time
                  </button>
                </div>
              </form>

              {/* 3. SNOOZE INTERVAL CONFIGURATION (5 or 10 min) */}
              <div className="flex items-center justify-between px-1 text-[10px]">
                <span className="text-slate-500 dark:text-slate-400 font-medium">
                  Snooze interval:
                </span>
                <div className="flex items-center gap-1">
                  {[5, 10].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => handleUpdateSnoozeInterval(mins)}
                      className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold transition-all cursor-pointer ${
                        snoozeInterval === mins
                          ? 'bg-[#6366F1] text-white shadow-2xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {mins} min
                    </button>
                  ))}
                </div>
              </div>

              {/* Browser Notification Permission Hint */}
              <div className="flex items-center justify-between text-[9px] text-slate-400 dark:text-slate-500 pt-0.5 border-t border-slate-200/50 dark:border-slate-800/40">
                <span className="flex items-center gap-1">
                  <Volume2 className="w-2.5 h-2.5 text-indigo-500" />
                  <span>Soft chime + push alert</span>
                </span>
                {notificationPermission !== 'granted' && (
                  <button
                    type="button"
                    onClick={handleRequestNotificationPermission}
                    className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
                  >
                    Allow notifications
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ACTIVE RINGING ALERT MODAL OVERLAY (With Stop, Configurable Snooze & Delete)*/}
      {/* ========================================================================= */}
      {ringingAlarm && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 z-40 rounded-2xl bg-indigo-900/95 text-white backdrop-blur-md p-3 flex flex-col justify-between shadow-2xl border-2 border-indigo-400 animate-in fade-in zoom-in-95 duration-200"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-200">
              <BellRing className="w-4 h-4 animate-bounce text-amber-300" />
              <span>Alert Triggered</span>
            </div>
            <button
              type="button"
              onClick={handleDismissRinging}
              className="p-1 rounded-md text-indigo-200 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="text-center py-1">
            <div className="text-2xl font-mono font-black tracking-tight text-white">
              {ringingAlarm.targetTimeStr}
            </div>
            <div className="text-xs text-indigo-100 font-medium truncate mt-0.5">
              {ringingAlarm.label || 'Scheduled reminder'}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Stop / Dismiss */}
            <button
              type="button"
              onClick={handleDismissRinging}
              className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-white text-indigo-900 hover:bg-indigo-50 shadow-sm cursor-pointer transition-colors flex items-center justify-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Dismiss</span>
            </button>

            {/* Configurable Snooze Button (delays by configured 5-10 min interval) */}
            <button
              type="button"
              onClick={() => handleSnooze(snoozeInterval)}
              title={`Snooze for ${snoozeInterval} minutes`}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/20 cursor-pointer transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Snooze +{snoozeInterval}m</span>
            </button>

            {/* Delete ongoing alarm */}
            <button
              type="button"
              onClick={() => {
                setRingingAlarm(null);
                handleCancelAlarm();
              }}
              title="Delete alarm completely"
              className="p-1.5 rounded-lg text-rose-300 hover:text-rose-100 hover:bg-rose-500/30 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
