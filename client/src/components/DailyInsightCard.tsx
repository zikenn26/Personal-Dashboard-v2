import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  RotateCw,
  Target,
  CheckCircle2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Clock,
  Flame,
} from 'lucide-react';
import { TodoItem, UserProfile, Priority } from '../types';
import {
  generateDailyInsightAI,
  DailyInsightResult,
} from '../services/groqService';
import { Sound } from '../utils/audio';

interface DailyInsightCardProps {
  profile: UserProfile;
  todos: TodoItem[];
  onToggleTodo?: (id: string) => void;
  onNavigate: (tab: any) => void;
  soundEnabled?: boolean;
  className?: string;
}

const STORAGE_KEY = 'zikenn_daily_insight_cache_v1';

export const DailyInsightCard: React.FC<DailyInsightCardProps> = ({
  profile,
  todos,
  onToggleTodo,
  onNavigate,
  soundEnabled = true,
  className = '',
}) => {
  const [insight, setInsight] = useState<DailyInsightResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  const pendingTodos = todos.filter((t) => !t.completed);
  const urgentCount = pendingTodos.filter(
    (t) => t.priority === 'urgent' || t.priority === 'high'
  ).length;

  const loadInsight = useCallback(
    async (forceRefresh = false) => {
      // Check cache first if not force refresh
      if (!forceRefresh) {
        try {
          const cached = localStorage.getItem(STORAGE_KEY);
          if (cached) {
            const parsed: { data: DailyInsightResult; timestamp: number } =
              JSON.parse(cached);
            // Cache valid for 30 minutes
            if (Date.now() - parsed.timestamp < 30 * 60 * 1000) {
              setInsight(parsed.data);
              return;
            }
          }
        } catch {
          // ignore cache error
        }
      }

      setIsLoading(true);
      try {
        const result = await generateDailyInsightAI(
          {
            name: profile.name || 'User',
            title: profile.title || '',
            bio: profile.bio || '',
          },
          todos
        );
        setInsight(result);
        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ data: result, timestamp: Date.now() })
          );
        } catch {
          // ignore
        }
      } catch (err) {
        console.error('Failed to generate daily insight:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [profile.name, profile.title, profile.bio, todos]
  );

  useEffect(() => {
    loadInsight(false);
  }, [loadInsight]);

  const handleRefresh = () => {
    Sound.click(soundEnabled);
    loadInsight(true);
  };

  const getPriorityBadgeClass = (priority: Priority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/40';
      case 'high':
        return 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/40';
      case 'medium':
        return 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/40';
      default:
        return 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <div
      className={`rounded-2xl bg-[#F8FAFC] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] p-3.5 sm:p-4 shadow-xs transition-all ${className}`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#EDECE9] dark:border-[#334155]/60">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-900/40 flex items-center justify-center text-[#6366F1] dark:text-[#818CF8] shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-xs uppercase font-bold text-[#37352F] dark:text-white tracking-wider truncate">
                Daily Insight
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-[#6366F1] dark:text-[#818CF8] border border-indigo-200/60 dark:border-indigo-900/40 shrink-0">
                {insight?.isAiGenerated ? 'AI Powered' : 'Smart Summary'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="hidden sm:flex items-center gap-1 text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] bg-white dark:bg-[#0F172A] px-2 py-1 rounded-lg border border-[#E2E8F0] dark:border-[#334155]">
            {urgentCount > 0 ? (
              <>
                <Flame className="w-3 h-3 text-rose-500" />
                <span>{urgentCount} High Priority</span>
              </>
            ) : (
              <>
                <Clock className="w-3 h-3 text-emerald-500" />
                <span>{pendingTodos.length} Tasks Queued</span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
            title="Regenerate AI Daily Insight"
            className="p-1.5 rounded-lg bg-white dark:bg-[#0F172A] hover:bg-gray-50 dark:hover:bg-[#334155] text-[#64748B] dark:text-[#94A3B8] border border-[#E2E8F0] dark:border-[#334155] cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
          >
            <RotateCw
              className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#6366F1]' : ''}`}
            />
          </button>

          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            title={isCollapsed ? 'Expand card' : 'Collapse card'}
            className="p-1.5 rounded-lg bg-white dark:bg-[#0F172A] hover:bg-gray-50 dark:hover:bg-[#334155] text-[#64748B] dark:text-[#94A3B8] border border-[#E2E8F0] dark:border-[#334155] cursor-pointer transition-colors shadow-2xs"
          >
            {isCollapsed ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Body Content */}
      {!isCollapsed && (
        <div className="mt-3 grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
          {/* Left Column: AI Summary & Actionable Tip */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-3">
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1.5">
                <span>Executive Briefing</span>
                {profile.name && (
                  <span className="font-medium text-[#475569] dark:text-[#CBD5E1]">
                    for {profile.name}
                  </span>
                )}
              </span>

              {isLoading && !insight ? (
                <div className="space-y-2 py-1">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse w-full" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse w-5/6" />
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-[#37352F] dark:text-[#E2E8F0] leading-relaxed">
                  {insight?.summary ||
                    'Analyzing today’s workload and upcoming task pipeline...'}
                </p>
              )}
            </div>

            {/* Tip pill */}
            {insight?.focusTip && (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-[11px] text-amber-900 dark:text-amber-200">
                <Lightbulb className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="truncate">
                  <span className="font-semibold">Strategy: </span>
                  {insight.focusTip}
                </span>
              </div>
            )}
          </div>

          {/* Right Column: Suggested Priority Focus */}
          <div className="lg:col-span-5 flex flex-col justify-between p-3 rounded-xl bg-white dark:bg-[#0F172A] border border-indigo-200/80 dark:border-indigo-900/50 shadow-2xs space-y-2">
            <div>
              <div className="flex items-center justify-between gap-1.5 mb-1.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#6366F1] dark:text-[#818CF8] flex items-center gap-1">
                  <Target className="w-3 h-3" />
                  <span>Suggested Priority Focus</span>
                </span>
                {insight?.priorityFocus && (
                  <span
                    className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md border ${getPriorityBadgeClass(
                      insight.priorityFocus.priority
                    )}`}
                  >
                    {insight.priorityFocus.priority}
                  </span>
                )}
              </div>

              <h4 className="text-xs sm:text-sm font-bold text-[#1E293B] dark:text-white line-clamp-2">
                {insight?.priorityFocus?.taskTitle || 'All Tasks Complete'}
              </h4>

              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] leading-normal mt-1 line-clamp-2">
                {insight?.priorityFocus?.reason ||
                  'No critical blockers found for today.'}
              </p>
            </div>

            {/* Task Action Bar */}
            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-gray-100 dark:border-gray-800">
              {insight?.priorityFocus?.taskId && onToggleTodo ? (
                <button
                  type="button"
                  onClick={() => {
                    if (insight.priorityFocus.taskId) {
                      Sound.success(soundEnabled);
                      onToggleTodo(insight.priorityFocus.taskId);
                    }
                  }}
                  className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Mark Done</span>
                </button>
              ) : (
                <span className="text-[11px] text-gray-400">Status Clean</span>
              )}

              <button
                type="button"
                onClick={() => onNavigate('tasks')}
                className="flex items-center gap-1 text-[11px] font-semibold text-[#6366F1] dark:text-[#818CF8] hover:underline cursor-pointer"
              >
                <span>View Tasks</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
