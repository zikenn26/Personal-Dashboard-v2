import React, { useState, useMemo } from 'react';
import {
  UserProfile,
  PortfolioProject,
  SkillCategory,
  EducationRecord,
  JobExperience,
  CertificationItem,
} from '../types';
import {
  FolderGit2,
  ExternalLink,
  Github,
  Sparkles,
  Layers,
  Code2,
  Building,
  GraduationCap,
  Calendar,
  Award,
  Search,
  Plus,
  Mail,
  Phone,
  MapPin,
  Check,
  Copy,
  ChevronRight,
  Filter,
  Eye,
  FileText,
  Briefcase,
  Terminal,
  Send,
  Linkedin,
} from 'lucide-react';
import { Sound } from '../utils/audio';
import { ProjectDetailModal } from './ProjectDetailModal';

interface PortfolioShowcaseProps {
  profile: UserProfile;
  projects: PortfolioProject[];
  skills: SkillCategory[];
  educationRecords: EducationRecord[];
  jobExperiences: JobExperience[];
  certifications: (CertificationItem | { name: string; issuer?: string; year?: string })[];
  soundEnabled: boolean;
  onAddProjectModal: () => void;
  onAddJobModal: () => void;
  onAddEducationModal: () => void;
  onOpenResumeTab: () => void;
  onOpenJobMatcher: () => void;
}

