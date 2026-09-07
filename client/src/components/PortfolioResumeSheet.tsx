import React, { useState } from 'react';
import {
  FileText,
  Printer,
  Copy,
  Download,
  Upload,
  Check,
  Building,
  GraduationCap,
  Briefcase,
  Award,
  Sparkles,
  Mail,
  Phone,
  Globe,
  Linkedin,
  Github,
  MapPin,
  Heart,
  ExternalLink,
  Code2,
  Share2,
} from 'lucide-react';
import {
  UserProfile,
  EducationRecord,
  JobExperience,
  SkillCategory,
  PortfolioProject,
  HobbyItem,
  ResumeDocument,
} from '../types';
import { Sound } from '../utils/audio';

interface PortfolioResumeSheetProps {
  profile: UserProfile;
  educationRecords: EducationRecord[];
  jobExperiences: JobExperience[];
  skills: SkillCategory[];
  projects: PortfolioProject[];
  hobbies: HobbyItem[];
  resume: ResumeDocument;
  onUpdateResume: (resume: ResumeDocument) => void;
  soundEnabled: boolean;
}

export const PortfolioResumeSheet: React.FC<PortfolioResumeSheetProps> = ({
  profile,
  educationRecords,
  jobExperiences,
  skills,
  projects,
  hobbies,
  resume,
  onUpdateResume,
  soundEnabled,
}) => {
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Print Handler
  const handlePrint = () => {
    Sound.click(soundEnabled);
    window.print();
  };

  // Copy Markdown Representation to Clipboard
  const handleCopyMarkdown = () => {
    Sound.click(soundEnabled);

    let md = `# ${profile.name || 'Professional Portfolio'}\n`;
    if (profile.title) md += `**${profile.title}**\n\n`;
    md += `📍 Location: ${profile.location || 'India'} | ✉️ Email: ${profile.contactEmail || ''} | 📞 Phone: ${profile.phone || ''}\n`;
    md += `🌐 Website: ${profile.website || ''} | 💼 LinkedIn: ${profile.linkedin || ''} | 🐙 GitHub: ${profile.github || ''}\n\n`;

    if (profile.professionalSummary || profile.bio) {
      md += `## Professional Summary\n${profile.professionalSummary || profile.bio}\n\n`;
    }

    if (jobExperiences.length > 0) {
      md += `## Work Experience\n`;
      jobExperiences.forEach((j) => {
        md += `### ${j.role} – ${j.company} (${j.startDate} – ${j.endDate || 'Present'})\n`;
        if (j.location) md += `*${j.location}* | *${j.employmentType || 'Full-time'}*\n\n`;
        if (j.description) md += `${j.description}\n\n`;
        if (j.keyAchievements && j.keyAchievements.length > 0) {
          j.keyAchievements.forEach((ach) => {
            md += `- ${ach}\n`;
          });
          md += `\n`;
        }
        if (j.techStack && j.techStack.length > 0) {
          md += `*Tech Stack:* ${j.techStack.join(', ')}\n\n`;
        }
      });
    }

    if (educationRecords.length > 0) {
      md += `## Education & Academics\n`;
      educationRecords.forEach((e) => {
        md += `### ${e.degree} – ${e.institution}\n`;
        md += `*Tier:* ${e.levelTitle || e.level} | *Year:* ${e.year} | *Score:* **${e.score}**\n`;
        if (e.boardOrUniversity) md += `*Board/University:* ${e.boardOrUniversity}\n`;
        if (e.specialization) md += `*Specialization:* ${e.specialization}\n`;
        if (e.highlights && e.highlights.length > 0) {
          e.highlights.forEach((h) => {
            md += `- ${h}\n`;
          });
        }
        md += `\n`;
      });
    }

    if (skills.length > 0) {
      md += `## Technical Skills\n`;
      skills.forEach((sc) => {
        md += `**${sc.category}:** ${sc.skills.map((s) => s.name).join(', ')}\n\n`;
      });
    }

    if (projects.length > 0) {
      md += `## Key Projects\n`;
      projects.forEach((p) => {
        md += `### ${p.title}\n${p.description}\n`;
        const techList = p.techStack || p.tech;
        if (techList && techList.length > 0) md += `*Tech:* ${techList.join(', ')}\n`;
        const live = p.liveUrl || p.link;
        if (live) md += `*Demo:* ${live}\n`;
        md += `\n`;
      });
    }

    if (hobbies.length > 0) {
      md += `## Hobbies & Interests\n`;
      hobbies.forEach((h) => {
        md += `- **${h.title}** (${h.category}): ${h.description}\n`;
      });
      md += `\n`;
    }

    navigator.clipboard.writeText(md);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2500);
  };

  // Download JSON Portfolio Export
  const handleDownloadJSON = () => {
    Sound.click(soundEnabled);
    const data = {
      profile,
      educationRecords,
      jobExperiences,
      skills,
      projects,
      hobbies,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(profile.name || 'portfolio').toLowerCase().replace(/\s+/g, '_')}_resume_portfolio.json`;
    a.click();
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#EDECE9] dark:border-[#334155] shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-[#6366F1] flex items-center justify-center font-bold">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-[#111827] dark:text-white flex items-center gap-2">
              <span>Interactive ATS Resume &amp; Curriculum Vitae</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold">
                Synthesized
              </span>
            </h2>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
              Unified professional resume generated live from your Schooling, Career, Skills, and Identity records.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Print / PDF Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="px-3.5 py-2 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save PDF</span>
          </button>

          {/* Copy Markdown */}
          <button
            type="button"
            onClick={handleCopyMarkdown}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] hover:border-[#6366F1] text-xs font-bold text-[#374151] dark:text-[#CBD5E1] transition-all flex items-center gap-1.5 cursor-pointer"
          >
            {copiedSuccess ? (
              <>
                <Check className="w-4 h-4 text-emerald-500" />
                <span className="text-emerald-600">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-[#6366F1]" />
                <span>Copy Markdown</span>
              </>
            )}
          </button>

          {/* Download JSON */}
          <button
            type="button"
            onClick={handleDownloadJSON}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] hover:border-[#6366F1] text-xs font-bold text-[#374151] dark:text-[#CBD5E1] transition-all flex items-center gap-1.5 cursor-pointer"
          >
            {downloadSuccess ? (
              <>
                <Check className="w-4 h-4 text-emerald-500" />
                <span className="text-emerald-600">Downloaded!</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-[#6366F1]" />
                <span>Export JSON</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Formatted Printable Resume Paper */}
      <div
        id="printable-resume-sheet"
        className="max-w-4xl mx-auto p-8 sm:p-12 rounded-3xl bg-white dark:bg-[#0F172A] border border-[#E5E7EB] dark:border-[#334155] shadow-xl space-y-8 print:border-none print:shadow-none print:p-0 print:m-0"
      >
        {/* Resume Header */}
        <div className="border-b-2 border-[#111827] dark:border-white pb-6 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
            <div>
              <h1 className="workspace-heading font-black text-[#111827] dark:text-white tracking-tight uppercase">
                {profile.name || 'Your Name'}
              </h1>
              <p className="text-sm sm:text-base font-bold text-[#6366F1] dark:text-[#818CF8] mt-0.5">
                {profile.title || 'Professional Title'}
              </p>
            </div>

            {profile.availabilityStatus && (
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#EEF2FF] dark:bg-[#312E81] text-[#6366F1] dark:text-[#A5B4FC] self-start sm:self-auto">
                {profile.availabilityStatus}
              </span>
            )}
          </div>

          {/* Contact Details Strip */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#4B5563] dark:text-[#9CA3AF] font-medium pt-1">
            {profile.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#6366F1]" />
                <span>{profile.location}</span>
              </span>
            )}
            {profile.contactEmail && (
              <a
                href={`mailto:${profile.contactEmail}`}
                className="flex items-center gap-1 hover:text-[#6366F1] transition-colors"
              >
                <Mail className="w-3.5 h-3.5 text-[#6366F1]" />
                <span>{profile.contactEmail}</span>
              </a>
            )}
            {profile.phone && (
              <a
                href={`tel:${profile.phone}`}
                className="flex items-center gap-1 hover:text-[#6366F1] transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-[#6366F1]" />
                <span>{profile.phone}</span>
              </a>
            )}
            {profile.website && (
              <a
                href={profile.website}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 hover:text-[#6366F1] transition-colors"
              >
                <Globe className="w-3.5 h-3.5 text-[#6366F1]" />
                <span>{profile.website.replace(/^https?:\/\//, '')}</span>
              </a>
            )}
            {profile.linkedin && (
              <a
                href={profile.linkedin.startsWith('http') ? profile.linkedin : `https://${profile.linkedin}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 hover:text-[#6366F1] transition-colors"
              >
                <Linkedin className="w-3.5 h-3.5 text-[#6366F1]" />
                <span>LinkedIn</span>
              </a>
            )}
            {profile.github && (
              <a
                href={profile.github.startsWith('http') ? profile.github : `https://${profile.github}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 hover:text-[#6366F1] transition-colors"
              >
                <Github className="w-3.5 h-3.5 text-[#6366F1]" />
                <span>GitHub</span>
              </a>
            )}
          </div>
        </div>

        {/* 1. Professional Summary */}
        {(profile.professionalSummary || profile.bio) && (
          <div className="space-y-2">
            <h2 className="text-xs font-black uppercase tracking-wider text-[#111827] dark:text-white flex items-center gap-2 pb-1 border-b border-[#E5E7EB] dark:border-[#334155]">
              <Sparkles className="w-3.5 h-3.5 text-[#6366F1]" />
              <span>Professional Summary</span>
            </h2>
            <p className="text-xs sm:text-sm text-[#374151] dark:text-[#D1D5DB] leading-relaxed">
              {profile.professionalSummary || profile.bio}
            </p>
          </div>
        )}

        {/* 2. Professional Experience & Jobs */}
        {jobExperiences.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-[#111827] dark:text-white flex items-center gap-2 pb-1 border-b border-[#E5E7EB] dark:border-[#334155]">
              <Briefcase className="w-3.5 h-3.5 text-[#6366F1]" />
              <span>Professional Experience</span>
            </h2>

            <div className="space-y-4">
              {jobExperiences.map((job) => (
                <div key={job.id} className="space-y-1.5">
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                    <h3 className="text-sm font-bold text-[#111827] dark:text-white">
                      <span>{job.role}</span>
                      <span className="text-[#6366F1] dark:text-[#818CF8]"> • {job.company}</span>
                    </h3>
                    <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-mono shrink-0">
                      {job.startDate} – {job.endDate || 'Present'} {job.location ? `| ${job.location}` : ''}
                    </span>
                  </div>

                  {job.description && (
                    <p className="text-xs text-[#4B5563] dark:text-[#D1D5DB] leading-relaxed">
                      {job.description}
                    </p>
                  )}

                  {job.keyAchievements && job.keyAchievements.length > 0 && (
                    <ul className="list-disc list-inside space-y-1 text-xs text-[#374151] dark:text-[#D1D5DB] pt-1">
                      {job.keyAchievements.map((ach, idx) => (
                        <li key={idx} className="leading-relaxed">
                          <span className="-ml-1">{ach}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {job.techStack && job.techStack.length > 0 && (
                    <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] pt-1">
                      <span className="font-bold text-[#374151] dark:text-[#CBD5E1]">Technologies:</span>{' '}
                      {job.techStack.join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Education & Schooling (Matriculation, Intermediate, Graduation, Postgraduation) */}
        {educationRecords.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-[#111827] dark:text-white flex items-center gap-2 pb-1 border-b border-[#E5E7EB] dark:border-[#334155]">
              <GraduationCap className="w-3.5 h-3.5 text-[#6366F1]" />
              <span>Education &amp; Academic Qualifications</span>
            </h2>

            <div className="space-y-3.5">
              {educationRecords.map((edu) => (
                <div key={edu.id} className="space-y-1">
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-[#111827] dark:text-white">
                        {edu.degree}
                      </span>
                      <span className="text-xs text-[#6366F1] font-semibold">
                        ({edu.levelTitle || edu.level})
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono shrink-0">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                        Score: {edu.score}
                      </span>
                      <span className="text-[#6B7280] dark:text-[#9CA3AF]">{edu.year}</span>
                    </div>
                  </div>

                  <p className="text-xs font-medium text-[#4B5563] dark:text-[#9CA3AF]">
                    <span className="text-[#111827] dark:text-white font-semibold">{edu.institution}</span>
                    {edu.boardOrUniversity && <span> • {edu.boardOrUniversity}</span>}
                    {edu.location && <span> • {edu.location}</span>}
                    {edu.specialization && <span> • Specialization: {edu.specialization}</span>}
                  </p>

                  {edu.highlights && edu.highlights.length > 0 && (
                    <ul className="list-disc list-inside space-y-0.5 text-xs text-[#4B5563] dark:text-[#D1D5DB] pt-0.5">
                      {edu.highlights.map((h, i) => (
                        <li key={i}>
                          <span className="-ml-1">{h}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Skills Matrix */}
        {skills.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-[#111827] dark:text-white flex items-center gap-2 pb-1 border-b border-[#E5E7EB] dark:border-[#334155]">
              <Code2 className="w-3.5 h-3.5 text-[#6366F1]" />
              <span>Technical &amp; Professional Skills</span>
            </h2>

            <div className="space-y-2">
              {skills.map((sc, idx) => (
                <div key={idx} className="text-xs flex flex-col sm:flex-row sm:items-baseline gap-1">
                  <span className="font-bold text-[#111827] dark:text-white sm:w-36 shrink-0">
                    {sc.category}:
                  </span>
                  <span className="text-[#4B5563] dark:text-[#D1D5DB] leading-relaxed">
                    {sc.skills.map((s) => `${s.name} (${s.experience || 'Proficient'})`).join(' • ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. Key Featured Projects */}
        {projects.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-[#111827] dark:text-white flex items-center gap-2 pb-1 border-b border-[#E5E7EB] dark:border-[#334155]">
              <Sparkles className="w-3.5 h-3.5 text-[#6366F1]" />
              <span>Key Projects &amp; Software</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {projects.slice(0, 4).map((p) => {
                const live = p.liveUrl || p.link;
                const techList述 = p.techStack || p.tech;
                return (
                  <div key={p.id} className="p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#1E293B]/70 border border-[#E2E8F0] dark:border-[#334155] space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-[#111827] dark:text-white">
                        {p.title}
                      </h3>
                      {live && (
                        <a
                          href={live}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-[#6366F1] font-semibold flex items-center gap-0.5 hover:underline"
                        >
                          <span>Demo</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                    <p className="text-[11px] text-[#4B5563] dark:text-[#9CA3AF] line-clamp-2 leading-relaxed">
                      {p.description}
                    </p>
                    {techList述 && techList述.length > 0 && (
                      <p className="text-[10px] font-mono text-[#6366F1] dark:text-[#818CF8]">
                        {techList述.join(', ')}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 6. Hobbies & Extracurricular Pursuits */}
        {hobbies.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-black uppercase tracking-wider text-[#111827] dark:text-white flex items-center gap-2 pb-1 border-b border-[#E5E7EB] dark:border-[#334155]">
              <Heart className="w-3.5 h-3.5 text-rose-500" />
              <span>Hobbies &amp; Personal Interests</span>
            </h2>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {hobbies.map((h) => (
                <span
                  key={h.id}
                  className="px-3 py-1 rounded-xl bg-[#F8FAFC] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] text-xs text-[#374151] dark:text-[#D1D5DB] flex items-center gap-1.5"
                >
                  <span>{h.icon || '✨'}</span>
                  <span className="font-semibold">{h.title}</span>
                  {h.passionLevel && (
                    <span className="text-[10px] text-[#9CA3AF]">({h.passionLevel})</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
