import React from 'react';
import {
  Calendar,
  CheckCircle2,
  Trash2,
  ChevronRight,
  ExternalLink,
  BookOpen,
  ArrowRight,
  Layers,
} from 'lucide-react';
import { ExamItem } from '../../types';
import { ExamCountdown } from './ExamCountdown';
import { getOrInitializeSyllabusRows } from '../../utils/syllabusTableHelper';

interface ExamListItemProps {
  exam: ExamItem;
  onOpen: (exam: ExamItem) => void;
  onDelete: (id: string) => void;
}

export const ExamListItem: React.FC<ExamListItemProps> = ({
  exam,
  onOpen,
  onDelete,
}) => {
  // Compute progress from either syllabusTableRows or subjects
  const syllabusRows = getOrInitializeSyllabusRows(exam);
  const totalTopics = syllabusRows.length;
  const completedTopics = syllabusRows.filter((r) => r.status === 'Completed').length;
  const progressPercent = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

  // Has Prelims, Mains, Interview?
  const hasPrelims = syllabusRows.some((r) => r.phase === 'Prelims') || exam.stages.some((s) => s.name.toLowerCase().includes('prelim'));
  const hasMains = syllabusRows.some((r) => r.phase === 'Mains') || exam.stages.some((s) => s.name.toLowerCase().includes('main'));
  const hasInterview = syllabusRows.some((r) => r.phase === 'Interview') || exam.stages.some((s) => s.name.toLowerCase().includes('interview') || s.name.toLowerCase().includes('viva'));

  return (
    <div
      id={`exam-list-item-${exam.id}`}
      className="group bg-white dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700/80 rounded-xl p-3.5 sm:p-4 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all shadow-2xs hover:shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3.5"
    >
      {/* ========================================================================= */}
      {/* 1. LEFT: ICON & EXAM IDENTIFIERS */}
      {/* ========================================================================= */}
      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0 shadow-2xs border border-black/5 dark:border-white/10"
          style={{ backgroundColor: `${exam.badgeColor || '#4F46E5'}15` }}
        >
          {exam.icon || '🎓'}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate">
              {exam.name}
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-100 dark:bg-gray-700/80 text-gray-600 dark:text-gray-300">
              {exam.category}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            <span className="truncate">{exam.conductingBody}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <span>Target: {new Date(exam.targetExamDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. CENTER: PHASES DISTINCTION & LIVE COUNTDOWN */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center gap-3 shrink-0">
        {/* Distinct Phase Pills */}
        <div className="flex items-center gap-1">
          {hasPrelims && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
              Prelims
            </span>
          )}
          {hasMains && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50">
              Mains
            </span>
          )}
          {hasInterview && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/50">
              Interview
            </span>
          )}
        </div>

        {/* Live Countdown Component */}
        <ExamCountdown targetDateStr={exam.targetExamDate} size="list" />

        {/* Syllabus Progress */}
        <div className="hidden lg:flex items-center gap-2 min-w-[140px]">
          <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {completedTopics}/{totalTopics} ({progressPercent}%)
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. RIGHT: ACTION CONTROLS */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
        <button
          type="button"
          onClick={() => onOpen(exam)}
          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
        >
          <span>Open Dashboard</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Are you sure you want to remove "${exam.name}" from your tracked exams?`)) {
              onDelete(exam.id);
            }
          }}
          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
          title="Delete exam"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
