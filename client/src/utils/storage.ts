import {
  TodoItem,
  HabitItem,
  HabitWeekRecord,
  HabitActivityLog,
  GoalItem,
  VaultCredential,
  ExpenseItem,
  ExcelImportLog,
  JournalEntry,
  MediaItem,
  AchievementItem,
  DoodleItem,
  LifeMilestone,
  PortfolioProject,
  SkillCategory,
  UserProfile,
  AppSettings,
  DashboardSection,
  ResumeDocument,
  QuoteItem,
  EducationRecord,
  JobExperience,
  HobbyItem,
  ExamItem,
  WeeklyScheduleData,
  ScheduleActivity,
  DayOfWeek,
  DayScheduleOverride,
  QuickAlarm,
  CommandMapping,
} from '../types';
import { STOCK_IMAGES } from '../assets/stockImages';
import { decryptJson, encryptJson, isEncryptedPayload, EncryptedPayload } from './crypto';
import { INITIAL_USER_EXAMS } from '../data/defaultExams';
import { getMondayOfWeek, getWeekId, formatWeekRange } from './habitWeekManager';

export const STORAGE_KEYS = {
  TODOS: 'notion_os_v4_todos',
  HABITS: 'notion_os_v4_habits',
  HABIT_HISTORY: 'notion_os_v4_habit_history',
  HABIT_ACTIVE_WEEK: 'notion_os_v4_habit_active_week',
  HABIT_ACTIVITIES: 'notion_os_v4_habit_activities',
  GOALS: 'notion_os_v4_goals',
  VAULT: 'notion_os_v4_vault',
  EXPENSES: 'notion_os_v4_expenses',
  JOURNAL: 'notion_os_v4_journal',
  MEDIA: 'notion_os_v4_media',
  ACHIEVEMENTS: 'notion_os_v4_achievements',
  DOODLES: 'notion_os_v4_doodles',
  TIMELINE: 'notion_os_v4_timeline',
  PROJECTS: 'notion_os_v4_projects',
  SKILLS: 'notion_os_v4_skills',
  PROFILE: 'notion_os_v4_profile',
  SETTINGS: 'notion_os_v4_settings',
  SECTIONS: 'notion_os_v4_sections',
  PHOTOS: 'notion_os_v4_photos',
  RESUME: 'notion_os_v4_resume',
  QUOTES: 'notion_os_v4_quotes',
  EXAMS: 'notion_os_v5_my_exams',
  SCHEDULE: 'notion_os_v4_schedule',
  HOME_GRID_ORDER: 'notion_os_v4_home_grid_order',
  EXCEL_IMPORT_LOGS: 'notion_os_v4_excel_import_logs',
  ALARM: 'notion_os_v4_active_alarm',
  ALARM_SNOOZE: 'notion_os_v4_alarm_snooze_interval',
  COMMAND_MAPPINGS: 'notion_os_v4_command_mappings',
};

export const DEFAULT_COMMAND_MAPPINGS: CommandMapping[] = [
  {
    id: 'cmd-1',
    triggerPhrase: 'log breakfast',
    actionType: 'add_expense',
    parameters: {
      expenseName: 'Breakfast',
      expenseAmount: 150,
      expenseCategory: 'Dining Out',
    },
    matchType: 'contains',
    enabled: true,
    description: 'Directly calls handleAddExpense to log ₹150 for Breakfast',
    createdAt: 1710000000000,
    executionCount: 0,
  },
  {
    id: 'cmd-2',
    triggerPhrase: 'log lunch',
    actionType: 'add_expense',
    parameters: {
      expenseName: 'Lunch',
      expenseAmount: 250,
      expenseCategory: 'Dining Out',
    },
    matchType: 'contains',
    enabled: true,
    description: 'Directly calls handleAddExpense to log ₹250 for Lunch',
    createdAt: 1710000000000,
    executionCount: 0,
  },
  {
    id: 'cmd-3',
    triggerPhrase: 'morning coffee',
    actionType: 'add_expense',
    parameters: {
      expenseName: 'Coffee',
      expenseAmount: 80,
      expenseCategory: 'Snacks & Coffee',
    },
    matchType: 'contains',
    enabled: true,
    description: 'Directly calls handleAddExpense to log ₹80 for Coffee',
    createdAt: 1710000000000,
    executionCount: 0,
  },
  {
    id: 'cmd-4',
    triggerPhrase: 'buy groceries',
    actionType: 'add_todo',
    parameters: {
      todoTitle: 'Buy groceries & essential supplies',
      todoPriority: 'medium',
      todoCategory: 'Errands',
      todoDueDate: 'today',
    },
    matchType: 'contains',
    enabled: true,
    description: 'Directly calls handleAddTodo to add groceries errand',
    createdAt: 1710000000000,
    executionCount: 0,
  },
  {
    id: 'cmd-5',
    triggerPhrase: 'workout task',
    actionType: 'add_todo',
    parameters: {
      todoTitle: 'Daily workout & physical stretching',
      todoPriority: 'high',
      todoCategory: 'Health',
      todoDueDate: 'today',
    },
    matchType: 'contains',
    enabled: true,
    description: 'Directly calls handleAddTodo to add daily workout task',
    createdAt: 1710000000000,
    executionCount: 0,
  },
  {
    id: 'cmd-6',
    triggerPhrase: 'go to expenses',
    actionType: 'navigate_view',
    parameters: {
      view: 'expenses',
    },
    matchType: 'contains',
    enabled: true,
    description: 'Navigates directly to the Expense Tracker view',
    createdAt: 1710000000000,
    executionCount: 0,
  },
  {
    id: 'cmd-7',
    triggerPhrase: 'go to tasks',
    actionType: 'navigate_view',
    parameters: {
      view: 'todos',
    },
    matchType: 'contains',
    enabled: true,
    description: 'Navigates directly to the Tasks & Todo view',
    createdAt: 1710000000000,
    executionCount: 0,
  },
  {
    id: 'cmd-8',
    triggerPhrase: 'add task',
    actionType: 'add_todo',
    parameters: {
      todoTitle: '',
      todoPriority: 'medium',
      todoCategory: 'General',
      todoDueDate: 'today',
    },
    matchType: 'starts_with',
    enabled: true,
    description: 'Directly creates a task from spoken words (e.g. "add task revise geography")',
    createdAt: 1710000000000,
    executionCount: 0,
  },
  {
    id: 'cmd-9',
    triggerPhrase: 'create task',
    actionType: 'add_todo',
    parameters: {
      todoTitle: '',
      todoPriority: 'medium',
      todoCategory: 'General',
      todoDueDate: 'today',
    },
    matchType: 'starts_with',
    enabled: true,
    description: 'Creates a new task (e.g. "create task prepare presentation")',
    createdAt: 1710000000000,
    executionCount: 0,
  },
  {
    id: 'cmd-10',
    triggerPhrase: 'log expense',
    actionType: 'add_expense',
    parameters: {
      expenseName: '',
      expenseAmount: 100,
      expenseCategory: 'Dining Out',
    },
    matchType: 'starts_with',
    enabled: true,
    description: 'Logs an expense with amount & item (e.g. "log expense 350 for books")',
    createdAt: 1710000000000,
    executionCount: 0,
  },
  {
    id: 'cmd-11',
    triggerPhrase: 'add expense',
    actionType: 'add_expense',
    parameters: {
      expenseName: '',
      expenseAmount: 100,
      expenseCategory: 'Dining Out',
    },
    matchType: 'starts_with',
    enabled: true,
    description: 'Logs an expense (e.g. "add expense 120 coffee")',
    createdAt: 1710000000000,
    executionCount: 0,
  },
  {
    id: 'cmd-12',
    triggerPhrase: 'open habits',
    actionType: 'navigate_view',
    parameters: {
      view: 'habits',
    },
    matchType: 'contains',
    enabled: true,
    description: 'Navigates directly to Habits Tracker',
    createdAt: 1710000000000,
    executionCount: 0,
  },
  {
    id: 'cmd-13',
    triggerPhrase: 'open diary',
    actionType: 'navigate_view',
    parameters: {
      view: 'diary',
    },
    matchType: 'contains',
    enabled: true,
    description: 'Navigates directly to Diary & Journal',
    createdAt: 1710000000000,
    executionCount: 0,
  },
  {
    id: 'cmd-14',
    triggerPhrase: 'open exams',
    actionType: 'navigate_view',
    parameters: {
      view: 'exams',
    },
    matchType: 'contains',
    enabled: true,
    description: 'Navigates directly to Competitive Exams Hub',
    createdAt: 1710000000000,
    executionCount: 0,
  },
  {
    id: 'cmd-15',
    triggerPhrase: 'open dashboard',
    actionType: 'navigate_view',
    parameters: {
      view: 'dashboard',
    },
    matchType: 'contains',
    enabled: true,
    description: 'Navigates back to the main dashboard',
    createdAt: 1710000000000,
    executionCount: 0,
  },
];

