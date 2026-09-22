import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import {
  UserProfile,
  PortfolioProject,
  SkillCategory,
  ResumeDocument,
  MainNavView,
} from '../types';
import { ResumeView, ResumeFormatStyle } from './ResumeView';
import { WebPortfolioView } from './WebPortfolioView';
import { EditProfileModal } from './EditProfileModal';
import { ResumePreviewModal } from './ResumePreviewModal';
import { ProjectDetailModal } from './ProjectDetailModal';
import { Sound } from '../utils/audio';
import { nativeService } from '../services/nativeService';
import {
  Download,
  Printer,
  Eye,
  Share2,
  Pencil,
  SlidersHorizontal,
  ExternalLink,
  Check,
  Globe,
  Sparkles,
  Layers,
} from 'lucide-react';

interface WorkfolioViewProps {
  profile: UserProfile;
  projects: PortfolioProject[];
  skills: SkillCategory[];
  resume: ResumeDocument;
  onUpdateProfile: (updated: UserProfile) => void;
  onUpdateProjects?: (projects: PortfolioProject[]) => void;
  onUpdateSkills?: (skills: SkillCategory[]) => void;
  onUpdateResume?: (resume: ResumeDocument) => void;
  onAddProject: (project: Omit<PortfolioProject, 'id'>) => void;
  onDeleteProject: (id: string) => void;
  onNavigate?: (view: MainNavView) => void;
  soundEnabled: boolean;
}

export type PortfolioTab = 'resume' | 'portfolio';

