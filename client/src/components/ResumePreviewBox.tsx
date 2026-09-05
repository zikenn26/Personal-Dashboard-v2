import React, { useState, useRef } from 'react';
import { ResumeDocument } from '../types';
import { Sound } from '../utils/audio';
import {
  FileText,
  Upload,
  Download,
  Eye,
  Check,
  Sparkles,
  ExternalLink,
  Trash2,
  Maximize2,
  FileCheck,
  Layers,
  Building,
  GraduationCap,
  Calendar,
} from 'lucide-react';

interface ResumePreviewBoxProps {
  resume: ResumeDocument;
  onUpdateResume: (updated: ResumeDocument) => void;
  soundEnabled: boolean;
}

export const ResumePreviewBox: React.FC<ResumePreviewBoxProps> = ({
  resume,
  onUpdateResume,
  soundEnabled,
}) => {
  const [showFullResumeModal, setShowFullResumeModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File Upload Handler (PDF or Doc)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Sound.success(soundEnabled);
    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const updated: ResumeDocument = {
        ...resume,
        fileName: file.name,
        fileSize: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        uploadedAt: new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        fileDataUrl: dataUrl,
      };

      onUpdateResume(updated);
      setIsUploading(false);
    };

    reader.readAsDataURL(file);
  };

  // Download Resume Trigger
  const handleDownload = () => {
    Sound.click(soundEnabled);
    if (resume.fileDataUrl) {
      const link = document.createElement('a');
      link.href = resume.fileDataUrl;
      link.download = resume.fileName;
      link.click();
    } else {
      // Generate clean printable markdown/text blob
      const textContent = `# ${resume.fileName}\n\n## Summary\n${resume.summary}\n\n## Experience\n${resume.experiences
        .map((e) => `### ${e.role} at ${e.company} (${e.period})\n${e.details}`)
        .join('\n\n')}\n\n## Skills\n${resume.skills.join(', ')}`;
      const blob = new Blob([textContent], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = resume.fileName.replace('.pdf', '.md');
      link.click();
    }
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2500);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#6366F1]" />
          <h3 className="text-sm font-bold text-[#111827] dark:text-white">
            Resume & CV Document
          </h3>
        </div>
        <button
          type="button"
          onClick={() => {
            Sound.click(soundEnabled);
            fileInputRef.current?.click();
          }}
          className="text-xs text-[#6366F1] dark:text-[#818CF8] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
        >
          <Upload className="w-3 h-3" />
          <span>Upload</span>
        </button>
      </div>

      {/* Medium Size Interactive Resume Preview Box in bottom-left corner */}
      <div className="group relative rounded-2xl border border-[#E5E7EB] dark:border-[#374151] bg-white dark:bg-[#111827] p-4 shadow-2xs hover:border-[#6366F1] dark:hover:border-[#6366F1] transition-all space-y-3">
        {/* Top bar with mini PDF document icon and file info */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-100 dark:border-red-900/50 flex items-center justify-center text-red-600 dark:text-red-400 font-mono text-[10px] font-bold shrink-0">
              PDF
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#111827] dark:text-white truncate">
                {resume.fileName}
              </p>
              <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-2 mt-0.5">
                <span>{resume.fileSize}</span>
                <span>•</span>
                <span>Updated {resume.uploadedAt}</span>
              </p>
            </div>
          </div>

          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 font-bold shrink-0 flex items-center gap-1">
            <FileCheck className="w-2.5 h-2.5" />
            <span>Active</span>
          </span>
        </div>

        {/* Medium Size Preview Paper Graphic */}
        <div
          onClick={() => {
            Sound.click(soundEnabled);
            setShowFullResumeModal(true);
          }}
          className="relative rounded-xl bg-[#F9FAFB] dark:bg-[#1F2937]/70 border border-[#F3F4F6] dark:border-[#374151] p-3 cursor-pointer hover:shadow-inner transition-all space-y-2 overflow-hidden"
        >
          <div className="flex items-center justify-between text-[10px] font-mono text-[#9CA3AF] pb-1 border-b border-[#E5E7EB] dark:border-[#374151]">
            <span className="font-semibold">RESUME OVERVIEW</span>
            <span className="flex items-center gap-1 text-[#6366F1]">
              <Eye className="w-3 h-3" />
              <span>Click to view</span>
            </span>
          </div>

          <p className="text-[11px] text-[#4B5563] dark:text-[#D1D5DB] line-clamp-3 leading-relaxed">
            {resume.summary}
          </p>

          <div className="pt-1 flex flex-wrap gap-1">
            {resume.skills.slice(0, 4).map((s) => (
              <span
                key={s}
                className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#374151] text-[#374151] dark:text-[#E5E7EB]"
              >
                {s}
              </span>
            ))}
            {resume.skills.length > 4 && (
              <span className="text-[9px] text-[#9CA3AF] self-center">
                +{resume.skills.length - 4} more
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              setShowFullResumeModal(true);
            }}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F3F4F6] dark:bg-[#1F2937] hover:bg-[#E5E7EB] dark:hover:bg-[#374151] text-xs font-semibold text-[#111827] dark:text-white transition-all cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Open Preview</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-semibold shadow-2xs transition-all cursor-pointer"
            title="Download resume document"
          >
            {downloadSuccess ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Downloaded!</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Hidden File Input for Resume Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,.md"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Full Resume Inspection Modal */}
      {showFullResumeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] shadow-2xl overflow-hidden animate-in fade-in-50">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#F3F4F6] dark:border-[#1F2937]">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-[#6366F1]" />
                <div>
                  <h3 className="text-base font-bold text-[#111827] dark:text-white">
                    {resume.fileName}
                  </h3>
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                    Official Verified Resume Document • Updated {resume.uploadedAt}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#6366F1] text-white text-xs font-semibold hover:bg-[#4F46E5] cursor-pointer shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowFullResumeModal(false)}
                  className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] cursor-pointer text-sm"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body: Rendered Resume Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-left">
              {/* Professional Summary */}
              <div className="space-y-2">
                <h4 className="text-xs uppercase font-bold text-[#6366F1] tracking-wider">
                  Professional Executive Summary
                </h4>
                <p className="text-xs sm:text-sm text-[#374151] dark:text-[#D1D5DB] leading-relaxed">
                  {resume.summary}
                </p>
              </div>

              {/* Work Experience */}
              <div className="space-y-4">
                <h4 className="text-xs uppercase font-bold text-[#6366F1] tracking-wider">
                  Work Experience & Track Record
                </h4>
                <div className="space-y-4">
                  {resume.experiences.map((exp, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-[#F9FAFB] dark:bg-[#1F2937]/50 border border-[#E5E7EB] dark:border-[#374151] space-y-1.5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <p className="text-xs sm:text-sm font-bold text-[#111827] dark:text-white">
                          {exp.role}
                        </p>
                        <span className="text-[10px] font-mono text-[#6B7280] dark:text-[#9CA3AF] bg-white dark:bg-[#111827] px-2 py-0.5 rounded border border-[#E5E7EB] dark:border-[#374151] w-fit">
                          {exp.period}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-[#6366F1] dark:text-[#818CF8]">
                        {exp.company}
                      </p>
                      <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] leading-relaxed pt-1">
                        {exp.details}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Education */}
              <div className="space-y-2">
                <h4 className="text-xs uppercase font-bold text-[#6366F1] tracking-wider">
                  Education & Credentials
                </h4>
                <div className="space-y-2">
                  {resume.education.map((edu, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-xl bg-[#F9FAFB] dark:bg-[#1F2937]/50 border border-[#E5E7EB] dark:border-[#374151]"
                    >
                      <div>
                        <p className="text-xs font-bold text-[#111827] dark:text-white">
                          {edu.degree}
                        </p>
                        <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                          {edu.school}
                        </p>
                      </div>
                      <span className="text-xs font-mono text-[#9CA3AF]">
                        {edu.year}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Core Skill Capabilities */}
              <div className="space-y-2">
                <h4 className="text-xs uppercase font-bold text-[#6366F1] tracking-wider">
                  Core Skills & Capabilities
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {resume.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[#EEF2FF] dark:bg-[#1E1B4B] text-[#6366F1] dark:text-[#818CF8] border border-[#6366F1]/20"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 border-t border-[#F3F4F6] dark:border-[#1F2937] bg-[#F9FAFB] dark:bg-[#1F2937]/60">
              <button
                type="button"
                onClick={() => {
                  fileInputRef.current?.click();
                }}
                className="flex items-center gap-1.5 text-xs text-[#6366F1] dark:text-[#818CF8] hover:underline font-semibold cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload New / Replace Resume</span>
              </button>

              <button
                type="button"
                onClick={() => setShowFullResumeModal(false)}
                className="px-4 py-1.5 rounded-lg bg-[#F3F4F6] dark:bg-[#1F2937] hover:bg-[#E5E7EB] text-xs font-semibold text-[#111827] dark:text-white cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
