import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import {
  Share2,
  Pencil,
  Download,
  Plus,
  GraduationCap,
  BadgeCheck,
  Mail,
  ExternalLink,
  Printer,
  Copy,
  Trash2,
  FileText,
  X,
  Sparkles,
  Check,
} from 'lucide-react';
import {
  UserProfile,
  PortfolioProject,
  SkillCategory,
  ResumeDocument,
} from '../types';
import { nativeService } from '../services/nativeService';
import { Sound } from '../utils/audio';
import { toast } from 'sonner';
import { PrintableResumePreviewModal } from './PrintableResumePreviewModal';

export interface ExecutiveDossierViewProps {
  profile: UserProfile;
  projects?: PortfolioProject[];
  skills?: SkillCategory[];
  resume?: ResumeDocument;
  onUpdateProfile?: (updated: Partial<UserProfile>) => void;
  onUpdateProjects?: (projects: PortfolioProject[]) => void;
  onUpdateSkills?: (skills: SkillCategory[]) => void;
  onUpdateResume?: (resume: ResumeDocument) => void;
  onAddProject?: (project: Omit<PortfolioProject, 'id'>) => void;
  onDeleteProject?: (id: string) => void;
  soundEnabled?: boolean;
}

interface ExperienceItem {
  id?: string;
  role: string;
  company: string;
  period: string;
  details?: string;
  achievements?: string[];
}

interface ProjectDisplayItem {
  id: string;
  title: string;
  tagLine?: string;
  badge?: string;
  badgeColor?: 'emerald' | 'indigo' | 'violet';
  techStack?: string[];
  description: string;
  liveUrl?: string;
  githubUrl?: string;
}

interface CompetencyItem {
  category: string;
  stack: string;
}

interface EducationItem {
  degree: string;
  school: string;
  year: string;
}

interface CertificationItem {
  name: string;
  badge: string;
}

const DEFAULT_EXPERIENCES: ExperienceItem[] = [
  {
    id: 'exp-1',
    role: 'Senior Full Stack Engineer',
    company: 'Enterprise Solutions & Cloud Platforms',
    period: '2023 — Present',
    achievements: [
      'Architected distributed stateless authentication handling 45,000+ daily active users with sub-40ms token validation latency.',
      'Engineered automated multi-tenant database partitioning on PostgreSQL, cutting peak API response cycles by 32%.',
      'Led front-end migration to Next.js App Router and optimized SSR hydration, reducing Largest Contentful Paint (LCP) from 3.1s to 1.1s.',
    ],
  },
  {
    id: 'exp-2',
    role: 'Full Stack Software Engineer',
    company: 'Data & Developer Infrastructure Labs',
    period: '2021 — 2023',
    achievements: [
      'Constructed high-speed ETL ingestion pipes streaming 1.2M+ records/day via containerized microservices.',
      'Implemented reusable UI design system and standardized component libraries across 5 distinct engineering squads.',
    ],
  },
];

const DEFAULT_KEY_PROJECTS: ProjectDisplayItem[] = [
  {
    id: 'proj-1',
    title: 'My Exam Dashboard',
    badge: 'Production',
    badgeColor: 'emerald',
    techStack: ['Next.js', 'Node.js', 'Gemini API', 'JWT', 'Tailwind'],
    description:
      'Full lifecycle examination intelligence hub featuring AI-assisted candidate contextual Q&A and automated scheduling feeds.',
    liveUrl: 'https://github.com',
  },
  {
    id: 'proj-2',
    title: 'Enterprise Analytics Platform',
    badge: 'Data Pipeline',
    badgeColor: 'indigo',
    techStack: ['Python', 'FastAPI', 'PostgreSQL', 'Docker'],
    description:
      'Telemetry ingestion pipeline transforming complex multi-source event streams into fast star-schema models with <120ms queries.',
    liveUrl: 'https://github.com',
  },
];

