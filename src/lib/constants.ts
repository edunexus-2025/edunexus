
import type { Plan, UserSubscriptionTierStudent, UserSubscriptionTierTeacher } from '@/lib/types';

export const AppConfig = {
  appName: 'EduNexus',
};

// Define APP_BASE_URL with a client-side fallback
export const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:9002');


export const Routes = {
  home: '/',
  login: '/login',
  signup: '/signup',
  forgotPassword: '/forgot-password',
  completeProfile: '/complete-profile',
  dashboard: '/dashboard',
  testSeries: '/dashboard/test-series',
  viewTestSeries: (testSeriesId: string) => `/dashboard/test-series/${testSeriesId}`,

  // DPP Routes
  dpp: '/dashboard/dpp',
  dppExamSubjects: (examSlug: string) => `/dashboard/dpp/${examSlug}`,
  dppExamSubjectLessons: (examSlug: string, subjectSlug: string) => `/dashboard/dpp/${examSlug}/${subjectSlug}`,
  dppExamSubjectLessonQuestions: (examSlug: string, subjectSlug: string, lessonSlug: string) => `/dashboard/dpp/${examSlug}/${subjectSlug}/${lessonSlug}`,
  dppAnalysis: function(examSlug: string, subjectSlug: string, lessonSlug: string) {
    return `/dashboard/dpp/analysis/${examSlug}/${subjectSlug}/${lessonSlug}`;
  },
  dppCombined: '/dashboard/dpp/combined',

  // PYQ Practice Routes (New Combined Route)
  pyqPractice: '/dashboard/pyq-practice',

  notebooks: '/dashboard/notebooks',
  viewNotebook: (notebookId: string) => `/dashboard/notebooks/${notebookId}`,
  myProgress: '/dashboard/my-progress',
  leaderboard: '/dashboard/leaderboard',
  upgrade: '/dashboard/upgrade',
  discussionForum: '/dashboard/discussion-forum',
  discussionForumGroup: (groupId: string) => `/dashboard/discussion-forum/${groupId}`,

  // Connect & Compete Routes
  createChallenge: '/dashboard/create-challenge',
  challengeLobby: (challengeId: string) => `/dashboard/challenge-lobby/${challengeId}`,
  challengeInvites: '/dashboard/challenge-invites',
  findFriends: '/dashboard/find-friends',
  connections: '/dashboard/connections',
  competeTest: (challengeId: string) => `/dashboard/compete/${challengeId}`,

  // User specific routes
  profile: '/dashboard/profile',
  settings: '/dashboard/settings',
  editProfile: '/dashboard/settings/edit-profile',
  changePassword: '/dashboard/settings/change-password',
  feedback: '/dashboard/settings/feedback',
  studyPlan: '/dashboard/study-plan',
  studentTeacherRanking: '/dashboard/teacher-ranking',
  myTeacherPortal: '/dashboard/my-teacher',
  testResult: (resultId: string) => `/dashboard/test-results/chapterwise/${resultId}`,
  testResultCompete: (resultId: string) => `/dashboard/test-results/compete/${resultId}`, // For challenge/compete results
  helpCenter: '/dashboard/help-center',
  termsOfService: '/terms-of-service',
  privacyPolicy: '/privacy-policy',
  cancellationPolicy: '/cancellation-policy',
  refundPolicy: '/refund-policy',
  contactUs: '/contact-us',
  activatePlan: (token: string, planSlug: string) => `/activate-plan/${token}/${planSlug}`,
  collegeCutoffs: '/college-cutoffs', 
  ownerInfo: '/owner-info',
  paymentStatusPage: (orderId: string, status: 'success' | 'failure' | 'error' | 'info', planName?: string, message?: string) => {
    const params = new URLSearchParams();
    params.set('order_id', orderId);
    params.set('status', status);
    if (planName) params.set('planName', planName);
    if (message) params.set('message', message);
    return `/payment/status?${params.toString()}`;
  },


  // Student Test Taking Routes
  studentTestInstructions: (testId: string) => `/student/test/${testId}/instructions`, 
  studentTestChapterwise: (testId: string) => `/student/test/${testId}/chapterwise`, 

  // Routes for student taking a teacher-created test
  studentTakeTeacherTestLive: (testId: string) => `/student/teacher-test/${testId}/live`,
  studentTestEnterPin: (testId: string) => `/student/teacher-test/${testId}/enter-pin`,
  testResultTeacherTest: (attemptId: string) => `/student/teacher-test/results/${attemptId}`,


  // Unified Question Bank view
  qbankView: (questionId: string) => `/dashboard/qbank/${questionId}`,

  // Admin Routes
  adminDashboard: '/admin/dashboard',
  adminUserManagement: '/admin/user-management',
  adminNotificationSender: '/admin/notification-sender',
  adminSiteSettings: '/admin/site-settings',
  adminQuestionBank: '/admin/question-bank',
  adminEditQuestion: '/admin/edit-question',
  adminAddQuestionJson: '/admin/add-question-json',
  adminCreateTest: '/admin/create-test',
  adminSyllabusOverview: '/admin/syllabus-overview',
  adminContentStructure: '/admin/content-structure',
  adminContentSyllabusManager: '/admin/content-syllabus-manager',
  adminCreateAds: '/admin/create-ads',
  adminManageReferrals: '/admin/manage-referrals',
  adminManageCollegeCutoffs: '/admin/manage-college-cutoffs',
  adminUploadCollegeCutoffs: '/admin/upload-college-cutoffs',

  // Teacher Routes
  teacherLogin: '/teacher/login',
  teacherSignup: '/teacher/signup',
  teacherDashboard: '/teacher/dashboard',
  teacherMyContent: '/teacher/dashboard/my-content',
  teacherManagePlans: '/teacher/dashboard/manage-plans',
  teacherViewPlan: (planId: string) => `/teacher/dashboard/manage-plans/${planId}`,
  teacherUpgradePlatformPlan: '/teacher/dashboard/upgrade-plan',
  teacherStudentPerformance: '/teacher/dashboard/student-performance',
  teacherSettings: '/teacher/dashboard/settings',
  teacherMyStudents: '/teacher/dashboard/my-students',
  teacherStudentGroups: '/teacher/dashboard/student-groups',
  teacherTestPanel: (testId: string) => `/teacher/dashboard/my-content/${testId}`,
  teacherTestPanelAddQuestion: (testId: string) => `/teacher/dashboard/my-content/${testId}/add-question`,
  teacherTestPanelViewQuestions: (testId: string) => `/teacher/dashboard/my-content/${testId}/view-questions`,
  teacherTestPanelSettings: (testId: string) => `/teacher/dashboard/my-content/${testId}/settings`,
  teacherTestPanelResults: (testId: string) => `/teacher/dashboard/my-content/${testId}/results`,
  teacherTestPanelStatus: (testId: string) => `/teacher/dashboard/my-content/${testId}/status`,
  teacherRanking: '/teacher/dashboard/ranking',
  teacherPlan: '/teacher/dashboard/plan',
  teacherCreateAds: '/teacher/dashboard/create-ads',
  teacherUpgradeAds: '/teacher/dashboard/upgrade-ads',
  teacherPublicAdPage: (edunexusName: string): string => `/t/${edunexusName}`,
  teacherPublicPlansPage: (edunexusName: string): string => `/teacher-plans/${edunexusName}`,
  teacherManageDiscussion: '/teacher/dashboard/manage-discussion',
  teacherWallet: '/teacher/dashboard/wallet',
  teacherManageReferrals: '/teacher/dashboard/manage-referrals',

  // College Details Section Routes
  collegeDetailsLogin: '/college-details/login',
  collegeDetailsSignup: '/college-details/signup',
  collegeDetailsDashboard: '/college-details/dashboard',
  collegeDetailsSearch: '/college-details/search', // Placeholder
  collegeDetailsCutoffs: '/college-details/cutoffs-analysis', // Placeholder
  collegeDetailsPreferences: '/college-details/my-preferences', // Placeholder
  // collegeDetailsSettings: '/college-details/settings', // Placeholder if needed
};

