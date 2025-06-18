
import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters.' }),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const FavExamEnum = z.enum(['JEE MAIN', 'NDA', 'MHT CET', 'KCET', 'NEET'], {
  required_error: 'Please select your favorite exam.',
});
export type FavExam = z.infer<typeof FavExamEnum>;


const currentYear = new Date().getFullYear();
const targetYearOptions = Array.from({ length: 5 }, (_, i) => (currentYear + i).toString());

export const SignupSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Invalid email address.' }),
  grade: z.enum(['Grade 11', 'Grade 12', 'Dropper'], {
    required_error: 'Please select your grade.',
  }),
  phoneNumber: z
    .string()
    .length(10, { message: 'Phone number must be 10 digits.' })
    .regex(/^\d{10}$/, { message: 'Phone number must only contain digits.' }),
  favExam: FavExamEnum,
  targetYear: z.string({ required_error: 'Please select your target year.' })
             .refine(val => targetYearOptions.includes(val), { message: 'Invalid target year selected.' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters.' }),
  confirmPassword: z.string(),
  referredByCode: z.string().optional().nullable(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match.",
  path: ['confirmPassword'],
});

export type SignupInput = z.infer<typeof SignupSchema>;

// Schema for the /complete-profile page
export const CompleteProfileSchema = z.object({
  password: z.string().min(8, { message: 'Password must be at least 8 characters.' }),
  confirmPassword: z.string(),
  grade: z.enum(['Grade 11', 'Grade 12', 'Dropper'], {
    required_error: 'Please select your grade.',
  }),
  favExam: FavExamEnum,
  targetYear: z.string({ required_error: 'Please select your target year.' })
             .refine(val => targetYearOptions.includes(val), { message: 'Invalid target year selected.' }),
  referredByCode: z.string().optional().nullable(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match.",
  path: ['confirmPassword'],
});
export type CompleteProfileInput = z.infer<typeof CompleteProfileSchema>;


export const EditProfileSchema = z.object({
  favExam: FavExamEnum.optional(),
  targetYear: z.string({ required_error: 'Please select your target year.' })
             .refine(val => targetYearOptions.includes(val), { message: 'Invalid target year selected.' }).optional(),
});

export type EditProfileInput = z.infer<typeof EditProfileSchema>;

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, { message: 'Current password is required.' }),
  newPassword: z.string().min(8, { message: 'New password must be at least 8 characters.' }),
  confirmNewPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "New passwords don't match.",
  path: ['confirmNewPassword'],
});

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

export const ForgotPasswordSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
});

export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

// Question Bank Schemas (Admin)
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]; // Added gif

const fileSchema = z
  .instanceof(File)
  .refine((file) => file.size <= MAX_FILE_SIZE, `Max image size is 5MB.`)
  .refine(
    (file) => ACCEPTED_IMAGE_TYPES.includes(file.type),
    "Only .jpg, .jpeg, .png, .webp, and .gif formats are supported."
  ).nullable().optional();

const imageUrlSchema = z.string().url({ message: "Invalid URL format." }).nullable().optional();


export const PyqExamNameEnum = z.enum([
    "JEE Main",
    "JEE Advanced",
    "KCET",
    "WBJEE",
    "MHT CET PCM",
    "MHT CET PCB",
    "NEET"
  ]);

export const PyqShiftEnum = z.enum(["Shift 1", "Shift 2", "N/A"]);
export const ExamDppEnum = z.enum(["JEE MAIN", "NEET", "MHT CET"]);