export const DEFAULT_HOME_GRID_ORDER: string[] = [
  'calendar',
  'ai_secretary',
  'schedule',
  'expenses',
  'habits',
  'tasks',
];

export const DEFAULT_HOME_COLUMNS: [string[], string[], string[]] = [
  ['calendar', 'habits'],
  ['ai_secretary', 'tasks', 'expenses'],
  ['schedule'],
];

export const DEFAULT_SCHEDULE_ACTIVITIES: ScheduleActivity[] = [
  { id: 'sch-1', time: '7:00 AM', title: 'wake up' },
  { id: 'sch-2', time: '8:00 AM', title: 'breakfast' },
  { id: 'sch-3', time: '9:00 AM', title: 'study' },
  { id: 'sch-4', time: '12:00 PM', title: 'lunch' },
  { id: 'sch-5', time: '3:00 PM', title: 'gym' },
  { id: 'sch-6', time: '5:00 PM', title: 'shower time' },
  { id: 'sch-7', time: '6:00 PM', title: 'chill time' },
  { id: 'sch-8', time: '7:00 PM', title: 'dinner' },
  { id: 'sch-9', time: '9:00 PM', title: 'movie time' },
  { id: 'sch-10', time: '10:00 PM', title: 'tomorrow plan' },
  { id: 'sch-11', time: '11:00 PM', title: 'bed time' },
];

export const INITIAL_SCHEDULE: WeeklyScheduleData = {
  version: '2.0',
  weekdayTemplate: [...DEFAULT_SCHEDULE_ACTIVITIES],
  weekendTemplate: [...DEFAULT_SCHEDULE_ACTIVITIES],
  days: {
    monday: { isCustomized: false, activities: [], inheritedFrom: 'weekday' },
    tuesday: { isCustomized: false, activities: [], inheritedFrom: 'weekday' },
    wednesday: { isCustomized: false, activities: [], inheritedFrom: 'weekday' },
    thursday: { isCustomized: false, activities: [], inheritedFrom: 'weekday' },
    friday: { isCustomized: false, activities: [], inheritedFrom: 'weekday' },
    saturday: { isCustomized: false, activities: [], inheritedFrom: 'weekend' },
    sunday: { isCustomized: false, activities: [], inheritedFrom: 'weekend' },
  },
};

export const INITIAL_EDUCATION_RECORDS: EducationRecord[] = [
  {
    id: 'edu-nit-raipur',
    degree: 'M.Tech in Information Technology',
    level: 'postgraduation',
    levelTitle: 'Postgraduate (M.Tech)',
    institution: 'National Institute of Technology Raipur, Chhattisgarh',
    boardOrUniversity: 'NIT Raipur',
    location: 'Raipur, Chhattisgarh, India',
    year: '2024–2026',
    score: '8.55 CGPA',
    specialization: 'Information Technology',
    highlights: ['Advanced Distributed Systems, AI Architectures & Data Engineering'],
  },
  {
    id: 'edu-vssut-burla',
    degree: 'B.Tech in Information Technology',
    level: 'graduation',
    levelTitle: 'Undergraduate (B.Tech)',
    institution: 'Veer Surendra Sai University of Technology Burla, Odisha',
    boardOrUniversity: 'VSSUT Burla',
    location: 'Burla, Odisha, India',
    year: '2020–2024',
    score: '8.62 CGPA',
    specialization: 'Information Technology',
    highlights: ['Core IT Engineering, Algorithms, Database Management & Full-Stack Systems'],
  },
];

export const INITIAL_JOB_EXPERIENCES: JobExperience[] = [
  {
    id: 'exp-gnanig-2023',
    role: 'Trainee / Intern',
    company: 'GNANIG Technologies',
    startDate: '2023',
    endDate: '2023',
    location: 'India',
    description:
      'Designed and developed a Spring Boot backend application to manage insurance policies, clients, and claims via RESTful APIs.',
    keyAchievements: [
      'Designed and developed a Spring Boot backend application to manage insurance policies, clients, and claims via RESTful APIs.',
      'Implemented robust CRUD operations and integrated MySQL with Spring Data JPA for efficient data storage and retrieval.',
      'Utilized Swagger for comprehensive API documentation, enhancing usability and simplifying testing processes.',
    ],
    techStack: ['Spring Boot', 'Java', 'RESTful APIs', 'MySQL', 'Spring Data JPA', 'Swagger'],
  },
];

export const INITIAL_HOBBIES: HobbyItem[] = [
  {
    id: 'hb-1',
    title: 'Tech Innovation & Open Source',
    icon: '🚀',
    category: 'Tech & Gaming',
    description: 'Exploring modern frameworks, system designs, and contributing to open-source.',
    passionLevel: 'Active Passion',
  },
  {
    id: 'hb-2',
    title: 'Data Analytics & Modeling',
    icon: '📊',
    category: 'Intellectual',
    description: 'Building analytical pipelines, statistical dashboards, and machine learning models.',
    passionLevel: 'Active Passion',
  },
  {
    id: 'hb-3',
    title: 'Competitive Coding & Problem Solving',
    icon: '⚡',
    category: 'Intellectual',
    description: 'Algorithmic problem solving, data structure optimization, and clean architecture.',
    passionLevel: 'Active Passion',
  },
  {
    id: 'hb-4',
    title: 'Continuous Learning',
    icon: '📚',
    category: 'Lifestyle',
    description: 'Reading technical publications, research papers, and software architecture deep dives.',
    passionLevel: 'Active Passion',
  },
];

export const INITIAL_CERTIFICATIONS: Array<{ id: string; name: string; issuer: string; year: string; link?: string }> = [
  { id: 'cert-1', name: 'Power BI', issuer: 'Simplilearn', year: '2024' },
  { id: 'cert-2', name: 'Cisco CCNAv7 Networks', issuer: 'Cisco Networking Academy', year: '2023' },
  { id: 'cert-3', name: 'AWS Machine Learning', issuer: 'Amazon Web Services', year: '2024' },
  { id: 'cert-4', name: 'Data Analysis Using Python', issuer: 'IBM', year: '2023' },
];

export const INITIAL_LANGUAGES: Array<{ id: string; name: string; proficiency: string }> = [
  { id: 'lang-1', name: 'English', proficiency: 'Professional' },
  { id: 'lang-2', name: 'Hindi', proficiency: 'Native / Fluent' },
  { id: 'lang-3', name: 'Odia', proficiency: 'Native' },
];

// Clean Base User Profile formatted according to verified resume
export const INITIAL_PROFILE: UserProfile = {
  name: 'GULSHAN KUMAR NAYAK',
  caption: 'Information Technology Specialist & Software Engineer',
  handle: '@gulshan',
  title: 'Information Technology • Backend, Full Stack & AI Systems',
  bio: 'Passionate and goal-driven Information Technology student with a strong academic foundation and hands-on experience in backend development, full-stack applications, Data Science and Analytics, and AI-integrated systems.',
  location: 'Raipur, Chhattisgarh, India',
  statusText: 'Open to opportunities',
  statusEmoji: '💼',
  avatarUrl: STOCK_IMAGES.avatar,
  avatarEnabled: false,
  bannerType: 'gradient',
  bannerBg: 'linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 50%, #FDF4FF 100%)',
  staticCoverImage: STOCK_IMAGES.workspaceCover,
  coverImageEnabled: true,
  contactEmail: 'gulnayak1206@gmail.com',
  phone: '+91-7304838209',
  github: 'https://github.com',
  linkedin: 'https://linkedin.com',
  twitter: '',
  website: 'https://github.com',
  resumeAvailable: true,
  services: ['Backend API Engineering', 'Full-Stack Web Development', 'Data Analytics & Power BI', 'AI & Computer Vision'],
  tools: ['Java', 'Spring Boot', 'Python', 'React', 'Power BI', 'SQL', 'Postman', 'Git'],
  educationRecords: INITIAL_EDUCATION_RECORDS,
  jobExperiences: INITIAL_JOB_EXPERIENCES,
  hobbies: INITIAL_HOBBIES,
  certifications: INITIAL_CERTIFICATIONS,
  languages: INITIAL_LANGUAGES,
  professionalSummary:
    'Passionate and goal-driven Information Technology student with a strong academic foundation and hands-on experience in backend development, full-stack applications, Data Science and Analytics, and AI-integrated systems. Skilled in a wide range of technologies including Java, Spring Boot, React, Python, Networking, Power BI, Generative AI, LLM, and APIs. Strong problem solving skills, leadership qualities, and commitment to continuous learning and development.',
  careerObjective:
    'Aspiring to contribute as a Software Engineer and Data Analyst, leveraging robust backend skills, AI integrations, and high-impact analytics.',
  availabilityStatus: 'Open to opportunities',
  yearsOfExperience: '1+ yrs',
  currentCompany: 'NIT Raipur',
  currentDesignation: 'M.Tech IT Scholar & Software Developer',
};

