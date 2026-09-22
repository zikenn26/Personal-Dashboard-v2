export type Priority = 'urgent' | 'high' | 'medium' | 'low';
export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'complete';

export interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
  status?: TaskStatus;
  priority: Priority;
  category: string;
  dueDate?: string;
  createdAt: number;
  assignee?: string;
  notes?: string;
}

export interface HabitItem {
  id: string;
  title: string;
  category: string;
  icon: string;
  completedDays: boolean[]; // 7 days (Mon-Sun)
  streak: number;
  color: string;
}

export interface HabitActivityLog {
  id: string;
  habitId: string;
  habitTitle: string;
  category: string;
  icon: string;
  color: string;
  dayIndex: number; // 0=Mon, ..., 6=Sun
  dayName: string; // 'Mon', 'Tue', etc.
  date: string; // 'YYYY-MM-DD'
  completed: boolean;
  timestamp: number;
}

export interface HabitWeekRecord {
  id: string; // e.g. "week-2026-09-07"
  weekStart: string; // Monday YYYY-MM-DD
  weekEnd: string; // Sunday YYYY-MM-DD
  label: string; // e.g. "Sep 7 – Sep 13, 2026"
  archivedAt: number;
  completionRate: number; // 0 - 100
  totalDone: number;
  totalPossible: number;
  habits: HabitItem[];
  activities?: HabitActivityLog[];
}

export type GoalStatus = 'active' | 'upcoming' | 'completed' | 'archived';

export interface GoalMilestone {
  id: string;
  title: string;
  completed: boolean;
}

export interface GoalItem {
  id: string;
  title: string;
  description?: string;
  targetDate?: string;
  progress: number; // 0 - 100
  status: GoalStatus;
  category: 'Career' | 'Finance' | 'Health' | 'Life' | 'Learning' | 'Creative' | string;
  milestones?: GoalMilestone[];
  nextAction?: string;
  icon?: string;
  createdAt: number;
}

export interface VaultCredential {
  id: string;
  service: string;
  username: string;
  maskedSecret: string; // Faux-encrypted client-side string
  category: 'Accounts' | 'API Keys' | 'Servers' | 'Finance' | 'Other';
  notes?: string;
  updatedAt: string;
  strength: 'weak' | 'fair' | 'good' | 'strong';
}

export type ExpenseCategory =
  | 'Groceries & Food'
  | 'Dining Out'
  | 'Snacks & Coffee'
  | 'Shopping & Retail'
  | 'Taxi & Transit'
  | 'Bills & Utilities'
  | 'Living & Rent'
  | 'Tech & Subscriptions'
  | 'Entertainment'
  | 'Health & Fitness'
  | 'Education'
  | 'Travel & Leisure'
  | 'Personal Care'
  | 'Other';

export type PaymentMethod = 'Credit Card' | 'Debit Card' | 'Cash' | 'Apple / Google Pay' | 'Bank Transfer' | 'Other';

export type ExpenseBillingCycle = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'one-time';

export interface ExpenseItem {
  id: string;
  name: string; // Description / Merchant
  amount: number;
  category: ExpenseCategory | string;
  date: string; // Date of purchase/transaction (YYYY-MM-DD)
  paymentMethod?: PaymentMethod | string;
  icon?: string;
  notes?: string;
  billingCycle?: ExpenseBillingCycle;
  active?: boolean;
  sourceFile?: string;
  importBatchId?: string;
  time?: string;
}

export interface ExcelImportLog {
  id: string; // batch ID, e.g. "batch_1725838900000"
  fileName: string;
  uploadDate: string; // ISO timestamp
  addedCount: number; // Number of new spending transactions imported
  skippedCount: number; // Number of duplicate/redundant rows skipped
  totalRowsInSheet: number;
  totalAmountAdded: number;
  dateRange?: { min: string; max: string } | null;
  status: 'active' | 'deleted';
}

export type DiaryTheme = 'parchment' | 'lined' | 'plain' | 'dotted' | 'grid' | 'midnight' | 'lavender';

