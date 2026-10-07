import React, { useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { ExpenseItem } from '../types';
import { Sound } from '../utils/audio';
import { isCreditTransaction, normalizeExpenseDateKey, getLocalDateKey } from '../utils/expenseUtils';

export interface SpendingCalendarGridProps {
  expenses: ExpenseItem[];
  selectedYear: number;
  selectedMonthIndex: number; // 0-11
  selectedMonthLabel: string;
  onSelectDate?: (dateKey: string) => void;
  selectedDate?: string | null;
  formatCurrency: (amount: number) => string;
  soundEnabled?: boolean;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const SpendingCalendarGrid: React.FC<SpendingCalendarGridProps> = ({
  expenses = [],
  selectedYear,
  selectedMonthIndex,
  selectedMonthLabel,
  onSelectDate,
  selectedDate,
  formatCurrency,
  soundEnabled = true,
}) => {
  const todayKey = getLocalDateKey(new Date());

  // Aggregate daily debits and counts for the month
  const dailySpendingMap = useMemo(() => {
    const map: Record<string, { debits: number; credits: number; count: number; hasCredit: boolean }> = {};

    expenses.forEach((e) => {
      const dateKey = normalizeExpenseDateKey(e.date);
      if (!dateKey) return;

      if (!map[dateKey]) {
        map[dateKey] = { debits: 0, credits: 0, count: 0, hasCredit: false };
      }

      const amt = Number(e.amount) || 0;
      if (isCreditTransaction(e)) {
        map[dateKey].credits += amt;
        map[dateKey].hasCredit = true;
      } else {
        map[dateKey].debits += amt;
      }
      map[dateKey].count += 1;
    });

    return map;
  }, [expenses]);

  // Calendar cells computation
  const { prevPaddingDays, daysInMonth, nextPaddingDays } = useMemo(() => {
    const firstDayIndex = new Date(selectedYear, selectedMonthIndex, 1).getDay(); // 0=Sun, 1=Mon...
    const totalDays = new Date(selectedYear, selectedMonthIndex + 1, 0).getDate(); // 28-31
    const prevMonthDays = new Date(selectedYear, selectedMonthIndex, 0).getDate();

    // Previous month padding days
    const prevPadding: number[] = [];
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      prevPadding.push(prevMonthDays - i);
    }

    // Days in current month
    const currentMonthDays: number[] = [];
    for (let d = 1; d <= totalDays; d++) {
      currentMonthDays.push(d);
    }

    // Next month padding to fill out complete 7-day grid rows
    const totalCellsSoFar = prevPadding.length + currentMonthDays.length;
    const remainder = totalCellsSoFar % 7;
    const nextPaddingCount = remainder === 0 ? 0 : 7 - remainder;
    const nextPadding: number[] = [];
    for (let n = 1; n <= nextPaddingCount; n++) {
      nextPadding.push(n);
    }

    return {
      prevPaddingDays: prevPadding,
      daysInMonth: currentMonthDays,
      nextPaddingDays: nextPadding,
    };
  }, [selectedYear, selectedMonthIndex]);

  const handleDayClick = (dayNum: number) => {
    Sound.click(soundEnabled);
    if (!onSelectDate) return;
    const monthStr = String(selectedMonthIndex + 1).padStart(2, '0');
    const dayStr = String(dayNum).padStart(2, '0');
    const dateKey = `${selectedYear}-${monthStr}-${dayStr}`;
    onSelectDate(dateKey);
  };

  return (
    <section
      className="bg-white dark:bg-[#1A202C] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3.5"
      data-purpose="spending-calendar-grid"
    >
      {/* Calendar Header with Title and Legend matching HTML design */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-700 dark:text-emerald-300 shrink-0">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
              Spending Calendar — {selectedMonthLabel}
            </h3>
            <p className="text-xs text-slate-400">
              Day-by-day debit heatmap &amp; recorded transaction indicators
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-3 text-xs flex-wrap">
          <div className="flex items-center space-x-1.5 text-slate-500 dark:text-slate-400">
            <span className="w-2.5 h-2.5 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800"></span>
            <span>No spend</span>
          </div>
          <div className="flex items-center space-x-1.5 text-slate-500 dark:text-slate-400">
            <span className="w-2.5 h-2.5 rounded bg-emerald-200 dark:bg-emerald-800"></span>
            <span>Low</span>
          </div>
          <div className="flex items-center space-x-1.5 text-slate-500 dark:text-slate-400">
            <span className="w-2.5 h-2.5 rounded bg-emerald-600"></span>
            <span>High spend</span>
          </div>
          <div className="flex items-center space-x-1.5 text-slate-500 dark:text-slate-400">
            <span className="w-2.5 h-2.5 rounded-full ring-2 ring-violet-500 bg-white dark:bg-[#1A202C]"></span>
            <span>Today</span>
          </div>
        </div>
      </div>

      {/* Calendar Day of Week Header */}
      <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-bold text-slate-400 uppercase">
        {DAY_NAMES.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {/* Calendar Cells Grid */}
      <div className="grid grid-cols-7 gap-2 text-xs">
        {/* Previous Month Padding */}
        {prevPaddingDays.map((pDay, idx) => (
          <div
            key={`prev-${idx}`}
            className="p-2 h-14 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/60 opacity-40 text-slate-400 text-[11px] flex items-start"
          >
            <span>{pDay}</span>
          </div>
        ))}

        {/* Days of Current Month */}
        {daysInMonth.map((dayNum) => {
          const monthStr = String(selectedMonthIndex + 1).padStart(2, '0');
          const dayStr = String(dayNum).padStart(2, '0');
          const dateKey = `${selectedYear}-${monthStr}-${dayStr}`;
          const isToday = dateKey === todayKey;
          const isSelected = selectedDate === dateKey;

          const data = dailySpendingMap[dateKey] || { debits: 0, credits: 0, count: 0, hasCredit: false };
          const hasSpend = data.debits > 0;
          const isHighSpend = data.debits >= 500;
          const isMediumSpend = data.debits > 100 && data.debits < 500;

          // Determine styling to match the reference HTML exactly
          let cellStyle = 'bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 text-slate-600 dark:text-slate-300';
          let dayNumColor = 'text-slate-600 dark:text-slate-400';
          let spendColor = 'text-slate-500 dark:text-slate-400';

          if (isToday) {
            cellStyle =
              'bg-violet-50/70 dark:bg-violet-950/40 border-2 border-violet-500 ring-2 ring-violet-200/60 dark:ring-violet-900/60 shadow-xs';
            dayNumColor = 'text-violet-700 dark:text-violet-300 font-bold';
            spendColor = 'text-violet-600 dark:text-violet-400 font-semibold';
          } else if (isHighSpend) {
            cellStyle =
              'bg-emerald-100 dark:bg-emerald-900/50 hover:bg-emerald-200/80 dark:hover:bg-emerald-800/60 border border-emerald-300 dark:border-emerald-700 shadow-xs';
            dayNumColor = 'text-emerald-950 dark:text-white font-extrabold';
            spendColor = 'text-emerald-950 dark:text-emerald-100 font-bold';
          } else if (hasSpend) {
            cellStyle =
              'bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 shadow-xs';
            dayNumColor = 'text-emerald-950 dark:text-white font-bold';
            spendColor = 'text-emerald-800 dark:text-emerald-300 font-bold';
          }

          if (isSelected && !isToday) {
            cellStyle += ' ring-2 ring-emerald-500';
          }

          return (
            <div
              key={dateKey}
              onClick={() => handleDayClick(dayNum)}
              className={`p-2 h-14 rounded-xl flex flex-col justify-between transition cursor-pointer select-none ${cellStyle}`}
              title={`${dateKey}: ₹${data.debits.toFixed(2)} debited, ${data.count} items`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[11px] ${dayNumColor}`}>{dayNum}</span>
                {isToday ? (
                  <span className="text-[9px] font-bold bg-violet-600 text-white px-1 rounded-sm">
                    Today
                  </span>
                ) : isHighSpend ? (
                  <span className="w-2 h-2 rounded-full bg-rose-500" title="High debit spend" />
                ) : hasSpend ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                ) : data.hasCredit ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Credit deposit" />
                ) : null}
              </div>

              <div className={`text-[10px] text-right truncate leading-tight ${spendColor}`}>
                {hasSpend ? (
                  <span>₹{Math.round(data.debits).toLocaleString('en-IN')}</span>
                ) : isToday ? (
                  <span>₹0</span>
                ) : null}
              </div>
            </div>
          );
        })}

        {/* Next Month Padding */}
        {nextPaddingDays.map((nDay, idx) => (
          <div
            key={`next-${idx}`}
            className="p-2 h-14 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/60 opacity-40 text-slate-400 text-[11px] flex items-start"
          >
            <span>{nDay}</span>
          </div>
        ))}
      </div>
    </section>
  );
};
