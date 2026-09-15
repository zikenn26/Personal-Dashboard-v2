import React, { useState, useMemo } from 'react';
import {
  PieChart as PieChartIcon,
  TrendingUp,
  Tag,
  Sparkles,
} from 'lucide-react';
import { ExpenseItem } from '../types';
import { Sound } from '../utils/audio';

export interface ExpenseDistributionSectionProps {
  expenses: ExpenseItem[];
  selectedYear: number;
  selectedMonthIndex: number;
  selectedMonthLabel: string;
  formatCurrency: (amount: number) => string;
  soundEnabled: boolean;
}

interface CategoryDataPoint {
  name: string;
  amount: number;
  percent: number;
  color: string;
  icon: string;
}

const CATEGORY_PALETTE: Record<string, { color: string; icon: string }> = {
  'Food & Dining': { color: '#8B5CF6', icon: '🍽️' },
  'Snacks & Coffee': { color: '#EC4899', icon: '☕' },
  'Shopping': { color: '#3B82F6', icon: '🛍️' },
  'Transportation': { color: '#F59E0B', icon: '🚗' },
  'Groceries': { color: '#10B981', icon: '🥦' },
  'Electronics & Gadgets': { color: '#6366F1', icon: '💻' },
  'Bills & Utilities': { color: '#EF4444', icon: '⚡' },
  'Entertainment': { color: '#A855F7', icon: '🎬' },
  'Health & Medical': { color: '#14B8A6', icon: '💊' },
  'Education & Learning': { color: '#06B6D4', icon: '🎓' },
  'Personal Care': { color: '#F43F5E', icon: '✨' },
  'Travel & Leisure': { color: '#0EA5E9', icon: '✈️' },
  'Investment & Savings': { color: '#059669', icon: '📈' },
  'Others': { color: '#64748B', icon: '🏷️' },
};

const DEFAULT_COLORS = [
  '#8B5CF6',
  '#EC4899',
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#06B6D4',
  '#EF4444',
  '#6366F1',
  '#14B8A6',
  '#F43F5E',
];

