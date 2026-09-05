import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  UserProfile,
  PortfolioProject,
  SkillCategory,
  ResumeDocument,
  MainNavView,
  EducationRecord,
  JobExperience,
  HobbyItem,
} from '../types';
import { Sound } from '../utils/audio';
import { STOCK_IMAGES } from '../assets/stockImages';
import { CoverPickerModal } from './CoverPickerModal';
import { AvatarPickerModal } from './AvatarPickerModal';
import {
  FileText,
  Printer,
  Copy,
  Download,
  Check,
  Building,
  GraduationCap,
  Briefcase,
  Sparkles,
  Mail,
  Phone,
  Globe,
  Linkedin,
  Github,
  MapPin,
  Heart,
  ExternalLink,
  Code2,
  Edit2,
  Edit3,
  Plus,
  Trash2,
  X,
  FolderGit2,
  Award,
  Camera,
  Image as ImageIcon,
  CheckCircle2,
  Sliders,
  Layers,
  Save,
  Loader2,
  UserCheck,
} from 'lucide-react';

interface WorkfolioViewProps {
  profile: UserProfile;
  projects: PortfolioProject[];
  skills: SkillCategory[];
  resume: ResumeDocument;
  onUpdateProfile: (updated: UserProfile) => void;
  onUpdateResume?: (resume: ResumeDocument) => void;
  onAddProject: (project: Omit<PortfolioProject, 'id'>) => void;
  onDeleteProject: (id: string) => void;
  onNavigate?: (view: MainNavView) => void;
  soundEnabled: boolean;
}

