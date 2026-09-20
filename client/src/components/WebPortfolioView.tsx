import React, { useState, useMemo } from 'react';
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
  Download,
  Mail,
  Linkedin,
  Github,
  FileText,
  Sparkles,
  Compass,
  PenTool,
  Heart,
  ArrowRight,
  ExternalLink,
  MapPin,
  Building,
  GraduationCap,
  Award,
  BookOpen,
  Check,
  Copy,
  Send,
  Code2,
} from 'lucide-react';
import { Sound } from '../utils/audio';

interface WebPortfolioViewProps {
  profile: UserProfile;
  projects: PortfolioProject[];
  skills: SkillCategory[];
  soundEnabled: boolean;
  onOpenResumeTab: () => void;
  onDownloadPDF: () => void;
  onSelectProject: (project: PortfolioProject) => void;
  onEditSection?: (sectionId: string) => void;
}

export type WebPortfolioDockTab =
  | 'about'
  | 'experience'
  | 'projects'
  | 'skills'
  | 'education'
  | 'certifications'
  | 'publications'
  | 'contact';

export const WebPortfolioView: React.FC<WebPortfolioViewProps> = ({
  profile,
  projects,
  skills,
  soundEnabled,
  onOpenResumeTab,
  onDownloadPDF,
  onSelectProject,
  onEditSection,
}) => {
  const [activeDockTab, setActiveDockTab] = useState<WebPortfolioDockTab>('about');
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSent, setContactSent] = useState(false);

  // Fallback data aligning precisely with the target image
  const displayName = profile.name || 'Gulshan Kumar Nayak';
  const displayTitle = profile.title || 'Data & AI Engineer  |  Researcher  |  Problem Solver';
  const displayBio =
    profile.bio ||
    'I build data-driven systems, AI applications and intelligent solutions to solve real-world problems.';
  const displayEmail = profile.contactEmail || 'gulshan@example.com';
  const displayLocation = profile.location || 'Bhubaneswar, India';
  const displayGithub = profile.github || 'github.com/gulshan';
  const displayLinkedin = profile.linkedin || 'linkedin.com/in/gulshan';
  const displayWebsite = profile.website || 'portfolio.gulshan.dev';

  const experiences: JobExperience[] =
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
            techStack: ['BigFix', 'Automation', 'Python', 'C++'],
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
            techStack: ['Adversarial ML', 'UAV Security', 'PyTorch'],
          },
        ];

  const educations: EducationRecord[] =
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

  const certifications: CertificationItem[] = (profile.certifications || []) as CertificationItem[];
  const publications: PublicationItem[] = profile.publications || [];

  const handleTabClick = (tab: WebPortfolioDockTab) => {
    Sound.click(soundEnabled);
    setActiveDockTab(tab);
    const element = document.getElementById(`portfolio-sec-${tab}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleCopyEmail = () => {
    Sound.click(soundEnabled);
    navigator.clipboard.writeText(displayEmail);
    Sound.success(soundEnabled);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2200);
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    Sound.click(soundEnabled);
    const mailto = `mailto:${displayEmail}?subject=${encodeURIComponent(
      contactSubject || 'Portfolio Inquiry'
    )}&body=${encodeURIComponent(contactMessage)}`;
    window.location.href = mailto;
    setContactSent(true);
    Sound.success(soundEnabled);
    setTimeout(() => setContactSent(false), 4000);
  };

  return (
    <div className="w-full space-y-10 text-gray-900 pb-16">
      {/* 1. HERO CARD COMPOSITION (Exact replica of the bottom half of the image) */}
      <section className="w-full bg-white rounded-3xl p-5 sm:p-8 lg:p-12 border border-gray-100 shadow-[0_4px_30px_-5px_rgba(0,0,0,0.04)] relative overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* COLUMN 1: INTRO, IDENTITY, ACTIONS & STATS (Span 5) */}
          <div className="lg:col-span-5 space-y-5">
            {/* Eyebrow */}
            <p className="text-[11px] font-bold text-gray-400 tracking-[0.25em] uppercase">
              HELLO, I&apos;M
            </p>

            {/* Giant Display Name */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[54px] font-bold font-serif text-gray-950 tracking-tight leading-[1.08]">
              Gulshan Kumar
              <br />
              Nayak
            </h1>

            {/* Subtitle / Core Identity */}
            <p className="text-xs sm:text-sm text-gray-600 font-medium tracking-wide">
              {displayTitle}
            </p>

            {/* Lead Narrative */}
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed max-w-md">
              {displayBio}
            </p>

            {/* Action Buttons Row: Download Resume · Contact Me · Socials */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  Sound.click(soundEnabled);
                  onDownloadPDF();
                }}
                className="flex-1 sm:flex-initial justify-center bg-[#18181B] hover:bg-black text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Resume</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabClick('contact')}
                className="flex-1 sm:flex-initial justify-center bg-white hover:bg-gray-50 border border-gray-200 text-gray-900 text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5 text-gray-600" />
                <span>Contact Me</span>
              </button>

              {/* Social Icon Pills */}
              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={
                    displayLinkedin.startsWith('http')
                      ? displayLinkedin
                      : `https://${displayLinkedin}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition-colors cursor-pointer"
                  title="LinkedIn"
                >
                  <Linkedin className="w-3.5 h-3.5" />
                </a>

                <a
                  href={
                    displayGithub.startsWith('http')
                      ? displayGithub
                      : `https://${displayGithub}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition-colors cursor-pointer"
                  title="GitHub"
                >
                  <Github className="w-3.5 h-3.5" />
                </a>

                <button
                  type="button"
                  onClick={() => {
                    Sound.click(soundEnabled);
                    onOpenResumeTab();
                  }}
                  className="p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition-colors cursor-pointer"
                  title="View Resume Sheet"
                >
                  <FileText className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Key Metrics Stats Row - 2x2 grid on mobile for spacious touch & readability, 4 cols on tablet/desktop */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-2 pt-3 border-t border-gray-100">
              <div className="p-2 sm:p-0 bg-gray-50/60 sm:bg-transparent rounded-xl sm:rounded-none">
                <p className="text-xl sm:text-2xl font-bold font-serif text-gray-950">
                  2+
                </p>
                <p className="text-[10px] sm:text-[11px] text-gray-500 font-medium leading-tight">
                  Years Experience
                </p>
              </div>

              <div className="p-2 sm:p-0 bg-gray-50/60 sm:bg-transparent rounded-xl sm:rounded-none">
                <p className="text-xl sm:text-2xl font-bold font-serif text-gray-950">
                  {projects.length >= 8 ? `${projects.length}+` : '8+'}
                </p>
                <p className="text-[10px] sm:text-[11px] text-gray-500 font-medium leading-tight">
                  Projects
                </p>
              </div>

              <div className="p-2 sm:p-0 bg-gray-50/60 sm:bg-transparent rounded-xl sm:rounded-none">
                <p className="text-xl sm:text-2xl font-bold font-serif text-gray-950">
                  {publications.length >= 3 ? publications.length : 3}
                </p>
                <p className="text-[10px] sm:text-[11px] text-gray-500 font-medium leading-tight">
                  Publications
                </p>
              </div>

              <div className="p-2 sm:p-0 bg-gray-50/60 sm:bg-transparent rounded-xl sm:rounded-none">
                <p className="text-xl sm:text-2xl font-bold font-serif text-gray-950">
                  {certifications.length >= 6 ? `${certifications.length}+` : '6+'}
                </p>
                <p className="text-[10px] sm:text-[11px] text-gray-500 font-medium leading-tight">
                  Certifications
                </p>
              </div>
            </div>

            {/* Status Line: Currently at HCLSoftware · Based in India · Open to opportunities */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-gray-600 pt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="font-medium text-gray-800">Currently at HCLSoftware</span>
              <span className="text-gray-300">|</span>
              <span>Based in India</span>
              <span className="text-gray-300">|</span>
              <span className="text-gray-500">Open to opportunities</span>
            </div>
          </div>

          {/* COLUMN 2: ARTISTIC PORTRAIT WITH WARM ORGANIC RIPPLE BACKDROP & QUOTE (Span 4) */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center relative min-h-[300px] sm:min-h-[420px] py-4 sm:py-0 w-full overflow-hidden sm:overflow-visible">
            {/* Concentric Organic Backdrop Contours */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <svg
                viewBox="0 0 400 400"
                className="w-full h-full max-w-[320px] sm:max-w-[380px] max-h-[320px] sm:max-h-[380px] opacity-80"
                fill="none"
              >
                <circle cx="200" cy="200" r="180" fill="#FCF8F2" />
                <path
                  d="M120,80 Q200,40 280,80 T360,200 Q360,300 260,350 T100,310 Q40,240 60,160 Z"
                  fill="#FAF2E6"
                />
                <circle cx="200" cy="200" r="130" stroke="#F0E4D2" strokeWidth="1.5" strokeDasharray="4 4" />
                <circle cx="200" cy="200" r="160" stroke="#EADCCE" strokeWidth="1" />
              </svg>
            </div>

            {/* Person Cutout / Portrait */}
            <div className="relative z-10 w-56 sm:w-64 md:w-72 max-w-full flex items-center justify-center">
              <img
                src={profile.avatarUrl || STOCK_IMAGES.avatar}
                alt={displayName}
                className="w-48 sm:w-56 md:w-64 h-64 sm:h-72 md:h-80 object-cover object-top rounded-3xl shadow-md border-4 border-white"
              />

              {/* Floating Italic Quote beside head (compact on mobile to prevent clipping) */}
              <div className="absolute top-1 -right-2 sm:-top-3 sm:-right-8 bg-white/95 backdrop-blur-xs p-2.5 sm:p-3 rounded-2xl border border-gray-100 shadow-sm text-left font-serif italic text-[11px] sm:text-xs text-gray-600 leading-snug">
                <p className="whitespace-pre-line">{`“Better\nSystems\nBrighter\nTomorrows”`}</p>
                <div className="w-6 sm:w-8 h-[1.5px] bg-gray-400 mt-1.5" />
              </div>
            </div>
          </div>

          {/* COLUMN 3: PHILOSOPHY & 4 VALUE PILLARS (Span 3) */}
          <div className="lg:col-span-3 space-y-5 sm:space-y-6">
            <div>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                Using data, AI and technology to solve meaningful problems and create real impact.
              </p>
              <div className="w-10 h-[2px] bg-gray-800 my-3 sm:my-4" />
            </div>

            {/* 4 Feature Items with Circular Badges: 2 cols on tablet, 1 on mobile & desktop */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 sm:gap-4">
              {/* 1. Data & AI */}
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#E0F4F0] text-[#0D9488] flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-950">Data &amp; AI</h3>
                  <p className="text-[11px] text-gray-500 leading-snug">
                    From insights to intelligent systems
                  </p>
                </div>
              </div>

              {/* 2. Research */}
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0">
                  <Compass className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-950">Research</h3>
                  <p className="text-[11px] text-gray-500 leading-snug">
                    Exploring real-world challenges
                  </p>
                </div>
              </div>

              {/* 3. Build & Learn */}
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#FFE4E6] text-[#E11D48] flex items-center justify-center shrink-0">
                  <PenTool className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-950">Build &amp; Learn</h3>
                  <p className="text-[11px] text-gray-500 leading-snug">
                    Continuous growth through projects
                  </p>
                </div>
              </div>

              {/* 4. Make an Impact */}
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center shrink-0">
                  <Heart className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-950">Make an Impact</h3>
                  <p className="text-[11px] text-gray-500 leading-snug">
                    Technology for a better tomorrow
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. FLOATING / STICKY BOTTOM NAVIGATION DOCK (Exact replica of the bottom pill dock) */}
      <div className="sticky top-4 z-20 w-full flex justify-center px-1 sm:px-2">
        <nav
          aria-label="Portfolio sections navigation"
          className="bg-white/95 backdrop-blur-md rounded-full px-3 sm:px-6 py-2 border border-gray-200 shadow-lg flex items-center justify-between gap-2 sm:gap-6 max-w-4xl w-full overflow-x-auto scrollbar-none"
        >
          {/* Navigation Links */}
          <div className="flex items-center gap-2.5 sm:gap-5 text-xs whitespace-nowrap overflow-x-auto py-0.5">
            {(
              [
                { id: 'about', label: 'About' },
                { id: 'experience', label: 'Experience' },
                { id: 'projects', label: 'Projects' },
                { id: 'skills', label: 'Skills' },
                { id: 'education', label: 'Education' },
                { id: 'certifications', label: 'Certifications' },
                { id: 'publications', label: 'Publications' },
                { id: 'contact', label: 'Contact' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                className={`pb-1 transition-all cursor-pointer font-medium text-[11px] sm:text-xs ${
                  activeDockTab === tab.id
                    ? 'text-gray-950 font-bold border-b-2 border-gray-950'
                    : 'text-gray-500 hover:text-gray-900 border-b-2 border-transparent'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Right Action: Let's Connect */}
          <button
            type="button"
            onClick={() => handleTabClick('contact')}
            className="bg-[#18181B] hover:bg-black text-white text-[11px] sm:text-xs font-medium px-3 sm:px-4 py-1.5 rounded-full flex items-center gap-1 sm:gap-1.5 shrink-0 shadow-2xs transition-colors cursor-pointer ml-auto"
          >
            <span className="hidden sm:inline">Let&apos;s Connect</span>
            <span className="sm:hidden">Connect</span>
            <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </button>
        </nav>
      </div>

      {/* 3. SUB-SECTIONS CONTENT (Rendered when navigating or scrolling) */}
      <div className="space-y-12 max-w-4xl mx-auto px-2">
        {/* SECTION: ABOUT */}
        <section id="portfolio-sec-about" className="space-y-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              About &amp; Background
            </h2>
            {onEditSection && (
              <button
                type="button"
                onClick={() => onEditSection('summary')}
                className="text-xs text-indigo-600 hover:underline cursor-pointer"
              >
                Edit
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-2xs space-y-4 text-xs sm:text-sm text-gray-600 leading-relaxed">
            <p>
              {profile.professionalSummary ||
                'Data and AI enthusiast with a strong academic background and hands-on experience in building intelligent systems. Passionate about solving real-world problems through data, machine learning and scalable software solutions.'}
            </p>
            <p>
              Currently engineering robust enterprise automation tools and security solutions at{' '}
              <strong className="text-gray-900 font-semibold">HCLSoftware</strong>. Deep academic
              foundation in distributed architectures, adversarial machine learning, and UAV communication
              security from <strong className="text-gray-900 font-semibold">NIT Raipur</strong>.
            </p>
          </div>
        </section>

        {/* SECTION: EXPERIENCE */}
        <section id="portfolio-sec-experience" className="space-y-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Experience
            </h2>
            {onEditSection && (
              <button
                type="button"
                onClick={() => onEditSection('experience')}
                className="text-xs text-indigo-600 hover:underline cursor-pointer"
              >
                Edit
              </button>
            )}
          </div>

          <div className="space-y-4">
            {experiences.map((exp, idx) => (
              <div
                key={exp.id || idx}
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-2xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                  <div>
                    <h3 className="text-sm font-bold text-gray-950">{exp.company}</h3>
                    <p className="text-xs text-gray-600 font-medium">{exp.role}</p>
                  </div>
                  <div className="text-right text-[11px] text-gray-500 font-medium">
                    <span>
                      {exp.startDate} – {exp.endDate || 'Present'}
                    </span>
                    {exp.location && <span> | {exp.location}</span>}
                  </div>
                </div>

                {exp.keyAchievements && exp.keyAchievements.length > 0 ? (
                  <ul className="list-disc list-outside pl-4 space-y-1 text-xs text-gray-600">
                    {exp.keyAchievements.map((item, aIdx) => (
                      <li key={aIdx}>{item}</li>
                    ))}
                  </ul>
                ) : exp.description ? (
                  <p className="text-xs text-gray-600">{exp.description}</p>
                ) : null}

                {exp.techStack && exp.techStack.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {exp.techStack.map((tech, tIdx) => (
                      <span
                        key={tIdx}
                        className="px-2.5 py-0.5 rounded-md bg-gray-100 text-[11px] font-medium text-gray-600"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* SECTION: PROJECTS */}
        <section id="portfolio-sec-projects" className="space-y-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Featured Projects
            </h2>
            {onEditSection && (
              <button
                type="button"
                onClick={() => onEditSection('projects')}
                className="text-xs text-indigo-600 hover:underline cursor-pointer"
              >
                Edit
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((proj) => (
              <div
                key={proj.id}
                onClick={() => onSelectProject(proj)}
                className="bg-white rounded-2xl p-5 border border-gray-100 shadow-2xs hover:shadow-sm hover:border-gray-200 transition-all cursor-pointer space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-gray-950 leading-snug">
                      {proj.title}
                    </h3>
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                  </div>

                  {proj.description && (
                    <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed">
                      {proj.description}
                    </p>
                  )}
                </div>

                <div className="space-y-2 pt-2">
                  {proj.keyResult && (
                    <p className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                      Impact: {proj.keyResult}
                    </p>
                  )}

                  {proj.techStack && proj.techStack.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {proj.techStack.slice(0, 4).map((tech, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-gray-100 text-[10px] font-medium text-gray-600"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION: SKILLS */}
        <section id="portfolio-sec-skills" className="space-y-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Technical Competencies
            </h2>
            {onEditSection && (
              <button
                type="button"
                onClick={() => onEditSection('skills')}
                className="text-xs text-indigo-600 hover:underline cursor-pointer"
              >
                Edit
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {skills.map((sc, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl p-5 border border-gray-100 shadow-2xs space-y-3"
              >
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-950">
                  {sc.category}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {sc.skills.map((s, sIdx) => (
                    <span
                      key={sIdx}
                      className="px-3 py-1 rounded-full bg-gray-100 hover:bg-gray-200 text-xs font-medium text-gray-800 transition-colors"
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION: EDUCATION */}
        <section id="portfolio-sec-education" className="space-y-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Education
            </h2>
            {onEditSection && (
              <button
                type="button"
                onClick={() => onEditSection('education')}
                className="text-xs text-indigo-600 hover:underline cursor-pointer"
              >
                Edit
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {educations.map((edu, idx) => (
              <div
                key={edu.id || idx}
                className="bg-white rounded-2xl p-5 border border-gray-100 shadow-2xs space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-gray-950">{edu.degree}</span>
                  <span className="text-[11px] text-gray-500 font-medium">{edu.year}</span>
                </div>
                <p className="text-xs text-gray-700 font-medium">
                  {edu.institution || edu.boardOrUniversity}
                  {edu.score ? ` | CGPA: ${edu.score.replace(/^CGPA:?\s*/i, '')}` : ''}
                </p>
                {edu.location && (
                  <p className="text-[11px] text-gray-500">{edu.location}</p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* SECTION: CERTIFICATIONS & PUBLICATIONS */}
        {(certifications.length > 0 || publications.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
            {/* Certifications */}
            {certifications.length > 0 && (
              <section id="portfolio-sec-certifications" className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Certifications
                </h2>
                <div className="space-y-2">
                  {certifications.map((c, idx) => (
                    <div
                      key={c.id || idx}
                      className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-2xs flex items-center justify-between text-xs"
                    >
                      <span className="font-semibold text-gray-950">{c.title || (c as any).name}</span>
                      <span className="text-[11px] text-gray-500">{c.issuer}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Publications */}
            {publications.length > 0 && (
              <section id="portfolio-sec-publications" className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Publications
                </h2>
                <div className="space-y-2">
                  {publications.map((p, idx) => (
                    <div
                      key={p.id || idx}
                      className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-2xs space-y-1 text-xs"
                    >
                      <p className="font-semibold text-gray-950 leading-snug">{p.title}</p>
                      <p className="text-[11px] text-gray-500">{p.conference || p.publisher}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* SECTION: CONTACT */}
        <section id="portfolio-sec-contact" className="space-y-4 pt-4 border-t border-gray-100">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Get In Touch
          </h2>

          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            <div className="md:col-span-5 space-y-4">
              <h3 className="text-xl font-bold font-serif text-gray-950">
                Let&apos;s build something intelligent together.
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                Whether you have an upcoming AI project, full-stack architecture challenge, or open
                engineering role, feel free to reach out directly.
              </p>

              <div className="space-y-2.5 pt-2 text-xs">
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors w-full cursor-pointer text-gray-800"
                >
                  <Mail className="w-4 h-4 text-gray-500" />
                  <span className="font-medium">{displayEmail}</span>
                  {copiedEmail ? (
                    <span className="ml-auto text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Copied!
                    </span>
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-gray-400 ml-auto" />
                  )}
                </button>

                <div className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-200 text-gray-700">
                  <MapPin className="w-4 h-4 text-gray-500" />
                  <span>{displayLocation}</span>
                </div>
              </div>
            </div>

            {/* Direct Message Form */}
            <form onSubmit={handleContactSubmit} className="md:col-span-7 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={contactSubject}
                  onChange={(e) => setContactSubject(e.target.value)}
                  placeholder="e.g. AI Engineering Collaboration"
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:ring-1 focus:ring-gray-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  rows={4}
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  placeholder="Write your message here..."
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:ring-1 focus:ring-gray-900 focus:outline-none"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#18181B] hover:bg-black text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{contactSent ? 'Message Sent!' : 'Send Direct Message'}</span>
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
};