export const QuestionBankSchema = z.object({
  subject: z.enum(['Physics', 'Chemistry', 'Mathematics', 'Biology'], { required_error: "Subject is required." }),
  lessonName: z.string().min(1, "Lesson name is required.").nullable(),
  lessonTopic: z.string().optional().nullable(),
  difficulty: z.enum(['Easy', 'Medium', 'Hard'], { required_error: "Difficulty is required." }).default('Medium'),
  marks: z.coerce.number({invalid_type_error: "Marks must be a number."}).int().min(0, "Marks cannot be negative.").default(1),
  tags: z.string().optional().nullable(),
  pyq: z.boolean().default(false),
  ExamDpp: ExamDppEnum.optional(),
  pyqExamName: PyqExamNameEnum.optional(),
  pyqYear: z.coerce.number().int().positive("Year must be a positive number.").optional().nullable(),
  pyqDate: z.string().optional().nullable(),
  pyqShift: PyqShiftEnum.optional(),

  questionStructureType: z.enum(["text_only", "image_only", "text_with_diagram"], { required_error: "Please select a question structure type."}).default("text_only"),
  questionText: z.string().optional().nullable(),
  questionImage: fileSchema.or(imageUrlSchema), // Allow File or URL for QuestionImage

  optionsFormatForDiagramQuestion: z.enum(["text_options", "image_options"]).optional(),


  optionAText: z.string().optional().nullable(),
  optionBText: z.string().optional().nullable(),
  optionCText: z.string().optional().nullable(),
  optionDText: z.string().optional().nullable(),

  optionAImage: fileSchema.or(imageUrlSchema),
  optionBImage: fileSchema.or(imageUrlSchema),
  optionCImage: fileSchema.or(imageUrlSchema),
  optionDImage: fileSchema.or(imageUrlSchema),

  correctOption: z.enum(['A', 'B', 'C', 'D'], { required_error: "Correct option is required." }),
  explanationText: z.string().optional().nullable(),
  explanationImage: fileSchema.or(imageUrlSchema),

}).superRefine((data, ctx) => {
  if (data.pyq) {
    if (!data.pyqExamName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "PYQ Exam Name is required if question is a PYQ.", path: ["pyqExamName"] });
    }
    if (data.pyqYear === undefined || data.pyqYear === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "PYQ Year is required if question is a PYQ.", path: ["pyqYear"] });
    } else if (data.pyqYear < 1900 || data.pyqYear > new Date().getFullYear() + 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `PYQ Year must be between 1900 and ${new Date().getFullYear() + 1}.`, path: ["pyqYear"] });
    }
  } else {
    if (!data.ExamDpp) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "DPP Exam association is required for non-PYQ questions.", path: ["ExamDpp"] });
    }
  }

  if (data.questionStructureType === "text_only") {
    if (!data.questionText?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Question text is required.", path: ["questionText"] });
    if (!data.optionAText?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Option A text is required.", path: ["optionAText"] });
    if (!data.optionBText?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Option B text is required.", path: ["optionBText"] });
    if (!data.optionCText?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Option C text is required.", path: ["optionCText"] });
    if (!data.optionDText?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Option D text is required.", path: ["optionDText"] });
  } else if (data.questionStructureType === "image_only") {
    if (!data.questionImage) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Question image is required.", path: ["questionImage"] });
    if (!data.optionAText?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Label for Option A is required (e.g., 'Option A').", path: ["optionAText"] });
    if (!data.optionBText?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Label for Option B is required (e.g., 'Option B').", path: ["optionBText"] });
    if (!data.optionCText?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Label for Option C is required (e.g., 'Option C').", path: ["optionCText"] });
    if (!data.optionDText?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Label for Option D is required (e.g., 'Option D').", path: ["optionDText"] });
  } else if (data.questionStructureType === "text_with_diagram") {
    if (!data.questionText?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Question text is required.", path: ["questionText"] });
    if (!data.questionImage) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Question diagram/image is required.", path: ["questionImage"] });
    if (!data.optionsFormatForDiagramQuestion) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Options format (text or image) must be selected for diagram questions.", path: ["optionsFormatForDiagramQuestion"] });

    if (data.optionsFormatForDiagramQuestion === "text_options") {
        if (!data.optionAText?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Option A text is required.", path: ["optionAText"] });
        if (!data.optionBText?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Option B text is required.", path: ["optionBText"] });
        if (!data.optionCText?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Option C text is required.", path: ["optionCText"] });
        if (!data.optionDText?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Option D text is required.", path: ["optionDText"] });
    } else if (data.optionsFormatForDiagramQuestion === "image_options") {
        if (!data.optionAImage) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Image for Option A is required.", path: ["optionAImage"] });
        if (!data.optionBImage) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Image for Option B is required.", path: ["optionBImage"] });
        if (!data.optionCImage) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Image for Option C is required.", path: ["optionCImage"] });
        if (!data.optionDImage) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Image for Option D is required.", path: ["optionDImage"] });
    }
  }
});


export type QuestionBankInput = z.infer<typeof QuestionBankSchema>;

export const FormTestTypeEnum = z.enum(["Free", "Premium", "Free_Premium"], {
  required_error: "Test Type is required.",
});
const TestModelEnum = z.enum(["Chapterwise", "Full Length"]);
const TestExamEnum = z.enum(["MHT CET", "JEE MAIN", "NEET"], {
  required_error: "Target Exam is required.",
});
const TestSubjectEnum = z.enum(['Physics', 'Chemistry', 'Mathematics', 'Biology'], {
  required_error: "Test Subject is required for Chapterwise tests.",
});


export const CreateTestSchema = z.object({
  TestName: z.string().min(1, "Test Name is required."),
  TotalTime: z.coerce.number().int().min(1, "Total Time must be at least 1 minute."),
  Type: FormTestTypeEnum,
  Model: TestModelEnum.default("Chapterwise"),
  Exam: TestExamEnum,
  TestTags: z.string().optional().nullable(),
  testSubject: TestSubjectEnum.optional(),
  PhysicsQuestion: z.array(z.string()).optional().default([]),
  ChemistryQuestion: z.array(z.string()).optional().default([]),
  MathsQuestion: z.array(z.string()).optional().default([]),
  BiologyQuestion: z.array(z.string()).optional().default([]),
  TotalQuestion: z.coerce.number().int().min(0).optional().default(0),
  PhysicsTotalScore: z.coerce.number().int().optional().default(0),
  ChemistryTotalScore: z.coerce.number().int().optional().default(0),
  MathsTotalScore: z.coerce.number().int().optional().default(0),
  BiologyTotalScore: z.coerce.number().int().optional().default(0),
  OverallTotalScore: z.coerce.number().int().optional().default(0),
  overallNegativeScore: z.coerce.number().int().optional().default(0),
}).superRefine((data, ctx) => {
  if (data.Model === 'Chapterwise') {
    if (!data.testSubject) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Test Subject is required for Chapterwise model.",
        path: ["testSubject"],
      });
    }
    let questionCount = 0;
    if (data.testSubject === 'Physics') questionCount = data.PhysicsQuestion?.length || 0;
    else if (data.testSubject === 'Chemistry') questionCount = data.ChemistryQuestion?.length || 0;
    else if (data.testSubject === 'Mathematics') questionCount = data.MathsQuestion?.length || 0;
    else if (data.testSubject === 'Biology') questionCount = data.BiologyQuestion?.length || 0;

    if (questionCount === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one question must be selected for the chosen subject in a Chapterwise test.",
        path: ["testSubject"],
      });
    }
  }
});


export type CreateTestInput = z.infer<typeof CreateTestSchema>;

const TeacherTotalStudentsEnum = z.enum(["1-10", "11-30", "31-60", "61-100", ">100"], {
  required_error: "Please select the number of students you teach."
});
const TeacherLevelEnum = z.enum(["Beginner", "Experienced"], {
  required_error: "Please select your experience level."
});
export const TeacherFavExamEnum = z.enum(["MHT CET", "JEE MAIN", "NEET"], {
  invalid_type_error: "Invalid exam selected."
});
export const TeacherSubjectsOfferedEnum = z.enum(["Physics", "Chemistry", "Maths", "Biology"],{
  invalid_type_error: "Invalid subject selected."
});

export const TeacherSignupSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters.' }),
  confirmPassword: z.string(),
  institute_name: z.string().min(1, "Institute name is required."),
  phone_number: z.string().length(10, { message: 'Phone number must be 10 digits.' }).regex(/^\d{10}$/, { message: 'Phone number must only contain digits.' }),
  total_students: TeacherTotalStudentsEnum,
  level: TeacherLevelEnum,
  EduNexus_Name: z.string().min(3, "EduNexus Username must be at least 3 characters.").regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores."),
  favExam: z.array(TeacherFavExamEnum).min(1, "Please select at least one exam you prepare students for.").max(3, {message: "You can select up to 3 exams."}),
  about: z.string().min(10, { message: "Please tell us a bit about yourself (min 10 characters)." }),
  profile_picture: fileSchema.optional(),
  subjects_offered: z.array(TeacherSubjectsOfferedEnum).min(1, { message: "Please select at least one subject you offer." }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match.",
  path: ['confirmPassword'],
});

export type TeacherSignupInput = z.infer<typeof TeacherSignupSchema>;

export const TeacherLoginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters.' }),
});

export type TeacherLoginInput = z.infer<typeof TeacherLoginSchema>;

const TestModalQBExamEnum = z.enum(["MHT CET", "JEE MAIN", "NEET"], {
  required_error: "QBExam is required for the test.",
});
export const TeacherCreateTestModalSchema = z.object({
  testName: z.string().min(3, { message: "Test name must be at least 3 characters." }),
  duration: z.coerce.number().int().min(1, { message: "Duration must be at least 1 minute." }),
  model: z.enum(["Chapterwise", "Full Length"], { required_error: "Please select a test model." }),
  type: z.enum(["Free", "Premium"], { required_error: "Please select a test type." }),
  QBExam: TestModalQBExamEnum,
  adminPassword: z.coerce.number().int().min(1000, "Admin password must be at least 1000.").max(999999, "Admin password must be at most 999999."),
});
export type TeacherCreateTestModalInput = z.infer<typeof TeacherCreateTestModalSchema>;

export const TeacherAddQuestionSchema = z.object({
  questionType: z.enum(['multipleChoice', 'fillInBlank', 'addSection']).default('multipleChoice'),
  LessonName: z.string().min(1, "Lesson Name (derived from the test) is required."),
  QBExam: z.string().min(1, "Exam association (QBExam, derived from the test) is required."),
  QuestionText: z.string().optional().nullable(),
  QuestionImage: imageUrlSchema,
  options: z.array(
    z.object({
      text: z.string().min(1, 'Option text is required.'),
      isCorrect: z.boolean().default(false),
    })
  ).min(1, 'At least one option is required.').max(5, 'Maximum 5 options allowed.'),
  OptionAImage: imageUrlSchema,
  OptionBImage: imageUrlSchema,
  OptionCImage: imageUrlSchema,
  OptionDImage: imageUrlSchema,
  CorrectOption: z.enum(["Option A", "Option B", "Option C", "Option D", "Option E"]).optional(),
  explanationText: z.string().nullable().optional(),
  explanationImage: imageUrlSchema,
}).superRefine((data, ctx) => {
  if (data.questionType === 'multipleChoice') {
    const correctOptionsCount = data.options.filter(opt => opt.isCorrect).length;
    if (correctOptionsCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Exactly one option must be marked as correct for Multiple Choice questions.',
        path: ['options'],
      });
    }

    if (!data.CorrectOption) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A correct option (A, B, C, D, or E) must be explicitly selected for Multiple Choice questions.",
          path: ["CorrectOption"],
        });
    } else {
        const correctIndex = data.options.findIndex(opt => opt.isCorrect);
        const expectedCorrectOptionEnumValue = correctIndex !== -1 ? `Option ${String.fromCharCode(65 + correctIndex)}` as const : undefined;
        if (data.CorrectOption !== expectedCorrectOptionEnumValue) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `CorrectOption field mismatch. Expected ${expectedCorrectOptionEnumValue} based on selected checkbox. Got ${data.CorrectOption}`,
            path: ["CorrectOption"],
          });
        }
    }
  }
  if (!data.QuestionText?.trim() && !data.QuestionImage) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Either Question Text or a Question Image (URL) must be provided.",
      path: ["QuestionText"],
    });
  }
});
export type TeacherAddQuestionInput = z.infer<typeof TeacherAddQuestionSchema>;


