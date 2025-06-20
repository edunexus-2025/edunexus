
// Represents the structure of user data from PocketBase, aligned with your collection
import type { RecordModel } from 'pocketbase'; // Added import for RecordModel

export type UserSubscriptionTierStudent = 'Free' | 'Chapterwise' | 'Full_length' | 'Dpp' | 'Combo'; // Corrected to Full_length
export type UserSubscriptionTierTeacher = 'Free' | 'Starter' | 'Pro';

export interface Plan {
  id: UserSubscriptionTierStudent | UserSubscriptionTierTeacher | 'Ads Model'; // Added Ads Model
  name: string;
  description: string;
  price: string;
  priceSuffix: string;
  priceValue: number;
  features: string[];
  ctaText?: string;
  isRecommended?: boolean;
  commissionRate?: number; // For teacher platform plans
  maxContentPlans?: number; // For teacher platform plans
  qbAccess?: boolean; // For teacher platform plans
  customActivationLink?: string; // For plans like Ads Model that have a different flow
}

export type User = {
  id: string;
  email: string;
  name: string;
  username?: string;
  verified?: boolean;
  emailVisibility?: boolean;

  grade?: 'Grade 11' | 'Grade 12' | 'Dropper';
  phoneNumber?: string;

  studentSubscriptionTier?: UserSubscriptionTierStudent;
  teacherSubscriptionTier?: UserSubscriptionTierTeacher; // Updated

  role: 'User' | 'Admin' | 'Teacher';
  avatarUrl?: string;
  avatar?: string;
  profile_picture?: string;
  favExam?: 'JEE MAIN' | 'NDA' | 'MHT CET' | 'KCET' | 'NEET';
  totalPoints?: number;
  targetYear?: number;
  referralCode?: string;
  referredByCode?: string;
  referralStats?: Record<UserSubscriptionTierStudent | UserSubscriptionTierTeacher, number>;

  studyPlan?: string;
  joineddate?: string;

  // Teacher-specific fields
  institute_name?: string;
  total_students?: '1-10' | '11-30' | '31-60' | '61-100' | '>100';
  level?: 'Beginner' | 'Experienced';
  EduNexus_Name?: string;
  teacherFavExams?: Array<'MHT CET' | 'JEE MAIN' | 'NEET'>;
  about?: string;
  subjects_offered?: Array<'Physics' | 'Chemistry' | 'Maths' | 'Biology'>;
  used_free_trial?: boolean;
  can_create_ads?: boolean;
  ads_subscription?: 'Free' | 'Ads Model';
  max_content_plans_allowed?: number;
  wallet_money?: number; // Added for teacher's current balance

  created?: string;
  updated?: string;
  collectionId?: string;
  collectionName?: string; // Will be 'users', 'teacher_data', or 'college_details_users'
  subscription_by_teacher?: string[]; // Ensure this is always an array
  needsProfileCompletion?: boolean;
};

export type AccessType = "Free" | "Premium";

export type TestSeries = {
  id: string;
  title: string;
  description: string;
  subject: string;
  questionCount: number;
  durationMinutes: number;
  targetAudience: string;
  accessType: AccessType;
  syllabus: string[];
  schedule: string;
  price: number;
  imageUrl?: string;
  dataAiHint?: string;
  targetExams: string[];
  unlocksAtTier?: UserSubscriptionTierStudent | 'Teacher';
};

export type DppQuestion = {
  id: string;
  title: string;
  problemStatement: string;
  topic: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
};

export type PerformanceReport = {
  id: string;
  userId: string;
  testId?: string;
  dppId?: string;
  score: number;
  totalMarks: number;
  date: string;
};

export interface NotificationMessage {
  id: string;
  title: string;
  message: string;
  timestamp: Date;
  read?: boolean;
  type?: 'general' | 'challenge_invite' | 'challenge_accepted' | 'challenge_rejected' | 'test_assigned' | 'invitation';
  bywho_if_student?: string;
  bywho_if_teacher?: string;
  bywho?: string;
  towho?: string[];
  approved?: boolean | null | undefined;
  related_challenge_id?: string;
  related_invite_id?: string;
}


