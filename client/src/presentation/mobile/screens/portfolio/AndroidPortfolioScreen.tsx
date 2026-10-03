import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import {
  ArrowLeft,
  Share2,
  MoreVertical,
  Pencil,
  Download,
  Plus,
  GraduationCap,
  BadgeCheck,
  Mail,
  Check,
  X,
  ExternalLink,
  Printer,
  Copy,
  Trash2,
  FileText,
} from 'lucide-react';
import {
  UserProfile,
  PortfolioProject,
  SkillCategory,
  ResumeDocument,
} from '../../../../types';
import { nativeService } from '../../../../services/nativeService';
import { Sound } from '../../../../utils/audio';
import { Storage } from '../../../../utils/storage';
import { toast } from 'sonner';
import { PrintableResumePreviewModal } from '../../../../components/PrintableResumePreviewModal';

export interface AndroidPortfolioScreenProps {
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
  onBack?: () => void;
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

export const AndroidPortfolioScreen: React.FC<AndroidPortfolioScreenProps> = ({
  profile,
  projects = [],
  skills = [],
  resume,
  onUpdateProfile,
  onUpdateProjects,
  onUpdateSkills,
  onUpdateResume,
  onAddProject,
  onDeleteProject,
  onBack,
  soundEnabled = true,
}) => {
  const resumePaperRef = useRef<HTMLDivElement | null>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

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

  const firstName = (contactForm.name || profile.name || 'GULSHAN').trim().split(' ')[0].toUpperCase();

  const handleBack = () => {
    void nativeService.triggerHaptic('selection');
    Sound.click(soundEnabled);
    if (onBack) {
      onBack();
    } else {
      window.dispatchEvent(new CustomEvent('navigate-view', { detail: { view: 'home' } }));
    }
  };

  const handleShare = () => {
    void nativeService.triggerHaptic('selection');
    Sound.click(soundEnabled);
    const summary = `${contactForm.name} — ${contactForm.title}\nLocation: ${contactForm.location}\nTrack: ${contactForm.track}\nGitHub: ${contactForm.github}\nLinkedIn: ${contactForm.linkedin}`;
    void nativeService.shareContent({
      title: `${contactForm.name} - Curriculum Vitae`,
      text: summary,
    });
  };

  const handleCopyLink = () => {
    void nativeService.triggerHaptic('selection');
    Sound.click(soundEnabled);
    navigator.clipboard.writeText(window.location.href);
    toast.success('CV Link copied to clipboard');
    setIsMoreMenuOpen(false);
  };

  const handleDownloadPDF = async () => {
    void nativeService.triggerHaptic('selection');
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
        windowWidth: 800,
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

      while (heightLeft > 5) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const cleanName = (contactForm.name || 'Candidate').trim().replace(/\s+/g, '_');
      pdf.save(`${cleanName}_Resume.pdf`);
      Sound.success(soundEnabled);
      toast.success('Resume downloaded successfully');
    } catch (err) {
      console.error('PDF export error:', err);
      window.print();
    } finally {
      setIsExportingPDF(false);
      setIsMoreMenuOpen(false);
    }
  };

  const handleSaveContact = () => {
    void nativeService.triggerHaptic('selection');
    Sound.click(soundEnabled);
    if (onUpdateProfile) {
      onUpdateProfile({
        name: contactForm.name,
        title: contactForm.title,
        location: contactForm.location,
        github: contactForm.github,
        linkedin: contactForm.linkedin,
        contactEmail: contactForm.email,
      });
    }
    toast.success('Contact info updated successfully');
    setIsEditContactOpen(false);
  };

  const handleAddRoleSubmit = () => {
    if (!roleForm.role.trim() || !roleForm.company.trim()) {
      toast.error('Please enter a role and company name');
      return;
    }
    void nativeService.triggerHaptic('selection');
    Sound.click(soundEnabled);

    const bulletList = roleForm.bullets
      .split('\n')
      .map((b) => b.trim())
      .filter(Boolean);

    const newExp: ExperienceItem = {
      id: `exp-${Date.now()}`,
      role: roleForm.role.trim(),
      company: roleForm.company.trim(),
      period: roleForm.period.trim() || '2024 — Present',
      achievements: bulletList.length > 0 ? bulletList : ['Managed core systems engineering tasks and cross-functional deliverables.'],
    };

    const updated = [newExp, ...experiences];
    setExperiences(updated);

    if (onUpdateResume && resume) {
      onUpdateResume({
        ...resume,
        experiences: updated.map((e) => ({
          role: e.role,
          company: e.company,
          period: e.period,
          details: e.achievements?.[0] || '',
          achievements: e.achievements,
        })),
      });
    }

    setRoleForm({ role: '', company: '', period: '', bullets: '' });
    setIsAddRoleOpen(false);
    toast.success('New role added to Work Experience');
  };