const TestStatusEnum = z.enum(["Draft", "Published", "Archived"]);
const WhoCanTakeTestEnum = z.enum([
    "EveryOne",
    "Group 1",
    "Group 2",
    "Group 3",
    "Group 4",
    "Group 5",
    "Group 6"
]);

export const TeacherTestSettingsSchema = z.object({
    testName: z.string().min(1, "Test name is required.").max(100, "Test name too long."),
    Test_Description: z.string().max(500, "Description too long.").optional().nullable(),
    Admin_Password: z.coerce.number().int("Admin password must be an integer.")
                       .min(1000, "Admin password must be at least 1000.")
                       .max(999999, "Admin password must be at most 999999."),
    duration: z.coerce.number().int().min(1, "Duration must be at least 1 minute."),
    totalScore: z.coerce.number().min(0, "Total score cannot be negative.").optional().nullable(),
    PerNegativeScore: z.coerce.number().optional().nullable(),
    status: TestStatusEnum.default("Draft"),
    Students_can_view_their_results_after_the_test: z.boolean().default(true),
    How_many_times_can_students_take_the_test: z.coerce.number().int()
                                                .min(1, "Minimum attempts is 1.")
                                                .max(10, "Maximum attempts is 10.")
                                                .optional().nullable(),
    Shuffle_Questions: z.boolean().default(false),
    Who_can_take_your_test: WhoCanTakeTestEnum.default("EveryOne"),
    Would_you_like_to_get_admin_access_through_link: z.boolean().default(false),
});
export type TeacherTestSettingsInput = z.infer<typeof TeacherTestSettingsSchema>;

