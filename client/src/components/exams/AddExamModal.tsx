import React, { useState, useEffect } from 'react';
import { X, Plus, Sparkles, Check, Calendar, Globe, Award, Shield, FileText, BookOpen } from 'lucide-react';
import { ExamItem, ExamSubject } from '../../types';
import { ALL_PRESET_EXAMS, createExamFromPreset } from '../../data/defaultExams';
import { Sound } from '../../utils/audio';

interface AddExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddExam: (exam: ExamItem) => void;
  existingExamNames: string[];
  soundEnabled: boolean;
  initialCustomMode?: boolean;
}

export const AddExamModal: React.FC<AddExamModalProps> = ({
  isOpen,
  onClose,
  onAddExam,
  existingExamNames,
  soundEnabled,
  initialCustomMode = false,
}) => {
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(0);
  const [isCustomMode, setIsCustomMode] = useState(initialCustomMode);

  // Custom Form Fields
  const [customName, setCustomName] = useState('');
  const [customShortName, setCustomShortName] = useState('');
  const [customCategory, setCustomCategory] = useState<ExamItem['category']>('Civil Services');
  const [customConductingBody, setCustomConductingBody] = useState('');
  const [customTargetDate, setCustomTargetDate] = useState('');
  const [customRegStartDate, setCustomRegStartDate] = useState('');
  const [customRegEndDate, setCustomRegEndDate] = useState('');
  const [customIcon, setCustomIcon] = useState('🎓');
  const [customWebsite, setCustomWebsite] = useState('');
  const [customDescription, setCustomDescription] = useState('');

  // Initial Subject & Syllabus
  const [customSubjectName, setCustomSubjectName] = useState('Core Subject / Paper 1');
  const [customSyllabusText, setCustomSyllabusText] = useState(
    'Fundamental Concepts & Overview\nCore Theory & Principles\nPrevious Year Questions Practice\nMock Test & Revision'
  );

  // Stages selection
  const [includePrelims, setIncludePrelims] = useState(true);
  const [includeMains, setIncludeMains] = useState(true);
  const [includeInterview, setIncludeInterview] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsCustomMode(initialCustomMode);
    }
  }, [isOpen, initialCustomMode]);

  if (!isOpen) return null;

  const handleSelectPreset = (index: number) => {
    setSelectedPresetIndex(index);
    setIsCustomMode(false);
    Sound.click(soundEnabled);
  };

  const handleAddPresetExam = () => {
    const preset = ALL_PRESET_EXAMS[selectedPresetIndex];
    if (!preset) return;

    const newExam = createExamFromPreset(preset);
    onAddExam(newExam);
    Sound.success(soundEnabled);
    onClose();
  };

  const handleCreateCustomExam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !customTargetDate) return;

    // Parse syllabus lines into topics
    const parsedTopics = customSyllabusText
      .split('\n')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .map((t, idx) => ({
        id: `top-${Date.now()}-${idx + 1}`,
        title: t,
        completed: false,
      }));

    const initialSubject: ExamSubject = {
      id: `sub-${Date.now()}-1`,
      name: customSubjectName.trim() || 'Core Subject 1',
      code: 'PAPER-1',
      description: 'Initial syllabus topics configured by user.',
      topics: parsedTopics.length > 0 ? parsedTopics : [
        { id: `top-${Date.now()}-1`, title: 'General Overview & Fundamentals', completed: false },
        { id: `top-${Date.now()}-2`, title: 'Core Principles & Analysis', completed: false },
      ],
    };

    const initialStages = [];
    if (customRegStartDate || customRegEndDate) {
      initialStages.push({
        id: `stg-${Date.now()}-reg`,
        name: 'Registration Window',
        startDate: customRegStartDate,
        endDate: customRegEndDate,
        status: 'upcoming' as const,
      });
    }

    if (includePrelims) {
      initialStages.push({
        id: `stg-${Date.now()}-pre`,
        name: 'Preliminary Examination',
        date: customTargetDate,
        status: 'upcoming' as const,
      });
    }

    if (includeMains) {
      initialStages.push({
        id: `stg-${Date.now()}-main`,
        name: 'Main Examination',
        status: 'upcoming' as const,
      });
    }

    if (includeInterview) {
      initialStages.push({
        id: `stg-${Date.now()}-int`,
        name: 'Personality Test / Interview',
        status: 'upcoming' as const,
      });
    }

    if (initialStages.length === 0) {
      initialStages.push({
        id: `stg-${Date.now()}-1`,
        name: 'Target Examination Date',
        date: customTargetDate,
        status: 'upcoming' as const,
      });
    }

    const newExam: ExamItem = {
      id: `exam-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: customName.trim(),
      shortName: customShortName.trim() || customName.slice(0, 10).toUpperCase(),
      category: customCategory,
      conductingBody: customConductingBody.trim() || 'Exam Board',
      targetExamDate: customTargetDate,
      registrationStartDate: customRegStartDate || undefined,
      registrationEndDate: customRegEndDate || undefined,
      currentStage: initialStages[0]?.name || 'Preparation Stage',
      officialWebsite: customWebsite.trim() || undefined,
      icon: customIcon,
      badgeColor: '#4F46E5',
      description: customDescription.trim() || 'Custom competitive examination goal.',
      pattern: {
        mode: 'Written / Computer-Based Test (CBT)',
        totalDuration: 'Standard Duration',
        totalMarks: '100',
        negativeMarking: 'As per notification',
      },
      stages: initialStages,
      subjects: [initialSubject],
      books: [],
      strategyNotes: 'Focus on syllabus coverage, regular revisions, and mock test analysis.',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    onAddExam(newExam);
    Sound.success(soundEnabled);
    onClose();
  };

  const currentPreset = ALL_PRESET_EXAMS[selectedPresetIndex];
  const isAlreadyAdded = currentPreset && existingExamNames.includes(currentPreset.name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#111827] w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              🎓
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Add Examination</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Choose a pre-configured competitive exam or create your own custom syllabus
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 pb-1 border-b border-gray-100 dark:border-gray-800/80 bg-gray-50/70 dark:bg-gray-900/40">
          <button
            type="button"
            onClick={() => setIsCustomMode(false)}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              !isCustomMode
                ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-xs border border-gray-200 dark:border-gray-700'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Select from Pre-Configured Exams (OPSC, UPSC, CAT, etc.)</span>
          </button>
          <button
            type="button"
            onClick={() => setIsCustomMode(true)}
            className={`py-2 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              isCustomMode
                ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-xs border border-gray-200 dark:border-gray-700'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Custom Exam</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {!isCustomMode ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                  Select Examination
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {ALL_PRESET_EXAMS.map((preset, idx) => {
                    const isSelected = selectedPresetIndex === idx;
                    const alreadyExists = existingExamNames.includes(preset.name);
                    const isFocus = [
                      'OPSC Odisha Civil Services Examination (OCS)',
                      'UPSC Civil Services Examination (CSE)',
                      'Common Admission Test (CAT) - IIMs',
                    ].includes(preset.name);

                    return (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => handleSelectPreset(idx)}
                        className={`text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between relative ${
                          isSelected
                            ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20'
                            : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-gray-800/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{preset.icon}</span>
                            <div>
                              <div className="font-bold text-xs text-gray-900 dark:text-white flex items-center gap-1.5">
                                {preset.shortName}
                                {isFocus && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 font-extrabold uppercase">
                                    Focus
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1">
                                {preset.conductingBody}
                              </div>
                            </div>
                          </div>
                          {alreadyExists && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 shrink-0">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                          Target: <strong className="text-gray-800 dark:text-gray-200">{preset.targetExamDate}</strong> • {preset.subjects.length} Subjects
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected Preset Preview */}
              {currentPreset && (
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{currentPreset.icon}</span>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                          {currentPreset.name}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {currentPreset.conductingBody} • Category: {currentPreset.category}
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                    {currentPreset.description}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-xs border-t border-gray-200 dark:border-gray-700">
                    <div>
                      <span className="text-gray-400 font-semibold uppercase text-[10px] block">Target Date</span>
                      <strong className="text-gray-900 dark:text-white">{currentPreset.targetExamDate}</strong>
                    </div>
                    <div>
                      <span className="text-gray-400 font-semibold uppercase text-[10px] block">Subjects Included</span>
                      <strong className="text-gray-900 dark:text-white">{currentPreset.subjects.length} Papers/Sections</strong>
                    </div>
                    <div>
                      <span className="text-gray-400 font-semibold uppercase text-[10px] block">Stages</span>
                      <strong className="text-gray-900 dark:text-white">{currentPreset.stages.length} Stages</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Custom Exam Creation Form */
            <form id="custom-exam-form" onSubmit={handleCreateCustomExam} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                    Exam Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. State Public Service Commission"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                    Short Code / Acronym *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SPSC"
                    value={customShortName}
                    onChange={(e) => setCustomShortName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Civil Services">Civil Services</option>
                    <option value="State PSC">State PSC</option>
                    <option value="Management">Management</option>
                    <option value="Defense">Defense</option>
                    <option value="Medical">Medical</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Banking">Banking</option>
                    <option value="Judiciary">Judiciary</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                    Conducting Body / Board
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UPSC, State Commission, NTA"
                    value={customConductingBody}
                    onChange={(e) => setCustomConductingBody(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                    Emoji Icon
                  </label>
                  <input
                    type="text"
                    placeholder="🏛️"
                    value={customIcon}
                    onChange={(e) => setCustomIcon(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-white text-center focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                    Target Exam Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={customTargetDate}
                    onChange={(e) => setCustomTargetDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                    Reg. Start Date
                  </label>
                  <input
                    type="date"
                    value={customRegStartDate}
                    onChange={(e) => setCustomRegStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                    Reg. End Date
                  </label>
                  <input
                    type="date"
                    value={customRegEndDate}
                    onChange={(e) => setCustomRegEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Examination Stages Checkboxes */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  Examination Stages to Include
                </label>
                <div className="flex flex-wrap gap-4 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includePrelims}
                      onChange={(e) => setIncludePrelims(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-gray-700 dark:text-gray-300 font-semibold">Prelims / Screening</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeMains}
                      onChange={(e) => setIncludeMains(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-gray-700 dark:text-gray-300 font-semibold">Main Exam</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeInterview}
                      onChange={(e) => setIncludeInterview(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-gray-700 dark:text-gray-300 font-semibold">Interview / Personality Test</span>
                  </label>
                </div>
              </div>

              {/* Initial Syllabus Setup */}
              <div className="p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/60 space-y-2.5">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Initial Subject & Syllabus Topics</span>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                    First Subject / Paper Name
                  </label>
                  <input
                    type="text"
                    value={customSubjectName}
                    onChange={(e) => setCustomSubjectName(e.target.value)}
                    placeholder="e.g. General Studies Paper 1"
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-xs text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Type or Paste Syllabus Topics (one per line)
                  </label>
                  <textarea
                    rows={3}
                    value={customSyllabusText}
                    onChange={(e) => setCustomSyllabusText(e.target.value)}
                    placeholder="Ancient & Medieval History&#10;Indian Constitution & Polity&#10;Geography & Environment&#10;Economy & Social Development"
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-xs text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                  <span className="text-[10px] text-gray-400 block mt-0.5">
                    * You can add unlimited subjects, papers, and edit all syllabus topics in the detail view at any time.
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                  Official Website
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={customWebsite}
                  onChange={(e) => setCustomWebsite(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                  Description / Strategy Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Goals, target percentiles, eligibility notes..."
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white cursor-pointer"
          >
            Cancel
          </button>

          {!isCustomMode ? (
            <button
              type="button"
              onClick={handleAddPresetExam}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>
                {isAlreadyAdded ? `Add Another ${currentPreset?.shortName} Target` : `Add ${currentPreset?.shortName} to My Exams`}
              </span>
            </button>
          ) : (
            <button
              type="submit"
              form="custom-exam-form"
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create & Add Custom Exam</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