export interface JournalEntry {
  id: string;
  date: string;
  timestamp: number;
  mood: string; // Emoji
  moodLabel: string;
  title: string;
  content: string;
  tags: string[];
  isLocked?: boolean; // Locked with Vault Master PIN
  isFavorite?: boolean; // Pinned / favorite entry
  theme?: DiaryTheme;
  weather?: string; // '☀️ Sunny' | '🌧️ Rainy' | '🌙 Starry' | '☕ Cozy Indoor' etc.
  energyLevel?: number; // 1 to 5
  location?: string;
}

export interface MediaItem {
  id: string;
  title: string;
  creator: string;
  type: 'movie' | 'book' | 'game' | 'series';
  rating: number; // 1 - 5
  status: 'completed' | 'in-progress' | 'wishlist';
  coverUrl: string;
  genres: string[];
  reviewNotes?: string;
}

export interface AchievementItem {
  id: string;
  title: string;
  issuer: string;
  date: string;
  credentialUrl?: string;
  category: 'Certification' | 'Award' | 'Hackathon' | 'Publication' | string;
  badgeIcon?: string;
  description: string;
}

export interface DoodleItem {
  id: string;
  title: string;
  dataUrl: string;
  createdAt: string;
}

export interface LifeMilestone {
  id: string;
  year: number;
  dateStr: string;
  title: string;
  description: string;
  category: 'Career' | 'Life' | 'Education' | 'Project' | 'Milestone' | 'Health' | 'Personal' | 'Travel' | string;
  icon: string;
  highlight?: boolean;
  status?: 'completed' | 'in_progress' | 'upcoming';
  progress?: number;
  targetDate?: string;
  relatedProject?: string;
  relatedTasksCount?: number;
  mapPosition?: number;
}

export interface PortfolioProject {
  id: string;
  title: string;
  tagLine?: string;
  description: string;
  expandedDescription?: string;
  startDate?: string;
  endDate?: string;
  date?: string;
  techStack?: string[];
  tech?: string[];
  liveUrl?: string;
  link?: string;
  githubUrl?: string;
  github?: string;
  category: 'Frontend' | 'Systems' | 'AI / Data' | 'Open Source' | 'Fullstack' | 'Mobile' | 'Design' | 'Other' | string;
  featured?: boolean;
  accentColor?: string;
  keyResult?: string;
  imageUrl?: string;
  screenshots?: string[];
  role?: string;
  metrics?: string[];
  highlights?: string[];
}

export interface PublicationItem {
  id: string;
  title: string;
  publisher?: string;
  conference?: string;
  year?: string;
  link?: string;
  description?: string;
}

export interface ResumeSectionConfig {
  id: string;
  label: string;
  visible: boolean;
  order: number;
}

export type EducationLevel =
  | 'matriculation'
  | 'intermediate'
  | 'graduation'
  | 'postgraduation'
  | 'doctorate'
  | 'diploma'
  | 'certification'
  | 'other';

export interface EducationRecord {
  id: string;
  level: EducationLevel;
  levelTitle?: string; // e.g. "Matriculation (Class 10th)", "Intermediate (+2 / Class 12th)", "Graduation (Bachelor's Degree)", "Postgraduation (Master's Degree)"
  degree: string; // e.g. "Secondary School Examination", "Higher Secondary (PCM / Science)", "B.Tech in Computer Science & Engineering", "M.Tech in Software Systems"
  institution: string; // School / College / University name
  boardOrUniversity?: string; // e.g. "CBSE", "ICSE", "State Board", "State University", "Autonomous"
  year: string; // e.g. "2016", "2018", "2018 - 2022", "2022 - 2024"
  score: string; // e.g. "94.2%", "9.6 CGPA", "88.5%", "Distinction / 8.9 CGPA"
  scoreType?: 'percentage' | 'cgpa' | 'grade';
  location?: string;
  specialization?: string;
  highlights?: string[];
  icon?: string;
}

export interface JobExperience {
  id: string;
  role: string;
  company: string;
  employmentType?: 'Full-time' | 'Part-time' | 'Contract' | 'Freelance' | 'Internship';
  location?: string;
  startDate: string;
  endDate: string;
  isCurrent?: boolean;
  description: string;
  keyAchievements?: string[];
  techStack?: string[];
}

export interface HobbyItem {
  id: string;
  title: string;
  category: 'Creative' | 'Sports & Fitness' | 'Intellectual' | 'Tech & Gaming' | 'Lifestyle' | string;
  icon: string;
  description: string;
  passionLevel?: string;
}

