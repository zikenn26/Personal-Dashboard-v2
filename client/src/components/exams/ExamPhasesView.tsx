import React from 'react';
import {
  Calendar,
  Clock,
  Award,
  CheckCircle2,
  FileText,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Building,
  Sparkles,
} from 'lucide-react';
import { ExamItem } from '../../types';

interface ExamPhasesViewProps {
  exam: ExamItem;
  onSelectPhaseInSpreadsheet?: (phase: 'Prelims' | 'Mains' | 'Interview') => void;
}

export const ExamPhasesView: React.FC<ExamPhasesViewProps> = ({
  exam,
  onSelectPhaseInSpreadsheet,
}) => {
  // Extract pattern sections and stages for Prelims, Mains, and Interview
  const prelimSections = (exam.pattern?.sections || []).filter(
    (s) =>
      s.name.toLowerCase().includes('prelim') ||
      s.name.toLowerCase().includes('csat') ||
      s.name.toLowerCase().includes('tier 1') ||
      s.name.toLowerCase().includes('paper i:') ||
      s.name.toLowerCase().includes('paper ii:')
  );

  const mainsSections = (exam.pattern?.sections || []).filter(
    (s) =>
      s.name.toLowerCase().includes('main') ||
      s.name.toLowerCase().includes('essay') ||
      s.name.toLowerCase().includes('optional') ||
      s.name.toLowerCase().includes('odia') ||
      s.name.toLowerCase().includes('tier 2')
  );

  const prelimStage = exam.stages.find(
    (s) => s.name.toLowerCase().includes('prelim') || s.name.toLowerCase().includes('screening')
  );
  const mainsStage = exam.stages.find(
    (s) => s.name.toLowerCase().includes('main') || s.name.toLowerCase().includes('descriptive')
  );
  const interviewStage = exam.stages.find(
    (s) =>
      s.name.toLowerCase().includes('interview') ||
      s.name.toLowerCase().includes('personality') ||
      s.name.toLowerCase().includes('viva')
  );

  return (
    <div id="exam-distinct-phases-view" className="space-y-8">
      {/* Intro Header */}
      <div className="border-b border-gray-200 dark:border-gray-800 pb-3">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span>Three-Stage Examination Architecture</span>
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Each stage is independent with dedicated criteria, syllabus scope, and evaluation schemes.
        </p>
      </div>

      {/* ========================================================================= */}
      {/* PHASE 1: PRELIMINARY EXAMINATION */}
      {/* ========================================================================= */}
      <section
        id="phase-1-prelims"
        className="rounded-xl border-2 border-amber-200 dark:border-amber-900/60 bg-white dark:bg-gray-800/80 p-5 shadow-2xs space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-100 dark:border-amber-900/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 flex items-center justify-center font-bold text-sm">
              P1
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                  Phase 1: Screening Stage
                </span>
                <span className="text-xs font-semibold text-gray-500">Qualifying / Cut-off</span>
              </div>
              <h4 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white mt-0.5">
                Preliminary Examination (Prelims)
              </h4>
            </div>
          </div>

          {onSelectPhaseInSpreadsheet && (
            <button
              type="button"
              onClick={() => onSelectPhaseInSpreadsheet('Prelims')}
              className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-xs font-semibold border border-amber-200 dark:border-amber-800 transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
            >
              <span>View Prelims Syllabus Spreadsheet</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Prelims Quick Facts */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 block">Exam Format</span>
            <span className="font-bold text-gray-900 dark:text-gray-100 mt-0.5 block">
              Offline OMR Objective (MCQs)
            </span>
            <span className="text-[10px] text-gray-500 mt-0.5 block">1/3rd Negative Marking</span>
          </div>

          <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 block">Target Exam Date</span>
            <span className="font-bold text-amber-700 dark:text-amber-400 mt-0.5 block flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>{prelimStage?.date || exam.targetExamDate}</span>
            </span>
            <span className="text-[10px] text-gray-500 mt-0.5 block">
              {prelimStage?.status ? `Status: ${prelimStage.status}` : 'Upcoming'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 block">Total Marks & Criteria</span>
            <span className="font-bold text-gray-900 dark:text-gray-100 mt-0.5 block">
              400 Marks (2 Papers of 200)
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5 block">
              CSAT 33% Qualifying; GS Paper 1 for merit list
            </span>
          </div>
        </div>

        {/* Papers in Prelims */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block">
            Prelims Papers Structure:
          </span>
          <div className="divide-y divide-gray-100 dark:divide-gray-700/60 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            {prelimSections.length > 0 ? (
              prelimSections.map((sec, i) => (
                <div key={sec.id || i} className="p-3 bg-white dark:bg-gray-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-gray-900 dark:text-white">{sec.name}</span>
                    <span className="text-gray-500 block text-[11px]">
                      {sec.questions ? `${sec.questions} Questions • ` : ''}
                      {sec.durationMinutes ? `${sec.durationMinutes} Minutes (2 Hours)` : '2 Hours'}
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold">
                    {sec.marks || 200} Marks
                  </span>
                </div>
              ))
            ) : (
              <div className="p-3 bg-white dark:bg-gray-800 text-xs text-gray-500">
                Paper I (General Studies - 200 Marks) &amp; Paper II (General Studies CSAT - 200 Marks, 33% Qualifying)
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* PHASE 2: MAIN WRITTEN EXAMINATION */}
      {/* ========================================================================= */}
      <section
        id="phase-2-mains"
        className="rounded-xl border-2 border-blue-200 dark:border-blue-900/60 bg-white dark:bg-gray-800/80 p-5 shadow-2xs space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-blue-100 dark:border-blue-900/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 flex items-center justify-center font-bold text-sm">
              P2
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 text-[10px] font-bold uppercase tracking-wider">
                  Phase 2: Descriptive Merit Stage
                </span>
                <span className="text-xs font-semibold text-gray-500">Counts for Final Ranking</span>
              </div>
              <h4 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white mt-0.5">
                Main Written Examination (Mains)
              </h4>
            </div>
          </div>

          {onSelectPhaseInSpreadsheet && (
            <button
              type="button"
              onClick={() => onSelectPhaseInSpreadsheet('Mains')}
              className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-semibold border border-blue-200 dark:border-blue-800 transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
            >
              <span>View Mains Syllabus Spreadsheet</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Mains Quick Facts */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 block">Exam Format</span>
            <span className="font-bold text-gray-900 dark:text-gray-100 mt-0.5 block">
              Conventional Descriptive Pen &amp; Paper
            </span>
            <span className="text-[10px] text-gray-500 mt-0.5 block">3 Hours duration per paper</span>
          </div>

          <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 block">Target Exam Window</span>
            <span className="font-bold text-blue-700 dark:text-blue-400 mt-0.5 block flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                {mainsStage?.startDate
                  ? `${mainsStage.startDate} to ${mainsStage.endDate || ''}`
                  : 'Winter Schedule'}
              </span>
            </span>
            <span className="text-[10px] text-gray-500 mt-0.5 block">
              {mainsStage?.notes || 'Held across multiple days'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 block">Total Papers & Weight</span>
            <span className="font-bold text-gray-900 dark:text-gray-100 mt-0.5 block">
              9 Papers (1750 / 2000 Marks)
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5 block">
              2 Qualifying language papers + 7 merit ranking papers
            </span>
          </div>
        </div>

        {/* Mains Papers List */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block">
            Main Examination 9-Paper Framework:
          </span>
          <div className="divide-y divide-gray-100 dark:divide-gray-700/60 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
            {mainsSections.length > 0 ? (
              mainsSections.map((sec, i) => (
                <div key={sec.id || i} className="p-2.5 bg-white dark:bg-gray-800 flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-800 dark:text-gray-200">{sec.name}</span>
                  <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-semibold text-[11px]">
                    {sec.marks ? `${sec.marks} Marks` : 'Descriptive'}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-3 bg-white dark:bg-gray-800 text-xs text-gray-500 space-y-1">
                <p>• Qualifying Papers: Odia Language (250) + English Language (250) [25% Qualifying]</p>
                <p>• Paper III: English Essay (250 Marks)</p>
                <p>• Papers IV–VII: General Studies I, II, III, IV (250 Marks each)</p>
                <p>• Papers VIII–IX: Optional Subject Paper I &amp; II (250 Marks each)</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* PHASE 3: PERSONALITY TEST / INTERVIEW */}
      {/* ========================================================================= */}
      <section
        id="phase-3-interview"
        className="rounded-xl border-2 border-purple-200 dark:border-purple-900/60 bg-white dark:bg-gray-800/80 p-5 shadow-2xs space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-purple-100 dark:border-purple-900/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 flex items-center justify-center font-bold text-sm">
              P3
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 text-[10px] font-bold uppercase tracking-wider">
                  Phase 3: Personality Evaluation
                </span>
                <span className="text-xs font-semibold text-gray-500">Board Interview</span>
              </div>
              <h4 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white mt-0.5">
                Personality Test &amp; Viva Voce (Interview)
              </h4>
            </div>
          </div>

          {onSelectPhaseInSpreadsheet && (
            <button
              type="button"
              onClick={() => onSelectPhaseInSpreadsheet('Interview')}
              className="px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-xs font-semibold border border-purple-200 dark:border-purple-800 transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
            >
              <span>View Interview Prep Topics</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Interview Facts */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30">
            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 block">Assessment Format</span>
            <span className="font-bold text-gray-900 dark:text-gray-100 mt-0.5 block">
              Viva Voce with Expert Board
            </span>
            <span className="text-[10px] text-gray-500 mt-0.5 block">Mental alertness, balance of judgment, ethics</span>
          </div>

          <div className="p-3 rounded-lg bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30">
            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 block">Target Schedule</span>
            <span className="font-bold text-purple-700 dark:text-purple-400 mt-0.5 block flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>{interviewStage?.startDate || 'Post-Mains Results'}</span>
            </span>
            <span className="text-[10px] text-gray-500 mt-0.5 block">
              {interviewStage?.notes || 'Commission Headquarters'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30">
            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 block">Marks Weightage</span>
            <span className="font-bold text-gray-900 dark:text-gray-100 mt-0.5 block">
              250 Marks (OPSC) / 275 Marks (UPSC)
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5 block">
              Added to Mains total for final merit rank
            </span>
          </div>
        </div>

        {/* Preparation Guidelines */}
        <div className="p-3.5 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-xs space-y-1.5">
          <span className="font-bold text-gray-900 dark:text-white block">Key Focus Areas for Phase 3:</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-gray-600 dark:text-gray-300">
            <p>• Detailed Application Form (DAF): Home district, education background, career record, hobbies.</p>
            <p>• State Specifics: Odisha governance, tribal welfare, industrialization, disaster management.</p>
            <p>• National &amp; Global Issues: Economy, foreign policy, constitutional questions, current events.</p>
            <p>• Situational Scenarios: Administrative crisis management, ethical dilemmas, decision-making.</p>
          </div>
        </div>
      </section>
    </div>
  );
};