const DEFAULT_COMPETENCIES: CompetencyItem[] = [
  {
    category: 'Frontend',
    stack: 'React, Next.js, TypeScript, Tailwind CSS, Redux/Zustand, Responsive UI/UX',
  },
  {
    category: 'Backend',
    stack: 'Node.js, Express, Python, FastAPI, PostgreSQL, Redis, RESTful APIs, RBAC',
  },
  {
    category: 'AI & Cloud',
    stack: 'LLM Integration (Gemini, OpenAI), Docker, CI/CD, Microservices, AWS',
  },
];

const DEFAULT_EDUCATION: EducationItem[] = [
  {
    degree: 'B.Tech in Computer Science and Engineering',
    school: 'First Class Honors • Top 5% in System Architecture Capstone',
    year: '2021',
  },
];

const DEFAULT_CERTIFICATIONS: CertificationItem[] = [
  {
    name: 'Certified System Architecture Associate',
    badge: 'Verified',
  },
];

export const ExecutiveDossierView: React.FC<ExecutiveDossierViewProps> = ({
  profile,
  projects = [],
  skills = [],
  resume,
  onUpdateProfile,
  onAddProject,
  onDeleteProject,
  soundEnabled = true,
}) => {
  const resumePaperRef = useRef<HTMLDivElement>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Modals
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isEditContactOpen, setIsEditContactOpen] = useState(false);
  const [isAddRoleOpen, setIsAddRoleOpen] = useState(false);
  const [isAddProjectOpen, setIsAddProjectOpen] = useState(false);
  const [isAddSkillOpen, setIsAddSkillOpen] = useState(false);
  const [isAddEduOpen, setIsAddEduOpen] = useState(false);

  // Local state initialized with user data or defaults
  const [contactForm, setContactForm] = useState({
    name: profile.name || 'Gulshan Kumar Nayak',
    title: profile.title || 'Full Stack Systems Engineer',
    location: profile.location || 'Bengaluru, IN',
    track: 'Senior IC / System Architecture Track',
    github: profile.github || 'https://github.com',
    linkedin: profile.linkedin || 'https://linkedin.com',
    email: profile.contactEmail || 'gulshan.nayak@example.com',
  });

  const [experiences, setExperiences] = useState<ExperienceItem[]>(() => {
    if (resume?.experiences && resume.experiences.length > 0) {
      return resume.experiences.map((exp, idx) => ({
        id: `exp-${idx}`,
        role: exp.role,
        company: exp.company,
        period: exp.period,
        details: exp.details,
        achievements: exp.achievements && exp.achievements.length > 0
          ? exp.achievements
          : exp.details
          ? [exp.details]
          : [],
      }));
    }
    return DEFAULT_EXPERIENCES;
  });

  const [roleForm, setRoleForm] = useState({
    role: '',
    company: '',
    period: '',
    bullets: '',
  });

  const [projectForm, setProjectForm] = useState({
    title: '',
    badge: 'Production',
    techStack: '',
    description: '',
    liveUrl: '',
    githubUrl: '',
  });

  const [skillForm, setSkillForm] = useState({
    category: '',
    stack: '',
  });

  const [eduForm, setEduForm] = useState({
    type: 'education' as 'education' | 'certification',
    degreeOrName: '',
    schoolOrIssuer: '',
    year: '',
  });

  const [competencies, setCompetencies] = useState<CompetencyItem[]>(() => {
    if (skills && skills.length > 0) {
      return skills.map((s) => ({
        category: s.category,
        stack: s.skills.map((sk) => sk.name).join(', '),
      }));
    }
    return DEFAULT_COMPETENCIES;
  });

  const [educationList, setEducationList] = useState<EducationItem[]>(() => {
    if (resume?.education && resume.education.length > 0) {
      return resume.education.map((edu) => ({
        degree: edu.degree,
        school: `${edu.school}${edu.highlights ? ' • ' + edu.highlights.join(' • ') : ''}`,
        year: edu.year,
      }));
    }
    return DEFAULT_EDUCATION;
  });

  const [certificationsList, setCertificationsList] = useState<CertificationItem[]>(() => {
    return DEFAULT_CERTIFICATIONS;
  });

  // Projects list: combine projects prop with defaults if empty
  const displayProjects: ProjectDisplayItem[] =
    projects.length > 0
      ? projects.map((p) => ({
          id: p.id,
          title: p.title,
          tagLine: p.tagLine,
          badge: p.category || 'Production',
          badgeColor: p.category?.toLowerCase().includes('data') ? 'indigo' : 'emerald',
          techStack: p.techStack || p.tech || [],
          description: p.description,
          liveUrl: p.liveUrl || p.link,
          githubUrl: p.githubUrl || p.github,
        }))
      : DEFAULT_KEY_PROJECTS;

  const handleShare = () => {
    Sound.click(soundEnabled);
    const summary = `${contactForm.name} — ${contactForm.title}\nLocation: ${contactForm.location}\nTrack: ${contactForm.track}\nGitHub: ${contactForm.github}\nLinkedIn: ${contactForm.linkedin}`;
    void nativeService.shareContent({
      title: `${contactForm.name} - Curriculum Vitae`,
      text: summary,
    });
  };

  const handleCopyLink = () => {
    Sound.click(soundEnabled);
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    toast.success('CV Link copied to clipboard');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDownloadPDF = async () => {
    Sound.click(soundEnabled);
    const sheet = resumePaperRef.current;
    if (!sheet) {
      toast.error('Resume document not ready for export');
      return;
    }

    setIsExportingPDF(true);
    toast.info('Generating PDF document...');

    try {
      window.scrollTo({ top: 0, behavior: 'instant' as any });
      await new Promise((resolve) => setTimeout(resolve, 150));

      const canvas = await html2canvas(sheet, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 900,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const safeName = (contactForm.name || 'Executive_CV')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_');
      pdf.save(`${safeName}_CV.pdf`);
      toast.success('PDF downloaded successfully');
    } catch (err) {
      console.error('PDF export failed:', err);
      toast.error('PDF export failed. Opening print preview as fallback.');
      setIsPreviewModalOpen(true);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleDeleteRole = (index: number) => {
    Sound.click(soundEnabled);
    const updated = experiences.filter((_, i) => i !== index);
    setExperiences(updated);
    toast.success('Role removed');
  };

  const handleSaveContact = (e: React.FormEvent) => {
    e.preventDefault();
    Sound.click(soundEnabled);
    if (onUpdateProfile) {
      onUpdateProfile({
        name: contactForm.name,
        title: contactForm.title,
        location: contactForm.location,
        contactEmail: contactForm.email,
        github: contactForm.github,
        linkedin: contactForm.linkedin,
      });
    }
    setIsEditContactOpen(false);
    toast.success('Dossier details updated');
  };

  const handleSaveRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleForm.role.trim() || !roleForm.company.trim()) {
      toast.error('Role and company required');
      return;
    }
    Sound.click(soundEnabled);
    const bulletsList = roleForm.bullets
      .split('\n')
      .map((b) => b.trim())
      .filter(Boolean);

    const newRole: ExperienceItem = {
      id: `role-${Date.now()}`,
      role: roleForm.role.trim(),
      company: roleForm.company.trim(),
      period: roleForm.period.trim() || '2024 — Present',
      achievements: bulletsList.length > 0 ? bulletsList : ['Core responsibilities executed.'],
    };

    setExperiences([newRole, ...experiences]);
    setRoleForm({ role: '', company: '', period: '', bullets: '' });
    setIsAddRoleOpen(false);
    toast.success('Work role added');
  };

  const handleSaveProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectForm.title.trim()) {
      toast.error('Project title required');
      return;
    }
    Sound.click(soundEnabled);
    const parsedStack = projectForm.techStack
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (onAddProject) {
      onAddProject({
        title: projectForm.title.trim(),
        description: projectForm.description.trim() || 'Software platform',
        techStack: parsedStack,
        category: projectForm.badge || 'Production',
        liveUrl: projectForm.liveUrl.trim() || undefined,
        githubUrl: projectForm.githubUrl.trim() || undefined,
      });
    }

    setProjectForm({
      title: '',
      badge: 'Production',
      techStack: '',
      description: '',
      liveUrl: '',
      githubUrl: '',
    });
    setIsAddProjectOpen(false);
    toast.success('Project added');
  };

  const handleSaveSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!skillForm.category.trim() || !skillForm.stack.trim()) {
      toast.error('Category and stack required');
      return;
    }
    Sound.click(soundEnabled);
    setCompetencies([
      ...competencies,
      {
        category: skillForm.category.trim(),
        stack: skillForm.stack.trim(),
      },
    ]);
    setSkillForm({ category: '', stack: '' });
    setIsAddSkillOpen(false);
    toast.success('Competency added');
  };

  const handleSaveEdu = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eduForm.degreeOrName.trim()) {
      toast.error('Degree or certification name required');
      return;
    }
    Sound.click(soundEnabled);

    if (eduForm.type === 'education') {
      const updatedEdu = [
        ...educationList,
        {
          degree: eduForm.degreeOrName.trim(),
          school: eduForm.schoolOrIssuer.trim() || 'Honors Degree',
          year: eduForm.year.trim() || '2024',
        },
      ];
      setEducationList(updatedEdu);
      toast.success('Education credential added');
    } else {
      const updatedCerts = [
        ...certificationsList,
        {
          name: eduForm.degreeOrName.trim(),
          badge: 'Verified',
        },
      ];
      setCertificationsList(updatedCerts);
      toast.success('Certification added');
    }

    setEduForm({ type: 'education', degreeOrName: '', schoolOrIssuer: '', year: '' });
    setIsAddEduOpen(false);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Top Action Bar */}
      <div className="bg-white dark:bg-[#131927] rounded-2xl p-4 border border-[#EAE7F4] dark:border-[#20293D] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-[#1A1B23] dark:text-white flex items-center gap-2">
            <span>Curriculum Vitae</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#F3E8FF] dark:bg-purple-950/60 text-[#7C3AED] dark:text-purple-300">
              Executive Dossier
            </span>
          </h2>
          <p className="text-xs text-[#595368] dark:text-[#94A3B8]">
            Professional portfolio & verified CV consistent with Android app view
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={isExportingPDF}
            className="px-3.5 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm active:scale-95 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExportingPDF ? 'Generating...' : 'Download PDF'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              setIsPreviewModalOpen(true);
            }}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print View (A4)</span>
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold active:scale-95 transition cursor-pointer"
            title="Copy CV Link"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold active:scale-95 transition cursor-pointer"
            title="Share CV"
          >
            <Share2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsEditContactOpen(true)}
            className="p-2 text-[#7C3AED] dark:text-purple-300 bg-[#F5F3FF] dark:bg-purple-950/40 hover:bg-[#EDE9FE] dark:hover:bg-purple-900/60 rounded-xl transition border border-[#DDD6FE] dark:border-purple-800 active:scale-95 cursor-pointer"
            title="Edit Dossier"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Printable Sheet Wrapper */}
      <div id="executiveResumePaper" ref={resumePaperRef} className="space-y-5">
        {/* ========================================================================= */}
        {/* 1. PERSONAL HEADER CARD (Android Parity)                                  */}
        {/* ========================================================================= */}
        <section className="bg-white dark:bg-[#131927] rounded-3xl p-6 sm:p-7 border border-[#EAE7F4] dark:border-[#20293D] shadow-sm relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide bg-[#F3E8FF] dark:bg-purple-950/60 text-[#7C3AED] dark:text-purple-300 font-mono uppercase">
                Verified Dossier
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1A1B23] dark:text-white pt-1">
                {contactForm.name}
              </h1>
              <p className="text-sm sm:text-base font-semibold text-[#6D28D9] dark:text-[#A78BFA]">
                {contactForm.title}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsEditContactOpen(true)}
              className="p-2.5 text-[#6D28D9] dark:text-purple-300 bg-[#F5F3FF] dark:bg-purple-950/40 hover:bg-[#EDE9FE] dark:hover:bg-purple-900/60 rounded-xl transition border border-[#DDD6FE] dark:border-purple-800 active:scale-95 shadow-2xs cursor-pointer"
              title="Edit Contact Info"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs sm:text-sm text-[#595368] dark:text-[#94A3B8] mt-3 font-medium flex items-center flex-wrap gap-2">
            <span>{contactForm.location}</span>
            <span className="text-[#CCC3D8] dark:text-gray-600">•</span>
            <span>{contactForm.track}</span>
          </p>

          {/* Social & Contact Quick Buttons */}
          <div className="mt-5 pt-4 border-t border-[#F0EDF7] dark:border-[#1E2638] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {/* GitHub */}
              <a
                aria-label="GitHub Profile"
                className="w-10 h-10 rounded-xl bg-[#F8F7FD] dark:bg-[#192235] hover:bg-[#EDE8FB] dark:hover:bg-purple-950/50 text-[#24292F] dark:text-gray-200 border border-[#E6E1F4] dark:border-[#242D42] flex items-center justify-center transition active:scale-95"
                href={contactForm.github}
                rel="noopener noreferrer"
                target="_blank"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path
                    clipRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    fillRule="evenodd"
                  />
                </svg>
              </a>

              {/* LinkedIn */}
              <a
                aria-label="LinkedIn Profile"
                className="w-10 h-10 rounded-xl bg-[#F8F7FD] dark:bg-[#192235] hover:bg-[#EDE8FB] dark:hover:bg-purple-950/50 text-[#0A66C2] border border-[#E6E1F4] dark:border-[#242D42] flex items-center justify-center transition active:scale-95"
                href={contactForm.linkedin}
                rel="noopener noreferrer"
                target="_blank"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
                </svg>
              </a>

              {/* Email */}
              <a
                aria-label="Send Email"
                className="w-10 h-10 rounded-xl bg-[#F8F7FD] dark:bg-[#192235] hover:bg-[#EDE8FB] dark:hover:bg-purple-950/50 text-[#7C3AED] dark:text-purple-300 border border-[#E6E1F4] dark:border-[#242D42] flex items-center justify-center transition active:scale-95"
                href={`mailto:${contactForm.email}`}
              >
                <Mail className="w-4 h-4" />
              </a>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-[#7A748A] dark:text-[#94A3B8] px-3 py-1 bg-slate-50 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700">
                🟢 Available for roles
              </span>

              <button
                type="button"
                onClick={() => setIsPreviewModalOpen(true)}
                className="py-2 px-4 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl font-semibold text-xs flex items-center gap-2 shadow-sm transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Preview &amp; Download PDF</span>
              </button>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 2. WORK EXPERIENCE SECTION                                                */}
        {/* ========================================================================= */}
        <section className="space-y-3.5">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-4 bg-[#7C3AED] rounded-full shrink-0" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#4A4455] dark:text-[#A39DB0] font-mono">
                Work Experience
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsAddRoleOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7C3AED] dark:text-purple-300 hover:text-[#6D28D9] hover:bg-[#EDE9FE] dark:hover:bg-purple-950/40 px-3 py-1 rounded-xl border border-[#DDD6FE] dark:border-purple-800 transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Role</span>
            </button>
          </div>

          <div className="space-y-3">
            {experiences.map((exp, idx) => (
              <article
                key={exp.id || idx}
                className="bg-white dark:bg-[#131927] rounded-2xl p-5 border border-[#EAE7F4] dark:border-[#20293D] shadow-2xs hover:border-[#DDD6FE] dark:hover:border-purple-800 transition relative group"
              >
                <div className="flex justify-between items-baseline gap-2">
                  <h4 className="text-base font-bold text-[#1A1B23] dark:text-white">
                    {exp.role}
                  </h4>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono font-semibold px-2.5 py-0.5 bg-[#F4F2FD] dark:bg-[#1E1B33] text-[#6D28D9] dark:text-purple-300 rounded-md border border-[#E4DEF6] dark:border-[#382F57]">
                      {exp.period}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteRole(idx)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-rose-500 transition-opacity cursor-pointer"
                      title="Remove experience"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="text-xs font-semibold text-[#7C3AED] dark:text-[#A78BFA] mt-0.5">
                  {exp.company}
                </div>

                <ul className="mt-3 space-y-1.5 text-xs sm:text-sm text-[#4A4455] dark:text-[#94A3B8] list-disc list-outside pl-4 marker:text-[#A78BFA]">
                  {(exp.achievements || [exp.details || '']).map((bullet, bIdx) => (
                    <li key={bIdx} className="leading-relaxed">
                      {bullet}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 3. KEY PROJECTS SECTION                                                   */}
        {/* ========================================================================= */}
        <section className="space-y-3.5 pt-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-4 bg-[#7C3AED] rounded-full shrink-0" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#4A4455] dark:text-[#A39DB0] font-mono">
                Key Projects
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsAddProjectOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7C3AED] dark:text-purple-300 hover:text-[#6D28D9] hover:bg-[#EDE9FE] dark:hover:bg-purple-950/40 px-3 py-1 rounded-xl border border-[#DDD6FE] dark:border-purple-800 transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Project</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {displayProjects.map((proj) => (
              <div
                key={proj.id}
                className="bg-white dark:bg-[#131927] rounded-2xl p-5 border border-[#EAE7F4] dark:border-[#20293D] shadow-2xs hover:border-[#DDD6FE] dark:hover:border-purple-800 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm sm:text-base font-bold text-[#1A1B23] dark:text-white">
                      {proj.title}
                    </span>
                    <span
                      className={`text-[10px] uppercase font-mono font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${
                        proj.badgeColor === 'indigo'
                          ? 'bg-[#EEF2FF] dark:bg-indigo-950/60 text-[#4F46E5] dark:text-indigo-300 border-[#C7D2FE] dark:border-indigo-800'
                          : 'bg-[#ECFDF5] dark:bg-emerald-950/60 text-[#059669] dark:text-emerald-300 border-[#A7F3D0] dark:border-emerald-800'
                      }`}
                    >
                      {proj.badge || 'Production'}
                    </span>
                  </div>

                  {proj.techStack && proj.techStack.length > 0 && (
                    <div className="text-xs font-mono text-[#7C3AED] dark:text-[#A78BFA] mt-1.5 font-semibold">
                      {proj.techStack.join(' • ')}
                    </div>
                  )}

                  <p className="text-xs text-[#595368] dark:text-[#94A3B8] mt-2 leading-relaxed">
                    {proj.description}
                  </p>
                </div>

                {(proj.liveUrl || proj.githubUrl) && (
                  <div className="flex items-center gap-3 pt-3 mt-3 border-t border-[#F5F3FA] dark:border-[#1E2638]">
                    {proj.liveUrl && (
                      <a
                        href={proj.liveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7C3AED] dark:text-purple-300 hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Live Demo</span>
                      </a>
                    )}
                    {proj.githubUrl && (
                      <a
                        href={proj.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#595368] dark:text-gray-300 hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Source Code</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 4. CORE COMPETENCIES SECTION                                              */}
        {/* ========================================================================= */}
        <section className="space-y-3.5 pt-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-4 bg-[#7C3AED] rounded-full shrink-0" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#4A4455] dark:text-[#A39DB0] font-mono">
                Core Competencies &amp; Stack
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsAddSkillOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7C3AED] dark:text-purple-300 hover:text-[#6D28D9] hover:bg-[#EDE9FE] dark:hover:bg-purple-950/40 px-3 py-1 rounded-xl border border-[#DDD6FE] dark:border-purple-800 transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Skill</span>
            </button>
          </div>

          <div className="bg-white dark:bg-[#131927] rounded-2xl p-5 border border-[#EAE7F4] dark:border-[#20293D] shadow-2xs space-y-3 text-xs sm:text-sm">
            {competencies.map((comp, cIdx) => (
              <div
                key={cIdx}
                className={`flex flex-col sm:flex-row sm:items-baseline gap-2 ${
                  cIdx > 0 ? 'pt-3 border-t border-[#F5F3FA] dark:border-[#1E2638]' : ''
                }`}
              >
                <span className="font-bold text-[#1A1B23] dark:text-white w-32 shrink-0 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#7C3AED] shrink-0" />
                  {comp.category}:
                </span>
                <span className="text-[#595368] dark:text-[#94A3B8] leading-relaxed">
                  {comp.stack}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 5. EDUCATION & CERTIFICATIONS SECTION                                      */}
        {/* ========================================================================= */}
        <section className="space-y-3.5 pt-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-4 bg-[#7C3AED] rounded-full shrink-0" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#4A4455] dark:text-[#A39DB0] font-mono">
                Education &amp; Certifications
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsAddEduOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7C3AED] dark:text-purple-300 hover:text-[#6D28D9] hover:bg-[#EDE9FE] dark:hover:bg-purple-950/40 px-3 py-1 rounded-xl border border-[#DDD6FE] dark:border-purple-800 transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Credential</span>
            </button>
          </div>

          <div className="bg-white dark:bg-[#131927] rounded-2xl p-5 border border-[#EAE7F4] dark:border-[#20293D] shadow-2xs space-y-4">
            {educationList.map((edu, eIdx) => (
              <div key={eIdx} className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-[#F5F3FF] dark:bg-purple-950/40 text-[#7C3AED] dark:text-purple-300 border border-[#DDD6FE] dark:border-purple-800 flex items-center justify-center shrink-0 mt-0.5">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <strong className="font-bold text-xs sm:text-sm text-[#1A1B23] dark:text-white block truncate">
                      {edu.degree}
                    </strong>
                    <p className="text-xs text-[#595368] dark:text-[#94A3B8] mt-0.5 leading-snug">
                      {edu.school}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono font-semibold text-[#7A748A] dark:text-[#94A3B8] shrink-0">
                  {edu.year}
                </span>
              </div>
            ))}

            {certificationsList.map((cert, cIdx) => (
              <div
                key={cIdx}
                className="flex items-center justify-between text-xs sm:text-sm pt-3 border-t border-[#F5F3FA] dark:border-[#1E2638]"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-[#ECFDF5] dark:bg-emerald-950/60 text-[#059669] dark:text-emerald-300 border border-[#A7F3D0] dark:border-emerald-800 flex items-center justify-center shrink-0">
                    <BadgeCheck className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-xs sm:text-sm text-[#1A1B23] dark:text-white truncate">
                    {cert.name}
                  </span>
                </div>
                <span className="text-xs font-semibold text-[#059669] dark:text-emerald-300 bg-[#ECFDF5] dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-[#A7F3D0] dark:border-emerald-800 font-mono shrink-0">
                  {cert.badge}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Footer Tag */}
        <div className="pt-4 pb-2 flex items-center justify-between text-xs font-mono text-[#9D98AA] dark:text-gray-500">
          <span>{contactForm.name.toUpperCase()} • CV</span>
          <span>ATS VERIFIED • LIFE OS</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* 1. Edit Contact Info Modal */}
      {isEditContactOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Pencil className="w-4 h-4 text-[#7C3AED]" />
                <span>Edit Dossier Contact Info</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEditContactOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Professional Title
                </label>
                <input
                  type="text"
                  value={contactForm.title}
                  onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={contactForm.location}
                    onChange={(e) => setContactForm({ ...contactForm, location: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Track
                  </label>
                  <input
                    type="text"
                    value={contactForm.track}
                    onChange={(e) => setContactForm({ ...contactForm, track: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    GitHub URL
                  </label>
                  <input
                    type="url"
                    value={contactForm.github}
                    onChange={(e) => setContactForm({ ...contactForm, github: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    LinkedIn URL
                  </label>
                  <input
                    type="url"
                    value={contactForm.linkedin}
                    onChange={(e) => setContactForm({ ...contactForm, linkedin: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsEditContactOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold cursor-pointer shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Add Role Modal */}
      {isAddRoleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#7C3AED]" />
                <span>Add Work Experience Role</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddRoleOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Role Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lead Systems Architect"
                  value={roleForm.role}
                  onChange={(e) => setRoleForm({ ...roleForm, role: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Company / Organization *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Acme Tech Labs"
                  value={roleForm.company}
                  onChange={(e) => setRoleForm({ ...roleForm, company: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Period / Timeline
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2022 — Present"
                  value={roleForm.period}
                  onChange={(e) => setRoleForm({ ...roleForm, period: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Achievements (1 per line)
                </label>
                <textarea
                  rows={4}
                  placeholder="Architected cloud services...&#10;Reduced latency by 40%..."
                  value={roleForm.bullets}
                  onChange={(e) => setRoleForm({ ...roleForm, bullets: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsAddRoleOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold cursor-pointer shadow-sm"
                >
                  Add Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Add Project Modal */}
      {isAddProjectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#7C3AED]" />
                <span>Add Key Project</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddProjectOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Project Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Distributed Consensus Engine"
                  value={projectForm.title}
                  onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Badge Label
                </label>
                <input
                  type="text"
                  placeholder="e.g. Production, Open Source, Pipeline"
                  value={projectForm.badge}
                  onChange={(e) => setProjectForm({ ...projectForm, badge: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Tech Stack (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. React, TypeScript, Go, Docker"
                  value={projectForm.techStack}
                  onChange={(e) => setProjectForm({ ...projectForm, techStack: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="High-performance system managing..."
                  value={projectForm.description}
                  onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Live Demo URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={projectForm.liveUrl}
                    onChange={(e) => setProjectForm({ ...projectForm, liveUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    GitHub URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://github.com/..."
                    value={projectForm.githubUrl}
                    onChange={(e) => setProjectForm({ ...projectForm, githubUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsAddProjectOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold cursor-pointer shadow-sm"
                >
                  Add Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Add Skill Modal */}
      {isAddSkillOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#7C3AED]" />
                <span>Add Skill &amp; Competency</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddSkillOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSkill} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Category *
                </label>
                <input
                  type="text"
                  placeholder="e.g. DevOps & Infrastructure"
                  value={skillForm.category}
                  onChange={(e) => setSkillForm({ ...skillForm, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Tech Stack List *
                </label>
                <textarea
                  rows={3}
                  placeholder="Kubernetes, Terraform, GitHub Actions, AWS, Observability"
                  value={skillForm.stack}
                  onChange={(e) => setSkillForm({ ...skillForm, stack: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsAddSkillOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold cursor-pointer shadow-sm"
                >
                  Add Skill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Add Credential Modal */}
      {isAddEduOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#7C3AED]" />
                <span>Add Credential / Certification</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddEduOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdu} className="space-y-3 text-xs">
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="eduType"
                    checked={eduForm.type === 'education'}
                    onChange={() => setEduForm({ ...eduForm, type: 'education' })}
                  />
                  <span>Education Degree</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="eduType"
                    checked={eduForm.type === 'certification'}
                    onChange={() => setEduForm({ ...eduForm, type: 'certification' })}
                  />
                  <span>Professional Certification</span>
                </label>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {eduForm.type === 'education' ? 'Degree & Major *' : 'Certification Name *'}
                </label>
                <input
                  type="text"
                  placeholder={
                    eduForm.type === 'education'
                      ? 'e.g. M.S. in Computer Science'
                      : 'e.g. AWS Certified Solutions Architect'
                  }
                  value={eduForm.degreeOrName}
                  onChange={(e) => setEduForm({ ...eduForm, degreeOrName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                  required
                />
              </div>

              {eduForm.type === 'education' && (
                <>
                  <div>
                    <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      School / University
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. University Institute of Technology"
                      value={eduForm.schoolOrIssuer}
                      onChange={(e) => setEduForm({ ...eduForm, schoolOrIssuer: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Graduation Year
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 2024"
                      value={eduForm.year}
                      onChange={(e) => setEduForm({ ...eduForm, year: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsAddEduOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold cursor-pointer shadow-sm"
                >
                  Save Credential
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Printable Preview Modal */}
      {isPreviewModalOpen && (
        <PrintableResumePreviewModal
          isOpen={isPreviewModalOpen}
          onClose={() => setIsPreviewModalOpen(false)}
          contact={contactForm}
          experiences={experiences.map((exp) => ({
            role: exp.role,
            company: exp.company,
            period: exp.period,
            achievements: exp.achievements || [exp.details || ''],
          }))}
          projects={displayProjects.map((p) => ({
            title: p.title,
            techStack: p.techStack,
            badge: p.badge,
            badgeColor: p.badgeColor,
            description: p.description,
            liveUrl: p.liveUrl,
            githubUrl: p.githubUrl,
          }))}
          competencies={competencies}
          education={educationList}
          certifications={certificationsList}
          soundEnabled={soundEnabled}
        />
      )}
    </div>
  );
};
