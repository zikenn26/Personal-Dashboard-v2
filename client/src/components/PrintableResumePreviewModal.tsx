import React, { useRef, useState, useEffect } from 'react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { Printer, Download, X, Loader2, ZoomIn, ZoomOut, Check } from 'lucide-react';
import { Sound } from '../utils/audio';
import { nativeService } from '../services/nativeService';
import { toast } from 'sonner';

export interface ResumeContactData {
  name: string;
  title: string;
  location: string;
  track?: string;
  email: string;
  github?: string;
  linkedin?: string;
}

export interface ResumeExperienceData {
  role: string;
  company: string;
  period: string;
  achievements: string[];
}

export interface ResumeProjectData {
  title: string;
  techStack?: string[] | string;
  badge?: string;
  badgeColor?: 'emerald' | 'blue' | 'indigo' | 'violet' | string;
  description: string;
  liveUrl?: string;
  githubUrl?: string;
}

export interface ResumeCompetencyData {
  category: string;
  stack: string;
}

export interface ResumeEducationData {
  degree: string;
  school: string;
  year: string;
}

export interface ResumeCertificationData {
  name: string;
  badge?: string;
}

export interface PrintableResumePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: ResumeContactData;
  experiences?: ResumeExperienceData[];
  projects?: ResumeProjectData[];
  competencies?: ResumeCompetencyData[];
  education?: ResumeEducationData[];
  certifications?: ResumeCertificationData[];
  soundEnabled?: boolean;
}

const DEFAULT_EXPERIENCES: ResumeExperienceData[] = [
  {
    role: 'Senior Full Stack Engineer',
    company: 'Enterprise Solutions & Cloud Platforms',
    period: '2023 — Present',
    achievements: [
      'Architected distributed stateless authentication handling <strong class="font-semibold text-slate-900">45,000+ daily active users</strong> with sub-40ms token validation latency.',
      'Engineered automated multi-tenant database partitioning on PostgreSQL, cutting peak API response cycles by <strong class="font-semibold text-slate-900">32%</strong>.',
      'Led front-end migration to Next.js App Router and optimized SSR hydration, reducing Largest Contentful Paint (LCP) from 3.1s to <strong class="font-semibold text-slate-900">1.1s</strong>.',
    ],
  },
  {
    role: 'Full Stack Software Engineer',
    company: 'Data & Developer Infrastructure Labs',
    period: '2021 — 2023',
    achievements: [
      'Constructed high-speed ETL ingestion pipes streaming <strong class="font-semibold text-slate-900">1.2M+ records/day</strong> via containerized microservices.',
      'Implemented reusable UI design system and standardized component libraries across <strong class="font-semibold text-slate-900">5 distinct engineering squads</strong>.',
    ],
  },
];

const DEFAULT_PROJECTS: ResumeProjectData[] = [
  {
    title: 'My Exam Dashboard',
    techStack: 'Next.js • Node.js • Gemini API • JWT • Tailwind',
    badge: 'Production',
    badgeColor: 'emerald',
    description:
      'Full lifecycle examination intelligence hub featuring AI-assisted candidate contextual Q&A, dynamic scheduling feeds, automated category CRUD engines, and sub-second full-text retrieval.',
  },
  {
    title: 'Enterprise Analytics Platform',
    techStack: 'Python • FastAPI • PostgreSQL • Docker',
    badge: 'Data Pipeline',
    badgeColor: 'blue',
    description:
      'Telemetry ingestion pipeline transforming complex multi-source event streams into normalized star-schema models with <strong class="font-semibold text-slate-900">&lt;120ms queries</strong> and executive BI data caching.',
  },
];

const DEFAULT_COMPETENCIES: ResumeCompetencyData[] = [
  {
    category: 'Frontend',
    stack: 'React, Next.js, TypeScript, Tailwind CSS, Redux / Zustand, Responsive UI/UX, Web Vitals Optimization',
  },
  {
    category: 'Backend',
    stack: 'Node.js, Express, Python, FastAPI, PostgreSQL, Redis, RESTful APIs, RBAC & JWT Architecture',
  },
  {
    category: 'AI & Cloud',
    stack: 'LLM Integration (Gemini, OpenAI APIs), Docker, CI/CD Pipelines, Microservices Architecture, AWS',
  },
];

const DEFAULT_EDUCATION: ResumeEducationData[] = [
  {
    degree: 'B.Tech in Computer Science and Engineering',
    school: 'First Class Honors • Capstone in Distributed Systems',
    year: '2021',
  },
];

const DEFAULT_CERTIFICATIONS: ResumeCertificationData[] = [
  {
    name: 'Certified System Architecture Associate',
    badge: 'Verified Dossier',
  },
];

