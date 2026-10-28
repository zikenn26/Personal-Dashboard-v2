import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CalendarRange, ChevronDown, X, RotateCcw, Check, Calendar } from 'lucide-react';

export interface DateRange {
  startDate: string; // Format: YYYY-MM-DD or ''
  endDate: string;   // Format: YYYY-MM-DD or ''
}

export interface DateRangePickerProps {
  dateRange: DateRange;
  onChange: (range: DateRange) => void;
  onClear: () => void;
  isActive?: boolean;
  className?: string;
  buttonLabel?: string;
  align?: 'left' | 'right';
  compact?: boolean;
}

interface PresetOption {
  label: string;
  getRange: () => { startDate: string; endDate: string };
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  dateRange,
  onChange,
  onClear,
  isActive = false,
  className = '',
  buttonLabel,
  align = 'left',
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localStart, setLocalStart] = useState(dateRange.startDate || '');
  const [localEnd, setLocalEnd] = useState(dateRange.endDate || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync with incoming props when popover opens or prop changes
  useEffect(() => {
    setLocalStart(dateRange.startDate || '');
    setLocalEnd(dateRange.endDate || '');
    setErrorMsg(null);
  }, [dateRange.startDate, dateRange.endDate, isOpen]);

  // Click outside and escape key handling
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        return d.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: year !== new Date().getFullYear() ? 'numeric' : undefined,
        });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const getPresets = (): PresetOption[] => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    return [
      {
        label: 'Today',
        getRange: () => {
          const s = toYMD(today);
          return { startDate: s, endDate: s };
        },
      },
      {
        label: 'Yesterday',
        getRange: () => {
          const y = new Date(today);
          y.setDate(today.getDate() - 1);
          const s = toYMD(y);
          return { startDate: s, endDate: s };
        },
      },
      {
        label: 'Last 7 Days',
        getRange: () => {
          const start = new Date(today);
          start.setDate(today.getDate() - 6);
          return { startDate: toYMD(start), endDate: toYMD(today) };
        },
      },
      {
        label: 'Last 30 Days',
        getRange: () => {
          const start = new Date(today);
          start.setDate(today.getDate() - 29);
          return { startDate: toYMD(start), endDate: toYMD(today) };
        },
      },
      {
        label: 'This Month',
        getRange: () => {
          const start = new Date(today.getFullYear(), today.getMonth(), 1);
          const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          return { startDate: toYMD(start), endDate: toYMD(end) };
        },
      },
      {
        label: 'Last Month',
        getRange: () => {
          const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          const end = new Date(today.getFullYear(), today.getMonth(), 0);
          return { startDate: toYMD(start), endDate: toYMD(end) };
        },
      },
      {
        label: 'This Year',
        getRange: () => {
          const start = new Date(today.getFullYear(), 0, 1);
          return { startDate: toYMD(start), endDate: toYMD(today) };
        },
      },
    ];
  };

  const handleApply = () => {
    if (!localStart && !localEnd) {
      setErrorMsg('Please select at least a start or end date.');
      return;
    }
    if (localStart && localEnd && localStart > localEnd) {
      setErrorMsg('Start date cannot be later than end date.');
      return;
    }
    setErrorMsg(null);
    onChange({ startDate: localStart, endDate: localEnd });
    setIsOpen(false);
  };

  const handlePresetSelect = (preset: PresetOption) => {
    const range = preset.getRange();
    setLocalStart(range.startDate);
    setLocalEnd(range.endDate);
    setErrorMsg(null);
    onChange(range);
    setIsOpen(false);
  };

  const handleClear = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setLocalStart('');
    setLocalEnd('');
    setErrorMsg(null);
    onClear();
    setIsOpen(false);
  };

  // Determine button title / trigger label
  const hasRange = Boolean(dateRange.startDate || dateRange.endDate);
  const triggerLabel = hasRange
    ? dateRange.startDate && dateRange.endDate
      ? `${formatDateDisplay(dateRange.startDate)} – ${formatDateDisplay(dateRange.endDate)}`
      : dateRange.startDate
      ? `From ${formatDateDisplay(dateRange.startDate)}`
      : `Until ${formatDateDisplay(dateRange.endDate)}`
    : buttonLabel || 'Date Range';

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      {/* Trigger Button */}
      <div className="inline-flex items-center">
        <button
          type="button"
          id="btn-expense-date-range-picker"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`group flex items-center gap-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            compact ? 'px-2.5 py-1' : 'px-3 py-1'
          } ${
            isActive || hasRange
              ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-300 dark:border-purple-700 shadow-2xs'
              : 'bg-gray-50 dark:bg-[#242C3D] text-[#787774] dark:text-[#9CA3AF] hover:bg-gray-100 dark:hover:bg-[#2D3748] border border-transparent hover:border-gray-200 dark:hover:border-gray-700'
          }`}
          title="Filter spending by date range"
        >
          <CalendarRange
            className={`w-3.5 h-3.5 shrink-0 transition-transform ${
              isActive || hasRange
                ? 'text-purple-600 dark:text-purple-400'
                : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'
            }`}
          />
          <span className="max-w-[150px] sm:max-w-[210px] truncate">{triggerLabel}</span>
          <ChevronDown
            className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-purple-600 dark:text-purple-400' : ''
            }`}
          />
        </button>

        {/* Quick clear button directly on trigger when active */}
        {(isActive || hasRange) && (
          <button
            type="button"
            onClick={handleClear}
            className="ml-1 p-1 rounded-full text-purple-500 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-200 hover:bg-purple-200/50 dark:hover:bg-purple-900/50 transition-colors cursor-pointer"
            title="Clear date range filter"
            aria-label="Clear date range filter"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Popover Card */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className={`absolute z-50 mt-2 w-[320px] sm:w-[350px] p-4 bg-white dark:bg-[#1A202C] rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 text-[#37352F] dark:text-white ${
              align === 'right' ? 'right-0' : 'left-0 sm:left-auto'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold leading-none">Filter Spending by Date</h4>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                    Select a preset or custom date span
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick Presets */}
            <div className="pt-3 pb-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 block mb-1.5">
                Quick Presets
              </span>
              <div className="flex flex-wrap gap-1.5">
                {getPresets().map((preset) => {
                  const pRange = preset.getRange();
                  const isSelected =
                    localStart === pRange.startDate && localEnd === pRange.endDate;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handlePresetSelect(preset)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-purple-600 text-white font-semibold shadow-xs'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-950/40 dark:hover:text-purple-300'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Manual Date Inputs */}
            <div className="space-y-2.5 pt-2 border-t border-gray-100 dark:border-gray-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 block">
                Custom Range
              </span>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 block mb-1">
                    From
                  </label>
                  <input
                    type="date"
                    value={localStart}
                    onChange={(e) => {
                      setLocalStart(e.target.value);
                      setErrorMsg(null);
                    }}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 block mb-1">
                    To
                  </label>
                  <input
                    type="date"
                    value={localEnd}
                    onChange={(e) => {
                      setLocalEnd(e.target.value);
                      setErrorMsg(null);
                    }}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800 dark:text-gray-100"
                  />
                </div>
              </div>

              {errorMsg && (
                <p className="text-[11px] text-rose-500 font-medium pt-0.5">{errorMsg}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={handleClear}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>

              <button
                type="button"
                onClick={handleApply}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 shadow-sm transition-colors cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Apply Filter</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
