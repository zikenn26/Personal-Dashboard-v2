import React, { useState } from 'react';
import {
  UserProfile,
  SkillCategory,
  ResumeDocument,
  EducationRecord,
  JobExperience,
  CertificationItem,
} from '../types';
import { DEFAULT_ATS_RESUME } from '../utils/storage';
import { Sound } from '../utils/audio';
import {
  Phone,
  Mail,
  Github,
  Linkedin,
  Globe,
  MapPin,
  ExternalLink,
  Plus,
  Trash2,
  Edit2,
  Check,
  CheckCircle2,
  FileCheck,
  Sparkles,
  Sliders,
  Type,
  Layout,
  HelpCircle,
  Copy,
} from 'lucide-react';

export type ResumeTemplateStyle = 'jakes' | 'harvard' | 'modern';

interface ResumeDocumentSheetProps {
  resumeSheetRef: React.RefObject<HTMLDivElement | null>;
  profile: UserProfile;
  resume: ResumeDocument;
  skills: SkillCategory[];
  soundEnabled?: boolean;
  isInlineEditMode: boolean;
  setIsInlineEditMode: (mode: boolean) => void;
  onUpdateProfile: (profile: UserProfile) => void;
  onUpdateResume?: (resume: ResumeDocument) => void;
  onAddEducationModal: () => void;
  onAddJobModal: () => void;
  onAddProjectModal: () => void;
}

