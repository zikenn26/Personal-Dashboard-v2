import React from 'react';
import {
  UserProfile,
  PortfolioProject,
  SkillCategory,
  EducationRecord,
  JobExperience,
  CertificationItem,
  PublicationItem,
  AchievementItem,
} from '../types';
import { STOCK_IMAGES } from '../assets/stockImages';
import {
  Mail,
  Phone,
  MapPin,
  Linkedin,
  Github,
  Globe,
  ExternalLink,
  Award,
  BookOpen,
} from 'lucide-react';

export type ResumeFormatStyle = 'jakes' | 'modern' | 'executive';

interface ResumeViewProps {
  sheetRef: React.RefObject<HTMLDivElement | null>;
  profile: UserProfile;
  projects: PortfolioProject[];
  skills: SkillCategory[];
  formatStyle?: ResumeFormatStyle;
  visibleSections?: Record<string, boolean>;
  onEditSection?: (sectionId: string) => void;
}

export const ResumeView: React.FC<ResumeViewProps> = ({
  sheetRef,
  profile,
  projects,
  skills,
  formatStyle = 'modern',
  visibleSections,
  onEditSection,
}) => {
  // Extract values with default fallbacks strictly matching the requested profile
  const displayName = profile.name || 'Gulshan Kumar Nayak';
  const displayTitle = profile.title || 'Data & AI Engineer  |  Researcher  |  Problem Solver';
  const displayEmail = profile.contactEmail || 'gulshan@example.com';
  const displayPhone = profile.phone || '+91 98765 43210';
  const displayLocation = profile.location || 'Bhubaneswar, India';
  const displayLinkedin = profile.linkedin || 'linkedin.com/in/gulshan';
  const displayGithub = profile.github || 'github.com/gulshan';
  const displayWebsite = profile.website || 'portfolio.gulshan.dev';
  const summaryText =
    profile.professionalSummary ||
    'Data and AI enthusiast with a strong academic background and hands-on experience in building intelligent systems. Passionate about solving real-world problems through data, machine learning and scalable software solutions.';

  const experienceList: JobExperience[] =
    profile.jobExperiences && profile.jobExperiences.length > 0
      ? profile.jobExperiences
      : [
          {
            id: 'exp-1',
            company: 'HCLSoftware',
            role: 'Software Engineer (BigFix)',
            startDate: 'Jun 2026',
            endDate: 'Present',
            location: 'Noida, India',
            description: 'Working on BigFix and automation solutions.',
            keyAchievements: [
              'Working on BigFix and automation solutions.',
              'Developed and maintained enterprise tools.',
              'Collaborated with cross-functional teams.',
            ],
          },
          {
            id: 'exp-2',
            company: 'NIT Raipur',
            role: 'Research Intern',
            startDate: 'Jan 2025',
            endDate: 'May 2026',
            location: 'Raipur, India',
            description: 'Worked on UAV network security and adversarial ML.',
            keyAchievements: [
              'Worked on UAV network security and adversarial ML.',
              'Published research in peer-reviewed conference.',
            ],
          },
        ];

  const educationList: EducationRecord[] =
    profile.educationRecords && profile.educationRecords.length > 0
      ? profile.educationRecords
      : [
          {
            id: 'edu-1',
            level: 'postgraduation',
            degree: 'M.Tech in Information Technology',
            institution: 'NIT Raipur',
            score: '8.9/10',
            year: '2024 – 2026',
            location: 'Raipur, India',
          },
          {
            id: 'edu-2',
            level: 'graduation',
            degree: 'B.Tech in Information Technology',
            institution: 'VSSUT Burla',
            score: '8.7/10',
            year: '2020 – 2024',
            location: 'Burla, India',
          },
        ];

  const certificationsList: CertificationItem[] = (profile.certifications || []) as CertificationItem[];
  const publicationsList: PublicationItem[] = profile.publications || [];
  const achievementsList: AchievementItem[] = profile.achievementsList || [];

  const isVisible = (id: string) => {
    if (!visibleSections) return true;
    return visibleSections[id] !== false;
  };

  const cleanLink = (url: string) => {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  };

  return (
    <div
      id="printable-resume-sheet"
      ref={sheetRef as any}
      className="w-full max-w-[850px] mx-auto p-4 sm:p-8 md:p-12 rounded-2xl bg-white text-gray-900 shadow-sm border border-gray-100 transition-all font-sans print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none print:w-full print:bg-white print:text-black"
    >
      {/* 1. RESUME HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 sm:gap-6 pb-6 border-b border-gray-100">
        {/* Left: Name, Title & 2-row Contact Matrix */}
        <div className="space-y-2 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold font-serif text-gray-950 tracking-tight leading-tight">
            {displayName}
          </h1>

          <p className="text-xs text-gray-600 font-medium tracking-wide">
            {displayTitle}
          </p>

          <div className="pt-2 space-y-1.5 text-xs text-gray-600">
            {/* Row 1: Email · Phone · Location */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <a
                href={`mailto:${displayEmail}`}
                className="flex items-center gap-1.5 hover:text-gray-900 transition-colors"
              >
                <Mail className="w-3.5 h-3.5 text-gray-500" />
                <span>{displayEmail}</span>
              </a>

              <a
                href={`tel:${displayPhone}`}
                className="flex items-center gap-1.5 hover:text-gray-900 transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-gray-500" />
                <span>{displayPhone}</span>
              </a>

              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-gray-500" />
                <span>{displayLocation}</span>
              </div>
            </div>

            {/* Row 2: LinkedIn · GitHub · Website */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <a
                href={displayLinkedin.startsWith('http') ? displayLinkedin : `https://${displayLinkedin}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 hover:text-gray-900 transition-colors"
              >
                <Linkedin className="w-3.5 h-3.5 text-gray-500" />
                <span>{cleanLink(displayLinkedin)}</span>
              </a>

              <a
                href={displayGithub.startsWith('http') ? displayGithub : `https://${displayGithub}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 hover:text-gray-900 transition-colors"
              >
                <Github className="w-3.5 h-3.5 text-gray-500" />
                <span>{cleanLink(displayGithub)}</span>
              </a>

              <a
                href={displayWebsite.startsWith('http') ? displayWebsite : `https://${displayWebsite}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 hover:text-gray-900 transition-colors"
              >
                <Globe className="w-3.5 h-3.5 text-gray-500" />
                <span>{cleanLink(displayWebsite)}</span>
              </a>
            </div>
          </div>
        </div>

        {/* Right: Circular Avatar & Italic Quote */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0 self-start sm:self-center">
          <div className="relative">
            <img
              src={profile.avatarUrl || STOCK_IMAGES.avatar}
              alt={displayName}
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-white shadow-sm ring-1 ring-gray-200"
            />
          </div>

          <div className="text-left font-serif italic text-xs sm:text-sm text-gray-600 leading-snug">
            <p className="whitespace-pre-line">{`“Build\nLearn\nSolve\nRepeat”`}</p>
            <div className="w-7 h-[1.5px] bg-gray-400 mt-1.5" />
          </div>
        </div>
      </div>

      {/* 2. RESUME BODY SECTIONS */}
      <div className="space-y-6 pt-5">
        {/* SECTION: PROFESSIONAL SUMMARY */}
        {isVisible('summary') && summaryText && (
          <section className="space-y-1.5">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-950">
                Professional Summary
              </h2>
              {onEditSection && (
                <button
                  type="button"
                  onClick={() => onEditSection('summary')}
                  className="text-[10px] text-gray-400 hover:text-indigo-600 opacity-0 hover:opacity-100 transition-opacity print:hidden cursor-pointer"
                >
                  Edit
                </button>
              )}
            </div>
            <p className="text-xs text-gray-600 leading-relaxed text-justify">
              {summaryText}
            </p>
          </section>
        )}

        {/* SECTION: EXPERIENCE */}
        {isVisible('experience') && experienceList.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-950">
                Experience
              </h2>
              {onEditSection && (
                <button
                  type="button"
                  onClick={() => onEditSection('experience')}
                  className="text-[10px] text-gray-400 hover:text-indigo-600 opacity-0 hover:opacity-100 transition-opacity print:hidden cursor-pointer"
                >
                  Edit
                </button>
              )}
            </div>

            <div className="relative pl-5 border-l-2 border-gray-200 ml-1.5 space-y-4">
              {experienceList.map((exp, idx) => (
                <div key={exp.id || idx} className="relative space-y-1">
                  {/* Timeline bullet dot */}
                  <span className="absolute -left-[25px] top-1.5 w-2 h-2 rounded-full bg-[#1E293B] border-2 border-white ring-1 ring-gray-200" />

                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between text-xs gap-0.5 sm:gap-2">
                    <span className="font-bold text-gray-950">
                      {exp.company}
                    </span>
                    <span className="text-[11px] text-gray-500 font-medium shrink-0">
                      {exp.startDate}
                      {exp.endDate ? ` – ${exp.endDate}` : ''}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-gray-700 font-medium">
                      {exp.role}
                    </span>
                    {exp.location && (
                      <span className="text-[11px] text-gray-500">
                        {exp.location}
                      </span>
                    )}
                  </div>

                  {exp.keyAchievements && exp.keyAchievements.length > 0 ? (
                    <ul className="list-disc list-outside pl-4 space-y-0.5 text-xs text-gray-600 pt-0.5">
                      {exp.keyAchievements.map((item, aIdx) => (
                        <li key={aIdx} className="leading-snug">
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : exp.description ? (
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {exp.description}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SECTION: EDUCATION */}
        {isVisible('education') && educationList.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-950">
                Education
              </h2>
              {onEditSection && (
                <button
                  type="button"
                  onClick={() => onEditSection('education')}
                  className="text-[10px] text-gray-400 hover:text-indigo-600 opacity-0 hover:opacity-100 transition-opacity print:hidden cursor-pointer"
                >
                  Edit
                </button>
              )}
            </div>

            <div className="relative pl-5 border-l-2 border-gray-200 ml-1.5 space-y-4">
              {educationList.map((edu, idx) => (
                <div key={edu.id || idx} className="relative space-y-0.5">
                  {/* Timeline bullet dot */}
                  <span className="absolute -left-[25px] top-1.5 w-2 h-2 rounded-full bg-[#1E293B] border-2 border-white ring-1 ring-gray-200" />

                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between text-xs gap-0.5 sm:gap-2">
                    <span className="font-bold text-gray-950">
                      {edu.degree}
                    </span>
                    <span className="text-[11px] text-gray-500 font-medium shrink-0">
                      {edu.year}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between text-xs text-gray-700">
                    <span>
                      {edu.institution || edu.boardOrUniversity}
                      {edu.score ? ` | CGPA: ${edu.score.replace(/^CGPA:?\s*/i, '')}` : ''}
                    </span>
                    {edu.location && (
                      <span className="text-[11px] text-gray-500">
                        {edu.location}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SECTION: SKILLS */}
        {isVisible('skills') && skills && skills.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-950">
                Technical Skills
              </h2>
              {onEditSection && (
                <button
                  type="button"
                  onClick={() => onEditSection('skills')}
                  className="text-[10px] text-gray-400 hover:text-indigo-600 opacity-0 hover:opacity-100 transition-opacity print:hidden cursor-pointer"
                >
                  Edit
                </button>
              )}
            </div>

            <div className="space-y-1 text-xs text-gray-700">
              {skills.map((sc, sIdx) => (
                <div key={sIdx} className="flex flex-wrap items-baseline gap-1.5">
                  <span className="font-bold text-gray-950 min-w-[120px]">
                    {sc.category}:
                  </span>
                  <span className="text-gray-600">
                    {sc.skills.map((s) => s.name).join(', ')}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SECTION: PROJECTS */}
        {isVisible('projects') && projects && projects.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-950">
                Key Projects
              </h2>
              {onEditSection && (
                <button
                  type="button"
                  onClick={() => onEditSection('projects')}
                  className="text-[10px] text-gray-400 hover:text-indigo-600 opacity-0 hover:opacity-100 transition-opacity print:hidden cursor-pointer"
                >
                  Edit
                </button>
              )}
            </div>

            <div className="space-y-3 text-xs">
              {projects.slice(0, 3).map((proj, pIdx) => (
                <div key={proj.id || pIdx} className="space-y-0.5">
                  <div className="flex items-baseline justify-between font-bold text-gray-950">
                    <span>{proj.title}</span>
                    {proj.techStack && proj.techStack.length > 0 && (
                      <span className="text-[10.5px] font-normal text-gray-500">
                        {proj.techStack.join(' • ')}
                      </span>
                    )}
                  </div>
                  {proj.description && (
                    <p className="text-gray-600 leading-relaxed">
                      {proj.description}
                    </p>
                  )}
                  {proj.keyResult && (
                    <p className="text-gray-700 font-medium text-[11px]">
                      Impact: {proj.keyResult}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SECTION: CERTIFICATIONS */}
        {isVisible('certifications') && certificationsList.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-950">
              Certifications
            </h2>
            <div className="space-y-1 text-xs text-gray-600">
              {certificationsList.map((cert, cIdx) => (
                <div key={cert.id || cIdx} className="flex justify-between">
                  <span className="font-medium text-gray-950">{cert.title || (cert as any).name}</span>
                  <span className="text-gray-500">{cert.issuer} {cert.year ? `(${cert.year})` : ''}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SECTION: PUBLICATIONS */}
        {isVisible('publications') && publicationsList.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-950">
              Publications &amp; Research
            </h2>
            <div className="space-y-1.5 text-xs text-gray-600">
              {publicationsList.map((pub, pIdx) => (
                <div key={pub.id || pIdx}>
                  <p className="font-medium text-gray-950">{pub.title}</p>
                  <p className="text-[11px] text-gray-500">
                    {pub.publisher || pub.conference} {pub.year ? `(${pub.year})` : ''}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SECTION: ACHIEVEMENTS */}
        {isVisible('achievements') && achievementsList.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-950">
              Achievements
            </h2>
            <ul className="list-disc list-outside pl-4 space-y-0.5 text-xs text-gray-600">
              {achievementsList.map((ach, aIdx) => (
                <li key={ach.id || aIdx}>
                  <span className="font-medium text-gray-950">{ach.title}</span>
                  {ach.description && <span> – {ach.description}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
};
