import React from 'react';
import {
  Calendar,
  ExternalLink,
  ChevronRight,
  BookOpen,
  CheckCircle2,
  Trash2,
  Clock,
  Layers,
  FileCheck2,
} from 'lucide-react';
import { ExamItem } from '../../types';
import { ExamCountdown } from './ExamCountdown';

interface ExamCardProps {
  exam: ExamItem;
  onSelect: (examId: string) => void;
  onDelete: (examId: string) => void;
  soundEnabled: boolean;
}

export const ExamCard: React.FC<ExamCardProps> = ({
  exam,
  onSelect,
  onDelete,
}) => {
  // Calculate total topics & completed topics across all subjects
  const totalTopics = exam.subjects.reduce((acc, sub) => acc + sub.topics.length, 0);
  const completedTopics = exam.subjects.reduce(
    (acc, sub) => acc + sub.topics.filter((t) => t.completed).length,
    0
  );
  const completionPercentage = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

  // Format dates for display
  const formatDate = (dStr?: string) => {
    if (!dStr) return null;
    try {
      return new Date(dStr).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dStr;
    }
  };

  const regStart = formatDate(exam.registrationStartDate);
  const regEnd = formatDate(exam.registrationEndDate);
  const targetDateFormatted = formatDate(exam.targetExamDate);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to remove "${exam.name}" from your tracked exams?`)) {
      onDelete(exam.id);
    }
  };

  return (
    <div
      onClick={() => onSelect(exam.id)}
      className="group relative flex flex-col justify-between bg-white dark:bg-[#111827] rounded-2xl border border-gray-200 dark:border-gray-800 hover:border-indigo-500/60 dark:hover:border-indigo-500/60 p-5 shadow-xs hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-200 cursor-pointer overflow-hidden"
    >
      {/* Top Accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-1 transition-all group-hover:h-1.5"
        style={{ backgroundColor: exam.badgeColor || '#6366F1' }}
      />

      {/* Header section */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-2xl flex items-center justify-center border border-indigo-100 dark:border-indigo-900/60 shadow-2xs group-hover:scale-105 transition-transform">
              {exam.icon || '🎓'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                  {exam.shortName}
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                  {exam.category}
                </span>
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white mt-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                {exam.name}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDelete}
            title="Remove exam"
            className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Conducting Body */}
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 line-clamp-1">
          Conducted by: <strong className="font-semibold text-gray-700 dark:text-gray-300">{exam.conductingBody}</strong>
        </p>

        {/* Live Days Left Countdown Counter */}
        <div className="mb-4">
          <ExamCountdown
            targetDateStr={exam.targetExamDate}
            label={exam.shortName}
            size="card"
          />
        </div>

        {/* Dates Box */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-xl bg-gray-50/80 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800/80 text-xs mb-4">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              Exam Date
            </span>
            <div className="flex items-center gap-1.5 text-gray-900 dark:text-white font-semibold mt-0.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>{targetDateFormatted || 'To be announced'}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              Registration
            </span>
            <div className="text-gray-700 dark:text-gray-300 font-medium mt-0.5 line-clamp-1">
              {regStart && regEnd ? `${regStart} – ${regEnd}` : regStart || 'As per notice'}
            </div>
          </div>
        </div>

        {/* Examination Stages Pills */}
        <div className="mb-4">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
            Stages Timeline
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {exam.stages.slice(0, 4).map((stage) => {
              const isCompleted = stage.status === 'completed';
              const isOngoing = stage.status === 'ongoing';

              return (
                <span
                  key={stage.id}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${
                    isCompleted
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : isOngoing
                      ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-semibold'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200/50 dark:border-gray-700/50'
                  }`}
                >
                  {isCompleted && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                  {isOngoing && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />}
                  <span>{stage.name}</span>
                </span>
              );
            })}
            {exam.stages.length > 4 && (
              <span className="text-[10px] text-gray-400 font-bold">
                +{exam.stages.length - 4} more
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer Progress & View CTA */}
      <div className="pt-3 border-t border-gray-100 dark:border-gray-800/80">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1.5 font-medium">
            <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
            <span>Syllabus: {completedTopics}/{totalTopics} topics</span>
          </span>
          <span className="font-bold text-gray-900 dark:text-white">
            {completionPercentage}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 mb-3 overflow-hidden">
          <div
            className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            {exam.books.length} Books followed
          </span>
          <div className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-0.5 transition-transform">
            <span>Manage Prep</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
};