export const StudentBookmarkCategoriesEnum = z.enum(["Gone Tricky", "To Remeber"]);
export type StudentBookmarkCategory = z.infer<typeof StudentBookmarkCategoriesEnum>;

export const StudentNotebookSchema = z.object({
  notebook_name: z.string().min(1, "Notebook name is required.").max(100, "Notebook name is too long."),
  category: z.array(StudentBookmarkCategoriesEnum).optional(),
});
export type StudentNotebookInput = z.infer<typeof StudentNotebookSchema>;

export const TeacherPlanSchema = z.object({
  Plan_name: z.string().min(3, { message: 'Plan name must be at least 3 characters.' }),
  plan_price: z.string().min(1, { message: 'Plan price is required (e.g., "0" or "299").' }).regex(/^\d+(\.\d{1,2})?$/, "Price must be a valid number (e.g., 0, 199, 299.50)."),
  plan_duration: z.enum(["Monthly", "Weekly", "Yearly"], { required_error: "Plan duration is required." }),
  plan_point_1: z.string().min(5, { message: 'Feature point 1 must be at least 5 characters.' }),
  plan_point_2: z.string().min(5, { message: 'Feature point 2 must be at least 5 characters.' }),
  plan_point_3: z.string().min(5, { message: 'Feature point 3 must be at least 5 characters.' }),
  plan_point_4: z.string().min(5, { message: 'Feature point must be at least 5 characters.' }).optional().or(z.literal('')),
  plan_point_5: z.string().min(5, { message: 'Feature point must be at least 5 characters.' }).optional().or(z.literal('')),
});
export type TeacherPlanInput = z.infer<typeof TeacherPlanSchema>;

