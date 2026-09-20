import React, { useState } from 'react';
import {
  UserProfile,
  PortfolioProject,
  SkillCategory,
  EducationRecord,
  JobExperience,
  CertificationItem,
  PublicationItem,
  AchievementItem,
  ResumeSectionConfig,
} from '../types';
import { DEFAULT_RESUME_SECTION_CONFIG } from '../utils/storage';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Check,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  User,
  FileText,
  Briefcase,
  GraduationCap,
  Layers,
  Award,
  BookOpen,
  FolderGit2,
  Sliders,
  Star,
} from 'lucide-react';
import { Sound } from '../utils/audio';

interface EditProfileModalProps {
  isOpen: boolean;
  initialTab?: string;
  profile: UserProfile;
  projects: PortfolioProject[];
  skills: SkillCategory[];
  soundEnabled: boolean;
  onClose: () => void;
  onSave: (
    updatedProfile: UserProfile,
    updatedProjects: PortfolioProject[],
    updatedSkills: SkillCategory[]
  ) => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  initialTab = 'basic',
  profile,
  projects,
  skills,
  soundEnabled,
  onClose,
  onSave,
}) => {
  if (!isOpen) return null;

  // Active section tab
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  // Form states cloned from props
  const [formData, setFormData] = useState<UserProfile>({
    ...profile,
    educationRecords: profile.educationRecords ? [...profile.educationRecords] : [],
    jobExperiences: profile.jobExperiences ? [...profile.jobExperiences] : [],
    certifications: profile.certifications ? [...profile.certifications] : [],
    publications: profile.publications ? [...profile.publications] : [],
    achievementsList: profile.achievementsList ? [...profile.achievementsList] : [],
    resumeSectionConfig:
      profile.resumeSectionConfig && profile.resumeSectionConfig.length > 0
        ? [...profile.resumeSectionConfig]
        : [...DEFAULT_RESUME_SECTION_CONFIG],
  });

  const [formProjects, setFormProjects] = useState<PortfolioProject[]>([...projects]);
  const [formSkills, setFormSkills] = useState<SkillCategory[]>([...skills]);

  // Sub-item edit/add states
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [jobForm, setJobForm] = useState<Partial<JobExperience>>({});

  const [editingProjId, setEditingProjId] = useState<string | null>(null);
  const [projForm, setProjForm] = useState<Partial<PortfolioProject>>({});

  const [editingEduId, setEditingEduId] = useState<string | null>(null);
  const [eduForm, setEduForm] = useState<Partial<EducationRecord>>({});

  const [editingCertId, setEditingCertId] = useState<string | null>(null);
  const [certForm, setCertForm] = useState<Partial<CertificationItem>>({});

  const [editingPubId, setEditingPubId] = useState<string | null>(null);
  const [pubForm, setPubForm] = useState<Partial<PublicationItem>>({});

  const [editingAchId, setEditingAchId] = useState<string | null>(null);
  const [achForm, setAchForm] = useState<Partial<AchievementItem>>({});

  const [newSkillText, setNewSkillText] = useState<{ [categoryIdx: number]: string }>({});
  const [newCategoryName, setNewCategoryName] = useState('');

  // Save handler
  const handleSaveAll = () => {
    Sound.success(soundEnabled);
    onSave(formData, formProjects, formSkills);
    onClose();
  };

  // Section visibility & reordering handlers
  const handleToggleSectionVisibility = (id: string) => {
    Sound.click(soundEnabled);
    const updated = (formData.resumeSectionConfig || DEFAULT_RESUME_SECTION_CONFIG).map((s) =>
      s.id === id ? { ...s, visible: !s.visible } : s
    );
    setFormData({ ...formData, resumeSectionConfig: updated });
  };

  const handleMoveSection = (id: string, direction: 'up' | 'down') => {
    Sound.click(soundEnabled);
    const list = [...(formData.resumeSectionConfig || DEFAULT_RESUME_SECTION_CONFIG)].sort(
      (a, b) => a.order - b.order
    );
    const idx = list.findIndex((s) => s.id === id);
    if (idx === -1) return;
    if (direction === 'up' && idx > 0) {
      const temp = list[idx].order;
      list[idx].order = list[idx - 1].order;
      list[idx - 1].order = temp;
    } else if (direction === 'down' && idx < list.length - 1) {
      const temp = list[idx].order;
      list[idx].order = list[idx + 1].order;
      list[idx + 1].order = temp;
    }
    setFormData({ ...formData, resumeSectionConfig: list });
  };

  // JOB EXPERIENCE CRUD
  const handleSaveJob = () => {
    if (!jobForm.role || !jobForm.company) return;
    const currentJobs = formData.jobExperiences || [];
    if (editingJobId === 'new') {
      const newJob: JobExperience = {
        id: `job-${Date.now()}`,
        role: jobForm.role || '',
        company: jobForm.company || '',
        startDate: jobForm.startDate || '2023',
        endDate: jobForm.endDate || 'Present',
        location: jobForm.location || '',
        description: jobForm.description || '',
        keyAchievements: jobForm.keyAchievements || [],
        techStack: jobForm.techStack || [],
      };
      setFormData({ ...formData, jobExperiences: [newJob, ...currentJobs] });
    } else {
      const updated = currentJobs.map((j) => (j.id === editingJobId ? ({ ...j, ...jobForm } as JobExperience) : j));
      setFormData({ ...formData, jobExperiences: updated });
    }
    setEditingJobId(null);
    setJobForm({});
    Sound.click(soundEnabled);
  };

  const handleDeleteJob = (id: string) => {
    Sound.click(soundEnabled);
    setFormData({
      ...formData,
      jobExperiences: (formData.jobExperiences || []).filter((j) => j.id !== id),
    });
  };

  // PROJECT CRUD
  const handleSaveProject = () => {
    if (!projForm.title) return;
    if (editingProjId === 'new') {
      const newP: PortfolioProject = {
        id: `proj-${Date.now()}`,
        title: projForm.title || '',
        tagLine: projForm.tagLine || '',
        description: projForm.description || '',
        category: projForm.category || 'Fullstack',
        techStack: projForm.techStack || [],
        keyResult: projForm.keyResult || '',
        githubUrl: projForm.githubUrl || '',
        liveUrl: projForm.liveUrl || '',
        featured: projForm.featured !== undefined ? projForm.featured : true,
      };
      setFormProjects([newP, ...formProjects]);
    } else {
      const updated = formProjects.map((p) =>
        p.id === editingProjId ? ({ ...p, ...projForm } as PortfolioProject) : p
      );
      setFormProjects(updated);
    }
    setEditingProjId(null);
    setProjForm({});
    Sound.click(soundEnabled);
  };

  const handleDeleteProject = (id: string) => {
    Sound.click(soundEnabled);
    setFormProjects(formProjects.filter((p) => p.id !== id));
  };

  // EDUCATION CRUD
  const handleSaveEdu = () => {
    if (!eduForm.degree || !eduForm.institution) return;
    const currentEdu = formData.educationRecords || [];
    if (editingEduId === 'new') {
      const newE: EducationRecord = {
        id: `edu-${Date.now()}`,
        degree: eduForm.degree || '',
        institution: eduForm.institution || '',
        year: eduForm.year || '',
        score: eduForm.score || '',
        specialization: eduForm.specialization || '',
        highlights: eduForm.highlights || [],
        level: 'graduation',
      };
      setFormData({ ...formData, educationRecords: [...currentEdu, newE] });
    } else {
      const updated = currentEdu.map((e) =>
        e.id === editingEduId ? ({ ...e, ...eduForm } as EducationRecord) : e
      );
      setFormData({ ...formData, educationRecords: updated });
    }
    setEditingEduId(null);
    setEduForm({});
    Sound.click(soundEnabled);
  };

  const handleDeleteEdu = (id: string) => {
    Sound.click(soundEnabled);
    setFormData({
      ...formData,
      educationRecords: (formData.educationRecords || []).filter((e) => e.id !== id),
    });
  };

  // CERTIFICATION CRUD
  const handleSaveCert = () => {
    if (!certForm.name) return;
    const current = (formData.certifications || []) as CertificationItem[];
    if (editingCertId === 'new') {
      const newC: CertificationItem = {
        id: `cert-${Date.now()}`,
        name: certForm.name || '',
        issuer: certForm.issuer || '',
        year: certForm.year || '',
        link: certForm.link || '',
      };
      setFormData({ ...formData, certifications: [...current, newC] });
    } else {
      const updated = current.map((c) =>
        c.id === editingCertId ? ({ ...c, ...certForm } as CertificationItem) : c
      );
      setFormData({ ...formData, certifications: updated });
    }
    setEditingCertId(null);
    setCertForm({});
    Sound.click(soundEnabled);
  };

  const handleDeleteCert = (id: string) => {
    Sound.click(soundEnabled);
    setFormData({
      ...formData,
      certifications: ((formData.certifications || []) as CertificationItem[]).filter(
        (c) => c.id !== id
      ),
    });
  };

  // PUBLICATION CRUD
  const handleSavePub = () => {
    if (!pubForm.title) return;
    const current = formData.publications || [];
    if (editingPubId === 'new') {
      const newP: PublicationItem = {
        id: `pub-${Date.now()}`,
        title: pubForm.title || '',
        publisher: pubForm.publisher || '',
        year: pubForm.year || '',
        link: pubForm.link || '',
        description: pubForm.description || '',
      };
      setFormData({ ...formData, publications: [...current, newP] });
    } else {
      const updated = current.map((p) =>
        p.id === editingPubId ? ({ ...p, ...pubForm } as PublicationItem) : p
      );
      setFormData({ ...formData, publications: updated });
    }
    setEditingPubId(null);
    setPubForm({});
    Sound.click(soundEnabled);
  };

  const handleDeletePub = (id: string) => {
    Sound.click(soundEnabled);
    setFormData({
      ...formData,
      publications: (formData.publications || []).filter((p) => p.id !== id),
    });
  };

  // ACHIEVEMENTS CRUD
  const handleSaveAch = () => {
    if (!achForm.title) return;
    const current = formData.achievementsList || [];
    if (editingAchId === 'new') {
      const newA: AchievementItem = {
        id: `ach-${Date.now()}`,
        title: achForm.title || '',
        issuer: achForm.issuer || '',
        date: achForm.date || '',
        description: achForm.description || '',
        category: 'Award',
      };
      setFormData({ ...formData, achievementsList: [...current, newA] });
    } else {
      const updated = current.map((a) =>
        a.id === editingAchId ? ({ ...a, ...achForm } as AchievementItem) : a
      );
      setFormData({ ...formData, achievementsList: updated });
    }
    setEditingAchId(null);
    setAchForm({});
    Sound.click(soundEnabled);
  };

  const handleDeleteAch = (id: string) => {
    Sound.click(soundEnabled);
    setFormData({
      ...formData,
      achievementsList: (formData.achievementsList || []).filter((a) => a.id !== id),
    });
  };

  // SKILLS CRUD
  const handleAddSkillToCat = (catIdx: number) => {
    const text = (newSkillText[catIdx] || '').trim();
    if (!text) return;
    const updated = [...formSkills];
    updated[catIdx] = {
      ...updated[catIdx],
      skills: [...updated[catIdx].skills, { id: `sk-${Date.now()}`, name: text, proficiency: 85 }],
    };
    setFormSkills(updated);
    setNewSkillText({ ...newSkillText, [catIdx]: '' });
    Sound.click(soundEnabled);
  };

  const handleRemoveSkillFromCat = (catIdx: number, skillIdx: number) => {
    Sound.click(soundEnabled);
    const updated = [...formSkills];
    const sk = [...updated[catIdx].skills];
    sk.splice(skillIdx, 1);
    updated[catIdx] = { ...updated[catIdx], skills: sk };
    setFormSkills(updated);
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    Sound.click(soundEnabled);
    setFormSkills([
      ...formSkills,
      { category: newCategoryName.trim(), icon: 'Code', skills: [] },
    ]);
    setNewCategoryName('');
  };

  const handleDeleteCategory = (idx: number) => {
    Sound.click(soundEnabled);
    const updated = [...formSkills];
    updated.splice(idx, 1);
    setFormSkills(updated);
  };

  // Navigation Items
  const navTabs = [
    { id: 'basic', label: 'Basic Info & Links', icon: User },
    { id: 'summary', label: 'Professional Summary', icon: FileText },
    { id: 'experience', label: `Experience (${formData.jobExperiences?.length || 0})`, icon: Briefcase },
    { id: 'projects', label: `Projects (${formProjects.length})`, icon: FolderGit2 },
    { id: 'skills', label: 'Technical Skills', icon: Layers },
    { id: 'education', label: `Education (${formData.educationRecords?.length || 0})`, icon: GraduationCap },
    { id: 'certifications', label: `Certifications (${formData.certifications?.length || 0})`, icon: Award },
    { id: 'publications', label: `Publications (${formData.publications?.length || 0})`, icon: BookOpen },
    { id: 'achievements', label: `Achievements (${formData.achievementsList?.length || 0})`, icon: Award },
    { id: 'sections', label: 'Sections & Order', icon: Sliders },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-[#18181B] rounded-2xl shadow-xl border border-gray-200 dark:border-zinc-800 flex flex-col overflow-hidden text-gray-900 dark:text-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-zinc-800">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Edit Professional Profile
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              One central profile power both your ATS Resume and Web Portfolio.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Split into Tabs Sidebar + Form Content */}
        <div className="flex-1 flex flex-col sm:flex-row overflow-hidden min-h-[420px]">
          {/* Sidebar Tabs */}
          <div className="sm:w-56 p-2 border-b sm:border-b-0 sm:border-r border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 overflow-x-auto sm:overflow-y-auto flex sm:flex-col gap-1 shrink-0">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    Sound.click(soundEnabled);
                    setActiveTab(tab.id);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200/60 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Form Content Area */}
          <div className="flex-1 p-5 sm:p-6 overflow-y-auto">
            {/* 1. BASIC INFO & CONTACT LINKS */}
            {activeTab === 'basic' && (
              <div className="space-y-4 max-w-xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      placeholder="e.g. Gulshan Kumar Nayak"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Professional Title *
                    </label>
                    <input
                      type="text"
                      value={formData.title || ''}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      placeholder="e.g. Software Engineer • Backend & Full Stack"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Tagline / Subtitle
                  </label>
                  <input
                    type="text"
                    value={formData.caption || ''}
                    onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    placeholder="Short punchy statement for hero"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      value={formData.contactEmail || ''}
                      onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Location
                    </label>
                    <input
                      type="text"
                      value={formData.location || ''}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      placeholder="City, State, Country"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Availability Status
                    </label>
                    <input
                      type="text"
                      value={formData.statusText || ''}
                      onChange={(e) => setFormData({ ...formData, statusText: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      placeholder="e.g. Open for Engineering Roles"
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-zinc-800">
                  <div className="text-xs font-bold text-gray-900 dark:text-white">
                    Social &amp; Professional Links
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">
                        LinkedIn URL
                      </label>
                      <input
                        type="text"
                        value={formData.linkedin || ''}
                        onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                        className="w-full text-xs px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white"
                        placeholder="https://linkedin.com/in/..."
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">
                        GitHub URL
                      </label>
                      <input
                        type="text"
                        value={formData.github || ''}
                        onChange={(e) => setFormData({ ...formData, github: e.target.value })}
                        className="w-full text-xs px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white"
                        placeholder="https://github.com/..."
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">
                        Portfolio / Website
                      </label>
                      <input
                        type="text"
                        value={formData.website || ''}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        className="w-full text-xs px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white"
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. PROFESSIONAL SUMMARY */}
            {activeTab === 'summary' && (
              <div className="space-y-4 max-w-xl">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Professional Summary &amp; Bio
                  </label>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">
                    Used for both the ATS Resume top summary and the Portfolio About section. Keep it concise, highlighting core expertise, metrics, and technical competencies.
                  </p>
                  <textarea
                    rows={7}
                    value={formData.professionalSummary || formData.bio || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        professionalSummary: e.target.value,
                        bio: e.target.value,
                      })
                    }
                    className="w-full text-xs px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 leading-relaxed"
                    placeholder="Describe your background, years of experience, core stacks, and career achievements..."
                  />
                </div>
              </div>
            )}

            {/* 3. EXPERIENCE */}
            {activeTab === 'experience' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                    Work Experience
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      Sound.click(soundEnabled);
                      setEditingJobId('new');
                      setJobForm({
                        role: '',
                        company: '',
                        startDate: '',
                        endDate: '',
                        location: '',
                        description: '',
                        keyAchievements: [],
                        techStack: [],
                      });
                    }}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Role</span>
                  </button>
                </div>

                {/* Sub-form when editing/adding */}
                {editingJobId && (
                  <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 space-y-3">
                    <div className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                      {editingJobId === 'new' ? 'New Work Experience' : 'Edit Role'}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">
                          Role / Title *
                        </label>
                        <input
                          type="text"
                          value={jobForm.role || ''}
                          onChange={(e) => setJobForm({ ...jobForm, role: e.target.value })}
                          className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                          placeholder="e.g. Software Engineer"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">
                          Company / Organization *
                        </label>
                        <input
                          type="text"
                          value={jobForm.company || ''}
                          onChange={(e) => setJobForm({ ...jobForm, company: e.target.value })}
                          className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                          placeholder="e.g. Tech Corp"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">
                          Start Date
                        </label>
                        <input
                          type="text"
                          value={jobForm.startDate || ''}
                          onChange={(e) => setJobForm({ ...jobForm, startDate: e.target.value })}
                          className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                          placeholder="e.g. Jan 2023"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">
                          End Date
                        </label>
                        <input
                          type="text"
                          value={jobForm.endDate || ''}
                          onChange={(e) => setJobForm({ ...jobForm, endDate: e.target.value })}
                          className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                          placeholder="e.g. Present"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">
                          Location
                        </label>
                        <input
                          type="text"
                          value={jobForm.location || ''}
                          onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })}
                          className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                          placeholder="e.g. Bangalore, India"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">
                        Short Description
                      </label>
                      <textarea
                        rows={2}
                        value={jobForm.description || ''}
                        onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
                        className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">
                        Key Responsibilities / Achievements (one per line)
                      </label>
                      <textarea
                        rows={3}
                        value={(jobForm.keyAchievements || []).join('\n')}
                        onChange={(e) =>
                          setJobForm({
                            ...jobForm,
                            keyAchievements: e.target.value.split('\n').filter(Boolean),
                          })
                        }
                        className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                        placeholder="Optimized API response latency by 35%...&#10;Mentored 4 junior developers..."
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">
                        Technologies (comma separated)
                      </label>
                      <input
                        type="text"
                        value={(jobForm.techStack || []).join(', ')}
                        onChange={(e) =>
                          setJobForm({
                            ...jobForm,
                            techStack: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                          })
                        }
                        className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                        placeholder="e.g. Java, Spring Boot, PostgreSQL, Docker"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingJobId(null)}
                        className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveJob}
                        className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
                      >
                        Save Role
                      </button>
                    </div>
                  </div>
                )}

                {/* List of current jobs */}
                <div className="space-y-2">
                  {(formData.jobExperiences || []).length === 0 ? (
                    <div className="p-6 text-center text-xs text-gray-400 border border-dashed rounded-2xl">
                      No work experiences added yet. Click &quot;Add Role&quot; above.
                    </div>
                  ) : (
                    formData.jobExperiences?.map((job) => (
                      <div
                        key={job.id}
                        className="p-3.5 rounded-xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200/80 dark:border-zinc-700/80 flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="text-xs font-bold text-gray-900 dark:text-white">
                            {job.role} – <span className="font-semibold">{job.company}</span>
                          </div>
                          <div className="text-[11px] text-gray-500">
                            {job.startDate} – {job.endDate || 'Present'} {job.location ? `• ${job.location}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              Sound.click(soundEnabled);
                              setEditingJobId(job.id);
                              setJobForm({ ...job });
                            }}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteJob(job.id)}
                            className="p-1.5 text-gray-400 hover:text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 4. PROJECTS */}
            {activeTab === 'projects' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                    Projects ({formProjects.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      Sound.click(soundEnabled);
                      setEditingProjId('new');
                      setProjForm({
                        title: '',
                        tagLine: '',
                        description: '',
                        category: 'Fullstack',
                        techStack: [],
                        keyResult: '',
                        githubUrl: '',
                        liveUrl: '',
                        featured: true,
                      });
                    }}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Project</span>
                  </button>
                </div>

                {editingProjId && (
                  <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 space-y-3">
                    <div className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                      {editingProjId === 'new' ? 'New Project' : 'Edit Project'}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">
                          Project Title *
                        </label>
                        <input
                          type="text"
                          value={projForm.title || ''}
                          onChange={(e) => setProjForm({ ...projForm, title: e.target.value })}
                          className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                          placeholder="e.g. Distributed Task Scheduler"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">
                          Tagline / Subtitle
                        </label>
                        <input
                          type="text"
                          value={projForm.tagLine || ''}
                          onChange={(e) => setProjForm({ ...projForm, tagLine: e.target.value })}
                          className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                          placeholder="e.g. High-throughput job execution engine"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">
                        Description *
                      </label>
                      <textarea
                        rows={3}
                        value={projForm.description || ''}
                        onChange={(e) => setProjForm({ ...projForm, description: e.target.value })}
                        className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                        placeholder="What problem does it solve and how was it architected?"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">
                        Key Result / Impact
                      </label>
                      <input
                        type="text"
                        value={projForm.keyResult || ''}
                        onChange={(e) => setProjForm({ ...projForm, keyResult: e.target.value })}
                        className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                        placeholder="e.g. Handled 10,000+ RPS with sub-50ms latency"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">
                          Technologies (comma separated)
                        </label>
                        <input
                          type="text"
                          value={(projForm.techStack || []).join(', ')}
                          onChange={(e) =>
                            setProjForm({
                              ...projForm,
                              techStack: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                            })
                          }
                          className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                          placeholder="React, TypeScript, Go, Redis"
                        />
                      </div>

                      <div className="flex items-center gap-4 pt-5">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700 dark:text-gray-300">
                          <input
                            type="checkbox"
                            checked={projForm.featured !== false}
                            onChange={(e) => setProjForm({ ...projForm, featured: e.target.checked })}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Show in Featured Projects</span>
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">
                          GitHub Link
                        </label>
                        <input
                          type="text"
                          value={projForm.githubUrl || ''}
                          onChange={(e) => setProjForm({ ...projForm, githubUrl: e.target.value })}
                          className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                          placeholder="https://github.com/..."
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">
                          Live Demo URL
                        </label>
                        <input
                          type="text"
                          value={projForm.liveUrl || ''}
                          onChange={(e) => setProjForm({ ...projForm, liveUrl: e.target.value })}
                          className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                          placeholder="https://..."
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingProjId(null)}
                        className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveProject}
                        className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
                      >
                        Save Project
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {formProjects.length === 0 ? (
                    <div className="p-6 text-center text-xs text-gray-400 border border-dashed rounded-2xl">
                      No projects added yet. Click &quot;Add Project&quot; above.
                    </div>
                  ) : (
                    formProjects.map((p) => (
                      <div
                        key={p.id}
                        className="p-3.5 rounded-xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200/80 dark:border-zinc-700/80 flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <span>{p.title}</span>
                            {p.featured && (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                Featured
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            {p.techStack?.join(', ')}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              Sound.click(soundEnabled);
                              setEditingProjId(p.id);
                              setProjForm({ ...p });
                            }}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProject(p.id)}
                            className="p-1.5 text-gray-400 hover:text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 5. TECHNICAL SKILLS */}
            {activeTab === 'skills' && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                      Technical Skills (Categorized)
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      Clean categorized layout. No percentage bars or fake progress indicators.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="New Category (e.g. Cloud &amp; DevOps)"
                      className="text-xs px-2.5 py-1 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                    />
                    <button
                      type="button"
                      onClick={handleAddCategory}
                      className="px-3 py-1 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-semibold cursor-pointer shrink-0"
                    >
                      Add Cat
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {formSkills.map((cat, catIdx) => (
                    <div
                      key={catIdx}
                      className="p-4 rounded-xl bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">
                          {cat.category}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(catIdx)}
                          className="text-[10px] text-rose-500 hover:underline cursor-pointer"
                        >
                          Delete Group
                        </button>
                      </div>

                      {/* Skill Pills */}
                      <div className="flex flex-wrap gap-1.5">
                        {cat.skills.map((s, sIdx) => (
                          <span
                            key={s.id || sIdx}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-white dark:bg-zinc-700 text-gray-800 dark:text-gray-200 border border-gray-200/80 dark:border-zinc-600/80 shadow-2xs"
                          >
                            <span>{s.name}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveSkillFromCat(catIdx, sIdx)}
                              className="text-gray-400 hover:text-rose-500 ml-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>

                      {/* Add skill input */}
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          value={newSkillText[catIdx] || ''}
                          onChange={(e) =>
                            setNewSkillText({ ...newSkillText, [catIdx]: e.target.value })
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddSkillToCat(catIdx);
                            }
                          }}
                          placeholder={`Add skill to ${cat.category}...`}
                          className="flex-1 text-xs px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddSkillToCat(catIdx)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 6. EDUCATION */}
            {activeTab === 'education' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                    Education Records
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      Sound.click(soundEnabled);
                      setEditingEduId('new');
                      setEduForm({
                        degree: '',
                        institution: '',
                        year: '',
                        score: '',
                        specialization: '',
                        highlights: [],
                      });
                    }}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Degree</span>
                  </button>
                </div>

                {editingEduId && (
                  <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 space-y-3">
                    <div className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                      {editingEduId === 'new' ? 'New Degree / Institution' : 'Edit Degree'}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">
                          Degree / Course *
                        </label>
                        <input
                          type="text"
                          value={eduForm.degree || ''}
                          onChange={(e) => setEduForm({ ...eduForm, degree: e.target.value })}
                          className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                          placeholder="e.g. Master of Technology (M.Tech)"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">
                          Institution / University *
                        </label>
                        <input
                          type="text"
                          value={eduForm.institution || ''}
                          onChange={(e) => setEduForm({ ...eduForm, institution: e.target.value })}
                          className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                          placeholder="e.g. NIT Raipur"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">
                          Specialization
                        </label>
                        <input
                          type="text"
                          value={eduForm.specialization || ''}
                          onChange={(e) => setEduForm({ ...eduForm, specialization: e.target.value })}
                          className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                          placeholder="e.g. Information Technology"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">
                          Years
                        </label>
                        <input
                          type="text"
                          value={eduForm.year || ''}
                          onChange={(e) => setEduForm({ ...eduForm, year: e.target.value })}
                          className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                          placeholder="e.g. 2024 - 2026"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">
                          CGPA / Score
                        </label>
                        <input
                          type="text"
                          value={eduForm.score || ''}
                          onChange={(e) => setEduForm({ ...eduForm, score: e.target.value })}
                          className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                          placeholder="e.g. 8.55 / 10"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingEduId(null)}
                        className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveEdu}
                        className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
                      >
                        Save Degree
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {(formData.educationRecords || []).map((edu) => (
                    <div
                      key={edu.id}
                      className="p-3.5 rounded-xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200/80 dark:border-zinc-700/80 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-xs font-bold text-gray-900 dark:text-white">
                          {edu.degree} {edu.specialization ? `(${edu.specialization})` : ''}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {edu.institution} • {edu.year} {edu.score ? `• ${edu.score}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            Sound.click(soundEnabled);
                            setEditingEduId(edu.id);
                            setEduForm({ ...edu });
                          }}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEdu(edu.id)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 7. CERTIFICATIONS */}
            {activeTab === 'certifications' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                    Certifications
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      Sound.click(soundEnabled);
                      setEditingCertId('new');
                      setCertForm({ name: '', issuer: '', year: '', link: '' });
                    }}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Certification</span>
                  </button>
                </div>

                {editingCertId && (
                  <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-1">
                          Certification Name *
                        </label>
                        <input
                          type="text"
                          value={certForm.name || ''}
                          onChange={(e) => setCertForm({ ...certForm, name: e.target.value })}
                          className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-1">
                          Issuer
                        </label>
                        <input
                          type="text"
                          value={certForm.issuer || ''}
                          onChange={(e) => setCertForm({ ...certForm, issuer: e.target.value })}
                          className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-1">
                          Year
                        </label>
                        <input
                          type="text"
                          value={certForm.year || ''}
                          onChange={(e) => setCertForm({ ...certForm, year: e.target.value })}
                          className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-1">
                          Verification Link
                        </label>
                        <input
                          type="text"
                          value={certForm.link || ''}
                          onChange={(e) => setCertForm({ ...certForm, link: e.target.value })}
                          className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingCertId(null)}
                        className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 rounded-xl"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveCert}
                        className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
                      >
                        Save Cert
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {((formData.certifications || []) as CertificationItem[]).map((cert) => (
                    <div
                      key={cert.id}
                      className="p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200/80 dark:border-zinc-700/80 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-xs font-bold text-gray-900 dark:text-white">
                          {cert.name}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {cert.issuer} {cert.year ? `• ${cert.year}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            Sound.click(soundEnabled);
                            setEditingCertId(cert.id);
                            setCertForm({ ...cert });
                          }}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCert(cert.id)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 8. PUBLICATIONS */}
            {activeTab === 'publications' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                    Research &amp; Publications
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      Sound.click(soundEnabled);
                      setEditingPubId('new');
                      setPubForm({ title: '', publisher: '', year: '', link: '', description: '' });
                    }}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Publication</span>
                  </button>
                </div>

                {editingPubId && (
                  <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 space-y-3">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">
                        Paper / Article Title *
                      </label>
                      <input
                        type="text"
                        value={pubForm.title || ''}
                        onChange={(e) => setPubForm({ ...pubForm, title: e.target.value })}
                        className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-1">
                          Conference / Journal / Publisher
                        </label>
                        <input
                          type="text"
                          value={pubForm.publisher || ''}
                          onChange={(e) => setPubForm({ ...pubForm, publisher: e.target.value })}
                          className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-1">
                          Year
                        </label>
                        <input
                          type="text"
                          value={pubForm.year || ''}
                          onChange={(e) => setPubForm({ ...pubForm, year: e.target.value })}
                          className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">
                        Paper Link / DOI
                      </label>
                      <input
                        type="text"
                        value={pubForm.link || ''}
                        onChange={(e) => setPubForm({ ...pubForm, link: e.target.value })}
                        className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">
                        Abstract / Key Findings
                      </label>
                      <textarea
                        rows={2}
                        value={pubForm.description || ''}
                        onChange={(e) => setPubForm({ ...pubForm, description: e.target.value })}
                        className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingPubId(null)}
                        className="px-3 py-1.5 text-xs text-gray-600 rounded-xl"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSavePub}
                        className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-xl"
                      >
                        Save Publication
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {(formData.publications || []).map((pub) => (
                    <div
                      key={pub.id}
                      className="p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200/80 dark:border-zinc-700/80 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-xs font-bold text-gray-900 dark:text-white">
                          {pub.title}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {pub.publisher} {pub.year ? `• ${pub.year}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            Sound.click(soundEnabled);
                            setEditingPubId(pub.id);
                            setPubForm({ ...pub });
                          }}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePub(pub.id)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 9. ACHIEVEMENTS */}
            {activeTab === 'achievements' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                    Honors &amp; Achievements
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      Sound.click(soundEnabled);
                      setEditingAchId('new');
                      setAchForm({ title: '', issuer: '', date: '', description: '' });
                    }}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Honor</span>
                  </button>
                </div>

                {editingAchId && (
                  <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 space-y-3">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">
                        Honor / Award Title *
                      </label>
                      <input
                        type="text"
                        value={achForm.title || ''}
                        onChange={(e) => setAchForm({ ...achForm, title: e.target.value })}
                        className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-1">
                          Granting Organization / Issuer
                        </label>
                        <input
                          type="text"
                          value={achForm.issuer || ''}
                          onChange={(e) => setAchForm({ ...achForm, issuer: e.target.value })}
                          className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-1">
                          Date / Year
                        </label>
                        <input
                          type="text"
                          value={achForm.date || ''}
                          onChange={(e) => setAchForm({ ...achForm, date: e.target.value })}
                          className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">
                        Description / Significance
                      </label>
                      <textarea
                        rows={2}
                        value={achForm.description || ''}
                        onChange={(e) => setAchForm({ ...achForm, description: e.target.value })}
                        className="w-full text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingAchId(null)}
                        className="px-3 py-1.5 text-xs text-gray-600 rounded-xl"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveAch}
                        className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-xl"
                      >
                        Save Honor
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {(formData.achievementsList || []).map((ach) => (
                    <div
                      key={ach.id}
                      className="p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200/80 dark:border-zinc-700/80 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-xs font-bold text-gray-900 dark:text-white">
                          {ach.title}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {ach.issuer} {ach.date ? `• ${ach.date}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            Sound.click(soundEnabled);
                            setEditingAchId(ach.id);
                            setAchForm({ ...ach });
                          }}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAch(ach.id)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 10. SECTION ORDER & VISIBILITY */}
            {activeTab === 'sections' && (
              <div className="space-y-4 max-w-xl">
                <div>
                  <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                    Resume Section Ordering &amp; Visibility
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Control the order in which sections appear on your resume. You can hide any section or rearrange them to highlight your strongest qualifications.
                  </p>
                </div>

                <div className="space-y-2">
                  {[...(formData.resumeSectionConfig || DEFAULT_RESUME_SECTION_CONFIG)]
                    .sort((a, b) => a.order - b.order)
                    .map((sec, idx, arr) => (
                      <div
                        key={sec.id}
                        className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                          sec.visible !== false
                            ? 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700'
                            : 'bg-gray-100/60 dark:bg-zinc-900 border-gray-200/50 dark:border-zinc-800 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-5 text-center text-xs font-mono font-bold text-gray-400">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                            {sec.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleToggleSectionVisibility(sec.id)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700 cursor-pointer"
                            title={sec.visible !== false ? 'Hide Section' : 'Show Section'}
                          >
                            {sec.visible !== false ? (
                              <Eye className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5 text-gray-400" />
                            )}
                          </button>

                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveSection(sec.id, 'up')}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 disabled:opacity-30 cursor-pointer"
                            title="Move Up"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            disabled={idx === arr.length - 1}
                            onClick={() => handleMoveSection(sec.id, 'down')}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 disabled:opacity-30 cursor-pointer"
                            title="Move Down"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSaveAll}
            className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Save Profile &amp; Update Both Views</span>
          </button>
        </div>
      </div>
    </div>
  );
};
