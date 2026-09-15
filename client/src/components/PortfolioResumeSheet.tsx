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

    const name = profile.name || resume.contact?.name || 'GULSHAN KUMAR NAYAK';
    const phone = profile.phone || resume.contact?.phone || '+91-7304838209';
    const email = profile.contactEmail || resume.contact?.email || 'gulnayak1206@gmail.com';
    const github = profile.github || resume.contact?.github || 'https://github.com';
    const linkedin = profile.linkedin || resume.contact?.linkedin || 'https://linkedin.com';
    const summary = profile.professionalSummary || profile.bio || resume.summary || '';

    let md = `# ${name}\n\n`;
    md += `Phone: ${phone} | Email: ${email} | GitHub: ${github} | LinkedIn: ${linkedin}\n\n`;

    if (summary) {
      md += `## SUMMARY\n${summary}\n\n`;
    }

    // Skills
    md += `## SKILLS\n`;
    if (resume.skillsByCategory && resume.skillsByCategory.length > 0) {
      resume.skillsByCategory.forEach((sc) => {
        md += `- **${sc.category}**: ${sc.items.join(', ')}\n`;
      });
    } else if (skills.length > 0) {
      skills.forEach((sc) => {
        md += `- **${sc.category}**: ${sc.skills.map((s) => s.name).join(', ')}\n`;
      });
    }
    md += `\n`;

    // Education
    if (educationRecords.length > 0) {
      md += `## EDUCATION\n`;
      educationRecords.forEach((e) => {
        md += `### ${e.institution}\n`;
        md += `${e.degree} | CGPA/Score: ${e.score} | ${e.year}\n\n`;
      });
    }

    // Experience
    if (jobExperiences.length > 0) {
      md += `## EXPERIENCE\n`;
      jobExperiences.forEach((j) => {
        md += `### ${j.role}, ${j.company} (${j.startDate}${j.endDate ? ` – ${j.endDate}` : ''})\n`;
        if (j.keyAchievements && j.keyAchievements.length > 0) {
          j.keyAchievements.forEach((ach) => {
            md += `- ${ach}\n`;
          });
        } else if (j.description) {
          md += `- ${j.description}\n`;
        }
        if (j.techStack && j.techStack.length > 0) {
          md += `*Tech Stack:* ${j.techStack.join(', ')}\n`;
        }
        md += `\n`;
      });
    }

    // Projects
    const resumeProjects = resume.projects || [];
    const displayProjects = resumeProjects.length > 0 ? resumeProjects : projects.map(p => ({
      title: p.title,
      subtitle: p.tagLine,
      period: '2024–2025',
      description: p.description,
      techStack: p.techStack || p.tech,
      points: [p.description],
    }));

    if (displayProjects.length > 0) {
      md += `## PROJECTS\n`;
      displayProjects.forEach((p) => {
        md += `### ${p.title} ${p.period ? `(${p.period})` : ''}\n`;
        if (p.techStack && p.techStack.length > 0) {
          md += `*Tech Stack:* ${p.techStack.join(', ')}\n`;
        }
        if (p.points && p.points.length > 0) {
          p.points.forEach((pt) => {
            md += `- ${pt}\n`;
          });
        } else if (p.description) {
          md += `- ${p.description}\n`;
        }
        md += `\n`;
      });
    }

    // Certifications
    const certs = resume.certifications || profile.certifications || [];
    if (certs.length > 0) {
      md += `## CERTIFICATIONS\n`;
      certs.forEach((c) => {
        const cName = typeof c === 'string' ? c : c.name;
        const cIssuer = typeof c === 'object' && c.issuer ? ` – ${c.issuer}` : '';
        md += `- ${cName}${cIssuer}\n`;
      });
      md += `\n`;
    }

    // Additional Info
    const addInfo = resume.additionalInfo || [];
    if (addInfo.length > 0) {
      md += `## ADDITIONAL INFORMATION\n`;
      addInfo.forEach((info) => {
        md += `- ${info}\n`;
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
        className="max-w-4xl mx-auto p-8 sm:p-12 rounded-3xl bg-white dark:bg-[#0F172A] border border-[#E5E7EB] dark:border-[#334155] shadow-xl space-y-6 print:border-none print:shadow-none print:p-0 print:m-0 font-sans"
      >
        {/* Resume Header - Centered ATS Format */}
        <div className="text-center pb-4 border-b-2 border-[#111827] dark:border-white space-y-2">
          <h1 className="text-2xl sm:text-3xl font-black text-[#111827] dark:text-white tracking-wider uppercase">
            {profile.name || resume.contact?.name || 'GULSHAN KUMAR NAYAK'}
          </h1>

          {/* Contact Strip */}
          <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-xs text-[#374151] dark:text-[#CBD5E1] font-medium">
            <span>
              <strong className="text-[#111827] dark:text-white">Phone:</strong>{' '}
              <a href={`tel:${profile.phone || resume.contact?.phone || '+91-7304838209'}`} className="hover:text-[#6366F1]">
                {profile.phone || resume.contact?.phone || '+91-7304838209'}
              </a>
            </span>
            <span className="text-[#9CA3AF]">•</span>
            <span>
              <strong className="text-[#111827] dark:text-white">Email:</strong>{' '}
              <a href={`mailto:${profile.contactEmail || resume.contact?.email || 'gulnayak1206@gmail.com'}`} className="hover:text-[#6366F1]">
                {profile.contactEmail || resume.contact?.email || 'gulnayak1206@gmail.com'}
              </a>
            </span>
            <span className="text-[#9CA3AF]">•</span>
            <span>
              <strong className="text-[#111827] dark:text-white">GitHub:</strong>{' '}
              <a
                href={profile.github || resume.contact?.github || 'https://github.com'}
                target="_blank"
                rel="noreferrer"
                className="text-[#6366F1] dark:text-[#818CF8] hover:underline"
              >
                {profile.github || resume.contact?.github || 'https://github.com'}
              </a>
            </span>
            <span className="text-[#9CA3AF]">•</span>
            <span>
              <strong className="text-[#111827] dark:text-white">LinkedIn:</strong>{' '}
              <a
                href={profile.linkedin || resume.contact?.linkedin || 'https://linkedin.com'}
                target="_blank"
                rel="noreferrer"
                className="text-[#6366F1] dark:text-[#818CF8] hover:underline"
              >
                {profile.linkedin || resume.contact?.linkedin || 'https://linkedin.com'}
              </a>
            </span>
            {(profile.location || resume.contact?.location) && (
              <>
                <span className="text-[#9CA3AF]">•</span>
                <span>{profile.location || resume.contact?.location}</span>
              </>
            )}
          </div>
        </div>

        {/* 1. SUMMARY */}
        <div className="space-y-1.5">
          <h2 className="text-xs font-black uppercase tracking-wider text-[#111827] dark:text-white pb-1 border-b border-[#E5E7EB] dark:border-[#334155] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#6366F1]" />
            <span>SUMMARY</span>
          </h2>
          <p className="text-xs text-[#374151] dark:text-[#D1D5DB] leading-relaxed text-justify">
            {profile.professionalSummary || profile.bio || resume.summary ||
              'Passionate and goal-driven Information Technology student with a strong academic foundation and hands-on experience in backend development, full-stack applications, Data Science and Analytics, and AI-integrated systems. Skilled in a wide range of technologies including Java, Spring Boot, React, Python, Networking, Power BI, Generative AI, LLM, and APIs. Strong problem solving skills, leadership qualities, and commitment to continuous learning and development.'}
          </p>
        </div>

        {/* 2. SKILLS */}
        <div className="space-y-2">
          <h2 className="text-xs font-black uppercase tracking-wider text-[#111827] dark:text-white pb-1 border-b border-[#E5E7EB] dark:border-[#334155] flex items-center gap-1.5">
            <Code2 className="w-3.5 h-3.5 text-[#6366F1]" />
            <span>SKILLS</span>
          </h2>

          <div className="space-y-1.5 text-xs text-[#374151] dark:text-[#D1D5DB]">
            {resume.skillsByCategory && resume.skillsByCategory.length > 0 ? (
              resume.skillsByCategory.map((cat, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row sm:items-baseline gap-1">
                  <span className="font-bold text-[#111827] dark:text-white sm:w-56 shrink-0">
                    {cat.category}:
                  </span>
                  <span className="leading-relaxed">{cat.items.join(', ')}</span>
                </div>
              ))
            ) : skills.length > 0 ? (
              skills.map((cat, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row sm:items-baseline gap-1">
                  <span className="font-bold text-[#111827] dark:text-white sm:w-56 shrink-0">
                    {cat.category}:
                  </span>
                  <span className="leading-relaxed">{cat.skills.map((s) => s.name).join(', ')}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-[#6B7280]">No skills loaded</p>
            )}
          </div>
        </div>

        {/* 3. EDUCATION */}
        <div className="space-y-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-[#111827] dark:text-white pb-1 border-b border-[#E5E7EB] dark:border-[#334155] flex items-center gap-1.5">
            <GraduationCap className="w-3.5 h-3.5 text-[#6366F1]" />
            <span>EDUCATION</span>
          </h2>

          <div className="space-y-2.5">
            {educationRecords.map((edu) => (
              <div key={edu.id} className="space-y-0.5">
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                  <span className="text-xs font-bold text-[#111827] dark:text-white">
                    {edu.institution}
                  </span>
                  <span className="text-[11px] font-mono text-[#6B7280] dark:text-[#9CA3AF] shrink-0">
                    {edu.year}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 text-xs text-[#4B5563] dark:text-[#CBD5E1]">
                  <span>
                    {edu.degree}
                    {edu.specialization && <span> – {edu.specialization}</span>}
                  </span>
                  <span className="font-bold text-[#111827] dark:text-white">
                    CGPA / Score: {edu.score}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. EXPERIENCE */}
        {jobExperiences.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-[#111827] dark:text-white pb-1 border-b border-[#E5E7EB] dark:border-[#334155] flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-[#6366F1]" />
              <span>EXPERIENCE</span>
            </h2>

            <div className="space-y-3">
              {jobExperiences.map((job) => (
                <div key={job.id} className="space-y-1">
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                    <div className="text-xs font-bold text-[#111827] dark:text-white">
                      <span>{job.role}</span>
                      <span className="text-[#6366F1] dark:text-[#818CF8]"> • {job.company}</span>
                    </div>
                    <span className="text-[11px] font-mono text-[#6B7280] dark:text-[#9CA3AF] shrink-0">
                      {job.startDate} – {job.endDate || 'Present'}
                    </span>
                  </div>

                  {job.keyAchievements && job.keyAchievements.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1 text-xs text-[#374151] dark:text-[#D1D5DB]">
                      {job.keyAchievements.map((ach, idx) => (
                        <li key={idx} className="leading-relaxed">
                          <span className="-ml-1">{ach}</span>
                        </li>
                      ))}
                    </ul>
                  ) : job.description ? (
                    <p className="text-xs text-[#4B5563] dark:text-[#D1D5DB] leading-relaxed">
                      {job.description}
                    </p>
                  ) : null}

                  {job.techStack && job.techStack.length > 0 && (
                    <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] pt-0.5">
                      <strong className="text-[#374151] dark:text-[#CBD5E1]">Technologies:</strong>{' '}
                      {job.techStack.join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. PROJECTS */}
        <div className="space-y-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-[#111827] dark:text-white pb-1 border-b border-[#E5E7EB] dark:border-[#334155] flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-[#6366F1]" />
            <span>PROJECTS</span>
          </h2>

          <div className="space-y-3">
            {resume.projects && resume.projects.length > 0 ? (
              resume.projects.map((proj, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                    <div className="text-xs font-bold text-[#111827] dark:text-white">
                      <span>{proj.title}</span>
                      {proj.subtitle && (
                        <span className="text-[#6B7280] dark:text-[#9CA3AF] font-normal">
                          {' '}
                          – {proj.subtitle}
                        </span>
                      )}
                    </div>
                    {proj.period && (
                      <span className="text-[11px] font-mono text-[#6B7280] dark:text-[#9CA3AF] shrink-0">
                        {proj.period}
                      </span>
                    )}
                  </div>

                  {proj.techStack && proj.techStack.length > 0 && (
                    <p className="text-[11px] text-[#6366F1] dark:text-[#818CF8] font-medium">
                      <strong className="text-[#374151] dark:text-[#CBD5E1]">Tech Stack:</strong>{' '}
                      {proj.techStack.join(', ')}
                    </p>
                  )}

                  {proj.points && proj.points.length > 0 ? (
                    <ul className="list-disc list-inside space-y-0.5 text-xs text-[#374151] dark:text-[#D1D5DB]">
                      {proj.points.map((pt, pIdx) => (
                        <li key={pIdx} className="leading-relaxed">
                          <span className="-ml-1">{pt}</span>
                        </li>
                      ))}
                    </ul>
                  ) : proj.description ? (
                    <p className="text-xs text-[#374151] dark:text-[#D1D5DB] leading-relaxed">
                      {proj.description}
                    </p>
                  ) : null}
                </div>
              ))
            ) : projects.length > 0 ? (
              projects.map((p) => (
                <div key={p.id} className="space-y-1">
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                    <div className="text-xs font-bold text-[#111827] dark:text-white">
                      <span>{p.title}</span>
                      {p.tagLine && (
                        <span className="text-[#6B7280] dark:text-[#9CA3AF] font-normal">
                          {' '}
                          – {p.tagLine}
                        </span>
                      )}
                    </div>
                  </div>

                  {p.techStack && p.techStack.length > 0 && (
                    <p className="text-[11px] text-[#6366F1] dark:text-[#818CF8] font-medium">
                      <strong className="text-[#374151] dark:text-[#CBD5E1]">Tech Stack:</strong>{' '}
                      {p.techStack.join(', ')}
                    </p>
                  )}

                  <p className="text-xs text-[#374151] dark:text-[#D1D5DB] leading-relaxed">
                    {p.description}
                  </p>
                </div>
              ))
            ) : null}
          </div>
        </div>

        {/* 6. CERTIFICATIONS */}
        {((resume.certifications && resume.certifications.length > 0) ||
          (profile.certifications && profile.certifications.length > 0)) && (
          <div className="space-y-2">
            <h2 className="text-xs font-black uppercase tracking-wider text-[#111827] dark:text-white pb-1 border-b border-[#E5E7EB] dark:border-[#334155] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#6366F1]" />
              <span>CERTIFICATIONS</span>
            </h2>

            <ul className="list-disc list-inside space-y-1 text-xs text-[#374151] dark:text-[#D1D5DB]">
              {(resume.certifications && resume.certifications.length > 0
                ? resume.certifications
                : profile.certifications || []
              ).map((cert, idx) => {
                const cName = typeof cert === 'string' ? cert : cert.name;
                const cIssuer = typeof cert === 'object' && cert.issuer ? ` – ${cert.issuer}` : '';
                const cYear = typeof cert === 'object' && cert.year ? ` (${cert.year})` : '';
                return (
                  <li key={idx} className="leading-relaxed">
                    <span className="-ml-1">
                      <strong className="text-[#111827] dark:text-white">{cName}</strong>
                      {cIssuer}
                      {cYear}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* 7. ADDITIONAL INFORMATION */}
        {resume.additionalInfo && resume.additionalInfo.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-black uppercase tracking-wider text-[#111827] dark:text-white pb-1 border-b border-[#E5E7EB] dark:border-[#334155] flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span>ADDITIONAL INFORMATION</span>
            </h2>

            <ul className="list-disc list-inside space-y-1 text-xs text-[#374151] dark:text-[#D1D5DB]">
              {resume.additionalInfo.map((info, idx) => (
                <li key={idx} className="leading-relaxed">
                  <span className="-ml-1">{info}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 8. Hobbies & Extracurricular Pursuits (Display if present) */}
        {hobbies.length > 0 && (
          <div className="space-y-2 pt-1 print:hidden">
            <h2 className="text-xs font-black uppercase tracking-wider text-[#111827] dark:text-white flex items-center gap-1.5 pb-1 border-b border-[#E5E7EB] dark:border-[#334155]">
              <Heart className="w-3.5 h-3.5 text-rose-500" />
              <span>Personal Interests &amp; Hobbies</span>
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