// Empty Clean State Collections (No fake/mock data for new accounts)
export const INITIAL_TODOS: TodoItem[] = [];
export const INITIAL_HABITS: HabitItem[] = [];
export const INITIAL_GOALS: GoalItem[] = [];
export const INITIAL_VAULT: VaultCredential[] = [];

let vaultCache: VaultCredential[] = [];

const getVaultStorageKey = () => getScopedKey(STORAGE_KEYS.VAULT);
export const INITIAL_EXPENSES: ExpenseItem[] = [];
export const INITIAL_JOURNAL: JournalEntry[] = [];
export const INITIAL_MEDIA: MediaItem[] = [];
export const INITIAL_ACHIEVEMENTS: AchievementItem[] = [];
export const INITIAL_TIMELINE: LifeMilestone[] = [];
export const INITIAL_PROJECTS: PortfolioProject[] = [
  {
    id: 'proj-exam-dashboard',
    title: 'My Exam Dashboard – Full Stack Application',
    tagLine: 'Exam Management Platform with AI & Real-time Updates',
    description:
      'Developed a full-stack system with JWT-based authentication, complete CRUD operations for exams and categories, and responsive UI with dark/light mode. Integrated AI-powered ChatBot, real-time exam news, live countdown timers and smart recommendations.',
    techStack: ['Next.js', 'React.js', 'Node.js', 'Tailwind CSS', 'JWT', 'RESTful APIs', 'Gemini API'],
    category: 'Fullstack',
    featured: true,
  },
  {
    id: 'proj-data-analytics',
    title: 'Cross-Functional Data Analytics Initiative',
    tagLine: 'Enterprise BI Solutions & Executive Dashboards',
    description:
      'Integrated academic, research, and open-source data to create cross-domain analytics solutions using DAX calculations supported by robust data pipelines with SQL and Power BI tools. Developed dynamic dashboards and reports in Power BI to present insights and enable decision-making across multiple domains.',
    techStack: ['Power BI', 'SQL', 'MS Excel', 'Microsoft Office Suite', 'DAX'],
    category: 'Systems',
    featured: true,
  },
  {
    id: 'proj-pothole-lane',
    title: 'Real-Time Pothole and Lane Detection System',
    tagLine: 'Computer Vision & Deep Learning for Autonomous Driving',
    description:
      'Developed a computer vision system to enhance autonomous driving safety by detecting road potholes and lane markings in real time. Utilized Python, OpenCV, and PyTorch, implementing YOLOv8 and Torchvision for deep learning-based detection with 80% road damage detection accuracy.',
    techStack: ['Python', 'OpenCV', 'PyTorch', 'YOLOv8', 'Torchvision'],
    category: 'Systems',
    featured: true,
  },
];

export const INITIAL_SKILLS: SkillCategory[] = [
  {
    category: 'Programming Languages',
    skills: [
      { name: 'Java', level: 95, experience: 'Proficient', highlight: true },
      { name: 'Python', level: 92, experience: 'Proficient', highlight: true },
      { name: 'C', level: 85, experience: 'Core Language', highlight: false },
      { name: 'C++', level: 88, experience: 'DSA & Systems', highlight: true },
      { name: 'SQL', level: 90, experience: 'Queries & Schemas', highlight: true },
      { name: 'JavaScript', level: 90, experience: 'Web & Node', highlight: true },
      { name: 'HTML', level: 95, experience: 'Frontend', highlight: false },
    ],
  },
  {
    category: 'Tools and Technical Skills',
    skills: [
      { name: 'Spring Boot', level: 92, experience: 'Backend APIs', highlight: true },
      { name: 'Git', level: 95, experience: 'Version Control', highlight: true },
      { name: 'GitHub', level: 95, experience: 'Collaboration & CI', highlight: true },
      { name: 'Postman', level: 90, experience: 'API Testing', highlight: false },
      { name: 'Web Sockets', level: 85, experience: 'Realtime', highlight: false },
      { name: 'Generative AI', level: 90, experience: 'AI Integrations', highlight: true },
      { name: 'LLM', level: 88, experience: 'Prompt & SDKs', highlight: true },
    ],
  },
  {
    category: 'Computer Science Fundamentals',
    skills: [
      { name: 'Data Structures and Algorithms', level: 92, experience: 'Core DSA', highlight: true },
      { name: 'OOP', level: 95, experience: 'Design Patterns', highlight: true },
      { name: 'DBMS', level: 90, experience: 'Relational Design', highlight: true },
      { name: 'Networking', level: 88, experience: 'Protocols & Routing', highlight: false },
    ],
  },
  {
    category: 'Data Visualization & BI',
    skills: [
      { name: 'Power BI', level: 95, experience: 'Calculations & Modeling', highlight: true },
      { name: 'Dashboard Design', level: 92, experience: 'Executive BI', highlight: true },
      { name: 'Data Engineering', level: 88, experience: 'Pipelines & ETL', highlight: false },
      { name: 'Data Mining', level: 86, experience: 'Extraction', highlight: false },
      { name: 'Interactive Visualizations', level: 90, experience: 'Analytics', highlight: true },
    ],
  },
  {
    category: 'Advanced MS Excel',
    skills: [
      { name: 'Pivot Tables', level: 92, experience: 'Data Summarization', highlight: true },
      { name: 'Macros', level: 88, experience: 'VBA Automation', highlight: false },
      { name: 'Lookups', level: 95, experience: 'VLOOKUP / XLOOKUP', highlight: true },
      { name: 'Data Functions', level: 90, experience: 'Formulas & Auditing', highlight: false },
    ],
  },
  {
    category: 'Data Analysis Core Competencies',
    skills: [
      { name: 'Data Visualization & Analytics', level: 92, experience: 'High Impact', highlight: true },
      { name: 'Compliance Tracking', level: 88, experience: 'Governance', highlight: false },
      { name: 'Metrics Analysis', level: 90, experience: 'KPI Tracking', highlight: true },
      { name: 'Data Collection & Integration', level: 88, experience: 'ETL Pipelines', highlight: false },
      { name: 'Cross-functional Teamwork', level: 95, experience: 'Collaboration', highlight: true },
      { name: 'Attention to Detail & Data Accuracy', level: 95, experience: 'Data Integrity', highlight: true },
    ],
  },
];

// Rich Curated Quotes Collection (Consistent across Quotes Section and Dashboard)
export const INITIAL_QUOTES: QuoteItem[] = [
  {
    id: 'q-1',
    text: 'Small daily improvements over time lead to stunning results.',
    author: 'Robin Sharma',
    category: 'Growth',
    createdAt: Date.now() - 1000000,
  },
  {
    id: 'q-2',
    text: 'Discipline is the bridge between goals and accomplishment.',
    author: 'Jim Rohn',
    category: 'Discipline',
    createdAt: Date.now() - 900000,
  },
  {
    id: 'q-3',
    text: 'Focus on being productive instead of busy.',
    author: 'Tim Ferriss',
    category: 'Productivity',
    createdAt: Date.now() - 800000,
  },
  {
    id: 'q-4',
    text: 'You do not rise to the level of your goals. You fall to the level of your systems.',
    author: 'James Clear',
    category: 'Systems',
    createdAt: Date.now() - 700000,
  },
  {
    id: 'q-5',
    text: 'The secret of getting ahead is getting started.',
    author: 'Mark Twain',
    category: 'Action',
    createdAt: Date.now() - 600000,
  },
  {
    id: 'q-6',
    text: 'Simplicity is the prerequisite for reliability.',
    author: 'Edsger W. Dijkstra',
    category: 'Engineering',
    createdAt: Date.now() - 500000,
  },
  {
    id: 'q-7',
    text: 'First, solve the problem. Then, write the code.',
    author: 'John Johnson',
    category: 'Coding',
    createdAt: Date.now() - 400000,
  },
  {
    id: 'q-8',
    text: 'Consistency is the DNA of mastery.',
    author: 'Robin Sharma',
    category: 'Mastery',
    createdAt: Date.now() - 300000,
  },
  {
    id: 'q-9',
    text: 'It always seems impossible until it is done.',
    author: 'Nelson Mandela',
    category: 'Inspiration',
    createdAt: Date.now() - 200000,
  },
  {
    id: 'q-10',
    text: 'The best way to predict the future is to create it.',
    author: 'Peter Drucker',
    category: 'Vision',
    createdAt: Date.now() - 100000,
  },
];

