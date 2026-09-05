import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Trash2,
  ArrowRight,
  Layers,
  Edit2,
  Check,
  X,
  Clock,
} from 'lucide-react';
import { ExamItem } from '../../types';
import { ExamCountdown } from './ExamCountdown';
import { getOrInitializeSyllabusRows } from '../../utils/syllabusTableHelper';

interface ExamListItemProps {
  exam: ExamItem;
  onOpen: (exam: ExamItem) => void;
  onDelete: (id: string) => void;
  onUpdateExam?: (id: string, updated: Partial<ExamItem>) => void;
  soundEnabled?: boolean;
}

export const ExamListItem: React.FC<ExamListItemProps> = ({
  exam,
  onOpen,
  onDelete,
  onUpdateExam,
  soundEnabled,
}) => {
  // State for date editor popover/inline row
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [draftRegDate, setDraftRegDate] = useState(
    exam.registrationDate || exam.registrationStartDate || ''
  );
  const [draftFirstPhaseDate, setDraftFirstPhaseDate] = useState(
    exam.firstPhaseExamDate || ''
  );
  const [draftTargetDate, setDraftTargetDate] = useState(
    exam.targetExamDate || ''
  );

  // Compute progress from either syllabusTableRows or subjects
  const syllabusRows = getOrInitializeSyllabusRows(exam);
  const totalTopics = syllabusRows.length;
  const completedTopics = syllabusRows.filter((r) => r.status === 'Completed').length;
  const progressPercent = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

  // Has Prelims, Mains, Interview?
  const hasPrelims =
    syllabusRows.some((r) => r.phase === 'Prelims') ||
    exam.stages.some((s) => s.name.toLowerCase().includes('prelim'));
  const hasMains =
    syllabusRows.some((r) => r.phase === 'Mains') ||
    exam.stages.some((s) => s.name.toLowerCase().includes('main'));
  const hasInterview =
    syllabusRows.some((r) => r.phase === 'Interview') ||
    exam.stages.some(
      (s) => s.name.toLowerCase().includes('interview') || s.name.toLowerCase().includes('viva')
    );

  const formatDateDisplay = (dStr?: string) => {
    if (!dStr) return null;
    try {
      const parts = dStr.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      }
      return new Date(dStr).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dStr;
    }
  };

  const handleSaveDates = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateExam) return;
    onUpdateExam(exam.id, {
      registrationDate: draftRegDate.trim() || undefined,
      registrationStartDate: draftRegDate.trim() || undefined,
      firstPhaseExamDate: draftFirstPhaseDate.trim() || undefined,
      targetExamDate: draftTargetDate.trim() || exam.targetExamDate,
    });
    setIsEditingDates(false);
  };

  const handleCancelDates = () => {
    setDraftRegDate(exam.registrationDate || exam.registrationStartDate || '');
    setDraftFirstPhaseDate(exam.firstPhaseExamDate || '');
    setDraftTargetDate(exam.targetExamDate || '');
    setIsEditingDates(false);
  };

  const displayRegDate = formatDateDisplay(exam.registrationDate || exam.registrationStartDate);
  const displayPhase1Date = formatDateDisplay(exam.firstPhaseExamDate);
  const displayTargetDate = formatDateDisplay(exam.targetExamDate);

  return (
    <div
      id={`exam-list-item-${exam.id}`}
      className="group bg-white dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700/80 rounded-xl p-3 sm:p-3.5 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all shadow-2xs hover:shadow-xs flex flex-col gap-2.5"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
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

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              <span className="truncate">{exam.conductingBody}</span>
              <span>•</span>
              {/* Outside Dates Display */}
              <div className="flex flex-wrap items-center gap-1.5">
                {/* Registration Date display */}
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-[11px] font-medium border border-emerald-200/60 dark:border-emerald-900/60"
                  title="Registration Date"
                >
                  <span className="font-bold">Reg:</span>
                  <span>{displayRegDate || 'Not set'}</span>
                </span>

                {/* First Phase Exam Date display */}
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-[11px] font-medium border border-amber-200/60 dark:border-amber-900/60"
                  title="First Phase Exam Date"
                >
                  <span className="font-bold">Phase 1 Exam:</span>
                  <span>{displayPhase1Date || 'Not set'}</span>
                </span>

                {/* Target Date */}
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 text-[11px] font-medium border border-blue-200/60 dark:border-blue-900/60"
                  title="Target / Final Exam Date"
                >
                  <span className="font-bold">Target:</span>
                  <span>{displayTargetDate || 'Not set'}</span>
                </span>

                {/* Small Calendar Icon to Quick-Edit Dates */}
                {onUpdateExam && (
                  <button
                    type="button"
                    onClick={() => setIsEditingDates(!isEditingDates)}
                    className="p-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors cursor-pointer ml-0.5"
                    title="Edit Registration Date and First Phase Exam Date"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. CENTER: COMPACT NUMERIC PHASES (1, 2, 3) & LIVE COUNTDOWN */}
        {/* ========================================================================= */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Space-saving Numeric Badges: 1 (Amber), 2 (Blue), 3 (Purple) */}
          <div className="flex items-center gap-1">
            {hasPrelims && (
              <span
                className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700"
                title="Phase 1: Prelims"
              >
                1
              </span>
            )}
            {hasMains && (
              <span
                className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 border border-blue-300 dark:border-blue-700"
                title="Phase 2: Mains"
              >
                2
              </span>
            )}
            {hasInterview && (
              <span
                className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-extrabold bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200 border border-purple-300 dark:border-purple-700"
                title="Phase 3: Interview"
              >
                3
              </span>
            )}
          </div>

          {/* Live Countdown Component */}
          <ExamCountdown
            targetDateStr={exam.firstPhaseExamDate || exam.targetExamDate}
            size="list"
          />

          {/* Syllabus Progress */}
          <div className="hidden lg:flex items-center gap-2 min-w-[120px]">
            <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap">
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
              if (
                window.confirm(
                  `Are you sure you want to remove "${exam.name}" from your tracked exams?`
                )
              ) {
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

      {/* ========================================================================= */}
      {/* QUICK DATE EDIT PANEL (Appears on clicking small calendar icon) */}
      {/* ========================================================================= */}
      {isEditingDates && (
        <form
          onSubmit={handleSaveDates}
          className="mt-1 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/70 border border-indigo-200 dark:border-indigo-900/60 flex flex-wrap items-center gap-3 animate-in slide-in-from-top-1 text-xs"
        >
          <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-400 font-bold">
            <Calendar className="w-4 h-4" />
            <span>Edit Dates:</span>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-gray-600 dark:text-gray-300 font-medium">
              Registration Date:
            </label>
            <input
              type="date"
              value={draftRegDate}
              onChange={(e) => setDraftRegDate(e.target.value)}
              className="px-2 py-1 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-gray-600 dark:text-gray-300 font-medium">
              Phase 1 Exam Date:
            </label>
            <input
              type="date"
              value={draftFirstPhaseDate}
              onChange={(e) => setDraftFirstPhaseDate(e.target.value)}
              className="px-2 py-1 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-gray-600 dark:text-gray-300 font-medium">
              Target / Final Exam:
            </label>
            <input
              type="date"
              value={draftTargetDate}
              onChange={(e) => setDraftTargetDate(e.target.value)}
              className="px-2 py-1 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <button
              type="submit"
              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save Dates</span>
            </button>
            <button
              type="button"
              onClick={handleCancelDates}
              className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