const urlOrEmptySchema = z.string().url({ message: "Please enter a valid URL (e.g., https://example.com)" }).or(z.literal('')).nullable().optional();

export const TeacherAdSchema = z.object({
  instagram_page: urlOrEmptySchema,
  facebook_page: urlOrEmptySchema,
  edunexus_profile: urlOrEmptySchema,
  youtube_channel: urlOrEmptySchema,
  x_page: urlOrEmptySchema,
  telegram_channel_username: urlOrEmptySchema,
  teacher_app_link: urlOrEmptySchema,
  about: z.string().max(1000, "About section is too long (max 1000 characters).").optional().nullable(),
  profile_pic_if_not_edunexus_pic: fileSchema,

  total_student_trained: z.coerce.number().int().min(0).optional().nullable(),
  students_of_100_percentile_if_any: z.coerce.number().int().min(0).optional().nullable(),
  students_above_99_percentile_if_any: z.coerce.number().int().min(0).optional().nullable(),
  students_above_98_percentile_if_any: z.coerce.number().int().min(0).optional().nullable(),
  students_above_90_percentile_if_any: z.coerce.number().int().min(0).optional().nullable(),
  followers: z.coerce.number().int().min(0).optional().nullable(),
  total_edunexus_subscription_offered: z.coerce.number().int().min(0).optional().nullable(),

  featured_plan_ids: z.array(z.string().min(1, "Plan ID cannot be empty if provided."))
    .max(3, "You can select up to 3 featured plans.")
    .optional().default([]),
});
export type TeacherAdInput = z.infer<typeof TeacherAdSchema>;

export const EduNexusPlanEnum = z.enum(["Free", "Dpp", "Chapterwise", "Full_length", "Combo"]); // Corrected "Full Length"

export const DiscussionGroupManagementFormSchema = z.object({
  group_name: z.string().min(3, "Group name must be at least 3 characters.").max(100, "Group name cannot exceed 100 characters."),
  group_description: z.string().max(250, "Description cannot exceed 250 characters.").optional().nullable(),
  students: z.array(z.string()).optional().default([]),
});
export type DiscussionGroupManagementInput = z.infer<typeof DiscussionGroupManagementFormSchema>;