export const WorkfolioView: React.FC<WorkfolioViewProps> = ({
  profile,
  projects,
  skills,
  resume,
  onUpdateProfile,
  onUpdateResume,
  onAddProject,
  onDeleteProject,
  onNavigate,
  soundEnabled,
}) => {
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // Direct In-Place Edit Mode on Resume
  const [isInlineEditMode, setIsInlineEditMode] = useState(false);

  // Modals for Cover & Avatar & Deep Modals
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showJobModal, setShowJobModal] = useState(false);
  const [showEduModal, setShowEduModal] = useState(false);

  // Profile Edit Modal State
  const [formName, setFormName] = useState(profile.name || 'Gulshan Kumar Nayak');
  const [formSubtitle, setFormSubtitle] = useState(profile.handle?.replace('@', '') || 'Gulshan');
  const [formTitle, setFormTitle] = useState(profile.title || 'Software Engineer at HCL Software');
  const [formSummary, setFormSummary] = useState(
    profile.professionalSummary ||
      profile.bio ||
      'Dedicated Software Engineer with proven expertise in engineering performant web systems, intuitive interfaces, and distributed software architectures. Eager to solve complex challenges with clean code and modern tooling.'
  );
  const [formLocation, setFormLocation] = useState(profile.location || 'Noida / Bengaluru, India');
  const [formEmail, setFormEmail] = useState(profile.contactEmail || 'gulshan@gmail.com');
  const [formPhone, setFormPhone] = useState(profile.phone || '+91 98765 43210');
  const [formLinkedin, setFormLinkedin] = useState(profile.linkedin || 'https://linkedin.com/in/gulshankumarnayak');
  const [formGithub, setFormGithub] = useState(profile.github || 'https://github.com/gulshankumar');
  const [formWebsite, setFormWebsite] = useState(profile.website || 'https://gulshankumar.dev');

  // New Project State
  const [projTitle, setProjTitle] = useState('');
  const [projCategory, setProjCategory] = useState<PortfolioProject['category']>('Fullstack');
  const [projDesc, setProjDesc] = useState('');
  const [projTech, setProjTech] = useState('');
  const [projLive, setProjLive] = useState('');
  const [projGithub, setProjGithub] = useState('');

  // New Job State
  const [jobRole, setJobRole] = useState('');
  const [jobCompany, setJobCompany] = useState('');
  const [jobDates, setJobDates] = useState('');
  const [jobLocation, setJobLocation] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [jobAch, setJobAch] = useState('');
  const [jobTech, setJobTech] = useState('');

  // New Edu State
  const [eduDegree, setEduDegree] = useState('');
  const [eduLevelTitle, setEduLevelTitle] = useState('');
  const [eduInstitution, setEduInstitution] = useState('');
  const [eduScore, setEduScore] = useState('');
  const [eduYear, setEduYear] = useState('');
  const [eduHighlights, setEduHighlights] = useState('');

  // Quick Inline Add States
  const [newSkillInput, setNewSkillInput] = useState<{ [categoryIdx: number]: string }>({});
  const [newHobbyTitle, setNewHobbyTitle] = useState('');
  const [newHobbyEmoji, setNewHobbyEmoji] = useState('💡');

  const educationRecords = profile.educationRecords || [];
  const jobExperiences = profile.jobExperiences || [];
  const hobbies = profile.hobbies || [];

  const resumeSheetRef = useRef<HTMLDivElement>(null);

  // Print Handler
  const handlePrint = () => {
    Sound.click(soundEnabled);
    window.print();
  };

  // High Quality PDF Download via html2canvas & jsPDF
  const handleDownloadPDF = async () => {
    Sound.click(soundEnabled);
    const element = document.getElementById('printable-resume-sheet');
    if (!element) return;

    try {
      setIsExportingPDF(true);

      // Temporarily ensure light styling and clean borders for capture
      const canvas = await html2canvas(element, {
        scale: 2.5, // 2.5x resolution for ultra-sharp vector-like text
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 1200,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      // First Page
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pdfHeight;

      // Additional pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pdfHeight;
      }

      const cleanFileName = (profile.name || 'Gulshan_Kumar_Nayak')
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, '_');
      pdf.save(`${cleanFileName}_Resume.pdf`);

      Sound.success(soundEnabled);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error('PDF Export Error:', err);
      // Fallback to native print
      window.print();
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Copy Markdown Representation
  const handleCopyMarkdown = () => {
    Sound.click(soundEnabled);

    let md = `# ${profile.name || 'Gulshan Kumar Nayak'}\n`;
    md += `**${profile.handle ? profile.handle.replace('@', '') : 'Gulshan'}**\n\n`;
    md += `📍 Location: ${profile.location || 'Noida / Bengaluru, India'} | ✉️ Email: ${profile.contactEmail || 'gulshan@gmail.com'}\n`;
    if (profile.phone) md += `📞 Phone: ${profile.phone} | `;
    if (profile.linkedin) md += `💼 LinkedIn: ${profile.linkedin} | `;
    if (profile.github) md += `🐙 GitHub: ${profile.github}\n\n`;

    const summaryText = profile.professionalSummary || profile.bio;
    if (summaryText) {
      md += `## PROFESSIONAL SUMMARY\n${summaryText}\n\n`;
    }

    if (jobExperiences.length > 0) {
      md += `## PROFESSIONAL EXPERIENCE\n`;
      jobExperiences.forEach((j) => {
        md += `### ${j.role} • ${j.company} (${j.startDate} - ${j.endDate || 'Present'})\n`;
        if (j.location) md += `*${j.location}*\n\n`;
        if (j.description) md += `${j.description}\n\n`;
        if (j.keyAchievements && j.keyAchievements.length > 0) {
          j.keyAchievements.forEach((ach) => {
            md += `- ${ach}\n`;
          });
          md += `\n`;
        }
        if (j.techStack && j.techStack.length > 0) {
          md += `*Technologies:* ${j.techStack.join(', ')}\n\n`;
        }
      });
    }

    if (educationRecords.length > 0) {
      md += `## EDUCATION & ACADEMIC QUALIFICATIONS\n`;
      educationRecords.forEach((e) => {
        md += `### ${e.degree} (${e.levelTitle || e.level})\n`;
        md += `*Score:* **${e.score}** | *Year:* ${e.year} | *Institution:* ${e.institution}\n`;
        if (e.highlights && e.highlights.length > 0) {
          e.highlights.forEach((h) => {
            md += `- ${h}\n`;
          });
        }
        md += `\n`;
      });
    }

    if (skills.length > 0) {
      md += `## TECHNICAL SKILLS\n`;
      skills.forEach((sc) => {
        md += `**${sc.category}:** ${sc.skills.map((s) => s.name).join(', ')}\n\n`;
      });
    }

    navigator.clipboard.writeText(md);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2500);
  };

  // Download JSON
  const handleDownloadJSON = () => {
    Sound.click(soundEnabled);
    const data = {
      profile,
      educationRecords,
      jobExperiences,
      skills,
      projects,
      hobbies,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resume_portfolio_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2500);
  };

  // Save Profile Details Modal
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    Sound.success(soundEnabled);
    onUpdateProfile({
      ...profile,
      name: formName.trim() || profile.name,
      handle: formSubtitle.trim() ? `@${formSubtitle.trim().replace(/^@/, '')}` : profile.handle,
      title: formTitle.trim() || profile.title,
      professionalSummary: formSummary.trim(),
      bio: formSummary.trim(),
      location: formLocation.trim() || 'Noida / Bengaluru, India',
      contactEmail: formEmail.trim() || undefined,
      phone: formPhone.trim() || undefined,
      linkedin: formLinkedin.trim() || undefined,
      github: formGithub.trim() || undefined,
      website: formWebsite.trim() || undefined,
    });
    setShowProfileModal(false);
  };

  // Inline Profile Update Helper
  const handleInlineProfileChange = (key: keyof UserProfile, value: any) => {
    onUpdateProfile({
      ...profile,
      [key]: value,
    });
  };

  // Add Project
  const handleAddProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projTitle.trim()) return;
    Sound.success(soundEnabled);
    onAddProject({
      title: projTitle.trim(),
      category: projCategory,
      description: projDesc.trim(),
      techStack: projTech
        ? projTech.split(',').map((t) => t.trim()).filter(Boolean)
        : [],
      liveUrl: projLive.trim() || undefined,
      githubUrl: projGithub.trim() || undefined,
    });
    setProjTitle('');
    setProjDesc('');
    setProjTech('');
    setProjLive('');
    setProjGithub('');
    setShowProjectModal(false);
  };

  // Add Job
  const handleAddJobSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobRole.trim() || !jobCompany.trim()) return;
    Sound.success(soundEnabled);
    const newJob: JobExperience = {
      id: `job-${Date.now()}`,
      role: jobRole.trim(),
      company: jobCompany.trim(),
      startDate: jobDates.split('-')[0]?.trim() || '2023',
      endDate: jobDates.split('-')[1]?.trim() || 'Present',
      location: jobLocation.trim() || 'Noida / Bengaluru, India',
      description: jobDesc.trim(),
      keyAchievements: jobAch
        ? jobAch.split('\n').map((a) => a.trim()).filter(Boolean)
        : [],
      techStack: jobTech
        ? jobTech.split(',').map((t) => t.trim()).filter(Boolean)
        : [],
    };
    onUpdateProfile({
      ...profile,
      jobExperiences: [newJob, ...jobExperiences],
    });
    setJobRole('');
    setJobCompany('');
    setJobDates('');
    setJobLocation('');
    setJobDesc('');
    setJobAch('');
    setJobTech('');
    setShowJobModal(false);
  };

  // Update Specific Job Inline
  const handleUpdateJobInline = (id: string, updatedFields: Partial<JobExperience>) => {
    const updated = jobExperiences.map((j) => (j.id === id ? { ...j, ...updatedFields } : j));
    onUpdateProfile({
      ...profile,
      jobExperiences: updated,
    });
  };

  // Add Bullet to Specific Job
  const handleAddJobAchievement = (jobId: string) => {
    const updated = jobExperiences.map((j) => {
      if (j.id === jobId) {
        const ach = j.keyAchievements || [];
        return {
          ...j,
          keyAchievements: [...ach, 'New impact metric or architectural achievement...'],
        };
      }
      return j;
    });
    onUpdateProfile({ ...profile, jobExperiences: updated });
  };

  // Delete Specific Job Bullet
  const handleDeleteJobAchievement = (jobId: string, achIndex: number) => {
    const updated = jobExperiences.map((j) => {
      if (j.id === jobId) {
        const ach = (j.keyAchievements || []).filter((_, i) => i !== achIndex);
        return { ...j, keyAchievements: ach };
      }
      return j;
    });
    onUpdateProfile({ ...profile, jobExperiences: updated });
  };

  // Delete Job
  const handleDeleteJob = (id: string) => {
    Sound.click(soundEnabled);
    onUpdateProfile({
      ...profile,
      jobExperiences: jobExperiences.filter((j) => j.id !== id),
    });
  };

  // Add Education
  const handleAddEduSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eduDegree.trim() || !eduInstitution.trim()) return;
    Sound.success(soundEnabled);
    const newEdu: EducationRecord = {
      id: `edu-${Date.now()}`,
      degree: eduDegree.trim(),
      level: 'graduation',
      levelTitle: eduLevelTitle.trim() || "Graduation (Bachelor's Degree)",
      institution: eduInstitution.trim(),
      year: eduYear.trim() || '2020 - 2024',
      score: eduScore.trim() || '8.5 CGPA',
      scoreType: 'cgpa',
      highlights: eduHighlights
        ? eduHighlights.split('\n').map((h) => h.trim()).filter(Boolean)
        : [],
    };
    onUpdateProfile({
      ...profile,
      educationRecords: [newEdu, ...educationRecords],
    });
    setEduDegree('');
    setEduLevelTitle('');
    setEduInstitution('');
    setEduScore('');
    setEduYear('');
    setEduHighlights('');
    setShowEduModal(false);
  };

  // Update Specific Education Inline
  const handleUpdateEduInline = (id: string, updatedFields: Partial<EducationRecord>) => {
    const updated = educationRecords.map((e) => (e.id === id ? { ...e, ...updatedFields } : e));
    onUpdateProfile({
      ...profile,
      educationRecords: updated,
    });
  };

  // Delete Education
  const handleDeleteEdu = (id: string) => {
    Sound.click(soundEnabled);
    onUpdateProfile({
      ...profile,
      educationRecords: educationRecords.filter((e) => e.id !== id),
    });
  };

  // Add Skill Item to Category
  const handleAddSkillInline = (catIdx: number) => {
    const skillName = newSkillInput[catIdx]?.trim();
    if (!skillName) return;

    const updatedSkills = [...skills];
    if (updatedSkills[catIdx]) {
      updatedSkills[catIdx].skills.push({
        name: skillName,
        level: 90,
        experience: '3+ yrs',
      });
      // trigger resume / profile state sync
      setNewSkillInput({ ...newSkillInput, [catIdx]: '' });
      Sound.success(soundEnabled);
    }
  };

  // Remove Skill Item from Category
  const handleRemoveSkillInline = (catIdx: number, skillIdx: number) => {
    const updatedSkills = [...skills];
    if (updatedSkills[catIdx]) {
      updatedSkills[catIdx].skills.splice(skillIdx, 1);
      Sound.click(soundEnabled);
    }
  };

  // Add Hobby Inline
  const handleAddHobbyInline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHobbyTitle.trim()) return;
    const newHobby: HobbyItem = {
      id: `hob-${Date.now()}`,
      title: newHobbyTitle.trim(),
      icon: newHobbyEmoji.trim() || '✨',
      category: 'Lifestyle',
      description: 'Personal interest and passion pursuit',
      passionLevel: 'Active Passion',
    };
    onUpdateProfile({
      ...profile,
      hobbies: [...hobbies, newHobby],
    });
    setNewHobbyTitle('');
    Sound.success(soundEnabled);
  };

  // Remove Hobby Inline
  const handleRemoveHobbyInline = (id: string) => {
    onUpdateProfile({
      ...profile,
      hobbies: hobbies.filter((h) => h.id !== id),
    });
    Sound.click(soundEnabled);
  };

  const displayName = profile.name || 'GULSHAN KUMAR NAYAK';
  const displaySubtitle = profile.handle
    ? profile.handle.replace('@', '')
    : profile.title || 'Gulshan';
  const displayLocation = profile.location || 'Noida / Bengaluru, India';
  const displayEmail = profile.contactEmail || 'gulshan@gmail.com';
  const summaryText =
    profile.professionalSummary ||
    profile.bio ||
    'Dedicated Software Engineer with proven expertise in engineering performant web systems, intuitive interfaces, and distributed software architectures. Eager to solve complex challenges with clean code and modern tooling.';

  const avatarSrc = profile.avatarUrl || STOCK_IMAGES.avatar;
  const coverSrc = profile.staticCoverImage || STOCK_IMAGES.workspaceCover;

  return (
    <div className="min-h-screen py-4 px-2 sm:px-4 lg:px-6 space-y-6">
      {/* 1. LINKEDIN-STYLE PROFILE HEADER CARD (Interactive banner, avatar, headline, quick actions) */}
      <div
        id="linkedin-profile-card"
        className="max-w-4xl mx-auto rounded-3xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] shadow-sm overflow-hidden print:hidden transition-all"
      >
        {/* Cover / Background Banner */}
        <div className="relative h-44 sm:h-56 w-full bg-slate-800 overflow-hidden group">
          <img
            src={coverSrc}
            alt="LinkedIn Cover Background"
            className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-500"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

          {/* Cover Action Button */}
          <div className="absolute top-3.5 right-3.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                setShowCoverModal(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md cursor-pointer hover:scale-105"
            >
              <ImageIcon className="w-3.5 h-3.5 text-[#818CF8]" />
              <span>Change Background</span>
            </button>
          </div>
        </div>

        {/* LinkedIn Meta & Overlapping Avatar Section */}
        <div className="px-6 sm:px-8 pb-6 pt-0 relative">
          {/* Avatar + Quick Edit Badge */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between -mt-16 sm:-mt-20 gap-4 mb-4">
            <div className="relative group self-start">
              <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full border-4 border-white dark:border-[#111827] shadow-xl overflow-hidden bg-white dark:bg-[#1F2937] relative">
                <img
                  src={avatarSrc}
                  alt={profile.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Camera Icon Overlay on Avatar */}
              <button
                type="button"
                onClick={() => {
                  Sound.click(soundEnabled);
                  setShowAvatarModal(true);
                }}
                className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity duration-200 cursor-pointer"
                title="Change Profile Photo"
              >
                <Camera className="w-6 h-6 mb-1 text-white drop-shadow-md" />
                <span className="text-[10px] font-bold tracking-wide">Edit Photo</span>
              </button>

              {/* Verified / Pro Online Indicator */}
              <span
                className="absolute bottom-1 right-2 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white dark:border-[#111827] shadow-xs flex items-center justify-center"
                title="Online & Ready"
              >
                <Check className="w-3 h-3 text-white stroke-[3]" />
              </span>
            </div>

            {/* LinkedIn Header Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Direct PDF Download */}
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={isExportingPDF}
                className="px-4 py-2 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isExportingPDF ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Exporting PDF...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </>
                )}
              </button>

              {/* Toggle Inline Edit Mode */}
              <button
                type="button"
                onClick={() => {
                  Sound.click(soundEnabled);
                  setIsInlineEditMode(!isInlineEditMode);
                }}
                className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isInlineEditMode
                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                    : 'bg-white dark:bg-[#1F2937] border-[#E5E7EB] dark:border-[#374151] text-[#374151] dark:text-[#CBD5E1] hover:border-[#6366F1]'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5 text-current" />
                <span>{isInlineEditMode ? 'Editing Active (ON)' : 'Edit Resume'}</span>
              </button>

              {/* Edit Details Modal */}
              <button
                type="button"
                onClick={() => {
                  Sound.click(soundEnabled);
                  setFormName(profile.name || 'Gulshan Kumar Nayak');
                  setFormSubtitle(profile.handle?.replace('@', '') || 'Gulshan');
                  setFormTitle(profile.title || 'Software Engineer at HCL Software');
                  setFormSummary(summaryText);
                  setFormLocation(displayLocation);
                  setFormEmail(displayEmail);
                  setFormPhone(profile.phone || '+91 98765 43210');
                  setFormLinkedin(profile.linkedin || 'https://linkedin.com/in/gulshankumarnayak');
                  setFormGithub(profile.github || 'https://github.com/gulshankumar');
                  setFormWebsite(profile.website || 'https://gulshankumar.dev');
                  setShowProfileModal(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] hover:border-[#6366F1] text-xs font-semibold text-[#374151] dark:text-[#CBD5E1] transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5 text-[#6366F1]" />
                <span>Edit Modal</span>
              </button>
            </div>
          </div>

          {/* LinkedIn Identity Info */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="workspace-heading font-black text-[#111827] dark:text-white tracking-tight">
                    {profile.name || 'Gulshan Kumar Nayak'}
                  </h1>
                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-[#6366F1] dark:text-[#818CF8] text-[10px] font-bold">
                    PRO
                  </span>
                </div>
                <p className="text-sm font-semibold text-[#374151] dark:text-[#CBD5E1] pt-0.5">
                  {profile.title || 'Software Engineer at HCL Software'}
                </p>
              </div>

              {/* Company & Education Chips (LinkedIn style) */}
              <div className="flex flex-col gap-1 text-xs text-[#4B5563] dark:text-[#9CA3AF]">
                <div className="flex items-center gap-1.5 font-medium">
                  <Building className="w-3.5 h-3.5 text-[#6366F1]" />
                  <span>{profile.currentCompany || 'HCL Software'}</span>
                </div>
                <div className="flex items-center gap-1.5 font-medium">
                  <GraduationCap className="w-3.5 h-3.5 text-[#6366F1]" />
                  <span>National Institute of Technology</span>
                </div>
              </div>
            </div>

            {/* Location & Contact strip */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#6B7280] dark:text-[#9CA3AF] pt-1">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#6366F1]" />
                <span>{displayLocation}</span>
              </span>
              <a
                href={`mailto:${displayEmail}`}
                className="flex items-center gap-1 text-[#6366F1] hover:underline"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Contact info</span>
              </a>
              {profile.linkedin && (
                <a
                  href={profile.linkedin.startsWith('http') ? profile.linkedin : `https://${profile.linkedin}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[#6366F1] hover:underline"
                >
                  <Linkedin className="w-3.5 h-3.5" />
                  <span>LinkedIn</span>
                </a>
              )}
              {profile.github && (
                <a
                  href={profile.github.startsWith('http') ? profile.github : `https://${profile.github}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[#6366F1] hover:underline"
                >
                  <Github className="w-3.5 h-3.5" />
                  <span>GitHub</span>
                </a>
              )}
            </div>

            {/* Open to Work Badge */}
            <div className="pt-2">
              <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    Open to Work • Full-Stack Software Engineering &amp; Architecture Roles
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hidden sm:inline">
                  Hybrid / Remote
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. TOP ACTION TOOLBAR (Print, Copy, Export, Direct Edit Toggle) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] shadow-2xs print:hidden max-w-4xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-[#6366F1] flex items-center justify-center font-bold">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-[#111827] dark:text-white flex items-center gap-2">
              <span>ATS Resume &amp; Curriculum Vitae</span>
              <span className="text-[10px] font-mono px-2 py-0.2 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-semibold">
                Direct Edit Ready
              </span>
            </h2>
            <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">
              {isInlineEditMode
                ? 'Editing mode is active: click any field directly in the resume below to edit text in real-time.'
                : 'Click "Edit Resume" or any field below to update details, then download your high-res PDF.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Direct PDF Download */}
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={isExportingPDF}
            className="px-3.5 py-1.5 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isExportingPDF ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </>
            )}
          </button>

          {/* Print / Save PDF */}
          <button
            type="button"
            onClick={handlePrint}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] hover:border-[#6366F1] text-xs font-semibold text-[#374151] dark:text-[#CBD5E1] transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>

          {/* Toggle Direct Inline Edit */}
          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              setIsInlineEditMode(!isInlineEditMode);
            }}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              isInlineEditMode
                ? 'bg-amber-500 text-white border-amber-600'
                : 'bg-white dark:bg-[#1F2937] border-[#E5E7EB] dark:border-[#374151] text-[#374151] dark:text-[#CBD5E1] hover:border-[#6366F1]'
            }`}
          >
            <Edit2 className="w-3.5 h-3.5 text-current" />
            <span>{isInlineEditMode ? 'Done Editing' : 'Direct Edit'}</span>
          </button>

          {/* Copy Markdown */}
          <button
            type="button"
            onClick={handleCopyMarkdown}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] hover:border-[#6366F1] text-xs font-semibold text-[#374151] dark:text-[#CBD5E1] transition-all flex items-center gap-1.5 cursor-pointer"
          >
            {copiedSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-600 font-bold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#6366F1]" />
                <span>Markdown</span>
              </>
            )}
          </button>

          {/* Export JSON */}
          <button
            type="button"
            onClick={handleDownloadJSON}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] hover:border-[#6366F1] text-xs font-semibold text-[#374151] dark:text-[#CBD5E1] transition-all flex items-center gap-1.5 cursor-pointer"
          >
            {downloadSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-600 font-bold">Exported!</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-[#6366F1]" />
                <span>JSON</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3. MAIN ATS RESUME DOCUMENT SHEET (Inline Editable + Capture Target for PDF) */}
      <div
        id="printable-resume-sheet"
        ref={resumeSheetRef}
        className={`max-w-4xl mx-auto p-6 sm:p-10 rounded-3xl bg-white dark:bg-[#111827] border shadow-sm space-y-7 transition-all print:border-none print:shadow-none print:p-0 print:m-0 ${
          isInlineEditMode
            ? 'border-amber-400 dark:border-amber-500 ring-2 ring-amber-400/20'
            : 'border-[#E5E7EB] dark:border-[#1F2937]'
        }`}
      >
        {/* Document Header (Editable Name, Subtitle, Contact Details) */}
        <div className="space-y-2 relative group">
          <div className="flex items-center justify-between">
            {isInlineEditMode ? (
              <input
                type="text"
                value={profile.name}
                onChange={(e) => handleInlineProfileChange('name', e.target.value)}
                placeholder="FULL NAME"
                className="text-lg sm:text-xl font-black text-[#111827] dark:text-white tracking-tight uppercase bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 px-2 py-1 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            ) : (
              <h1 className="workspace-heading font-black text-[#111827] dark:text-white tracking-tight uppercase">
                {displayName}
              </h1>
            )}

            <button
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                setIsInlineEditMode(!isInlineEditMode);
              }}
              className="text-[#9CA3AF] hover:text-[#6366F1] p-1.5 rounded-lg hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] transition-colors print:hidden shrink-0"
              title="Toggle Direct Edit Mode"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          </div>

          {/* Subtitle / Title */}
          {isInlineEditMode ? (
            <input
              type="text"
              value={profile.handle?.replace('@', '') || ''}
              onChange={(e) =>
                handleInlineProfileChange(
                  'handle',
                  e.target.value ? `@${e.target.value.replace(/^@/, '')}` : ''
                )
              }
              placeholder="Subtitle / Handle (e.g. Gulshan)"
              className="text-sm font-bold text-[#6366F1] dark:text-[#818CF8] bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 px-2 py-0.5 rounded-lg w-full max-w-md focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          ) : (
            <p className="text-sm font-bold text-[#6366F1] dark:text-[#818CF8]">
              {displaySubtitle}
            </p>
          )}

          {/* Contact Strip */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-[#4B5563] dark:text-[#9CA3AF] font-medium pt-1">
            {/* Location */}
            {isInlineEditMode ? (
              <div className="flex items-center gap-1 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 px-2 py-0.5 rounded-md">
                <MapPin className="w-3 h-3 text-[#6366F1]" />
                <input
                  type="text"
                  value={profile.location || ''}
                  onChange={(e) => handleInlineProfileChange('location', e.target.value)}
                  placeholder="Location"
                  className="text-xs bg-transparent focus:outline-none text-[#111827] dark:text-white"
                />
              </div>
            ) : (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#6366F1]" />
                <span>{displayLocation}</span>
              </span>
            )}

            {/* Email */}
            {isInlineEditMode ? (
              <div className="flex items-center gap-1 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 px-2 py-0.5 rounded-md">
                <Mail className="w-3 h-3 text-[#6366F1]" />
                <input
                  type="email"
                  value={profile.contactEmail || ''}
                  onChange={(e) => handleInlineProfileChange('contactEmail', e.target.value)}
                  placeholder="Email"
                  className="text-xs bg-transparent focus:outline-none text-[#111827] dark:text-white"
                />
              </div>
            ) : (
              <a
                href={`mailto:${displayEmail}`}
                className="flex items-center gap-1.5 hover:text-[#6366F1] transition-colors"
              >
                <Mail className="w-3.5 h-3.5 text-[#6366F1]" />
                <span>{displayEmail}</span>
              </a>
            )}

            {/* Phone */}
            {isInlineEditMode ? (
              <div className="flex items-center gap-1 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 px-2 py-0.5 rounded-md">
                <Phone className="w-3 h-3 text-[#6366F1]" />
                <input
                  type="text"
                  value={profile.phone || ''}
                  onChange={(e) => handleInlineProfileChange('phone', e.target.value)}
                  placeholder="Phone"
                  className="text-xs bg-transparent focus:outline-none text-[#111827] dark:text-white"
                />
              </div>
            ) : profile.phone ? (
              <a
                href={`tel:${profile.phone}`}
                className="flex items-center gap-1.5 hover:text-[#6366F1] transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-[#6366F1]" />
                <span>{profile.phone}</span>
              </a>
            ) : null}

            {/* LinkedIn */}
            {isInlineEditMode ? (
              <div className="flex items-center gap-1 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 px-2 py-0.5 rounded-md">
                <Linkedin className="w-3 h-3 text-[#6366F1]" />
                <input
                  type="text"
                  value={profile.linkedin || ''}
                  onChange={(e) => handleInlineProfileChange('linkedin', e.target.value)}
                  placeholder="LinkedIn URL"
                  className="text-xs bg-transparent focus:outline-none text-[#111827] dark:text-white"
                />
              </div>
            ) : profile.linkedin ? (
              <a
                href={profile.linkedin.startsWith('http') ? profile.linkedin : `https://${profile.linkedin}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 hover:text-[#6366F1] transition-colors"
              >
                <Linkedin className="w-3.5 h-3.5 text-[#6366F1]" />
                <span>LinkedIn</span>
              </a>
            ) : null}

            {/* GitHub */}
            {isInlineEditMode ? (
              <div className="flex items-center gap-1 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 px-2 py-0.5 rounded-md">
                <Github className="w-3 h-3 text-[#6366F1]" />
                <input
                  type="text"
                  value={profile.github || ''}
                  onChange={(e) => handleInlineProfileChange('github', e.target.value)}
                  placeholder="GitHub URL"
                  className="text-xs bg-transparent focus:outline-none text-[#111827] dark:text-white"
                />
              </div>
            ) : profile.github ? (
              <a
                href={profile.github.startsWith('http') ? profile.github : `https://${profile.github}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 hover:text-[#6366F1] transition-colors"
              >
                <Github className="w-3.5 h-3.5 text-[#6366F1]" />
                <span>GitHub</span>
              </a>
            ) : null}
          </div>

          <div className="border-b border-[#E5E7EB] dark:border-[#1F2937] pt-2" />
        </div>

        {/* 1. PROFESSIONAL SUMMARY */}
        <div className="space-y-2 group">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-wider text-[#111827] dark:text-white flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#6366F1]" />
              <span>PROFESSIONAL SUMMARY</span>
            </h2>
            <button
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                setIsInlineEditMode(!isInlineEditMode);
              }}
              className="text-[#9CA3AF] hover:text-[#6366F1] opacity-0 group-hover:opacity-100 transition-opacity p-1 print:hidden"
              title="Edit Summary"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {isInlineEditMode ? (
            <textarea
              value={summaryText}
              onChange={(e) => {
                handleInlineProfileChange('professionalSummary', e.target.value);
                handleInlineProfileChange('bio', e.target.value);
              }}
              rows={4}
              className="w-full text-xs sm:text-sm text-[#111827] dark:text-white leading-relaxed bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 p-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          ) : (
            <p className="text-xs sm:text-sm text-[#374151] dark:text-[#D1D5DB] leading-relaxed">
              {summaryText}
            </p>
          )}
        </div>

        {/* 2. PROFESSIONAL EXPERIENCE */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-wider text-[#111827] dark:text-white flex items-center gap-2">
              <Briefcase className="w-3.5 h-3.5 text-[#6366F1]" />
              <span>PROFESSIONAL EXPERIENCE</span>
            </h2>
            <button
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                setShowJobModal(true);
              }}
              className="text-xs text-[#6366F1] font-semibold hover:underline flex items-center gap-1 print:hidden cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add Position</span>
            </button>
          </div>

          <div className="space-y-5">
            {jobExperiences.map((job) => (
              <div key={job.id} className="space-y-1.5 group relative">
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                  {isInlineEditMode ? (
                    <div className="flex flex-wrap items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={job.role}
                        onChange={(e) => handleUpdateJobInline(job.id, { role: e.target.value })}
                        placeholder="Job Title"
                        className="text-sm font-bold text-[#111827] dark:text-white bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 px-2 py-0.5 rounded-md focus:outline-none"
                      />
                      <span className="text-[#6366F1]">•</span>
                      <input
                        type="text"
                        value={job.company}
                        onChange={(e) => handleUpdateJobInline(job.id, { company: e.target.value })}
                        placeholder="Company Name"
                        className="text-sm font-bold text-[#6366F1] dark:text-[#818CF8] bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 px-2 py-0.5 rounded-md focus:outline-none"
                      />
                    </div>
                  ) : (
                    <h3 className="text-sm font-bold text-[#111827] dark:text-white flex items-center gap-1.5">
                      <span>{job.role}</span>
                      <span className="text-[#6366F1] dark:text-[#818CF8]">• {job.company}</span>
                    </h3>
                  )}

                  <div className="flex items-center gap-2 shrink-0">
                    {isInlineEditMode ? (
                      <div className="flex items-center gap-1 text-xs font-mono">
                        <input
                          type="text"
                          value={job.startDate}
                          onChange={(e) => handleUpdateJobInline(job.id, { startDate: e.target.value })}
                          placeholder="Start"
                          className="w-20 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 px-1 py-0.5 rounded text-center text-xs"
                        />
                        <span>–</span>
                        <input
                          type="text"
                          value={job.endDate}
                          onChange={(e) => handleUpdateJobInline(job.id, { endDate: e.target.value })}
                          placeholder="End"
                          className="w-20 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 px-1 py-0.5 rounded text-center text-xs"
                        />
                        <input
                          type="text"
                          value={job.location || ''}
                          onChange={(e) => handleUpdateJobInline(job.id, { location: e.target.value })}
                          placeholder="Location"
                          className="w-24 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 px-1 py-0.5 rounded text-xs"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-mono">
                        {job.startDate} – {job.endDate || 'Present'}
                        {job.location ? ` | ${job.location}` : ''}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteJob(job.id)}
                      className="text-[#9CA3AF] hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 print:hidden cursor-pointer"
                      title="Delete Experience"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Description */}
                {isInlineEditMode ? (
                  <textarea
                    value={job.description}
                    onChange={(e) => handleUpdateJobInline(job.id, { description: e.target.value })}
                    rows={2}
                    placeholder="Brief description of the role..."
                    className="w-full text-xs text-[#111827] dark:text-white bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 p-1.5 rounded-lg focus:outline-none"
                  />
                ) : (
                  job.description && (
                    <p className="text-xs text-[#4B5563] dark:text-[#D1D5DB] leading-relaxed">
                      {job.description}
                    </p>
                  )
                )}

                {/* Achievements List */}
                <div className="space-y-1 pt-0.5">
                  {job.keyAchievements?.map((ach, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-xs">
                      <span className="text-[#6366F1] font-bold mt-0.5">•</span>
                      {isInlineEditMode ? (
                        <div className="flex items-center gap-1.5 flex-1">
                          <input
                            type="text"
                            value={ach}
                            onChange={(e) => {
                              const newAch = [...(job.keyAchievements || [])];
                              newAch[idx] = e.target.value;
                              handleUpdateJobInline(job.id, { keyAchievements: newAch });
                            }}
                            className="flex-1 text-xs text-[#111827] dark:text-white bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 px-2 py-0.5 rounded focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleDeleteJobAchievement(job.id, idx)}
                            className="text-[#9CA3AF] hover:text-rose-500 p-0.5 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[#374151] dark:text-[#D1D5DB] leading-relaxed">
                          {ach}
                        </span>
                      )}
                    </div>
                  ))}

                  {isInlineEditMode && (
                    <button
                      type="button"
                      onClick={() => handleAddJobAchievement(job.id)}
                      className="text-[11px] text-[#6366F1] hover:underline font-semibold flex items-center gap-1 pt-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Achievement Bullet</span>
                    </button>
                  )}
                </div>

                {/* Tech Stack */}
                {isInlineEditMode ? (
                  <div className="pt-1 flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-[#374151] dark:text-[#CBD5E1]">
                      Technologies:
                    </span>
                    <input
                      type="text"
                      value={job.techStack?.join(', ') || ''}
                      onChange={(e) =>
                        handleUpdateJobInline(job.id, {
                          techStack: e.target.value
                            .split(',')
                            .map((t) => t.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="React, TypeScript, Node.js"
                      className="flex-1 text-xs text-[#111827] dark:text-white bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 px-2 py-0.5 rounded focus:outline-none"
                    />
                  </div>
                ) : (
                  job.techStack &&
                  job.techStack.length > 0 && (
                    <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] pt-1">
                      <span className="font-bold text-[#374151] dark:text-[#CBD5E1]">
                        Technologies:
                      </span>{' '}
                      {job.techStack.join(', ')}
                    </p>
                  )
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 3. EDUCATION & ACADEMIC QUALIFICATIONS */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-wider text-[#111827] dark:text-white flex items-center gap-2">
              <GraduationCap className="w-3.5 h-3.5 text-[#6366F1]" />
              <span>EDUCATION &amp; ACADEMIC QUALIFICATIONS</span>
            </h2>
            <button
              type="button"
              onClick={() => {
                Sound.click(soundEnabled);
                setShowEduModal(true);
              }}
              className="text-xs text-[#6366F1] font-semibold hover:underline flex items-center gap-1 print:hidden cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add Record</span>
            </button>
          </div>

          <div className="space-y-4">
            {educationRecords.map((edu) => (
              <div key={edu.id} className="space-y-1 group relative">
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                  {isInlineEditMode ? (
                    <div className="flex flex-wrap items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={edu.degree}
                        onChange={(e) => handleUpdateEduInline(edu.id, { degree: e.target.value })}
                        placeholder="Degree Name"
                        className="text-sm font-bold text-[#111827] dark:text-white bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 px-2 py-0.5 rounded focus:outline-none"
                      />
                      <input
                        type="text"
                        value={edu.levelTitle || edu.level}
                        onChange={(e) => handleUpdateEduInline(edu.id, { levelTitle: e.target.value })}
                        placeholder="Level Title"
                        className="text-xs text-[#6366F1] font-semibold bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 px-2 py-0.5 rounded focus:outline-none"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-[#111827] dark:text-white">
                        {edu.degree}
                      </span>
                      <span className="text-xs text-[#6366F1] font-semibold">
                        ({edu.levelTitle || edu.level})
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs font-mono shrink-0">
                    {isInlineEditMode ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={edu.score}
                          onChange={(e) => handleUpdateEduInline(edu.id, { score: e.target.value })}
                          placeholder="Score"
                          className="w-20 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-300 text-xs"
                        />
                        <input
                          type="text"
                          value={edu.year}
                          onChange={(e) => handleUpdateEduInline(edu.id, { year: e.target.value })}
                          placeholder="Year"
                          className="w-24 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 px-1 py-0.5 rounded text-xs"
                        />
                      </div>
                    ) : (
                      <>
                        <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                          Score: {edu.score}
                        </span>
                        <span className="text-[#6B7280] dark:text-[#9CA3AF]">{edu.year}</span>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteEdu(edu.id)}
                      className="text-[#9CA3AF] hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 print:hidden cursor-pointer"
                      title="Delete Record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {isInlineEditMode ? (
                  <input
                    type="text"
                    value={edu.institution}
                    onChange={(e) => handleUpdateEduInline(edu.id, { institution: e.target.value })}
                    placeholder="Institution / University Name"
                    className="w-full text-xs text-[#111827] dark:text-white bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 px-2 py-0.5 rounded focus:outline-none"
                  />
                ) : (
                  <p className="text-xs font-medium text-[#4B5563] dark:text-[#9CA3AF]">
                    <span className="text-[#111827] dark:text-white font-semibold">
                      {edu.institution}
                    </span>
                    {edu.boardOrUniversity && <span> • {edu.boardOrUniversity}</span>}
                    {edu.location && <span> • {edu.location}</span>}
                    {edu.specialization && <span> • Specialization: {edu.specialization}</span>}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 4. TECHNICAL SKILLS & PROFICIENCIES */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-wider text-[#111827] dark:text-white flex items-center gap-2">
              <Code2 className="w-3.5 h-3.5 text-[#6366F1]" />
              <span>TECHNICAL SKILLS &amp; PROFICIENCIES</span>
            </h2>
          </div>

          <div className="space-y-2 pt-1">
            {skills.map((sc, catIdx) => (
              <div
                key={catIdx}
                className="text-xs flex flex-col sm:flex-row sm:items-baseline gap-1.5"
              >
                <span className="font-bold text-[#111827] dark:text-white sm:w-44 shrink-0">
                  {sc.category}:
                </span>

                <div className="flex flex-wrap items-center gap-1.5 flex-1">
                  {sc.skills.map((s, sIdx) => (
                    <span
                      key={sIdx}
                      className="inline-flex items-center gap-1 text-[#4B5563] dark:text-[#D1D5DB]"
                    >
                      <span>{s.name}</span>
                      {isInlineEditMode && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSkillInline(catIdx, sIdx)}
                          className="text-[#9CA3AF] hover:text-rose-500 p-0.5 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                      {sIdx < sc.skills.length - 1 && !isInlineEditMode && (
                        <span className="text-[#9CA3AF]">•</span>
                      )}
                    </span>
                  ))}

                  {isInlineEditMode && (
                    <div className="inline-flex items-center gap-1">
                      <input
                        type="text"
                        value={newSkillInput[catIdx] || ''}
                        onChange={(e) =>
                          setNewSkillInput({ ...newSkillInput, [catIdx]: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddSkillInline(catIdx);
                          }
                        }}
                        placeholder="+ Skill (Press Enter)"
                        className="text-[11px] bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 px-1.5 py-0.5 rounded w-32 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddSkillInline(catIdx)}
                        className="px-1.5 py-0.5 rounded bg-[#6366F1] text-white text-[10px] font-bold cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 5. FEATURED PROJECTS & SOFTWARE */}
        {projects.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-wider text-[#111827] dark:text-white flex items-center gap-2">
                <FolderGit2 className="w-3.5 h-3.5 text-[#6366F1]" />
                <span>KEY PROJECTS &amp; SOFTWARE</span>
              </h2>
              <button
                type="button"
                onClick={() => {
                  Sound.click(soundEnabled);
                  setShowProjectModal(true);
                }}
                className="text-xs text-[#6366F1] font-semibold hover:underline flex items-center gap-1 print:hidden cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Project</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {projects.map((p) => {
                const live = p.liveUrl || p.link;
                const github = p.githubUrl;
                const techList = p.techStack || p.tech;
                return (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-2xl bg-[#F8FAFC] dark:bg-[#1E293B]/70 border border-[#E2E8F0] dark:border-[#334155] space-y-1.5 group relative"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-[#111827] dark:text-white">
                        {p.title}
                      </h3>
                      <div className="flex items-center gap-2">
                        {live && (
                          <a
                            href={live}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-[#6366F1] font-semibold flex items-center gap-0.5 hover:underline"
                          >
                            <span>Demo</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                        {github && (
                          <a
                            href={github}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-[#4B5563] dark:text-[#9CA3AF] flex items-center gap-0.5 hover:underline"
                          >
                            <Github className="w-2.5 h-2.5" />
                            <span>Code</span>
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            Sound.click(soundEnabled);
                            onDeleteProject(p.id);
                          }}
                          className="text-[#9CA3AF] hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 print:hidden cursor-pointer"
                          title="Delete Project"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] leading-relaxed">
                      {p.description}
                    </p>

                    {techList && techList.length > 0 && (
                      <p className="text-[10px] font-mono text-[#6366F1] dark:text-[#818CF8] pt-0.5">
                        {techList.join(', ')}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 6. HOBBIES & PERSONAL INTERESTS */}
        <div className="space-y-2">
          <h2 className="text-xs font-black uppercase tracking-wider text-[#111827] dark:text-white flex items-center gap-2">
            <Heart className="w-3.5 h-3.5 text-rose-500" />
            <span>HOBBIES &amp; PERSONAL INTERESTS</span>
          </h2>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {hobbies.map((h) => (
              <span
                key={h.id}
                className="px-3 py-1 rounded-xl bg-[#F8FAFC] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] text-xs text-[#374151] dark:text-[#D1D5DB] flex items-center gap-1.5"
              >
                <span>{h.icon || '✨'}</span>
                <span className="font-semibold">{h.title}</span>
                {h.passionLevel && (
                  <span className="text-[10px] text-[#9CA3AF]">({h.passionLevel})</span>
                )}
                {isInlineEditMode && (
                  <button
                    type="button"
                    onClick={() => handleRemoveHobbyInline(h.id)}
                    className="text-[#9CA3AF] hover:text-rose-500 ml-1 p-0.5 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}

            {isInlineEditMode && (
              <form onSubmit={handleAddHobbyInline} className="flex items-center gap-1">
                <input
                  type="text"
                  value={newHobbyEmoji}
                  onChange={(e) => setNewHobbyEmoji(e.target.value)}
                  className="w-9 px-1 py-0.5 rounded-lg border text-center text-xs bg-white dark:bg-[#1F2937]"
                  placeholder="Emoji"
                />
                <input
                  type="text"
                  value={newHobbyTitle}
                  onChange={(e) => setNewHobbyTitle(e.target.value)}
                  placeholder="New Hobby Title..."
                  className="px-2 py-0.5 rounded-lg border text-xs bg-white dark:bg-[#1F2937]"
                />
                <button
                  type="submit"
                  className="px-2 py-0.5 rounded-lg bg-[#6366F1] text-white text-xs font-bold"
                >
                  Add
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* MODAL 1: Edit Profile / Header Details Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#F3F4F6] dark:border-[#1F2937] pb-3">
              <h3 className="text-base font-bold text-[#111827] dark:text-white">
                Edit Professional Profile &amp; Summary
              </h3>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="text-[#9CA3AF] hover:text-black dark:hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] mb-1">
                    Full Name (Header)
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] dark:border-[#374151] bg-white dark:bg-[#1F2937] text-xs text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] mb-1">
                    Subtitle (Handle / Short Title)
                  </label>
                  <input
                    type="text"
                    value={formSubtitle}
                    onChange={(e) => setFormSubtitle(e.target.value)}
                    placeholder="e.g. Gulshan"
                    className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] dark:border-[#374151] bg-white dark:bg-[#1F2937] text-xs text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] mb-1">
                  Professional Headline / Designation
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Software Engineer at HCL Software"
                  className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] dark:border-[#374151] bg-white dark:bg-[#1F2937] text-xs text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] mb-1">
                  Professional Summary
                </label>
                <textarea
                  value={formSummary}
                  onChange={(e) => setFormSummary(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] dark:border-[#374151] bg-white dark:bg-[#1F2937] text-xs text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] mb-1">
                    Location Label
                  </label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="Noida / Bengaluru, India"
                    className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] dark:border-[#374151] bg-white dark:bg-[#1F2937] text-xs text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] mb-1">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] dark:border-[#374151] bg-white dark:bg-[#1F2937] text-xs text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] mb-1">
                    LinkedIn URL
                  </label>
                  <input
                    type="text"
                    value={formLinkedin}
                    onChange={(e) => setFormLinkedin(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] dark:border-[#374151] bg-white dark:bg-[#1F2937] text-xs text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] mb-1">
                    GitHub URL
                  </label>
                  <input
                    type="text"
                    value={formGithub}
                    onChange={(e) => setFormGithub(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] dark:border-[#374151] bg-white dark:bg-[#1F2937] text-xs text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] dark:border-[#374151] bg-white dark:bg-[#1F2937] text-xs text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F3F4F6] dark:border-[#1F2937]">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Add Job Experience */}
      {showJobModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#F3F4F6] dark:border-[#1F2937] pb-3">
              <h3 className="text-base font-bold text-[#111827] dark:text-white">
                Add Work Experience
              </h3>
              <button
                type="button"
                onClick={() => setShowJobModal(false)}
                className="text-[#9CA3AF] hover:text-black dark:hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddJobSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] mb-1">
                    Role / Title *
                  </label>
                  <input
                    type="text"
                    value={jobRole}
                    onChange={(e) => setJobRole(e.target.value)}
                    placeholder="e.g. Software Engineer"
                    className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] dark:border-[#374151] bg-white dark:bg-[#1F2937] text-xs text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] mb-1">
                    Company *
                  </label>
                  <input
                    type="text"
                    value={jobCompany}
                    onChange={(e) => setJobCompany(e.target.value)}
                    placeholder="e.g. HCL Software"
                    className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] dark:border-[#374151] bg-white dark:bg-[#1F2937] text-xs text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] mb-1">
                    Timeline (Dates)
                  </label>
                  <input
                    type="text"
                    value={jobDates}
                    onChange={(e) => setJobDates(e.target.value)}
                    placeholder="e.g. Jul 2022 - Present"
                    className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] dark:border-[#374151] bg-white dark:bg-[#1F2937] text-xs text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] mb-1">
                    Location &amp; Type
                  </label>
                  <input
                    type="text"
                    value={jobLocation}
                    onChange={(e) => setJobLocation(e.target.value)}
                    placeholder="e.g. Noida / Bengaluru, India • Hybrid"
                    className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] dark:border-[#374151] bg-white dark:bg-[#1F2937] text-xs text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] mb-1">
                  Brief Overview
                </label>
                <input
                  type="text"
                  value={jobDesc}
                  onChange={(e) => setJobDesc(e.target.value)}
                  placeholder="Architecting scalable cloud web applications..."
                  className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] dark:border-[#374151] bg-white dark:bg-[#1F2937] text-xs text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] mb-1">
                  Key Achievements (one per line)
                </label>
                <textarea
                  value={jobAch}
                  onChange={(e) => setJobAch(e.target.value)}
                  rows={3}
                  placeholder="Engineered high-performance React applications&#10;Implemented real-time state synchronization"
                  className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] dark:border-[#374151] bg-white dark:bg-[#1F2937] text-xs text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] mb-1">
                  Technologies (comma-separated)
                </label>
                <input
                  type="text"
                  value={jobTech}
                  onChange={(e) => setJobTech(e.target.value)}
                  placeholder="React, TypeScript, Tailwind CSS, Node.js, REST APIs, Git"
                  className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] dark:border-[#374151] bg-white dark:bg-[#1F2937] text-xs text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F3F4F6] dark:border-[#1F2937]">
                <button
                  type="button"
                  onClick={() => setShowJobModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  Add Experience
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Add Education Record */}
      {showEduModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#F3F4F6] dark:border-[#1F2937] pb-3">
              <h3 className="text-base font-bold text-[#111827] dark:text-white">
                Add Education Record
              </h3>
              <button
                type="button"
                onClick={() => setShowEduModal(false)}
                className="text-[#9CA3AF] hover:text-black dark:hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddEduSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] mb-1">
                  Degree / Program *
                </label>
                <input
                  type="text"
                  value={eduDegree}
                  onChange={(e) => setEduDegree(e.target.value)}
                  placeholder="e.g. Master of Technology / B.Tech Computer Science"
                  className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] dark:border-[#374151] bg-white dark:bg-[#1F2937] text-xs text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] mb-1">
                    Level Category Title
                  </label>
                  <input
                    type="text"
                    value={eduLevelTitle}
                    onChange={(e) => setEduLevelTitle(e.target.value)}
                    placeholder="Graduation (Bachelor's Degree)"
                    className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] dark:border-[#374151] bg-white dark:bg-[#1F2937] text-xs text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] mb-1">
                    Score / CGPA
                  </label>
                  <input
                    type="text"
                    value={eduScore}
                    onChange={(e) => setEduScore(e.target.value)}
                    placeholder="8.8 CGPA / 85%"
                    className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] dark:border-[#374151] bg-white dark:bg-[#1F2937] text-xs text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] mb-1">
                    Institution / University *
                  </label>
                  <input
                    type="text"
                    value={eduInstitution}
                    onChange={(e) => setEduInstitution(e.target.value)}
                    placeholder="National Institute of Technology"
                    className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] dark:border-[#374151] bg-white dark:bg-[#1F2937] text-xs text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] mb-1">
                    Year Period
                  </label>
                  <input
                    type="text"
                    value={eduYear}
                    onChange={(e) => setEduYear(e.target.value)}
                    placeholder="2018 - 2022"
                    className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] dark:border-[#374151] bg-white dark:bg-[#1F2937] text-xs text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] mb-1">
                  Highlights (one per line)
                </label>
                <textarea
                  value={eduHighlights}
                  onChange={(e) => setEduHighlights(e.target.value)}
                  rows={2}
                  placeholder="Specialized in Computer Science & Distributed Systems&#10;Graduated with First Class Honors"
                  className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] dark:border-[#374151] bg-white dark:bg-[#1F2937] text-xs text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F3F4F6] dark:border-[#1F2937]">
                <button
                  type="button"
                  onClick={() => setShowEduModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  Add Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Add Project */}
      {showProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#F3F4F6] dark:border-[#1F2937] pb-3">
              <h3 className="text-base font-bold text-[#111827] dark:text-white">
                Add New Project
              </h3>
              <button
                type="button"
                onClick={() => setShowProjectModal(false)}
                className="text-[#9CA3AF] hover:text-black dark:hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddProjectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] mb-1">
                  Project Title *
                </label>
                <input
                  type="text"
                  value={projTitle}
                  onChange={(e) => setProjTitle(e.target.value)}
                  placeholder="e.g. Distributed Cloud Task Engine"
                  className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] dark:border-[#374151] bg-white dark:bg-[#1F2937] text-xs text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] mb-1">
                  Description
                </label>
                <textarea
                  value={projDesc}
                  onChange={(e) => setProjDesc(e.target.value)}
                  rows={3}
                  placeholder="Summarize the project's goal, architecture, and key achievements..."
                  className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] dark:border-[#374151] bg-white dark:bg-[#1F2937] text-xs text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] mb-1">
                  Tech Stack (comma-separated)
                </label>
                <input
                  type="text"
                  value={projTech}
                  onChange={(e) => setProjTech(e.target.value)}
                  placeholder="e.g. React, TypeScript, Node.js, PostgreSQL"
                  className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] dark:border-[#374151] bg-white dark:bg-[#1F2937] text-xs text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] mb-1">
                    Live Demo URL
                  </label>
                  <input
                    type="url"
                    value={projLive}
                    onChange={(e) => setProjLive(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] dark:border-[#374151] bg-white dark:bg-[#1F2937] text-xs text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] mb-1">
                    GitHub URL
                  </label>
                  <input
                    type="url"
                    value={projGithub}
                    onChange={(e) => setProjGithub(e.target.value)}
                    placeholder="https://github.com/..."
                    className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] dark:border-[#374151] bg-white dark:bg-[#1F2937] text-xs text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F3F4F6] dark:border-[#1F2937]">
                <button
                  type="button"
                  onClick={() => setShowProjectModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  Add Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Change Cover Background Image */}
      <CoverPickerModal
        isOpen={showCoverModal}
        currentCoverUrl={coverSrc}
        onSelectCover={(url) => {
          onUpdateProfile({
            ...profile,
            staticCoverImage: url,
          });
        }}
        onClose={() => setShowCoverModal(false)}
        soundEnabled={soundEnabled}
      />

      {/* MODAL 6: Change Avatar Profile Photo */}
      <AvatarPickerModal
        isOpen={showAvatarModal}
        currentAvatarUrl={avatarSrc}
        onSelectAvatar={(url) => {
          onUpdateProfile({
            ...profile,
            avatarUrl: url,
          });
        }}
        onClose={() => setShowAvatarModal(false)}
        soundEnabled={soundEnabled}
      />
    </div>
  );
};
