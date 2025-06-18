
'use client';

import type { User, UserSubscriptionTierStudent, UserSubscriptionTierTeacher } from '@/lib/types';
import { useRouter } from 'next/navigation';
import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Routes, AppConfig, escapeForPbFilter, teacherPlatformPlansData } from '@/lib/constants';
import pb from '@/lib/pocketbase';
import type { RecordModel, ClientResponseError } from 'pocketbase';
import type { SignupInput, EditProfileInput, TeacherSignupInput, TeacherLoginInput } from '@/lib/schemas';


interface AuthContextType {
  user: User | null; // Student user
  teacher: User | null; // Teacher user
  isLoading: boolean; // For student user
  isLoadingTeacher: boolean; // For teacher user
  login: (email: string, password: string) => Promise<boolean>;
  signup: (details: SignupInput) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUserProfile: (userId: string, data: EditProfileInput | Record<string, any>) => Promise<boolean>; // Make data more generic for profile completion
  teacherSignup: (details: TeacherSignupInput) => Promise<boolean>;
  teacherLogin: (email: string, password: string) => Promise<boolean>;
  authRefresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const appReferralTierKeys: Array<UserSubscriptionTierStudent | UserSubscriptionTierTeacher> = ['Free', 'Chapterwise', 'Full_length', 'Dpp', 'Combo', 'Teacher', 'Starter', 'Pro'];

const createInitialAppReferralStats = (pbStats?: Record<string, number | undefined> | null): Record<UserSubscriptionTierStudent | UserSubscriptionTierTeacher, number> => {
  const appStats = {} as Record<UserSubscriptionTierStudent | UserSubscriptionTierTeacher, number>;
  const validPbStats = pbStats && typeof pbStats === 'object' ? pbStats : {};

  for (const tier of appReferralTierKeys) {
    const pbKey = `referred_${tier.toLowerCase().replace(/\s+/g, '_')}`;
    appStats[tier] = validPbStats[pbKey] !== undefined ? Number(validPbStats[pbKey]) : 0;
  }
  return appStats;
};

const createInitialPocketBaseReferralStats = (): Record<string, number> => {
  const pbStats: Record<string, number> = {};
  appReferralTierKeys.forEach(tier => {

    const pbKey = `referred_${tier.toLowerCase().replace(/\s+/g, '_')}`;
    pbStats[pbKey] = 0;
  });
  return pbStats;
};


const mapRecordToUser = (record: RecordModel | null | undefined): User | null => {
  if (!record) return null;

  const pbReferralStats = record.referralStats && typeof record.referralStats === 'object'
    ? record.referralStats as Record<string, number>
    : {};
  const referralStats = createInitialAppReferralStats(pbReferralStats);

  let studentSubTier: UserSubscriptionTierStudent | undefined = undefined;
  let teacherSubTier: UserSubscriptionTierTeacher | undefined = undefined;
  let canCreateAdsTeacher: boolean | undefined = false;
  let adsSubscriptionTeacher: User['ads_subscription'] = 'Free';
  let phoneNumberMapped: string | undefined = undefined;
  let maxContentPlansAllowed: number | undefined = undefined;
  let subscriptionByTeacherArray: string[] = [];
  let walletMoneyMapped: number | undefined = undefined;


  if (record.collectionName === 'users') {
    studentSubTier = (record.model || 'Free') as UserSubscriptionTierStudent;
    phoneNumberMapped = record.phone as User['phoneNumber'];
    if (record.subscription_by_teacher) {
        if (Array.isArray(record.subscription_by_teacher)) {
            subscriptionByTeacherArray = record.subscription_by_teacher.filter(id => typeof id === 'string' && id.trim() !== '');
        } else if (typeof record.subscription_by_teacher === 'string' && record.subscription_by_teacher.trim() !== '') {
            subscriptionByTeacherArray = [record.subscription_by_teacher.trim()];
        }
    }
  } else if (record.collectionName === 'teacher_data') {
    teacherSubTier = (record.teacherSubscriptionTier || 'Free') as UserSubscriptionTierTeacher;
    canCreateAdsTeacher = record.can_create_ads === true;
    adsSubscriptionTeacher = (record.ads_subscription || 'Free') as User['ads_subscription'];
    phoneNumberMapped = record.phone_number as User['phoneNumber'];
    maxContentPlansAllowed = typeof record.max_content_plans_allowed === 'number' ? record.max_content_plans_allowed : undefined;
    walletMoneyMapped = typeof record.wallet_money === 'number' ? record.wallet_money : undefined;
  }

  const name = record.name || record.meta?.name;
  let avatarUrl = record.avatarUrl || record.meta?.avatarUrl;

  if (!avatarUrl) {
    if (record.profile_picture && record.collectionId && record.collectionName) {
      avatarUrl = pb.files.getUrl(record, record.profile_picture as string);
    } else if (record.avatar && record.collectionId && record.collectionName) {
      avatarUrl = pb.files.getUrl(record, record.avatar as string);
    }
  }
  if (!avatarUrl && name) {
    avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name.charAt(0) || 'U')}&background=random&color=fff&size=128`;
  }


  const mappedUser: User = {
    id: record.id,
    email: record.email || record.meta?.email || '',
    name: name || '',
    username: record.username,
    verified: record.verified ?? record.meta?.emailVerification,
    emailVisibility: record.emailVisibility ?? true,
    grade: record.class as User['grade'],
    phoneNumber: phoneNumberMapped,
    studentSubscriptionTier: studentSubTier,
    teacherSubscriptionTier: teacherSubTier,
    role: record.role as User['role'],
    avatarUrl: avatarUrl,
    avatar: record.avatar,
    profile_picture: record.profile_picture,
    favExam: record.favExam as User['favExam'],
    totalPoints: record.totalPoints as User['totalPoints'],
    targetYear: record.targetYear as User['targetYear'],
    referralCode: record.referralCode as User['referralCode'],
    referredByCode: record.referredByCode as User['referredByCode'],
    referralStats: referralStats,
    studyPlan: record.studyPlan,
    joineddate: record.joineddate as string | undefined,
    institute_name: record.institute_name,
    total_students: record.total_students as User['total_students'],
    level: record.level as User['level'],
    EduNexus_Name: record.EduNexus_Name,
    teacherFavExams: Array.isArray(record.favExam) ? record.favExam as User['teacherFavExams'] : (record.collectionName === 'teacher_data' && record.favExam ? [record.favExam] as User['teacherFavExams'] : undefined),
    about: record.about,
    subjects_offered: Array.isArray(record.subjects_offered) ? record.subjects_offered as User['subjects_offered'] : (record.collectionName === 'teacher_data' && record.subjects_offered ? [record.subjects_offered] as User['subjects_offered'] : undefined),
    used_free_trial: record.used_free_trial,
    can_create_ads: canCreateAdsTeacher,
    ads_subscription: adsSubscriptionTeacher,
    max_content_plans_allowed: maxContentPlansAllowed,
    wallet_money: walletMoneyMapped,
    created: record.created,
    updated: record.updated,
    collectionId: record.collectionId,
    collectionName: record.collectionName,
    subscription_by_teacher: subscriptionByTeacherArray,
  };

  if (mappedUser.collectionName === 'users' && (record.token || record.meta?.token) ) {  // Check both record.token and meta.token
      // Check if critical profile fields are missing for a student
      if (!mappedUser.favExam || !mappedUser.grade || !mappedUser.targetYear || !record.password) { // Password check is for initial setup
          mappedUser.needsProfileCompletion = true;
      }
  }
  return mappedUser;
};


export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUserState] = useState<User | null>(null);
  const [teacher, setTeacherState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTeacher, setIsLoadingTeacher] = useState(true);
  const router = useRouter();

  const authRefresh = useCallback(async () => {
    const currentModel = pb.authStore.model;
    if (pb.authStore.isValid && currentModel) {
      try {
        if (currentModel.collectionName === 'users') setIsLoading(true); else setIsLoadingTeacher(true);

        const tokenParts = pb.authStore.token.split('.');
        let tokenRefreshNeeded = true;
        if (tokenParts.length === 3) {
          try {
            const payload = JSON.parse(atob(tokenParts[1]));
            if (payload.exp) {
              const expiryDate = new Date(payload.exp * 1000);
              const oneDayFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000);
              if (expiryDate > oneDayFromNow) {
                tokenRefreshNeeded = false;
              }
            }
          } catch (e) { console.warn("AuthContext: Could not parse token expiry, will refresh.", e); }
        }

        let refreshedAuthModel = currentModel;
        if (tokenRefreshNeeded) {
           const refreshed = await pb.collection(currentModel.collectionName).authRefresh({ '$autoCancel': false });
           refreshedAuthModel = refreshed.record || refreshed.meta?.user || currentModel;
        }

        const mappedEntity = mapRecordToUser(refreshedAuthModel);

        if (currentModel.collectionName === 'users') {
          setUserState(mappedEntity);
          setTeacherState(null);
        } else if (currentModel.collectionName === 'teacher_data') {
          setTeacherState(mappedEntity);
          setUserState(null);
        }
      } catch (error: any) {
        const clientError = error as ClientResponseError;
        if (clientError?.isAbort || (clientError?.name === 'ClientResponseError' && clientError?.status === 0)) {
            console.warn('AuthContext (authRefresh): Auth refresh request was aborted or network error. Clearing authStore.');
        } else {
            console.warn('AuthContext (authRefresh): authRefresh failed for other reasons, clearing store:', error);
        }
        pb.authStore.clear();
      } finally {
        const finalModel = pb.authStore.model;
        if (pb.authStore.isValid && finalModel) {
            if (finalModel.collectionName === 'users') {
                setIsLoading(false);
                setIsLoadingTeacher(false);
            } else if (finalModel.collectionName === 'teacher_data') {
                setIsLoadingTeacher(false);
                setIsLoading(false);
            } else {
                setUserState(null);
                setTeacherState(null);
                setIsLoading(false);
                setIsLoadingTeacher(false);
            }
        } else {
            setUserState(null);
            setTeacherState(null);
            setIsLoading(false);
            setIsLoadingTeacher(false);
        }
      }
    } else {
      setUserState(null);
      setTeacherState(null);
      setIsLoading(false);
      setIsLoadingTeacher(false);
    }
  }, []);


  useEffect(() => {
    let isMounted = true;
    const initializeAuth = async () => {
      if (!isMounted) return;

      const modelToUse = pb.authStore.model;
      const storeIsValid = pb.authStore.isValid;

      if (storeIsValid && modelToUse) {
        try {
          if (!isMounted) return;
          await pb.collection(modelToUse.collectionName).authRefresh({ '$autoCancel': false });
        } catch (refreshError: any) {
           if (!isMounted) return;
           const clientError = refreshError as ClientResponseError;
           if (clientError?.isAbort || (clientError?.name === 'ClientResponseError' && clientError?.status === 0)) {
             console.warn(`AuthContext (initializeAuth): Initial authRefresh for ${modelToUse.collectionName} was cancelled or network error.`);
           } else {
             console.warn('AuthContext (initializeAuth): Initial auth refresh failed, clearing store:', refreshError);
           }
           pb.authStore.clear();
        }
      } else if (
        process.env.NEXT_PUBLIC_POCKETBASE_EMAIL &&
        process.env.NEXT_PUBLIC_POCKETBASE_PASSWORD
      ) {
        if (!isMounted) return;
        console.warn(
          `${AppConfig.appName} Admin Login: Attempting development admin/student login. INSECURE for production.`
        );
        try {
          if (!isMounted) return;
          await pb.collection('users').authWithPassword(
            process.env.NEXT_PUBLIC_POCKETBASE_EMAIL,
            process.env.NEXT_PUBLIC_POCKETBASE_PASSWORD,
            { '$autoCancel': false }
          );
        } catch (devLoginError: any) {
           if (!isMounted) return;
           const clientError = devLoginError as ClientResponseError;
           if (clientError?.isAbort || (clientError?.name === 'ClientResponseError' && clientError?.status === 0)) {
             console.warn('AuthContext (initializeAuth): Development admin/student login request was cancelled.');
           } else {
             console.warn('AuthContext (initializeAuth): Development admin/student login failed.', devLoginError);
           }
        }
      }
      if (!pb.authStore.isValid && isMounted) {
          setIsLoading(false);
          setIsLoadingTeacher(false);
      }
    };

    const unsubscribe = pb.authStore.onChange(async (token, model) => {
      if (!isMounted) return;

      const isStudentCollection = model?.collectionName === 'users';
      const isTeacherCollection = model?.collectionName === 'teacher_data';

      if (isStudentCollection) { setIsLoading(true); setIsLoadingTeacher(false); }
      else if (isTeacherCollection) { setIsLoadingTeacher(true); setIsLoading(false); }
      else { setIsLoading(true); setIsLoadingTeacher(true); }

      if (model && model.id) {
        try {
          if (!isMounted) return;
          const fieldsToFetch = model.collectionName === 'teacher_data'
            ? '*,max_content_plans_allowed,referralStats,subscription_by_teacher,wallet_money' // Added wallet_money for teacher
            : '*,referralStats,subscription_by_teacher';

          const refreshedRecord = await pb.collection(model.collectionName).getOne(model.id, { '$autoCancel': false, expand: 'referralStats', fields: fieldsToFetch });
          if (!isMounted) return;
          const mappedEntity = mapRecordToUser(refreshedRecord);

          if (isStudentCollection) {
            setUserState(mappedEntity);
            setTeacherState(null);
          } else if (isTeacherCollection) {
            setTeacherState(mappedEntity);
            setUserState(null);
          } else {
            setUserState(null);
            setTeacherState(null);
          }
        } catch (fetchError: any) {
          if (!isMounted) return;
          const clientError = fetchError as ClientResponseError;
          let errorMessage = "AuthContext (onChange): Error fetching full user/teacher details.";
           if (clientError?.isAbort || (clientError?.name === 'ClientResponseError' && clientError?.status === 0)) {
            errorMessage = `AuthContext (onChange): Request to fetch full record for ${model.collectionName} ${model.id} was cancelled or network error. Clearing authStore.`;
          } else {
             errorMessage = `AuthContext (onChange): Unhandled error fetching full model for ${model.id}. Clearing authStore.`;
          }
          console.warn(errorMessage, clientError);
          pb.authStore.clear();
        } finally {
          if (isMounted) {
            const currentAuthModel = pb.authStore.model;
            if (pb.authStore.isValid && currentAuthModel && currentAuthModel.id === model?.id) {
                if (currentAuthModel.collectionName === 'users') {
                    setIsLoading(false);
                    setIsLoadingTeacher(false);
                } else if (currentAuthModel.collectionName === 'teacher_data') {
                    setIsLoadingTeacher(false);
                    setIsLoading(false);
                } else {
                    setIsLoading(false);
                    setIsLoadingTeacher(false);
                }
            } else {
                setUserState(null);
                setTeacherState(null);
                setIsLoading(false);
                setIsLoadingTeacher(false);
            }
          }
        }
      } else {
        setUserState(null);
        setTeacherState(null);
        setIsLoading(false);
        setIsLoadingTeacher(false);
      }
    }, true);

    initializeAuth();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);


  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    setIsLoadingTeacher(true);
    try {
      await pb.collection('users').authWithPassword(email, password);
      return true;
    } catch (error: any) {
      setIsLoading(false);
      setIsLoadingTeacher(false);
      return false;
    }
  };

  const generateRandomAlphanumeric = (length: number): string => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  };

  const generateUniqueReferralCode = (): string => {
    const randomPart = generateRandomAlphanumeric(5);
    return `EDUNEXUS-${randomPart}`;
  };


  const signup = async (details: SignupInput): Promise<boolean> => {
    setIsLoading(true);
    setIsLoadingTeacher(true);

    const avatarPlaceholderUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(details.name.charAt(0).toUpperCase() || 'U')}&background=random&color=fff&size=128`;
    const newReferralCode = generateUniqueReferralCode();

