import React, { useState } from 'react';
import { GraduationCap, Calendar, Clock, BookOpen, CheckCircle, ChevronRight, Award, Plus, Sparkles } from 'lucide-react';
import { ExamItem } from '../../../../types';
import { nativeService } from '../../../../services/nativeService';
import { CARD_SURFACE_CLASSES } from '../../design-system/materialYou';

export interface AndroidExamsScreenProps {
  exams: ExamItem[];
  onUpdateExams?: (exams: ExamItem[]) => void;
}

export const AndroidExamsScreen: React.FC<AndroidExamsScreenProps> = ({
  exams,
  onUpdateExams,
}) => {
  const [selectedExamId, setSelectedExamId] = useState<string | null>(
    exams.length > 0 ? exams[0].id : null
  );

  const calculateDaysLeft = (targetDateStr: string) => {
    const target = new Date(targetDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  const selectedExam = exams.find((e) => e.id === selectedExamId) || exams[0];

  return (
    <div className="w-full max-w-lg mx-auto px-3.5 pb-24 pt-2 space-y-3.5">
      {/* Banner */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Competitive Exams
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {exams.length} target examinations tracked
          </p>
        </div>
      </div>

      {/* Horizontal Exam Selector */}
      {exams.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          {exams.map((exam) => (
            <button
              key={exam.id}
              type="button"
              onClick={() => {
                void nativeService.triggerHaptic('selection');
                setSelectedExamId(exam.id);
              }}
              className={`px-3.5 py-2 rounded-2xl flex items-center gap-2 whitespace-nowrap text-xs font-bold transition-all cursor-pointer ${
                selectedExam?.id === exam.id
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'bg-white dark:bg-[#121826] text-gray-700 dark:text-gray-300 border border-[#E8E5F3] dark:border-[#242D40]'
              }`}
            >
              <span>{exam.icon || '🎓'}</span>
              <span>{exam.shortName || exam.name}</span>
            </button>
          ))}
        </div>
      )}

      {selectedExam ? (
        <div className="space-y-3">
          {/* Target Countdown Card */}
          <div className="p-4 rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-md shadow-indigo-500/20 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-100 uppercase tracking-wider">
                {selectedExam.category}
              </span>
              <span className="text-xl">{selectedExam.icon || '🎓'}</span>
            </div>

            <h3 className="text-lg font-black mt-1">{selectedExam.name}</h3>
            <p className="text-xs text-indigo-100 mt-0.5">
              Conducted by: {selectedExam.conductingBody}
            </p>

            <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-white/15">
              <div>
                <span className="text-[10px] text-indigo-200 block uppercase">
                  Target Exam Date
                </span>
                <span className="text-xs font-bold flex items-center gap-1 mt-0.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {selectedExam.targetExamDate}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-indigo-200 block uppercase">
                  Days Remaining
                </span>
                <span className="text-lg font-black text-amber-300">
                  {calculateDaysLeft(selectedExam.targetExamDate)} days
                </span>
              </div>
            </div>
          </div>

          {/* Exam Stages Timeline */}
          {selectedExam.stages && selectedExam.stages.length > 0 && (
            <div className="p-4 rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-2xs space-y-3">
              <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                <span>Examination Stages</span>
              </h4>

              <div className="space-y-2">
                {selectedExam.stages.map((stage, idx) => (
                  <div
                    key={stage.id || idx}
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40]"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          stage.status === 'completed'
                            ? 'bg-emerald-500 text-white'
                            : stage.status === 'ongoing'
                            ? 'bg-violet-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                        }`}
                      >
                        {idx + 1}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-gray-900 dark:text-white block">
                          {stage.name}
                        </span>
                        {stage.date && (
                          <span className="text-[10px] text-gray-500 dark:text-gray-400">
                            {stage.date}
                          </span>
                        )}
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                        stage.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : stage.status === 'ongoing'
                          ? 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      }`}
                    >
                      {stage.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subjects Breakdown */}
          {selectedExam.subjects && selectedExam.subjects.length > 0 && (
            <div className="p-4 rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-2xs space-y-3">
              <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                <span>Syllabus Subjects</span>
              </h4>

              <div className="space-y-2">
                {selectedExam.subjects.map((sub) => {
                  const completedTopics = sub.topics.filter((t) => t.completed).length;
                  const totalTopics = sub.topics.length;
                  const pct = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

                  return (
                    <div
                      key={sub.id}
                      className="p-3 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40]"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">
                          {sub.name}
                        </span>
                        <span className="text-[11px] font-bold text-violet-600 dark:text-violet-400">
                          {pct}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-violet-600 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 block">
                        {completedTopics} of {totalTopics} topics completed
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-8 text-center rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40]">
          <GraduationCap className="w-10 h-10 text-violet-400 mx-auto mb-2 opacity-60" />
          <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
            No exams configured
          </p>
        </div>
      )}
    </div>
  );
};