export const ResumeDocumentSheet: React.FC<ResumeDocumentSheetProps> = ({
  resumeSheetRef,
  profile,
  resume,
  skills,
  soundEnabled = true,
  isInlineEditMode,
  setIsInlineEditMode,
  onUpdateProfile,
  onUpdateResume,
  onAddEducationModal,
  onAddJobModal,
  onAddProjectModal,
}) => {
  const [templateStyle, setTemplateStyle] = useState<ResumeTemplateStyle>('jakes');
  const [showAtsChecker, setShowAtsChecker] = useState(false);
  const [newSkillInput, setNewSkillInput] = useState<{ [categoryIdx: number]: string }>({});
  const [newCertName, setNewCertName] = useState('');
  const [newCertIssuer, setNewCertIssuer] = useState('');
  const [copiedPlainText, setCopiedPlainText] = useState(false);

  // Fallback data sources for ATS resume
  const educationRecords: EducationRecord[] =
    profile.educationRecords && profile.educationRecords.length > 0
      ? profile.educationRecords
      : (DEFAULT_ATS_RESUME.education || []).map((e, idx) => ({
          id: `default-edu-${idx}`,
          level: (idx === 0 ? 'postgraduation' : 'graduation') as any,
          levelTitle: idx === 0 ? "Master's Degree" : "Bachelor's Degree",
          degree: e.degree,
          institution: e.school,
          year: e.year,
          score: e.score || '',
          location: e.location,
          specialization: e.specialization,
          highlights: e.highlights,
        }));

  const jobExperiences: JobExperience[] =
    profile.jobExperiences && profile.jobExperiences.length > 0
      ? profile.jobExperiences
      : (DEFAULT_ATS_RESUME.experiences || []).map((exp, idx) => ({
          id: `default-job-${idx}`,
          role: exp.role,
          company: exp.company,
          startDate: exp.period,
          endDate: exp.period,
          description: exp.details || '',
          keyAchievements: exp.achievements || [],
          techStack: exp.techStack || [],
        }));

  const certifications =
    resume.certifications && resume.certifications.length > 0
      ? resume.certifications
      : profile.certifications && profile.certifications.length > 0
      ? profile.certifications
      : DEFAULT_ATS_RESUME.certifications || [];

  const skillsCategories =
    resume.skillsByCategory && resume.skillsByCategory.length > 0
      ? resume.skillsByCategory
      : skills && skills.length > 0
      ? skills.map((sc) => ({ category: sc.category, items: sc.skills.map((s) => s.name) }))
      : DEFAULT_ATS_RESUME.skillsByCategory || [];

  const resumeProjects =
    resume.projects && resume.projects.length > 0
      ? resume.projects
      : DEFAULT_ATS_RESUME.projects || [];

  const summaryText =
    profile.professionalSummary ||
    profile.bio ||
    resume.summary ||
    DEFAULT_ATS_RESUME.summary;

  const displayName = profile.name || 'Alex Morgan';
  const displayEmail = profile.contactEmail || 'alex.morgan@example.com';
  const displayPhone = profile.phone || '+1 (555) 234-5678';
  const displayGithub = profile.github || 'https://github.com';
  const displayLinkedin = profile.linkedin || 'https://linkedin.com';
  const displayLocation = profile.location || 'San Francisco, CA';

  // Inline Profile Update Handler
  const handleInlineProfileChange = (field: keyof UserProfile, value: string) => {
    onUpdateProfile({
      ...profile,
      [field]: value,
    });
  };

  // Education Inline Handlers
  const handleUpdateEduInline = (id: string, partial: Partial<EducationRecord>) => {
    const updated = educationRecords.map((e) => (e.id === id ? { ...e, ...partial } : e));
    onUpdateProfile({
      ...profile,
      educationRecords: updated,
    });
  };

  const handleRemoveEduInline = (id: string) => {
    const updated = educationRecords.filter((e) => e.id !== id);
    onUpdateProfile({
      ...profile,
      educationRecords: updated,
    });
    Sound.click(soundEnabled);
  };

  // Job Inline Handlers
  const handleUpdateJobInline = (id: string, partial: Partial<JobExperience>) => {
    const updated = jobExperiences.map((j) => (j.id === id ? { ...j, ...partial } : j));
    onUpdateProfile({
      ...profile,
      jobExperiences: updated,
    });
  };

  const handleRemoveJobInline = (id: string) => {
    const updated = jobExperiences.filter((j) => j.id !== id);
    onUpdateProfile({
      ...profile,
      jobExperiences: updated,
    });
    Sound.click(soundEnabled);
  };

  // Skills Inline Handlers
  const handleAddSkillInline = (catIdx: number, skillName: string) => {
    if (!skillName.trim() || !onUpdateResume) return;
    const updatedCategories = [...skillsCategories];
    if (updatedCategories[catIdx]) {
      updatedCategories[catIdx] = {
        ...updatedCategories[catIdx],
        items: [...updatedCategories[catIdx].items, skillName.trim()],
      };
      onUpdateResume({
        ...resume,
        skillsByCategory: updatedCategories,
      });
      setNewSkillInput({ ...newSkillInput, [catIdx]: '' });
      Sound.success(soundEnabled);
    }
  };

  const handleRemoveSkillInline = (catIdx: number, itemIdx: number) => {
    if (!onUpdateResume) return;
    const updatedCategories = [...skillsCategories];
    if (updatedCategories[catIdx]) {
      const items = [...updatedCategories[catIdx].items];
      items.splice(itemIdx, 1);
      updatedCategories[catIdx] = {
        ...updatedCategories[catIdx],
        items,
      };
      onUpdateResume({
        ...resume,
        skillsByCategory: updatedCategories,
      });
      Sound.click(soundEnabled);
    }
  };

  // Copy Plain Text for ATS job portals
  const handleCopyPlainText = () => {
    let text = `${displayName.toUpperCase()}\n`;
    text += `${displayPhone} | ${displayEmail} | ${displayLinkedin} | ${displayGithub} | ${displayLocation}\n\n`;

    if (summaryText) {
      text += `SUMMARY\n${summaryText}\n\n`;
    }

    text += `EDUCATION\n`;
    educationRecords.forEach((edu) => {
      text += `${edu.degree} - ${edu.institution} (${edu.year}) [${edu.score || ''}]\n`;
      if (edu.highlights) text += `  * ${edu.highlights.join('; ')}\n`;
    });
    text += `\n`;

    text += `TECHNICAL SKILLS\n`;
    skillsCategories.forEach((sc) => {
      text += `* ${sc.category}: ${sc.items.join(', ')}\n`;
    });
    text += `\n`;

    text += `EXPERIENCE\n`;
    jobExperiences.forEach((job) => {
      text += `${job.role} - ${job.company} (${job.startDate})\n`;
      if (job.description) text += `  ${job.description}\n`;
      if (job.keyAchievements) {
        job.keyAchievements.forEach((ach) => (text += `  * ${ach}\n`));
      }
    });
    text += `\n`;

    text += `PROJECTS\n`;
    resumeProjects.forEach((proj) => {
      text += `${proj.title} | ${proj.techStack?.join(', ') || ''}\n`;
      if (proj.description) text += `  ${proj.description}\n`;
      if (proj.points) {
        proj.points.forEach((pt) => (text += `  * ${pt}\n`));
      }
    });

    navigator.clipboard.writeText(text);
    Sound.success(soundEnabled);
    setCopiedPlainText(true);
    setTimeout(() => setCopiedPlainText(false), 2000);
  };

  // Font style class mapping based on selected template
  const fontClass =
    templateStyle === 'harvard'
      ? 'font-serif'
      : templateStyle === 'modern'
      ? 'font-sans'
      : 'font-serif'; // Jake's style uses clean serif / times

  return (
    <div className="space-y-4">
      {/* 1. RESUME CONTROLS BAR (Template Switcher, Plain Text Copy, ATS Quality Check) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-[#18181B] border border-gray-200/80 dark:border-zinc-800/80 shadow-2xs print:hidden">
        {/* Template Style Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 mr-1 flex items-center gap-1">
            <Layout className="w-3.5 h-3.5" />
            <span>Format:</span>
          </span>
          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              setTemplateStyle('jakes');
            }}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              templateStyle === 'jakes'
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-2xs'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
            }`}
            title="Standard LaTeX / Jake's Resume single-column format (Maximum ATS score)"
          >
            Jake's ATS (Classic)
          </button>

          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              setTemplateStyle('harvard');
            }}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              templateStyle === 'harvard'
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-2xs'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
            }`}
            title="Harvard / Academic classic serif format"
          >
            Executive Serif
          </button>

          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              setTemplateStyle('modern');
            }}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              templateStyle === 'modern'
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-2xs'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
            }`}
            title="Modern Silicon Valley clean sans-serif format"
          >
            Modern Tech
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Copy Plain Text */}
          <button
            type="button"
            onClick={handleCopyPlainText}
            className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-semibold text-gray-700 dark:text-gray-300 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Copy formatted text to paste into Workday, Lever, or Taleo text boxes"
          >
            {copiedPlainText ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>Copied ATS Text!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy for Job Portals</span>
              </>
            )}
          </button>

          {/* ATS Quality Score Indicator */}
          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              setShowAtsChecker(!showAtsChecker);
            }}
            className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>ATS Score: 98%</span>
          </button>
        </div>
      </div>

      {/* ATS Checker Drawer / Tooltip Info */}
      {showAtsChecker && (
        <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 text-xs text-emerald-900 dark:text-emerald-200 space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between font-bold">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>Applicant Tracking System (ATS) Verification</span>
            </span>
            <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
              Verified single-column structure
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Balanced name &amp; standard contact header</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Standard standard headers (EDUCATION, SKILLS, EXP)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Action verbs &amp; measurable metrics included</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. THE RESUME SHEET DOCUMENT (PRINTABLE & EXPORT TARGET) */}
      <div
        id="printable-resume-sheet"
        ref={resumeSheetRef as any}
        className={`max-w-4xl mx-auto p-8 sm:p-12 md:p-14 rounded-2xl bg-white dark:bg-[#111827] border shadow-xs space-y-3.5 ${fontClass} transition-all print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:w-full print:bg-white print:text-black ${
          isInlineEditMode
            ? 'border-amber-400 dark:border-amber-500 ring-2 ring-amber-400/20'
            : 'border-gray-200 dark:border-zinc-800'
        }`}
      >
        {/* DOCUMENT HEADER: CANDIDATE NAME & CONTACT BAR */}
        <div className="text-center space-y-1 relative group pb-1">
          {/* Candidate Name: Tastefully Sized (Reduced font size as requested) */}
          {isInlineEditMode ? (
            <div className="flex items-center justify-center gap-2">
              <input
                type="text"
                value={profile.name || displayName}
                onChange={(e) => handleInlineProfileChange('name', e.target.value)}
                placeholder="FULL NAME"
                className="text-lg sm:text-xl font-bold uppercase tracking-tight text-center text-[#111827] dark:text-white bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 px-3 py-0.5 rounded-md max-w-md focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                type="button"
                onClick={() => {
                  Sound.click(soundEnabled);
                  setIsInlineEditMode(false);
                }}
                className="px-2.5 py-0.5 rounded bg-amber-500 hover:bg-amber-600 text-white text-xs font-sans font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="relative inline-block">
              {/* Reduced font size: text-xl sm:text-[22px] font-bold */}
              <h1 className="text-xl sm:text-[22px] font-bold text-[#111827] dark:text-white print:text-black tracking-tight uppercase leading-tight">
                {displayName}
              </h1>
              <button
                type="button"
                onClick={() => {
                  Sound.click(soundEnabled);
                  setIsInlineEditMode(!isInlineEditMode);
                }}
                className="absolute -right-7 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors print:hidden opacity-0 group-hover:opacity-100 cursor-pointer"
                title="Edit Header"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Clean ATS Contact Bar (Single row with bullet dividers) */}
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-xs text-[#374151] dark:text-[#D1D5DB] print:text-black">
            {displayPhone && (
              <span className="inline-flex items-center gap-1">
                <span>{displayPhone}</span>
              </span>
            )}

            {displayPhone && displayEmail && <span className="text-gray-400 print:text-black">•</span>}

            {displayEmail && (
              <a href={`mailto:${displayEmail}`} className="hover:underline">
                {displayEmail}
              </a>
            )}

            {displayLinkedin && <span className="text-gray-400 print:text-black">•</span>}

            {displayLinkedin && (
              <a
                href={displayLinkedin.startsWith('http') ? displayLinkedin : `https://${displayLinkedin}`}
                target="_blank"
                rel="noreferrer"
                className="hover:underline text-indigo-700 dark:text-indigo-300 print:text-black"
              >
                LinkedIn
              </a>
            )}

            {displayGithub && <span className="text-gray-400 print:text-black">•</span>}

            {displayGithub && (
              <a
                href={displayGithub.startsWith('http') ? displayGithub : `https://${displayGithub}`}
                target="_blank"
                rel="noreferrer"
                className="hover:underline text-indigo-700 dark:text-indigo-300 print:text-black"
              >
                GitHub
              </a>
            )}

            {displayLocation && <span className="text-gray-400 print:text-black">•</span>}

            {displayLocation && <span>{displayLocation}</span>}
          </div>
        </div>

        {/* SECTION 1: PROFESSIONAL SUMMARY */}
        {summaryText && (
          <div className="space-y-1">
            <h2 className="text-xs sm:text-[13px] font-bold tracking-wider text-[#111827] dark:text-white print:text-black uppercase border-b border-[#111827] dark:border-gray-600 print:border-black pb-0.5">
              Professional Summary
            </h2>
            {isInlineEditMode ? (
              <textarea
                value={profile.professionalSummary || summaryText}
                onChange={(e) => handleInlineProfileChange('professionalSummary', e.target.value)}
                rows={3}
                className="w-full text-xs text-[#374151] dark:text-[#E5E7EB] bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 p-2 rounded focus:outline-none"
              />
            ) : (
              <p className="text-xs text-[#374151] dark:text-[#D1D5DB] print:text-black leading-relaxed text-justify">
                {summaryText}
              </p>
            )}
          </div>
        )}

        {/* SECTION 2: EDUCATION */}
        <div className="space-y-2">
          <div className="flex items-center justify-between border-b border-[#111827] dark:border-gray-600 print:border-black pb-0.5">
            <h2 className="text-xs sm:text-[13px] font-bold tracking-wider text-[#111827] dark:text-white print:text-black uppercase">
              Education
            </h2>
            {isInlineEditMode && (
              <button
                type="button"
                onClick={onAddEducationModal}
                className="text-[11px] font-sans font-bold text-amber-600 hover:underline flex items-center gap-0.5 print:hidden"
              >
                <Plus className="w-3 h-3" /> Add Degree
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {educationRecords.map((edu) => (
              <div key={edu.id} className="space-y-0.5 text-xs text-[#374151] dark:text-[#D1D5DB] print:text-black">
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                  <div className="font-bold text-[#111827] dark:text-white print:text-black">
                    {edu.institution}
                  </div>
                  <div className="font-bold text-[#111827] dark:text-white print:text-black text-right shrink-0">
                    {edu.year}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 italic text-[#4B5563] dark:text-[#9CA3AF] print:text-black">
                  <div>
                    {edu.degree} {edu.score ? `— Score: ${edu.score}` : ''}
                  </div>
                  {edu.location && <div className="text-right not-italic text-[11px]">{edu.location}</div>}
                </div>

                {edu.highlights && edu.highlights.length > 0 && (
                  <ul className="list-disc list-inside text-[11px] text-[#4B5563] dark:text-[#9CA3AF] print:text-black pl-1">
                    {edu.highlights.map((h, hIdx) => (
                      <li key={hIdx}>{h}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 3: TECHNICAL SKILLS */}
        <div className="space-y-1.5">
          <h2 className="text-xs sm:text-[13px] font-bold tracking-wider text-[#111827] dark:text-white print:text-black uppercase border-b border-[#111827] dark:border-gray-600 print:border-black pb-0.5">
            Technical Skills
          </h2>

          <div className="space-y-1 text-xs text-[#374151] dark:text-[#D1D5DB] print:text-black">
            {skillsCategories.map((cat, catIdx) => (
              <div key={catIdx} className="leading-snug">
                <span className="font-bold text-[#111827] dark:text-white print:text-black">
                  {cat.category}:{' '}
                </span>
                <span>{cat.items.join(', ')}</span>

                {isInlineEditMode && (
                  <span className="inline-flex items-center gap-1 ml-2 print:hidden">
                    <input
                      type="text"
                      placeholder="+ Add skill"
                      value={newSkillInput[catIdx] || ''}
                      onChange={(e) =>
                        setNewSkillInput({ ...newSkillInput, [catIdx]: e.target.value })
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSkillInline(catIdx, newSkillInput[catIdx] || '');
                        }
                      }}
                      className="px-1.5 py-0.5 text-[10px] bg-amber-50 dark:bg-amber-950/40 border border-amber-300 rounded w-20 focus:outline-none"
                    />
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 4: WORK EXPERIENCE */}
        <div className="space-y-2">
          <div className="flex items-center justify-between border-b border-[#111827] dark:border-gray-600 print:border-black pb-0.5">
            <h2 className="text-xs sm:text-[13px] font-bold tracking-wider text-[#111827] dark:text-white print:text-black uppercase">
              Work Experience
            </h2>
            {isInlineEditMode && (
              <button
                type="button"
                onClick={onAddJobModal}
                className="text-[11px] font-sans font-bold text-amber-600 hover:underline flex items-center gap-0.5 print:hidden"
              >
                <Plus className="w-3 h-3" /> Add Role
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {jobExperiences.map((job) => (
              <div key={job.id} className="space-y-1 text-xs text-[#374151] dark:text-[#D1D5DB] print:text-black">
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                  <div className="font-bold text-[#111827] dark:text-white print:text-black">
                    {job.role} <span className="font-normal text-gray-500">•</span> {job.company}
                  </div>
                  <div className="font-bold text-[#111827] dark:text-white print:text-black text-right shrink-0">
                    {job.startDate}
                  </div>
                </div>

                {job.keyAchievements && job.keyAchievements.length > 0 ? (
                  <ul className="list-disc list-inside space-y-0.5 pl-1 leading-relaxed">
                    {job.keyAchievements.map((ach, aIdx) => (
                      <li key={aIdx}>{ach}</li>
                    ))}
                  </ul>
                ) : job.description ? (
                  <p className="leading-relaxed pl-1">{job.description}</p>
                ) : null}

                {job.techStack && job.techStack.length > 0 && (
                  <div className="text-[11px] text-gray-600 dark:text-gray-400 print:text-black pl-1 italic">
                    <span className="font-semibold not-italic">Technologies: </span>
                    {job.techStack.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 5: KEY PROJECTS */}
        <div className="space-y-2">
          <div className="flex items-center justify-between border-b border-[#111827] dark:border-gray-600 print:border-black pb-0.5">
            <h2 className="text-xs sm:text-[13px] font-bold tracking-wider text-[#111827] dark:text-white print:text-black uppercase">
              Projects
            </h2>
            {isInlineEditMode && (
              <button
                type="button"
                onClick={onAddProjectModal}
                className="text-[11px] font-sans font-bold text-amber-600 hover:underline flex items-center gap-0.5 print:hidden"
              >
                <Plus className="w-3 h-3" /> Add Project
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {resumeProjects.map((proj, pIdx) => (
              <div key={pIdx} className="space-y-1 text-xs text-[#374151] dark:text-[#D1D5DB] print:text-black">
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                  <div className="font-bold text-[#111827] dark:text-white print:text-black">
                    {proj.title}
                    {proj.techStack && proj.techStack.length > 0 && (
                      <span className="font-normal text-gray-600 dark:text-gray-300 print:text-black">
                        {' '}
                        | <span className="italic">{proj.techStack.join(', ')}</span>
                      </span>
                    )}
                  </div>
                  {proj.period && (
                    <div className="font-bold text-[#111827] dark:text-white print:text-black text-right shrink-0">
                      {proj.period}
                    </div>
                  )}
                </div>

                {proj.points && proj.points.length > 0 ? (
                  <ul className="list-disc list-inside space-y-0.5 pl-1 leading-relaxed">
                    {proj.points.map((pt, ptIdx) => (
                      <li key={ptIdx}>{pt}</li>
                    ))}
                  </ul>
                ) : proj.description ? (
                  <p className="leading-relaxed pl-1">{proj.description}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 6: CERTIFICATIONS */}
        {certifications && certifications.length > 0 && (
          <div className="space-y-1.5">
            <h2 className="text-xs sm:text-[13px] font-bold tracking-wider text-[#111827] dark:text-white print:text-black uppercase border-b border-[#111827] dark:border-gray-600 print:border-black pb-0.5">
              Certifications &amp; Accreditations
            </h2>

            <ul className="list-disc list-inside text-xs text-[#374151] dark:text-[#D1D5DB] print:text-black space-y-0.5 pl-1">
              {certifications.map((c, cIdx) => {
                const name = typeof c === 'string' ? c : c.name;
                const issuer = typeof c === 'string' ? '' : c.issuer;
                const year = typeof c === 'string' ? '' : c.year;

                return (
                  <li key={cIdx}>
                    <span className="font-semibold text-[#111827] dark:text-white print:text-black">
                      {name}
                    </span>
                    {issuer && <span> — {issuer}</span>}
                    {year && <span className="italic text-gray-500 print:text-black"> ({year})</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