export type StudentBookmarkCategory = "Gone Tricky" | "To Remeber";

export interface StudentBookmark extends RecordModel {
  id: string;
  user: string;
  notebook_name: string;
  questions?: string[];
  category?: StudentBookmarkCategory[];
  tags?: string[];
  last_updated_by_question_interaction?: string;
  created: string;
  updated: string;
  questionCount?: number;
}

export interface DiscussionGroup {
  id: string;
  db_id?: string;
  name: string;
  type: 'app_plan' | 'teacher_group' | 'general_topic';
  description?: string;
  icon?: React.ElementType;
  requiredTier?: UserSubscriptionTierStudent | 'Full_length'; // Corrected
}

export interface ChallengeInviteRecord extends RecordModel {
    student: string;
    created_challenged_data: string;
    Accepted_or_not?: boolean | null | undefined;
    expand?: {
      created_challenged_data?: {
        id: string;
        student: string;
        Subject: string;
        Lesson: string;
        number_of_question: number;
        Difficulty: string;
        Exam_specific_questions?: string;
        duration?: number;
        challenge_name?: string;
        status?: 'pending' | 'active' | 'completed' | 'expired' | 'cancelled';
        expires_at?: string;
        created: string;
        expiry_time_min: number;
        expand?: {
          student?: {
            id: string;
            name: string;
            avatarUrl?: string;
            avatar?: string;
            collectionId?: string;
            collectionName?: string;
          }
        }
      }
    }
  }

export interface DiscussionMessage {
  id: string;
  group: string;
  message: string;
  created: string;
  updated: string;
  senderName: string;
  senderAvatarUrl?: string;
  isCurrentUser: boolean;
  by_whom_student_id?: string;
  by_whom_teacher_id?: string;

  likes: number;
  dislikes: number;

  repliedToMessageId?: string;
  repliedToMessageSnippet?: string;
  repliedToSenderName?: string;
  repliedToIsCurrentUser?: boolean;

  any_image?: string;
  any_link?: string | undefined;
  like_by?: string[];
  unlike_by?: string[];

  expand?: {
    by_whom_student?: Pick<User, 'id' | 'name' | 'avatarUrl' | 'avatar' | 'collectionId' | 'collectionName'>;
    by_whom_teacher?: Pick<User, 'id' | 'name' | 'avatarUrl' | 'profile_picture' | 'collectionId' | 'collectionName'>;
    replied_to_message?: {
      id: string;
      message: string;
      expand?: {
        by_whom_student?: Pick<User, 'id' | 'name'>;
        by_whom_teacher?: Pick<User, 'id' | 'name'>;
      }
    }
    like_by?: Array<Pick<User, 'id' | 'name'>>;
    unlike_by?: Array<Pick<User, 'id' | 'name'>>;
  };
  collectionId?: string;
  collectionName?: string;
}

export interface TeacherPlan extends RecordModel { // Updated to use RecordModel for consistency
  id: string;
  teacher: string;
  Plan_name: string;
  plan_price: string; // Stored as string, e.g., "0", "299"
  plan: 'Monthly' | 'Weekly' | 'Yearly'; // This is plan_duration from schema
  plan_point_1?: string;
  plan_point_2?: string;
  plan_point_3?: string;
  plan_point_4?: string;
  plan_point_5?: string;
  enrolled_students?: string[]; // Array of student IDs
  created: string;
  updated: string;
  enrolledStudentCount?: number; // For client-side display
}

