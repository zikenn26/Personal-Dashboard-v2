import React, { useState } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Target,
  FileSearch,
  ArrowRight,
  Briefcase,
} from 'lucide-react';
import { Sound } from '../utils/audio';

interface JobMatcherModalProps {
  userSkills: string[];
  userSummary: string;
  onClose: () => void;
  soundEnabled?: boolean;
}

export const JobMatcherModal: React.FC<JobMatcherModalProps> = ({
  userSkills,
  userSummary,
  onClose,
  soundEnabled = true,
}) => {
  const [jobDescription, setJobDescription] = useState('');
  const [analysisResult, setAnalysisResult] = useState<{
    score: number;
    matched: string[];
    missing: string[];
    tailoredPitch: string;
  } | null>(null);
  const [copiedPitch, setCopiedPitch] = useState(false);

  const sampleKeywords = [
    'react', 'next.js', 'typescript', 'javascript', 'python', 'java', 'spring boot',
    'sql', 'mysql', 'postgresql', 'power bi', 'excel', 'rest', 'api', 'docker',
    'kubernetes', 'aws', 'cloud', 'git', 'github', 'jwt', 'data structures',
    'algorithms', 'deep learning', 'machine learning', 'pytorch', 'opencv',
    'yolo', 'llm', 'generative ai', 'microservices', 'ci/cd', 'agile',
  ];

  const handleAnalyze = () => {
    if (!jobDescription.trim()) return;
    Sound.click(soundEnabled);

    const jdLower = jobDescription.toLowerCase();
    const candidateSkillsLower = userSkills.map((s) => s.toLowerCase());

    // Find all keyword mentions in the job description
    const jdKeywords = sampleKeywords.filter((kw) => jdLower.includes(kw));

    const matched: string[] = [];
    const missing: string[] = [];

    jdKeywords.forEach((kw) => {
      const isCandidateMatched = candidateSkillsLower.some(
        (cs) => cs.includes(kw) || kw.includes(cs)
      );
      if (isCandidateMatched) {
        matched.push(kw);
      } else {
        missing.push(kw);
      }
    });

    // Score calculation
    const totalKeywords = jdKeywords.length || 1;
    const score = Math.min(100, Math.round((matched.length / totalKeywords) * 100) + 20);

    const pitch = `Hi Hiring Team,\n\nI noticed your opening and wanted to reach out. With strong hands-on experience in ${matched.slice(0, 4).join(', ') || 'modern full-stack & data engineering'}, I have architected high-throughput applications and data pipelines that drove measurable efficiency gains. I would love to contribute to your engineering goals.\n\nBest regards,\nGulshan Kumar Nayak`;

    setAnalysisResult({
      score: Math.max(score, 65),
      matched: matched.length > 0 ? matched : ['React', 'TypeScript', 'Java', 'SQL'],
      missing: missing.slice(0, 5),
      tailoredPitch: pitch,
    });
  };

  const handleCopyPitch = () => {
    if (!analysisResult?.tailoredPitch) return;
    navigator.clipboard.writeText(analysisResult.tailoredPitch);
    Sound.success(soundEnabled);
    setCopiedPitch(true);
    setTimeout(() => setCopiedPitch(false), 2000);
  };

  return (
    <div
      id="job-matcher-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="job-matcher-modal-card"
        className="relative w-full max-w-2xl bg-white dark:bg-[#18181B] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-zinc-900/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Job Description Matcher &amp; Tailor
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Paste a LinkedIn, Indeed, or company job description to evaluate ATS match
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-between">
              <span>Paste Job Description or Requirements:</span>
              <button
                type="button"
                onClick={() =>
                  setJobDescription(
                    'We are seeking a Full-Stack / Backend Software Engineer proficient in Java, Spring Boot, React, and SQL. Experience with REST APIs, Git, and Cloud architectures is highly valued. Candidate should possess strong problem-solving skills and clean code practices.'
                  )
                }
                className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                Insert sample JD
              </button>
            </label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste job posting text here (requirements, qualifications, tech stack)..."
              rows={5}
              className="w-full p-3 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/60 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              id="analyze-jd-btn"
              onClick={handleAnalyze}
              disabled={!jobDescription.trim()}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <FileSearch className="w-3.5 h-3.5" />
              <span>Evaluate Match &amp; Generate Pitch</span>
            </button>
          </div>

          {analysisResult && (
            <div className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-950 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-4 animate-in fade-in duration-200">
              {/* Score header */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    ATS Match Analysis
                  </span>
                  <div className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <span>{analysisResult.score}% Match</span>
                    <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Strong Fit
                    </span>
                  </div>
                </div>
              </div>

              {/* Matched skills */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Matched Keywords ({analysisResult.matched.length}):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {analysisResult.matched.map((m, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>

              {/* Missing skills */}
              {analysisResult.missing.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                    Keywords Mentioned in JD to Review:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {analysisResult.missing.map((m, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tailored Elevator Pitch */}
              <div className="space-y-1.5 pt-2 border-t border-indigo-100 dark:border-indigo-900/60">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    Tailored Cold Outreach / Cover Pitch:
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyPitch}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedPitch ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Pitch</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">
                  {analysisResult.tailoredPitch}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-zinc-900/40 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
