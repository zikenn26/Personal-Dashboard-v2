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
      'Architected distributed stateless authentication handling <strong>45,000+ daily active users</strong> with sub-40ms token validation latency.',
      'Engineered automated multi-tenant database partitioning on PostgreSQL, cutting peak API response cycles by <strong>32%</strong>.',
      'Led front-end migration to Next.js App Router and optimized SSR hydration, reducing Largest Contentful Paint (LCP) from 3.1s to <strong>1.1s</strong>.',
    ],
  },
  {
    role: 'Full Stack Software Engineer',
    company: 'Data & Developer Infrastructure Labs',
    period: '2021 — 2023',
    achievements: [
      'Constructed high-speed ETL ingestion pipes streaming <strong>1.2M+ records/day</strong> via containerized microservices.',
      'Implemented reusable UI design system and standardized component libraries across <strong>5 distinct engineering squads</strong>.',
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
      'Telemetry ingestion pipeline transforming complex multi-source event streams into normalized star-schema models with <strong>&lt;120ms queries</strong> and executive BI data caching.',
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
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      // Calculate fit zoom for phone screens
      return Math.min(1, Math.max(0.44, Number(((window.innerWidth - 24) / 794).toFixed(2))));
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

    let offscreenWrapper: HTMLDivElement | null = null;
    try {
      // 1. Wait for document fonts to load completely
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      // 2. Create clean, unscaled off-screen clone at exact 794px width (A4 standard at 96 DPI)
      const original = canvasRef.current;
      const clone = original.cloneNode(true) as HTMLElement;

      offscreenWrapper = document.createElement('div');
      offscreenWrapper.style.position = 'fixed';
      offscreenWrapper.style.left = '-12000px';
      offscreenWrapper.style.top = '0';
      offscreenWrapper.style.width = '794px';
      offscreenWrapper.style.minHeight = '1123px';
      offscreenWrapper.style.margin = '0';
      offscreenWrapper.style.padding = '0';
      offscreenWrapper.style.transform = 'none';
      offscreenWrapper.style.zIndex = '-9999';
      offscreenWrapper.style.background = '#ffffff';
      offscreenWrapper.style.boxSizing = 'border-box';
      offscreenWrapper.style.overflow = 'visible';

      // Ensure clone has standard unscaled properties and zero negative letter-spacing
      clone.style.transform = 'none';
      clone.style.margin = '0';
      clone.style.boxShadow = 'none';
      clone.style.border = 'none';
      clone.style.width = '794px';
      clone.style.minHeight = '1123px';
      clone.style.boxSizing = 'border-box';
      clone.style.letterSpacing = '0px';

      // Neutralize any negative letter-spacing or broken transform on all descendants
      clone.querySelectorAll('*').forEach((node) => {
        const el = node as HTMLElement;
        el.style.letterSpacing = '0px';
        el.style.wordSpacing = 'normal';
        el.style.transform = 'none';
      });

      offscreenWrapper.appendChild(clone);
      document.body.appendChild(offscreenWrapper);

      // Brief layout settle
      await new Promise((res) => setTimeout(res, 220));

      const targetHeight = Math.max(clone.scrollHeight, 1123);

      // 3. Render clean canvas without ancestor transform distortion
      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 794,
        height: targetHeight,
        windowWidth: 794,
        windowHeight: targetHeight,
        onclone: (clonedDoc) => {
          // Copy all stylesheets from main document
          document.querySelectorAll('style, link[rel="stylesheet"]').forEach((sheet) => {
            clonedDoc.head.appendChild(sheet.cloneNode(true));
          });
          if (document.fonts) {
            document.fonts.forEach((font) => {
              try {
                clonedDoc.fonts.add(font);
              } catch (_) {}
            });
          }
        },
      });

      // 4. Generate A4 PDF with jsPDF
      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const pageWidth = pdf.internal.pageSize.getWidth(); // 210mm
      const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, Math.min(imgHeight, pageHeight));

      const cleanFilename = `${candidateName.replace(/\s+/g, '_')}_Resume.pdf`;
      pdf.save(cleanFilename);

      Sound.success(soundEnabled);
      toast.success('Resume downloaded successfully!', { id: toastId });
    } catch (err) {
      console.error('Download PDF error:', err);
      toast.error('Falling back to system print engine...', { id: toastId });
      window.print();
    } finally {
      if (offscreenWrapper && offscreenWrapper.parentNode) {
        offscreenWrapper.parentNode.removeChild(offscreenWrapper);
      }
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/85 backdrop-blur-sm flex flex-col items-center justify-start py-3 sm:py-6 px-2 sm:px-4 select-none animate-in fade-in duration-200">
      {/* Floating Top Control Bar (Hidden in Print Mode) */}
      <aside className="no-print mb-3 sm:mb-5 w-full max-w-[210mm] flex flex-wrap items-center justify-between gap-2.5 bg-white dark:bg-slate-900 px-4 sm:px-5 py-2.5 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            Printable Single-Page PDF (A4 / Letter Standard)
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Zoom Controls */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(0.4, Number((z - 0.1).toFixed(2))))}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg transition cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono font-medium px-2 text-slate-700 dark:text-slate-300 min-w-[42px] text-center">
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

          {/* Download PDF Button */}
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

      {/* Preview Container Wrapper with smooth scrolling */}
      <div className="w-full flex justify-center overflow-x-auto pb-12">
        <div
          style={{
            transform: zoomLevel !== 1 ? `scale(${zoomLevel})` : undefined,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out',
            width: '794px',
          }}
          className="shrink-0 flex justify-center"
        >
          {/* Physical Resume Page Canvas */}
          <main
            ref={canvasRef}
            id="printable-resume-page"
            className="page-container bg-white text-slate-800 p-10 sm:p-11 shadow-2xl border border-slate-200/80 flex flex-col justify-between box-border rounded-lg select-text text-left"
            style={{
              width: '794px',
              minHeight: '1123px',
              letterSpacing: '0px',
              fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
            }}
          >
            <div className="space-y-4">
              {/* HEADER */}
              <header className="border-b border-slate-200 pb-3.5">
                <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                  <div>
                    <h1
                      style={{
                        fontSize: '26px',
                        fontWeight: 800,
                        color: '#0f172a',
                        lineHeight: '1.2',
                        letterSpacing: '0px',
                        margin: 0,
                      }}
                    >
                      {candidateName}
                    </h1>
                    <p
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#6d28d9',
                        lineHeight: '1.3',
                        letterSpacing: '0px',
                        marginTop: '2px',
                        marginBottom: 0,
                      }}
                    >
                      {candidateTitle}
                    </p>
                  </div>
                  <div
                    style={{
                      fontSize: '11.5px',
                      color: '#64748b',
                      fontWeight: 500,
                      letterSpacing: '0px',
                    }}
                  >
                    {candidateLocation} • {candidateTrack}
                  </div>
                </div>

                {/* Contact Links */}
                <div
                  className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-2.5 text-xs text-slate-600"
                  style={{ letterSpacing: '0px' }}
                >
                  {candidateEmail && (
                    <a
                      href={`mailto:${candidateEmail}`}
                      className="inline-flex items-center gap-1.5 hover:text-slate-900 transition"
                      style={{ letterSpacing: '0px' }}
                    >
                      <svg
                        className="w-3.5 h-3.5 text-slate-700 shrink-0"
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
                  )}

                  {candidateGithub && (
                    <a
                      href={candidateGithub.startsWith('http') ? candidateGithub : `https://${candidateGithub}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 hover:text-slate-900 transition"
                      style={{ letterSpacing: '0px' }}
                    >
                      <svg className="w-3.5 h-3.5 text-slate-700 shrink-0" fill="currentColor" viewBox="0 0 24 24">
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
                      style={{ letterSpacing: '0px' }}
                    >
                      <svg className="w-3.5 h-3.5 text-[#0a66c2] shrink-0" fill="currentColor" viewBox="0 0 24 24">
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
              <section className="space-y-2">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                  <h2
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: '#0f172a',
                      letterSpacing: '0.05em',
                      margin: 0,
                    }}
                  >
                    Work Experience
                  </h2>
                  <span
                    style={{
                      fontSize: '10px',
                      fontFamily: "'JetBrains Mono', monospace",
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0px',
                    }}
                  >
                    4+ Years Cumulative
                  </span>
                </div>

                <div className="space-y-2.5">
                  {displayExperiences.map((exp, idx) => (
                    <div key={idx} className="block">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3
                            style={{
                              fontSize: '12px',
                              fontWeight: 700,
                              color: '#0f172a',
                              lineHeight: '1.3',
                              letterSpacing: '0px',
                              margin: 0,
                            }}
                          >
                            {exp.role}
                          </h3>
                          <p
                            style={{
                              fontSize: '11.5px',
                              fontWeight: 600,
                              color: '#6d28d9',
                              lineHeight: '1.3',
                              letterSpacing: '0px',
                              marginTop: '1px',
                              marginBottom: 0,
                            }}
                          >
                            {exp.company}
                          </p>
                        </div>
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 500,
                            color: '#475569',
                            backgroundColor: '#f1f5f9',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            whiteSpace: 'nowrap',
                            lineHeight: '1.3',
                          }}
                        >
                          {exp.period}
                        </span>
                      </div>
                      <ul
                        className="mt-1 space-y-1 list-disc list-outside ml-4"
                        style={{
                          fontSize: '11px',
                          lineHeight: '1.45',
                          color: '#334155',
                          letterSpacing: '0px',
                        }}
                      >
                        {exp.achievements.map((ach, aIdx) => (
                          <li
                            key={aIdx}
                            style={{ letterSpacing: '0px', lineHeight: '1.45' }}
                            dangerouslySetInnerHTML={{ __html: ach }}
                          />
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>

              {/* KEY PROJECTS */}
              <section className="space-y-2">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                  <h2
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: '#0f172a',
                      letterSpacing: '0.05em',
                      margin: 0,
                    }}
                  >
                    Key Projects
                  </h2>
                  <span
                    style={{
                      fontSize: '10px',
                      fontFamily: "'JetBrains Mono', monospace",
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0px',
                    }}
                  >
                    Production Grade
                  </span>
                </div>

                <div className="space-y-2">
                  {displayProjects.map((proj, idx) => {
                    const stackString = Array.isArray(proj.techStack)
                      ? proj.techStack.join(' • ')
                      : proj.techStack || '';
                    const isBlue =
                      proj.badgeColor === 'blue' ||
                      proj.badge?.toLowerCase().includes('data') ||
                      proj.badge?.toLowerCase().includes('pipeline') ||
                      proj.badge?.toLowerCase().includes('system');

                    return (
                      <div key={idx} className="block">
                        <div className="flex items-baseline justify-between gap-2 flex-wrap">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <h3
                              style={{
                                fontSize: '12px',
                                fontWeight: 700,
                                color: '#0f172a',
                                lineHeight: '1.3',
                                letterSpacing: '0px',
                                margin: 0,
                              }}
                            >
                              {proj.title}
                            </h3>
                            {stackString && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontFamily: "'JetBrains Mono', monospace",
                                  color: '#6d28d9',
                                  letterSpacing: '0px',
                                }}
                              >
                                {stackString}
                              </span>
                            )}
                          </div>
                          <span
                            style={{
                              fontSize: '9.5px',
                              fontFamily: "'JetBrains Mono', monospace",
                              fontWeight: 600,
                              padding: '1px 6px',
                              borderRadius: '4px',
                              border: isBlue ? '1px solid #bfdbfe' : '1px solid #a7f3d0',
                              backgroundColor: isBlue ? '#eff6ff' : '#ecfdf5',
                              color: isBlue ? '#1d4ed8' : '#047857',
                              lineHeight: '1.2',
                            }}
                          >
                            {proj.badge || 'Production'}
                          </span>
                        </div>
                        <p
                          style={{
                            fontSize: '11px',
                            lineHeight: '1.45',
                            color: '#334155',
                            letterSpacing: '0px',
                            marginTop: '2px',
                            marginBottom: 0,
                          }}
                          dangerouslySetInnerHTML={{ __html: proj.description }}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* CORE COMPETENCIES */}
              <section className="space-y-1.5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                  <h2
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: '#0f172a',
                      letterSpacing: '0.05em',
                      margin: 0,
                    }}
                  >
                    Core Competencies &amp; Technical Stack
                  </h2>
                  <span
                    style={{
                      fontSize: '10px',
                      fontFamily: "'JetBrains Mono', monospace",
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0px',
                    }}
                  >
                    Stack Matrix
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-1 text-[11px]" style={{ lineHeight: '1.4', letterSpacing: '0px' }}>
                  {displayCompetencies.map((comp, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col sm:flex-row sm:items-baseline gap-1"
                      style={{ letterSpacing: '0px' }}
                    >
                      <span
                        style={{
                          fontWeight: 700,
                          color: '#0f172a',
                          minWidth: '90px',
                          flexShrink: 0,
                          letterSpacing: '0px',
                        }}
                      >
                        • {comp.category}:
                      </span>
                      <span style={{ color: '#334155', letterSpacing: '0px' }}>{comp.stack}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* EDUCATION & CERTIFICATIONS */}
              <section className="space-y-1.5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                  <h2
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: '#0f172a',
                      letterSpacing: '0.05em',
                      margin: 0,
                    }}
                  >
                    Education &amp; Certifications
                  </h2>
                  <span
                    style={{
                      fontSize: '10px',
                      fontFamily: "'JetBrains Mono', monospace",
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0px',
                    }}
                  >
                    Accredited
                  </span>
                </div>

                <div className="space-y-1 text-[11px]" style={{ lineHeight: '1.35', letterSpacing: '0px' }}>
                  {displayEducation.map((edu, idx) => (
                    <div key={idx} className="flex items-start justify-between gap-2" style={{ letterSpacing: '0px' }}>
                      <div>
                        <span style={{ fontWeight: 700, color: '#0f172a', letterSpacing: '0px' }}>
                          {edu.degree}
                        </span>
                        <span style={{ color: '#475569', marginLeft: '6px', letterSpacing: '0px' }}>
                          — {edu.school}
                        </span>
                      </div>
                      <span
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          color: '#64748b',
                          fontSize: '10.5px',
                          flexShrink: 0,
                          letterSpacing: '0px',
                        }}
                      >
                        Graduated {edu.year}
                      </span>
                    </div>
                  ))}

                  {displayCertifications.map((cert, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2" style={{ letterSpacing: '0px' }}>
                      <div>
                        <span style={{ fontWeight: 700, color: '#0f172a', letterSpacing: '0px' }}>
                          {cert.name}
                        </span>
                        <span style={{ color: '#475569', marginLeft: '6px', letterSpacing: '0px' }}>
                          — Industry Cloud Standard
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: '9.5px',
                          fontFamily: "'JetBrains Mono', monospace",
                          fontWeight: 600,
                          color: '#047857',
                          backgroundColor: '#ecfdf5',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          border: '1px solid #a7f3d0',
                          flexShrink: 0,
                        }}
                      >
                        {cert.badge || 'Verified Dossier'}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* ATS AUDIT FOOTER */}
            <footer
              className="pt-3 border-t border-slate-200 mt-4 flex items-center justify-between"
              style={{
                fontSize: '9.5px',
                fontFamily: "'JetBrains Mono', monospace",
                color: '#94a3b8',
                letterSpacing: '0px',
              }}
            >
              <span>{candidateName.toUpperCase()} • CURRICULUM VITAE</span>
              <span>CONFIDENTIAL • GENERATED FOR REVIEW</span>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
};