export const PortfolioShowcase: React.FC<PortfolioShowcaseProps> = ({
  profile,
  projects,
  skills,
  educationRecords,
  jobExperiences,
  certifications,
  soundEnabled,
  onAddProjectModal,
  onAddJobModal,
  onAddEducationModal,
  onOpenResumeTab,
  onOpenJobMatcher,
}) => {
  // State
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeProjectModal, setActiveProjectModal] = useState<PortfolioProject | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPitch, setCopiedPitch] = useState(false);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ['All', ...Array.from(set)];
  }, [projects]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchCat = selectedCategory === 'All' || p.category === selectedCategory;
      const query = searchQuery.toLowerCase().trim();
      const matchQuery =
        !query ||
        p.title.toLowerCase().includes(query) ||
        (p.tagLine && p.tagLine.toLowerCase().includes(query)) ||
        p.description.toLowerCase().includes(query) ||
        (p.techStack && p.techStack.some((t) => t.toLowerCase().includes(query))) ||
        (p.tech && p.tech.some((t) => t.toLowerCase().includes(query)));
      return matchCat && matchQuery;
    });
  }, [projects, selectedCategory, searchQuery]);

  const handleCopyEmail = () => {
    const email = profile.contactEmail || 'user@example.com';
    navigator.clipboard.writeText(email);
    Sound.success(soundEnabled);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleCopyIntro = () => {
    const name = profile.name || 'Candidate';
    const title = profile.title || 'Software Engineer';
    const pitch = `Hello! I'm ${name}, a ${title}. I specialize in architecting full-stack systems, backend APIs, and applied machine learning models. Let's connect! Email: ${profile.contactEmail || 'user@example.com'} | LinkedIn: ${profile.linkedin || 'https://linkedin.com'}`;
    navigator.clipboard.writeText(pitch);
    Sound.success(soundEnabled);
    setCopiedPitch(true);
    setTimeout(() => setCopiedPitch(false), 2000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* 1. HERO BENTO GRID: Professional Value & Identity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Main Bio & Value Card (7 cols) */}
        <div className="lg:col-span-8 p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#18181B] border border-gray-200/80 dark:border-zinc-800/80 shadow-xs flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            {/* Status Pill */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Open for Engineering &amp; Data Roles</span>
              </span>

              <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                {profile.location || 'Raipur, India'} • IST (UTC+5:30)
              </span>
            </div>

            {/* Headline */}
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                Architecting resilient systems, modern interfaces &amp; intelligent pipelines.
              </h1>
              <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed max-w-2xl">
                {profile.professionalSummary ||
                  profile.bio ||
                  'M.Tech in Information Technology from NIT Raipur. Hands-on experience developing distributed backend services, high-performance web applications, and computer vision systems.'}
              </p>
            </div>
          </div>

          {/* Quick Actions & Links Strip */}
          <div className="flex flex-wrap items-center gap-2.5 pt-4 border-t border-gray-100 dark:border-zinc-800/70">
            <button
              type="button"
              id="portfolio-copy-email-btn"
              onClick={handleCopyEmail}
              className="px-3.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-semibold text-gray-800 dark:text-gray-200 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {copiedEmail ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Email Copied!</span>
                </>
              ) : (
                <>
                  <Mail className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{profile.contactEmail || 'user@example.com'}</span>
                </>
              )}
            </button>

            <button
              type="button"
              id="portfolio-copy-intro-btn"
              onClick={handleCopyIntro}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-xs font-semibold text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Copy elevator pitch for LinkedIn InMail or message"
            >
              {copiedPitch ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Pitch Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy InMail Pitch</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onOpenResumeTab}
              className="px-3.5 py-1.5 rounded-xl bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer ml-auto"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>View ATS Resume</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Bento Key Metrics Card (4 cols) */}
        <div className="lg:col-span-4 p-6 sm:p-8 rounded-3xl bg-linear-to-br from-indigo-500/5 via-transparent to-purple-500/5 dark:from-indigo-950/20 dark:to-purple-950/20 border border-gray-200/80 dark:border-zinc-800/80 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Key Highlights
              </span>
              <Sparkles className="w-4 h-4 text-indigo-500" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl bg-white/80 dark:bg-zinc-900/80 border border-gray-100 dark:border-zinc-800">
                <div className="text-2xl font-black text-gray-900 dark:text-white">8.55+</div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium leading-tight mt-0.5">
                  CGPA at NIT Raipur (M.Tech IT)
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white/80 dark:bg-zinc-900/80 border border-gray-100 dark:border-zinc-800">
                <div className="text-2xl font-black text-gray-900 dark:text-white">
                  {projects.length}+
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium leading-tight mt-0.5">
                  End-to-End Featured Projects
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white/80 dark:bg-zinc-900/80 border border-gray-100 dark:border-zinc-800">
                <div className="text-2xl font-black text-gray-900 dark:text-white">
                  {certifications.length}+
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium leading-tight mt-0.5">
                  Industry Accreditations
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white/80 dark:bg-zinc-900/80 border border-gray-100 dark:border-zinc-800">
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">100%</div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium leading-tight mt-0.5">
                  ATS Verified &amp; Production Ready
                </div>
              </div>
            </div>
          </div>

          {/* Job Tailoring Quick Tool */}
          <button
            type="button"
            onClick={onOpenJobMatcher}
            className="w-full p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-900/60 hover:border-indigo-500 text-left transition-all group flex items-center justify-between cursor-pointer"
          >
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-indigo-500" />
                <span>Job Match &amp; Tailoring</span>
              </span>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Paste job description to calculate instant ATS fit score
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
          </button>
        </div>
      </div>

      {/* 2. CURATED PROJECTS SHOWCASE */}
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FolderGit2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>Curated Projects &amp; Systems</span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Real-world full-stack architectures, computer vision models, and enterprise BI analytics
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="add-project-btn"
              onClick={onAddProjectModal}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Project</span>
            </button>
          </div>
        </div>

        {/* Filter Pills & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  Sound.click(soundEnabled);
                  setSelectedCategory(cat);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-2xs'
                    : 'bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tech or keyword..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((project) => {
            const techList = project.techStack || project.tech || [];
            const liveUrl = project.liveUrl || project.link;
            const githubUrl = project.githubUrl || project.github;

            return (
              <div
                key={project.id}
                className="group p-5 rounded-2xl bg-white dark:bg-[#18181B] border border-gray-200/80 dark:border-zinc-800/80 shadow-xs hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-800 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Category & Featured Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                      {project.category}
                    </span>

                    {project.featured && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        <span>Featured</span>
                      </span>
                    )}
                  </div>

                  {/* Title & Tagline */}
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                      {project.title}
                    </h3>
                    {project.tagLine && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                        {project.tagLine}
                      </p>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-3 leading-relaxed">
                    {project.description}
                  </p>

                  {/* Tech stack badges */}
                  {techList.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {techList.slice(0, 5).map((t, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300"
                        >
                          {t}
                        </span>
                      ))}
                      {techList.length > 5 && (
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono text-gray-400">
                          +{techList.length - 5}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100 dark:border-zinc-800/70">
                  <button
                    type="button"
                    onClick={() => {
                      Sound.click(soundEnabled);
                      setActiveProjectModal(project);
                    }}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>View Architecture</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>

                  <div className="flex items-center gap-1">
                    {githubUrl && (
                      <a
                        href={githubUrl.startsWith('http') ? githubUrl : `https://${githubUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                        title="View GitHub Repository"
                      >
                        <Github className="w-4 h-4" />
                      </a>
                    )}
                    {liveUrl && (
                      <a
                        href={liveUrl.startsWith('http') ? liveUrl : `https://${liveUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
                        title="Live Demo Preview"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredProjects.length === 0 && (
          <div className="text-center py-12 p-6 rounded-2xl bg-gray-50 dark:bg-zinc-900/40 border border-gray-200 dark:border-zinc-800 space-y-2">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              No projects found matching "{searchQuery}"
            </p>
            <p className="text-xs text-gray-500">
              Try adjusting your search terms or filter category.
            </p>
          </div>
        )}
      </div>

      {/* 3. TECHNICAL SKILLS & RADAR MATRIX */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#18181B] border border-gray-200/80 dark:border-zinc-800/80 shadow-xs space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Code2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>Core Technical Competencies</span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Categorized proficiency matrix across distributed systems, frontend engineering &amp; analytics
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {skills.map((cat, idx) => (
            <div
              key={idx}
              className="p-4 rounded-2xl bg-gray-50/70 dark:bg-zinc-900/40 border border-gray-100 dark:border-zinc-800 space-y-3"
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center justify-between">
                <span>{cat.category}</span>
                <span className="text-[10px] text-gray-400 font-mono font-normal">
                  {cat.skills.length} skills
                </span>
              </h3>

              <div className="space-y-2">
                {cat.skills.map((s, sIdx) => (
                  <div key={sIdx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1">
                        {s.name}
                        {s.highlight && <Sparkles className="w-3 h-3 text-amber-500" />}
                      </span>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                        {s.experience || `${s.level}%`}
                      </span>
                    </div>
                    {/* Visual Meter */}
                    <div className="h-1.5 w-full bg-gray-200 dark:bg-zinc-700/60 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 dark:bg-indigo-400 rounded-full transition-all duration-500"
                        style={{ width: `${s.level}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. CAREER TRAJECTORY & ACADEMICS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Work Experience */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#18181B] border border-gray-200/80 dark:border-zinc-800/80 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>Professional Experience</span>
            </h2>
            <button
              type="button"
              onClick={onAddJobModal}
              className="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              title="Add Experience"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {jobExperiences.map((job) => (
              <div
                key={job.id}
                className="p-4 rounded-2xl bg-gray-50/70 dark:bg-zinc-900/40 border border-gray-100 dark:border-zinc-800 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                      {job.role}
                    </h3>
                    <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      {job.company}
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {job.startDate}
                  </span>
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  {job.description}
                </p>

                {job.keyAchievements && job.keyAchievements.length > 0 && (
                  <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1 list-disc list-inside">
                    {job.keyAchievements.map((ach, aIdx) => (
                      <li key={aIdx}>{ach}</li>
                    ))}
                  </ul>
                )}

                {job.techStack && job.techStack.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {job.techStack.map((t, tIdx) => (
                      <span
                        key={tIdx}
                        className="px-2 py-0.5 rounded text-[10px] font-mono bg-gray-200/70 dark:bg-zinc-800 text-gray-700 dark:text-gray-300"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Education */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#18181B] border border-gray-200/80 dark:border-zinc-800/80 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>Academic Education</span>
            </h2>
            <button
              type="button"
              onClick={onAddEducationModal}
              className="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              title="Add Education"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {educationRecords.map((edu) => (
              <div
                key={edu.id}
                className="p-4 rounded-2xl bg-gray-50/70 dark:bg-zinc-900/40 border border-gray-100 dark:border-zinc-800 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                      {edu.degree}
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                      {edu.institution}
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {edu.year}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  {edu.score && (
                    <span className="px-2 py-0.5 rounded-md font-mono font-bold text-[11px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      Score: {edu.score}
                    </span>
                  )}
                  {edu.location && (
                    <span className="text-gray-500 dark:text-gray-400">{edu.location}</span>
                  )}
                </div>

                {edu.highlights && edu.highlights.length > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 pt-1">
                    {edu.highlights.join(' • ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5. CERTIFICATIONS & ACCREDITATIONS */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#18181B] border border-gray-200/80 dark:border-zinc-800/80 shadow-xs space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Award className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <span>Industry Certifications &amp; Accreditations</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {certifications.map((cert, idx) => {
            const certName = typeof cert === 'string' ? cert : cert.name;
            const issuer = typeof cert === 'string' ? '' : cert.issuer;
            const year = typeof cert === 'string' ? '' : cert.year;

            return (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-gray-50/70 dark:bg-zinc-900/40 border border-gray-100 dark:border-zinc-800 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <Award className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                    {certName}
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                    {issuer || 'Verified Credential'} {year ? `• ${year}` : ''}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Project Detail Modal */}
      {activeProjectModal && (
        <ProjectDetailModal
          project={activeProjectModal}
          onClose={() => setActiveProjectModal(null)}
          soundEnabled={soundEnabled}
        />
      )}
    </div>
  );
};
