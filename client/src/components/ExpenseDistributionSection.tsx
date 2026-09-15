import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
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
  expenses,
  selectedYear,
  selectedMonthIndex,
  selectedMonthLabel,
  formatCurrency,
  soundEnabled,
}) => {
  const [scope, setScope] = useState<'month' | 'all'>('month');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Filter expenses by selected scope (current month vs all time)
  const filteredExpenses = useMemo(() => {
    if (scope === 'month') {
      const prefix = `${selectedYear}-${String(selectedMonthIndex + 1).padStart(2, '0')}`;
      return expenses.filter((e) => (e.date || '').startsWith(prefix));
    }
    return expenses;
  }, [expenses, scope, selectedYear, selectedMonthIndex]);

  // Aggregate total expenses and percentage for each category
  const categoryData = useMemo<CategoryDataPoint[]>(() => {
    if (filteredExpenses.length === 0) return [];

    const map: Record<string, number> = {};
    let total = 0;

    filteredExpenses.forEach((exp) => {
      const cat = exp.category || 'Others';
      const amt = Number(exp.amount) || 0;
      map[cat] = (map[cat] || 0) + amt;
      total += amt;
    });

    if (total === 0) return [];

    return Object.entries(map)
      .map(([name, amount], idx) => {
        const meta = CATEGORY_PALETTE[name] || {
          color: DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
          icon: '🏷️',
        };
        const percent = Math.round((amount / total) * 100);
        return {
          name,
          amount,
          percent,
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

      {/* Main Content: Simple Pie Chart + Clear Expense & Percentage List */}
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
          {/* Left: Clean, Uncluttered Pie Chart */}
          <div className="md:col-span-5 flex flex-col items-center justify-center p-3 rounded-2xl bg-gray-50/60 dark:bg-[#111827]/40 border border-gray-100 dark:border-gray-800">
            <div className="w-full h-56 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="amount"
                    stroke="#FFFFFF"
                    strokeWidth={1.5}
                    onMouseEnter={(_, index) => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell
                        key={`cell-${entry.name}`}
                        fill={entry.color}
                        opacity={hoveredIndex === null || hoveredIndex === index ? 1 : 0.5}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number) => [formatCurrency(val), 'Expense']}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload as CategoryDataPoint;
                        return (
                          <div className="px-3 py-2 rounded-xl bg-[#1E293B] text-white text-xs shadow-xl border border-gray-700 space-y-1">
                            <div className="flex items-center gap-1.5 font-bold">
                              <span>{item.icon}</span>
                              <span>{item.name}</span>
                            </div>
                            <div className="text-emerald-400 font-extrabold text-sm">
                              {formatCurrency(item.amount)}
                            </div>
                            <div className="text-gray-300 text-[11px]">
                              Share: <span className="font-bold text-white">{item.percent}%</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center mt-1">
              <span className="text-xs font-semibold text-[#787774] dark:text-[#9CA3AF]">
                Hover slices to view category details
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
                    className={`p-2.5 rounded-xl transition-all border ${
                      isHovered
                        ? 'bg-purple-50/60 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800'
                        : 'bg-gray-50/40 dark:bg-gray-800/30 border-gray-100 dark:border-gray-800'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="text-base leading-none">{cat.icon}</span>
                        <span className="text-[#37352F] dark:text-white font-bold">{cat.name}</span>
                      </div>

                      <div className="flex items-center gap-2.5">
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
