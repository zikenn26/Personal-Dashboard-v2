import React from 'react';
import { PortfolioProject } from '../types';
import {
  X,
  ExternalLink,
  Github,
  Sparkles,
  Layers,
  CheckCircle2,
  Code2,
  Calendar,
  Share2,
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
  if (!project) return null;

  const techList = project.techStack || project.tech || [];
  const liveUrl = project.liveUrl || project.link;
  const githubUrl = project.githubUrl || project.github;

  return (
    <div
      id="project-detail-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="project-detail-modal-card"
        className="relative w-full max-w-2xl bg-white dark:bg-[#18181B] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-zinc-900/40">
          <div className="space-y-1 pr-4 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                {project.category}
              </span>
              {project.featured && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                  Featured Project
                </span>
              )}
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight">
              {project.title}
            </h2>
            {project.tagLine && (
              <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                {project.tagLine}
              </p>
            )}
          </div>

          <button
            type="button"
            id="close-project-detail-btn"
            onClick={() => {
              Sound.click(soundEnabled);
              onClose();
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Overview */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Project Overview
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
              {project.description}
            </p>
          </div>

          {/* Tech Stack */}
          {techList.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-indigo-500" />
                <span>Technologies &amp; Architecture</span>
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {techList.map((t, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-gray-100 dark:bg-zinc-800/80 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-zinc-700/60"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Highlights & Key Results */}
          {(project.keyResult || true) && (
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-zinc-900/60 border border-gray-200 dark:border-zinc-800 space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Key Impact &amp; Engineering Outcomes</span>
              </h3>
              {project.keyResult ? (
                <div className="text-xs font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800/60">
                  <span className="font-bold">Impact: </span>
                  <span>{project.keyResult}</span>
                </div>
              ) : null}
              <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1.5 list-disc list-inside">
                <li>Architected for robust performance, state predictability, and responsive interactions.</li>
                <li>Engineered clean separation of concerns with modular API endpoints and type-safe payloads.</li>
                <li>Validated with thorough real-world use-cases, exception handling, and secure data flows.</li>
              </ul>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-zinc-900/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {liveUrl && (
              <a
                href={liveUrl.startsWith('http') ? liveUrl : `https://${liveUrl}`}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
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
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-gray-900 hover:bg-black dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer border border-gray-700/50"
              >
                <Github className="w-3.5 h-3.5" />
                <span>Source Code</span>
              </a>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