// Ad Creation/Editing Schema
export const StudentDashboardAdSchema = z.object({
  ad_name: z.string().min(1, "Ad name is required").max(100, "Ad name too long"),
  ad_expiry_date: z.string().optional().nullable().refine(val => !val || !isNaN(Date.parse(val)), { message: "Invalid date format for expiry" }),
  ad_image_file: fileSchema, // For upload
  ad_button_link: z.string().url("Invalid URL for button link").optional().nullable(),
  ad_button_name: z.string().max(50, "Button name too long").optional().nullable(),
  ad_description: z.string().min(10, "Description must be at least 10 characters").max(250, "Description too long"),
  background_colour_json: z.string().optional().nullable().refine(val => {
    if (!val) return true;
    try {
      JSON.parse(val);
      return true;
    } catch (e) {
      return false;
    }
  }, { message: "Background colour must be valid JSON or empty" }),
});
export type StudentDashboardAdInput = z.infer<typeof StudentDashboardAdSchema>;

// Referral Code Management Schema
export const StudentReferralPlanEnum = z.enum(["Free", "Chapterwise", "Full_length", "Dpp", "Combo"]); // Corrected "Full Length"
export type StudentReferralPlan = z.infer<typeof StudentReferralPlanEnum>;

export const ReferralCodeSchema = z.object({
  refferal_name: z.string()
    .min(3, "Referral name must be 3-50 characters.")
    .max(50, "Referral name must be 3-50 characters.")
    .regex(/^[A-Z0-9_]+$/, "Referral name can only contain uppercase letters, numbers, and underscores."),
  discount: z.coerce.number()
    .min(0, "Discount cannot be negative.")
    .max(100, "Discount cannot exceed 100%.")
    .refine(val => /^\d+(\.\d{1,2})?$/.test(String(val)), { message: "Discount can have up to 2 decimal places."}),
  plan_for: z.array(StudentReferralPlanEnum).min(1, "At least one 'Plan For' must be selected."),
  plan_by: z.array(StudentReferralPlanEnum).optional().default([]),
  expiry_date: z.string().optional().nullable().refine(val => !val || !isNaN(Date.parse(val)), { message: "Invalid date format for expiry date." }),
});
export type ReferralCodeInput = z.infer<typeof ReferralCodeSchema>;

// Help Center Ticket Schema
export const HelpCenterTicketSchema = z.object({
  subject: z.string().min(5, "Subject must be at least 5 characters.").max(100, "Subject cannot exceed 100 characters."),
  description: z.string().min(20, "Description must be at least 20 characters.").max(1000, "Description cannot exceed 1000 characters."),
  edunexus_rating: z.coerce.number().int().min(1, "Rating must be between 1 and 5.").max(5, "Rating must be between 1 and 5.").optional().nullable(),
});
export type HelpCenterTicketInput = z.infer<typeof HelpCenterTicketSchema>;

export const StudentFeedbackSchema = z.object({
  your_name: z.string().max(100, "Name cannot exceed 100 characters.").optional().nullable(),
  experience: z.string().min(10, "Experience must be at least 10 characters.").max(1000, "Experience cannot exceed 1000 characters."),
  rating: z.coerce.number().int().min(1, "Rating must be between 1 and 5.").max(5, "Rating must be between 1 and 5."),
  want_any_more_additional_in_edunexus: z.string().max(1000, "Suggestions cannot exceed 1000 characters.").optional().nullable(),
});
export type StudentFeedbackInput = z.infer<typeof StudentFeedbackSchema>;

// Teacher-specific referral code schema
export const TeacherReferralCodeSchema = z.object({
  referral_code_string: z.string()
    .min(5, "Referral code must be 5-20 characters.")
    .max(20, "Referral code must be 5-20 characters.")
    .regex(/^[A-Z0-9]+$/, "Referral code can only contain uppercase letters and numbers."),
  discount_percentage: z.coerce.number()
    .min(0, "Discount cannot be negative.")
    .max(100, "Discount cannot exceed 100%.")
    .refine(val => /^\d+(\.\d{1,2})?$/.test(String(val)), { message: "Discount can have up to 2 decimal places."}),
  applicable_plan_ids: z.array(z.string().min(1, "Plan ID cannot be empty.")).min(1, "At least one content plan must be selected."),
  expiry_date: z.string().optional().nullable().refine(val => !val || !isNaN(Date.parse(val)), { message: "Invalid date format for expiry date." }),
});
export type TeacherReferralCodeInput = z.infer<typeof TeacherReferralCodeSchema>;
