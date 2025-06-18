
// Represents the structure of user data from PocketBase, aligned with your collection
import type { RecordModel } from 'pocketbase'; // Added import for RecordModel

export type UserSubscriptionTierStudent = 'Free' | 'Chapterwise' | 'Full_length' | 'Dpp' | 'Combo';
export type UserSubscriptionTierTeacher = 'Free' | 'Starter' | 'Pro';

export interface Plan {
  id: UserSubscriptionTierStudent | UserSubscriptionTierTeacher | 'TeacherAds'; // Added TeacherAds
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

  created?: string;
  updated?: string;
  collectionId?: string;
  collectionName?: string;
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
  requiredTier?: UserSubscriptionTierStudent | 'Full Length';
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

export interface TeacherPlan extends RecordModel {
  id: string;
  teacher: string;
  Plan_name: string;
  plan_price: string;
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
  amount_paid_to_edunexus: number; // Total amount paid by student
  amount_recieved_to_teacher: number; // Net amount for teacher after commission
  payment_id_razorpay?: string; // Added
  order_id_razorpay?: string; // Added
  expand?: {
    teachers_plan_id?: {
      Plan_name: string;
      plan_price: string;
      plan: 'Monthly' | 'Weekly' | 'Yearly';
    }
  }
}

// Added TeacherWalletTransaction type
export interface TeacherWalletTransaction extends RecordModel {
  id: string;
  teacher: string;
  student_histroy?: string; // ID of students_teachers_upgrade_plan record
  total_amount_recieved: number; // Amount received by teacher AFTER EduNexus commission
  by_which_plan_recieved?: string; // ID of teachers_upgrade_plan record
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
    by_which_plan_recieved?: {
      Plan_name: string;
      id: string;
    }
  }
}