export const PrintableResumePreviewModal: React.FC<PrintableResumePreviewModalProps> = ({
  isOpen,
  onClose,
  contact,
  experiences,
  projects,
  competencies,
  education,
  certifications,
  soundEnabled = true,
}) => {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(() => {
    // Default zoom to fit nicely on mobile vs desktop
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      return 0.58;
    }
    return 1;
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const displayExperiences =
    experiences && experiences.length > 0 ? experiences : DEFAULT_EXPERIENCES;
  const displayProjects =
    projects && projects.length > 0 ? projects : DEFAULT_PROJECTS;
  const displayCompetencies =
    competencies && competencies.length > 0 ? competencies : DEFAULT_COMPETENCIES;
  const displayEducation =
    education && education.length > 0 ? education : DEFAULT_EDUCATION;
  const displayCertifications =
    certifications && certifications.length > 0
      ? certifications
      : DEFAULT_CERTIFICATIONS;

  const candidateName = contact.name || 'Gulshan Kumar Nayak';
  const candidateTitle = contact.title || 'Full Stack Systems Engineer & Architect';
  const candidateLocation = contact.location || 'Bengaluru, IN';
  const candidateTrack = contact.track || 'Senior IC / System Track';
  const candidateEmail = contact.email || 'gulshan.nayak@example.com';
  const candidateGithub = contact.github || 'https://github.com/gulshan';
  const candidateLinkedin = contact.linkedin || 'https://linkedin.com/in/gulshan';

  const handlePrint = () => {
    void nativeService.triggerHaptic('selection');
    Sound.click(soundEnabled);
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!canvasRef.current) {
      toast.error('Resume preview element not found');
      return;
    }

    void nativeService.triggerHaptic('selection');
    Sound.click(soundEnabled);
    setIsDownloading(true);
    const toastId = toast.loading('Rendering high-resolution single-page PDF...');

    try {
      // Temporarily ensure full visibility without transformation for canvas capture
      const element = canvasRef.current;
      const originalTransform = element.style.transform;
      element.style.transform = 'none';

      await new Promise((res) => setTimeout(res, 120));

      const canvas = await html2canvas(element, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 800,
      });

      element.style.transform = originalTransform;

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, Math.min(imgHeight, pageHeight));

      const cleanFilename = `${candidateName.replace(/\s+/g, '_')}_Resume.pdf`;
      pdf.save(cleanFilename);

      Sound.success(soundEnabled);
      toast.success('Resume downloaded successfully!', { id: toastId });
    } catch (err) {
      console.error('Download PDF error:', err);
      toast.error('Failed to generate PDF. Opening print dialog as fallback.', { id: toastId });
      window.print();
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-start py-4 sm:py-8 px-2 sm:px-4 select-none animate-in fade-in duration-200">
      {/* BEGIN: Floating Top Control Bar (matches provided code) */}
      <aside className="no-print mb-4 sm:mb-6 w-full max-w-[210mm] flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 px-4 sm:px-5 py-3 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 tracking-tight">
            Printable Single-Page PDF (A4 / Letter Standard)
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Zoom controls for comfortable reading */}
          <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5 border border-slate-200 dark:border-slate-700 mr-1">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(0.4, Number((z - 0.1).toFixed(2))))}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg transition cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono font-medium px-1.5 text-slate-700 dark:text-slate-300">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(1.2, Number((z + 0.1).toFixed(2))))}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg transition cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Primary Download to PDF */}
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </>
            )}
          </button>

          {/* Print / Save as PDF Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 bg-[#6d28d9] hover:bg-[#5b21b6] active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save as PDF</span>
          </button>

          {/* Close Modal */}
          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            aria-label="Close preview"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </aside>
      {/* END: Floating Top Control Bar */}

      {/* Preview Container Wrapper with smooth scrolling */}
      <div className="w-full flex justify-center overflow-x-auto pb-8">
        <div
          style={{
            transform: zoomLevel !== 1 ? `scale(${zoomLevel})` : undefined,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out',
          }}
        >
          {/* Physical Resume Page Canvas (Strict A4 single-page layout matching specification) */}
          <main
            ref={canvasRef}
            id="printable-resume-page"
            className="page-container bg-white text-slate-800 p-8 sm:p-10 md:p-12 shadow-2xl border border-slate-200/80 flex flex-col justify-between box-border rounded-lg select-text text-left"
            style={{ width: '210mm', minHeight: '297mm' }}
          >
            <div className="space-y-4 sm:space-y-5">
              {/* HEADER */}
              <header className="border-b border-slate-200 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
                      {candidateName}
                    </h1>
                    <p className="text-sm font-semibold text-[#6d28d9] mt-0.5 tracking-tight">
                      {candidateTitle}
                    </p>
                  </div>
                  <div className="text-xs text-slate-500 font-medium">
                    {candidateLocation} • {candidateTrack}
                  </div>
                </div>

                {/* Contact Links */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3 text-xs text-slate-600">
                  <a
                    href={`mailto:${candidateEmail}`}
                    className="inline-flex items-center gap-1.5 hover:text-slate-900 transition"
                  >
                    <svg
                      className="w-3.5 h-3.5 text-slate-700"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.75-9.75-6.75"
                      />
                    </svg>
                    <span>{candidateEmail}</span>
                  </a>

                  {candidateGithub && (
                    <a
                      href={candidateGithub.startsWith('http') ? candidateGithub : `https://${candidateGithub}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 hover:text-slate-900 transition"
                    >
                      <svg className="w-3.5 h-3.5 text-slate-700" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                      </svg>
                      <span>
                        {candidateGithub.replace(/^https?:\/\/(www\.)?github\.com\/?/, 'github.com/')}
                      </span>
                    </a>
                  )}

                  {candidateLinkedin && (
                    <a
                      href={candidateLinkedin.startsWith('http') ? candidateLinkedin : `https://${candidateLinkedin}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 hover:text-slate-900 transition"
                    >
                      <svg className="w-3.5 h-3.5 text-[#0a66c2]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                      </svg>
                      <span>
                        {candidateLinkedin.replace(/^https?:\/\/(www\.)?linkedin\.com\/(in\/)?/, 'linkedin.com/in/')}
                      </span>
                    </a>
                  )}
                </div>
              </header>

              {/* WORK EXPERIENCE */}
              <section className="space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Work Experience
                  </h2>
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-tight">
                    4+ Years Cumulative
                  </span>
                </div>

                <div className="space-y-3">
                  {displayExperiences.map((exp, idx) => (
                    <div key={idx}>
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-xs font-bold text-slate-900">{exp.role}</h3>
                          <p className="text-xs font-semibold text-[#6d28d9]">{exp.company}</p>
                        </div>
                        <span className="text-[11px] font-mono font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {exp.period}
                        </span>
                      </div>
                      <ul className="mt-1 space-y-1 text-[11.5px] leading-relaxed text-slate-700 list-disc list-outside ml-4">
                        {exp.achievements.map((ach, aIdx) => (
                          <li
                            key={aIdx}
                            dangerouslySetInnerHTML={{ __html: ach }}
                          />
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>

              {/* KEY PROJECTS */}
              <section className="space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Key Projects
                  </h2>
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-tight">
                    Production Grade
                  </span>
                </div>

                <div className="space-y-2.5">
                  {displayProjects.map((proj, idx) => {
                    const stackString = Array.isArray(proj.techStack)
                      ? proj.techStack.join(' • ')
                      : proj.techStack || '';
                    const isBlue =
                      proj.badgeColor === 'blue' ||
                      proj.badge?.toLowerCase().includes('data') ||
                      proj.badge?.toLowerCase().includes('pipeline');

                    return (
                      <div key={idx}>
                        <div className="flex items-baseline justify-between gap-2 flex-wrap">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <h3 className="text-xs font-bold text-slate-900">{proj.title}</h3>
                            {stackString && (
                              <span className="text-[10px] font-mono text-[#6d28d9]">
                                {stackString}
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border shrink-0 ${
                              isBlue
                                ? 'text-blue-700 bg-blue-50 border-blue-200/60'
                                : 'text-emerald-700 bg-emerald-50 border-emerald-200/60'
                            }`}
                          >
                            {proj.badge || 'Production'}
                          </span>
                        </div>
                        <p
                          className="mt-1 text-[11.5px] leading-relaxed text-slate-700"
                          dangerouslySetInnerHTML={{ __html: proj.description }}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* SKILLS */}
              <section className="space-y-2">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Core Competencies &amp; Technical Stack
                  </h2>
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-tight">
                    Stack Matrix
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-1.5 text-[11.5px] leading-relaxed">
                  {displayCompetencies.map((comp, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2"
                    >
                      <span className="font-bold text-slate-900 min-w-[80px] shrink-0">
                        • {comp.category}:
                      </span>
                      <span className="text-slate-700">{comp.stack}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* EDUCATION */}
              <section className="space-y-2">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Education &amp; Certifications
                  </h2>
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-tight">
                    Accredited
                  </span>
                </div>

                <div className="space-y-1.5 text-[11.5px]">
                  {displayEducation.map((edu, idx) => (
                    <div key={idx} className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-slate-900">{edu.degree}</span>
                        <span className="text-slate-600 block sm:inline sm:ml-2">
                          — {edu.school}
                        </span>
                      </div>
                      <span className="font-mono text-slate-600 text-xs shrink-0">
                        Graduated {edu.year}
                      </span>
                    </div>
                  ))}

                  {displayCertifications.map((cert, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-slate-900">{cert.name}</span>
                        <span className="text-slate-600 ml-2">— Industry Cloud Standard</span>
                      </div>
                      <span className="text-[10px] font-mono font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                        {cert.badge || 'Verified Dossier'}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* ATS AUDIT FOOTER */}
            <footer className="pt-4 border-t border-slate-200 mt-5 flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>{candidateName.toUpperCase()} • CURRICULUM VITAE</span>
              <span>CONFIDENTIAL • GENERATED FOR REVIEW</span>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
};