// Demo Mock Data for the test account.
export const DEMO_TODOS: TodoItem[] = [
  {
    id: 'td-1',
    title: 'Review LifeOS real-time synchronization & mobile UI',
    completed: true,
    status: 'complete',
    priority: 'urgent',
    category: 'Tech',
    dueDate: new Date().toISOString().split('T')[0],
    createdAt: Date.now() - 86400000,
  },
  {
    id: 'td-2',
    title: 'Architect distributed database indexing schema',
    completed: false,
    status: 'in_progress',
    priority: 'high',
    category: 'Engineering',
    dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    createdAt: Date.now() - 43200000,
  },
  {
    id: 'td-3',
    title: 'Prepare quarterly engineering milestones & roadmap',
    completed: false,
    status: 'todo',
    priority: 'medium',
    category: 'Career',
    dueDate: new Date(Date.now() + 172800000).toISOString().split('T')[0],
    createdAt: Date.now() - 21600000,
  },
];

export const DEMO_HABITS: HabitItem[] = [
  {
    id: 'hb-1',
    title: 'Deep Focus Coding',
    category: 'Work',
    icon: '⚡',
    completedDays: [true, true, true, true, true, false, false],
    streak: 12,
    color: '#6366F1',
  },
  {
    id: 'hb-2',
    title: 'Daily Workout & Cardio',
    category: 'Health',
    icon: '🏃',
    completedDays: [true, true, false, true, true, true, false],
    streak: 7,
    color: '#10B981',
  },
  {
    id: 'hb-3',
    title: 'Evening Tech Reading',
    category: 'Growth',
    icon: '📚',
    completedDays: [true, true, true, true, false, false, false],
    streak: 5,
    color: '#F59E0B',
  },
];

export const DEMO_EXPENSES: ExpenseItem[] = [
  {
    id: 'exp-1',
    name: 'Grocery & Nutrition Mart',
    amount: 350,
    category: 'Groceries & Food',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'Credit Card',
  },
  {
    id: 'exp-2',
    name: 'Metro Transit Pass',
    amount: 120,
    category: 'Taxi & Transit',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'Apple / Google Pay',
  },
  {
    id: 'exp-3',
    name: 'Cloud Server & Dev Hosting',
    amount: 240,
    category: 'Tech & Subscriptions',
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    paymentMethod: 'Credit Card',
  },
  {
    id: 'exp-4',
    name: 'Coffee & Team Refreshments',
    amount: 95,
    category: 'Snacks & Coffee',
    date: new Date(Date.now() - 172800000).toISOString().split('T')[0],
    paymentMethod: 'Debit Card',
  },
];

export const DEMO_JOURNAL: JournalEntry[] = [
  {
    id: 'jr-1',
    date: new Date().toISOString().split('T')[0],
    timestamp: Date.now() - 3600000,
    mood: '🚀',
    moodLabel: 'Productive',
    title: 'Workspace Architecture & System Flow',
    content: 'Great progress today on engineering intuitive cross-device experiences. Clean state isolation and reliable data persistence make the workflow feel instantaneous.',
    tags: ['Architecture', 'Engineering', 'Focus'],
    theme: 'parchment',
    weather: '☀️ Sunny',
    energyLevel: 5,
  },
];

export const DEMO_TIMELINE: LifeMilestone[] = [
  {
    id: 'ms-1',
    year: 2024,
    dateStr: '2024 - Present',
    title: 'Software Engineer at HCL Software',
    description: 'Engineering scalable enterprise systems, modern microservices, and high-performance digital tools.',
    category: 'Career',
    icon: 'Briefcase',
    highlight: true,
  },
  {
    id: 'ms-2',
    year: 2023,
    dateStr: '2023',
    title: 'Full-Stack Architecture & Cloud Specialization',
    description: 'Developed modern cloud-native distributed tooling and reactive frontends.',
    category: 'Project',
    icon: 'Code',
  },
  {
    id: 'ms-3',
    year: 2022,
    dateStr: '2018 - 2022',
    title: 'B.Tech in Computer Science & Engineering',
    description: 'Graduated with First Class Distinction in Computer Science & Software Systems.',
    category: 'Education',
    icon: 'GraduationCap',
  },
];

export const DEMO_PROJECTS: PortfolioProject[] = [
  {
    id: 'proj-1',
    title: 'Workfolio LifeOS Cloud Workspace',
    tagLine: 'Personal productivity & portfolio operating system',
    description: 'Comprehensive personal operating system with real-time sync, journal, timeline, expense tracking, and resume builder.',
    techStack: ['React', 'TypeScript', 'Tailwind', 'Supabase'],
    category: 'Fullstack',
    featured: true,
  },
  {
    id: 'proj-2',
    title: 'Realtime Data Streaming Pipeline',
    tagLine: 'High-throughput event aggregation architecture',
    description: 'Distributed pub/sub engine with sub-50ms message latency and live dashboard telemetry.',
    techStack: ['TypeScript', 'Node.js', 'PostgreSQL', 'WebSockets'],
    category: 'Systems',
    featured: true,
  },
];

export const DEMO_SKILLS: SkillCategory[] = [
  {
    category: 'Languages & Frameworks',
    skills: [
      { name: 'TypeScript', level: 95, experience: '3+ yrs', highlight: true },
      { name: 'React.js', level: 92, experience: '3+ yrs', highlight: true },
      { name: 'Node.js', level: 88, experience: '2+ yrs', highlight: true },
      { name: 'Tailwind CSS', level: 95, experience: '3+ yrs', highlight: false },
    ],
  },
  {
    category: 'Cloud & Database',
    skills: [
      { name: 'PostgreSQL', level: 85, experience: '2+ yrs', highlight: true },
      { name: 'Supabase', level: 90, experience: '2+ yrs', highlight: true },
      { name: 'REST APIs', level: 92, experience: '3+ yrs', highlight: false },
    ],
  },
];

export const INITIAL_PHOTOS = [
  {
    id: 'ph-1',
    url: STOCK_IMAGES.workspaceCover,
    title: 'Minimalist Engineering Studio',
    subtitle: 'Workspace & Focus',
    tag: 'Deep Work',
  },
  {
    id: 'ph-2',
    url: STOCK_IMAGES.mountainsCover,
    title: 'Alpine Sunrise & Dawn Valley',
    subtitle: 'Nature & Atmosphere',
    tag: 'Calm',
  },
  {
    id: 'ph-3',
    url: STOCK_IMAGES.bambooGardenCover,
    title: 'Zen Japanese Bamboo Grove',
    subtitle: 'Mindfulness & Harmony',
    tag: 'Zen Garden',
  },
  {
    id: 'ph-4',
    url: STOCK_IMAGES.architectureCover,
    title: 'Clean Travertine Architecture',
    subtitle: 'Geometry & Minimalism',
    tag: 'Design',
  },
];