  const handleDeleteRole = (idx: number) => {
    void nativeService.triggerHaptic('warning');
    Sound.click(soundEnabled);
    const updated = experiences.filter((_, i) => i !== idx);
    setExperiences(updated);
    toast.success('Role removed');
  };

  const handleAddProjectSubmit = () => {
    if (!projectForm.title.trim()) {
      toast.error('Please enter a project title');
      return;
    }
    void nativeService.triggerHaptic('selection');
    Sound.click(soundEnabled);

    const stackList = projectForm.techStack
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (onAddProject) {
      onAddProject({
        title: projectForm.title.trim(),
        description: projectForm.description.trim() || 'High-performance engineering software implementation.',
        techStack: stackList.length > 0 ? stackList : ['TypeScript', 'React', 'Node.js'],
        category: projectForm.badge || 'Production',
        liveUrl: projectForm.liveUrl.trim(),
        githubUrl: projectForm.githubUrl.trim(),
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
    toast.success('New project added to dossier');
  };

  const handleAddSkillSubmit = () => {
    if (!skillForm.category.trim() || !skillForm.stack.trim()) {
      toast.error('Please provide category and skills');
      return;
    }
    void nativeService.triggerHaptic('selection');
    Sound.click(soundEnabled);

    const updated = [...competencies, { category: skillForm.category.trim(), stack: skillForm.stack.trim() }];
    setCompetencies(updated);

    setSkillForm({ category: '', stack: '' });
    setIsAddSkillOpen(false);
    toast.success('Skill category added');
  };

  const handleAddEduSubmit = () => {
    if (!eduForm.degreeOrName.trim()) {
      toast.error('Please enter degree or certification name');
      return;
    }
    void nativeService.triggerHaptic('selection');
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
    <div className="w-full max-w-md bg-[#FAF9FD] dark:bg-[#0B0F19] min-h-screen shadow-2xl relative flex flex-col pb-24 border-x border-[#EAE7F4] dark:border-[#1E2638] mx-auto select-none">
      {/* BEGIN: Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-[#FAF9FD]/90 dark:bg-[#0B0F19]/90 backdrop-blur-md border-b border-[#EAE7F4]/80 dark:border-[#1E2638] px-4 py-3 flex items-center justify-between no-print">
        <div className="flex items-center space-x-3 min-w-0">
          <button
            type="button"
            aria-label="Go back"
            onClick={handleBack}
            className="p-2 -ml-1 text-[#4A4455] dark:text-[#A39DB0] hover:text-[#1A1B23] dark:hover:text-white hover:bg-[#EDE9F6] dark:hover:bg-[#1E1B33] rounded-full transition-colors active:scale-95 cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-[#1A1B23] dark:text-white tracking-tight leading-tight truncate">
              Curriculum Vitae
            </h1>
            <p className="text-[11px] font-medium text-[#7C3AED] dark:text-[#A78BFA] -mt-0.5 font-mono truncate">
              {firstName} · RESUME
            </p>
          </div>
        </div>

        {/* Right actions: Clean Share / More icon */}
        <div className="flex items-center space-x-1.5 shrink-0">
          <button
            type="button"
            aria-label="Share"
            onClick={handleShare}
            className="w-9 h-9 flex items-center justify-center rounded-full text-[#4A4455] dark:text-[#A39DB0] hover:bg-[#EDE9F6] dark:hover:bg-[#1E1B33] hover:text-[#1A1B23] dark:hover:text-white transition active:scale-95 cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-label="More options"
            onClick={() => setIsMoreMenuOpen((prev) => !prev)}
            className="w-9 h-9 flex items-center justify-center rounded-full text-[#4A4455] dark:text-[#A39DB0] hover:bg-[#EDE9F6] dark:hover:bg-[#1E1B33] hover:text-[#1A1B23] dark:hover:text-white transition active:scale-95 cursor-pointer relative"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </header>
      {/* END: Top Navigation Bar */}

      {/* More Options Dropdown Sheet */}
      {isMoreMenuOpen && (
        <div className="absolute right-4 top-14 z-50 w-52 rounded-2xl bg-white dark:bg-[#131927] border border-[#EAE7F4] dark:border-[#20293D] shadow-xl p-1.5 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
          <button
            type="button"
            onClick={() => {
              setIsMoreMenuOpen(false);
              setIsEditContactOpen(true);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left font-medium text-[#1A1B23] dark:text-gray-200 hover:bg-[#F5F3FF] dark:hover:bg-purple-950/40 cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5 text-[#7C3AED]" />
            <span>Edit Dossier Info</span>
          </button>
          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              Sound.click(soundEnabled);
              setIsMoreMenuOpen(false);
              setIsPreviewModalOpen(true);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left font-medium text-[#1A1B23] dark:text-gray-200 hover:bg-[#F5F3FF] dark:hover:bg-purple-950/40 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#7C3AED]" />
            <span>Preview &amp; Export PDF</span>
          </button>
          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              Sound.click(soundEnabled);
              setIsMoreMenuOpen(false);
              setIsPreviewModalOpen(true);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left font-medium text-[#1A1B23] dark:text-gray-200 hover:bg-[#F5F3FF] dark:hover:bg-purple-950/40 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-[#7C3AED]" />
            <span>Print View (A4)</span>
          </button>
          <button
            type="button"
            onClick={handleCopyLink}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left font-medium text-[#1A1B23] dark:text-gray-200 hover:bg-[#F5F3FF] dark:hover:bg-purple-950/40 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-[#7C3AED]" />
            <span>Copy Link</span>
          </button>
        </div>
      )}

      {/* BEGIN: Main Resume Content */}
      <main className="px-4 pt-4 pb-6 flex-1 space-y-4" id="resumePaper" ref={resumePaperRef}>
        {/* BEGIN: Personal Header Card */}
        <section
          className="bg-white dark:bg-[#131927] rounded-2xl p-5 border border-[#EAE7F4] dark:border-[#20293D] shadow-sm relative overflow-hidden"
          data-purpose="personal-header"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-[#F3E8FF] dark:bg-purple-950/60 text-[#7C3AED] dark:text-purple-300 font-mono uppercase">
                Verified Dossier
              </span>
              <h2 className="text-2xl font-extrabold tracking-tight text-[#1A1B23] dark:text-white pt-1">
                {contactForm.name}
              </h2>
              <p className="text-sm font-semibold text-[#6D28D9] dark:text-[#A78BFA]">
                {contactForm.title}
              </p>
            </div>
            {/* Edit button in soft theme */}
            <button
              type="button"
              onClick={() => {
                void nativeService.triggerHaptic('selection');
                setIsEditContactOpen(true);
              }}
              className="p-2 text-[#6D28D9] dark:text-purple-300 bg-[#F5F3FF] dark:bg-purple-950/40 hover:bg-[#EDE9FE] dark:hover:bg-purple-900/60 rounded-xl transition border border-[#DDD6FE] dark:border-purple-800 active:scale-95 shadow-2xs cursor-pointer"
              title="Edit Contact Info"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-[#595368] dark:text-[#94A3B8] mt-2 font-medium flex items-center flex-wrap gap-1.5">
            <span>{contactForm.location}</span>
            <span className="text-[#CCC3D8] dark:text-gray-600">•</span>
            <span>{contactForm.track}</span>
          </p>

          {/* Social & Contact Quick Icon Buttons */}
          <div className="mt-4 pt-3.5 border-t border-[#F0EDF7] dark:border-[#1E2638] flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* GitHub Icon Button */}
              <a
                aria-label="GitHub Profile"
                className="w-9 h-9 rounded-xl bg-[#F8F7FD] dark:bg-[#192235] hover:bg-[#EDE8FB] dark:hover:bg-purple-950/50 text-[#24292F] dark:text-gray-200 border border-[#E6E1F4] dark:border-[#242D42] flex items-center justify-center transition active:scale-95"
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
              {/* LinkedIn Icon Button */}
              <a
                aria-label="LinkedIn Profile"
                className="w-9 h-9 rounded-xl bg-[#F8F7FD] dark:bg-[#192235] hover:bg-[#EDE8FB] dark:hover:bg-purple-950/50 text-[#0A66C2] border border-[#E6E1F4] dark:border-[#242D42] flex items-center justify-center transition active:scale-95"
                href={contactForm.linkedin}
                rel="noopener noreferrer"
                target="_blank"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
                </svg>
              </a>
              {/* Email Icon Button */}
              <a
                aria-label="Send Email"
                className="w-9 h-9 rounded-xl bg-[#F8F7FD] dark:bg-[#192235] hover:bg-[#EDE8FB] dark:hover:bg-purple-950/50 text-[#7C3AED] dark:text-purple-300 border border-[#E6E1F4] dark:border-[#242D42] flex items-center justify-center transition active:scale-95"
                href={`mailto:${contactForm.email}`}
              >
                <Mail className="w-4 h-4" />
              </a>
            </div>
            <span className="text-[11px] font-mono text-[#7A748A] dark:text-[#94A3B8]">
              Available for roles
            </span>
          </div>

          {/* Primary Download Button (Single Elegant CTA) */}
          <div className="mt-4 pt-1 no-print">
            <button
              type="button"
              onClick={() => {
                void nativeService.triggerHaptic('selection');
                Sound.click(soundEnabled);
                setIsPreviewModalOpen(true);
              }}
              className="w-full py-3 px-4 bg-[#7C3AED] hover:bg-[#6D28D9] active:scale-[0.99] text-white rounded-xl font-semibold text-xs flex items-center justify-center space-x-2 shadow-sm shadow-[#7C3AED]/20 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Preview &amp; Download Resume (PDF)</span>
            </button>
          </div>
        </section>
        {/* END: Personal Header Card */}

        {/* BEGIN: Work Experience Section */}
        <section className="space-y-3" data-purpose="work-experience">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-[#7C3AED] rounded-full shrink-0" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#4A4455] dark:text-[#A39DB0] font-mono">
                Work Experience
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                void nativeService.triggerHaptic('selection');
                setIsAddRoleOpen(true);
              }}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#7C3AED] dark:text-purple-300 hover:text-[#6D28D9] hover:bg-[#EDE9FE] dark:hover:bg-purple-950/40 px-2 py-0.5 rounded-lg border border-[#DDD6FE] dark:border-purple-800 transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add Role</span>
            </button>
          </div>

          {/* Experience Cards */}
          {experiences.map((exp, idx) => (
            <article
              key={exp.id || idx}
              className="bg-white dark:bg-[#131927] rounded-2xl p-4 border border-[#EAE7F4] dark:border-[#20293D] shadow-2xs hover:border-[#DDD6FE] dark:hover:border-purple-800 transition relative group"
            >
              <div className="flex justify-between items-baseline gap-2">
                <h4 className="text-sm font-bold text-[#1A1B23] dark:text-white">
                  {exp.role}
                </h4>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-[#F4F2FD] dark:bg-[#1E1B33] text-[#6D28D9] dark:text-purple-300 rounded-md border border-[#E4DEF6] dark:border-[#382F57]">
                    {exp.period}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteRole(idx)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-rose-500 transition-opacity no-print cursor-pointer"
                    title="Remove experience"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="text-xs font-medium text-[#7C3AED] dark:text-[#A78BFA] mt-0.5">
                {exp.company}
              </div>
              <ul className="mt-2.5 space-y-1.5 text-xs text-[#4A4455] dark:text-[#94A3B8] list-disc list-outside pl-4 marker:text-[#A78BFA]">
                {(exp.achievements || [exp.details || '']).map((bullet, bIdx) => (
                  <li key={bIdx} className="leading-relaxed">
                    {bullet}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>
        {/* END: Work Experience Section */}

        {/* BEGIN: Key Projects Section */}
        <section className="space-y-3 pt-1" data-purpose="key-projects">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-[#7C3AED] rounded-full shrink-0" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#4A4455] dark:text-[#A39DB0] font-mono">
                Key Projects
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                void nativeService.triggerHaptic('selection');
                setIsAddProjectOpen(true);
              }}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#7C3AED] dark:text-purple-300 hover:text-[#6D28D9] hover:bg-[#EDE9FE] dark:hover:bg-purple-950/40 px-2 py-0.5 rounded-lg border border-[#DDD6FE] dark:border-purple-800 transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add Project</span>
            </button>
          </div>

          {/* Project Items */}
          {displayProjects.map((proj) => (
            <div
              key={proj.id}
              className="bg-white dark:bg-[#131927] rounded-2xl p-4 border border-[#EAE7F4] dark:border-[#20293D] shadow-2xs hover:border-[#DDD6FE] dark:hover:border-purple-800 transition"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-[#1A1B23] dark:text-white">
                  {proj.title}
                </span>
                <span
                  className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                    proj.badgeColor === 'indigo'
                      ? 'bg-[#EEF2FF] dark:bg-indigo-950/60 text-[#4F46E5] dark:text-indigo-300 border-[#C7D2FE] dark:border-indigo-800'
                      : 'bg-[#ECFDF5] dark:bg-emerald-950/60 text-[#059669] dark:text-emerald-300 border-[#A7F3D0] dark:border-emerald-800'
                  }`}
                >
                  {proj.badge || 'Production'}
                </span>
              </div>

              {proj.techStack && proj.techStack.length > 0 && (
                <div className="text-[11px] font-mono text-[#7C3AED] dark:text-[#A78BFA] mt-1 font-semibold">
                  {proj.techStack.join(' • ')}
                </div>
              )}

              <p className="text-xs text-[#595368] dark:text-[#94A3B8] mt-1.5 leading-relaxed">
                {proj.description}
              </p>

              {(proj.liveUrl || proj.githubUrl) && (
                <div className="flex items-center gap-3 pt-2.5 mt-2 border-t border-[#F5F3FA] dark:border-[#1E2638] no-print">
                  {proj.liveUrl && (
                    <a
                      href={proj.liveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#7C3AED] dark:text-purple-300 hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Live Demo</span>
                    </a>
                  )}
                  {proj.githubUrl && (
                    <a
                      href={proj.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#595368] dark:text-gray-300 hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Source Code</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </section>
        {/* END: Key Projects Section */}

        {/* BEGIN: Core Competencies Section */}
        <section className="space-y-3 pt-1" data-purpose="core-competencies">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-[#7C3AED] rounded-full shrink-0" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#4A4455] dark:text-[#A39DB0] font-mono">
                Core Competencies &amp; Stack
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                void nativeService.triggerHaptic('selection');
                setIsAddSkillOpen(true);
              }}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#7C3AED] dark:text-purple-300 hover:text-[#6D28D9] hover:bg-[#EDE9FE] dark:hover:bg-purple-950/40 px-2 py-0.5 rounded-lg border border-[#DDD6FE] dark:border-purple-800 transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add Skill</span>
            </button>
          </div>

          <div className="bg-white dark:bg-[#131927] rounded-2xl p-4 border border-[#EAE7F4] dark:border-[#20293D] shadow-2xs space-y-2.5 text-xs">
            {competencies.map((comp, cIdx) => (
              <div
                key={cIdx}
                className={`flex flex-col sm:flex-row sm:items-baseline gap-1 ${
                  cIdx > 0 ? 'pt-2 border-t border-[#F5F3FA] dark:border-[#1E2638]' : ''
                }`}
              >
                <span className="font-bold text-[#1A1B23] dark:text-white w-24 shrink-0 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#7C3AED] shrink-0" />
                  {comp.category}:
                </span>
                <span className="text-[#595368] dark:text-[#94A3B8] leading-relaxed">
                  {comp.stack}
                </span>
              </div>
            ))}
          </div>
        </section>
        {/* END: Core Competencies Section */}

        {/* BEGIN: Education & Certifications Section */}
        <section className="space-y-3 pt-1" data-purpose="education-section">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-[#7C3AED] rounded-full shrink-0" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#4A4455] dark:text-[#A39DB0] font-mono">
                Education &amp; Certifications
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                void nativeService.triggerHaptic('selection');
                setIsAddEduOpen(true);
              }}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#7C3AED] dark:text-purple-300 hover:text-[#6D28D9] hover:bg-[#EDE9FE] dark:hover:bg-purple-950/40 px-2 py-0.5 rounded-lg border border-[#DDD6FE] dark:border-purple-800 transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add</span>
            </button>
          </div>

          <div className="bg-white dark:bg-[#131927] rounded-2xl p-4 border border-[#EAE7F4] dark:border-[#20293D] shadow-2xs space-y-3">
            {educationList.map((edu, eIdx) => (
              <div key={eIdx} className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-[#F5F3FF] dark:bg-purple-950/40 text-[#7C3AED] dark:text-purple-300 border border-[#DDD6FE] dark:border-purple-800 flex items-center justify-center shrink-0 mt-0.5">
                    <GraduationCap className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <strong className="font-bold text-xs text-[#1A1B23] dark:text-white block truncate">
                      {edu.degree}
                    </strong>
                    <p className="text-[11px] text-[#595368] dark:text-[#94A3B8] mt-0.5 leading-snug">
                      {edu.school}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-semibold text-[#7A748A] dark:text-[#94A3B8] shrink-0">
                  {edu.year}
                </span>
              </div>
            ))}

            {certificationsList.map((cert, cIdx) => (
              <div
                key={cIdx}
                className="flex items-center justify-between text-xs pt-2.5 border-t border-[#F5F3FA] dark:border-[#1E2638]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-md bg-[#ECFDF5] dark:bg-emerald-950/60 text-[#059669] dark:text-emerald-300 border border-[#A7F3D0] dark:border-emerald-800 flex items-center justify-center shrink-0">
                    <BadgeCheck className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-medium text-xs text-[#1A1B23] dark:text-white truncate">
                    {cert.name}
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-[#059669] dark:text-emerald-300 bg-[#ECFDF5] dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-[#A7F3D0] dark:border-emerald-800 font-mono shrink-0">
                  {cert.badge}
                </span>
              </div>
            ))}
          </div>
        </section>
        {/* END: Education & Certifications Section */}

        {/* Document Footer Status Tag */}
        <div className="pt-3 pb-2 flex items-center justify-between text-[10px] font-mono text-[#9D98AA] dark:text-gray-500">
          <span>{contactForm.name.toUpperCase()} • CV</span>
          <span>ATS VERIFIED • LIFE OS</span>
        </div>
      </main>
      {/* END: Main Resume Content */}

      {/* ========================================================================= */}
      {/* MODALS FOR EDITING DOSSIER */}
      {/* ========================================================================= */}

      {/* 1. Edit Contact Info Modal */}
      {isEditContactOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Pencil className="w-4 h-4 text-[#7C3AED]" />
                <span>Edit Contact &amp; Dossier</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEditContactOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Headline / Role Title
                </label>
                <input
                  type="text"
                  value={contactForm.title}
                  onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={contactForm.location}
                  onChange={(e) => setContactForm({ ...contactForm, location: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Track / Specialization
                </label>
                <input
                  type="text"
                  value={contactForm.track}
                  onChange={(e) => setContactForm({ ...contactForm, track: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  GitHub Profile URL
                </label>
                <input
                  type="url"
                  value={contactForm.github}
                  onChange={(e) => setContactForm({ ...contactForm, github: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  LinkedIn Profile URL
                </label>
                <input
                  type="url"
                  value={contactForm.linkedin}
                  onChange={(e) => setContactForm({ ...contactForm, linkedin: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setIsEditContactOpen(false)}
                className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveContact}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded-xl shadow-xs cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Add Role Modal */}
      {isAddRoleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-[#7C3AED]" />
                <span>Add Work Experience</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddRoleOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Role Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Senior Full Stack Engineer"
                  value={roleForm.role}
                  onChange={(e) => setRoleForm({ ...roleForm, role: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Company / Team *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Enterprise Solutions & Cloud Platforms"
                  value={roleForm.company}
                  onChange={(e) => setRoleForm({ ...roleForm, company: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Period / Timeline
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2023 — Present"
                  value={roleForm.period}
                  onChange={(e) => setRoleForm({ ...roleForm, period: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Bullet Points / Key Contributions (one per line)
                </label>
                <textarea
                  rows={3}
                  placeholder="Architected distributed stateless authentication...&#10;Cut API latency by 32%..."
                  value={roleForm.bullets}
                  onChange={(e) => setRoleForm({ ...roleForm, bullets: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setIsAddRoleOpen(false)}
                className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddRoleSubmit}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded-xl shadow-xs cursor-pointer"
              >
                Add Role
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Add Project Modal */}
      {isAddProjectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
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

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Project Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Distributed Telemetry Pipeline"
                  value={projectForm.title}
                  onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Badge Tag
                </label>
                <input
                  type="text"
                  placeholder="e.g. Production, Data Pipeline, Open Source"
                  value={projectForm.badge}
                  onChange={(e) => setProjectForm({ ...projectForm, badge: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Tech Stack (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Next.js, Node.js, Gemini API, PostgreSQL"
                  value={projectForm.techStack}
                  onChange={(e) => setProjectForm({ ...projectForm, techStack: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Short impact summary..."
                  value={projectForm.description}
                  onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Live URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={projectForm.liveUrl}
                  onChange={(e) => setProjectForm({ ...projectForm, liveUrl: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setIsAddProjectOpen(false)}
                className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddProjectSubmit}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded-xl shadow-xs cursor-pointer"
              >
                Add Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Add Skill Modal */}
      {isAddSkillOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-[#7C3AED]" />
                <span>Add Skill Category</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddSkillOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Category (e.g. Systems, DevOps, Data)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cloud &amp; Infra"
                  value={skillForm.category}
                  onChange={(e) => setSkillForm({ ...skillForm, category: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Skills (comma separated)
                </label>
                <textarea
                  rows={2}
                  placeholder="Docker, Kubernetes, AWS Lambda, Terraform, CI/CD"
                  value={skillForm.stack}
                  onChange={(e) => setSkillForm({ ...skillForm, stack: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setIsAddSkillOpen(false)}
                className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddSkillSubmit}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded-xl shadow-xs cursor-pointer"
              >
                Add Skill
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Add Education / Certification Modal */}
      {isAddEduOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-[#7C3AED]" />
                <span>Add Credential</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddEduOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center gap-2 p-1 rounded-xl bg-gray-100 dark:bg-gray-800">
                <button
                  type="button"
                  onClick={() => setEduForm({ ...eduForm, type: 'education' })}
                  className={`flex-1 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                    eduForm.type === 'education'
                      ? 'bg-white dark:bg-gray-700 text-[#7C3AED] dark:text-purple-300 shadow-2xs'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  Education
                </button>
                <button
                  type="button"
                  onClick={() => setEduForm({ ...eduForm, type: 'certification' })}
                  className={`flex-1 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                    eduForm.type === 'certification'
                      ? 'bg-white dark:bg-gray-700 text-[#7C3AED] dark:text-purple-300 shadow-2xs'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  Certification
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {eduForm.type === 'education' ? 'Degree & Major *' : 'Certificate Title *'}
                </label>
                <input
                  type="text"
                  placeholder={eduForm.type === 'education' ? 'e.g. M.S. in Computer Science' : 'e.g. AWS Solutions Architect'}
                  value={eduForm.degreeOrName}
                  onChange={(e) => setEduForm({ ...eduForm, degreeOrName: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>

              {eduForm.type === 'education' && (
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Institution / Honors
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. University Name • Honors Capstone"
                    value={eduForm.schoolOrIssuer}
                    onChange={(e) => setEduForm({ ...eduForm, schoolOrIssuer: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                  />
                </div>
              )}

              {eduForm.type === 'education' && (
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Graduation Year
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2024"
                    value={eduForm.year}
                    onChange={(e) => setEduForm({ ...eduForm, year: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-[#7C3AED]"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setIsAddEduOpen(false)}
                className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddEduSubmit}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded-xl shadow-xs cursor-pointer"
              >
                Add Credential
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Single-Page PDF (A4 / Letter Standard) Preview Modal */}
      <PrintableResumePreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        contact={{
          name: contactForm.name,
          title: contactForm.title,
          location: contactForm.location,
          track: contactForm.track,
          email: contactForm.email,
          github: contactForm.github,
          linkedin: contactForm.linkedin,
        }}
        experiences={experiences.map((exp) => ({
          role: exp.role,
          company: exp.company,
          period: exp.period,
          achievements:
            exp.achievements && exp.achievements.length > 0
              ? exp.achievements
              : exp.details
              ? [exp.details]
              : [],
        }))}
        projects={displayProjects.map((proj) => ({
          title: proj.title,
          techStack: proj.techStack,
          badge: proj.badge,
          badgeColor: proj.badgeColor,
          description: proj.description,
          liveUrl: proj.liveUrl,
          githubUrl: proj.githubUrl,
        }))}
        competencies={competencies}
        education={educationList}
        certifications={certificationsList}
        soundEnabled={soundEnabled}
      />
    </div>
  );
};