export const WorkfolioView: React.FC<WorkfolioViewProps> = ({
  profile,
  projects,
  skills,
  resume,
  onUpdateProfile,
  onUpdateProjects,
  onUpdateSkills,
  onUpdateResume,
  onAddProject,
  onDeleteProject,
  onNavigate,
  soundEnabled,
}) => {
  // Navigation tab state: 'resume' or 'portfolio'
  const [activeTab, setActiveTab] = useState<PortfolioTab>('portfolio');

  // Resume visible sections state for toggles
  const [visibleSections, setVisibleSections] = useState<Record<string, boolean>>({
    summary: true,
    experience: true,
    education: true,
    skills: true,
    projects: true,
    certifications: true,
    publications: true,
    achievements: true,
  });

  // Modal States
  const [showEditModal, setShowEditModal] = useState(false);
  const [editInitialTab, setEditInitialTab] = useState('basic');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<PortfolioProject | null>(null);

  // Export & Action States
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [sharedToast, setSharedToast] = useState(false);

  // Resume Sheet DOM Ref for PDF capture and Print
  const resumeSheetRef = useRef<HTMLDivElement | null>(null);

  const toggleSection = (id: string) => {
    Sound.click(soundEnabled);
    setVisibleSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleShareResume = async () => {
    Sound.click(soundEnabled);
    const shareUrl = window.location.href;
    const shared = await nativeService.shareContent({
      title: `${profile.name || 'Personal'} - Workfolio & Resume`,
      text: `Check out ${profile.name || 'my'} professional workfolio and interactive resume!`,
      url: shareUrl,
      dialogTitle: 'Share Workfolio & Resume',
    });
    Sound.success(soundEnabled);
    if (!shared || !nativeService.isNativeDevice()) {
      setSharedToast(true);
      setTimeout(() => setSharedToast(false), 2400);
    }
  };

  const [printStatus, setPrintStatus] = useState<string | null>(null);

  // High-Resolution PDF Export
  const handleDownloadPDF = async () => {
    Sound.click(soundEnabled);
    setIsExportingPDF(true);

    const wasPortfolio = activeTab === 'portfolio';
    if (wasPortfolio) {
      setActiveTab('resume');
      await new Promise((resolve) => setTimeout(resolve, 400));
    }

    try {
      const sheet = document.getElementById('printable-resume-sheet');
      if (!sheet) {
        throw new Error('Resume sheet element not found');
      }

      // Scroll window to top so html2canvas renders origin correctly
      window.scrollTo({ top: 0, behavior: 'instant' as any });
      await new Promise((resolve) => setTimeout(resolve, 150));

      const canvas = await html2canvas(sheet, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1200,
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

      const cleanName = (profile.name || 'Candidate').trim().replace(/\s+/g, '_');
      pdf.save(`${cleanName}_Resume.pdf`);
      Sound.success(soundEnabled);
    } catch (err) {
      console.error('PDF export error:', err);
      executePrint();
    } finally {
      setIsExportingPDF(false);
      if (wasPortfolio) {
        setActiveTab('portfolio');
      }
    }
  };

  const handlePrint = () => {
    Sound.click(soundEnabled);
    if (activeTab !== 'resume') {
      setActiveTab('resume');
      setTimeout(() => executePrint(), 350);
    } else {
      executePrint();
    }
  };

  const executePrint = () => {
    const sheet = document.getElementById('printable-resume-sheet');
    if (!sheet) {
      try {
        window.print();
      } catch (_) {}
      return;
    }

    setPrintStatus('Preparing printable document...');

    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);

      const frameDoc = iframe.contentWindow?.document;
      if (frameDoc) {
        const styleSheets = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
          .map((el) => el.outerHTML)
          .join('\n');

        frameDoc.open();
        frameDoc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${(profile.name || 'Candidate')} - Resume</title>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              ${styleSheets}
              <style>
                @page { size: A4 portrait; margin: 10mm 12mm; }
                body {
                  background: white !important;
                  color: black !important;
                  padding: 16px !important;
                  margin: 0 !important;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                #printable-resume-sheet {
                  max-width: 100% !important;
                  width: 100% !important;
                  box-shadow: none !important;
                  border: none !important;
                  padding: 0 !important;
                  margin: 0 !important;
                }
                .print\\:hidden, button { display: none !important; }
              </style>
            </head>
            <body>
              ${sheet.outerHTML}
            </body>
          </html>
        `);
        frameDoc.close();

        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            setPrintStatus(null);
          } catch (printErr) {
            console.warn('Iframe print failed, calling window.print():', printErr);
            try {
              window.print();
            } catch (err2) {
              console.error('Print unavailable in iframe:', err2);
            }
            setPrintStatus(null);
          } finally {
            setTimeout(() => {
              try {
                document.body.removeChild(iframe);
              } catch (_) {}
            }, 3000);
          }
        }, 500);
        return;
      }
    } catch (e) {
      console.warn('Iframe print setup failed, using window.print():', e);
      try {
        window.print();
      } catch (_) {}
      setPrintStatus(null);
    }
  };

  const visibleSectionsList = [
    { id: 'summary', label: 'Professional Summary' },
    { id: 'experience', label: 'Experience' },
    { id: 'education', label: 'Education' },
    { id: 'skills', label: 'Skills' },
    { id: 'projects', label: 'Projects' },
    { id: 'certifications', label: 'Certifications' },
    { id: 'publications', label: 'Publications' },
    { id: 'achievements', label: 'Achievements' },
  ];

  return (
    <div className="min-h-screen bg-[#FDFBF7] py-6 px-3 sm:px-6 lg:px-10 space-y-8 print:min-h-0 print:py-0 print:px-0 print:space-y-0 print:bg-white">
      {/* 1. TOP HEADER BAR (Exact replica of the attached image) */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 pb-4 print:hidden">
        {/* Left: Brand / Title */}
        <div className="text-left w-full md:w-auto">
          <h1 className="text-xl font-bold font-serif text-gray-950 tracking-tight">
            Portfolio
          </h1>
          <p className="text-xs text-gray-500 font-medium">
            A simple way to tell your story
          </p>
        </div>

        {/* Center: Clean Toggle Tab & Italic Note */}
        <div className="flex items-center gap-3">
          <div className="bg-[#EBE7DF] p-1 rounded-full flex items-center shadow-inner">
            <button
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                setActiveTab('resume');
              }}
              className={`px-5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'resume'
                  ? 'bg-[#18181B] text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-950'
              }`}
            >
              Resume
            </button>

            <button
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                setActiveTab('portfolio');
              }}
              className={`px-5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'portfolio'
                  ? 'bg-[#18181B] text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-950'
              }`}
            >
              Web Portfolio
            </button>
          </div>

          {/* Script note next to toggle */}
          {activeTab === 'resume' && (
            <span className="font-serif italic text-xs text-gray-400 select-none hidden sm:inline-block -rotate-6 transform">
              Same story. Different views.
            </span>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          {activeTab === 'resume' ? (
            <>
              <div className="text-right hidden sm:block">
                <p className="text-[10px] text-gray-400 font-medium">Last updated</p>
                <p className="text-xs text-gray-700 font-semibold">17 Sep 2026, 01:24 PM</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  Sound.click(soundEnabled);
                  setEditInitialTab('basic');
                  setShowEditModal(true);
                }}
                className="bg-[#18181B] hover:bg-black text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                setEditInitialTab('basic');
                setShowEditModal(true);
              }}
              className="bg-[#18181B] hover:bg-black text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit Portfolio</span>
            </button>
          )}
        </div>
      </header>

      {/* Optional Print / Toast notification */}
      {printStatus && (
        <div className="fixed top-5 right-5 z-50 bg-[#18181B] text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-medium flex items-center gap-2 animate-fade-in">
          <Printer className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span>{printStatus}</span>
        </div>
      )}

      {/* 2. MAIN ACTIVE VIEW CONTENT */}
      <main className="max-w-7xl mx-auto">
        {activeTab === 'resume' ? (
          /* RESUME VIEW: 2-COLUMN LAYOUT (Document Sheet + Resume Controls) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Printable Resume Sheet (Span 8) */}
            <div className="lg:col-span-8 flex flex-col items-center w-full space-y-4">
              {/* Mobile Quick Action Bar (Visible only on mobile/tablet < lg) */}
              <div className="lg:hidden w-full max-w-[850px] bg-white rounded-2xl p-3 border border-gray-100 shadow-xs flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  disabled={isExportingPDF}
                  className="flex-1 bg-[#1A302A] hover:bg-[#13231F] text-white py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isExportingPDF ? 'Generating...' : 'Download PDF'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex-1 bg-white hover:bg-gray-50 border border-gray-200 text-gray-800 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-gray-600" />
                  <span>Print</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    Sound.click(soundEnabled);
                    setShowPreviewModal(true);
                  }}
                  className="p-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-gray-700 transition-colors cursor-pointer"
                  title="View ATS Version"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>

              <ResumeView
                sheetRef={resumeSheetRef}
                profile={profile}
                projects={projects}
                skills={skills}
                visibleSections={visibleSections}
                onEditSection={(sec) => {
                  setEditInitialTab(sec);
                  setShowEditModal(true);
                }}
              />
            </div>

            {/* Right: Resume Controls Card (Span 4) */}
            <div className="lg:col-span-4 sticky top-6 print:hidden">
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-[0_4px_25px_-5px_rgba(0,0,0,0.03)] space-y-5">
                {/* Title and Subtitle */}
                <div>
                  <h3 className="text-sm font-bold text-gray-950">Resume Controls</h3>
                  <p className="text-xs text-gray-400">Customize and download your resume</p>
                </div>

                {/* Primary Actions: Download PDF & Print */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleDownloadPDF}
                    disabled={isExportingPDF}
                    className="bg-[#1A302A] hover:bg-[#13231F] text-white py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-2xs transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isExportingPDF ? 'Generating...' : 'Download PDF'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrint}
                    className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-800 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-2xs transition-colors cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-gray-600" />
                    <span>Print</span>
                  </button>
                </div>

                {/* Secondary Actions: View ATS Version & Share Resume */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      Sound.click(soundEnabled);
                      setShowPreviewModal(true);
                    }}
                    className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-800 py-2 px-2.5 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-gray-500" />
                    <span>View ATS Version</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleShareResume}
                    className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-800 py-2 px-2.5 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5 text-gray-500" />
                    <span>{sharedToast ? 'Link Copied!' : 'Share Resume'}</span>
                  </button>
                </div>

                <div className="border-t border-gray-100" />

                {/* Visible Sections header + Reorder Button */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-950">Visible Sections</span>
                  <button
                    type="button"
                    onClick={() => {
                      Sound.click(soundEnabled);
                      setEditInitialTab('reorder');
                      setShowEditModal(true);
                    }}
                    className="border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-[11px] font-medium px-2 py-0.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <SlidersHorizontal className="w-3 h-3" />
                    <span>Reorder</span>
                  </button>
                </div>

                {/* 8 Section Visibility Switches */}
                <div className="space-y-3 pt-1">
                  {visibleSectionsList.map((sec) => (
                    <div key={sec.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Eye
                          className={`w-4 h-4 ${
                            visibleSections[sec.id] ? 'text-gray-700' : 'text-gray-300'
                          }`}
                        />
                        <span
                          className={`text-xs font-medium ${
                            visibleSections[sec.id] ? 'text-gray-800' : 'text-gray-400'
                          }`}
                        >
                          {sec.label}
                        </span>
                      </div>

                      {/* iOS-style toggle switch */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={visibleSections[sec.id]}
                        onClick={() => toggleSection(sec.id)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                          visibleSections[sec.id] ? 'bg-[#18181B]' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform transform ${
                            visibleSections[sec.id] ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* WEB PORTFOLIO VIEW */
          <WebPortfolioView
            profile={profile}
            projects={projects}
            skills={skills}
            soundEnabled={soundEnabled}
            onOpenResumeTab={() => setActiveTab('resume')}
            onDownloadPDF={handleDownloadPDF}
            onSelectProject={(proj) => setSelectedProject(proj)}
            onEditSection={(sec) => {
              setEditInitialTab(sec);
              setShowEditModal(true);
            }}
          />
        )}
      </main>

      {/* 3. MODALS */}
      {showEditModal && (
        <EditProfileModal
          isOpen={showEditModal}
          initialTab={editInitialTab}
          profile={profile}
          projects={projects}
          skills={skills}
          soundEnabled={soundEnabled}
          onClose={() => setShowEditModal(false)}
          onSave={(updatedProfile, updatedProjects, updatedSkills) => {
            onUpdateProfile(updatedProfile);
            if (onUpdateProjects) onUpdateProjects(updatedProjects);
            if (onUpdateSkills) onUpdateSkills(updatedSkills);
            Sound.success(soundEnabled);
          }}
        />
      )}

      {showPreviewModal && (
        <ResumePreviewModal
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
          onDownloadPDF={handleDownloadPDF}
          onPrint={handlePrint}
          isExportingPDF={isExportingPDF}
          soundEnabled={soundEnabled}
        >
          <div className="p-4 bg-white flex justify-center">
            <ResumeView
              sheetRef={null as any}
              profile={profile}
              projects={projects}
              skills={skills}
              visibleSections={visibleSections}
            />
          </div>
        </ResumePreviewModal>
      )}

      {selectedProject && (
        <ProjectDetailModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          soundEnabled={soundEnabled}
        />
      )}
    </div>
  );
};