export const DEFAULT_ATS_RESUME: ResumeDocument = {
  fileName: 'Gulshan_Kumar_Nayak_Resume.pdf',
  fileSize: '128 KB',
  uploadedAt: 'Verified ATS Format',
  summary:
    'Passionate and goal-driven Information Technology student with a strong academic foundation and hands-on experience in backend development, full-stack applications, Data Science and Analytics, and AI-integrated systems. Skilled in a wide range of technologies including Java, Spring Boot, React, Python, Networking, Power BI, Generative AI, LLM, and APIs. Strong problem solving skills, leadership qualities, and commitment to continuous learning and development.',
  contact: {
    name: 'GULSHAN KUMAR NAYAK',
    phone: '+91-7304838209',
    email: 'gulnayak1206@gmail.com',
    github: 'https://github.com',
    linkedin: 'https://linkedin.com',
    location: 'Raipur, Chhattisgarh, India',
    portfolio: 'https://github.com',
  },
  skills: [
    'Java', 'Spring Boot', 'Python', 'C', 'C++', 'SQL', 'JavaScript', 'HTML', 'React',
    'Power BI', 'Git', 'GitHub', 'Postman', 'Web Sockets', 'Generative AI', 'LLM',
    'Data Structures and Algorithms', 'OOP', 'DBMS', 'Networking', 'Advanced MS Excel'
  ],
  skillsByCategory: [
    {
      category: 'Programming Languages',
      items: ['C', 'C++', 'HTML', 'JavaScript', 'Java', 'Python', 'SQL'],
    },
    {
      category: 'Tools and Technical Skills',
      items: ['Git', 'GitHub', 'Spring Boot', 'Postman', 'Web Sockets', 'Generative AI', 'LLM'],
    },
    {
      category: 'Computer Science Fundamentals',
      items: ['Data Structures and Algorithms', 'OOP', 'DBMS', 'Networking'],
    },
    {
      category: 'Data Visualization & BI',
      items: [
        'Power BI (calculations, dashboard design, data engineering, data mining, interactive visualizations)',
      ],
    },
    {
      category: 'Advanced MS Excel',
      items: ['Pivot Tables', 'Macros', 'Lookups', 'Data Functions'],
    },
    {
      category: 'Data Analysis Core Competencies',
      items: [
        'Data Visualization & Analytics',
        'Compliance Tracking',
        'Metrics Analysis',
        'Data Collection & Integration',
        'Cross-functional Teamwork',
        'Attention to Detail & Data Accuracy',
      ],
    },
  ],
  education: [
    {
      school: 'National Institute of Technology Raipur, Chhattisgarh',
      degree: 'M.Tech in Information Technology',
      year: '2024–2026',
      score: '8.55 CGPA',
      location: 'Raipur, Chhattisgarh',
      specialization: 'Information Technology',
      highlights: ['Advanced Distributed Systems, AI Architectures & Data Engineering'],
    },
    {
      school: 'Veer Surendra Sai University of Technology Burla, Odisha',
      degree: 'B.Tech in Information Technology',
      year: '2020–2024',
      score: '8.62 CGPA',
      location: 'Burla, Odisha',
      specialization: 'Information Technology',
      highlights: ['Core IT Engineering, Algorithms, Database Management & Full-Stack Systems'],
    },
  ],
  experiences: [
    {
      role: 'Trainee / Intern',
      company: 'GNANIG Technologies',
      period: '2023',
      details:
        'Designed and developed a Spring Boot backend application to manage insurance policies, clients, and claims via RESTful APIs.',
      achievements: [
        'Designed and developed a Spring Boot backend application to manage insurance policies, clients, and claims via RESTful APIs.',
        'Implemented robust CRUD operations and integrated MySQL with Spring Data JPA for efficient data storage and retrieval.',
        'Utilized Swagger for comprehensive API documentation, enhancing usability and simplifying testing processes.',
      ],
      techStack: ['Spring Boot', 'Java', 'RESTful APIs', 'MySQL', 'Spring Data JPA', 'Swagger'],
    },
  ],
  projects: [
    {
      title: 'My Exam Dashboard– Full Stack Application',
      subtitle: 'Exam management platform with AI-powered features, real-time updates, and intelligent chatbot assistance.',
      period: '2025',
      description:
        'Developed a full-stack system with JWT-based authentication, complete CRUD operations for exams and categories, and responsive UI with dark/light mode. Integrated AI-powered ChatBot, real-time exam news, live countdown timers and smart recommendations for users.',
      techStack: ['Next.js', 'React.js', 'Node.js', 'Tailwind CSS', 'JWT', 'RESTful APIs', 'Gemini API'],
      points: [
        'Tools & technologies used: Next.js, React.js, Node.js, Tailwind CSS, JWT, RESTful APIs, Gemini API.',
        'Developed a full-stack system with JWT-based authentication, complete CRUD operations for exams and categories, and responsive UI with dark/light mode.',
        'AI-powered ChatBot, real-time exam news, live countdown timers and smart recommendations for users.',
      ],
    },
    {
      title: 'Cross-Functional Data Analytics Initiative',
      subtitle: 'Tech Stack: Power BI, SQL, MS Excel, Microsoft Office Suite',
      period: '2025',
      description:
        'Integrated academic, research, and open-source data to create cross-domain analytics solutions using DAX calculations supported by robust data pipelines with SQL and Power BI tools.',
      techStack: ['Power BI', 'SQL', 'MS Excel', 'Microsoft Office Suite', 'DAX'],
      points: [
        'Integrated academic, research, and open-source data to create cross-domain analytics solutions using DAX calculations supported by robust data pipelines with SQL and Power BI tools',
        'Developed dynamic dashboards and reports in Power BI to present insights and enable decision-making across multiple domains',
        'Authored clear project documentation in Word, PowerPoint, demonstrating adaptability to evolving requirements',
      ],
    },
    {
      title: 'Real-Time Pothole and Lane Detection System',
      subtitle: 'Tech Stack: Python, OpenCV, PyTorch, YOLOv8, Torchvision',
      period: '2024',
      description:
        'Developed a computer vision system to enhance autonomous driving safety by detecting road potholes and lane markings in real time.',
      techStack: ['Python', 'OpenCV', 'PyTorch', 'YOLOv8', 'Torchvision'],
      points: [
        'Developed a computer vision system to enhance autonomous driving safety by detecting road potholes and lane markings in real time',
        'Utilized Python, OpenCV, and PyTorch, implementing YOLOv8 and Torchvision for deep learning-based detection',
        'Achieved 80% accuracy in road damage detection on custom datasets, and integrated robust lane detection using OpenCV line detection and perspective transformation techniques',
      ],
    },
  ],
  certifications: [
    { name: 'Power BI', issuer: 'Simplilearn', year: '2024' },
    { name: 'Cisco CCNAv7 Networks', issuer: 'Cisco Networking Academy', year: '2023' },
    { name: 'AWS Machine Learning', issuer: 'Amazon Web Services', year: '2024' },
    { name: 'Data Analysis Using Python', issuer: 'IBM', year: '2023' },
  ],
  additionalInfo: [
    'Fast learner—comfortable mastering new technologies according to the project needs.',
    'Excellent written and verbal communication skills.',
  ],
};

export const INITIAL_RESUME: ResumeDocument = DEFAULT_ATS_RESUME;

export const INITIAL_SECTIONS: DashboardSection[] = [];

export const INITIAL_SETTINGS: AppSettings = {
  darkMode: false,
  soundEnabled: true,
  accentColor: '#2563eb',
  masterPin: '',
  groqApiKey: '',
  groqModel: 'llama-3.3-70b-versatile',
};

import { getCustomWorkspaceIdentifier } from './supabase';

// Helper to determine if current workspace is the mock demo account
export const isDemoWorkspace = (): boolean => {
  return false;
};

// Compute workspace-scoped key for complete data isolation between accounts
export function getScopedKey(baseKey: string): string {
  const ws = getCustomWorkspaceIdentifier();
  return `${ws}_${baseKey}`;
}

// Safe Generic Storage Helpers
export function loadFromStorage<T>(baseKey: string, fallback: T): T {
  try {
    const scopedKey = getScopedKey(baseKey);
    const raw = localStorage.getItem(scopedKey);
    if (raw !== null) {
      return JSON.parse(raw) as T;
    }
    // Also check unscoped legacy key
    const legacyRaw = localStorage.getItem(baseKey);
    if (legacyRaw !== null) {
      return JSON.parse(legacyRaw) as T;
    }
    return fallback;
  } catch (err) {
    console.warn(`Error reading key ${baseKey} from localStorage:`, err);
    return fallback;
  }
}

export function saveToStorage<T>(baseKey: string, value: T): void {
  try {
    const scopedKey = getScopedKey(baseKey);
    const serialized = JSON.stringify(value);
    localStorage.setItem(scopedKey, serialized);
    // Keep legacy/unscoped key strictly in sync so direct reads never fetch stale data
    localStorage.setItem(baseKey, serialized);
  } catch (err) {
    console.warn(`Error writing key ${baseKey} to localStorage:`, err);
  }
}

