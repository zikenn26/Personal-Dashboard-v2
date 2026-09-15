import React, { useState, useMemo } from 'react';
import {
  PieChart as PieChartIcon,
  TrendingUp,
  Tag,
  Sparkles,
  Check,
  X,
} from 'lucide-react';
import { ExpenseItem } from '../types';
import { Sound } from '../utils/audio';

export interface ExpenseDistributionSectionProps {
  expenses: ExpenseItem[];
  selectedYear: number;
  selectedMonthIndex: number;
  selectedMonthLabel: string;
  formatCurrency: (amount: number) => string;
  selectedCategory?: string;
  onSelectCategory?: (category: string) => void;
  soundEnabled: boolean;
}

interface CategoryDataPoint {
  name: string;
  amount: number;
  percent: number;
  color: string;
  icon: string;
  count: number;
}

interface DonutSlicePath extends CategoryDataPoint {
  index: number;
  startAngle: number;
  endAngle: number;
  pathD: string;
  hoverPathD: string;
  isSelected: boolean;
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

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeDonutSlice(
  centerX: number,
  centerY: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number
): string {
  let angleSpan = endAngle - startAngle;
  if (angleSpan >= 359.99) {
    endAngle = startAngle + 359.99;
    angleSpan = 359.99;
  }

  const outerStart = polarToCartesian(centerX, centerY, outerRadius, startAngle);
  const outerEnd = polarToCartesian(centerX, centerY, outerRadius, endAngle);
  const innerStart = polarToCartesian(centerX, centerY, innerRadius, startAngle);
  const innerEnd = polarToCartesian(centerX, centerY, innerRadius, endAngle);

  const largeArcFlag = angleSpan <= 180 ? '0' : '1';

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

export const ExpenseDistributionSection: React.FC<ExpenseDistributionSectionProps> = ({
  expenses = [],
  selectedYear,
  selectedMonthIndex,
  selectedMonthLabel,
  formatCurrency,
  selectedCategory = 'all',
  onSelectCategory,
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

  // Aggregate total expenses, transaction counts, and percentages for each category
  const categoryData = useMemo<CategoryDataPoint[]>(() => {
    if (filteredExpenses.length === 0) return [];

    const map: Record<string, { total: number; count: number }> = {};
    let grandTotal = 0;

    filteredExpenses.forEach((exp) => {
      const rawAmt = Number(exp?.amount);
      if (isNaN(rawAmt) || rawAmt <= 0) return;
      const cat = exp.category?.trim() || 'Others';
      if (!map[cat]) {
        map[cat] = { total: 0, count: 0 };
      }
      map[cat].total += rawAmt;
      map[cat].count += 1;
      grandTotal += rawAmt;
    });

    if (grandTotal <= 0) return [];

    return Object.entries(map)
      .map(([name, data], idx) => {
        const meta = CATEGORY_PALETTE[name] || {
          color: DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
          icon: '🏷️',
        };
        const rawPercent = (data.total / grandTotal) * 100;
        const percent = Math.max(1, Math.round(rawPercent));
        return {
          name,
          amount: data.total,
          percent: percent > 100 ? 100 : percent,
          count: data.count,
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

  // Selected category normalized
  const activeSelectedCat = selectedCategory && selectedCategory !== 'all' ? selectedCategory : null;

  // Handler for clicking any pie slice or category
  const handleCategoryClick = (categoryName: string) => {
    Sound.click(soundEnabled);
    if (!onSelectCategory) return;
    if (activeSelectedCat?.toLowerCase() === categoryName.toLowerCase()) {
      onSelectCategory('all');
    } else {
      onSelectCategory(categoryName);
    }
  };

  // Compute mathematically exact SVG Donut Slices
  // Allocates a minimum angle so even very small pies (< 1% or 2%) are visible and easily clickable!
  const donutSlices = useMemo<DonutSlicePath[]>(() => {
    if (totalAmount <= 0 || categoryData.length === 0) return [];

    const count = categoryData.length;
    if (count === 1) {
      const single = categoryData[0];
      const isSel = !!activeSelectedCat && activeSelectedCat.toLowerCase() === single.name.toLowerCase();
      return [
        {
          ...single,
          index: 0,
          startAngle: 0,
          endAngle: 359.99,
          pathD: describeDonutSlice(100, 100, 50, isSel ? 80 : 74, 0, 359.99),
          hoverPathD: describeDonutSlice(100, 100, 48, 82, 0, 359.99),
          isSelected: isSel,
        },
      ];
    }

    // Allocate angles with a minimum angle for small pies
    const MIN_ANGLE_DEG = 8; // Guarantee every slice has at least 8 degrees to ensure clickability
    const totalMinAngleNeeded = MIN_ANGLE_DEG * count;

    let sliceAngles: number[] = [];

    if (totalMinAngleNeeded >= 360) {
      // If there are many categories, split evenly
      const evenAngle = 360 / count;
      sliceAngles = categoryData.map(() => evenAngle);
    } else {
      // Proportional distribution with minimum guarantee
      const availableFlexibleAngle = 360 - totalMinAngleNeeded;
      sliceAngles = categoryData.map((item) => {
        const propFraction = item.amount / totalAmount;
        return MIN_ANGLE_DEG + propFraction * availableFlexibleAngle;
      });
    }

    let currentAngle = 0;
    return categoryData.map((item, index) => {
      const startAngle = currentAngle;
      const spanAngle = sliceAngles[index];
      const endAngle = currentAngle + spanAngle;
      currentAngle = endAngle;

      const isSel = !!activeSelectedCat && activeSelectedCat.toLowerCase() === item.name.toLowerCase();

      // Normal path: innerRadius 50, outerRadius 74 (or 80 if selected)
      const normalOuter = isSel ? 80 : 74;
      const normalInner = isSel ? 48 : 50;
      const pathD = describeDonutSlice(100, 100, normalInner, normalOuter, startAngle, endAngle);

      // Hover / enlarged path: outerRadius 83, innerRadius 47
      const hoverPathD = describeDonutSlice(100, 100, 47, 83, startAngle, endAngle);

      return {
        ...item,
        index,
        startAngle,
        endAngle,
        pathD,
        hoverPathD,
        isSelected: isSel,
      };
    });
  }, [categoryData, totalAmount, activeSelectedCat]);

  // Current active category for the center label (hovered takes priority, then selected)
  const activeCategory = useMemo(() => {
    if (hoveredIndex !== null && categoryData[hoveredIndex]) {
      return categoryData[hoveredIndex];
    }
    if (activeSelectedCat) {
      const found = categoryData.find((c) => c.name.toLowerCase() === activeSelectedCat.toLowerCase());
      if (found) return found;
    }
    return null;
  }, [hoveredIndex, activeSelectedCat, categoryData]);

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
            Click any pie slice to filter transactions and inspect category spending results
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
            all addressable &amp; clickable
          </span>
        </div>
      </div>

      {/* Main Content: Precision SVG Donut Chart + Clean Expense & Percentage List */}
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
        <div className="space-y-4 pt-1">
          {/* Active Filter Notification Bar */}
          {activeSelectedCat && (
            <div className="flex items-center justify-between p-2.5 px-3 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base shrink-0">
                  {CATEGORY_PALETTE[activeSelectedCat]?.icon || '🏷️'}
                </span>
                <span className="truncate text-purple-900 dark:text-purple-200">
                  Showing results for: <strong>{activeSelectedCat}</strong> (
                  {categoryData.find((c) => c.name.toLowerCase() === activeSelectedCat.toLowerCase())?.percent || 0}
                  % of spending)
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleCategoryClick(activeSelectedCat)}
                className="flex items-center gap-1 text-xs font-bold text-purple-700 dark:text-purple-300 hover:underline cursor-pointer shrink-0 ml-2"
              >
                <X className="w-3.5 h-3.5" />
                <span>Show All Categories</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Left: Precision SVG Donut Chart with Interactive Center Label and Quick Pills */}
            <div className="md:col-span-5 flex flex-col items-center justify-center p-4 rounded-2xl bg-gray-50/60 dark:bg-[#111827]/40 border border-gray-100 dark:border-gray-800">
              <div className="relative w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center">
                <svg
                  viewBox="0 0 200 200"
                  className="w-full h-full transform"
                  style={{ overflow: 'visible' }}
                >
                  {/* Background Empty Ring */}
                  <circle
                    cx="100"
                    cy="100"
                    r="62"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="24"
                    className="text-gray-100 dark:text-gray-800/80"
                  />

                  {/* Donut Arc Segments - Every single pie slice is independently addressable and clickable */}
                  {donutSlices.map((slice) => {
                    const isHovered = hoveredIndex === slice.index;
                    const isSelected = slice.isSelected;
                    const isDimmed = activeSelectedCat && !isSelected && hoveredIndex === null;

                    return (
                      <g key={slice.name} className="transition-all duration-200">
                        {/* Invisible thicker hit-path to guarantee effortless clicking on small slices */}
                        <path
                          d={slice.hoverPathD}
                          fill="none"
                          stroke="transparent"
                          strokeWidth="28"
                          className="cursor-pointer"
                          onClick={() => handleCategoryClick(slice.name)}
                          onMouseEnter={() => setHoveredIndex(slice.index)}
                          onMouseLeave={() => setHoveredIndex(null)}
                        />

                        {/* Visible Pie Slice Arc */}
                        <path
                          d={isHovered || isSelected ? slice.hoverPathD : slice.pathD}
                          fill={slice.color}
                          stroke="#ffffff"
                          strokeWidth={donutSlices.length > 1 ? 1.5 : 0}
                          strokeLinejoin="round"
                          className="transition-all duration-200 cursor-pointer"
                          style={{
                            opacity: isDimmed ? 0.4 : 1,
                            filter:
                              isSelected || isHovered
                                ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))'
                                : 'none',
                          }}
                          onClick={() => handleCategoryClick(slice.name)}
                          onMouseEnter={() => setHoveredIndex(slice.index)}
                          onMouseLeave={() => setHoveredIndex(null)}
                        >
                          <title>
                            {slice.name}: {formatCurrency(slice.amount)} ({slice.percent}%) - Click to show results
                          </title>
                        </path>
                      </g>
                    );
                  })}
                </svg>

                {/* Center Informational Display */}
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center cursor-pointer select-none"
                  onClick={() => {
                    if (activeCategory) {
                      handleCategoryClick(activeCategory.name);
                    }
                  }}
                  title={activeCategory ? `Click to ${activeSelectedCat ? 'show all' : 'filter'}` : undefined}
                >
                  {activeCategory ? (
                    <div className="animate-in fade-in zoom-in-95 duration-150 space-y-0.5">
                      <span className="text-xl sm:text-2xl leading-none block mb-0.5">{activeCategory.icon}</span>
                      <span className="text-xs font-bold text-[#37352F] dark:text-white truncate max-w-[120px] block">
                        {activeCategory.name}
                      </span>
                      <div className="text-sm font-extrabold text-purple-600 dark:text-purple-400">
                        {formatCurrency(activeCategory.amount)}
                      </div>
                      <div className="flex items-center justify-center gap-1">
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-[11px] font-black"
                          style={{
                            backgroundColor: `${activeCategory.color}20`,
                            color: activeCategory.color,
                          }}
                        >
                          {activeCategory.percent}%
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                          ({activeCategory.count} txns)
                        </span>
                      </div>
                      <span className="text-[9px] font-semibold text-purple-600 dark:text-purple-400 block pt-0.5">
                        {activeSelectedCat?.toLowerCase() === activeCategory.name.toLowerCase()
                          ? 'Click to show all'
                          : 'Click to filter'}
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
                      <span className="text-[10px] text-[#787774] dark:text-[#9CA3AF] block">
                        {categoryData.length} categories
                      </span>
                      <span className="text-[9px] font-semibold text-purple-600 dark:text-purple-400 block pt-0.5">
                        Click any pie to view
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick-Select Pills for 100% addressability across all screens */}
              <div className="w-full mt-3 pt-3 border-t border-gray-100 dark:border-gray-800/80">
                <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1.5 px-1">
                  <span>Quick Select Pie:</span>
                  {activeSelectedCat && (
                    <button
                      type="button"
                      onClick={() => handleCategoryClick(activeSelectedCat)}
                      className="text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                  <button
                    type="button"
                    onClick={() => {
                      Sound.click(soundEnabled);
                      if (onSelectCategory) onSelectCategory('all');
                    }}
                    className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                      !activeSelectedCat
                        ? 'bg-purple-600 text-white shadow-2xs font-bold'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    All ({categoryData.length})
                  </button>
                  {categoryData.map((cat, idx) => {
                    const isSelected = activeSelectedCat?.toLowerCase() === cat.name.toLowerCase();
                    return (
                      <button
                        key={cat.name}
                        type="button"
                        onClick={() => handleCategoryClick(cat.name)}
                        onMouseEnter={() => setHoveredIndex(idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-purple-600 text-white font-bold shadow-2xs'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: isSelected ? '#ffffff' : cat.color }}
                        />
                        <span>{cat.icon}</span>
                        <span className="truncate max-w-[90px]">{cat.name}</span>
                        <span className="text-[10px] opacity-80">{cat.percent}%</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right: Category Breakdown showing Name, Expense Amount, Percentage and Direct Click Filter */}
            <div className="md:col-span-7 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#787774] dark:text-[#9CA3AF] pb-1 border-b border-gray-100 dark:border-gray-800 px-1">
                <span>Category (Click to filter)</span>
                <span>Expense &amp; Percentage</span>
              </div>

              <div className="max-h-80 overflow-y-auto pr-1 space-y-2">
                {categoryData.map((cat, idx) => {
                  const isHovered = hoveredIndex === idx;
                  const isSelected = activeSelectedCat?.toLowerCase() === cat.name.toLowerCase();

                  return (
                    <div
                      key={cat.name}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleCategoryClick(cat.name)}
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      className={`p-2.5 rounded-xl transition-all border cursor-pointer ${
                        isSelected
                          ? 'bg-purple-50/90 dark:bg-purple-950/60 border-purple-400 dark:border-purple-600 shadow-sm ring-1 ring-purple-400/40'
                          : isHovered
                          ? 'bg-purple-50/60 dark:bg-purple-950/30 border-purple-300 dark:border-purple-700 shadow-2xs'
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
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-normal">
                            ({cat.count} txns)
                          </span>
                          {isSelected && (
                            <span className="px-1.5 py-0.2 rounded bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-[10px] font-bold flex items-center gap-0.5">
                              <Check className="w-2.5 h-2.5" />
                              <span>Active</span>
                            </span>
                          )}
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
        </div>
      )}
    </div>
  );
};

