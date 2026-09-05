import React, { useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  GraduationCap,
  Sparkles,
  BookOpen,
  Calendar,
  Layers,
  Award,
  ChevronDown,
  Compass,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { ExamItem } from '../types';
import { ExamListItem } from './exams/ExamListItem';
import { ExamDetailView } from './exams/ExamDetailView';
import { AddExamModal } from './exams/AddExamModal';
import { ExamCountdown } from './exams/ExamCountdown';
import { ALL_PRESET_EXAMS, createExamFromPreset } from '../data/defaultExams';
import { Sound } from '../utils/audio';

interface ExamsSectionProps {
  exams: ExamItem[];
  onUpdateExams: (exams: ExamItem[]) => void;
  soundEnabled: boolean;
}

export const ExamsSection: React.FC<ExamsSectionProps> = ({
  exams,
  onUpdateExams,
  soundEnabled,
}) => {
  // Navigation: My Exams is open by default
  const [activeTab, setActiveTab] = useState<'my-exams' | 'all-exams'>('my-exams');
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [initialCustomMode, setInitialCustomMode] = useState(false);

  // Active exam in detail view
  const activeExam = exams.find((e) => e.id === selectedExamId);

  // If activeExam is selected, show detail view
  if (activeExam) {
    const handleUpdateExam = (updated: Partial<ExamItem>) => {
      const updatedList = exams.map((e) => (e.id === activeExam.id ? { ...e, ...updated } : e));
      onUpdateExams(updatedList);
    };

    return (
      <ExamDetailView
        exam={activeExam}
        onBack={() => {
          setSelectedExamId(null);
          Sound.click(soundEnabled);
        }}
        onUpdateExam={handleUpdateExam}
        soundEnabled={soundEnabled}
      />
    );
  }

  // Add exam to My Exams
  const handleAddExam = (newExam: ExamItem) => {
    onUpdateExams([newExam, ...exams]);
    setSelectedExamId(newExam.id);
    Sound.success(soundEnabled);
  };

  const handleAddPresetByName = (presetName: string) => {
    const preset = ALL_PRESET_EXAMS.find((p) => p.name === presetName || p.shortName === presetName);
    if (!preset) return;

    // If already in exams, select it
    const existing = exams.find((e) => e.name === preset.name);
    if (existing) {
      setSelectedExamId(existing.id);
      Sound.click(soundEnabled);
      return;
    }

    const newExam = createExamFromPreset(preset);
    handleAddExam(newExam);
  };

  const handleDeleteExam = (examId: string) => {
    const updated = exams.filter((e) => e.id !== examId);
    onUpdateExams(updated);
    Sound.click(soundEnabled);
  };

  // Filtered user exams for "My Exams"
  const filteredMyExams = exams.filter((e) => {
    const matchesSearch =
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.shortName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.conductingBody.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Filtered preset exams for "All Exams"
  const filteredAllExams = ALL_PRESET_EXAMS.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.shortName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.conductingBody.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', 'Civil Services', 'State PSC', 'Management', 'Defense', 'Medical'];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xl shadow-2xs border border-indigo-100 dark:border-indigo-900/60">
            🎓
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="workspace-heading font-extrabold text-[#111827] dark:text-white tracking-tight">
                Exams
              </h1>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800">
                {exams.length} Tracked
              </span>
            </div>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">
              Competitive examinations hub with syllabus spreadsheets, prelims/mains/interview stages, and live countdowns
            </p>
          </div>
        </div>

        {/* Primary Controls: Quick Add Selector & Add Exam Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Preset Selection Dropdown */}
          <div className="relative">
            <select
              onChange={(e) => {
                const val = e.target.value;
                if (!val) return;
                if (val === 'custom') {
                  setInitialCustomMode(true);
                  setIsAddModalOpen(true);
                } else {
                  handleAddPresetByName(val);
                }
                e.target.value = '';
              }}
              defaultValue=""
              className="appearance-none pl-3 pr-8 py-2 rounded-xl bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-800/80 text-xs font-bold text-gray-800 dark:text-gray-200 shadow-2xs hover:border-indigo-500 transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="" disabled>
                ⚡ Quick Add from Catalog...
              </option>
              <optgroup label="State & National Civil Services">
                <option value="OPSC Odisha Civil Services Examination (OCS)">🏛️ OPSC OCS (Odisha Civil Services - Drishti IAS)</option>
                <option value="UPSC Civil Services Examination (CSE)">🏛️ UPSC CSE (Civil Services - IAS/IPS/IFS)</option>
              </optgroup>
              <optgroup label="Management & Defence">
                <option value="Common Admission Test (CAT) - IIMs">📈 CAT (IIMs - VARC, DILR, QA)</option>
                <option value="Combined Defence Services (CDS) - UPSC">🎖️ CDS (UPSC - Defense)</option>
                <option value="National Defence Academy (NDA) - UPSC">🛡️ NDA & NA (UPSC - Armed Forces)</option>
                <option value="National Eligibility cum Entrance Test (NEET-UG)">🩺 NEET-UG (Medical Entrance)</option>
              </optgroup>
              <optgroup label="Custom">
                <option value="custom">+ Create New Custom Exam from Scratch...</option>
              </optgroup>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button
            type="button"
            onClick={() => {
              setInitialCustomMode(false);
              setIsAddModalOpen(true);
              Sound.click(soundEnabled);
            }}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Exam</span>
          </button>
        </div>
      </div>

      {/* Main Tabs Navigation: My Exams vs All Exams Catalog */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('my-exams');
              Sound.click(soundEnabled);
            }}
            className={`py-2.5 px-4 font-bold text-xs sm:text-sm border-b-2 flex items-center gap-2 cursor-pointer transition-all ${
              activeTab === 'my-exams'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>My Tracked Exams</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-extrabold ${
                activeTab === 'my-exams'
                  ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
              }`}
            >
              {exams.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('all-exams');
              Sound.click(soundEnabled);
            }}
            className={`py-2.5 px-4 font-bold text-xs sm:text-sm border-b-2 flex items-center gap-2 cursor-pointer transition-all ${
              activeTab === 'all-exams'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>All Exams Catalog</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 font-extrabold">
              {ALL_PRESET_EXAMS.length}
            </span>
          </button>
        </div>

        {activeTab === 'my-exams' && exams.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Are you sure you want to clear all tracked exams and reset to a clean blank state?')) {
                onUpdateExams([]);
                Sound.click(soundEnabled);
              }
            }}
            className="text-[11px] text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 font-semibold cursor-pointer transition-colors"
          >
            Reset to Blank
          </button>
        )}
      </div>

      {/* Search & Category Filter (Visible when there are items) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search exams, boards, papers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setCategoryFilter(cat);
                Sound.click(soundEnabled);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-colors cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: MY EXAMS VIEW */}
      {/* ===================================================================== */}
      {activeTab === 'my-exams' && (
        <>
          {exams.length === 0 ? (
            /* Blank State Page with prominent Add options */
            <div className="p-8 sm:p-14 text-center rounded-3xl bg-white dark:bg-[#111827] border border-dashed border-indigo-200 dark:border-indigo-900/60 shadow-xs space-y-8 animate-in fade-in duration-300">
              <div className="max-w-md mx-auto space-y-3">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-indigo-100 to-purple-100 dark:from-indigo-950/80 dark:to-purple-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-3xl shadow-sm border border-indigo-200/60 dark:border-indigo-800/80">
                  🎯
                </div>
                <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                  My Exam Preparation Hub
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  Your tracked exams list is currently empty. Get started by adding a pre-configured examination with complete syllabus, or build your own custom roadmap.
                </p>
              </div>

              {/* Two Prominent Action Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl mx-auto text-left">
                {/* Option 1: Choose from All Exams Catalog */}
                <div className="group p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/70 hover:border-indigo-500 transition-all flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                      <Sparkles className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Trusted Syllabi</span>
                    </div>
                    <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                      Add from All Exams Catalog
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                      Instant 1-click tracking for trusted national and state examinations with detailed official syllabi:
                    </p>
                    <ul className="text-xs space-y-1 text-gray-600 dark:text-gray-400 pt-1">
                      <li className="flex items-center gap-1.5 font-medium">
                        <span className="text-indigo-500">✓</span>
                        <strong>OPSC OCS:</strong> Exact syllabus from Drishti IAS (9 papers + prelims)
                      </li>
                      <li className="flex items-center gap-1.5 font-medium">
                        <span className="text-indigo-500">✓</span>
                        <strong>UPSC CSE:</strong> Full GS 1-4, Essay, CSAT, & Optional
                      </li>
                      <li className="flex items-center gap-1.5 font-medium">
                        <span className="text-indigo-500">✓</span>
                        <strong>CAT (IIMs):</strong> Comprehensive VARC, DILR, & QA topics
                      </li>
                    </ul>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('all-exams');
                        Sound.click(soundEnabled);
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Browse Catalog & Add</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Option 2: Create Custom Exam */}
                <div className="group p-5 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/70 hover:border-purple-500 transition-all flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                      <Plus className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Fully Customizable</span>
                    </div>
                    <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                      Create Custom Exam on Your Own
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                      Build an examination tracker tailored to your specific targets:
                    </p>
                    <ul className="text-xs space-y-1 text-gray-600 dark:text-gray-400 pt-1">
                      <li className="flex items-center gap-1.5 font-medium">
                        <span className="text-purple-500">✓</span>
                        Set custom exam dates & registration window
                      </li>
                      <li className="flex items-center gap-1.5 font-medium">
                        <span className="text-purple-500">✓</span>
                        Define examination stages (Prelims, Mains, Interview)
                      </li>
                      <li className="flex items-center gap-1.5 font-medium">
                        <span className="text-purple-500">✓</span>
                        Type or upload custom subjects and syllabus topics
                      </li>
                    </ul>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setInitialCustomMode(true);
                        setIsAddModalOpen(true);
                        Sound.click(soundEnabled);
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create Custom Exam</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick 1-Click Preset Addition Bar */}
              <div className="pt-4 max-w-xl mx-auto border-t border-gray-100 dark:border-gray-800">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-3">
                  Or One-Click Add Target Focus Exams:
                </span>
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddPresetByName('OPSC Odisha Civil Services Examination (OCS)')}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-800 dark:text-amber-200 font-bold text-xs border border-amber-300 dark:border-amber-800 cursor-pointer shadow-2xs"
                  >
                    + Add OPSC OCS (Drishti IAS Syllabus)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddPresetByName('UPSC Civil Services Examination (CSE)')}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-800 dark:text-indigo-200 font-bold text-xs border border-indigo-300 dark:border-indigo-800 cursor-pointer shadow-2xs"
                  >
                    + Add UPSC CSE (Full 9 Papers)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddPresetByName('Common Admission Test (CAT) - IIMs')}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-200 font-bold text-xs border border-emerald-300 dark:border-emerald-800 cursor-pointer shadow-2xs"
                  >
                    + Add CAT (IIMs)
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* User Has Tracked Exams: Render List View */
            <div className="space-y-3">
              {filteredMyExams.length > 0 ? (
                <div className="space-y-3">
                  {filteredMyExams.map((exam) => (
                    <ExamListItem
                      key={exam.id}
                      exam={exam}
                      onOpen={(item) => {
                        setSelectedExamId(item.id);
                        Sound.click(soundEnabled);
                      }}
                      onDelete={handleDeleteExam}
                    />
                  ))}

                  {/* Add Another Exam Row in the List */}
                  <button
                    type="button"
                    onClick={() => {
                      setInitialCustomMode(false);
                      setIsAddModalOpen(true);
                      Sound.click(soundEnabled);
                    }}
                    className="w-full p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-800 hover:border-indigo-500 dark:hover:border-indigo-500 bg-white/50 dark:bg-gray-900/30 flex items-center justify-center gap-2 cursor-pointer transition-all text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-xs font-bold">Add Another Exam (from catalog or create custom)</span>
                  </button>
                </div>
              ) : (
                <div className="p-10 text-center rounded-2xl bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No tracked exams match your search query "{searchQuery}".
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: ALL EXAMS DIRECTORY / CATALOG */}
      {/* ===================================================================== */}
      {activeTab === 'all-exams' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                Official Pre-Configured Examination Directory
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                Curated, comprehensive syllabi verified against official commission portals and trusted sources (e.g. Drishti IAS). Click "Add to My Exams" to track any examination.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {filteredAllExams.map((preset) => {
              const isAlreadyAdded = exams.some((e) => e.name === preset.name);
              const totalTopicsCount = preset.subjects.reduce((sum, s) => sum + s.topics.length, 0);

              return (
                <div
                  key={preset.name}
                  className="bg-white dark:bg-[#111827] rounded-xl border border-gray-200 dark:border-gray-800 hover:border-indigo-500/60 p-3.5 sm:p-4 shadow-2xs hover:shadow-xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-3.5"
                >
                  {/* Left: Important Details */}
                  <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-xl flex items-center justify-center border border-indigo-100 dark:border-indigo-900/60 shadow-2xs shrink-0">
                      {preset.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate">
                          {preset.name}
                        </h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                          {preset.shortName}
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium px-2 py-0.5 rounded bg-gray-50 dark:bg-gray-800/50">
                          {preset.category}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-500 dark:text-gray-400">
                        <span>{preset.conductingBody}</span>
                        <span>•</span>
                        <span>{preset.subjects.length} Papers ({totalTopicsCount} Topics)</span>
                        <span>•</span>
                        <span>Target: {new Date(preset.targetExamDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        {preset.officialWebsite && (
                          <>
                            <span>•</span>
                            <a
                              href={preset.officialWebsite}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                            >
                              <span>Official Site</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Center: Live Countdown Component */}
                  <div className="shrink-0 flex items-center gap-3">
                    <ExamCountdown
                      targetDateStr={preset.targetExamDate}
                      label={preset.shortName}
                      size="list"
                    />
                  </div>

                  {/* Right: Actions */}
                  <div className="shrink-0 flex items-center gap-2 self-end md:self-auto">
                    {isAlreadyAdded ? (
                      <button
                        type="button"
                        onClick={() => {
                          const existing = exams.find((e) => e.name === preset.name);
                          if (existing) setSelectedExamId(existing.id);
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold text-xs border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 cursor-pointer hover:bg-emerald-100 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Tracked (Open)</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAddPresetByName(preset.name)}
                        className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add to My Exams</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Exam Modal */}
      <AddExamModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddExam={handleAddExam}
        existingExamNames={exams.map((e) => e.name)}
        soundEnabled={soundEnabled}
        initialCustomMode={initialCustomMode}
      />
    </div>
  );
};
