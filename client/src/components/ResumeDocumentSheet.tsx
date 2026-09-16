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
  ExternalLink,
  Plus,
  Trash2,
  X,
  Edit2,
  Heart,
} from 'lucide-react';

interface ResumeDocumentSheetProps {
  resumeSheetRef: React.RefObject<HTMLDivElement>;
  profile: UserProfile;
  resume: ResumeDocument;
  skills: SkillCategory[];
  soundEnabled?: boolean;
  isInlineEditMode: boolean;
  setIsInlineEditMode: (mode: boolean) => void;
  onUpdateProfile: (profile: UserProfile) => void;
  onUpdateResume: (resume: ResumeDocument) => void;
  onAddEducationModal: () => void;
  onAddJobModal: () => void;
  onAddProjectModal: () => void;
}

export const ResumeDocumentSheet: React.FC<ResumeDocumentSheetProps> = ({
  resumeSheetRef,
  profile,
  resume,
  skills,
  soundEnabled,
  isInlineEditMode,
  setIsInlineEditMode,
  onUpdateProfile,
  onUpdateResume,
  onAddEducationModal,
  onAddJobModal,
  onAddProjectModal,
}) => {
  const [showOptionalHobbies, setShowOptionalHobbies] = useState(false);
  const [newSkillInput, setNewSkillInput] = useState<{ [categoryIdx: number]: string }>({});
  const [newCertName, setNewCertName] = useState('');
  const [newCertIssuer, setNewCertIssuer] = useState('');
  const [newInfoText, setNewInfoText] = useState('');
  const [newHobbyTitle, setNewHobbyTitle] = useState('');
  const [newHobbyEmoji, setNewHobbyEmoji] = useState('✨');

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

  const hobbies = profile.hobbies || [];

  const certifications =
    resume.certifications && resume.certifications.length > 0
      ? resume.certifications
      : (profile.certifications && profile.certifications.length > 0)
      ? profile.certifications
      : DEFAULT_ATS_RESUME.certifications;

  const additionalInfo =
    resume.additionalInfo && resume.additionalInfo.length > 0
      ? resume.additionalInfo
      : DEFAULT_ATS_RESUME.additionalInfo;

  const skillsCategories =
    resume.skillsByCategory && resume.skillsByCategory.length > 0
      ? resume.skillsByCategory
      : skills && skills.length > 0
      ? skills.map((sc) => ({ category: sc.category, items: sc.skills.map((s) => s.name) }))
      : DEFAULT_ATS_RESUME.skillsByCategory || [];

  const resumeProjects =
    resume.projects && resume.projects.length > 0
      ? resume.projects
      : DEFAULT_ATS_RESUME.projects;

  const summaryText =
    profile.professionalSummary ||
    profile.bio ||
    resume.summary ||
    DEFAULT_ATS_RESUME.summary;

  const displayName = profile.name || 'Gulshan Kumar Nayak';
  const displayEmail = profile.contactEmail || 'gulnayak1206@gmail.com';
  const displayPhone = profile.phone || '+91-7304838209';
  const displayGithub = profile.github || 'https://github.com';
  const displayLinkedin = profile.linkedin || 'https://linkedin.com';

  // Inline Profile Update Handler
  const handleInlineProfileChange = (field: keyof UserProfile, value: string) => {
    onUpdateProfile({
      ...profile,
      [field]: value,
    });
  };

  // Education Inline Handlers
  const handleUpdateEduInline = (id: string, partial: Partial<EducationRecord>) => {
    const updated = educationRecords.map((edu) =>
      edu.id === id ? { ...edu, ...partial } : edu
    );
    onUpdateProfile({
      ...profile,
      educationRecords: updated,
    });
  };

  const handleDeleteEdu = (id: string) => {
    const updated = educationRecords.filter((edu) => edu.id !== id);
    onUpdateProfile({
      ...profile,
      educationRecords: updated,
    });
    Sound.click(soundEnabled);
  };

  // Job Inline Handlers
  const handleUpdateJobInline = (id: string, partial: Partial<JobExperience>) => {
    const updated = jobExperiences.map((job) =>
      job.id === id ? { ...job, ...partial } : job
    );
    onUpdateProfile({
      ...profile,
      jobExperiences: updated,
    });
  };

  const handleDeleteJob = (id: string) => {
    const updated = jobExperiences.filter((job) => job.id !== id);
    onUpdateProfile({
      ...profile,
      jobExperiences: updated,
    });
    Sound.click(soundEnabled);
  };

  const handleAddJobAchievement = (id: string) => {
    const job = jobExperiences.find((j) => j.id === id);
    if (!job) return;
    const current = job.keyAchievements || (job.description ? [job.description] : []);
    handleUpdateJobInline(id, {
      keyAchievements: [...current, 'New achievement details...'],
    });
    Sound.click(soundEnabled);
  };

  const handleDeleteJobAchievement = (id: string, achIdx: number) => {
    const job = jobExperiences.find((j) => j.id === id);
    if (!job) return;
    const current = [...(job.keyAchievements || [])];
    current.splice(achIdx, 1);
    handleUpdateJobInline(id, { keyAchievements: current });
    Sound.click(soundEnabled);
  };

  // Project Inline Handlers
  const handleUpdateResumeProjectInline = (pIdx: number, partial: any) => {
    const updated = [...resumeProjects];
    updated[pIdx] = { ...updated[pIdx], ...partial };
    onUpdateResume({
      ...resume,
      projects: updated,
    });
  };

  const handleDeleteResumeProject = (pIdx: number) => {
    const updated = [...resumeProjects];
    updated.splice(pIdx, 1);
    onUpdateResume({
      ...resume,
      projects: updated,
    });
    Sound.click(soundEnabled);
  };

  // Skill Inline Handlers
  const handleAddSkillInline = (catIdx: number) => {
    const skillName = (newSkillInput[catIdx] || '').trim();
    if (!skillName) return;

    const updatedCategories = [...skillsCategories];
    if (updatedCategories[catIdx]) {
      updatedCategories[catIdx] = {
        ...updatedCategories[catIdx],
        items: [...updatedCategories[catIdx].items, skillName],
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

  // Certifications Inline Handlers
  const handleAddCertInline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCertName.trim()) return;

    const newCert: CertificationItem = {
      id: `cert-${Date.now()}`,
      name: newCertName.trim(),
      issuer: newCertIssuer.trim() || undefined,
    };

    const currentCerts: CertificationItem[] = certifications.map((c, i) =>
      typeof c === 'string'
        ? { id: `cert-${i}`, name: c }
        : { id: (c as any).id || `cert-${i}`, name: c.name, issuer: c.issuer, link: c.link }
    );

    const updated = [...currentCerts, newCert];
    onUpdateResume({
      ...resume,
      certifications: updated,
    });
    onUpdateProfile({
      ...profile,
      certifications: updated,
    });
    setNewCertName('');
    setNewCertIssuer('');
    Sound.success(soundEnabled);
  };

  const handleRemoveCertInline = (idx: number) => {
    const currentCerts = [...certifications];
    currentCerts.splice(idx, 1);
    onUpdateResume({
      ...resume,
      certifications: currentCerts,
    });
    onUpdateProfile({
      ...profile,
      certifications: currentCerts as any,
    });
    Sound.click(soundEnabled);
  };

  // Additional Info Inline Handlers
  const handleAddInfoInline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInfoText.trim()) return;
    const updated = [...additionalInfo, newInfoText.trim()];
    onUpdateResume({
      ...resume,
      additionalInfo: updated,
    });
    setNewInfoText('');
    Sound.success(soundEnabled);
  };

  const handleRemoveInfoInline = (idx: number) => {
    const updated = [...additionalInfo];
    updated.splice(idx, 1);
    onUpdateResume({
      ...resume,
      additionalInfo: updated,
    });
    Sound.click(soundEnabled);
  };

  // Hobby Inline Handlers
  const handleAddHobbyInline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHobbyTitle.trim()) return;
    const newHobby = {
      id: `hobby-${Date.now()}`,
      title: newHobbyTitle.trim(),
      icon: newHobbyEmoji.trim() || '✨',
      category: 'Lifestyle',
      description: '',
    };
    onUpdateProfile({
      ...profile,
      hobbies: [...hobbies, newHobby],
    });
    setNewHobbyTitle('');
    Sound.success(soundEnabled);
  };

  const handleRemoveHobbyInline = (id: string) => {
    onUpdateProfile({
      ...profile,
      hobbies: hobbies.filter((h) => h.id !== id),
    });
    Sound.click(soundEnabled);
  };

  return (
    <div
      id="printable-resume-sheet"
      ref={resumeSheetRef}
      className={`max-w-4xl mx-auto p-6 sm:p-10 md:p-12 rounded-2xl bg-white dark:bg-[#111827] border shadow-xs space-y-3 font-serif transition-all print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:w-full print:bg-white print:text-black ${
        isInlineEditMode
          ? 'border-amber-400 dark:border-amber-500 ring-2 ring-amber-400/20'
          : 'border-[#E5E7EB] dark:border-[#1F2937]'
      }`}
    >
      {/* Document Header (Exact PDF Layout: Centered Name, Centered Icons + Contact Details) */}
      <div className="text-center space-y-1 relative group pb-0.5">
        {isInlineEditMode ? (
          <div className="flex items-center justify-center gap-2">
            <input
              type="text"
              value={profile.name || displayName}
              onChange={(e) => handleInlineProfileChange('name', e.target.value)}
              placeholder="FULL NAME"
              className="text-xl sm:text-2xl font-serif font-bold text-center text-[#111827] dark:text-white bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 px-3 py-1 rounded-md max-w-md focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                setIsInlineEditMode(false);
              }}
              className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white text-xs font-sans font-bold cursor-pointer"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="relative inline-block">
            <h1 className="text-2xl sm:text-[28px] font-serif font-bold text-[#111827] dark:text-white tracking-normal leading-tight">
              {displayName}
            </h1>
            <button
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                setIsInlineEditMode(!isInlineEditMode);
              }}
              className="absolute -right-8 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6366F1] p-1 rounded hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] transition-colors print:hidden opacity-0 group-hover:opacity-100 cursor-pointer"
              title="Toggle Direct Edit Mode"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Contact Details Row (Centered, Icons + Text) */}
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs sm:text-[13px] text-[#374151] dark:text-[#D1D5DB] font-serif pt-0.5">
          {/* Phone */}
          {isInlineEditMode ? (
            <div className="flex items-center gap-1 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 px-1.5 py-0.5 rounded text-xs">
              <Phone className="w-3 h-3 text-[#4B5563]" />
              <input
                type="text"
                value={profile.phone || ''}
                onChange={(e) => handleInlineProfileChange('phone', e.target.value)}
                placeholder="+91-7304838209"
                className="bg-transparent focus:outline-none w-28 text-xs font-serif"
              />
            </div>
          ) : displayPhone ? (
            <span className="inline-flex items-center gap-1.5">
              <Phone className="w-3 h-3 text-[#4B5563] dark:text-[#9CA3AF] shrink-0" />
              <span>{displayPhone}</span>
            </span>
          ) : null}

          {/* Email */}
          {isInlineEditMode ? (
            <div className="flex items-center gap-1 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 px-1.5 py-0.5 rounded text-xs">
              <Mail className="w-3 h-3 text-[#4B5563]" />
              <input
                type="email"
                value={profile.contactEmail || ''}
                onChange={(e) => handleInlineProfileChange('contactEmail', e.target.value)}
                placeholder="gulnayak1206@gmail.com"
                className="bg-transparent focus:outline-none w-44 text-xs font-serif"
              />
            </div>
          ) : displayEmail ? (
            <span className="inline-flex items-center gap-1.5">
              <Mail className="w-3 h-3 text-[#4B5563] dark:text-[#9CA3AF] shrink-0" />
              <a href={`mailto:${displayEmail}`} className="hover:underline">
                {displayEmail}
              </a>
            </span>
          ) : null}

          {/* GitHub */}
          {isInlineEditMode ? (
            <div className="flex items-center gap-1 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 px-1.5 py-0.5 rounded text-xs">
              <Github className="w-3 h-3 text-[#4B5563]" />
              <input
                type="text"
                value={profile.github || ''}
                onChange={(e) => handleInlineProfileChange('github', e.target.value)}
                placeholder="GitHub URL"
                className="bg-transparent focus:outline-none w-32 text-xs font-serif"
              />
            </div>
          ) : displayGithub ? (
            <span className="inline-flex items-center gap-1.5">
              <Github className="w-3 h-3 text-[#4B5563] dark:text-[#9CA3AF] shrink-0" />
              <a
                href={displayGithub.startsWith('http') ? displayGithub : `https://${displayGithub}`}
                target="_blank"
                rel="noreferrer"
                className="hover:underline"
              >
                GitHub
              </a>
            </span>
          ) : null}

          {/* LinkedIn */}
          {isInlineEditMode ? (
            <div className="flex items-center gap-1 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 px-1.5 py-0.5 rounded text-xs">
              <Linkedin className="w-3 h-3 text-[#4B5563]" />
              <input
                type="text"
                value={profile.linkedin || ''}
                onChange={(e) => handleInlineProfileChange('linkedin', e.target.value)}
                placeholder="LinkedIn URL"
                className="bg-transparent focus:outline-none w-32 text-xs font-serif"
              />
            </div>
          ) : displayLinkedin ? (
            <span className="inline-flex items-center gap-1.5">
              <Linkedin className="w-3 h-3 text-[#4B5563] dark:text-[#9CA3AF] shrink-0" />
              <a
                href={displayLinkedin.startsWith('http') ? displayLinkedin : `https://${displayLinkedin}`}
                target="_blank"
                rel="noreferrer"
                className="hover:underline"
              >
                LinkedIn
              </a>
            </span>
          ) : null}
        </div>
      </div>

      {/* 1. SUMMARY (Shaded Gray Banner) */}
      <div className="space-y-1 resume-section">
        <div className="resume-section-header-bar bg-[#E8EDF2] dark:bg-[#1E293B] px-2 py-0.5 flex items-center justify-between">
          <h2 className="font-serif font-bold text-xs sm:text-[13px] uppercase tracking-wider text-[#0F172A] dark:text-white">
            SUMMARY
          </h2>
          {isInlineEditMode && (
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-sans font-semibold print:hidden">
              Editable
            </span>
          )}
        </div>

        {isInlineEditMode ? (
          <textarea
            value={summaryText}
            onChange={(e) => {
              handleInlineProfileChange('professionalSummary', e.target.value);
              handleInlineProfileChange('bio', e.target.value);
              onUpdateResume({ ...resume, summary: e.target.value });
            }}
            rows={4}
            className="w-full text-xs sm:text-[12.5px] font-serif leading-relaxed text-[#111827] dark:text-white bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 p-2 rounded focus:outline-none"
          />
        ) : (
          <p className="font-serif text-xs sm:text-[12.5px] leading-relaxed text-[#1F2937] dark:text-[#D1D5DB] text-justify pt-0.5">
            {summaryText}
          </p>
        )}
      </div>

      {/* 2. SKILLS (Shaded Gray Banner, Bullet per Category) */}
      <div className="space-y-1 resume-section">
        <div className="resume-section-header-bar bg-[#E8EDF2] dark:bg-[#1E293B] px-2 py-0.5 flex items-center justify-between">
          <h2 className="font-serif font-bold text-xs sm:text-[13px] uppercase tracking-wider text-[#0F172A] dark:text-white">
            SKILLS
          </h2>
        </div>

        <ul className="space-y-1 pt-0.5 font-serif text-xs sm:text-[12.5px] text-[#1F2937] dark:text-[#D1D5DB]">
          {skillsCategories.map((sc, catIdx) => {
            const itemsString = sc.items.join(', ');
            const formattedItems = itemsString.endsWith('.') ? itemsString : `${itemsString}.`;
            return (
              <li key={catIdx} className="flex items-start gap-1.5 leading-snug">
                <span className="select-none font-bold text-[#111827] dark:text-white">•</span>
                <div className="flex-1">
                  <strong className="font-bold text-[#111827] dark:text-white">{sc.category}:</strong>{' '}
                  <span>{formattedItems}</span>
                  {isInlineEditMode && (
                    <div className="inline-flex items-center gap-1 ml-2 print:hidden">
                      <input
                        type="text"
                        value={newSkillInput[catIdx] || ''}
                        onChange={(e) =>
                          setNewSkillInput({ ...newSkillInput, [catIdx]: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddSkillInline(catIdx);
                          }
                        }}
                        placeholder="+ Add item"
                        className="text-[10px] bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 px-1 py-0.5 rounded w-24 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddSkillInline(catIdx)}
                        className="px-1.5 py-0.5 rounded bg-[#6366F1] text-white text-[9px] font-sans font-bold cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* 3. EDUCATION (Shaded Gray Banner, Bullet per School, Italic Degree, Right-aligned CGPA & Year) */}
      <div className="space-y-1 resume-section">
        <div className="resume-section-header-bar bg-[#E8EDF2] dark:bg-[#1E293B] px-2 py-0.5 flex items-center justify-between">
          <h2 className="font-serif font-bold text-xs sm:text-[13px] uppercase tracking-wider text-[#0F172A] dark:text-white">
            EDUCATION
          </h2>
          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              onAddEducationModal();
            }}
            className="text-xs text-[#6366F1] font-sans font-semibold hover:underline flex items-center gap-1 print:hidden cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Add Education</span>
          </button>
        </div>

        <div className="space-y-2 pt-0.5 font-serif text-xs sm:text-[12.5px]">
          {educationRecords.map((edu) => (
            <div key={edu.id} className="space-y-0.5 group relative">
              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-1.5 font-bold text-[#111827] dark:text-white">
                  <span className="select-none">•</span>
                  {isInlineEditMode ? (
                    <input
                      type="text"
                      value={edu.institution}
                      onChange={(e) => handleUpdateEduInline(edu.id, { institution: e.target.value })}
                      className="font-bold bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 px-1.5 py-0.5 rounded text-xs w-80 font-serif"
                    />
                  ) : (
                    <span>{edu.institution}</span>
                  )}
                </div>

                {isInlineEditMode && (
                  <button
                    type="button"
                    onClick={() => handleDeleteEdu(edu.id)}
                    className="text-[#9CA3AF] hover:text-rose-500 p-0.5 print:hidden cursor-pointer ml-2"
                    title="Delete Record"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="flex items-baseline justify-between text-[#374151] dark:text-[#D1D5DB] pl-3.5">
                {isInlineEditMode ? (
                  <input
                    type="text"
                    value={edu.degree}
                    onChange={(e) => handleUpdateEduInline(edu.id, { degree: e.target.value })}
                    className="italic bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 px-1.5 py-0.5 rounded text-xs w-60 font-serif"
                  />
                ) : (
                  <span className="italic">{edu.degree}</span>
                )}

                <div className="flex items-center gap-6 shrink-0 font-medium">
                  {isInlineEditMode ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={edu.score}
                        onChange={(e) => handleUpdateEduInline(edu.id, { score: e.target.value })}
                        className="w-20 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 px-1 py-0.5 rounded text-xs font-serif"
                      />
                      <input
                        type="text"
                        value={edu.year}
                        onChange={(e) => handleUpdateEduInline(edu.id, { year: e.target.value })}
                        className="w-20 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 px-1 py-0.5 rounded text-xs font-serif"
                      />
                    </div>
                  ) : (
                    <>
                      <span className="font-bold text-[#111827] dark:text-white">
                        CGPA: {edu.score?.replace(/cgpa/i, '').trim()}
                      </span>
                      <span>{edu.year}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. EXPERIENCE (Shaded Gray Banner, Bullet per Company/Role, Right-aligned Year, En-dash Sub-bullets) */}
      <div className="space-y-1 resume-section">
        <div className="resume-section-header-bar bg-[#E8EDF2] dark:bg-[#1E293B] px-2 py-0.5 flex items-center justify-between">
          <h2 className="font-serif font-bold text-xs sm:text-[13px] uppercase tracking-wider text-[#0F172A] dark:text-white">
            EXPERIENCE
          </h2>
          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              onAddJobModal();
            }}
            className="text-xs text-[#6366F1] font-sans font-semibold hover:underline flex items-center gap-1 print:hidden cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Add Experience</span>
          </button>
        </div>

        <div className="space-y-2.5 pt-0.5 font-serif text-xs sm:text-[12.5px]">
          {jobExperiences.map((job) => {
            const achievements =
              job.keyAchievements && job.keyAchievements.length > 0
                ? job.keyAchievements
                : job.description
                ? [job.description]
                : [];
            const periodDisplay =
              job.startDate === job.endDate || !job.endDate
                ? job.startDate
                : `${job.startDate}–${job.endDate}`;

            return (
              <div key={job.id} className="space-y-0.5 group relative">
                <div className="flex items-baseline justify-between">
                  <div className="flex items-baseline gap-1.5 font-bold text-[#111827] dark:text-white">
                    <span className="select-none">•</span>
                    {isInlineEditMode ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={job.role}
                          onChange={(e) => handleUpdateJobInline(job.id, { role: e.target.value })}
                          className="font-bold bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 px-1 py-0.5 rounded text-xs font-serif"
                        />
                        <span>,</span>
                        <input
                          type="text"
                          value={job.company}
                          onChange={(e) => handleUpdateJobInline(job.id, { company: e.target.value })}
                          className="font-bold bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 px-1 py-0.5 rounded text-xs font-serif"
                        />
                      </div>
                    ) : (
                      <span>
                        {job.role}, {job.company}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isInlineEditMode ? (
                      <input
                        type="text"
                        value={periodDisplay}
                        onChange={(e) =>
                          handleUpdateJobInline(job.id, {
                            startDate: e.target.value,
                            endDate: e.target.value,
                          })
                        }
                        className="w-20 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 px-1 py-0.5 rounded text-xs font-serif text-right"
                      />
                    ) : (
                      <span className="font-medium text-[#374151] dark:text-[#D1D5DB]">
                        {periodDisplay}
                      </span>
                    )}
                    {isInlineEditMode && (
                      <button
                        type="button"
                        onClick={() => handleDeleteJob(job.id)}
                        className="text-[#9CA3AF] hover:text-rose-500 p-0.5 print:hidden cursor-pointer"
                        title="Delete Experience"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                <ul className="space-y-0.5 text-[#374151] dark:text-[#D1D5DB] pl-3.5">
                  {achievements.map((ach, aIdx) => (
                    <li key={aIdx} className="flex items-start gap-1.5 leading-snug">
                      <span className="select-none text-[#111827] dark:text-white font-medium">–</span>
                      {isInlineEditMode ? (
                        <div className="flex items-center gap-1.5 flex-1">
                          <input
                            type="text"
                            value={ach}
                            onChange={(e) => {
                              const newAch = [...achievements];
                              newAch[aIdx] = e.target.value;
                              handleUpdateJobInline(job.id, { keyAchievements: newAch });
                            }}
                            className="flex-1 text-xs text-[#111827] dark:text-white bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 px-2 py-0.5 rounded focus:outline-none font-serif"
                          />
                          <button
                            type="button"
                            onClick={() => handleDeleteJobAchievement(job.id, aIdx)}
                            className="text-[#9CA3AF] hover:text-rose-500 p-0.5 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <span>{ach}</span>
                      )}
                    </li>
                  ))}
                </ul>
                {isInlineEditMode && (
                  <button
                    type="button"
                    onClick={() => handleAddJobAchievement(job.id)}
                    className="text-[11px] text-[#6366F1] font-sans hover:underline font-semibold flex items-center gap-1 pl-3.5 pt-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Achievement Bullet</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. PROJECTS (Shaded Gray Banner, Bullet per Project, Italic Subtitle, En-dash Sub-bullets) */}
      <div className="space-y-1 resume-section">
        <div className="resume-section-header-bar bg-[#E8EDF2] dark:bg-[#1E293B] px-2 py-0.5 flex items-center justify-between">
          <h2 className="font-serif font-bold text-xs sm:text-[13px] uppercase tracking-wider text-[#0F172A] dark:text-white">
            PROJECTS
          </h2>
          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              onAddProjectModal();
            }}
            className="text-xs text-[#6366F1] font-sans font-semibold hover:underline flex items-center gap-1 print:hidden cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Add Project</span>
          </button>
        </div>

        <div className="space-y-2.5 pt-0.5 font-serif text-xs sm:text-[12.5px]">
          {resumeProjects.map((p, pIdx) => {
            const points =
              p.points && p.points.length > 0
                ? p.points
                : p.description
                ? [p.description]
                : [];

            return (
              <div key={pIdx} className="space-y-0.5 group relative">
                <div className="flex items-baseline justify-between">
                  <div className="flex items-baseline gap-1.5 font-bold text-[#111827] dark:text-white">
                    <span className="select-none">•</span>
                    {isInlineEditMode ? (
                      <input
                        type="text"
                        value={p.title}
                        onChange={(e) =>
                          handleUpdateResumeProjectInline(pIdx, { title: e.target.value })
                        }
                        className="font-bold bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 px-1.5 py-0.5 rounded text-xs w-80 font-serif"
                      />
                    ) : (
                      <span>{p.title}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isInlineEditMode ? (
                      <input
                        type="text"
                        value={p.period || ''}
                        onChange={(e) =>
                          handleUpdateResumeProjectInline(pIdx, { period: e.target.value })
                        }
                        className="w-16 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 px-1 py-0.5 rounded text-xs font-serif text-right"
                        placeholder="Year"
                      />
                    ) : (
                      p.period && (
                        <span className="italic font-medium text-[#374151] dark:text-[#D1D5DB]">
                          {p.period}
                        </span>
                      )
                    )}
                    {isInlineEditMode && (
                      <button
                        type="button"
                        onClick={() => handleDeleteResumeProject(pIdx)}
                        className="text-[#9CA3AF] hover:text-rose-500 p-0.5 print:hidden cursor-pointer"
                        title="Delete Project"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {isInlineEditMode ? (
                  <div className="pl-3.5 pt-0.5">
                    <input
                      type="text"
                      value={p.subtitle || ''}
                      onChange={(e) =>
                        handleUpdateResumeProjectInline(pIdx, { subtitle: e.target.value })
                      }
                      placeholder="Subtitle / Tech Stack (e.g. Tech Stack: Power BI, SQL)"
                      className="w-full italic text-xs bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 px-1.5 py-0.5 rounded font-serif"
                    />
                  </div>
                ) : (
                  p.subtitle && (
                    <p className="italic text-[#374151] dark:text-[#D1D5DB] pl-3.5 leading-snug">
                      {p.subtitle}
                    </p>
                  )
                )}

                <ul className="space-y-0.5 text-[#374151] dark:text-[#D1D5DB] pl-3.5">
                  {points.map((pt, ptIdx) => (
                    <li key={ptIdx} className="flex items-start gap-1.5 leading-snug">
                      <span className="select-none text-[#111827] dark:text-white font-medium">–</span>
                      {isInlineEditMode ? (
                        <div className="flex items-center gap-1.5 flex-1">
                          <input
                            type="text"
                            value={pt}
                            onChange={(e) => {
                              const newPoints = [...points];
                              newPoints[ptIdx] = e.target.value;
                              handleUpdateResumeProjectInline(pIdx, { points: newPoints });
                            }}
                            className="flex-1 text-xs text-[#111827] dark:text-white bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 px-2 py-0.5 rounded font-serif"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newPoints = [...points];
                              newPoints.splice(ptIdx, 1);
                              handleUpdateResumeProjectInline(pIdx, { points: newPoints });
                            }}
                            className="text-[#9CA3AF] hover:text-rose-500 p-0.5 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <span>{pt}</span>
                      )}
                    </li>
                  ))}
                </ul>

                {isInlineEditMode && (
                  <button
                    type="button"
                    onClick={() => {
                      const newPoints = [...points, 'New bullet point...'];
                      handleUpdateResumeProjectInline(pIdx, { points: newPoints });
                    }}
                    className="text-[11px] text-[#6366F1] font-sans hover:underline font-semibold flex items-center gap-1 pl-3.5 pt-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Project Bullet</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. CERTIFICATIONS (Shaded Gray Banner, 2-Column Grid) */}
      <div className="space-y-1 resume-section">
        <div className="resume-section-header-bar bg-[#E8EDF2] dark:bg-[#1E293B] px-2 py-0.5 flex items-center justify-between">
          <h2 className="font-serif font-bold text-xs sm:text-[13px] uppercase tracking-wider text-[#0F172A] dark:text-white">
            CERTIFICATIONS
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 pt-0.5 font-serif text-xs sm:text-[12.5px]">
          {certifications.map((c, idx) => {
            const cName = typeof c === 'string' ? c : c.name;
            const cIssuer = typeof c === 'object' && c.issuer ? ` - ${c.issuer}` : '';
            return (
              <div key={idx} className="flex items-center justify-between text-[#374151] dark:text-[#D1D5DB]">
                <span className="flex items-center gap-1.5">
                  <span className="select-none font-medium">–</span>
                  <span>
                    {cName}
                    {cIssuer}
                  </span>
                </span>
                <div className="flex items-center gap-1">
                  <ExternalLink className="w-3 h-3 text-[#6B7280] dark:text-[#9CA3AF] shrink-0 ml-1" />
                  {isInlineEditMode && (
                    <button
                      type="button"
                      onClick={() => handleRemoveCertInline(idx)}
                      className="text-[#9CA3AF] hover:text-rose-500 p-0.5 cursor-pointer print:hidden"
                      title="Remove Cert"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {isInlineEditMode && (
          <form
            onSubmit={handleAddCertInline}
            className="flex flex-wrap items-center gap-1.5 pt-2 print:hidden font-sans"
          >
            <input
              type="text"
              value={newCertName}
              onChange={(e) => setNewCertName(e.target.value)}
              placeholder="Certification Name..."
              className="px-2 py-1 rounded border text-xs bg-white dark:bg-[#1F2937] grow min-w-[140px]"
            />
            <input
              type="text"
              value={newCertIssuer}
              onChange={(e) => setNewCertIssuer(e.target.value)}
              placeholder="Issuer (e.g. AWS)..."
              className="px-2 py-1 rounded border text-xs bg-white dark:bg-[#1F2937] w-32"
            />
            <button
              type="submit"
              className="px-2.5 py-1 rounded bg-[#6366F1] text-white text-xs font-bold cursor-pointer"
            >
              Add Cert
            </button>
          </form>
        )}
      </div>

      {/* 7. ADDITIONAL INFORMATION (Shaded Gray Banner, Bulleted List) */}
      <div className="space-y-1 resume-section">
        <div className="resume-section-header-bar bg-[#E8EDF2] dark:bg-[#1E293B] px-2 py-0.5 flex items-center justify-between">
          <h2 className="font-serif font-bold text-xs sm:text-[13px] uppercase tracking-wider text-[#0F172A] dark:text-white">
            ADDITIONAL INFORMATION
          </h2>
        </div>

        <ul className="space-y-0.5 pt-0.5 font-serif text-xs sm:text-[12.5px] text-[#1F2937] dark:text-[#D1D5DB]">
          {additionalInfo.map((info, idx) => (
            <li key={idx} className="flex items-start gap-1.5 leading-snug">
              <span className="select-none font-bold text-[#111827] dark:text-white">•</span>
              <span className="flex-1">{info}</span>
              {isInlineEditMode && (
                <button
                  type="button"
                  onClick={() => handleRemoveInfoInline(idx)}
                  className="text-[#9CA3AF] hover:text-rose-500 p-0.5 cursor-pointer ml-2 print:hidden"
                  title="Remove Bullet"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </li>
          ))}
        </ul>

        {isInlineEditMode && (
          <form onSubmit={handleAddInfoInline} className="flex items-center gap-1.5 pt-1.5 print:hidden font-sans">
            <input
              type="text"
              value={newInfoText}
              onChange={(e) => setNewInfoText(e.target.value)}
              placeholder="Add bullet (e.g. Fast learner, excellent communication)..."
              className="px-2 py-1 rounded border text-xs bg-white dark:bg-[#1F2937] grow"
            />
            <button
              type="submit"
              className="px-2.5 py-1 rounded bg-emerald-600 text-white text-xs font-bold cursor-pointer"
            >
              Add
            </button>
          </form>
        )}
      </div>

      {/* 8. OPTIONAL ONLINE PORTFOLIO EXTRAS (Hidden in Print & PDF Export) */}
      {hobbies.length > 0 && (
        <div className="pt-2 border-t border-[#F1F5F9] dark:border-[#1E293B] print:hidden">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowOptionalHobbies(!showOptionalHobbies)}
              className="text-xs text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white font-sans flex items-center gap-1.5 cursor-pointer"
            >
              <Heart className="w-3.5 h-3.5 text-rose-400" />
              <span>{showOptionalHobbies ? 'Hide' : 'Show'} Personal Interests &amp; Hobbies (Web Only)</span>
            </button>
          </div>

          {showOptionalHobbies && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              {hobbies.map((h) => (
                <span
                  key={h.id}
                  className="px-2.5 py-1 rounded-lg bg-[#F8FAFC] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] text-xs font-sans text-[#374151] dark:text-[#D1D5DB] flex items-center gap-1.5"
                >
                  <span>{h.icon || '✨'}</span>
                  <span className="font-semibold">{h.title}</span>
                  {h.passionLevel && (
                    <span className="text-[10px] text-[#9CA3AF]">({h.passionLevel})</span>
                  )}
                  {isInlineEditMode && (
                    <button
                      type="button"
                      onClick={() => handleRemoveHobbyInline(h.id)}
                      className="text-[#9CA3AF] hover:text-rose-500 ml-1 p-0.5 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}

              {isInlineEditMode && (
                <form onSubmit={handleAddHobbyInline} className="flex items-center gap-1 font-sans">
                  <input
                    type="text"
                    value={newHobbyEmoji}
                    onChange={(e) => setNewHobbyEmoji(e.target.value)}
                    className="w-8 px-1 py-0.5 rounded border text-center text-xs bg-white dark:bg-[#1F2937]"
                    placeholder="✨"
                  />
                  <input
                    type="text"
                    value={newHobbyTitle}
                    onChange={(e) => setNewHobbyTitle(e.target.value)}
                    placeholder="Hobby..."
                    className="px-2 py-0.5 rounded border text-xs bg-white dark:bg-[#1F2937]"
                  />
                  <button
                    type="submit"
                    className="px-2 py-0.5 rounded bg-[#6366F1] text-white text-xs font-bold cursor-pointer"
                  >
                    Add
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