// Concrete Loaders & Getters
export const Storage = {
  getTodos: (): TodoItem[] => loadFromStorage(STORAGE_KEYS.TODOS, INITIAL_TODOS),
  setTodos: (items: TodoItem[]) => saveToStorage(STORAGE_KEYS.TODOS, items),

  getHabits: (): HabitItem[] => loadFromStorage(STORAGE_KEYS.HABITS, INITIAL_HABITS),
  setHabits: (items: HabitItem[]) => saveToStorage(STORAGE_KEYS.HABITS, items),

  getHabitHistory: (): HabitWeekRecord[] => {
    const raw = loadFromStorage<HabitWeekRecord[]>(STORAGE_KEYS.HABIT_HISTORY, []);
    if (!Array.isArray(raw)) return [];
    const currentMonday = getMondayOfWeek();
    const currentWeekId = getWeekId(currentMonday);
    const currentWeekLabel = formatWeekRange(currentMonday);
    return raw.filter((w) => {
      if (!w) return false;
      const isSameId = w.id === `week-${currentWeekId}` || w.id === currentWeekId;
      const isSameStart = w.weekStart === currentWeekId;
      const isSameLabel =
        w.label?.trim().toLowerCase() === currentWeekLabel?.trim().toLowerCase() ||
        (w.label?.toLowerCase().includes('sep 14') && currentWeekLabel?.toLowerCase().includes('sep 14'));
      return !isSameId && !isSameStart && !isSameLabel;
    });
  },
  setHabitHistory: (items: HabitWeekRecord[]) => saveToStorage(STORAGE_KEYS.HABIT_HISTORY, items),

  getHabitActiveWeek: (): string => loadFromStorage(STORAGE_KEYS.HABIT_ACTIVE_WEEK, ''),
  setHabitActiveWeek: (weekId: string) => saveToStorage(STORAGE_KEYS.HABIT_ACTIVE_WEEK, weekId),

  getHabitActivities: (): HabitActivityLog[] => loadFromStorage(STORAGE_KEYS.HABIT_ACTIVITIES, []),
  setHabitActivities: (items: HabitActivityLog[]) => saveToStorage(STORAGE_KEYS.HABIT_ACTIVITIES, items),

  getGoals: (): GoalItem[] => loadFromStorage(STORAGE_KEYS.GOALS, INITIAL_GOALS),
  setGoals: (items: GoalItem[]) => saveToStorage(STORAGE_KEYS.GOALS, items),

  getVault: (): VaultCredential[] => vaultCache,
  setVault: async (items: VaultCredential[], pin: string): Promise<void> => {
    vaultCache = items;
    if (!pin) return;
    const encrypted = await encryptJson(items, pin);
    localStorage.setItem(getVaultStorageKey(), JSON.stringify(encrypted));
  },
  hydrateVault: async (pin: string): Promise<VaultCredential[]> => {
    if (!pin) {
      vaultCache = [];
      return vaultCache;
    }
    const raw = localStorage.getItem(getVaultStorageKey());
    if (!raw) {
      vaultCache = [];
      return vaultCache;
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (isEncryptedPayload(parsed)) {
        vaultCache = await decryptJson<VaultCredential[]>(parsed, pin);
      } else if (Array.isArray(parsed)) {
        // One-time migration of legacy plaintext vaults.
        vaultCache = parsed as VaultCredential[];
        await Storage.setVault(vaultCache, pin);
      } else {
        vaultCache = [];
      }
    } catch {
      vaultCache = [];
    }
    return vaultCache;
  },
  getEncryptedVaultBackup: (): EncryptedPayload | null => {
    try {
      const raw = localStorage.getItem(getVaultStorageKey());
      return raw ? JSON.parse(raw) as EncryptedPayload : null;
    } catch {
      return null;
    }
  },
  restoreEncryptedVault: (payload: EncryptedPayload | null) => {
    if (payload && isEncryptedPayload(payload)) {
      localStorage.setItem(getVaultStorageKey(), JSON.stringify(payload));
      vaultCache = [];
    }
  },

  getExpenses: (): ExpenseItem[] => loadFromStorage(STORAGE_KEYS.EXPENSES, INITIAL_EXPENSES),
  setExpenses: (items: ExpenseItem[]) => saveToStorage(STORAGE_KEYS.EXPENSES, items),

  getExcelImportLogs: (): ExcelImportLog[] => {
    const logs = loadFromStorage<ExcelImportLog[]>(STORAGE_KEYS.EXCEL_IMPORT_LOGS, []);
    return Array.isArray(logs) ? logs : [];
  },
  setExcelImportLogs: (logs: ExcelImportLog[]) => saveToStorage(STORAGE_KEYS.EXCEL_IMPORT_LOGS, logs),
  addExcelImportLog: (log: ExcelImportLog) => {
    const logs = Storage.getExcelImportLogs();
    const updated = [log, ...logs.filter((l) => l.id !== log.id)];
    Storage.setExcelImportLogs(updated);
    return updated;
  },
  deleteExcelImportLog: (id: string) => {
    const logs = Storage.getExcelImportLogs();
    const updated = logs.filter((l) => l.id !== id);
    Storage.setExcelImportLogs(updated);
    return updated;
  },

  getJournal: (): JournalEntry[] => loadFromStorage(STORAGE_KEYS.JOURNAL, INITIAL_JOURNAL),
  setJournal: (items: JournalEntry[]) => saveToStorage(STORAGE_KEYS.JOURNAL, items),

  getMedia: (): MediaItem[] => loadFromStorage(STORAGE_KEYS.MEDIA, INITIAL_MEDIA),
  setMedia: (items: MediaItem[]) => saveToStorage(STORAGE_KEYS.MEDIA, items),

  getAchievements: (): AchievementItem[] => loadFromStorage(STORAGE_KEYS.ACHIEVEMENTS, INITIAL_ACHIEVEMENTS),
  setAchievements: (items: AchievementItem[]) => saveToStorage(STORAGE_KEYS.ACHIEVEMENTS, items),

  getDoodles: (): DoodleItem[] => loadFromStorage(STORAGE_KEYS.DOODLES, []),
  setDoodles: (items: DoodleItem[]) => saveToStorage(STORAGE_KEYS.DOODLES, items),

  getTimeline: (): LifeMilestone[] => loadFromStorage(STORAGE_KEYS.TIMELINE, INITIAL_TIMELINE),
  setTimeline: (items: LifeMilestone[]) => saveToStorage(STORAGE_KEYS.TIMELINE, items),

  getProjects: (): PortfolioProject[] => {
    const loaded = loadFromStorage(STORAGE_KEYS.PROJECTS, INITIAL_PROJECTS);
    if (!loaded || !Array.isArray(loaded) || loaded.length === 0) {
      return INITIAL_PROJECTS;
    }
    return loaded;
  },
  setProjects: (items: PortfolioProject[]) => saveToStorage(STORAGE_KEYS.PROJECTS, items),

  getSkills: (): SkillCategory[] => {
    const loaded = loadFromStorage(STORAGE_KEYS.SKILLS, INITIAL_SKILLS);
    if (!loaded || !Array.isArray(loaded) || loaded.length === 0) {
      return INITIAL_SKILLS;
    }
    return loaded;
  },
  setSkills: (items: SkillCategory[]) => saveToStorage(STORAGE_KEYS.SKILLS, items),

  getProfile: (): UserProfile => {
    const data = loadFromStorage(STORAGE_KEYS.PROFILE, INITIAL_PROFILE);
    if (!data.name || !data.name.trim()) {
      data.name = INITIAL_PROFILE.name;
      data.caption = INITIAL_PROFILE.caption;
      data.handle = INITIAL_PROFILE.handle;
      data.title = INITIAL_PROFILE.title;
      data.bio = INITIAL_PROFILE.bio;
      data.location = INITIAL_PROFILE.location;
      data.contactEmail = INITIAL_PROFILE.contactEmail;
      data.phone = INITIAL_PROFILE.phone;
      data.github = INITIAL_PROFILE.github;
      data.linkedin = INITIAL_PROFILE.linkedin;
      data.website = INITIAL_PROFILE.website;
      data.professionalSummary = INITIAL_PROFILE.professionalSummary;
    }
    if (!data.avatarUrl) {
      data.avatarUrl = STOCK_IMAGES.avatar;
    }
    if (!data.educationRecords || data.educationRecords.length === 0) {
      data.educationRecords = INITIAL_EDUCATION_RECORDS;
    } else {
      data.educationRecords = data.educationRecords.map((edu) => {
        if (
          (edu.id === 'edu-nit-raipur' ||
            edu.degree?.toLowerCase().includes('m.tech') ||
            edu.institution?.toLowerCase().includes('raipur')) &&
          (edu.score === '8.18 CGPA' || edu.score === '8.18')
        ) {
          return { ...edu, score: '8.55 CGPA' };
        }
        return edu;
      });
    }
    if (!data.jobExperiences || data.jobExperiences.length === 0) {
      data.jobExperiences = INITIAL_JOB_EXPERIENCES;
    }
    if (!data.hobbies || data.hobbies.length === 0) {
      data.hobbies = INITIAL_HOBBIES;
    }
    if (!data.certifications || data.certifications.length === 0) {
      data.certifications = INITIAL_CERTIFICATIONS;
    }
    if (!data.languages || data.languages.length === 0) {
      data.languages = INITIAL_LANGUAGES;
    }
    if (!data.services || data.services.length === 0) {
      data.services = INITIAL_PROFILE.services;
    }
    if (!data.tools || data.tools.length === 0) {
      data.tools = INITIAL_PROFILE.tools;
    }
    return data;
  },
  setProfile: (profile: UserProfile) => {
    return saveToStorage(STORAGE_KEYS.PROFILE, profile);
  },

  getSettings: (): AppSettings => {
    const s = loadFromStorage<AppSettings>(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS);
    const DEPRECATED = ['mixtral-8x7b-32768', 'llama3-70b-8192', 'llama3-8b-8192', 'gemma-7b-it', 'gemma2-9b-it'];
    if (s && s.groqModel && DEPRECATED.includes(s.groqModel.trim())) {
      s.groqModel = 'llama-3.3-70b-versatile';
      saveToStorage(STORAGE_KEYS.SETTINGS, s);
    }
    return s;
  },
  setSettings: (settings: AppSettings) => saveToStorage(STORAGE_KEYS.SETTINGS, settings),

  getGroqModel: (): string => {
    const settings = Storage.getSettings();
    const DEPRECATED = ['mixtral-8x7b-32768', 'llama3-70b-8192', 'llama3-8b-8192', 'gemma-7b-it', 'gemma2-9b-it'];
    if (settings?.groqModel && !DEPRECATED.includes(settings.groqModel.trim())) {
      return settings.groqModel.trim();
    }
    const directModel = localStorage.getItem('groq_model');
    if (directModel && !DEPRECATED.includes(directModel.trim())) {
      return directModel.trim();
    }
    return 'llama-3.3-70b-versatile';
  },
  setGroqModel: (model: string): void => {
    const settings = Storage.getSettings();
    const cleanModel = model.trim() || 'llama-3.3-70b-versatile';
    Storage.setSettings({ ...settings, groqModel: cleanModel });
    localStorage.setItem('groq_model', cleanModel);
  },

  getGroqApiKey: (): string => {
    const settings = Storage.getSettings();
    if (settings?.groqApiKey?.trim()) return settings.groqApiKey.trim();
    const directKey = localStorage.getItem('groq_api_key');
    if (directKey?.trim()) return directKey.trim();
    return '';
  },
  setGroqApiKey: (key: string): void => {
    const settings = Storage.getSettings();
    const trimmed = key.trim();
    Storage.setSettings({ ...settings, groqApiKey: trimmed });
    if (trimmed) {
      localStorage.setItem('groq_api_key', trimmed);
    } else {
      localStorage.removeItem('groq_api_key');
    }
  },

  getSections: (): DashboardSection[] => loadFromStorage(STORAGE_KEYS.SECTIONS, INITIAL_SECTIONS),
  setSections: (sections: DashboardSection[]) => saveToStorage(STORAGE_KEYS.SECTIONS, sections),

  getPhotos: (): Array<{ id: string; url: string; title: string; subtitle?: string; tag?: string }> =>
    loadFromStorage(STORAGE_KEYS.PHOTOS, INITIAL_PHOTOS),
  setPhotos: (photos: Array<{ id: string; url: string; title: string; subtitle?: string; tag?: string }>) =>
    saveToStorage(STORAGE_KEYS.PHOTOS, photos),

  getResume: (): ResumeDocument => {
    const loaded = loadFromStorage<ResumeDocument>(STORAGE_KEYS.RESUME, INITIAL_RESUME);
    if (!loaded || !loaded.summary || !loaded.summary.trim() || !loaded.skills || loaded.skills.length === 0) {
      saveToStorage(STORAGE_KEYS.RESUME, DEFAULT_ATS_RESUME);
      return DEFAULT_ATS_RESUME;
    }
    // ensure all sections are populated
    if (!loaded.contact) loaded.contact = DEFAULT_ATS_RESUME.contact;
    if (!loaded.projects || loaded.projects.length === 0) loaded.projects = DEFAULT_ATS_RESUME.projects;
    if (!loaded.certifications || loaded.certifications.length === 0) loaded.certifications = DEFAULT_ATS_RESUME.certifications;
    if (!loaded.additionalInfo || loaded.additionalInfo.length === 0) loaded.additionalInfo = DEFAULT_ATS_RESUME.additionalInfo;
    if (!loaded.skillsByCategory || loaded.skillsByCategory.length === 0) loaded.skillsByCategory = DEFAULT_ATS_RESUME.skillsByCategory;
    if (loaded.education && Array.isArray(loaded.education)) {
      loaded.education = loaded.education.map((edu) => {
        if (
          (edu.school?.toLowerCase().includes('raipur') ||
            edu.degree?.toLowerCase().includes('m.tech')) &&
          (edu.score === '8.18 CGPA' || edu.score === '8.18')
        ) {
          return { ...edu, score: '8.55 CGPA' };
        }
        return edu;
      });
    }
    return loaded;
  },
  setResume: (resume: ResumeDocument) => saveToStorage(STORAGE_KEYS.RESUME, resume),

  getQuotes: (): QuoteItem[] => {
    const loaded = loadFromStorage<QuoteItem[]>(STORAGE_KEYS.QUOTES, INITIAL_QUOTES);
    if (!loaded || !Array.isArray(loaded) || loaded.length === 0) {
      saveToStorage(STORAGE_KEYS.QUOTES, INITIAL_QUOTES);
      return INITIAL_QUOTES;
    }
    return loaded;
  },
  setQuotes: (quotes: QuoteItem[]) => saveToStorage(STORAGE_KEYS.QUOTES, quotes),

  getExams: (): ExamItem[] => {
    const loaded = loadFromStorage<ExamItem[] | null>(STORAGE_KEYS.EXAMS, null);
    if (loaded === null) {
      // By default on clicking exam section, My Exams opens as a clean blank state
      return [];
    }
    return Array.isArray(loaded) ? loaded : [];
  },
  setExams: (exams: ExamItem[]) => saveToStorage(STORAGE_KEYS.EXAMS, exams),

  getSchedule: (): WeeklyScheduleData => {
    const loaded = loadFromStorage<WeeklyScheduleData | null>(STORAGE_KEYS.SCHEDULE, null);
    if (!loaded || typeof loaded !== 'object' || loaded.version !== '2.0') {
      return INITIAL_SCHEDULE;
    }
    return {
      version: '2.0',
      weekdayTemplate: Array.isArray(loaded.weekdayTemplate) && loaded.weekdayTemplate.length > 0
        ? loaded.weekdayTemplate
        : INITIAL_SCHEDULE.weekdayTemplate,
      weekendTemplate: Array.isArray(loaded.weekendTemplate) && loaded.weekendTemplate.length > 0
        ? loaded.weekendTemplate
        : INITIAL_SCHEDULE.weekendTemplate,
      days: {
        monday: loaded.days?.monday || INITIAL_SCHEDULE.days.monday,
        tuesday: loaded.days?.tuesday || INITIAL_SCHEDULE.days.tuesday,
        wednesday: loaded.days?.wednesday || INITIAL_SCHEDULE.days.wednesday,
        thursday: loaded.days?.thursday || INITIAL_SCHEDULE.days.thursday,
        friday: loaded.days?.friday || INITIAL_SCHEDULE.days.friday,
        saturday: loaded.days?.saturday || INITIAL_SCHEDULE.days.saturday,
        sunday: loaded.days?.sunday || INITIAL_SCHEDULE.days.sunday,
      },
    };
  },
  setSchedule: (schedule: WeeklyScheduleData) => saveToStorage(STORAGE_KEYS.SCHEDULE, schedule),

  getHomeGridColumns: (): [string[], string[], string[]] => {
    const raw = loadFromStorage<any>(STORAGE_KEYS.HOME_GRID_ORDER, null);
    const validWidgets = new Set(['calendar', 'schedule', 'expenses', 'habits', 'tasks', 'ai_secretary']);

    if (Array.isArray(raw) && raw.length === 3 && Array.isArray(raw[0]) && Array.isArray(raw[1]) && Array.isArray(raw[2])) {
      const col0 = raw[0].filter((w: string) => validWidgets.has(w));
      const col1 = raw[1].filter((w: string) => validWidgets.has(w));
      const col2 = raw[2].filter((w: string) => validWidgets.has(w));

      const present = new Set([...col0, ...col1, ...col2]);
      if (!present.has('ai_secretary')) {
        // Place next to calendar at top of col 1
        col1.unshift('ai_secretary');
        present.add('ai_secretary');
      }
      validWidgets.forEach((w) => {
        if (!present.has(w)) {
          col2.push(w);
        }
      });
      return [col0, col1, col2];
    }

    // If stored as flat array from prior version, smartly distribute
    if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'string') {
      const flatItems = raw.filter((w: string) => validWidgets.has(w));
      validWidgets.forEach((w) => {
        if (!flatItems.includes(w)) flatItems.push(w);
      });
      const col0: string[] = flatItems.includes('calendar') ? ['calendar'] : [];
      const col1: string[] = flatItems.includes('schedule') ? ['schedule'] : [];
      const col2: string[] = flatItems.filter((w) => w !== 'calendar' && w !== 'schedule');
      return [col0, col1, col2];
    }

    return [
      [...DEFAULT_HOME_COLUMNS[0]],
      [...DEFAULT_HOME_COLUMNS[1]],
      [...DEFAULT_HOME_COLUMNS[2]],
    ];
  },
  setHomeGridColumns: (columns: [string[], string[], string[]]) => {
    saveToStorage(STORAGE_KEYS.HOME_GRID_ORDER, columns);
  },

  getHomeGridOrder: (): string[] => {
    const columns = Storage.getHomeGridColumns();
    return [...columns[0], ...columns[1], ...columns[2]];
  },
  setHomeGridOrder: (order: string[]) => {
    const col0: string[] = order.includes('calendar') ? ['calendar'] : [];
    const col1: string[] = order.includes('schedule') ? ['schedule'] : [];
    const col2: string[] = order.filter((w) => w !== 'calendar' && w !== 'schedule');
    Storage.setHomeGridColumns([col0, col1, col2]);
  },

  getHomeGridLayoutPreset: (): 'executive' | 'schedule-hero' | 'calendar-hero' | 'custom' => {
    return loadFromStorage<any>('notion_os_v4_home_grid_preset', 'executive');
  },
  setHomeGridLayoutPreset: (preset: 'executive' | 'schedule-hero' | 'calendar-hero' | 'custom') => {
    saveToStorage('notion_os_v4_home_grid_preset', preset);
  },

  getActiveAlarm: (): QuickAlarm | null => {
    return loadFromStorage<QuickAlarm | null>(STORAGE_KEYS.ALARM, null);
  },
  setActiveAlarm: (alarm: QuickAlarm | null) => {
    saveToStorage(STORAGE_KEYS.ALARM, alarm);
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('alarm-data-updated', { detail: { alarm } }));
      }
    } catch {}
  },

  getAlarmSnoozeInterval: (): number => {
    return loadFromStorage<number>(STORAGE_KEYS.ALARM_SNOOZE, 5);
  },
  setAlarmSnoozeInterval: (mins: number) => {
    saveToStorage(STORAGE_KEYS.ALARM_SNOOZE, mins);
  },

  // Command Mapping Storage
  getCommandMappings: (): CommandMapping[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.COMMAND_MAPPINGS);
      if (!raw) {
        localStorage.setItem(STORAGE_KEYS.COMMAND_MAPPINGS, JSON.stringify(DEFAULT_COMMAND_MAPPINGS));
        return DEFAULT_COMMAND_MAPPINGS;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const existingIds = new Set(parsed.map((m: any) => m.id));
        const missing = DEFAULT_COMMAND_MAPPINGS.filter((d) => !existingIds.has(d.id));
        if (missing.length > 0) {
          const merged = [...parsed, ...missing];
          localStorage.setItem(STORAGE_KEYS.COMMAND_MAPPINGS, JSON.stringify(merged));
          return merged;
        }
        return parsed;
      }
      return DEFAULT_COMMAND_MAPPINGS;
    } catch {
      return DEFAULT_COMMAND_MAPPINGS;
    }
  },
  setCommandMappings: (mappings: CommandMapping[]) => {
    try {
      localStorage.setItem(STORAGE_KEYS.COMMAND_MAPPINGS, JSON.stringify(mappings));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('command-mappings-updated', { detail: { mappings } }));
        window.dispatchEvent(new CustomEvent('dashboard-data-updated', { detail: { module: 'command_mappings' } }));
      }
    } catch (e) {
      console.error('Failed to persist command mappings:', e);
    }
  },

  getAllDataPayload: () => {
    return {
      version: '4.0.0',
      exportedAt: new Date().toISOString(),
      profile: Storage.getProfile(),
      todos: Storage.getTodos(),
      habits: Storage.getHabits(),
      habitHistory: Storage.getHabitHistory(),
      habitActiveWeek: Storage.getHabitActiveWeek(),
      habitActivities: Storage.getHabitActivities(),
      goals: Storage.getGoals(),
      vaultEncrypted: Storage.getEncryptedVaultBackup(),
      expenses: Storage.getExpenses(),
      excelImportLogs: Storage.getExcelImportLogs(),
      journal: Storage.getJournal(),
      media: Storage.getMedia(),
      achievements: Storage.getAchievements(),
      doodles: Storage.getDoodles(),
      timeline: Storage.getTimeline(),
      projects: Storage.getProjects(),
      skills: Storage.getSkills(),
      settings: Storage.getSettings(),
      sections: Storage.getSections(),
      photos: Storage.getPhotos(),
      resume: Storage.getResume(),
      quotes: Storage.getQuotes(),
      exams: Storage.getExams(),
      schedule: Storage.getSchedule(),
      activeAlarm: Storage.getActiveAlarm(),
      alarmSnoozeInterval: Storage.getAlarmSnoozeInterval(),
      commandMappings: Storage.getCommandMappings(),
    };
  },

  importAllDataPayload: (data: any): boolean => {
    try {
      if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
      const knownKeys = [
        'profile', 'todos', 'habits', 'goals', 'vaultEncrypted', 'vault',
        'expenses', 'excelImportLogs', 'journal', 'media', 'achievements', 'doodles',
        'timeline', 'projects', 'skills', 'settings', 'sections',
        'photos', 'resume', 'quotes', 'exams', 'schedule', 'version', 'activeAlarm', 'alarmSnoozeInterval',
        'commandMappings'
      ];
      const hasKnownKey = knownKeys.some((k) => k in data && data[k] !== undefined);
      if (!hasKnownKey) return false;

      if (data.profile) {
        const currentProfile = Storage.getProfile();
        const incomingAvatar = data.profile.avatarUrl;
        const currentAvatar = currentProfile.avatarUrl;
        const mergedProfile = {
          ...currentProfile,
          ...data.profile,
        };
        if (incomingAvatar) {
          mergedProfile.avatarUrl = incomingAvatar;
        } else if (currentAvatar && currentAvatar !== STOCK_IMAGES.avatar) {
          mergedProfile.avatarUrl = currentAvatar;
        }
        Storage.setProfile(mergedProfile);
      }
      if (data.todos) Storage.setTodos(data.todos);
      if (data.habits) Storage.setHabits(data.habits);
      if (Array.isArray(data.habitHistory)) Storage.setHabitHistory(data.habitHistory);
      if (typeof data.habitActiveWeek === 'string') Storage.setHabitActiveWeek(data.habitActiveWeek);
      if (Array.isArray(data.habitActivities)) Storage.setHabitActivities(data.habitActivities);
      if (data.goals) Storage.setGoals(data.goals);
      if (data.vaultEncrypted) Storage.restoreEncryptedVault(data.vaultEncrypted);
      else if (data.vault) Storage.restoreEncryptedVault(null);

      // Hydrate expenses and spreadsheet logs directly from authoritative cloud snapshot
      if (Array.isArray(data.expenses)) {
        Storage.setExpenses(data.expenses);
      }
      if (Array.isArray(data.excelImportLogs)) {
        Storage.setExcelImportLogs(data.excelImportLogs);
      }

      if (data.journal) Storage.setJournal(data.journal);
      if (data.media) Storage.setMedia(data.media);
      if (data.achievements) Storage.setAchievements(data.achievements);
      if (data.doodles) Storage.setDoodles(data.doodles);
      if (data.timeline) Storage.setTimeline(data.timeline);
      if (data.projects) Storage.setProjects(data.projects);
      if (data.skills) Storage.setSkills(data.skills);
      if (data.settings) Storage.setSettings(data.settings);
      if (data.sections) Storage.setSections(data.sections);
      if (data.photos) Storage.setPhotos(data.photos);
      if (data.resume) Storage.setResume(data.resume);
      if (data.quotes) Storage.setQuotes(data.quotes);
      if (data.exams) Storage.setExams(data.exams);
      if (data.schedule) Storage.setSchedule(data.schedule);
      if ('activeAlarm' in data) {
        Storage.setActiveAlarm(data.activeAlarm ?? null);
      }
      if ('alarmSnoozeInterval' in data && typeof data.alarmSnoozeInterval === 'number') {
        Storage.setAlarmSnoozeInterval(data.alarmSnoozeInterval);
      }
      if (Array.isArray(data.commandMappings)) {
        Storage.setCommandMappings(data.commandMappings);
      }
      return true;
    } catch (err) {
      console.error('Failed to import payload:', err);
      return false;
    }
  },

  exportAllDataJSON: (): string => {
    const fullBackup = Storage.getAllDataPayload();
    return JSON.stringify(fullBackup, null, 2);
  },

  importAllDataJSON: (jsonStr: string): boolean => {
    try {
      const data = JSON.parse(jsonStr);
      return Storage.importAllDataPayload(data);
    } catch (err) {
      console.error('Failed to import JSON data:', err);
      return false;
    }
  },

  resetToDefault: () => {
    Storage.setProfile(INITIAL_PROFILE);
    Storage.setTodos(INITIAL_TODOS);
    Storage.setHabits(INITIAL_HABITS);
    Storage.setHabitHistory([]);
    Storage.setHabitActiveWeek('');
    Storage.setHabitActivities([]);
    Storage.setGoals(INITIAL_GOALS);
    localStorage.removeItem(getVaultStorageKey());
    vaultCache = [];
    Storage.setExpenses(INITIAL_EXPENSES);
    Storage.setJournal(INITIAL_JOURNAL);
    Storage.setMedia(INITIAL_MEDIA);
    Storage.setAchievements(INITIAL_ACHIEVEMENTS);
    Storage.setDoodles([]);
    Storage.setTimeline(INITIAL_TIMELINE);
    Storage.setProjects(INITIAL_PROJECTS);
    Storage.setSkills(INITIAL_SKILLS);
    Storage.setSettings(INITIAL_SETTINGS);
    Storage.setSections(INITIAL_SECTIONS);
    Storage.setPhotos(INITIAL_PHOTOS);
    Storage.setResume(INITIAL_RESUME);
    Storage.setQuotes(INITIAL_QUOTES);
    Storage.setExams(INITIAL_USER_EXAMS);
    Storage.setSchedule(INITIAL_SCHEDULE);
    Storage.setCommandMappings(DEFAULT_COMMAND_MAPPINGS);
  },
};