export interface StudentSubscribedPlan extends RecordModel {
  id: string;
  student: string;
  teacher: string;
  teachers_plan_id: string; // This is the relation to teachers_upgrade_plan
  payment_status: 'pending' | 'successful' | 'failed' | 'refunded';
  expiry_date?: string;
  teachers_plan_name_cache?: string; // Cache of the plan name
  created: string;
  updated: string;
  amount_paid_to_edunexus: number; // Commission amount to EduNexus
  amount_recieved_to_teacher: number; // Net amount for the teacher
  payment_id_razorpay?: string;
  order_id_razorpay?: string;
  referral_code_used?: string;
  expand?: {
    student?: { // Student details who subscribed
      id: string;
      name: string;
    };
    teachers_plan_id?: { // Details of the teacher's plan subscribed to
      Plan_name: string;
      id: string;
    }
  }
}

export interface TeacherWalletTransaction extends RecordModel {
  id: string;
  teacher: string;
  student_histroy?: string; // ID of students_teachers_upgrade_plan record
  total_amount_recieved: number; // Amount received by teacher AFTER EduNexus commission
  by_which_plan_revieved?: string; // ID of teachers_upgrade_plan record
  transaction_date: string;
  transaction_details?: string;
  created: string;
  expand?: {
    student_histroy?: {
      id: string;
      student: string;
      teachers_plan_id: string;
      amount_paid_to_edunexus: number;
      amount_recieved_to_teacher: number;
      created: string;
      expand?: {
        student?: { name: string; id: string; };
        teachers_plan_id?: { Plan_name: string; id: string; };
      }
    };
    by_which_plan_revieved?: {
      Plan_name: string;
      id: string;
    }
  }
}

export interface TeacherReferralCode extends RecordModel {
  id: string;
  teacher: string;
  referral_code_string: string;
  discount_percentage: number;
  applicable_plan_ids: string[]; // Array of teachers_upgrade_plan IDs
  expiry_date?: string;
  created: string;
  updated: string;
}

// This type represents a single item in the answers_log for TeacherTestAttempt
export interface AnswerLogItem {
  questionId: string;
  selectedOption: string | null;
  correctOption: string | null;
  isCorrect: boolean;
  markedForReview?: boolean; 
  timeSpentSeconds: number;
}

// This type represents a record in the `teacher_test_history` collection
export interface TeacherTestAttempt extends RecordModel {
  id: string; // Attempt ID
  student: string;
  teacher_test: string; 
  teacher: string; 
  test_name_cache?: string;
  teacher_name_cache?: string;
  score: number;
  max_score: number;
  percentage?: number;
  answers_log: string | AnswerLogItem[]; 
  status: 'completed' | 'in_progress' | 'terminated_time_up' | 'terminated_manual' | 'terminated_proctoring';
  started_at?: string; 
  submitted_at?: string; // Use this for submission date
  duration_taken_seconds?: number;
  total_questions_in_test_cache?: number; // Use this instead of total_questions
  attempted_questions_count?: number; // Use this instead of attempted_questions
  correct_answers_count?: number; // Use this instead of correct_answers
  incorrect_answers_count?: number; // Use this instead of incorrect_answers
  unattempted_questions_count?: number; // Use this instead of unattempted_questions
  marked_for_review_without_selecting_option?: number;
  marked_for_review_with_selecting_option?: number;
  plan_context?: "Free Access" | "Subscribed - EduNexus Plan" | "Subscribed - Teacher Plan"; 
  expand?: {
    student?: User; // For student's name, avatar
    teacher?: User; // For teacher's name
    teacher_test?: { // To get original test details like subject, original total questions, original duration
        Test_Subject?: string;
        TotalTime?: string | number; // From teacher_tests (duration in minutes)
        TotalQuestion?: number; // From teacher_tests
    }
  }
}


export interface TestPagesRecord extends RecordModel {
  TestName: string;
  TotalQuestion?: number;
  TotalTime: string;
  Type: Array<'Free' | 'Premium' | 'Free_Premium'>;
  Model: 'Chapterwise' | 'Full_length';
  Exam?: 'MHT CET' | 'JEE MAIN' | 'NEET';
  TestTags?: string;
  PhysicsQuestion?: string[];
  ChemistryQuestion?: string[];
  MathsQuestion?: string[];
  BiologyQuestion?: string[];
  derivedSubject?: string; 
}
