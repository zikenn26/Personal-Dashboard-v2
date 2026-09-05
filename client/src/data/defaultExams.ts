import { ExamItem } from '../types';

export const ALL_PRESET_EXAMS: Omit<ExamItem, 'id' | 'createdAt' | 'updatedAt'>[] = [
  // =========================================================================
  // 1. OPSC OCS (Odisha Civil Services Examination)
  // Exact, comprehensive syllabus extracted from official notification & Drishti IAS
  // (https://www.drishtiias.com/state-pcs/opsc-syllabus)
  // =========================================================================
  {
    name: 'OPSC Odisha Civil Services Examination (OCS)',
    shortName: 'OPSC OCS',
    category: 'State PSC',
    conductingBody: 'Odisha Public Service Commission (OPSC)',
    targetExamDate: '2026-08-16',
    registrationStartDate: '2026-02-15',
    registrationEndDate: '2026-03-25',
    currentStage: 'Notification & Prelims Prep',
    officialWebsite: 'https://opsc.gov.in',
    badgeColor: '#D97706', // Amber / Gold
    icon: '🏛️',
    description:
      'Premier state civil services examination in Odisha for recruitment to Group-A and Group-B posts (OAS, OPS, OFS, ORS, OCS, OES) following the revised UPSC pattern with deep focus on Odisha history, culture, geography, and economy.',
    pattern: {
      mode: 'Offline Pen & Paper (OMR for Prelims, Descriptive for Mains)',
      totalDuration: 'Prelims: 2 Papers (2h each); Mains: 9 Papers (3h each)',
      totalMarks: '2250 Marks (Prelims 400 qualifying; Mains 2000 + Interview 250)',
      negativeMarking: '1/3rd (33.3%) deduction for each wrong answer in Prelims Paper I & II',
      description:
        'Selection Process: 1) Preliminary Examination (GS Paper I & Paper II qualifying at 33%), 2) Main Examination (9 Papers: 2 Qualifying Language papers + 1 Essay + 4 GS Papers + 2 Optional Papers), 3) Personality Test / Interview (250 Marks).',
      sections: [
        { id: 'opsc-sec-pre1', name: 'Prelims Paper I: General Studies', questions: 100, marks: 200, durationMinutes: 120, negativeMarking: '0.66 marks' },
        { id: 'opsc-sec-pre2', name: 'Prelims Paper II: General Studies (CSAT - 33% Qualifying)', questions: 80, marks: 200, durationMinutes: 120, negativeMarking: '0.83 marks' },
        { id: 'opsc-sec-odia', name: 'Mains Paper I: Odia Language (Qualifying at 25%)', marks: 250, durationMinutes: 180 },
        { id: 'opsc-sec-eng', name: 'Mains Paper II: English Language (Qualifying at 25%)', marks: 250, durationMinutes: 180 },
        { id: 'opsc-sec-essay', name: 'Mains Paper III: English Essay', marks: 250, durationMinutes: 180 },
        { id: 'opsc-sec-gs1', name: 'Mains Paper IV: General Studies I (Indian & Odisha Heritage, History & Geography)', marks: 250, durationMinutes: 180 },
        { id: 'opsc-sec-gs2', name: 'Mains Paper V: General Studies II (Governance, Constitution, Polity, Social Justice & IR)', marks: 250, durationMinutes: 180 },
        { id: 'opsc-sec-gs3', name: 'Mains Paper VI: General Studies III (Technology, Economic Development, Environment & Security)', marks: 250, durationMinutes: 180 },
        { id: 'opsc-sec-gs4', name: 'Mains Paper VII: General Studies IV (Ethics, Integrity and Aptitude)', marks: 250, durationMinutes: 180 },
        { id: 'opsc-sec-opt1', name: 'Mains Paper VIII: Optional Subject - Paper I', marks: 250, durationMinutes: 180 },
        { id: 'opsc-sec-opt2', name: 'Mains Paper IX: Optional Subject - Paper II', marks: 250, durationMinutes: 180 },
      ],
    },
    stages: [
      {
        id: 'opsc-stg-reg',
        name: 'Online Application & Registration',
        startDate: '2026-02-15',
        endDate: '2026-03-25',
        status: 'upcoming',
        notes: 'Apply on opsc.gov.in. Candidates must possess matriculation certificate with Odia as a subject.',
      },
      {
        id: 'opsc-stg-pre',
        name: 'Preliminary Examination (Paper I & II)',
        date: '2026-08-16',
        status: 'upcoming',
        notes: 'Two objective papers in offline OMR mode across 5 zonal centers: Bhubaneswar, Cuttack, Balasore, Berhampur, and Sambalpur.',
      },
      {
        id: 'opsc-stg-mains',
        name: 'Main Written Examination (Descriptive)',
        startDate: '2026-12-10',
        endDate: '2026-12-22',
        status: 'upcoming',
        notes: 'Descriptive written examination consisting of 9 papers over 5 to 7 days.',
      },
      {
        id: 'opsc-stg-viva',
        name: 'Personality Test / Viva Voce',
        startDate: '2027-03-01',
        endDate: '2027-04-15',
        status: 'upcoming',
        notes: '250 Marks interview at OPSC Headquarters, Cuttack assessing leadership, mental caliber, and state issues knowledge.',
      },
    ],
    subjects: [
      {
        id: 'opsc-sub-pre1',
        name: 'Prelims Paper I: General Studies',
        code: 'PRE-GS1',
        description: 'Current national and international events, History of India & Odisha, Geography of India & Odisha, Indian Polity and Governance, Economic & Social Development, General Science and Ecology.',
        topics: [
          { id: 'opsc-p1-1', title: 'Current events of National and International Importance' },
          { id: 'opsc-p1-2', title: 'History of India and Indian National Movement' },
          { id: 'opsc-p1-3', title: 'History of Odisha and Odia Nationalism (Kalinga War, Somavamsis, Imperial Gangas, Gajapatis, Paika Rebellion 1817, Prajamandal Movement, Formation of Odisha 1936)' },
          { id: 'opsc-p1-4', title: 'Physical, Social, Economic Geography of India and the World' },
          { id: 'opsc-p1-5', title: 'Odisha Geography: Physiography, River Systems (Mahanadi, Brahmani, Baitarani, Rushikulya), Climate, Soils, Natural Vegetation & Mineral Belts' },
          { id: 'opsc-p1-6', title: 'Indian Polity and Governance: Constitution, Political System, Panchayati Raj Institutions, Public Policy, Rights Issues' },
          { id: 'opsc-p1-7', title: 'Odisha State Governance & Administrative Framework (Secretariat, District Administration & PRIs)' },
          { id: 'opsc-p1-8', title: 'Economic and Social Development: Sustainable Development, Poverty Alleviation, Demographics, Social Sector Initiatives' },
          { id: 'opsc-p1-9', title: 'General issues on Environmental Ecology, Bio-diversity and Climate Change (Mangroves of Bhitarkanika, Chilika Ramsar Site, Similipal Biosphere Reserve)' },
          { id: 'opsc-p1-10', title: 'General Science & Scientific Developments in Everyday Life' },
        ],
      },
      {
        id: 'opsc-sub-pre2',
        name: 'Prelims Paper II: General Studies (CSAT)',
        code: 'PRE-GS2',
        description: 'Qualifying aptitude paper (minimum 33% required to qualify for mains evaluation).',
        topics: [
          { id: 'opsc-p2-1', title: 'Comprehension of passages (in English and Odia)' },
          { id: 'opsc-p2-2', title: 'Interpersonal skills including communication skills' },
          { id: 'opsc-p2-3', title: 'Logical reasoning and analytical ability' },
          { id: 'opsc-p2-4', title: 'Decision-making and problem-solving scenarios' },
          { id: 'opsc-p2-5', title: 'General mental ability & numerical puzzles' },
          { id: 'opsc-p2-6', title: 'Basic numeracy: Numbers & relations, Orders of magnitude, Percentages, Ratios (Class X level)' },
          { id: 'opsc-p2-7', title: 'Data interpretation: Charts, graphs, tables, and data sufficiency (Class X level)' },
          { id: 'opsc-p2-8', title: 'English language comprehension skills (Class X level)' },
        ],
      },
      {
        id: 'opsc-sub-odia',
        name: 'Mains Paper I: Odia Language (Compulsory Qualifying)',
        code: 'MAIN-ODIA',
        description: 'Qualifying language paper of Class X matriculation standard (minimum 25% marks required).',
        topics: [
          { id: 'opsc-od-1', title: 'Comprehension of given passages in Odia prose' },
          { id: 'opsc-od-2', title: 'Précis writing in Odia from extensive text' },
          { id: 'opsc-od-3', title: 'Odia Usage & Vocabulary (Sandhi, Samasa, Kridanta, Taddhita, Idioms, Proverbs/Rudi)' },
          { id: 'opsc-od-4', title: 'Short Essay writing in Odia on socio-economic, cultural and environmental topics' },
          { id: 'opsc-od-5', title: 'Translation from English to Odia' },
          { id: 'opsc-od-6', title: 'Translation from Odia to English' },
        ],
      },
      {
        id: 'opsc-sub-eng',
        name: 'Mains Paper II: English Language (Compulsory Qualifying)',
        code: 'MAIN-ENG',
        description: 'Qualifying English paper of matriculation standard (minimum 25% marks required).',
        topics: [
          { id: 'opsc-en-1', title: 'Comprehension of given English passages' },
          { id: 'opsc-en-2', title: 'Précis writing in English' },
          { id: 'opsc-en-3', title: 'Usage and Vocabulary (Synonyms, Antonyms, Prepositions, Phrasal verbs, Sentence correction)' },
          { id: 'opsc-en-4', title: 'Short Essay writing on contemporary themes' },
        ],
      },
      {
        id: 'opsc-sub-essay',
        name: 'Mains Paper III: English Essay',
        code: 'MAIN-ESSAY',
        description: 'Two analytical essays assessing articulation, multi-dimensional perspectives, and depth of knowledge.',
        topics: [
          { id: 'opsc-es-1', title: 'Section A: Philosophical, Ethical & Abstract Themes' },
          { id: 'opsc-es-2', title: 'Section B: Socio-Economic, Governance, Science, Environment & Regional Odisha Development Themes' },
          { id: 'opsc-es-3', title: 'Structuring Essay: Introduction, Contextual Background, Pros & Cons, Government Initiatives, Way Forward' },
        ],
      },
      {
        id: 'opsc-sub-gs1',
        name: 'Mains Paper IV: General Studies I (Heritage, History, Society & Geography)',
        code: 'MAIN-GS1',
        description: 'Indian and Odisha Heritage and Culture, Modern Indian and Odisha History, World History, Society, and World Physical Geography.',
        topics: [
          { id: 'opsc-gs1-1', title: 'Indian Heritage & Culture: Art forms, Literature, and Architecture from Ancient to Modern times' },
          { id: 'opsc-gs1-2', title: 'Odisha Temple Architecture: Kalinga Style (Rekha, Pidha, Khakhara deula; Konark, Lingaraj, Puri Jagannath Temple)' },
          { id: 'opsc-gs1-3', title: 'Socio-Cultural Development in Odisha: Buddhism (Ratnagiri, Lalitgiri, Udayagiri), Jainism (Khandagiri-Udayagiri), Shaivism, Shaktism, Vaishnavism' },
          { id: 'opsc-gs1-4', title: 'Bhakti Movement in Odisha: Sri Chaitanya, Panchasakha Literature (Balarama Dasa, Jagannatha Dasa, Achyutananda), Mahima Dharma' },
          { id: 'opsc-gs1-5', title: 'Evolution of Odia Language & Literature: Charyapada, Sarala Mahabharata, Upendra Bhanja to Modern Odia Literature (Fakir Mohan Senapati, Radhanath Ray)' },
          { id: 'opsc-gs1-6', title: 'Regional Traditions & Festivals of Odisha: Rath Yatra, Raja Parba, Bali Jatra, Nuakhai, Chhau Dance, Sambalpuri handlooms & Patachitra art' },
          { id: 'opsc-gs1-7', title: 'Modern Indian History: Significant events, personalities, and administrative issues from mid-18th century to present' },
          { id: 'opsc-gs1-8', title: 'The Freedom Struggle: Various stages, contributors, and role of Odisha (Paika Rebellion 1817 - Bakshi Jagabandhu, Veer Surendra Sai, Gopabandhu Das, Madhusudan Das, Rama Devi, Malati Choudhury, Baji Rout)' },
          { id: 'opsc-gs1-9', title: 'Post-Independence Consolidation and Reorganization within India and integration of Princely States in Odisha' },
          { id: 'opsc-gs1-10', title: 'History of the World from 18th Century: Industrial Revolution, World Wars, Decolonization, Capitalism, Socialism, and Communism' },
          { id: 'opsc-gs1-11', title: 'Salient Features of Indian Society and Diversity of India' },
          { id: 'opsc-gs1-12', title: 'Role of Women and Women Organizations, Population Dynamics, Poverty & Developmental Issues, Urbanization challenges & remedies' },
          { id: 'opsc-gs1-13', title: 'Effects of Globalization on Indian and Odia Society' },
          { id: 'opsc-gs1-14', title: 'Social Empowerment, Communalism, Regionalism, and Secularism' },
          { id: 'opsc-gs1-15', title: 'Salient Features of World Physical Geography & Geophysical Phenomena (Earthquakes, Tsunamis, Volcanism, Tropical Cyclones in Bay of Bengal)' },
          { id: 'opsc-gs1-16', title: 'Distribution of Key Natural Resources across the world with special focus on South Asia, India, and Odisha mineral belts (Iron ore, Bauxite, Chromite, Coal)' },
        ],
      },
      {
        id: 'opsc-sub-gs2',
        name: 'Mains Paper V: General Studies II (Governance, Polity, Social Justice & IR)',
        code: 'MAIN-GS2',
        description: 'Indian Constitution, Governance, Public Administration, Welfare Initiatives, Odisha State Initiatives, and International Relations.',
        topics: [
          { id: 'opsc-gs2-1', title: 'Indian Constitution: Historical underpinnings, evolution, features, amendments, significant provisions & Basic Structure doctrine' },
          { id: 'opsc-gs2-2', title: 'Functions and Responsibilities of Union and States: Federal issues, devolution of powers & finances up to local levels (PRIs and ULBs in Odisha)' },
          { id: 'opsc-gs2-3', title: 'Separation of Powers between organs, Dispute Redressal Mechanisms and Institutions' },
          { id: 'opsc-gs2-4', title: 'Comparison of Indian Constitutional Scheme with that of other democratic countries' },
          { id: 'opsc-gs2-5', title: 'Parliament & State Legislatures (with special focus on Odisha Legislative Assembly): Structure, functioning, conduct of business, powers & privileges' },
          { id: 'opsc-gs2-6', title: 'Structure, Organization and Functioning of Executive and Judiciary: Ministries, Departments, Pressure Groups, Public Interest Litigation (PIL), Judicial Review' },
          { id: 'opsc-gs2-7', title: 'Salient Features of the Representation of the People Act (RPA 1950 & 1951)' },
          { id: 'opsc-gs2-8', title: 'Appointment to various Constitutional Posts, Powers, Functions and Responsibilities of Constitutional Bodies (UPSC, OPSC, CAG, ECI, Finance Commission)' },
          { id: 'opsc-gs2-9', title: 'Statutory, Regulatory and Quasi-Judicial Bodies (NHRC, NGT, Lokayukta of Odisha, State Information Commission)' },
          { id: 'opsc-gs2-10', title: 'Government Policies and Interventions for Development in various sectors; Design and implementation issues' },
          { id: 'opsc-gs2-11', title: 'Development Processes & Development Industry: Role of NGOs, SHGs (Mission Shakti in Odisha), Trusts, Institutional Stakeholders' },
          { id: 'opsc-gs2-12', title: 'Welfare Schemes for Vulnerable Sections (SC, ST, OBC, Women, Children, Minorities, PwD, Senior Citizens) by Centre & Odisha State (KALIA, BSKY, Mo School, Mo Ghara)' },
          { id: 'opsc-gs2-13', title: 'Issues relating to development and management of Social Sector/Services: Health, Education, Human Resources' },
          { id: 'opsc-gs2-14', title: 'Issues relating to Poverty and Hunger: Food Security, NFSA, PDS reforms in Odisha' },
          { id: 'opsc-gs2-15', title: 'Important aspects of Governance, Transparency and Accountability, E-Governance (Odisha 5T Framework & Mo Sarkar), Citizen Charters, Right to Information (RTI)' },
          { id: 'opsc-gs2-16', title: 'Role of Civil Services in a Democracy and in State Administration' },
          { id: 'opsc-gs2-17', title: 'India and its Neighborhood Relations (Act East Policy, BIMSTEC, Indian Ocean & Bay of Bengal geopolitical importance)' },
          { id: 'opsc-gs2-18', title: 'Bilateral, Regional, and Global Groupings and Agreements involving India' },
          { id: 'opsc-gs2-19', title: 'Important International Institutions, Agencies, and Fora (UN, WTO, IMF, World Bank)' },
        ],
      },
      {
        id: 'opsc-sub-gs3',
        name: 'Mains Paper VI: General Studies III (Technology, Economy, Environment & Security)',
        code: 'MAIN-GS3',
        description: 'Indian and Odisha Economy, Agriculture, Science and Technology, Biodiversity, Environment, Disaster Management, and Internal Security.',
        topics: [
          { id: 'opsc-gs3-1', title: 'Indian & Odisha Economy: Planning, mobilization of resources, growth, development, employment; Analysis of Odisha Economic Survey' },
          { id: 'opsc-gs3-2', title: 'Inclusive Growth and Government Budgeting: Union Budget, Odisha State Budget, Fiscal deficit management & FRBM Act' },
          { id: 'opsc-gs3-3', title: 'Major Crops and Cropping Patterns in India & Odisha (Paddy, Pulses, Oilseeds, Odisha Millets Mission), Irrigation systems, Storage, Agricultural Marketing & Supply Chains' },
          { id: 'opsc-gs3-4', title: 'Direct and Indirect Farm Subsidies, MSP, Public Distribution System (PDS) functioning & buffer stocks, Food Security, Economics of Animal Rearing & Fisheries' },
          { id: 'opsc-gs3-5', title: 'Food Processing and Related Industries in India and Odisha: Scope, location, upstream/downstream requirements, Agro-industrial policy of Odisha' },
          { id: 'opsc-gs3-6', title: 'Land Reforms in India and Odisha: Tenancy laws, Bhoodan, Land ceiling and digital land records (Bhulekh Odisha)' },
          { id: 'opsc-gs3-7', title: 'Effects of Liberalization on Economy: Industrial policy changes, Industrialization in Odisha (Steel Hub, Aluminium, Ports, Petrochemicals at Paradip, MSMEs)' },
          { id: 'opsc-gs3-8', title: 'Infrastructure Development: Energy (Thermal, Hydro, Solar in Odisha), Ports (Paradip, Dhamra, Gopalpur), Roads, Railways, Airports (Bhubaneswar, Jharsuguda)' },
          { id: 'opsc-gs3-9', title: 'Science and Technology Developments: Everyday applications, Achievements of Indian scientists, Indigenization of technology' },
          { id: 'opsc-gs3-10', title: 'Awareness in IT, Space, Computers, Robotics, Nanotech, Biotech, Intellectual Property Rights (IPR)' },
          { id: 'opsc-gs3-11', title: 'Environmental Conservation, Pollution Control, Climate Change Adaptation, Environmental Impact Assessment (EIA)' },
          { id: 'opsc-gs3-12', title: 'Disaster Management in India and Odisha: Tropical Cyclone preparedness (OSDMA model, Early Warning Dissemination System), Flood & Heatwave mitigation' },
          { id: 'opsc-gs3-13', title: 'Linkages between Development and Spread of Extremism: Left-Wing Extremism (LWE) in tribal districts of Odisha, Surrender policies & Security action' },
          { id: 'opsc-gs3-14', title: 'Internal Security Challenges: Communication networks, Social media, Cyber security essentials, Money laundering & Prevention of Money Laundering Act (PMLA)' },
          { id: 'opsc-gs3-15', title: 'Security Challenges in Border & Coastal Areas: Maritime security of Odisha coastline, Coastal Police Stations, Linkages of organized crime with terrorism' },
          { id: 'opsc-gs3-16', title: 'Security Forces and Agencies and their mandates (CAPF, CISF, State Police, SOG, DVF in Odisha)' },
        ],
      },
      {
        id: 'opsc-sub-gs4',
        name: 'Mains Paper VII: General Studies IV (Ethics, Integrity & Aptitude)',
        code: 'MAIN-GS4',
        description: 'Ethics in Governance, Human Values, Attitude, Emotional Intelligence, Probity, and Administrative Case Studies.',
        topics: [
          { id: 'opsc-gs4-1', title: 'Ethics and Human Interface: Essence, determinants, and consequences of ethics in human actions; Dimensions of ethics; Ethics in private and public relationships' },
          { id: 'opsc-gs4-2', title: 'Human Values: Lessons from the lives and teachings of great leaders, reformers, and administrators (Mahatma Gandhi, Swami Vivekananda, Utkalmani Gopabandhu Das); Role of family, society, and educational institutions' },
          { id: 'opsc-gs4-3', title: 'Attitude: Content, structure, function; Its influence and relation with thought and behavior; Moral and political attitudes; Social influence and persuasion' },
          { id: 'opsc-gs4-4', title: 'Aptitude and Foundational Values for Civil Service: Integrity, impartiality, non-partisanship, objectivity, dedication to public service, empathy, tolerance, compassion towards weaker sections' },
          { id: 'opsc-gs4-5', title: 'Emotional Intelligence: Concepts, utilities, and application in administration and governance' },
          { id: 'opsc-gs4-6', title: 'Contributions of Moral Thinkers and Philosophers from India and the World (Socrates, Plato, Aristotle, Kautilya, Thiruvalluvar, Immanuel Kant, John Stuart Mill)' },
          { id: 'opsc-gs4-7', title: 'Public/Civil Service Values and Ethics in Public Administration: Ethical concerns and dilemmas in government and private institutions; Laws, rules, regulations and conscience as sources of guidance; Accountability and ethical governance' },
          { id: 'opsc-gs4-8', title: 'Probity in Governance: Concept of public service; Philosophical basis of governance and probity; Information sharing, Transparency, Right to Information, Codes of Ethics, Codes of Conduct, Citizen Charters, Work culture, Anti-corruption (Odisha Vigilance)' },
          { id: 'opsc-gs4-9', title: 'Comprehensive Case Studies on ethical dilemmas, administrative decisions, conflict of interest, and probity in governance' },
        ],
      },
      {
        id: 'opsc-sub-opt',
        name: 'Mains Paper VIII & IX: Optional Subject (Paper 1 & 2)',
        code: 'MAIN-OPT',
        description: 'Candidate’s chosen optional subject (History, Geography, Political Science, Sociology, Odia Literature, Public Administration, etc.).',
        topics: [
          { id: 'opsc-opt-1', title: 'Paper I: Theoretical Foundations, Classical Doctrines & Conceptual Framework of the Chosen Discipline' },
          { id: 'opsc-opt-2', title: 'Paper II: Applied Dimensions, Contemporary Empirical Realities, and Indian/Odisha Contextual Case Studies' },
        ],
      },
    ],
    books: [
      { id: 'b-opsc-1', title: 'History of Modern Odisha', author: 'Dr. J.K. Samal & P.K. Nayak', subject: 'Odisha History & Paika Rebellion', priority: 'essential', completed: false },
      { id: 'b-opsc-2', title: 'Odisha Reference Year Book / Economic Survey', author: 'Government of Odisha Planning & Convergence Dept', subject: 'Odisha Economy & Governance', priority: 'essential', completed: false },
      { id: 'b-opsc-3', title: 'Indian Polity (7th Edition)', author: 'M. Laxmikanth', subject: 'Polity & Governance', priority: 'essential', completed: false },
      { id: 'b-opsc-4', title: 'A History of Odisha', author: 'K.C. Panigrahi', subject: 'Odisha Heritage & Ancient Culture', priority: 'recommended', completed: false },
      { id: 'b-opsc-5', title: 'Ethics, Integrity & Aptitude for Civil Services', author: 'Subba Rao & P.N. Roy Chowdhury', subject: 'General Studies IV (Ethics)', priority: 'essential', completed: false },
    ],
    strategyNotes:
      'Master the UPSC General Studies foundation while dedicating 2-3 hours daily to Odisha-specific history, geography, Panchasakha literature, and government schemes (KALIA, BSKY, 5T initiatives). Practice Odia and English précis and essay writing weekly.',
  },

  // =========================================================================
  // 2. UPSC Civil Services Examination (CSE)
  // Comprehensive, detailed official syllabus from UPSC
  // =========================================================================
  {
    name: 'UPSC Civil Services Examination (CSE)',
    shortName: 'UPSC CSE',
    category: 'Civil Services',
    conductingBody: 'Union Public Service Commission (UPSC)',
    targetExamDate: '2026-05-24',
    registrationStartDate: '2026-01-22',
    registrationEndDate: '2026-02-11',
    currentStage: 'Prelims Preparation Phase',
    officialWebsite: 'https://upsc.gov.in',
    badgeColor: '#4F46E5', // Indigo
    icon: '🏛️',
    description:
      'Apex national competitive examination conducted by UPSC for recruitment to India’s premier administrative, police, and foreign services including IAS, IPS, and IFS.',
    pattern: {
      mode: 'Offline Pen & Paper (OMR for Prelims, Written Descriptive for Mains)',
      totalDuration: 'Prelims: 2x 2h; Mains: 9 Papers (3h each)',
      totalMarks: '2025 Marks (Mains 1750 + Personality Test 275)',
      negativeMarking: '1/3rd (0.33%) mark deducted for incorrect answers in Prelims Paper 1 & 2',
      description:
        'Three-tier selection structure: 1) Prelims (GS-1 & CSAT qualifying at 33%), 2) Mains (9 descriptive papers including Essay, GS 1-4, and 2 Optional Papers), 3) Personality Test / Interview.',
      sections: [
        { id: 'sec-1', name: 'Prelims Paper 1: General Studies', questions: 100, marks: 200, durationMinutes: 120, negativeMarking: '0.66 marks' },
        { id: 'sec-2', name: 'Prelims Paper 2: CSAT (Aptitude - 33% Qualifying)', questions: 80, marks: 200, durationMinutes: 120, negativeMarking: '0.83 marks' },
        { id: 'sec-3', name: 'Mains: Essay Paper', marks: 250, durationMinutes: 180 },
        { id: 'sec-4', name: 'Mains: GS Paper I (Heritage, History, Geography, Society)', marks: 250, durationMinutes: 180 },
        { id: 'sec-5', name: 'Mains: GS Paper II (Governance, Polity, Social Justice, IR)', marks: 250, durationMinutes: 180 },
        { id: 'sec-6', name: 'Mains: GS Paper III (Economy, Sci-Tech, Environment, Security)', marks: 250, durationMinutes: 180 },
        { id: 'sec-7', name: 'Mains: GS Paper IV (Ethics, Integrity & Aptitude)', marks: 250, durationMinutes: 180 },
        { id: 'sec-8', name: 'Mains: Optional Subject Paper I & II', marks: 500, durationMinutes: 360 },
      ],
    },
    stages: [
      {
        id: 'upsc-stg-reg',
        name: 'Notification & Registration (OTR)',
        startDate: '2026-01-22',
        endDate: '2026-02-11',
        status: 'completed',
        notes: 'Online Application on upsconline.nic.in. Fee: ₹100 (Exempted for Female/SC/ST/PwBD).',
      },
      {
        id: 'upsc-stg-prelims',
        name: 'Preliminary Examination (GS-1 & CSAT)',
        date: '2026-05-24',
        status: 'upcoming',
        notes: 'Objective type test in two shifts (9:30 AM - 11:30 AM & 2:30 PM - 4:30 PM). Admit cards released 2 weeks prior.',
      },
      {
        id: 'upsc-stg-mains',
        name: 'Civil Services (Main) Examination',
        startDate: '2026-09-18',
        endDate: '2026-09-27',
        status: 'upcoming',
        notes: 'Conventional descriptive papers over 5 days. Candidates must fill DAF-I after Prelims result.',
      },
      {
        id: 'upsc-stg-interview',
        name: 'Personality Test / Interview',
        startDate: '2027-01-15',
        endDate: '2027-04-10',
        status: 'upcoming',
        notes: 'Board interview at Dholpur House, Shahjahan Road, New Delhi (275 Marks).',
      },
    ],
    subjects: [
      {
        id: 'upsc-sub-pre1',
        name: 'Prelims Paper 1: General Studies',
        code: 'PRE-GS1',
        description: 'Current national/international events, History of India, Geography, Polity, Economy, Environment, and General Science.',
        topics: [
          { id: 'top-u1', title: 'Current events of national and international importance' },
          { id: 'top-u2', title: 'History of India and Indian National Movement' },
          { id: 'top-u3', title: 'Indian and World Geography: Physical, Social, Economic Geography of India and the World' },
          { id: 'top-u4', title: 'Indian Polity & Governance: Constitution, Political System, Panchayati Raj, Public Policy, Rights Issues' },
          { id: 'top-u5', title: 'Economic & Social Development: Sustainable Development, Poverty, Inclusion, Demographics, Social Sector Initiatives' },
          { id: 'top-u6', title: 'General issues on Environmental Ecology, Bio-diversity and Climate Change' },
          { id: 'top-u7', title: 'General Science and Technological Innovations' },
        ],
      },
      {
        id: 'upsc-sub-pre2',
        name: 'Prelims Paper 2: CSAT (Qualifying Aptitude)',
        code: 'PRE-CSAT',
        description: 'Aptitude, comprehension, logical reasoning, and basic numeracy (33% qualifying threshold).',
        topics: [
          { id: 'top-u8', title: 'Reading Comprehension & Critical Inference' },
          { id: 'top-u9', title: 'Interpersonal skills including communication skills' },
          { id: 'top-u10', title: 'Logical reasoning and analytical ability' },
          { id: 'top-u11', title: 'Decision-making and problem-solving' },
          { id: 'top-u12', title: 'General mental ability' },
          { id: 'top-u13', title: 'Basic numeracy (numbers and their relations, orders of magnitude - Class X level)' },
          { id: 'top-u14', title: 'Data interpretation (charts, graphs, tables, data sufficiency - Class X level)' },
        ],
      },
      {
        id: 'upsc-sub-essay',
        name: 'Mains: Essay Paper',
        code: 'MAIN-ESSAY',
        description: 'Two multi-dimensional essays on philosophical, ethical, socio-economic, and governance themes.',
        topics: [
          { id: 'top-u15', title: 'Section A: Philosophical and Abstract Quotation-based Themes' },
          { id: 'top-u16', title: 'Section B: Socio-Economic, Governance, Science, Geopolitics & Climate Themes' },
        ],
      },
      {
        id: 'upsc-sub-gs1',
        name: 'General Studies Paper I (Heritage, History, Geography & Society)',
        code: 'MAIN-GS1',
        description: 'Indian Heritage and Culture, History and Geography of the World and Society.',
        topics: [
          { id: 'top-u17', title: 'Indian Culture: Salient aspects of Art Forms, Literature & Architecture from Ancient to Modern times' },
          { id: 'top-u18', title: 'Modern Indian History: Significant events, personalities & issues from mid-18th century to present' },
          { id: 'top-u19', title: 'The Freedom Struggle: Various stages, important contributors and contributions from different regions' },
          { id: 'top-u20', title: 'Post-Independence Consolidation and Reorganization within the country' },
          { id: 'top-u21', title: 'History of the World: Industrial Revolution, World Wars, Decolonization, Capitalism & Socialism' },
          { id: 'top-u22', title: 'Salient features of Indian Society, Diversity of India, Role of Women & Organizations' },
          { id: 'top-u23', title: 'Salient features of World Physical Geography & Geophysical phenomena (Earthquakes, Volcanoes, Cyclones)' },
          { id: 'top-u24', title: 'Distribution of Key Natural Resources across the world (including South Asia and the Indian sub-continent)' },
        ],
      },
      {
        id: 'upsc-sub-gs2',
        name: 'General Studies Paper II (Governance, Polity, Social Justice & IR)',
        code: 'MAIN-GS2',
        description: 'Governance, Constitution, Polity, Social Justice and International Relations.',
        topics: [
          { id: 'top-u25', title: 'Indian Constitution: Historical underpinnings, evolution, features, amendments, significant provisions & basic structure' },
          { id: 'top-u26', title: 'Functions & responsibilities of the Union and States, issues & challenges pertaining to the federal structure' },
          { id: 'top-u27', title: 'Separation of Powers between organs, Dispute Redressal Mechanisms & Institutions' },
          { id: 'top-u28', title: 'Comparison of the Indian Constitutional scheme with that of other democratic countries' },
          { id: 'top-u29', title: 'Parliament & State Legislatures: Structure, functioning, conduct of business, powers & privileges' },
          { id: 'top-u30', title: 'Statutory, Regulatory and various Quasi-judicial bodies (Election Commission, CAG, UPSC, Finance Commission)' },
          { id: 'top-u31', title: 'Government policies & interventions for development in various sectors and issues arising out of design/implementation' },
          { id: 'top-u32', title: 'India and its Neighborhood Relations; Bilateral, regional and global groupings and agreements involving India' },
        ],
      },
      {
        id: 'upsc-sub-gs3',
        name: 'General Studies Paper III (Economy, Science, Environment & Security)',
        code: 'MAIN-GS3',
        description: 'Technology, Economic Development, Bio-diversity, Environment, Security and Disaster Management.',
        topics: [
          { id: 'top-u33', title: 'Indian Economy and issues relating to planning, mobilization of resources, growth, development and employment' },
          { id: 'top-u34', title: 'Inclusive Growth and issues arising from it; Government Budgeting' },
          { id: 'top-u35', title: 'Major Crops, Cropping Patterns, Irrigation, Storage, Transport & Marketing of Agricultural Produce' },
          { id: 'top-u36', title: 'Issues related to Direct and Indirect Farm Subsidies and Minimum Support Prices (MSP); Public Distribution System' },
          { id: 'top-u37', title: 'Infrastructure: Energy, Ports, Roads, Airports, Railways; Investment models (PPP)' },
          { id: 'top-u38', title: 'Science and Technology: Developments and their applications and effects in everyday life; Indigenization of technology' },
          { id: 'top-u39', title: 'Awareness in IT, Space, Computers, Robotics, Nanotechnology, Biotechnology, and IPR' },
          { id: 'top-u40', title: 'Conservation, Environmental Pollution and Degradation, Environmental Impact Assessment (EIA)' },
          { id: 'top-u41', title: 'Disaster and Disaster Management frameworks in India' },
          { id: 'top-u42', title: 'Linkages between Development and Spread of Extremism; Internal Security challenges & Cyber Security' },
        ],
      },
      {
        id: 'top-sub-gs4',
        name: 'General Studies Paper IV (Ethics, Integrity and Aptitude)',
        code: 'MAIN-GS4',
        description: 'Ethics, human values, attitude, emotional intelligence, probity in governance, and case studies.',
        topics: [
          { id: 'top-u43', title: 'Ethics and Human Interface: Essence, determinants and consequences of Ethics in human actions' },
          { id: 'top-u44', title: 'Human Values: Lessons from the lives and teachings of great leaders, reformers and administrators' },
          { id: 'top-u45', title: 'Attitude: Content, structure, function, moral and political attitudes, social influence and persuasion' },
          { id: 'top-u46', title: 'Aptitude and Foundational Values for Civil Service: Integrity, impartiality, objectivity, empathy, compassion' },
          { id: 'top-u47', title: 'Emotional Intelligence: Concepts and their utilities in administration and governance' },
          { id: 'top-u48', title: 'Contributions of moral thinkers and philosophers from India and world' },
          { id: 'top-u49', title: 'Probity in Governance: Transparency, RTI, Citizen Charters, Codes of Conduct, Work culture, Anti-corruption' },
          { id: 'top-u50', title: 'Case Studies on integrity, administrative conflict of interest, and public service delivery' },
        ],
      },
      {
        id: 'top-sub-opt',
        name: 'Optional Subject (Paper I & Paper II)',
        code: 'MAIN-OPT',
        description: 'Two specialized papers in chosen discipline (500 Marks total).',
        topics: [
          { id: 'top-u51', title: 'Paper I: Theoretical Foundations, Scholarly Debates & Conceptual Framework' },
          { id: 'top-u52', title: 'Paper II: Indian & Applied Dimensions, Public Policy Implementation, Case Studies' },
        ],
      },
    ],
    books: [
      { id: 'b-upsc-1', title: 'Indian Polity (7th Edition)', author: 'M. Laxmikanth', subject: 'Polity & Governance', priority: 'essential', completed: false },
      { id: 'b-upsc-2', title: 'A Brief History of Modern India', author: 'Rajiv Ahir (Spectrum)', subject: 'Modern Indian History', priority: 'essential', completed: false },
      { id: 'b-upsc-3', title: 'Indian Economy (15th Edition)', author: 'Ramesh Singh / Nitin Singhania', subject: 'Economy', priority: 'essential', completed: false },
      { id: 'b-upsc-4', title: 'Certificate Physical and Human Geography', author: 'G.C. Leong', subject: 'Physical Geography', priority: 'essential', completed: false },
      { id: 'b-upsc-5', title: 'Indian Art and Culture', author: 'Nitin Singhania', subject: 'Culture & Heritage', priority: 'recommended', completed: false },
      { id: 'b-upsc-6', title: 'Lexicon for Ethics, Integrity & Aptitude', author: 'Chronicle / Subba Rao', subject: 'General Studies IV', priority: 'essential', completed: false },
    ],
    strategyNotes:
      'Focus on NCERT foundations (Class 9-12) followed by standard reference textbooks. Daily answer writing practice for Mains GS papers, weekly mock tests for Prelims Paper 1 & CSAT.',
  },

  // =========================================================================
  // 3. Common Admission Test (CAT) - IIMs
  // Comprehensive, detailed official CAT syllabus
  // =========================================================================
  {
    name: 'Common Admission Test (CAT) - IIMs',
    shortName: 'CAT (IIMs)',
    category: 'Management',
    conductingBody: 'Indian Institutes of Management (IIMs)',
    targetExamDate: '2026-11-29',
    registrationStartDate: '2026-08-01',
    registrationEndDate: '2026-09-20',
    currentStage: 'Preparation & Sectional Strategy',
    officialWebsite: 'https://iimcat.ac.in',
    badgeColor: '#059669', // Emerald
    icon: '📈',
    description:
      'Premier computer-based entrance test for admission into India’s top prestigious business schools including IIM Ahmedabad, Bangalore, Calcutta, Lucknow, Kozhikode, and Indore.',
    pattern: {
      mode: 'Computer-Based Test (CBT)',
      totalDuration: '120 Minutes (Strict 40 minutes sectional time limit per section)',
      totalMarks: '198 Marks (66 Questions)',
      negativeMarking: '+3 for correct, -1 for wrong MCQ; No negative marking for Non-MCQs (TITA)',
      description:
        'Three strictly timed 40-minute sections. Test takers cannot move back and forth between sections once a section timer begins.',
      sections: [
        { id: 'cat-sec-varc', name: 'Verbal Ability & Reading Comprehension (VARC)', questions: 24, marks: 72, durationMinutes: 40, negativeMarking: '-1 mark for MCQ' },
        { id: 'cat-sec-dilr', name: 'Data Interpretation & Logical Reasoning (DILR)', questions: 20, marks: 60, durationMinutes: 40, negativeMarking: '-1 mark for MCQ' },
        { id: 'cat-sec-qa', name: 'Quantitative Aptitude (QA)', questions: 22, marks: 66, durationMinutes: 40, negativeMarking: '-1 mark for MCQ' },
      ],
    },
    stages: [
      {
        id: 'cat-stg-reg',
        name: 'Online Registration Window',
        startDate: '2026-08-01',
        endDate: '2026-09-20',
        status: 'upcoming',
        notes: 'Register on iimcat.ac.in. Upload photograph, signature, work experience certificates, and choose test city preferences.',
      },
      {
        id: 'cat-stg-admit',
        name: 'Admit Card Release',
        date: '2026-10-25',
        status: 'upcoming',
        notes: 'Download hall ticket showing allotted test centre and test slot (Morning, Afternoon, or Evening).',
      },
      {
        id: 'cat-stg-exam',
        name: 'CAT 2026 Exam Day',
        date: '2026-11-29',
        status: 'upcoming',
        notes: 'Computer-based test across 3 slots in over 150 test cities nationwide.',
      },
      {
        id: 'cat-stg-results',
        name: 'Results & Scorecard Declaration',
        date: '2027-01-05',
        status: 'upcoming',
        notes: 'Sectional and overall percentiles published. IIMs begin releasing shortlist for interview calls.',
      },
      {
        id: 'cat-stg-pi',
        name: 'IIM WAT & Personal Interview (PI)',
        startDate: '2027-02-01',
        endDate: '2027-04-15',
        status: 'upcoming',
        notes: 'Writing Ability Test (WAT) and Personal Interview rounds conducted across major cities.',
      },
    ],
    subjects: [
      {
        id: 'cat-sub-varc',
        name: 'Verbal Ability & Reading Comprehension (VARC)',
        code: 'VARC',
        description: 'Reading comprehension passages across philosophy, economics, science, psychology, plus verbal aptitude.',
        topics: [
          { id: 'cat-t1', title: 'Reading Comprehension: Philosophy, Psychology, and Epistemology Passages' },
          { id: 'cat-t2', title: 'Reading Comprehension: Economics, Global Trade, Business and Tech Passages' },
          { id: 'cat-t3', title: 'Reading Comprehension: History, Sociology, Anthropology and Cultural Anthropology' },
          { id: 'cat-t4', title: 'Reading Comprehension: Science, Evolutionary Biology, Environment and Ecology' },
          { id: 'cat-t5', title: 'Para Jumbles & Sentence Rearrangement (MCQ & TITA)' },
          { id: 'cat-t6', title: 'Paragraph Summary & Central Argument Extraction' },
          { id: 'cat-t7', title: 'Odd Sentence Out (Paragraph Coherence & Disconnect)' },
          { id: 'cat-t8', title: 'Sentence Placement (Fit the sentence into paragraph structure)' },
          { id: 'cat-t9', title: 'Critical Reasoning: Assumptions, Strengths, Weaknesses, and Flaws' },
        ],
      },
      {
        id: 'cat-sub-dilr',
        name: 'Data Interpretation & Logical Reasoning (DILR)',
        code: 'DILR',
        description: 'Complex tabular data, graphs, game tournaments, matrix arrangements, Venn diagrams, and puzzles.',
        topics: [
          { id: 'cat-t10', title: 'Data Interpretation: Tables, Multi-layer Charts, Bar & Column Graphs' },
          { id: 'cat-t11', title: 'Data Interpretation: Line Graphs, Growth Rates & CAGR Trends' },
          { id: 'cat-t12', title: 'Data Interpretation: Pie Charts, Degree Conversions & Multi-pie Comparisons' },
          { id: 'cat-t13', title: 'Data Interpretation: Radar Charts, Scatter Plots, Bubble Diagrams & Unconventional Visualizations' },
          { id: 'cat-t14', title: 'Caselets & Missing Data Tables (Data Sufficiency & Deduction)' },
          { id: 'cat-t15', title: 'Logical Reasoning: Linear, Circular, and Dual-row Seating Arrangements' },
          { id: 'cat-t16', title: 'Logical Reasoning: Complex Matrix & Multi-attribute Grid Puzzles' },
          { id: 'cat-t17', title: 'Games & Tournaments (Round-robin, Knockout, Seedings, and Scoring systems)' },
          { id: 'cat-t18', title: 'Venn Diagrams: 3-set and 4-set Overlaps, Maxima-Minima Optimization' },
          { id: 'cat-t19', title: 'Binary Logic: Truth-tellers, Liars, and Alternators' },
          { id: 'cat-t20', title: 'Cubes, Dice, Routes, Networks, and Flowcharts' },
        ],
      },
      {
        id: 'cat-sub-qa',
        name: 'Quantitative Aptitude (QA)',
        code: 'QA',
        description: 'Arithmetic, Algebra, Geometry & Mensuration, Number System, and Modern Mathematics.',
        topics: [
          { id: 'cat-t21', title: 'Arithmetic: Percentages, Profit, Loss & Discount' },
          { id: 'cat-t22', title: 'Arithmetic: Simple & Compound Interest (Installments & Annuities)' },
          { id: 'cat-t23', title: 'Arithmetic: Ratio, Proportion & Variation' },
          { id: 'cat-t24', title: 'Arithmetic: Averages, Mixtures & Alligations' },
          { id: 'cat-t25', title: 'Arithmetic: Time & Work (Pipes, Cisterns, Efficiency & Alternate Days)' },
          { id: 'cat-t26', title: 'Arithmetic: Time, Speed & Distance (Boats, Streams, Escalators, Relative Speed & Races)' },
          { id: 'cat-t27', title: 'Algebra: Linear & Quadratic Equations, Nature of Roots, Descarte Rule' },
          { id: 'cat-t28', title: 'Algebra: Higher Degree Polynomials & Remainder Theorem' },
          { id: 'cat-t29', title: 'Algebra: Inequalities, Modulus & Absolute Value Functions' },
          { id: 'cat-t30', title: 'Algebra: Functions, Composite Functions, Domain, Range & Graphs' },
          { id: 'cat-t31', title: 'Algebra: Logarithms, Surds, and Indices' },
          { id: 'cat-t32', title: 'Algebra: Progressions & Series (Arithmetic, Geometric, Harmonic & Special Series)' },
          { id: 'cat-t33', title: 'Geometry: Triangles (Congruence, Similarity, Centers, Angle Bisector & Apollonius)' },
          { id: 'cat-t34', title: 'Geometry: Circles, Chords, Tangents & Secants' },
          { id: 'cat-t35', title: 'Geometry: Quadrilaterals, Polygons & Coordinate Geometry' },
          { id: 'cat-t36', title: 'Mensuration: 2D & 3D Solids (Cylinders, Cones, Spheres, Prisms, Frustums)' },
          { id: 'cat-t37', title: 'Number System: Divisibility Rules, Factors, HCF & LCM' },
          { id: 'cat-t38', title: 'Number System: Remainders (Euler, Wilson & Chinese Remainder Theorems)' },
          { id: 'cat-t39', title: 'Number System: Cyclicity, Unit Digits, Last Two Digits, Base Systems' },
          { id: 'cat-t40', title: 'Modern Math: Permutations & Combinations (P&C)' },
          { id: 'cat-t41', title: 'Modern Math: Probability & Conditional Probability' },
        ],
      },
    ],
    books: [
      { id: 'b-cat-1', title: 'How to Prepare for Quantitative Aptitude for the CAT', author: 'Arun Sharma', subject: 'Quantitative Aptitude', priority: 'essential', completed: false },
      { id: 'b-cat-2', title: 'How to Prepare for Data Interpretation & Logical Reasoning', author: 'Arun Sharma', subject: 'DILR', priority: 'essential', completed: false },
      { id: 'b-cat-3', title: 'How to Prepare for Verbal Ability and Reading Comprehension', author: 'Arun Sharma & Meenakshi Upadhyay', subject: 'VARC', priority: 'essential', completed: false },
      { id: 'b-cat-4', title: 'Quantitative Aptitude Quantum CAT', author: 'Sarvesh K. Verma', subject: 'Advanced QA', priority: 'recommended', completed: false },
      { id: 'b-cat-5', title: 'Word Power Made Easy', author: 'Norman Lewis', subject: 'Vocabulary & Root Words', priority: 'recommended', completed: false },
    ],
    strategyNotes:
      'Arithmetic and Algebra account for ~70% of the QA section. In DILR, focus on set selection (finding the 2-3 solvable sets out of 4). In VARC, read Aeon Essays, The Guardian, and The Economist daily.',
  },

  // =========================================================================
  // 4. Combined Defence Services Examination (CDS - UPSC)
  // =========================================================================
  {
    name: 'Combined Defence Services (CDS) - UPSC',
    shortName: 'CDS (UPSC)',
    category: 'Defense',
    conductingBody: 'Union Public Service Commission (UPSC)',
    targetExamDate: '2026-09-06',
    registrationStartDate: '2026-05-15',
    registrationEndDate: '2026-06-04',
    currentStage: 'Upcoming Cycle',
    officialWebsite: 'https://upsc.gov.in',
    badgeColor: '#0284C7', // Sky Blue
    icon: '🎖️',
    description:
      'Conducted twice yearly by UPSC for entry into the Indian Military Academy (IMA), Officers Training Academy (OTA), Indian Naval Academy (INA), and Air Force Academy (AFA).',
    pattern: {
      mode: 'Offline Pen & Paper (OMR MCQ)',
      totalDuration: 'IMA/INA/AFA: 3 Papers (2h each); OTA: 2 Papers (2h each)',
      totalMarks: 'IMA/INA/AFA: 300 Marks; OTA: 200 Marks',
      negativeMarking: '0.33 marks deducted per wrong answer',
      description: 'Written exam followed by 5-day SSB (Services Selection Board) interview and medical board examination.',
      sections: [
        { id: 'cds-sec-eng', name: 'English', questions: 120, marks: 100, durationMinutes: 120, negativeMarking: '0.27 marks' },
        { id: 'cds-sec-gk', name: 'General Knowledge', questions: 120, marks: 100, durationMinutes: 120, negativeMarking: '0.27 marks' },
        { id: 'cds-sec-math', name: 'Elementary Mathematics (Not for OTA)', questions: 100, marks: 100, durationMinutes: 120, negativeMarking: '0.33 marks' },
      ],
    },
    stages: [
      { id: 'cds-stg-reg', name: 'Online Registration', startDate: '2026-05-15', endDate: '2026-06-04', status: 'upcoming', notes: 'Apply on upsconline.nic.in.' },
      { id: 'cds-stg-written', name: 'Written Examination', date: '2026-09-06', status: 'upcoming', notes: 'Conducted on Sunday across designated test cities.' },
      { id: 'cds-stg-ssb', name: 'SSB Interview (5 Days)', startDate: '2026-12-01', endDate: '2027-02-28', status: 'upcoming', notes: 'Screening, Psychology, GTO Tasks, and Personal Interview.' },
    ],
    subjects: [
      {
        id: 'cds-sub-eng',
        name: 'English Language',
        code: 'ENG',
        description: 'Grammar, vocabulary, sentence arrangement, reading comprehension, idioms & phrases.',
        topics: [
          { id: 'cds-t1', title: 'Spotting Errors & Sentence Correction' },
          { id: 'cds-t2', title: 'Sentence Arrangement & Ordering of Words in a Sentence' },
          { id: 'cds-t3', title: 'Reading Comprehension Passages' },
          { id: 'cds-t4', title: 'Idioms and Phrases & Vocabulary (Synonyms/Antonyms)' },
          { id: 'cds-t5', title: 'Cloze Test & Fill in the Blanks' },
        ],
      },
      {
        id: 'cds-sub-gk',
        name: 'General Knowledge & Current Affairs',
        code: 'GK',
        description: 'Indian history, geography, polity, general science (Physics, Chemistry, Biology), and defense current affairs.',
        topics: [
          { id: 'cds-t6', title: 'Indian History & Freedom Struggle' },
          { id: 'cds-t7', title: 'Physical & Political Geography of India and the World' },
          { id: 'cds-t8', title: 'Indian Polity, Constitution & Armed Forces Organization' },
          { id: 'cds-t9', title: 'General Science: Physics, Chemistry & Life Sciences (Class X Level)' },
          { id: 'cds-t10', title: 'Defense & National Security Current Affairs, Military Exercises & Missiles' },
        ],
      },
      {
        id: 'cds-sub-math',
        name: 'Elementary Mathematics (For IMA, INA, AFA)',
        code: 'MATH',
        description: 'Arithmetic, algebra, trigonometry, geometry, mensuration, and statistics.',
        topics: [
          { id: 'cds-t11', title: 'Arithmetic: Number System, HCF/LCM, Percentages, Profit & Loss, Time & Work' },
          { id: 'cds-t12', title: 'Algebra: Basic Operations, Remainder Theorem, Linear & Quadratic Equations' },
          { id: 'cds-t13', title: 'Trigonometry: Values of Sine, Cosine, Tangent, Heights and Distances' },
          { id: 'cds-t14', title: 'Geometry & Mensuration: Lines, Angles, Triangles, Circles, Areas and Volumes' },
          { id: 'cds-t15', title: 'Statistics: Histograms, Bar Charts, Pie Charts, Mean, Median & Mode' },
        ],
      },
    ],
    books: [
      { id: 'b-cds-1', title: 'Pathfinder for CDS Examination', author: 'Arihant Experts', subject: 'Comprehensive CDS Guide', priority: 'essential', completed: false },
      { id: 'b-cds-2', title: 'Quantitative Aptitude for Competitive Examinations', author: 'Dr. R.S. Aggarwal', subject: 'Elementary Mathematics', priority: 'essential', completed: false },
    ],
    strategyNotes:
      'For OTA aspirants, focus purely on English and GK. English is high-scoring; scoring 70+ in English significantly increases merit list selection chances.',
  },

  // =========================================================================
  // 5. National Eligibility cum Entrance Test (NEET-UG)
  // =========================================================================
  {
    name: 'National Eligibility cum Entrance Test (NEET-UG)',
    shortName: 'NEET-UG',
    category: 'Medical',
    conductingBody: 'National Testing Agency (NTA)',
    targetExamDate: '2026-05-03',
    registrationStartDate: '2026-02-05',
    registrationEndDate: '2026-03-15',
    currentStage: 'Revision & Full Mock Tests',
    officialWebsite: 'https://neet.nta.nic.in',
    badgeColor: '#DC2626', // Red
    icon: '🩺',
    description:
      'Nationwide entrance examination in India for admission into MBBS, BDS, BAMS, BHMS, and other undergraduate medical courses across top medical colleges including AIIMS and JIPMER.',
    pattern: {
      mode: 'Pen & Paper (OMR)',
      totalDuration: '200 Minutes (3 hours 20 minutes)',
      totalMarks: '720 Marks (180 Questions to attempt out of 200)',
      negativeMarking: '+4 for correct answer, -1 for incorrect answer; 0 for unattempted',
      description: '4 Subjects: Physics, Chemistry, Botany, and Zoology. Each subject has Section A (35 Qs) and Section B (15 Qs, attempt any 10).',
      sections: [
        { id: 'neet-sec-phy', name: 'Physics (Section A: 35 Qs, Section B: 10/15 Qs)', questions: 45, marks: 180, durationMinutes: 50, negativeMarking: '-1 mark' },
        { id: 'neet-sec-chem', name: 'Chemistry (Section A: 35 Qs, Section B: 10/15 Qs)', questions: 45, marks: 180, durationMinutes: 50, negativeMarking: '-1 mark' },
        { id: 'neet-sec-bot', name: 'Botany (Section A: 35 Qs, Section B: 10/15 Qs)', questions: 45, marks: 180, durationMinutes: 50, negativeMarking: '-1 mark' },
        { id: 'neet-sec-zoo', name: 'Zoology (Section A: 35 Qs, Section B: 10/15 Qs)', questions: 45, marks: 180, durationMinutes: 50, negativeMarking: '-1 mark' },
      ],
    },
    stages: [
      { id: 'neet-stg-reg', name: 'Online Registration Window', startDate: '2026-02-05', endDate: '2026-03-15', status: 'completed', notes: 'Register on exams.nta.ac.in/NEET.' },
      { id: 'neet-stg-admit', name: 'Admit Card Release', date: '2026-04-28', status: 'upcoming', notes: 'Download hall ticket with exam city slip.' },
      { id: 'neet-stg-exam', name: 'NEET-UG Exam Day', date: '2026-05-03', status: 'upcoming', notes: 'Pen and paper examination from 2:00 PM to 5:20 PM.' },
    ],
    subjects: [
      {
        id: 'neet-sub-bio',
        name: 'Biology (Botany & Zoology)',
        code: 'BIO',
        description: 'Complete NCERT Class 11 and 12 syllabus (360 Marks).',
        topics: [
          { id: 'neet-t1', title: 'Diversity in Living World & Biological Classification' },
          { id: 'neet-t2', title: 'Structural Organisation in Animals and Plants' },
          { id: 'neet-t3', title: 'Cell Structure and Function, Biomolecules & Cell Cycle' },
          { id: 'neet-t4', title: 'Plant Physiology: Photosynthesis, Respiration & Plant Growth' },
          { id: 'neet-t5', title: 'Human Physiology: Digestion, Breathing, Circulation, Excretion & Nervous System' },
          { id: 'neet-t6', title: 'Reproduction in Organisms, Flowering Plants & Humans' },
          { id: 'neet-t7', title: 'Genetics and Evolution: Principles of Inheritance & Molecular Basis' },
          { id: 'neet-t8', title: 'Biology and Human Welfare: Health & Diseases, Microbes' },
          { id: 'neet-t9', title: 'Biotechnology: Principles, Processes and Applications' },
          { id: 'neet-t10', title: 'Ecology and Environment: Ecosystem, Biodiversity and Conservation' },
        ],
      },
      {
        id: 'neet-sub-chem',
        name: 'Chemistry',
        code: 'CHEM',
        description: 'Physical, Inorganic, and Organic Chemistry based on rationalized NCERT curriculum.',
        topics: [
          { id: 'neet-t11', title: 'Physical Chemistry: Atomic Structure, Chemical Bonding & Molecular Structure' },
          { id: 'neet-t12', title: 'Physical Chemistry: Chemical Thermodynamics, Equilibrium & Solutions' },
          { id: 'neet-t13', title: 'Physical Chemistry: Redox Reactions and Electrochemistry, Chemical Kinetics' },
          { id: 'neet-t14', title: 'Inorganic Chemistry: Classification of Elements & Periodicity' },
          { id: 'neet-t15', title: 'Inorganic Chemistry: p-Block, d- and f-Block Elements & Coordination Compounds' },
          { id: 'neet-t16', title: 'Organic Chemistry: Basic Principles and Techniques (GOC) & Hydrocarbons' },
          { id: 'neet-t17', title: 'Organic Chemistry: Haloalkanes, Haloarenes, Alcohols, Phenols and Ethers' },
          { id: 'neet-t18', title: 'Organic Chemistry: Aldehydes, Ketones, Carboxylic Acids & Amines' },
          { id: 'neet-t19', title: 'Biomolecules in Chemistry' },
        ],
      },
      {
        id: 'neet-sub-phy',
        name: 'Physics',
        code: 'PHY',
        description: 'Mechanics, Electrodynamics, Optics, Thermodynamics, and Modern Physics.',
        topics: [
          { id: 'neet-t20', title: 'Units and Measurements & Kinematics (1D and 2D Motion)' },
          { id: 'neet-t21', title: 'Laws of Motion, Work, Energy and Power' },
          { id: 'neet-t22', title: 'Motion of System of Particles and Rigid Body (Rotational Dynamics)' },
          { id: 'neet-t23', title: 'Gravitation & Properties of Bulk Matter (Fluids & Solids)' },
          { id: 'neet-t24', title: 'Thermodynamics & Kinetic Theory of Gases' },
          { id: 'neet-t25', title: 'Oscillations and Waves (SHM & Wave Motion)' },
          { id: 'neet-t26', title: 'Electrostatics, Current Electricity & Magnetic Effects of Current' },
          { id: 'neet-t27', title: 'Electromagnetic Induction & Alternating Currents' },
          { id: 'neet-t28', title: 'Optics: Ray Optics and Wave Optics' },
          { id: 'neet-t29', title: 'Dual Nature of Radiation, Atoms, Nuclei & Semiconductor Electronics' },
        ],
      },
    ],
    books: [
      { id: 'b-neet-1', title: 'NCERT Biology Class 11 & 12', author: 'NCERT', subject: 'Biology', priority: 'essential', completed: false },
      { id: 'b-neet-2', title: 'Concepts of Physics (Vol 1 & 2)', author: 'Dr. H.C. Verma', subject: 'Physics', priority: 'essential', completed: false },
      { id: 'b-neet-3', title: 'Modern ABC of Chemistry', author: 'Dr. S.P. Jauhar', subject: 'Chemistry', priority: 'recommended', completed: false },
    ],
    strategyNotes:
      'Biology NCERT should be memorized line-by-line. In Physics and Physical Chemistry, practice numerical problem solving and past 15 years NEET PYQs with timed condition.',
  },

  // =========================================================================
  // 6. National Defence Academy & Naval Academy (NDA - UPSC)
  // =========================================================================
  {
    name: 'National Defence Academy (NDA) - UPSC',
    shortName: 'NDA & NA',
    category: 'Defense',
    conductingBody: 'Union Public Service Commission (UPSC)',
    targetExamDate: '2026-09-13',
    registrationStartDate: '2026-05-15',
    registrationEndDate: '2026-06-04',
    currentStage: 'Upcoming Cycle',
    officialWebsite: 'https://upsc.gov.in',
    badgeColor: '#16A34A', // Green
    icon: '🛡️',
    description:
      'Joint services academy exam for selection of cadets for the Indian Army, Indian Navy, and Indian Air Force prior to specialized pre-commission training.',
    pattern: {
      mode: 'Offline Pen & Paper (OMR MCQ)',
      totalDuration: '5 Hours (Mathematics 2.5h + GAT 2.5h)',
      totalMarks: '900 Marks (Maths 300 + GAT 600)',
      negativeMarking: '0.33 deduction per wrong answer',
      description: 'Paper 1 (Mathematics: 120 Qs, 300 Marks) and Paper 2 (General Ability Test - GAT: 150 Qs, 600 Marks) followed by 5-day SSB interview (900 Marks).',
      sections: [
        { id: 'nda-sec-math', name: 'Mathematics', questions: 120, marks: 300, durationMinutes: 150, negativeMarking: '0.83 marks' },
        { id: 'nda-sec-gat', name: 'General Ability Test (English 200 + GK 400)', questions: 150, marks: 600, durationMinutes: 150, negativeMarking: '1.33 marks' },
      ],
    },
    stages: [
      { id: 'nda-stg-reg', name: 'Online Application Window', startDate: '2026-05-15', endDate: '2026-06-04', status: 'upcoming', notes: 'Register on upsconline.nic.in.' },
      { id: 'nda-stg-exam', name: 'Written Examination', date: '2026-09-13', status: 'upcoming', notes: 'Objective test conducted on Sunday.' },
      { id: 'nda-stg-ssb', name: 'SSB Interview (5 Days)', startDate: '2027-01-05', endDate: '2027-03-30', status: 'upcoming', notes: 'Stage 1 (OIR & PPDT) and Stage 2 (Psychology, GTO, Interview).' },
    ],
    subjects: [
      {
        id: 'nda-sub-math',
        name: 'Mathematics',
        code: 'MATH',
        description: 'Class 11 and 12 CBSE mathematics curriculum (Calculus, Trigonometry, Matrices, Vectors, Algebra).',
        topics: [
          { id: 'nda-t1', title: 'Algebra: Sets, Relations, Complex Numbers, Progressions, Quadratic Equations' },
          { id: 'nda-t2', title: 'Matrices and Determinants & System of Linear Equations' },
          { id: 'nda-t3', title: 'Trigonometry: Angles and Measures, Trigonometric Identities, Inverse Functions' },
          { id: 'nda-t4', title: 'Analytical Geometry (2D and 3D): Lines, Circles, Conics & Planes' },
          { id: 'nda-t5', title: 'Differential Calculus & Applications of Derivatives' },
          { id: 'nda-t6', title: 'Integral Calculus & Differential Equations' },
          { id: 'nda-t7', title: 'Vector Algebra & 3-Dimensional Vectors' },
          { id: 'nda-t8', title: 'Statistics and Probability: Probability Theorems, Binomial Distribution' },
        ],
      },
      {
        id: 'nda-sub-gat',
        name: 'General Ability Test (GAT)',
        code: 'GAT',
        description: 'Part A: English (200 Marks); Part B: General Knowledge, Physics, Chemistry, Biology, History, Geography, Current Affairs (400 Marks).',
        topics: [
          { id: 'nda-t9', title: 'English: Grammar and Usage, Vocabulary, Comprehension, Sentence Sequencing' },
          { id: 'nda-t10', title: 'Physics: Mechanics, Electricity, Magnetism, Sound, Heat & Light' },
          { id: 'nda-t11', title: 'Chemistry: Elements, Compounds, Chemical Equations, Acids, Bases, Salts' },
          { id: 'nda-t12', title: 'General Science: Basic Biology, Human Body Systems & Nutrition' },
          { id: 'nda-t13', title: 'History, Freedom Movement & Indian Constitution' },
          { id: 'nda-t14', title: 'Geography: Solar System, Earth Structure, Indian Rivers & Climate' },
          { id: 'nda-t15', title: 'Current Events, Defense News, Awards & Sports' },
        ],
      },
    ],
    books: [
      { id: 'b-nda-1', title: 'Pathfinder for NDA & NA Entrance Examination', author: 'Arihant Experts', subject: 'Complete NDA Guide', priority: 'essential', completed: false },
      { id: 'b-nda-2', title: 'Mathematics for NDA and NA', author: 'Dr. R.S. Aggarwal', subject: 'Mathematics', priority: 'essential', completed: false },
    ],
    strategyNotes:
      'Mathematics requires clear fundamental concepts and high solving speed. Candidates must score at least 25% in each paper to qualify.',
  },
];

// Helper to instantiate an ExamItem from a preset
export function createExamFromPreset(
  preset: Omit<ExamItem, 'id' | 'createdAt' | 'updatedAt'>
): ExamItem {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return {
    ...preset,
    id: `exam-${timestamp}-${randomSuffix}`,
    createdAt: timestamp,
    updatedAt: timestamp,
    // Deep copy arrays
    stages: preset.stages.map((s) => ({ ...s })),
    subjects: preset.subjects.map((sub) => ({
      ...sub,
      topics: sub.topics.map((t) => ({ ...t, completed: false })),
    })),
    books: preset.books ? preset.books.map((b) => ({ ...b })) : [],
  };
}

// Default user exams list:
// The user explicitly requested:
// "By default on clicking exam section a my exam page shall open and a blank page with add button to add exams ( both from all exam section and also can create a new exam on own and customize and add syllabus and everything)."
// Therefore, the initial state of My Exams starts empty ([]).
export const INITIAL_USER_EXAMS: ExamItem[] = [];

// Export as PRESET_EXAMS for backward compatibility
export const PRESET_EXAMS = ALL_PRESET_EXAMS;
