import React, { useEffect, useState } from 'react';
import { PortfolioProject } from '../types';
import {
  X,
  ExternalLink,
  Github,
  Sparkles,
  Calendar,
  Code2,
  CheckCircle2,
  Layers,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import { Sound } from '../utils/audio';

interface ProjectDetailModalProps {
  project: PortfolioProject | null;
  onClose: () => void;
  soundEnabled?: boolean;
}

export const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({
  project,
  onClose,
  soundEnabled = true,
}) => {
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!project) return null;

  const techList = project.techStack || project.tech || [];
  const liveUrl = project.liveUrl || project.link;
  const githubUrl = project.githubUrl || project.github;

  // Build image list: primary imageUrl, screenshots array, or category fallback
  const fallbackImages: Record<string, string> = {
    Fullstack:
      'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80',
    Systems:
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80',
    'AI / Data':
      'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
    Frontend:
      'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=1200&q=80',
    Mobile:
      'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=1200&q=80',
    Other:
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80',
  };

  const defaultImg =
    project.imageUrl ||
    fallbackImages[project.category] ||
    fallbackImages.Other;

  const allImages = project.screenshots && project.screenshots.length > 0
    ? [project.imageUrl || fallbackImages[project.category] || fallbackImages.Other, ...project.screenshots]
    : [defaultImg];

  const currentImage = allImages[selectedImageIdx] || defaultImg;

  // Format full project dates
  const displayDates = () => {
    if (project.startDate && project.endDate) {
      return `${project.startDate} – ${project.endDate}`;
    }
    if (project.startDate) {
      return `${project.startDate} – Present`;
    }
    if (project.date) {
      return project.date;
    }
    return '2024';
  };

  return (
    <div
      id="project-detail-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/65 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        id="project-detail-modal-card"
        className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col max-h-[92vh] overflow-hidden animate-zoom-in text-gray-900"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        {/* Sticky Header with Title, Category, Dates & Close */}
        <div className="flex items-start justify-between p-5 sm:p-6 border-b border-gray-100 bg-white/95 backdrop-blur-xs sticky top-0 z-20">
          <div className="space-y-1.5 pr-4 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#E8EDF2] text-[#1E293B]">
                {project.category}
              </span>

              {project.featured && (
                <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200/80 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500 fill-amber-500" />
                  Featured Project
                </span>
              )}

              {/* Full Project Dates */}
              <div className="flex items-center gap-1 text-[11px] text-gray-500 font-medium bg-gray-50 px-2.5 py-0.5 rounded-full border border-gray-100">
                <Calendar className="w-3 h-3 text-gray-400" />
                <span>{displayDates()}</span>
              </div>

              {project.role && (
                <div className="flex items-center gap-1 text-[11px] text-gray-600 font-medium bg-gray-50 px-2.5 py-0.5 rounded-full border border-gray-100">
                  <UserCheck className="w-3 h-3 text-gray-400" />
                  <span>{project.role}</span>
                </div>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-bold font-serif text-gray-950 tracking-tight leading-snug">
              {project.title}
            </h2>

            {project.tagLine && (
              <p className="text-xs sm:text-sm text-gray-600 font-medium">
                {project.tagLine}
              </p>
            )}
          </div>

          <button
            type="button"
            id="close-project-detail-btn"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              Sound.click(soundEnabled);
              onClose();
            }}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0 cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
          {/* High-Resolution Project Image / Banner */}
          <div className="relative group rounded-2xl overflow-hidden bg-gray-100 border border-gray-200/70 shadow-2xs">
            <img
              src={currentImage}
              alt={project.title}
              className={`w-full object-cover transition-all duration-300 ${
                isZoomed ? 'max-h-[500px] object-contain bg-black/90' : 'h-56 sm:h-72 object-cover'
              }`}
              loading="lazy"
            />

            {/* Image zoom toggle button */}
            <button
              type="button"
              onClick={() => setIsZoomed(!isZoomed)}
              className="absolute bottom-3 right-3 bg-white/90 hover:bg-white text-gray-800 p-2 rounded-xl text-xs font-medium shadow-sm backdrop-blur-xs transition-transform hover:scale-105 cursor-pointer flex items-center gap-1"
              title={isZoomed ? 'Reset zoom' : 'View full image'}
            >
              {isZoomed ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isZoomed ? 'Standard' : 'Enlarge'}</span>
            </button>

            {/* Thumbnail Navigation if multiple screenshots exist */}
            {allImages.length > 1 && (
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-xs text-white text-[11px] px-2.5 py-1 rounded-lg font-medium">
                {selectedImageIdx + 1} / {allImages.length}
              </div>
            )}
          </div>

          {/* Multiple Screenshot Selector Carousel */}
          {allImages.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {allImages.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedImageIdx(idx)}
                  className={`relative w-20 h-14 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                    selectedImageIdx === idx ? 'border-indigo-600 ring-2 ring-indigo-200' : 'border-gray-200 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Key Impact & Results Banner */}
          {project.keyResult && (
            <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                  Key Quantitative Impact &amp; Result
                </h4>
                <p className="text-xs sm:text-sm text-emerald-800 leading-relaxed font-medium">
                  {project.keyResult}
                </p>
              </div>
            </div>
          )}

          {/* Expanded Project Description & Engineering Overview */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Project Description &amp; Scope
            </h3>
            <p className="text-xs sm:text-sm text-gray-700 leading-relaxed whitespace-pre-line">
              {project.expandedDescription || project.description}
            </p>
          </div>

          {/* Engineering Highlights / Outcomes */}
          {project.highlights && project.highlights.length > 0 ? (
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
                <span>Architecture &amp; Core Highlights</span>
              </h3>
              <ul className="space-y-2 text-xs sm:text-sm text-gray-600">
                {project.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 shrink-0" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-gray-50/80 border border-gray-100 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-gray-500" />
                <span>Architecture &amp; Engineering Decisions</span>
              </h4>
              <ul className="space-y-1.5 text-xs text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span>Engineered with clean separation of presentation, state machine, and data transport layers.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span>Optimized runtime efficiency with zero latency overhead and responsive client-side caching.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span>Tested rigorously against real-world user scenarios with defensive edge-case handling.</span>
                </li>
              </ul>
            </div>
          )}

          {/* Tech Stack & Architecture */}
          {techList.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-gray-500" />
                <span>Technologies &amp; Frameworks</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {techList.map((t, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium bg-gray-50 hover:bg-gray-100 text-gray-800 border border-gray-200/80 transition-colors"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions: Live Demo, Source Code, and Close button */}
        <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            {liveUrl && (
              <a
                href={liveUrl.startsWith('http') ? liveUrl : `https://${liveUrl}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#18181B] hover:bg-black text-white transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <span>Live Demo</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            {githubUrl && (
              <a
                href={githubUrl.startsWith('http') ? githubUrl : `https://${githubUrl}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-gray-800 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Github className="w-3.5 h-3.5 text-gray-700" />
                <span>Source Code</span>
              </a>
            )}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              Sound.click(soundEnabled);
              onClose();
            }}
            className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-200/60 rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
