import React, { useState } from 'react';
import { Briefcase, ExternalLink, Github, MapPin, Mail, Sparkles, Award, Code2, FileDown } from 'lucide-react';
import { UserProfile, PortfolioProject, SkillCategory, ResumeDocument } from '../../../../types';
import { nativeService } from '../../../../services/nativeService';

export interface AndroidPortfolioScreenProps {
  profile: UserProfile;
  projects: PortfolioProject[];
  skills: SkillCategory[];
  resume?: ResumeDocument;
}

export const AndroidPortfolioScreen: React.FC<AndroidPortfolioScreenProps> = ({
  profile,
  projects,
  skills,
  resume,
}) => {
  const [selectedTab, setSelectedTab] = useState<'projects' | 'skills' | 'resume'>('projects');

  return (
    <div className="w-full max-w-lg mx-auto px-3.5 pb-24 pt-2 space-y-3.5">
      {/* Profile Header Card */}
      <div className="p-4 rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-2xs space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-violet-500/50 shrink-0 bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-lg">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.name}
                className="w-full h-full object-cover"
              />
            ) : (
              profile.name.charAt(0)
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-extrabold text-gray-900 dark:text-white truncate">
              {profile.name}
            </h2>
            <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 truncate">
              {profile.title || 'Full Stack Engineer & Builder'}
            </p>
            {profile.location && (
              <div className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                <MapPin className="w-3 h-3" />
                <span>{profile.location}</span>
              </div>
            )}
          </div>
        </div>

        {profile.bio && (
          <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed border-t border-gray-100 dark:border-gray-800 pt-2">
            {profile.bio}
          </p>
        )}
      </div>

      {/* Navigation Subtabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] select-none">
        {(['projects', 'skills', 'resume'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              setSelectedTab(tab);
            }}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
              selectedTab === tab
                ? 'bg-violet-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab 1: Projects */}
      {selectedTab === 'projects' && (
        <div className="space-y-3">
          {projects.length === 0 ? (
            <div className="p-8 text-center rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40]">
              <Briefcase className="w-10 h-10 text-violet-400 mx-auto mb-2 opacity-60" />
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                No projects listed
              </p>
            </div>
          ) : (
            projects.map((proj) => (
              <div
                key={proj.id}
                className="p-4 rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-2xs space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">
                      {proj.title}
                    </h3>
                    {proj.tagLine && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        {proj.tagLine}
                      </p>
                    )}
                  </div>

                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 shrink-0">
                    {proj.category}
                  </span>
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  {proj.description}
                </p>

                {/* Tech tags */}
                {(proj.techStack || proj.tech) && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {(proj.techStack || proj.tech || []).map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 rounded-md text-[10px] bg-gray-100 dark:bg-[#1A2234] text-gray-700 dark:text-gray-300 font-medium"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                {/* External links */}
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  {proj.liveUrl || proj.link ? (
                    <a
                      href={proj.liveUrl || proj.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 rounded-xl bg-violet-600 text-white text-xs font-semibold flex items-center gap-1 hover:bg-violet-700 active:scale-95 transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Live App</span>
                    </a>
                  ) : null}
                  {proj.githubUrl || proj.github ? (
                    <a
                      href={proj.githubUrl || proj.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 rounded-xl bg-gray-100 dark:bg-[#1A2234] text-gray-800 dark:text-gray-200 text-xs font-semibold flex items-center gap-1 hover:bg-gray-200 active:scale-95 transition-all"
                    >
                      <Github className="w-3.5 h-3.5" />
                      <span>Code</span>
                    </a>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Skills */}
      {selectedTab === 'skills' && (
        <div className="space-y-3">
          {skills.map((cat, idx) => (
            <div
              key={idx}
              className="p-4 rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-2xs space-y-2"
            >
              <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                <Code2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                <span>{cat.category}</span>
              </h4>

              <div className="flex flex-wrap gap-1.5">
                {cat.skills.map((s, sIdx) => (
                  <span
                    key={sIdx}
                    className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800"
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Resume */}
      {selectedTab === 'resume' && (
        <div className="space-y-3">
          <div className="p-4 rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-2xs space-y-3 text-center">
            <Award className="w-10 h-10 text-violet-600 dark:text-violet-400 mx-auto" />
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Professional Resume
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {resume?.summary || 'Engineering leadership, frontend architecture, and full-stack software development.'}
            </p>

            {resume?.experiences && resume.experiences.length > 0 && (
              <div className="text-left space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider block">
                  Experience
                </span>
                {resume.experiences.slice(0, 3).map((exp, eIdx) => (
                  <div key={eIdx} className="p-2.5 rounded-2xl bg-gray-50 dark:bg-[#1A2234]">
                    <span className="text-xs font-bold text-gray-900 dark:text-white block">
                      {exp.role} · {exp.company}
                    </span>
                    <span className="text-[10px] text-violet-600 dark:text-violet-400 block">
                      {exp.period}
                    </span>
                    <p className="text-[11px] text-gray-600 dark:text-gray-300 mt-1">
                      {exp.details}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
