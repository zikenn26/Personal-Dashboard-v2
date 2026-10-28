import React, { useState } from 'react';
import {
  GraduationCap,
  Plus,
  Edit2,
  Trash2,
  Award,
  Calendar,
  Building,
  MapPin,
  Sparkles,
  Check,
  X,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { EducationRecord, EducationLevel } from '../types';
import { Sound } from '../utils/audio';

interface EducationSectionProps {
  educationRecords: EducationRecord[];
  onUpdateEducation: (records: EducationRecord[]) => void;
  soundEnabled: boolean;
}

const PRESET_LEVELS: Array<{ level: EducationLevel; defaultTitle: string; icon: string; order: number }> = [
  { level: 'postgraduation', defaultTitle: "Postgraduation (Master's Degree)", icon: '🎓', order: 1 },
  { level: 'graduation', defaultTitle: "Graduation (Bachelor's Degree)", icon: '🏛️', order: 2 },
  { level: 'intermediate', defaultTitle: 'Intermediate (+2 / Class 12th)', icon: '📐', order: 3 },
  { level: 'matriculation', defaultTitle: 'Matriculation (Class 10th / Secondary)', icon: '🎒', order: 4 },
  { level: 'doctorate', defaultTitle: 'Doctorate (Ph.D)', icon: '📜', order: 0 },
  { level: 'diploma', defaultTitle: 'Diploma / Associate Degree', icon: '📋', order: 5 },
  { level: 'certification', defaultTitle: 'Professional Certification', icon: '🎖️', order: 6 },
  { level: 'other', defaultTitle: 'Other Academic Qualification', icon: '📚', order: 7 },
];

export const EducationSection: React.FC<EducationSectionProps> = ({
  educationRecords,
  onUpdateEducation,
  soundEnabled,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<EducationRecord | null>(null);

  // Form State
  const [formLevel, setFormLevel] = useState<EducationLevel>('graduation');
  const [formLevelTitle, setFormLevelTitle] = useState('');
  const [formDegree, setFormDegree] = useState('');
  const [formInstitution, setFormInstitution] = useState('');
  const [formBoard, setFormBoard] = useState('');
  const [formYear, setFormYear] = useState('');
  const [formScore, setFormScore] = useState('');
  const [formScoreType, setFormScoreType] = useState<'percentage' | 'cgpa' | 'grade'>('cgpa');
  const [formSpecialization, setFormSpecialization] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formHighlights, setFormHighlights] = useState('');
  const [formIcon, setFormIcon] = useState('🎓');

  const openAddModal = (defaultLevel?: EducationLevel) => {
    Sound.click(soundEnabled);
    const targetLevel = defaultLevel || 'graduation';
    const preset = PRESET_LEVELS.find((p) => p.level === targetLevel);

    setEditingRecord(null);
    setFormLevel(targetLevel);
    setFormLevelTitle(preset?.defaultTitle || "Bachelor's Degree");
    setFormDegree('');
    setFormInstitution('');
    setFormBoard('');
    setFormYear('');
    setFormScore('');
    setFormScoreType('cgpa');
    setFormSpecialization('');
    setFormLocation('India');
    setFormHighlights('');
    setFormIcon(preset?.icon || '🎓');
    setShowModal(true);
  };

  const openEditModal = (rec: EducationRecord) => {
    Sound.click(soundEnabled);
    setEditingRecord(rec);
    setFormLevel(rec.level);
    setFormLevelTitle(rec.levelTitle);
    setFormDegree(rec.degree);
    setFormInstitution(rec.institution);
    setFormBoard(rec.boardOrUniversity || '');
    setFormYear(rec.year);
    setFormScore(rec.score);
    setFormScoreType(rec.scoreType || 'cgpa');
    setFormSpecialization(rec.specialization || '');
    setFormLocation(rec.location || '');
    setFormHighlights(rec.highlights ? rec.highlights.join('\n') : '');
    setFormIcon(rec.icon || '🎓');
    setShowModal(true);
  };

  const handleDeleteRecord = (id: string) => {
    Sound.click(soundEnabled);
    const updated = educationRecords.filter((r) => r.id !== id);
    onUpdateEducation(updated);
  };

  const handleSaveRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDegree.trim() || !formInstitution.trim()) return;

    Sound.success(soundEnabled);

    const highlightsArray = formHighlights
      .split('\n')
      .map((h) => h.trim())
      .filter(Boolean);

    if (editingRecord) {
      const updated = educationRecords.map((r) =>
        r.id === editingRecord.id
          ? {
              ...r,
              level: formLevel,
              levelTitle: formLevelTitle || PRESET_LEVELS.find((p) => p.level === formLevel)?.defaultTitle || formLevel,
              degree: formDegree.trim(),
              institution: formInstitution.trim(),
              boardOrUniversity: formBoard.trim() || undefined,
              year: formYear.trim(),
              score: formScore.trim(),
              scoreType: formScoreType,
              specialization: formSpecialization.trim() || undefined,
              location: formLocation.trim() || undefined,
              highlights: highlightsArray.length > 0 ? highlightsArray : undefined,
              icon: formIcon,
            }
          : r
      );
      onUpdateEducation(updated);
    } else {
      const newRecord: EducationRecord = {
        id: `edu-${Date.now()}`,
        level: formLevel,
        levelTitle: formLevelTitle || PRESET_LEVELS.find((p) => p.level === formLevel)?.defaultTitle || formLevel,
        degree: formDegree.trim(),
        institution: formInstitution.trim(),
        boardOrUniversity: formBoard.trim() || undefined,
        year: formYear.trim(),
        score: formScore.trim(),
        scoreType: formScoreType,
        specialization: formSpecialization.trim() || undefined,
        location: formLocation.trim() || undefined,
        highlights: highlightsArray.length > 0 ? highlightsArray : undefined,
        icon: formIcon,
      };
      onUpdateEducation([...educationRecords, newRecord]);
    }

    setShowModal(false);
  };

  // Group or sort records by academic tier
  const sortedRecords = [...educationRecords].sort((a, b) => {
    const orderA = PRESET_LEVELS.find((p) => p.level === a.level)?.order ?? 99;
    const orderB = PRESET_LEVELS.find((p) => p.level === b.level)?.order ?? 99;
    return orderA - orderB;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EDECE9] dark:border-[#1F2937]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="workspace-heading font-black text-[#111827] dark:text-white flex items-center gap-2.5">
              <GraduationCap className="w-6 h-6 text-[#6366F1]" />
              <span>Academic &amp; Schooling Records</span>
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-[#EEF2FF] dark:bg-[#312E81] text-[#6366F1] dark:text-[#A5B4FC] text-xs font-bold uppercase tracking-wider">
              {educationRecords.length} Tiers
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#6B7280] dark:text-[#9CA3AF] mt-1">
            Complete academic pedigree spanning Matriculation (10th), Intermediate (12th), Graduation, and Postgraduation with scores, passing years, and institutions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openAddModal('postgraduation')}
            className="px-3.5 py-2 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Education</span>
          </button>
        </div>
      </div>

      {/* Quick Tier Status Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Postgraduation', level: 'postgraduation', icon: '🎓' },
          { label: 'Graduation', level: 'graduation', icon: '🏛️' },
          { label: 'Intermediate (+2)', level: 'intermediate', icon: '📐' },
          { label: 'Matriculation (10th)', level: 'matriculation', icon: '🎒' },
        ].map((tier) => {
          const matching = educationRecords.find((r) => r.level === tier.level);
          return (
            <div
              key={tier.level}
              onClick={() => {
                if (matching) {
                  openEditModal(matching);
                } else {
                  openAddModal(tier.level as EducationLevel);
                }
              }}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 ${
                matching
                  ? 'bg-white dark:bg-[#1E293B] border-emerald-200 dark:border-emerald-900/50 shadow-2xs hover:border-emerald-500'
                  : 'bg-[#F8FAFC] dark:bg-[#0F172A] border-dashed border-[#CBD5E1] dark:border-[#334155] hover:border-[#6366F1] hover:bg-white dark:hover:bg-[#1E293B]'
              }`}
            >
              <span className="text-2xl">{tier.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[#111827] dark:text-white truncate">
                  {tier.label}
                </p>
                {matching ? (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold truncate flex items-center gap-1">
                    <span>{matching.score}</span>
                    <span>•</span>
                    <span>{matching.year}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-[#6366F1] font-medium flex items-center gap-1">
                    <Plus className="w-3 h-3" />
                    <span>Add Record</span>
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Records List / Timeline */}
      {sortedRecords.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-dashed border-[#E2E8F0] dark:border-[#334155] space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-[#6366F1] flex items-center justify-center mx-auto text-2xl">
            🎓
          </div>
          <h3 className="text-base font-bold text-[#111827] dark:text-white">
            No Education Records Yet
          </h3>
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] max-w-md mx-auto">
            Add your schooling milestones: Matriculation (10th), Intermediate (12th), Graduation, and Postgraduation to showcase your academic profile.
          </p>
          <button
            type="button"
            onClick={() => openAddModal('graduation')}
            className="px-4 py-2 rounded-xl bg-[#6366F1] text-white text-xs font-bold hover:bg-[#4F46E5] cursor-pointer"
          >
            + Add First Education Record
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedRecords.map((rec, index) => (
            <div
              key={rec.id}
              className="relative p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] shadow-2xs hover:border-[#6366F1] dark:hover:border-[#6366F1] transition-all group"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                {/* Left side: Icon, Degree, School, Details */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#EEF2FF] dark:bg-[#312E81]/60 border border-[#E0E7FF] dark:border-[#4338CA] flex items-center justify-center text-2xl shrink-0 shadow-2xs">
                    {rec.icon || '🎓'}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-[#F1F5F9] dark:bg-[#0F172A] text-[#475569] dark:text-[#94A3B8] text-[11px] font-bold uppercase tracking-wider">
                        {rec.levelTitle || rec.level}
                      </span>
                      {rec.score && (
                        <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                          <Award className="w-3 h-3" />
                          <span>Score: {rec.score}</span>
                        </span>
                      )}
                      {rec.year && (
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-[#6366F1] dark:text-[#A5B4FC] text-xs font-semibold flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{rec.year}</span>
                        </span>
                      )}
                    </div>

                    <h3 className="text-base sm:text-lg font-black text-[#111827] dark:text-white group-hover:text-[#6366F1] transition-colors">
                      {rec.degree}
                    </h3>

                    <p className="text-xs sm:text-sm font-semibold text-[#4B5563] dark:text-[#D1D5DB] flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1 text-[#111827] dark:text-white">
                        <Building className="w-3.5 h-3.5 text-[#6366F1]" />
                        <span>{rec.institution}</span>
                      </span>
                      {rec.boardOrUniversity && (
                        <>
                          <span className="text-[#9CA3AF]">•</span>
                          <span className="text-[#6B7280] dark:text-[#9CA3AF]">
                            {rec.boardOrUniversity}
                          </span>
                        </>
                      )}
                      {rec.location && (
                        <>
                          <span className="text-[#9CA3AF]">•</span>
                          <span className="text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            <span>{rec.location}</span>
                          </span>
                        </>
                      )}
                    </p>

                    {rec.specialization && (
                      <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                        <span className="font-semibold text-[#374151] dark:text-[#E5E7EB]">Specialization:</span>{' '}
                        {rec.specialization}
                      </p>
                    )}

                    {rec.highlights && rec.highlights.length > 0 && (
                      <div className="pt-2 space-y-1">
                        {rec.highlights.map((h, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 text-xs text-[#4B5563] dark:text-[#9CA3AF]"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1]" />
                            <span>{h}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right side: Action buttons */}
                <div className="flex items-center gap-1 sm:self-start opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => openEditModal(rec)}
                    className="p-2 rounded-xl text-[#6B7280] hover:text-[#6366F1] hover:bg-[#EEF2FF] dark:hover:bg-[#1E1B4B] transition-all cursor-pointer"
                    title="Edit Record"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteRecord(rec.id)}
                    className="p-2 rounded-xl text-[#6B7280] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 transition-all cursor-pointer"
                    title="Delete Record"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Education Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9] dark:border-[#334155]">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{formIcon}</span>
                <h3 className="text-base font-black text-[#111827] dark:text-white">
                  {editingRecord ? 'Edit Academic Record' : 'Add Academic Milestone'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRecord} className="space-y-4">
              {/* Level Selector */}
              <div>
                <label className="block text-xs font-bold text-[#374151] dark:text-[#D1D5DB] mb-1.5">
                  Academic Level / Tier
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PRESET_LEVELS.slice(0, 4).map((tier) => (
                    <button
                      key={tier.level}
                      type="button"
                      onClick={() => {
                        setFormLevel(tier.level);
                        setFormLevelTitle(tier.defaultTitle);
                        setFormIcon(tier.icon);
                      }}
                      className={`p-2 rounded-xl text-xs font-bold border transition-all text-center flex flex-col items-center gap-1 cursor-pointer ${
                        formLevel === tier.level
                          ? 'bg-[#EEF2FF] dark:bg-[#312E81] border-[#6366F1] text-[#6366F1] dark:text-white'
                          : 'bg-[#F8FAFC] dark:bg-[#0F172A] border-[#E2E8F0] dark:border-[#334155] text-[#64748B] hover:bg-white dark:hover:bg-[#1E293B]'
                      }`}
                    >
                      <span className="text-lg">{tier.icon}</span>
                      <span className="truncate w-full">{tier.level.toUpperCase()}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Degree / Certificate Title */}
              <div>
                <label className="block text-xs font-bold text-[#374151] dark:text-[#D1D5DB] mb-1">
                  Degree / Certificate Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. B.Tech in Computer Science / Senior Secondary Examination"
                  value={formDegree}
                  onChange={(e) => setFormDegree(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs text-[#111827] dark:text-white focus:outline-hidden focus:border-[#6366F1]"
                />
              </div>

              {/* Institution / College / School */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#374151] dark:text-[#D1D5DB] mb-1">
                    School / College / University *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. National Institute of Technology"
                    value={formInstitution}
                    onChange={(e) => setFormInstitution(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs text-[#111827] dark:text-white focus:outline-hidden focus:border-[#6366F1]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#374151] dark:text-[#D1D5DB] mb-1">
                    Board / Affiliated University
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CBSE / ICSE / State Board"
                    value={formBoard}
                    onChange={(e) => setFormBoard(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs text-[#111827] dark:text-white focus:outline-hidden focus:border-[#6366F1]"
                  />
                </div>
              </div>

              {/* Year, Score & Score Type */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#374151] dark:text-[#D1D5DB] mb-1">
                    Year / Duration *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2018 - 2022 / 2016"
                    value={formYear}
                    onChange={(e) => setFormYear(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs text-[#111827] dark:text-white focus:outline-hidden focus:border-[#6366F1]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#374151] dark:text-[#D1D5DB] mb-1">
                    Score / Marks / CGPA *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 89.4% or 8.8 CGPA"
                    value={formScore}
                    onChange={(e) => setFormScore(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs text-[#111827] dark:text-white focus:outline-hidden focus:border-[#6366F1]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#374151] dark:text-[#D1D5DB] mb-1">
                    Format
                  </label>
                  <select
                    value={formScoreType}
                    onChange={(e) => setFormScoreType(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs text-[#111827] dark:text-white focus:outline-hidden"
                  >
                    <option value="cgpa">CGPA (out of 10)</option>
                    <option value="percentage">Percentage (%)</option>
                    <option value="grade">Letter Grade / Distinction</option>
                  </select>
                </div>
              </div>

              {/* Specialization & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#374151] dark:text-[#D1D5DB] mb-1">
                    Stream / Specialization
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Science (PCM) / Computer Science"
                    value={formSpecialization}
                    onChange={(e) => setFormSpecialization(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs text-[#111827] dark:text-white focus:outline-hidden focus:border-[#6366F1]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#374151] dark:text-[#D1D5DB] mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. New Delhi, India"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs text-[#111827] dark:text-white focus:outline-hidden focus:border-[#6366F1]"
                  />
                </div>
              </div>

              {/* Highlights & Achievements */}
              <div>
                <label className="block text-xs font-bold text-[#374151] dark:text-[#D1D5DB] mb-1">
                  Key Achievements / Honors (1 per line)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Top 5% in Board Examination&#10;Lead Capstone on AI Systems&#10;Dean's List with Distinction"
                  value={formHighlights}
                  onChange={(e) => setFormHighlights(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs text-[#111827] dark:text-white focus:outline-hidden focus:border-[#6366F1]"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F1F5F9] dark:border-[#334155]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#6B7280] dark:text-[#9CA3AF] hover:bg-gray-100 dark:hover:bg-gray-800 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-bold shadow-md transition-all cursor-pointer"
                >
                  {editingRecord ? 'Save Changes' : 'Add Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
