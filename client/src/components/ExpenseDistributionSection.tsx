import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  Sector,
} from 'recharts';
import {
  PieChart as PieChartIcon,
  TrendingUp,
  Tag,
  ArrowUpRight,
  Filter,
  CheckCircle2,
  Sparkles,
  Plus,
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
  onSelectCategory?: (category: string) => void;
  onOpenAddExpense?: () => void;
}

interface CategoryDataPoint {
  name: string;
  amount: number;
  percent: number;
  count: number;
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
  'Entertainment': { color: '#8B5CF6', icon: '🎬' },
  'Health & Medical': { color: '#14B8A6', icon: '💊' },
  'Education & Learning': { color: '#06B6D4', icon: '🎓' },
  'Personal Care': { color: '#F43F5E', icon: '✨' },
  'Travel & Leisure': { color: '#0EA5E9', icon: '✈️' },
  'Investment & Savings': { color: '#10B981', icon: '📈' },
  'Others': { color: '#94A3B8', icon: '🏷️' },
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
  onSelectCategory,
  onOpenAddExpense,
}) => {
  const [scope, setScope] = useState<'month' | '30days' | 'all'>('month');
  const [chartMode, setChartMode] = useState<'pie' | 'donut'>('pie');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Filter expenses by selected scope
  const filteredExpenses = useMemo(() => {
    const today = new Date();
    if (scope === 'month') {
      const prefix = `${selectedYear}-${String(selectedMonthIndex + 1).padStart(2, '0')}`;
      return expenses.filter((e) => (e.date || '').startsWith(prefix));
    }
    if (scope === '30days') {
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);
      const threshold = thirtyDaysAgo.toISOString().slice(0, 10);
      return expenses.filter((e) => (e.date || '') >= threshold);
    }
    return expenses;
  }, [expenses, scope, selectedYear, selectedMonthIndex]);

  // Aggregate by Category
  const categoryData = useMemo<CategoryDataPoint[]>(() => {
    if (filteredExpenses.length === 0) return [];

    const map: Record<string, { amount: number; count: number }> = {};
    let total = 0;

    filteredExpenses.forEach((exp) => {
      const cat = exp.category || 'Others';
      if (!map[cat]) {
        map[cat] = { amount: 0, count: 0 };
      }
      map[cat].amount += exp.amount;
      map[cat].count += 1;
      total += exp.amount;
    });

    if (total === 0) total = 1;

    return Object.entries(map)
      .map(([name, data], idx) => {
        const meta = CATEGORY_PALETTE[name] || {
          color: DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
          icon: '🏷️',
        };
        const percent = Math.round((data.amount / total) * 100);
        return {
          name,
          amount: data.amount,
          percent,
          count: data.count,
          color: meta.color,
          icon: meta.icon,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalAmount = categoryData.reduce((sum, c) => sum + c.amount, 0);
    const topCategory = categoryData.length > 0 ? categoryData[0] : null;
    const avgPerCategory = categoryData.length > 0 ? Math.round(totalAmount / categoryData.length) : 0;
    const totalTransactions = categoryData.reduce((sum, c) => sum + c.count, 0);

    return {
      totalAmount,
      topCategory,
      avgPerCategory,
      totalTransactions,
      categoryCount: categoryData.length,
    };
  }, [categoryData]);

  // Active highlighted category
  const activeCategory = activeIndex !== null && categoryData[activeIndex] ? categoryData[activeIndex] : null;

  // Custom label renderer for the pie chart slices
  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }: any) => {
    if (percent < 0.05) return null; // Don't crowd small slices
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="#FFFFFF"
        textAnchor="middle"
        dominantBaseline="central"
        className="text-[11px] font-black drop-shadow-md pointer-events-none select-none"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#1A202C] border border-[#E5E7EB] dark:border-[#2D3748] shadow-xs space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F3F4F6] dark:border-[#2D3748]">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              <PieChartIcon className="w-4 h-4" />
            </span>
            <h2 className="text-base sm:text-lg font-bold text-[#37352F] dark:text-white">
              Expense Distribution Across Categories
            </h2>
          </div>
          <p className="text-xs text-[#787774] dark:text-[#9CA3AF] mt-0.5">
            Detailed breakdown and visual share of your spending by category
          </p>
        </div>

        {/* Action Controls: Scope & Chart Style */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Scope Filter */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-0.5 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                setScope('month');
              }}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
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
                setScope('30days');
              }}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                scope === '30days'
                  ? 'bg-white dark:bg-[#1A202C] text-purple-600 dark:text-purple-400 shadow-2xs font-bold'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Past 30 Days
            </button>
            <button
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                setScope('all');
              }}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                scope === 'all'
                  ? 'bg-white dark:bg-[#1A202C] text-purple-600 dark:text-purple-400 shadow-2xs font-bold'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              All Time
            </button>
          </div>

          {/* Pie vs Donut Toggle */}
          <div className="inline-flex p-0.5 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                setChartMode('pie');
              }}
              className={`px-2 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                chartMode === 'pie'
                  ? 'bg-white dark:bg-[#1A202C] text-purple-600 dark:text-purple-400 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Clean Pie
            </button>
            <button
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                setChartMode('donut');
              }}
              className={`px-2 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                chartMode === 'donut'
                  ? 'bg-white dark:bg-[#1A202C] text-purple-600 dark:text-purple-400 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Donut View
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-gradient-to-br from-purple-50/70 to-white dark:from-purple-950/30 dark:to-[#1A202C] border border-purple-100 dark:border-purple-900/40">
          <span className="text-[10px] uppercase font-bold tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>Total Evaluated</span>
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-lg sm:text-xl font-extrabold text-[#37352F] dark:text-white">
              {formatCurrency(metrics.totalAmount)}
            </span>
          </div>
          <span className="text-[10px] text-[#787774] dark:text-[#9CA3AF]">
            across {metrics.totalTransactions} transactions
          </span>
        </div>

        <div className="p-3 rounded-xl bg-gradient-to-br from-pink-50/70 to-white dark:from-pink-950/30 dark:to-[#1A202C] border border-pink-100 dark:border-pink-900/40">
          <span className="text-[10px] uppercase font-bold tracking-wider text-pink-600 dark:text-pink-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            <span>Top Category</span>
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-base sm:text-lg font-extrabold text-[#37352F] dark:text-white truncate">
              {metrics.topCategory ? metrics.topCategory.name : 'None'}
            </span>
          </div>
          <span className="text-[10px] text-pink-600 dark:text-pink-400 font-semibold">
            {metrics.topCategory
              ? `${metrics.topCategory.percent}% (${formatCurrency(metrics.topCategory.amount)})`
              : 'No data'}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-gray-50/80 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700">
          <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <Tag className="w-3 h-3" />
            <span>Active Categories</span>
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-lg sm:text-xl font-extrabold text-[#37352F] dark:text-white">
              {metrics.categoryCount}
            </span>
            <span className="text-[10px] text-gray-400">types recorded</span>
          </div>
          <span className="text-[10px] text-[#787774] dark:text-[#9CA3AF]">
            categorized spending
          </span>
        </div>

        <div className="p-3 rounded-xl bg-gray-50/80 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700">
          <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Avg / Category</span>
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-lg sm:text-xl font-extrabold text-[#37352F] dark:text-white">
              {formatCurrency(metrics.avgPerCategory)}
            </span>
          </div>
          <span className="text-[10px] text-[#787774] dark:text-[#9CA3AF]">
            mean distribution
          </span>
        </div>
      </div>

      {/* Main Visualization & Breakdown Grid */}
      {categoryData.length === 0 ? (
        <div className="p-8 text-center bg-gray-50 dark:bg-gray-800/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 space-y-3">
          <PieChartIcon className="w-10 h-10 text-purple-400 mx-auto opacity-70" />
          <h3 className="text-sm font-bold text-[#37352F] dark:text-white">
            No expenses recorded in this period
          </h3>
          <p className="text-xs text-[#787774] dark:text-[#9CA3AF] max-w-sm mx-auto">
            Log your daily expenses to see an interactive, color-coded pie chart of your category distribution.
          </p>
          {onOpenAddExpense && (
            <button
              type="button"
              onClick={onOpenAddExpense}
              className="px-3.5 py-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Expense</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center pt-1">
          {/* Left Column: Interactive Clean Pie Chart */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center relative min-h-[290px] p-2 rounded-2xl bg-gray-50/50 dark:bg-[#111827]/40 border border-gray-100 dark:border-gray-800">
            <div className="w-full h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomizedLabel}
                    innerRadius={chartMode === 'donut' ? 62 : 0}
                    outerRadius={96}
                    paddingAngle={chartMode === 'donut' ? 3 : 1.5}
                    dataKey="amount"
                    stroke="#FFFFFF"
                    strokeWidth={1.5}
                    onMouseEnter={(_, index) => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                    onClick={(entry) => {
                      Sound.click(soundEnabled);
                      if (onSelectCategory) {
                        onSelectCategory(entry.name);
                      }
                    }}
                    cursor="pointer"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell
                        key={`cell-${entry.name}`}
                        fill={entry.color}
                        opacity={activeIndex === null || activeIndex === index ? 1 : 0.45}
                        stroke={activeIndex === index ? '#FFFFFF' : 'none'}
                        strokeWidth={activeIndex === index ? 2.5 : 0}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number) => [formatCurrency(val), 'Amount Spent']}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload as CategoryDataPoint;
                        return (
                          <div className="p-3 rounded-xl bg-[#1E293B] text-white text-xs shadow-2xl border border-gray-700 space-y-1 min-w-[150px]">
                            <div className="flex items-center gap-1.5 font-bold border-b border-gray-700 pb-1">
                              <span>{data.icon}</span>
                              <span>{data.name}</span>
                            </div>
                            <div className="flex items-center justify-between text-emerald-400 font-extrabold pt-0.5">
                              <span>Spent:</span>
                              <span>{formatCurrency(data.amount)}</span>
                            </div>
                            <div className="flex items-center justify-between text-gray-300">
                              <span>Share:</span>
                              <span className="font-bold text-white">{data.percent}%</span>
                            </div>
                            <div className="flex items-center justify-between text-gray-400 text-[11px]">
                              <span>Entries:</span>
                              <span>{data.count} transactions</span>
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

            {/* Donut Center Label when in Donut View */}
            {chartMode === 'donut' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-base sm:text-lg font-black text-[#37352F] dark:text-white tracking-tight">
                  {activeCategory ? formatCurrency(activeCategory.amount) : formatCurrency(metrics.totalAmount)}
                </span>
                <span className="text-[10px] font-semibold text-[#787774] dark:text-[#9CA3AF] uppercase">
                  {activeCategory ? activeCategory.name : 'Total Spent'}
                </span>
              </div>
            )}

            {/* Chart Interaction Hint */}
            <p className="text-[11px] text-gray-400 text-center mt-1">
              Hover or click slices to highlight category and filter transactions
            </p>
          </div>

          {/* Right Column: Category Distribution List & Progress Bars */}
          <div className="lg:col-span-6 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-[#787774] dark:text-[#9CA3AF] px-1 pb-1 border-b border-gray-100 dark:border-gray-800">
              <span>Category ({categoryData.length})</span>
              <span>Amount &amp; Share</span>
            </div>

            <div className="max-h-72 overflow-y-auto pr-1 space-y-2.5">
              {categoryData.map((cat, idx) => {
                const isHovered = activeIndex === idx;
                return (
                  <div
                    key={cat.name}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onMouseLeave={() => setActiveIndex(null)}
                    onClick={() => {
                      Sound.click(soundEnabled);
                      if (onSelectCategory) {
                        onSelectCategory(cat.name);
                      }
                    }}
                    className={`p-2 rounded-xl transition-all cursor-pointer border ${
                      isHovered
                        ? 'bg-purple-50/60 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800 shadow-xs'
                        : 'bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800/40 border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="text-sm">{cat.icon}</span>
                        <span className="text-[#37352F] dark:text-white font-bold">{cat.name}</span>
                        <span className="text-[10px] text-gray-400 font-normal">
                          ({cat.count} {cat.count === 1 ? 'tx' : 'txs'})
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span className="font-extrabold text-[#37352F] dark:text-white">
                          {formatCurrency(cat.amount)}
                        </span>
                        <span
                          className="text-[11px] font-bold px-1.5 py-0.5 rounded-md min-w-[38px] text-right"
                          style={{
                            backgroundColor: `${cat.color}15`,
                            color: cat.color,
                          }}
                        >
                          {cat.percent}%
                        </span>
                      </div>
                    </div>

                    {/* Proportional Bar */}
                    <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
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