export const ExpenseDistributionSection: React.FC<ExpenseDistributionSectionProps> = ({
  expenses = [],
  selectedYear,
  selectedMonthIndex,
  selectedMonthLabel,
  formatCurrency,
  soundEnabled,
}) => {
  const [scope, setScope] = useState<'month' | 'all'>('month');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Filter expenses by selected scope (current month vs all time) safely
  const filteredExpenses = useMemo(() => {
    if (!Array.isArray(expenses)) return [];
    if (scope === 'month') {
      const prefix = `${selectedYear}-${String(selectedMonthIndex + 1).padStart(2, '0')}`;
      return expenses.filter((e) => typeof e?.date === 'string' && e.date.startsWith(prefix));
    }
    return expenses;
  }, [expenses, scope, selectedYear, selectedMonthIndex]);

  // Aggregate total expenses and percentage for each category
  const categoryData = useMemo<CategoryDataPoint[]>(() => {
    if (filteredExpenses.length === 0) return [];

    const map: Record<string, number> = {};
    let total = 0;

    filteredExpenses.forEach((exp) => {
      const rawAmt = Number(exp?.amount);
      if (isNaN(rawAmt) || rawAmt <= 0) return;
      const cat = exp.category?.trim() || 'Others';
      map[cat] = (map[cat] || 0) + rawAmt;
      total += rawAmt;
    });

    if (total <= 0) return [];

    return Object.entries(map)
      .map(([name, amount], idx) => {
        const meta = CATEGORY_PALETTE[name] || {
          color: DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
          icon: '🏷️',
        };
        const rawPercent = (amount / total) * 100;
        const percent = Math.round(rawPercent);
        return {
          name,
          amount,
          percent: percent < 1 && rawPercent > 0 ? 1 : percent,
          color: meta.color,
          icon: meta.icon,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses]);

  // Summary Metrics
  const totalAmount = useMemo(() => {
    return categoryData.reduce((sum, c) => sum + c.amount, 0);
  }, [categoryData]);

  const topCategory = categoryData.length > 0 ? categoryData[0] : null;

  // Compute SVG Donut Slices (Crash-proof, pure SVG)
  const RADIUS = 70;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ~439.82297

  const donutSlices = useMemo(() => {
    if (totalAmount <= 0 || categoryData.length === 0) return [];

    let accumulatedPercent = 0;
    return categoryData.map((item, index) => {
      const sliceFraction = item.amount / totalAmount;
      const strokeLength = sliceFraction * CIRCUMFERENCE;
      const strokeOffset = accumulatedPercent * CIRCUMFERENCE;
      accumulatedPercent += sliceFraction;

      return {
        ...item,
        index,
        strokeLength,
        strokeOffset,
      };
    });
  }, [categoryData, totalAmount, CIRCUMFERENCE]);

  const activeCategory = hoveredIndex !== null && categoryData[hoveredIndex] ? categoryData[hoveredIndex] : null;

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#1A202C] border border-[#E5E7EB] dark:border-[#2D3748] shadow-xs space-y-5">
      {/* Header & Scope Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F3F4F6] dark:border-[#2D3748]">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              <PieChartIcon className="w-4 h-4" />
            </span>
            <h2 className="text-base sm:text-lg font-bold text-[#37352F] dark:text-white">
              Category Expense &amp; Percentage Breakdown
            </h2>
          </div>
          <p className="text-xs text-[#787774] dark:text-[#9CA3AF] mt-0.5">
            Clear view of spending amount and percentage share per category
          </p>
        </div>

        {/* Month vs All Time Filter */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-0.5 rounded-xl text-xs font-semibold self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              setScope('month');
            }}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
              scope === 'month'
                ? 'bg-white dark:bg-[#1A202C] text-purple-600 dark:text-purple-400 shadow-2xs font-bold'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {selectedMonthLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              setScope('all');
            }}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
              scope === 'all'
                ? 'bg-white dark:bg-[#1A202C] text-purple-600 dark:text-purple-400 shadow-2xs font-bold'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            All Time
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40">
          <span className="text-[10px] uppercase font-bold tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>Total Spent ({scope === 'month' ? selectedMonthLabel : 'All Time'})</span>
          </span>
          <div className="text-xl font-extrabold text-[#37352F] dark:text-white mt-1">
            {formatCurrency(totalAmount)}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-pink-50/60 dark:bg-pink-950/30 border border-pink-100 dark:border-pink-900/40">
          <span className="text-[10px] uppercase font-bold tracking-wider text-pink-600 dark:text-pink-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            <span>Top Category</span>
          </span>
          <div className="text-base sm:text-lg font-extrabold text-[#37352F] dark:text-white mt-1 truncate">
            {topCategory ? `${topCategory.name} (${topCategory.percent}%)` : 'None'}
          </div>
          <span className="text-[11px] text-pink-600 dark:text-pink-400 font-semibold">
            {topCategory ? formatCurrency(topCategory.amount) : 'No expenses recorded'}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700">
          <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <Tag className="w-3 h-3" />
            <span>Active Categories</span>
          </span>
          <div className="text-xl font-extrabold text-[#37352F] dark:text-white mt-1">
            {categoryData.length}
          </div>
          <span className="text-[11px] text-[#787774] dark:text-[#9CA3AF]">
            different spending types
          </span>
        </div>
      </div>

      {/* Main Content: Crash-Proof Native SVG Donut Chart + Clean Expense & Percentage List */}
      {categoryData.length === 0 ? (
        <div className="p-8 text-center bg-gray-50 dark:bg-gray-800/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 space-y-2">
          <PieChartIcon className="w-8 h-8 text-gray-400 mx-auto opacity-70" />
          <h3 className="text-sm font-bold text-[#37352F] dark:text-white">
            No expenses recorded for this period
          </h3>
          <p className="text-xs text-[#787774] dark:text-[#9CA3AF]">
            Add expenses in the tracker above to view the category breakdown.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center pt-2">
          {/* Left: Robust, Crash-proof Native SVG Donut Chart with Interactive Center Label */}
          <div className="md:col-span-5 flex flex-col items-center justify-center p-4 rounded-2xl bg-gray-50/60 dark:bg-[#111827]/40 border border-gray-100 dark:border-gray-800">
            <div className="relative w-52 h-52 sm:w-60 sm:h-60 flex items-center justify-center">
              <svg
                viewBox="0 0 200 200"
                className="w-full h-full -rotate-90 transform"
              >
                {/* Background Ring */}
                <circle
                  cx="100"
                  cy="100"
                  r={RADIUS}
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="20"
                  className="text-gray-200 dark:text-gray-700/60"
                />

                {/* Donut Segments */}
                {donutSlices.map((slice) => {
                  const isHovered = hoveredIndex === slice.index;
                  return (
                    <circle
                      key={slice.name}
                      cx="100"
                      cy="100"
                      r={RADIUS}
                      fill="transparent"
                      stroke={slice.color}
                      strokeWidth={isHovered ? 26 : 20}
                      strokeDasharray={`${slice.strokeLength} ${CIRCUMFERENCE - slice.strokeLength}`}
                      strokeDashoffset={-slice.strokeOffset}
                      strokeLinecap="butt"
                      className="transition-all duration-200 cursor-pointer"
                      style={{
                        opacity: hoveredIndex === null || isHovered ? 1 : 0.5,
                        filter: isHovered ? 'drop-shadow(0 0 6px rgba(0,0,0,0.25))' : 'none',
                      }}
                      onMouseEnter={() => setHoveredIndex(slice.index)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    />
                  );
                })}
              </svg>

              {/* Center Informational Display */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4 text-center">
                {activeCategory ? (
                  <div className="animate-in fade-in zoom-in-95 duration-150 space-y-0.5">
                    <span className="text-xl leading-none block mb-0.5">{activeCategory.icon}</span>
                    <span className="text-xs font-bold text-[#37352F] dark:text-white truncate max-w-[120px] block">
                      {activeCategory.name}
                    </span>
                    <div className="text-sm font-extrabold text-purple-600 dark:text-purple-400">
                      {formatCurrency(activeCategory.amount)}
                    </div>
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-[11px] font-black"
                      style={{
                        backgroundColor: `${activeCategory.color}20`,
                        color: activeCategory.color,
                      }}
                    >
                      {activeCategory.percent}%
                    </span>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#787774] dark:text-[#9CA3AF]">
                      Total Spending
                    </span>
                    <div className="text-base sm:text-lg font-black text-[#37352F] dark:text-white">
                      {formatCurrency(totalAmount)}
                    </div>
                    <span className="text-[10px] text-[#787774] dark:text-[#9CA3AF]">
                      {categoryData.length} categories
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="text-center mt-2">
              <span className="text-xs font-medium text-[#787774] dark:text-[#9CA3AF]">
                Hover category or slice to preview share
              </span>
            </div>
          </div>

          {/* Right: Category Breakdown showing Name, Expense Amount, and Percentage */}
          <div className="md:col-span-7 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#787774] dark:text-[#9CA3AF] pb-1 border-b border-gray-100 dark:border-gray-800 px-1">
              <span>Category</span>
              <span>Expense &amp; Percentage</span>
            </div>

            <div className="max-h-72 overflow-y-auto pr-1 space-y-2">
              {categoryData.map((cat, idx) => {
                const isHovered = hoveredIndex === idx;
                return (
                  <div
                    key={cat.name}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    className={`p-2.5 rounded-xl transition-all border cursor-pointer ${
                      isHovered
                        ? 'bg-purple-50/70 dark:bg-purple-950/40 border-purple-300 dark:border-purple-700 shadow-2xs'
                        : 'bg-gray-50/40 dark:bg-gray-800/30 border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="text-base leading-none shrink-0">{cat.icon}</span>
                        <span className="text-[#37352F] dark:text-white font-bold truncate">
                          {cat.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0 ml-2">
                        <span className="font-extrabold text-sm text-[#37352F] dark:text-white">
                          {formatCurrency(cat.amount)}
                        </span>
                        <span
                          className="text-xs font-black px-2 py-0.5 rounded-lg min-w-[42px] text-center"
                          style={{
                            backgroundColor: `${cat.color}18`,
                            color: cat.color,
                          }}
                        >
                          {cat.percent}%
                        </span>
                      </div>
                    </div>

                    {/* Proportional Share Bar */}
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(cat.percent, 100)}%`,
                          backgroundColor: cat.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
