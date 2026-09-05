import React, { useState } from 'react';
import {
  Briefcase,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Building,
  MapPin,
  CheckCircle2,
  X,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { JobExperience } from '../types';
import { Sound } from '../utils/audio';

interface JobExperienceSectionProps {
  jobExperiences: JobExperience[];
  onUpdateJobs: (jobs: JobExperience[]) => void;
  soundEnabled: boolean;
}

export const JobExperienceSection: React.FC<JobExperienceSectionProps> = ({
  jobExperiences,
  onUpdateJobs,
  soundEnabled,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingJob, setEditingJob] = useState<JobExperience | null>(null);

  // Form state
  const [formRole, setFormRole] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formType, setFormType] = useState<'Full-time' | 'Part-time' | 'Contract' | 'Freelance' | 'Internship'>('Full-time');
  const [formLocation, setFormLocation] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('Present');
  const [formIsCurrent, setFormIsCurrent] = useState(true);
  const [formDescription, setFormDescription] = useState('');
  const [formAchievements, setFormAchievements] = useState('');
  const [formTechStack, setFormTechStack] = useState('');

  const openAddModal = () => {
    Sound.click(soundEnabled);
    setEditingJob(null);
    setFormRole('');
    setFormCompany('');
    setFormType('Full-time');
    setFormLocation('India • Hybrid');
    setFormStartDate('');
    setFormEndDate('Present');
    setFormIsCurrent(true);
    setFormDescription('');
    setFormAchievements('');
    setFormTechStack('');
    setShowModal(true);
  };

  const openEditModal = (job: JobExperience) => {
    Sound.click(soundEnabled);
    setEditingJob(job);
    setFormRole(job.role);
    setFormCompany(job.company);
    setFormType(job.employmentType || 'Full-time');
    setFormLocation(job.location || '');
    setFormStartDate(job.startDate);
    setFormEndDate(job.endDate || 'Present');
    setFormIsCurrent(job.isCurrent ?? (job.endDate === 'Present'));
    setFormDescription(job.description);
    setFormAchievements(job.keyAchievements ? job.keyAchievements.join('\n') : '');
    setFormTechStack(job.techStack ? job.techStack.join(', ') : '');
    setShowModal(true);
  };

  const handleDeleteJob = (id: string) => {
    Sound.click(soundEnabled);
    const updated = jobExperiences.filter((j) => j.id !== id);
    onUpdateJobs(updated);
  };

  const handleSaveJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRole.trim() || !formCompany.trim()) return;

    Sound.success(soundEnabled);

    const achievementsList = formAchievements
      .split('\n')
      .map((a) => a.trim())
      .filter(Boolean);

    const techList = formTechStack
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (editingJob) {
      const updated = jobExperiences.map((j) =>
        j.id === editingJob.id
          ? {
              ...j,
              role: formRole.trim(),
              company: formCompany.trim(),
              employmentType: formType,
              location: formLocation.trim() || undefined,
              startDate: formStartDate.trim(),
              endDate: formIsCurrent ? 'Present' : formEndDate.trim(),
              isCurrent: formIsCurrent,
              description: formDescription.trim(),
              keyAchievements: achievementsList.length > 0 ? achievementsList : undefined,
              techStack: techList.length > 0 ? techList : undefined,
            }
          : j
      );
      onUpdateJobs(updated);
    } else {
      const newJob: JobExperience = {
        id: `job-${Date.now()}`,
        role: formRole.trim(),
        company: formCompany.trim(),
        employmentType: formType,
        location: formLocation.trim() || undefined,
        startDate: formStartDate.trim(),
        endDate: formIsCurrent ? 'Present' : formEndDate.trim(),
        isCurrent: formIsCurrent,
        description: formDescription.trim(),
        keyAchievements: achievementsList.length > 0 ? achievementsList : undefined,
        techStack: techList.length > 0 ? techList : undefined,
      };
      onUpdateJobs([newJob, ...jobExperiences]);
    }

    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EDECE9] dark:border-[#1F2937]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="workspace-heading font-black text-[#111827] dark:text-white flex items-center gap-2.5">
              <Briefcase className="w-6 h-6 text-[#6366F1]" />
              <span>Career &amp; Professional Experience</span>
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-[#EEF2FF] dark:bg-[#312E81] text-[#6366F1] dark:text-[#A5B4FC] text-xs font-bold uppercase tracking-wider">
              {jobExperiences.length} Roles
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#6B7280] dark:text-[#9CA3AF] mt-1">
            Work history, full-time engineering roles, internships, impact highlights, and tech stacks.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="px-3.5 py-2 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Experience</span>
        </button>
      </div>

      {/* Main Job Cards List */}
      {jobExperiences.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-dashed border-[#E2E8F0] dark:border-[#334155] space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-[#6366F1] flex items-center justify-center mx-auto text-2xl">
            💼
          </div>
          <h3 className="text-base font-bold text-[#111827] dark:text-white">
            No Work Experiences Added Yet
          </h3>
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] max-w-md mx-auto">
            Add your current and past jobs, internships, and engineering roles with achievements and technologies.
          </p>
          <button
            type="button"
            onClick={openAddModal}
            className="px-4 py-2 rounded-xl bg-[#6366F1] text-white text-xs font-bold hover:bg-[#4F46E5] cursor-pointer"
          >
            + Add First Job Experience
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {jobExperiences.map((job) => (
            <div
              key={job.id}
              className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] shadow-2xs hover:border-[#6366F1] dark:hover:border-[#6366F1] transition-all group"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  {/* Top Bar: Company, Employment Type, Timeline */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-[#6366F1] dark:text-[#818CF8] flex items-center gap-1">
                      <Building className="w-3.5 h-3.5" />
                      <span>{job.company}</span>
                    </span>

                    {job.employmentType && (
                      <span className="px-2 py-0.5 rounded-md bg-[#F1F5F9] dark:bg-[#0F172A] text-[#475569] dark:text-[#94A3B8] text-[11px] font-semibold">
                        {job.employmentType}
                      </span>
                    )}

                    <span className="text-[#9CA3AF]">•</span>

                    <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-medium flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{job.startDate} – {job.endDate || 'Present'}</span>
                    </span>

                    {job.isCurrent && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
                        Current Role
                      </span>
                    )}

                    {job.location && (
                      <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#9CA3AF]" />
                        <span>{job.location}</span>
                      </span>
                    )}
                  </div>

                  {/* Job Role Title */}
                  <h3 className="text-base sm:text-lg font-black text-[#111827] dark:text-white group-hover:text-[#6366F1] transition-colors">
                    {job.role}
                  </h3>

                  {/* Description */}
                  {job.description && (
                    <p className="text-xs sm:text-sm text-[#4B5563] dark:text-[#D1D5DB] leading-relaxed">
                      {job.description}
                    </p>
                  )}

                  {/* Key Achievements Bullet points */}
                  {job.keyAchievements && job.keyAchievements.length > 0 && (
                    <div className="pt-2 space-y-1.5">
                      <p className="text-[11px] font-bold text-[#374151] dark:text-[#E5E7EB] uppercase tracking-wider">
                        Key Achievements &amp; Impact:
                      </p>
                      {job.keyAchievements.map((ach, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2 text-xs text-[#4B5563] dark:text-[#9CA3AF]"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span className="leading-snug">{ach}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tech Stack Pills */}
                  {job.techStack && job.techStack.length > 0 && (
                    <div className="pt-3 flex flex-wrap items-center gap-1.5">
                      {job.techStack.map((tech, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-lg bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] text-[11px] font-mono text-[#334155] dark:text-[#CBD5E1]"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Edit & Delete Action Buttons */}
                <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => openEditModal(job)}
                    className="p-2 rounded-xl text-[#6B7280] hover:text-[#6366F1] hover:bg-[#EEF2FF] dark:hover:bg-[#1E1B4B] transition-all cursor-pointer"
                    title="Edit Role"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteJob(job.id)}
                    className="p-2 rounded-xl text-[#6B7280] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 transition-all cursor-pointer"
                    title="Delete Role"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Experience Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9] dark:border-[#334155]">
              <h3 className="text-base font-black text-[#111827] dark:text-white flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-[#6366F1]" />
                <span>{editingJob ? 'Edit Career Role' : 'Add Professional Experience'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveJob} className="space-y-4">
              {/* Job Title & Company */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#374151] dark:text-[#D1D5DB] mb-1">
                    Job Title / Role *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Software Engineer"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs text-[#111827] dark:text-white focus:outline-hidden focus:border-[#6366F1]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#374151] dark:text-[#D1D5DB] mb-1">
                    Company / Organization *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HCL Software"
                    value={formCompany}
                    onChange={(e) => setFormCompany(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs text-[#111827] dark:text-white focus:outline-hidden focus:border-[#6366F1]"
                  />
                </div>
              </div>

              {/* Employment Type & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#374151] dark:text-[#D1D5DB] mb-1">
                    Employment Type
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs text-[#111827] dark:text-white focus:outline-hidden"
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Freelance">Freelance</option>
                    <option value="Internship">Internship</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#374151] dark:text-[#D1D5DB] mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Noida, India • Hybrid"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs text-[#111827] dark:text-white focus:outline-hidden focus:border-[#6366F1]"
                  />
                </div>
              </div>

              {/* Dates & Currently Working */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#374151] dark:text-[#D1D5DB] mb-1">
                    Start Date *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jul 2022"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs text-[#111827] dark:text-white focus:outline-hidden focus:border-[#6366F1]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#374151] dark:text-[#D1D5DB] mb-1">
                    End Date
                  </label>
                  <input
                    type="text"
                    disabled={formIsCurrent}
                    placeholder={formIsCurrent ? 'Present' : 'e.g. Dec 2023'}
                    value={formIsCurrent ? 'Present' : formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs text-[#111827] dark:text-white focus:outline-hidden focus:border-[#6366F1] disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isCurrentRole"
                  checked={formIsCurrent}
                  onChange={(e) => setFormIsCurrent(e.target.checked)}
                  className="rounded text-[#6366F1] focus:ring-[#6366F1]"
                />
                <label htmlFor="isCurrentRole" className="text-xs font-semibold text-[#374151] dark:text-[#D1D5DB] cursor-pointer">
                  I currently work here
                </label>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-[#374151] dark:text-[#D1D5DB] mb-1">
                  Role Summary &amp; Overview
                </label>
                <textarea
                  rows={2}
                  placeholder="Architecting web applications and modern enterprise systems..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs text-[#111827] dark:text-white focus:outline-hidden focus:border-[#6366F1]"
                />
              </div>

              {/* Key Achievements */}
              <div>
                <label className="block text-xs font-bold text-[#374151] dark:text-[#D1D5DB] mb-1">
                  Key Achievements / Impact (1 per line)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Engineered high-performance React applications&#10;Reduced client bundle size by 35%&#10;Mentored 4 junior engineers"
                  value={formAchievements}
                  onChange={(e) => setFormAchievements(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs text-[#111827] dark:text-white focus:outline-hidden focus:border-[#6366F1]"
                />
              </div>

              {/* Tech Stack */}
              <div>
                <label className="block text-xs font-bold text-[#374151] dark:text-[#D1D5DB] mb-1">
                  Technologies / Tools Used (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. React, TypeScript, Tailwind CSS, Node.js, Docker, Git"
                  value={formTechStack}
                  onChange={(e) => setFormTechStack(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs text-[#111827] dark:text-white focus:outline-hidden focus:border-[#6366F1]"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F1F5F9] dark:border-[#334155]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#6B7280] dark:text-[#9CA3AF] hover:bg-gray-100 dark:hover:bg-gray-800 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-bold shadow-md transition-all cursor-pointer"
                >
                  {editingJob ? 'Save Changes' : 'Add Experience'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