    const dataForNewUser = {
      email: details.email,
      password: details.password,
      passwordConfirm: details.confirmPassword,
      name: details.name,
      phone: details.phoneNumber,
      class: details.grade,
      model: 'Free' as UserSubscriptionTierStudent,
      role: 'User' as User['role'],
      avatarUrl: avatarPlaceholderUrl,
      favExam: details.favExam,
      targetYear: parseInt(details.targetYear, 10),
      totalPoints: 0,
      referralCode: newReferralCode,
      referredByCode: details.referredByCode || null,
      referralStats: createInitialPocketBaseReferralStats(),
      joineddate: new Date().toISOString(),
      emailVisibility: true,
      studyPlan: "No study plan created yet. Start by setting your goals!",
      subscription_by_teacher: [], // Initialize as empty array
    };

    try {
      const createdUserRecord = await pb.collection('users').create(dataForNewUser);

      if (details.referredByCode && details.referredByCode.trim() !== '') {
        if (details.referredByCode.trim().toUpperCase() === newReferralCode.toUpperCase()) {
          console.warn("AuthContext (Student Signup): User attempted to use their own generated referral code. Skipping referral update for referrer.");
        } else {
          let referringUser: RecordModel | null = null;
          try {
            const referringUserRecords = await pb.collection('users').getFullList<RecordModel>({
              filter: `referralCode = "${escapeForPbFilter(details.referredByCode.trim())}"`,
              fields: 'id, referralCode, referralStats',
            });

            if (referringUserRecords.length > 0) {
              referringUser = referringUserRecords[0];
              const currentStats = referringUser.referralStats && typeof referringUser.referralStats === 'object'
                                  ? { ...createInitialPocketBaseReferralStats(), ...referringUser.referralStats }
                                  : createInitialPocketBaseReferralStats();

              const newStudentTierPbKey = `referred_free`;
              currentStats[newStudentTierPbKey] = (currentStats[newStudentTierPbKey] || 0) + 1;

              await pb.collection('users').update(referringUser.id, { referralStats: currentStats });
              console.log(`AuthContext (Student Signup): Successfully attempted to update referral stats for referring user ${referringUser.id}.`);
            } else {
              console.warn(`AuthContext (Student Signup): Referring user with code "${details.referredByCode}" not found. No stats updated for referrer.`);
            }
          } catch (referralUpdateError: any) {
            const clientError = referralUpdateError as ClientResponseError;
            let errorContext = referringUser ? `referring user ID ${referringUser.id}` : `referral code ${details.referredByCode}`;
            console.error(
              `AuthContext (Student Signup): CRITICAL ERROR updating referral stats for ${errorContext}.
              This often indicates a PocketBase permission issue preventing the new user's session from updating another user's record.
              To fix: Ensure the 'users' collection "Update Rule" in PocketBase allows updates to 'referralStats' by authenticated users, or implement this update via a server-side hook.
              Error:`, clientError.data || clientError.message, "Full Error Object:", clientError
            );
          }
        }
      }

      await pb.collection('users').authWithPassword(details.email, details.password);
      return true;
    } catch (error: any) {
      console.error('AuthContext (Student Signup): PocketBase signup error. Full error:', error, 'Error data:', error.data, 'Error message:', error.message);
      setIsLoading(false);
      setIsLoadingTeacher(false);
      throw error;
    }
  };

  const teacherSignup = async (details: TeacherSignupInput): Promise<boolean> => {
    setIsLoadingTeacher(true);
    setIsLoading(true);

    const dataForPocketBase: Record<string, any> = {
        email: details.email,
        password: details.password,
        passwordConfirm: details.confirmPassword,
        name: details.name,
        institute_name: details.institute_name || null,
        phone_number: details.phone_number,
        total_students: details.total_students,
        level: details.level,
        EduNexus_Name: details.EduNexus_Name,
        favExam: details.favExam && details.favExam.length > 0 ? details.favExam : null,
        about: details.about || null,
        subjects_offered: details.subjects_offered && details.subjects_offered.length > 0 ? details.subjects_offered : null,
        teacherSubscriptionTier: "Free" as UserSubscriptionTierTeacher,
        used_free_trial: false,
        emailVisibility: true,
        can_create_ads: false,
        ads_subscription: "Free",
        max_content_plans_allowed: teacherPlatformPlansData.find(p => p.id === 'Free')?.maxContentPlans ?? 0,
        subscription_takenby_student: [], // Initialize as empty array
        wallet_money: 0, // Initialize wallet_money
    };

    if (!details.profile_picture) {
        dataForPocketBase.avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(details.name.charAt(0).toUpperCase() || 'T')}&background=random&color=fff&size=128`;
    }

    const formData = new FormData();
    for (const key in dataForPocketBase) {
        if (dataForPocketBase[key] !== null && dataForPocketBase[key] !== undefined) {
            if (Array.isArray(dataForPocketBase[key])) {
                (dataForPocketBase[key] as string[]).forEach(val => formData.append(key, val));
            } else {
                formData.append(key, String(dataForPocketBase[key]));
            }
        }
    }
    if (details.profile_picture) {
        formData.append('profile_picture', details.profile_picture);
    }

    try {
      await pb.collection('teacher_data').create(formData);
      await pb.collection('teacher_data').authWithPassword(details.email, details.password);
      return true;
    } catch (error: any)
      {
      console.error('AuthContext (Teacher Signup): PocketBase signup error:', error.data?.data || error.message);
      setIsLoadingTeacher(false);
      setIsLoading(false);
      throw error;
    }
  };

  const teacherLogin = async (email: string, password: string): Promise<boolean> => {
    setIsLoadingTeacher(true);
    setIsLoading(true);
    try {
      await pb.collection('teacher_data').authWithPassword(email, password);
      return true;
    } catch (error: any) {
      setIsLoadingTeacher(false);
      setIsLoading(false);
      return false;
    }
  };

  const updateUserProfile = async (userId: string, data: EditProfileInput | Record<string, any>): Promise<boolean> => {
    const activeAuthUser = user || teacher;
    if (!activeAuthUser || activeAuthUser.id !== userId) {
        console.warn("updateUserProfile: No active user or ID mismatch.");
        return false;
    }

    const collectionName = activeAuthUser.collectionName === 'teacher_data' ? 'teacher_data' : 'users';
    const dataToUpdate: Record<string, any> = {};

    if ('favExam' in data && data.favExam) dataToUpdate.favExam = data.favExam;
    if ('targetYear' in data && data.targetYear) dataToUpdate.targetYear = parseInt(data.targetYear, 10);
    if ('grade' in data && data.grade) dataToUpdate.class = data.grade;

    if ('password' in data && data.password && 'confirmPassword' in data && data.confirmPassword) {
      dataToUpdate.password = data.password;
      dataToUpdate.passwordConfirm = data.confirmPassword;
    }
    if ('referredByCode' in data && data.referredByCode && typeof data.referredByCode === 'string' && data.referredByCode.trim() !== '') {
        dataToUpdate.referredByCode = data.referredByCode.trim();
    }
    // For teacher profile updates:
    if (collectionName === 'teacher_data') {
        if ('name' in data) dataToUpdate.name = data.name;
        if ('institute_name' in data) dataToUpdate.institute_name = data.institute_name;
        if ('phone_number' in data) dataToUpdate.phone_number = data.phone_number;
        if ('total_students' in data) dataToUpdate.total_students = data.total_students;
        if ('level' in data) dataToUpdate.level = data.level;
        if ('EduNexus_Name' in data) dataToUpdate.EduNexus_Name = data.EduNexus_Name;
        if ('teacherFavExams' in data) dataToUpdate.favExam = data.teacherFavExams; // Note: PB field is 'favExam' for teachers too
        if ('about' in data) dataToUpdate.about = data.about;
        if ('subjects_offered' in data) dataToUpdate.subjects_offered = data.subjects_offered;
        if ('profile_picture' in data && data.profile_picture instanceof File) {
            // File uploads should be handled by FormData separately.
            // This simplified updateUserProfile assumes simple field updates.
        } else if ('profile_picture' in data && data.profile_picture === null) {
            dataToUpdate.profile_picture = null; // To clear existing
        }
    }


    if (Object.keys(dataToUpdate).length === 0) {
      console.log("updateUserProfile: No actual data to update.");
      return true;
    }

    try {
      await pb.collection(collectionName).update(userId, dataToUpdate);
      await authRefresh();
      return true;
    } catch (error) {
      console.error(`AuthContext: PocketBase update ${collectionName} profile error:`, error);
      return false;
    }
  };

  const logout = useCallback(async () => {
    try {
      pb.realtime.unsubscribe();
      console.log("AuthContext: Unsubscribed from all PocketBase real-time subscriptions.");
    } catch (unsubscribeError) {
      console.warn("AuthContext: Error during global real-time unsubscribe on logout:", unsubscribeError);
    }
    pb.authStore.clear();
  }, []);

  return (
    <AuthContext.Provider value={{
        user,
        teacher,
        isLoading,
        isLoadingTeacher,
        login,
        signup,
        logout,
        updateUserProfile,
        teacherSignup,
        teacherLogin,
        authRefresh,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

