import React from 'react';
import { Compass, Milestone, Calendar, Sparkles, CheckCircle2, Clock } from 'lucide-react';
import { LifeMilestone, UserProfile } from '../../../../types';

export interface AndroidLifeMapScreenProps {
  milestones?: LifeMilestone[];
  profile?: UserProfile;
}

export const AndroidLifeMapScreen: React.FC<AndroidLifeMapScreenProps> = ({
  milestones = [],
  profile,
}) => {
  const sortedMilestones = [...milestones].sort((a, b) => b.year - a.year);

  return (
    <div className="w-full max-w-lg mx-auto px-3.5 pb-24 pt-2 space-y-3.5">
      {/* Banner */}
      <div className="px-1">
        <h2 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Life Map & Milestones
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Chronicle of life events, career highlights, and major goals
        </p>
      </div>

      {/* Timeline List */}
      <div className="space-y-3">
        {sortedMilestones.length === 0 ? (
          <div className="p-8 text-center rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40]">
            <Compass className="w-10 h-10 text-violet-400 mx-auto mb-2 opacity-60" />
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
              No milestones recorded
            </p>
          </div>
        ) : (
          sortedMilestones.map((m) => (
            <div
              key={m.id}
              className="p-4 rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-2xs space-y-2 select-none"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{m.icon || '📍'}</span>
                  <div>
                    <h3 className="text-xs font-bold text-gray-900 dark:text-white">
                      {m.title}
                    </h3>
                    <span className="text-[10px] text-gray-500 font-mono">
                      {m.year} · {m.dateStr}
                    </span>
                  </div>
                </div>

                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300">
                  {m.category}
                </span>
              </div>

              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                {m.description}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