export interface WorkfolioService {
  id: string;
  title: string;
  icon: string;
  desc: string;
}

export interface WorkfolioTool {
  id: string;
  name: string;
  category: string;
  icon: string;
}

export interface WorkfolioDiscipline {
  id: string;
  title: string;
  icon: string;
  category?: string;
}

export interface SkillItem {
  id?: string;
  name: string;
  level?: number; // 1-100
  proficiency?: number;
  experience?: string;
  highlight?: boolean;
}

export interface SkillCategory {
  category: string;
  skills: SkillItem[];
  icon?: string;
}

export interface CertificationItem {
  id: string;
  name: string;
  title?: string;
  issuer?: string;
  year?: string;
  link?: string;
}

export interface LanguageItem {
  id: string;
  name: string;
  proficiency: string; // e.g. "Fluent", "Native", "Professional", "Conversational", "Basic"
}

export type ResumeThemeStyle = 'modern' | 'jakes' | 'executive';

export interface UserProfile {
  name: string;
  caption?: string;
  handle: string;
  title: string;
  bio: string;
  location: string;
  statusText: string;
  statusEmoji: string;
  avatarUrl: string;
  avatarEnabled?: boolean;
  bannerType: 'gradient' | 'minimal' | 'art' | 'dark-mesh';
  bannerBg: string;
  staticCoverImage?: string;
  coverImageEnabled?: boolean;
  contactEmail: string;
  phone?: string;
  github: string;
  linkedin: string;
  twitter: string;
  facebook?: string;
  website: string;
  resumeAvailable: boolean;
  services?: string[];
  tools?: string[];
  servicesList?: WorkfolioService[];
  toolsList?: WorkfolioTool[];
  disciplinesList?: WorkfolioDiscipline[];
  educationRecords?: EducationRecord[];
  jobExperiences?: JobExperience[];
  hobbies?: HobbyItem[];
  certifications?: CertificationItem[];
  languages?: LanguageItem[];
  achievementsList?: AchievementItem[];
  publications?: PublicationItem[];
  resumeSectionConfig?: ResumeSectionConfig[];
  resumeThemeStyle?: 'modern' | 'jakes' | 'executive';
  professionalSummary?: string;
  careerObjective?: string;
  availabilityStatus?: string;
  yearsOfExperience?: string;
  currentCompany?: string;
  currentDesignation?: string;
  geminiApiKey?: string;
  groqApiKey?: string;
}

export interface AppSettings {
  darkMode: boolean;
  soundEnabled: boolean;
  accentColor: string;
  masterPin: string; // default "1234"
  groqApiKey?: string;
  groqModel?: string;
  geminiApiKey?: string;
  apiMonthlyThreshold?: number | null; // Monthly API request limit (null = unlimited)
}

export interface ApiUsageMonthlyRecord {
  gemini: number;
  groq: number;
  lastGeminiTime?: number;
  lastGroqTime?: number;
  lastUsed?: number;
}

export interface ApiMonthlyStats {
  monthKey: string;
  monthName: string;
  gemini: number;
  groq: number;
  total: number;
  threshold?: number | null;
  percentUsed?: number;
  isApproachingLimit?: boolean;
  isLimitReached?: boolean;
  remainingRequests?: number;
  lastGeminiTime?: number;
  lastGroqTime?: number;
}

export type MainNavView =
  | 'home'
  | 'assistant'
  | 'tasks'
  | 'habits'
  | 'goals'
  | 'timeline'
  | 'exams'
  | 'projects'
  | 'workfolio'
  | 'portfolio'
  | 'resume'
  | 'journal'
  | 'quotes'
  | 'docs'
  | 'media'
  | 'expenses'
  | 'subscriptions'
  | 'vault'
  | 'backup';

export type DashboardBlockType =
  | 'heading'
  | 'text'
  | 'todo_list'
  | 'image'
  | 'callout'
  | 'bookmark'
  | 'quote'
  | 'code'
  | 'metric';

export interface DashboardBlock {
  id: string;
  type: DashboardBlockType;
  content: string;
  properties?: {
    items?: Array<{ id: string; text: string; done: boolean }>;
    url?: string;
    caption?: string;
    icon?: string;
    badge?: string;
    language?: string;
    value?: string;
    change?: string;
    color?: string;
  };
}