// Helper to convert display names to URL-friendly slugs
export const slugify = (text: string): string => {
  if (!text) return '';
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
};

export const unslugify = (slug: string): string => {
  if (!slug) return '';
  // Replace hyphens with spaces, then capitalize each word
  return slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// Helper to escape strings for PocketBase filter queries
export const escapeForPbFilter = (value: string | undefined | null): string => {
  if (!value) return '';
  // Escape single quotes by doubling them up, then double quotes by doubling them up.
  return value.replace(/'/g, "''").replace(/"/g, '""');
};

export const EXAM_SUBJECTS: Record<string, string[]> = {
  'jee-main': ['Physics', 'Chemistry', 'Mathematics'],
  'neet': ['Physics', 'Chemistry', 'Biology'],
  'mht-cet': ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
  'combined': ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
  'jee-advanced': ['Physics', 'Chemistry', 'Mathematics'],
  'kcet': ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
  'wbjee': ['Physics', 'Chemistry', 'Mathematics'],
  'mht-cet-pcm': ['Physics', 'Chemistry', 'Mathematics'],
  'mht-cet-pcb': ['Physics', 'Chemistry', 'Biology'],
  'aiims': ['Physics', 'Chemistry', 'Biology', 'General Knowledge'],
  'jipmer': ['Physics', 'Chemistry', 'Biology', 'English', 'Logical Reasoning'],
  'nda': ['Mathematics', 'General Ability Test'],
};

export interface DppExamOption {
  id: string;
  name: string;
  slug: string;
  description: string;
  iconUrl: string;
  isIconComponent?: boolean;
  dataAiHint: string;
}

export const DPP_EXAM_OPTIONS: DppExamOption[] = [
  { id: 'jee-main-dpp', name: 'JEE MAIN', slug: 'jee-main', description: 'Targeted Daily Practice Problems for JEE Main aspirants.', iconUrl: 'https://i.filecdn.in/755esias/image-1718508545561.png', dataAiHint: 'engineering exam' },
  { id: 'neet-dpp', name: 'NEET', slug: 'neet', description: 'Daily drills to sharpen your concepts for NEET UG.', iconUrl: 'https://i.filecdn.in/755esias/image-1718508545561.png', dataAiHint: 'medical exam' },
  { id: 'mht-cet-dpp', name: 'MHT CET', slug: 'mht-cet', description: 'Focused practice sets for MHT CET (Engineering & Medical).', iconUrl: 'https://upload.wikimedia.org/wikipedia/en/6/60/MHT-CET_logo.png', dataAiHint: 'state exam' },
  { id: 'combined-dpp', name: 'Combined DPPs', slug: 'combined', description: 'Access a mixed set of Daily Practice Problems from all exams.', iconUrl: '/assets/icons/book-open-icon.svg', isIconComponent: true, dataAiHint: 'mixed practice' },
];

// For Admin Question Bank PYQ Exam Name dropdown
export const PYQ_EXAM_NAME_OPTIONS = [
    "JEE Main", "JEE Advanced", "KCET", "WBJEE", "MHT CET PCM", "MHT CET PCB", "NEET"
] as const;

export const PYQ_SHIFT_OPTIONS = ["Shift 1", "Shift 2", "N/A"] as const;
export const DPP_ASSOCIATED_EXAMS = ["JEE MAIN", "NEET", "MHT CET"] as const;

export const allPlansData: Plan[] = [
  {
    id: 'Free',
    name: 'Nova',
    description: "New star; represents a fresh start. Basic access to get started.",
    price: '₹0',
    priceSuffix: 'Always',
    priceValue: 0,
    features: [
      'Access to free test series',
      'Daily limit of 50 DPP questions',
      'Overall 60 PYQs access',
      'No challenge and compete with friends feature',
      'Basic Performance Tracking',
      'Community Forum Access',
    ],
    ctaText: 'Get Started',
  },
  {
    id: 'Dpp',
    name: 'Pulse',
    description: "Daily rhythm of practice. Focus on daily problems and foundational tests.",
    price: '₹1',
    priceSuffix: '/- year', 
    priceValue: 1,      
    features: [
      'All Nova features',
      'Access to free test series',
      'Access to free full length tests',
    ],
    ctaText: 'Choose Pulse',
  },
  {
    id: 'Chapterwise',
    name: 'Focus',
    description: "Focus your preparation with unlimited access to all chapter-specific tests.",
    price: '₹599',
    priceSuffix: '/year',
    priceValue: 599,
    features: [
      'All Pulse features',
      'Access to free chapterwise test series',
    ],
    ctaText: 'Choose Focus',
  },
  {
    id: 'Full_length',
    name: 'Prime',
    description: "Full potential; complete preparation. Access full-length mock tests for exam simulation.",
    price: '₹499',
    priceSuffix: '/year',
    priceValue: 499,
    features: [
      'All Full Length Test Series',
      'Detailed Solutions',
      'Performance Analysis per Chapter',
      'Regular DPP Access',
    ],
    ctaText: 'Choose Prime',
  },
  {
    id: 'Combo',
    name: 'Zenith',
    description: "The peak; best of both worlds. The ultimate package for comprehensive preparation.",
    price: '₹999',
    priceSuffix: '/year',
    priceValue: 999,
    features: [
      'Everything in Prime, Focus & Pulse',
      'All PYQ DPPs & Mock Tests',
      'Exclusive Content & Workshops',
      'Priority Support',
      'Challenge and Compete with Friends',
    ],
    isRecommended: true,
    ctaText: 'Choose Zenith',
  },
];

const studentTierValues: UserSubscriptionTierStudent[] = ['Free', 'Dpp', 'Chapterwise', 'Full_length', 'Combo'];
export const studentPlansData: Plan[] = allPlansData.filter(plan =>
  studentTierValues.includes(plan.id as UserSubscriptionTierStudent)
);

export const teacherPlatformPlansData: Plan[] = [
  {
    id: 'Free',
    name: 'Teacher Basic',
    description: "Get started and explore basic teaching tools.",
    price: '₹0',
    priceSuffix: 'Always',
    priceValue: 0,
    features: [
      "Create up to 2 content plans (tests/DPP series)",
      "Basic analytics for your students",
      "Limited access to EduNexus Question Bank features",
    ],
    ctaText: 'Current Plan',
    commissionRate: 10, 
    maxContentPlans: 2,
    qbAccess: false,
  },
  {
    id: 'Starter',
    name: 'Teacher Starter',
    description: "More tools and capacity for growing educators.",
    price: '₹399',
    priceSuffix: '/year',
    priceValue: 399,
    features: [
      "Create up to 5 content plans",
      "Enhanced student analytics",
      "Standard access to EduNexus Question Bank features",
    ],
    ctaText: 'Upgrade to Starter',
    commissionRate: 7.5, 
    maxContentPlans: 5,
    qbAccess: false,
  },
  {
    id: 'Pro',
    name: 'Teacher Pro',
    description: "Full access to all features for professional educators.",
    price: '₹599',
    priceSuffix: '/year',
    priceValue: 599,
    features: [
      "Create up to 10 content plans",
      "Full access to EduNexus Question Bank",
      "Advanced analytics and reporting tools",
      "Priority support",
    ],
    isRecommended: true,
    ctaText: 'Upgrade to Pro',
    commissionRate: 5, 
    maxContentPlans: 10,
    qbAccess: true,
  },
  {
    id: 'Ads Model', 
    name: 'Advertisement Creator Pack',
    description: "Enable tools to create and manage advertisements for your content on EduNexus.",
    price: '₹10',
    priceSuffix: '/month (Activation via Telegram)',
    priceValue: 10, 
    features: [
      "Create promotional ads for your profile & plans",
      "Reach a wider student audience on EduNexus",
      "Track ad performance (coming soon)"
    ],
    ctaText: 'Activate Ad Features',
    customActivationLink: Routes.teacherUpgradeAds, 
  },
];

    