export interface DashboardSection {
  id: string;
  title: string;
  icon?: string;
  description?: string;
  blocks: DashboardBlock[];
  collapsed?: boolean;
}

export interface ResumeDocument {
  fileName: string;
  fileSize: string;
  uploadedAt: string;
  summary: string;
  experiences: Array<{
    role: string;
    company: string;
    period: string;
    details: string;
    achievements?: string[];
    techStack?: string[];
  }>;
  education: Array<{
    degree: string;
    school: string;
    year: string;
    score?: string;
    location?: string;
    specialization?: string;
    highlights?: string[];
  }>;
  skills: string[];
  skillsByCategory?: Array<{
    category: string;
    items: string[];
  }>;
  fileDataUrl?: string;
  contact?: {
    name?: string;
    phone?: string;
    email?: string;
    github?: string;
    linkedin?: string;
    location?: string;
    portfolio?: string;
  };
  projects?: Array<{
    title: string;
    subtitle?: string;
    period?: string;
    description?: string;
    techStack?: string[];
    points?: string[];
    link?: string;
  }>;
  certifications?: Array<{
    name: string;
    issuer?: string;
    year?: string;
    link?: string;
  }>;
  additionalInfo?: string[];
}

export interface QuoteItem {
  id: string;
  text: string;
  author: string;
  category?: string;
  createdAt: number;
}

export type QuickCaptureType =
  | 'task'
  | 'journal'
  | 'expense'
  | 'milestone'
  | 'habit'
  | 'vault'
  | 'media'
  | 'quote';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt: number;
  lastLoginAt: number;
  provider: 'supabase' | 'local_demo' | 'local';
}

export interface DeviceSession {
  id: string;
  deviceName: string;
  browser: string;
  os: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  lastActive: number;
  createdAt: number;
  isCurrent?: boolean;
}

export type ExamStageStatus = 'upcoming' | 'ongoing' | 'completed';

export interface ExamStage {
  id: string;
  name: string; // e.g. "Registration", "Prelims", "Mains", "Interview / GD"
  startDate?: string;
  endDate?: string;
  date?: string; // Exact date if single day e.g. "2026-05-24"
  status: ExamStageStatus;
  notes?: string;
}

export interface SyllabusTopic {
  id: string;
  title: string;
  subtopics?: string[];
  completed?: boolean;
  notes?: string;
}

export interface ExamSubject {
  id: string;
  name: string; // e.g. "General Studies I", "Quantitative Aptitude"
  code?: string; // e.g. "GS-1", "QA", "VARC"
  description?: string;
  topics: SyllabusTopic[];
}

export type ExamBookStatus = 'to_read' | 'reading' | 'completed' | 'revision';

export interface ExamBook {
  id: string;
  subjectId?: string; // Matches ExamSubject.id
  subject?: string;
  title: string;
  author?: string;
  status?: ExamBookStatus;
  notes?: string;
  link?: string;
  currentPage?: number;
  totalPages?: number;
  priority?: 'high' | 'medium' | 'low' | 'essential' | 'recommended';
  completed?: boolean;
}

export interface ExamPatternSection {
  id: string;
  name: string;
  questions?: number;
  marks?: number;
  durationMinutes?: number;
  negativeMarking?: string;
}

export interface ExamPattern {
  mode?: string; // e.g. "Pen & Paper (OMR / Descriptive)" | "Computer-Based Test (CBT)"
  totalDuration?: string;
  totalMarks?: number | string;
  negativeMarking?: string;
  description?: string;
  sections?: ExamPatternSection[];
}

export interface SyllabusTableColumn {
  id: string;
  label: string;
  key: string;
  type?: 'text' | 'number' | 'select';
  isCustom?: boolean;
  width?: number;
}

export interface SyllabusTableRow {
  id: string;
  phase: 'Prelims' | 'Mains' | 'Interview' | string;
  subject: string;
  topic: string;
  status: 'Not Started' | 'In Progress' | 'Completed' | 'Revision Needed';
  timesCompleted: number;
  remarks: string;
  customData?: Record<string, string>;
}

export interface ExamItem {
  id: string;
  name: string;
  shortName: string;
  category: 'Civil Services' | 'Management' | 'Defense' | 'Medical' | 'Engineering' | 'State PSC' | 'Banking' | 'Other';
  conductingBody: string;
  targetExamDate: string; // YYYY-MM-DD
  registrationStartDate?: string;
  registrationEndDate?: string;
  registrationDate?: string;
  firstPhaseExamDate?: string;
  currentStage?: string;
  officialWebsite?: string;
  badgeColor?: string;
  icon?: string;
  description?: string;
  pattern?: ExamPattern;
  stages: ExamStage[];
  subjects: ExamSubject[];
  books: ExamBook[]; // Initially empty for new user
  syllabusTableRows?: SyllabusTableRow[];
  syllabusTableColumns?: SyllabusTableColumn[];
  strategyNotes?: string;
  createdAt: number;
  updatedAt: number;
}

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface ScheduleActivity {
  id: string;
  time: string; // e.g. "07:00", "08:30", "13:00", "20:00"
  title: string;
  category?: 'routine' | 'work' | 'health' | 'study' | 'leisure' | 'personal' | string;
  notes?: string;
  color?: string;
  completedDates?: string[]; // Array of YYYY-MM-DD completion dates
}

export interface DayScheduleOverride {
  isCustomized: boolean;
  activities: ScheduleActivity[];
  inheritedFrom?: string;
}

export interface WeeklyScheduleData {
  version: string;
  weekdayTemplate: ScheduleActivity[];
  weekendTemplate: ScheduleActivity[];
  days: Record<DayOfWeek, DayScheduleOverride>;
}

export interface QuickAlarm {
  id: string;
  targetTimestamp: number; // Unix epoch ms
  targetTimeStr: string;   // "14:35"
  label: string;           // "Focus Session"
  createdTimestamp: number;// when the alarm was scheduled
  updatedTimestamp?: number;
  lastAction?: 'set' | 'snooze' | 'dismiss' | 'delete';
  deviceId?: string;
  ringing?: boolean;
}

// ----------------------------------------------------
// Custom Voice Command Mapping System
// ----------------------------------------------------
export type CommandActionType =
  | 'add_expense'
  | 'delete_expense'
  | 'clear_all_expenses'
  | 'add_todo'
  | 'delete_todo'
  | 'toggle_todo'
  | 'clear_all_tasks'
  | 'add_habit'
  | 'toggle_habit'
  | 'navigate_view'
  | 'add_journal'
  | 'add_quote'
  | 'set_alarm'
  | 'cancel_alarm'
  | 'batch_action';

export interface InteractiveOption {
  id: string;
  label: string;
  description?: string;
  variant?: 'default' | 'danger' | 'primary' | 'cancel';
  isDestructive?: boolean;
  actions?: any[];
  payload?: any;
}

export interface CommandMappingParams {
  // For 'add_expense' (maps to handleAddExpense):
  expenseName?: string;
  expenseAmount?: number;
  expenseCategory?: string;
  // For 'add_todo' (maps to handleAddTodo):
  todoTitle?: string;
  todoPriority?: Priority;
  todoCategory?: string;
  todoDueDate?: string;
  // For 'add_habit' (maps to handleAddHabit):
  habitTitle?: string;
  habitCategory?: string;
  // For 'toggle_habit' (maps to handleToggleHabit):
  habitId?: string;
  // For 'navigate_view' (maps to handleNavigate):
  view?: string;
  // For 'add_journal' (maps to handleAddJournalEntry):
  journalTitle?: string;
  journalContent?: string;
  // For 'add_quote' (maps to handleAddQuote):
  quoteText?: string;
  quoteAuthor?: string;
  quoteCategory?: string;
  // For 'set_alarm':
  alarmTime?: string;
  alarmLabel?: string;
}

export type CommandMatchType = 'exact' | 'contains' | 'starts_with';

export interface CommandMapping {
  id: string;
  triggerPhrase: string; // e.g. "log breakfast", "bought coffee", "buy groceries"
  actionType: CommandActionType;
  parameters: CommandMappingParams;
  matchType?: CommandMatchType;
  enabled: boolean;
  description?: string;
  executionCount?: number;
  lastExecutedAt?: number;
  createdAt: number;
}

