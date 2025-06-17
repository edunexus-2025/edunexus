
'use client';

import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import pb from '@/lib/pocketbase';
import type { RecordModel, ClientResponseError as PocketBaseClientResponseError } from 'pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { AlertCircle, ArrowLeft, Bookmark as BookmarkIconLucide, Check, CheckCircle, RefreshCw, XCircle, CalendarDays, PlusCircle, Loader2, Image as ImageIconLucide, Clock, ShieldAlert, Zap, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import NextImage from 'next/image';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { Routes, escapeForPbFilter, AppConfig, DPP_EXAM_OPTIONS, slugify } from '@/lib/constants';
import Link from 'next/link';
import { useDppNavigation } from '@/contexts/DppNavigationContext';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from "@/components/ui/checkbox";
import type { StudentBookmark, User, UserSubscriptionTierStudent } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';


interface LoadedQuestion extends RecordModel {
  id: string;
  questionText?: string;
  questionImage?: string;
  QuestionImage?: string;
  optionAText?: string;
  optionBText?: string;
  optionCText?: string;
  optionDText?: string;
  optionAImage?: string;
  OptionAImage?: string;
  optionBImage?: string;
  OptionBImage?: string;
  optionCImage?: string;
  OptionCImage?: string;
  optionDImage?: string;
  OptionDImage?: string;
  optionsFormat?: 'text_options' | 'image_options';
  questionType?: 'text' | 'image' | 'text_image';
  correctOption: "A" | "B" | "C" | "D"; 
  CorrectOption?: "Option A" | "Option B" | "Option C" | "Option D";
  explanationText?: string;
  explanationImage?: string;
  ExplanationImage?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  lessonName?: string;
  LessonName?: string;
  subject?: string;
  pyq: boolean;
  ExamDpp?: string;
  QBExam?: string;
  pyqExamName?: string;
  pyqYear?: number;
  pyqDate?: string;
  pyqShift?: string;
  originalCollectionName?: 'question_bank' | 'add_questions';
  marks?: number;
  displayQuestionImageUrl?: string | null;
  displayOptionAImageUrl?: string | null;
  displayOptionBImageUrl?: string | null;
  displayOptionCImageUrl?: string | null;
  displayOptionDImageUrl?: string | null;
  displayExplanationImageUrl?: string | null;
}

interface DppAttemptQuestionLog {
  questionId: string;
  selectedOption: string | null;
  correctOption: string | null;
  isCorrect: boolean;
  timeSpentSeconds: number;
}

interface DppAttemptsRecord extends RecordModel {
    user: string;
    subject: string;
    lessonName: string;
    attemptDate: string;
    questionsAttempted: string | DppAttemptQuestionLog[];
}

interface PreviousAttemptInfo {
    attemptDate: string;
    selectedOption: string | null;
    wasCorrect: boolean;
}

const PREDEFINED_TAGS: string[] = ["Easy", "Hard", "Tricky", "Do Again", "Wrong"];
const DAILY_DPP_LIMIT = 20;

const getPbFileUrlIfName = (record: LoadedQuestion, fieldName: 'questionImage' | 'optionAImage' | 'optionBImage' | 'optionCImage' | 'optionDImage' | 'explanationImage'): string | null => {
    if (record && record[fieldName] && typeof record[fieldName] === 'string' && record.collectionId && record.collectionName) {
      if (!record[fieldName]!.startsWith('http://') && !record[fieldName]!.startsWith('https://')) {
        try {
          return pb.files.getUrl(record as RecordModel, record[fieldName] as string);
        } catch (e) {
          console.warn(`DPP QBankView: Error getting URL for ${fieldName} in record ${record.id}:`, e);
          return null;
        }
      }
      return record[fieldName] as string;
    }
    return null;
};

export default function DppQuestionViewPage() {
  const params = useParams();
  const router = useRouter();

  const questionIdFromParams = params?.questionId;

  const questionId = useMemo(() => {
    let id = '';
    const idParamToUse = questionIdFromParams;
    if (idParamToUse) {
      if (typeof idParamToUse === 'string') {
        id = idParamToUse;
      } else if (Array.isArray(idParamToUse) && idParamToUse.length > 0 && typeof idParamToUse[0] === 'string') {
        id = idParamToUse[0];
      }
    }
    return id;
  }, [questionIdFromParams]);


  const { user: currentUser, isLoading: authLoading, authRefresh } = useAuth();
  const { toast } = useToast();

  const { setBackToLessonUrl, providerMounted } = useDppNavigation();

  const [questions, setQuestions] = useState<LoadedQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const [previousAttemptInfo, setPreviousAttemptInfo] = useState<PreviousAttemptInfo | null>(null);
  const [existingDppAttemptRecordId, setExistingDppAttemptRecordId] = useState<string | null>(null);
  const [isSubmittingAttempt, setIsSubmittingAttempt] = useState(false);

  const [isBookmarkModalOpen, setIsBookmarkModalOpen] = useState(false);
  const [userNotebooks, setUserNotebooks] = useState<StudentBookmark[]>([]);
  const [isLoadingUserNotebooks, setIsLoadingUserNotebooks] = useState(false);
  const [selectedNotebookIdsInModal, setSelectedNotebookIdsInModal] = useState<Set<string>>(new Set());
  const [selectedModalTags, setSelectedModalTags] = useState<string[]>([]);
  const [isCurrentQuestionBookmarked, setIsCurrentQuestionBookmarked] = useState(false);

  const [dailyAttemptsCount, setDailyAttemptsCount] = useState<number | null>(0);
  const [isDppLimitReached, setIsDppLimitReached] = useState(false);
  const [isLoadingDailyLimit, setIsLoadingDailyLimit] = useState(true);

  const [dppQuestionIds, setDppQuestionIds] = useState<string[]>([]);
  const [currentQuestionIndexInDpp, setCurrentQuestionIndexInDpp] = useState(-1);

  const questionStartTimeRef = useRef<number>(Date.now());

  // Define currentQuestion *after* questions and currentQuestionIndex are defined
  const currentQuestion = questions[currentQuestionIndex];


  const fetchDailyAttemptCount = useCallback(async () => {
    if (!currentUser?.id) {
      setIsLoadingDailyLimit(false);
      return;
    }

    if ((currentUser.studentSubscriptionTier as UserSubscriptionTierStudent) !== 'Free') {
      setIsLoadingDailyLimit(false);
      setIsDppLimitReached(false);
      setDailyAttemptsCount(null);
      return;
    }

    setIsLoadingDailyLimit(true);
    const todayStartUTC = new Date();
    todayStartUTC.setUTCHours(0, 0, 0, 0);
    const todayEndUTC = new Date();
    todayEndUTC.setUTCHours(23, 59, 59, 999);

    const filter = `user = "${currentUser.id}" && attemptTimestamp >= "${todayStartUTC.toISOString()}" && attemptTimestamp <= "${todayEndUTC.toISOString()}"`;
    try {
      const resultList = await pb.collection('daily_dpp_question_logs').getList(1, 1, { filter, count: true, $autoCancel: false });
      const count = resultList.totalItems;
      setDailyAttemptsCount(count);
      setIsDppLimitReached(count >= DAILY_DPP_LIMIT);
    } catch (err) {
      console.error("DPP QBankView: Error fetching daily attempt count:", err);
      setIsDppLimitReached(false);
    } finally {
      setIsLoadingDailyLimit(false);
    }
  }, [currentUser?.id, currentUser?.studentSubscriptionTier]); // Changed dependency to currentUser?.id and tier

  useEffect(() => {
    if (!authLoading && currentUser?.id) { // Check for currentUser?.id
      fetchDailyAttemptCount();
    }
  }, [currentUser?.id, authLoading, fetchDailyAttemptCount]); // Changed dependency


  const checkBookmarkStatus = useCallback(async (questionIdToCheck: string) => {
    if (!currentUser?.id || !questionIdToCheck) { setIsCurrentQuestionBookmarked(false); return; }
    try {
      const bookmarkRecords = await pb.collection('student_bookmarks').getFullList<StudentBookmark>({ filter: `user = "${currentUser.id}" && questions ~ "${questionIdToCheck}" && archived = false`, fields: 'id', $autoCancel: false });
      setIsCurrentQuestionBookmarked(bookmarkRecords.length > 0);
    } catch (err) { console.warn("DPP QBankView: Error checking bookmark status:", err); setIsCurrentQuestionBookmarked(false); }
  }, [currentUser?.id]);

  useEffect(() => {
    if (currentQuestion?.id) {
      checkBookmarkStatus(currentQuestion.id);
    }
  }, [currentQuestion?.id, checkBookmarkStatus]);

  const fetchQuestionAndDppContext = useCallback(async (qId: string, cUser: typeof currentUser, isMountedGetter: () => boolean) => {
    if (!isMountedGetter()) return;
    setIsLoading(true); setError(null); setQuestions([]); setSelectedAnswer(null); setIsAnswerChecked(false); setIsCorrect(null); setPreviousAttemptInfo(null); setExistingDppAttemptRecordId(null); setIsCurrentQuestionBookmarked(false); setDppQuestionIds([]); setCurrentQuestionIndexInDpp(-1);

    try {
      let record: LoadedQuestion;
      let sourceCollection: 'question_bank' | 'add_questions' = 'question_bank';
      try {
        record = await pb.collection('question_bank').getOne<LoadedQuestion>(qId);
      } catch (qbError: any) {
        if (qbError.status === 404) {
          try {
            record = await pb.collection('add_questions').getOne<LoadedQuestion>(qId);
            sourceCollection = 'add_questions';
          } catch (aqError: any) { throw aqError; }
        } else { throw qbError; }
      }
      if (!isMountedGetter()) return;

      const finalRecord: LoadedQuestion = {
        ...record,
        questionText: record.questionText || record.QuestionText,
        lessonName: record.lessonName || record.LessonName,
        correctOption: record.correctOption || (record.CorrectOption ? record.CorrectOption.replace("Option ", "") as "A"|"B"|"C"|"D" : undefined) as "A" | "B" | "C" | "D", // Ensure correctOption is valid
        displayQuestionImageUrl: getPbFileUrlIfName(record, 'questionImage') || record.QuestionImage,
        displayOptionAImageUrl: getPbFileUrlIfName(record, 'optionAImage') || record.OptionAImage,
        displayOptionBImageUrl: getPbFileUrlIfName(record, 'optionBImage') || record.OptionBImage,
        displayOptionCImageUrl: getPbFileUrlIfName(record, 'optionCImage') || record.OptionCImage,
        displayOptionDImageUrl: getPbFileUrlIfName(record, 'optionDImage') || record.OptionDImage,
        displayExplanationImageUrl: getPbFileUrlIfName(record, 'explanationImage') || record.ExplanationImage,
        originalCollectionName: sourceCollection,
        marks: record.marks,
        ExamDpp: record.ExamDpp || (sourceCollection === 'add_questions' ? record.QBExam : undefined),
        subject: record.subject,
      };
      setQuestions([finalRecord]); // Set as an array with one question
      setCurrentQuestionIndex(0); // Set index to 0
      questionStartTimeRef.current = Date.now();

      if (finalRecord.lessonName && finalRecord.subject) {
        const filterParts = [
          `lessonName = "${escapeForPbFilter(finalRecord.lessonName)}"`,
          `subject = "${escapeForPbFilter(finalRecord.subject)}"`,
          `pyq = false`
        ];
        const examContext = finalRecord.ExamDpp || finalRecord.QBExam;
        if (examContext && typeof examContext === 'string' && examContext.trim() !== '') {
          filterParts.push(`ExamDpp = "${escapeForPbFilter(examContext)}"`);
        }
        const dppFilter = filterParts.join(' && ');

        console.log(`DPP Navigation: Fetching sibling DPP questions with filter: [${dppFilter}]`);
        try {
            const allIdsInDpp = await pb.collection('question_bank').getFullList<RecordModel>({
              filter: dppFilter,
              fields: 'id',
              $autoCancel: false,
            });
            if (isMountedGetter()) {
              const ids = allIdsInDpp.map(item => item.id);
              setDppQuestionIds(ids);
              setCurrentQuestionIndexInDpp(ids.indexOf(qId));
              console.log(`DPP Navigation: Found ${ids.length} sibling questions. Current index: ${ids.indexOf(qId)}`);
            }
        } catch (filterError: any) {
            if (isMountedGetter()) {
                let errorMessageForConsole = "DPP Navigation: Unknown error fetching sibling questions.";
                let errorMessageForToast = "Could not load related DPP questions.";
                if (filterError instanceof Error) {
                    errorMessageForConsole = `DPP Navigation: JS Error fetching sibling questions with filter [${dppFilter}]. Message: ${filterError.message}. Stack: ${filterError.stack}`;
                    errorMessageForToast = `Error fetching related questions: ${filterError.message}`;
                } else if (filterError && typeof filterError === 'object') {
                    const pbError = filterError as PocketBaseClientResponseError;
                    if (pbError.isAbort || (pbError.name === 'ClientResponseError' && pbError.status === 0)) {
                        console.warn(`DPP Navigation: Fetch sibling questions request was cancelled/network issue. Filter: [${dppFilter}]`);
                        errorMessageForToast = "Network issue or request cancelled while fetching related questions.";
                    } else {
                        const errorDetails = pbError.data ? JSON.stringify(pbError.data) : (pbError.message || "No specific details");
                        errorMessageForConsole = `DPP Navigation: API Error fetching sibling questions with filter [${dppFilter}]. Details: ${errorDetails}. Full Error Object: ${JSON.stringify(filterError)}`;
                        errorMessageForToast = `API Error loading related questions: ${pbError.data?.message || pbError.message || "Failed."}`;
                    }
                } else {
                     errorMessageForConsole = `DPP Navigation: Non-standard error fetching sibling questions with filter [${dppFilter}]. Error: ${String(filterError)}`;
                     errorMessageForToast = `An unexpected error occurred while loading related questions: ${String(filterError)}`;
                }
                console.error(errorMessageForConsole, filterError);
                setError(errorMessageForToast);
                setDppQuestionIds([qId]);
                setCurrentQuestionIndexInDpp(0);
            }
        }
      } else {
         setDppQuestionIds([qId]);
         setCurrentQuestionIndexInDpp(0);
      }

      const examContextForUrl = finalRecord.ExamDpp || finalRecord.QBExam;
      if (examContextForUrl && finalRecord.subject && finalRecord.lessonName) {
        const examOption = DPP_EXAM_OPTIONS.find(opt => opt.name === examContextForUrl);
        const examSlugForUrl = examOption ? examOption.slug : slugify(examContextForUrl);
        const subjectSlugForUrl = slugify(finalRecord.subject);
        const lessonSlugForUrl = slugify(finalRecord.lessonName);
        setBackToLessonUrl(Routes.dppExamSubjectLessonQuestions(examSlugForUrl, subjectSlugForUrl, lessonSlugForUrl));
      }


      if (cUser?.id && finalRecord.id) {
        checkBookmarkStatus(finalRecord.id);
      }

      if (cUser?.id && finalRecord?.lessonName && finalRecord?.subject) {
        try {
          const filterString = `user = "${cUser.id}" && lessonName = "${escapeForPbFilter(finalRecord.lessonName)}" && subject = "${escapeForPbFilter(finalRecord.subject)}"`;
          const attempts = await pb.collection('dpp_attempts').getFullList<DppAttemptsRecord>({
            filter: filterString,
            sort: '-created',
            $autoCancel: false
          });
          if (!isMountedGetter()) return;

          if (attempts.length > 0) {
            const latestDppAttemptRecord = attempts[0];
            setExistingDppAttemptRecordId(latestDppAttemptRecord.id);
            let currentQuestionLog: DppAttemptQuestionLog | undefined;
            if (typeof latestDppAttemptRecord.questionsAttempted === 'string') {
              const parsedLogs = JSON.parse(latestDppAttemptRecord.questionsAttempted || '[]') as DppAttemptQuestionLog[];
              currentQuestionLog = parsedLogs.find(qa => qa.questionId === finalRecord.id);
            } else if (Array.isArray(latestDppAttemptRecord.questionsAttempted)) {
              currentQuestionLog = latestDppAttemptRecord.questionsAttempted.find(qa => qa.questionId === finalRecord.id);
            }
            if (currentQuestionLog) {
              setPreviousAttemptInfo({ attemptDate: latestDppAttemptRecord.created, selectedOption: currentQuestionLog.selectedOption, wasCorrect: currentQuestionLog.isCorrect });
              setSelectedAnswer(currentQuestionLog.selectedOption); setIsCorrect(currentQuestionLog.isCorrect); setIsAnswerChecked(true);
            }
          }
        } catch (attemptError: any) { if (isMountedGetter()) console.warn('DPP QBankView: Failed to fetch previous DPP attempts:', attemptError); }
      }
    } catch (err: any) {
      if (!isMountedGetter()) return;
      if (err?.status === 0 || err?.isAbort) { setError('Data loading interrupted. Please try refreshing.'); }
      else { setError('Could not load the question. It might have been removed or an error occurred.'); }
      console.error('DPP QBankView: Failed to fetch question:', err);
    } finally { if (isMountedGetter()) setIsLoading(false); }
  }, [escapeForPbFilter, checkBookmarkStatus, setBackToLessonUrl, slugify]);

  useEffect(() => {
    let isMounted = true; const isMountedGetter = () => isMounted;
    if (questionId && (currentUser?.id || !authLoading)) { // Check currentUser?.id directly
       fetchQuestionAndDppContext(questionId, currentUser, isMountedGetter);
    } else if (!questionId) {
        if (isMounted) { setError("No question ID provided."); setIsLoading(false); }
    }
    return () => {
        isMounted = false;
        setBackToLessonUrl(null);
    };
  }, [questionId, currentUser?.id, authLoading, fetchQuestionAndDppContext, setBackToLessonUrl]); // Changed to currentUser?.id


  const handleCheckAnswer = async () => {
    if (!selectedAnswer || !currentQuestion || !currentUser?.id || !currentQuestion.subject || !currentQuestion.lessonName) {
      toast({title: "Missing Information", description: "Cannot submit answer.", variant: "destructive"}); return;
    }

    let allowSubmission = true;
    if ((currentUser.studentSubscriptionTier as UserSubscriptionTierStudent) === 'Free') {
      if (isDppLimitReached) {
        const todayStartUTC = new Date(); todayStartUTC.setUTCHours(0, 0, 0, 0);
        const todayEndUTC = new Date(); todayEndUTC.setUTCHours(23, 59, 59, 999);
        const dailyLogFilter = `user = "${currentUser.id}" && actualQuestionId = "${currentQuestion.id}" && attemptTimestamp >= "${todayStartUTC.toISOString()}" && attemptTimestamp <= "${todayEndUTC.toISOString()}" && isCorrect = true`;
        try {
          const existingCorrectLog = await pb.collection('daily_dpp_question_logs').getFirstListItem(dailyLogFilter, {$autoCancel: false});
          if (existingCorrectLog) {
            setIsAnswerChecked(true); setIsCorrect(true);
            toast({ title: "Already Mastered Today!", description: "You've correctly answered this DPP question today.", variant: "default" });
            allowSubmission = false;
          }
        } catch (e: any) { if (e.status !== 404) console.error("Error checking for existing correct daily log:", e); }
      }
      if (allowSubmission && isDppLimitReached) {
        toast({ title: "Daily DPP Limit Reached", description: `You've reached your daily limit of ${DAILY_DPP_LIMIT} DPP questions for free users. Upgrade for unlimited access!`, variant: "destructive" });
        return;
      }
    }
    if (!allowSubmission) return;

    setIsSubmittingAttempt(true);
    const userChoice = selectedAnswer;
    const actualCorrectOptionLetter = currentQuestion.correctOption;
    const actualCorrectOptionString = `Option ${actualCorrectOptionLetter}`;
    const isAttemptCorrect = userChoice === actualCorrectOptionString;

    setIsCorrect(isAttemptCorrect); setIsAnswerChecked(true);
    toast({ title: isAttemptCorrect ? 'Correct!' : 'Incorrect!', variant: isAttemptCorrect ? "default" : "destructive" });

    const currentAttemptDate = new Date().toISOString();
    const timeSpentForThisSubmission = Math.round((Date.now() - questionStartTimeRef.current) / 1000);

    const dppContextExamValue = currentQuestion.ExamDpp || currentQuestion.QBExam;
    const dailyLogData: {
      user: string; actualQuestionId: string; attemptTimestamp: string; isCorrect: boolean;
      dppContextExam?: string; dppContextLesson?: string;
      question_bank_ref?: string; add_questions_ref?: string;
    } = {
      user: currentUser.id, actualQuestionId: currentQuestion.id, attemptTimestamp: currentAttemptDate, isCorrect: isAttemptCorrect,
      dppContextExam: dppContextExamValue,
      dppContextLesson: currentQuestion.lessonName || currentQuestion.LessonName,
    };
    if (currentQuestion.originalCollectionName === 'question_bank') dailyLogData.question_bank_ref = currentQuestion.id;
    else if (currentQuestion.originalCollectionName === 'add_questions') dailyLogData.add_questions_ref = currentQuestion.id;

    try {
      await pb.collection('daily_dpp_question_logs').create(dailyLogData);
      if ((currentUser.studentSubscriptionTier as UserSubscriptionTierStudent) === 'Free') {
        await fetchDailyAttemptCount();
      }
    } catch (dailyLogError) { console.error("DPP QBankView: Error logging to daily_dpp_question_logs:", dailyLogError); }


    if (isAttemptCorrect) {
      console.log(`DPP QBankView: Attempt correct. Preparing to update points for user ${currentUser.id}.`);
      try {
        let studentPointsRecord = await pb.collection('students_points')
          .getFirstListItem(`students = "${currentUser.id}"`, { '$autoCancel': false })
          .catch(async (error: any) => {
            if (error.status === 404) {
              console.log(`DPP QBankView: No students_points record for ${currentUser.id}, creating new one.`);
              return pb.collection('students_points').create({ students: currentUser.id, dpp_points: "0", test_points: "0" });
            }
            console.error(`DPP QBankView: Error fetching students_points for ${currentUser.id}:`, error.data || error);
            throw error;
          });

        const currentDppPoints = parseInt(studentPointsRecord.dpp_points, 10) || 0;
        const newDppPoints = currentDppPoints + 1;

        console.log(`DPP QBankView: Updating students_points record ID ${studentPointsRecord.id} with dpp_points: "${newDppPoints}". Current dpp_points: "${studentPointsRecord.dpp_points}"`);
        await pb.collection('students_points').update(studentPointsRecord.id, { "dpp_points": String(newDppPoints) });
        console.log(`DPP QBankView: Successfully updated dpp_points for user ${currentUser.id}.`);
        // authRefresh removed
      } catch (pointError: any) {
        console.error("DPP QBankView: Failed to update DPP points in students_points. Error Data:", pointError.data, "Full Error:", pointError);
        toast({ title: "Point Update Error", description: `Could not update your DPP points: ${pointError.data?.message || pointError.message}`, variant: "destructive" });
      }
    }

    const newQuestionLogEntry: DppAttemptQuestionLog = { questionId: currentQuestion.id, selectedOption: userChoice, correctOption: actualCorrectOptionString, isCorrect: isAttemptCorrect, timeSpentSeconds: timeSpentForThisSubmission };
    try {
      let finalQuestionsAttemptedLog: DppAttemptQuestionLog[] = [];
      if (existingDppAttemptRecordId) {
        const existingRecord = await pb.collection('dpp_attempts').getOne<DppAttemptsRecord>(existingDppAttemptRecordId);
        let currentLogs: DppAttemptQuestionLog[] = typeof existingRecord.questionsAttempted === 'string' ? JSON.parse(existingRecord.questionsAttempted || '[]') : (Array.isArray(existingRecord.questionsAttempted) ? existingRecord.questionsAttempted : []);
        const existingEntryIndex = currentLogs.findIndex(log => log.questionId === currentQuestion.id);
        if (existingEntryIndex > -1) currentLogs[existingEntryIndex] = { ...newQuestionLogEntry, timeSpentSeconds: currentLogs[existingEntryIndex].timeSpentSeconds + newQuestionLogEntry.timeSpentSeconds };
        else currentLogs.push(newQuestionLogEntry);
        finalQuestionsAttemptedLog = currentLogs;
      } else finalQuestionsAttemptedLog = [newQuestionLogEntry];

      const totalLoggedQuestions = finalQuestionsAttemptedLog.length;
      const totalCorrectAnswers = finalQuestionsAttemptedLog.filter(log => log.isCorrect).length;
      const totalTimeSpent = finalQuestionsAttemptedLog.reduce((sum, log) => sum + (log.timeSpentSeconds || 0), 0);
      const dataForDb: Partial<DppAttemptsRecord> = { user: currentUser.id, subject: currentQuestion.subject, lessonName: currentQuestion.lessonName || currentQuestion.LessonName, attemptDate: currentAttemptDate, questionsAttempted: JSON.stringify(finalQuestionsAttemptedLog), score: totalCorrectAnswers, totalQuestions: totalLoggedQuestions, correct: isAttemptCorrect, timeTakenSeconds: totalTimeSpent, solvedhistory: totalCorrectAnswers };
      if (existingDppAttemptRecordId) await pb.collection('dpp_attempts').update(existingDppAttemptRecordId, dataForDb);
      else { const newRecord = await pb.collection('dpp_attempts').create(dataForDb); setExistingDppAttemptRecordId(newRecord.id); }
      setPreviousAttemptInfo({ attemptDate: currentAttemptDate, selectedOption: userChoice, wasCorrect: isAttemptCorrect });
      questionStartTimeRef.current = Date.now();

    } catch (saveError: any) { toast({ title: "Error Saving Attempt", description: saveError.data?.message || saveError.message, variant: "destructive" }); }
    finally { setIsSubmittingAttempt(false); }
  };

  const renderLatex = (text: string | undefined | null): React.ReactNode => {
    if (!text) return null;
    const parts = text.split(/(\$\$[\s\S]*?\$\$|\$.*?\$|\\\(.*?\\\)|\\\[.*?\\\]|\\begin\{.*?\}[\s\S]*?\\end\{.*?\})/g);
    return parts.map((part, index) => {
      try {
        if (part.startsWith('$$') && part.endsWith('$$')) return <BlockMath key={index} math={part.substring(2, part.length - 2)} />;
        if (part.startsWith('$') && part.endsWith('$')) return <InlineMath key={index} math={part.substring(1, part.length - 1)} />;
        if (part.startsWith('\\(') && part.endsWith('\\)')) return <InlineMath key={index} math={part.substring(2, part.length - 2)} />;
        if (part.startsWith('\\[') && part.endsWith('\\]')) return <BlockMath key={index} math={part.substring(2, part.length - 2)} />;
        if (part.startsWith('\\begin{') && part.includes('\\end{')) return <BlockMath key={index} math={part} />;
      } catch (e) { return <span key={index} className="text-destructive" title="LaTeX Error">{part}</span>; }
      return <span key={index}>{part}</span>;
    });
  };

  const renderOptionContent = (optionText?: string, optionImageUrl?: string | null, optionLabel: string = "Option") => {
    const actualText = optionText || (currentQuestion?.questionType === 'image' && currentQuestion?.optionsFormat === 'text_options' ? optionLabel : undefined);
    const actualImageUrl = optionImageUrl;
    return (
      <>
        {actualText && <div className="prose prose-sm dark:prose-invert max-w-none">{renderLatex(actualText)}</div>}
        {actualImageUrl && <NextImage src={actualImageUrl} alt={`${optionLabel} Image`} width={200} height={100} className="rounded object-contain my-1 border" data-ai-hint="option diagram"/>}
        {!(actualText || actualImageUrl) && <span className="italic text-muted-foreground">{optionLabel} content not available.</span>}
      </>
    );
  };

  const fetchUserNotebooks = useCallback(async () => {
    if (!currentUser?.id) { setUserNotebooks([]); setIsLoadingUserNotebooks(false); return; }
    setIsLoadingUserNotebooks(true);
    try {
      const records = await pb.collection('student_bookmarks').getFullList<StudentBookmark>({ filter: `user = "${currentUser.id}" && archived = false`, sort: '-updated', $autoCancel: false });
      setUserNotebooks(records.map(r => ({ ...r, questionCount: Array.isArray(r.questions) ? r.questions.length : 0 })));
    } catch (err) { toast({ title: "Error Fetching Notebooks", variant: "destructive" }); setUserNotebooks([]); }
    finally { setIsLoadingUserNotebooks(false); }
  }, [currentUser?.id, toast]);

  const handleOpenBookmarkModal = () => { if (currentQuestion) { fetchUserNotebooks(); setSelectedNotebookIdsInModal(new Set()); setSelectedModalTags([]); setIsBookmarkModalOpen(true); } };
  const handleToggleNotebookSelection = (notebookId: string) => setSelectedNotebookIdsInModal(prev => { const newSet = new Set(prev); if (newSet.has(notebookId)) newSet.delete(notebookId); else newSet.add(notebookId); return newSet; });
  const handleToggleTagSelection = (tag: string) => setSelectedModalTags(prev => { const newTags = new Set(prev); if (newTags.has(tag)) newTags.delete(tag); else if (newTags.size < 5) newTags.add(tag); else toast({ title: "Tag Limit Reached", description: "Max 5 tags."}); return Array.from(newTags); });
  
  const handleSaveToNotebooks = async () => {
    if (!currentQuestion || !currentUser?.id || selectedNotebookIdsInModal.size === 0) { toast({ title: "No Notebook Selected" }); return; }
    let successCount = 0, errorCount = 0;
    for (const notebookId of Array.from(selectedNotebookIdsInModal)) {
      try {
        const notebook = await pb.collection('student_bookmarks').getOne<StudentBookmark>(notebookId);
        const existingQuestions = Array.isArray(notebook.questions) ? notebook.questions : [];
        const updateData: Partial<StudentBookmark> & { [key: string]: any } = { tags: selectedModalTags };
        if (!existingQuestions.includes(currentQuestion.id)) updateData["questions+"] = currentQuestion.id;
        await pb.collection('student_bookmarks').update(notebookId, updateData);
        successCount++;
      } catch (err) { errorCount++; console.error(`DPP QBankView: Failed to save to notebook ${notebookId}:`, err); }
    }
    if (successCount > 0) { toast({ title: "Bookmarked!", description: `Question saved to ${successCount} notebook(s).` }); checkBookmarkStatus(currentQuestion.id); }
    if (errorCount > 0) toast({ title: "Error Bookmarking", description: `Failed for ${errorCount} notebook(s).`, variant: "destructive" });
    setIsBookmarkModalOpen(false);
  };


  const optionsArray: Array<{ id: "A" | "B" | "C" | "D"; text?: string; image?: string | null }> = currentQuestion ? [
    { id: 'A', text: currentQuestion.optionAText, image: currentQuestion.displayOptionAImageUrl },
    { id: 'B', text: currentQuestion.optionBText, image: currentQuestion.displayOptionBImageUrl },
    { id: 'C', text: currentQuestion.optionCText, image: currentQuestion.displayOptionCImageUrl },
    { id: 'D', text: currentQuestion.optionDText, image: currentQuestion.displayOptionDImageUrl },
  ] : [];

  const effectiveIsDppLimitReached = (currentUser?.studentSubscriptionTier as UserSubscriptionTierStudent) === 'Free' && isDppLimitReached;


  if (isLoading || authLoading || isLoadingDailyLimit) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex flex-col">
        <main className="flex-1 container mx-auto p-4 max-w-3xl mt-4">
          <Card className="shadow-xl"><CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader>
            <CardContent className="space-y-6"><Skeleton className="h-20 w-full" /><div className="space-y-4 mt-6">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div></CardContent>
            <CardFooter className="flex justify-between"><Skeleton className="h-10 w-24" /><Skeleton className="h-10 w-32" /></CardFooter>
          </Card>
        </main>
      </div>
    );
  }

  if (error || !currentQuestion) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-lg text-center shadow-xl"><CardHeader><AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" /><CardTitle className="text-destructive text-xl">Error Loading Question</CardTitle></CardHeader>
          <CardContent><p className="text-muted-foreground">{error || "The question data could not be loaded."}</p></CardContent>
          <CardFooter><Button onClick={() => router.back()} variant="outline" className="mx-auto"><ArrowLeft className="mr-2 h-4 w-4" />Go Back</Button></CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex flex-col">
      <main className="flex-1 container mx-auto p-4 max-w-3xl mt-4">
        {(currentUser?.studentSubscriptionTier as UserSubscriptionTierStudent) === 'Free' && (
          <Card className="mb-4 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700">
            <CardContent className="p-3 text-center text-xs text-blue-700 dark:text-blue-300">
              DPP Attempts Today: {dailyAttemptsCount === null ? 'Unlimited' : `${dailyAttemptsCount} / ${DAILY_DPP_LIMIT}`}.
              {effectiveIsDppLimitReached && " Daily limit reached."}
            </CardContent>
          </Card>
        )}
        <Card className="shadow-xl border border-border rounded-lg overflow-hidden bg-card">
          <CardHeader className="pb-3 bg-card border-b border-border p-4">
            <div className="flex justify-between items-start gap-2">
              <div className="flex-grow">
                <Badge variant={currentQuestion.difficulty === 'Easy' ? 'secondary' : currentQuestion.difficulty === 'Medium' ? 'default' : 'destructive'} className={cn( "font-semibold text-xs px-2 py-0.5", currentQuestion.difficulty === 'Easy' && 'bg-green-100 text-green-700 border-green-300 dark:bg-green-800/30 dark:text-green-300 dark:border-green-700', currentQuestion.difficulty === 'Medium' && 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-800/30 dark:text-yellow-300 dark:border-yellow-700', currentQuestion.difficulty === 'Hard' && 'bg-red-100 text-red-700 border-red-300 dark:bg-red-800/30 dark:text-red-300 dark:border-red-700' )}> {currentQuestion.difficulty} </Badge>
                {currentQuestion.pyq && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {currentQuestion.pyqExamName} {currentQuestion.pyqYear}
                    {currentQuestion.pyqDate && ` (${new Date(currentQuestion.pyqDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})`}
                    {currentQuestion.pyqShift && currentQuestion.pyqShift !== 'N/A' && ` - ${currentQuestion.pyqShift}`}
                  </p>
                )}
                 <p className="text-xs text-muted-foreground mt-1">
                  {currentQuestion.subject} &bull; {currentQuestion.lessonName || currentQuestion.LessonName}
                </p>
              </div>
              <div className="flex items-center flex-shrink-0">
                {previousAttemptInfo && (
                    <Badge variant="outline" className={cn("text-xs flex items-center gap-1 py-1 px-2 text-nowrap mr-2", previousAttemptInfo.wasCorrect ? "text-green-600 border-green-500 bg-green-500/10" : "text-red-600 border-red-500 bg-red-500/10")}> {previousAttemptInfo.wasCorrect ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />} Last: {previousAttemptInfo.wasCorrect ? 'Correct' : 'Incorrect'} <span className="hidden sm:inline">({format(new Date(previousAttemptInfo.attemptDate), 'dd/MM/yy')})</span></Badge>
                )}
                <Button variant="ghost" size="icon" onClick={handleOpenBookmarkModal} title="Bookmark this question" className="h-8 w-8 text-muted-foreground hover:text-primary">
                   <BookmarkIconLucide className={cn("h-5 w-5", isCurrentQuestionBookmarked && "fill-primary text-primary")} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 p-4 md:p-6">
            <div className="p-3 border-b border-border rounded-md bg-background min-h-[80px]">
              {currentQuestion.questionText && (<div className="prose prose-sm dark:prose-invert max-w-none mb-4 text-foreground leading-relaxed">{renderLatex(currentQuestion.questionText)}</div>)}
              {currentQuestion.displayQuestionImageUrl && (<div className="mt-2 mb-4 text-center"><NextImage src={currentQuestion.displayQuestionImageUrl} alt="Question Image" width={400} height={300} className="rounded object-contain inline-block border" data-ai-hint="question diagram illustration"/></div>)}
              {!(currentQuestion.questionText || currentQuestion.displayQuestionImageUrl) && (<p className="text-sm text-muted-foreground italic py-4">No question text or image provided.</p>)}
            </div>
            <RadioGroup value={selectedAnswer || ""} onValueChange={setSelectedAnswer} disabled={isSubmittingAttempt || isAnswerChecked || effectiveIsDppLimitReached} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {optionsArray.map((opt) => {
                const optionValue = `Option ${opt.id}`;
                const isThisCorrectAfterCheck = isAnswerChecked && opt.id === currentQuestion.correctOption;
                const isThisSelectedAndWrong = isAnswerChecked && selectedAnswer === optionValue && !isCorrect;
                return (
                  <Label
                    key={opt.id}
                    htmlFor={`option-${currentQuestion.id}-${opt.id}`}
                    className={cn(
                      "flex items-start space-x-3 rounded-lg border p-3 cursor-pointer transition-all hover:shadow-md",
                      (effectiveIsDppLimitReached && !isAnswerChecked) ? "opacity-60 cursor-not-allowed hover:border-border" : "",
                      selectedAnswer === optionValue && !isAnswerChecked && "bg-primary/10 border-primary ring-2 ring-primary",
                      isThisCorrectAfterCheck && "bg-green-500/10 border-green-500 ring-2 ring-green-500 text-green-700 dark:text-green-300",
                      isThisSelectedAndWrong && "bg-red-500/10 border-red-500 ring-2 ring-red-500 text-red-700 dark:text-red-300",
                      !isThisCorrectAfterCheck && !isThisSelectedAndWrong && "bg-card hover:border-primary/50"
                    )}
                  >
                    <div className="flex-shrink-0 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full w-7 h-7 flex items-center justify-center text-sm font-medium mt-0.5">
                      {opt.id}
                    </div>
                    <RadioGroupItem value={optionValue} id={`option-${currentQuestion.id}-${opt.id}`} className="sr-only" disabled={isAnswerChecked || isSubmittingAttempt || effectiveIsDppLimitReached} />
                    <div className="flex-1 text-sm">{renderOptionContent(opt.text, opt.image, `Option ${opt.id}`)}</div>
                  </Label>
                );
              })}
            </RadioGroup>
            {isAnswerChecked && isCorrect !== null && (
              <div className={cn("mt-4 p-3 rounded-md text-sm flex items-center gap-2 border shadow-sm", isCorrect ? 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/50' : 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/50')}>
                {isCorrect ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                Your answer was {isCorrect ? 'Correct' : 'Incorrect'}.
                {isCorrect === false && ` The correct option was ${currentQuestion.correctOption}.`}
              </div>
            )}
             {effectiveIsDppLimitReached && !isAnswerChecked && (
                <Card className="mt-4 bg-yellow-50 border-yellow-300 dark:bg-yellow-900/20 dark:border-yellow-700">
                    <CardContent className="p-4 text-center text-sm text-yellow-700 dark:text-yellow-300">
                        <Zap className="inline h-5 w-5 mr-2 text-yellow-500" />
                        You've reached your daily DPP limit for today!
                        <Link href={Routes.upgrade} className="font-semibold underline ml-1 hover:text-yellow-600 dark:hover:text-yellow-200">Upgrade for unlimited access.</Link>
                    </CardContent>
                </Card>
            )}
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-6 border-t border-border p-4 md:p-6">
             <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => {
                  const prevIndex = currentQuestionIndexInDpp - 1;
                  if (prevIndex >= 0 && dppQuestionIds[prevIndex]) {
                    router.push(Routes.qbankView(dppQuestionIds[prevIndex]));
                  }
                }}
                disabled={currentQuestionIndexInDpp <= 0 || dppQuestionIds.length === 0}
                className="flex-1 sm:flex-initial"
              >
                <ChevronLeft className="mr-2 h-4 w-4" /> Prev
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const nextIndex = currentQuestionIndexInDpp + 1;
                  if (nextIndex < dppQuestionIds.length && dppQuestionIds[nextIndex]) {
                    router.push(Routes.qbankView(dppQuestionIds[nextIndex]));
                  }
                }}
                disabled={currentQuestionIndexInDpp >= dppQuestionIds.length - 1 || dppQuestionIds.length === 0}
                className="flex-1 sm:flex-initial"
              >
                Next <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <Button onClick={handleCheckAnswer} disabled={!selectedAnswer || isAnswerChecked || isSubmittingAttempt || effectiveIsDppLimitReached} className="px-8 py-3 text-base w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground">
              {isSubmittingAttempt ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Checking...</> : 'Check Answer'}
            </Button>
          </CardFooter>
        </Card>
        {isAnswerChecked && (currentQuestion.explanationText || currentQuestion.displayExplanationImageUrl) && (
          <Card className="mt-6 shadow-lg border border-border rounded-lg overflow-hidden">
            <CardHeader className="bg-card border-b border-border p-4"><CardTitle className="text-lg font-medium text-foreground">Explanation</CardTitle></CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none p-4 md:p-6 text-foreground leading-relaxed">
              {currentQuestion.explanationText && renderLatex(currentQuestion.explanationText)}
              {currentQuestion.displayExplanationImageUrl && (<div className="mt-2 text-center"><NextImage src={currentQuestion.displayExplanationImageUrl} alt="Explanation Image" width={300} height={200} className="rounded object-contain inline-block border" data-ai-hint="explanation diagram illustration"/></div>)}
              {!(currentQuestion.explanationText || currentQuestion.displayExplanationImageUrl) && <p>No detailed explanation available.</p>}
            </CardContent>
          </Card>
        )}
        <div className="mt-8 text-center">
            {currentQuestion.ExamDpp && currentQuestion.subject && currentQuestion.lessonName && (
              <Link href={Routes.dppExamSubjectLessonQuestions(slugify(currentQuestion.ExamDpp), slugify(currentQuestion.subject), slugify(currentQuestion.lessonName))} passHref>
                <Button variant="outline" size="lg">
                  <BookOpen className="mr-2 h-5 w-5" /> Go to All Questions for this Lesson
                </Button>
              </Link>
            )}
        </div>
      </main>
      <Dialog open={isBookmarkModalOpen} onOpenChange={setIsBookmarkModalOpen}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Add to Notebooks</DialogTitle><DialogDescription>Select notebook(s).</DialogDescription></DialogHeader>
          {isLoadingUserNotebooks ? (<div className="flex justify-center items-center h-32"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>)
          : userNotebooks.length === 0 ? (<p className="text-sm text-muted-foreground text-center py-4">No notebooks. <Link href={Routes.notebooks} className="text-primary hover:underline">Create one!</Link></p>)
          : (<ScrollArea className="max-h-60 my-4"><div className="space-y-2 pr-2">{userNotebooks.map(nb => (<div key={nb.id} className="flex items-center space-x-2 p-2 border rounded-md hover:bg-muted/50">
                <Checkbox id={`bm-nb-${nb.id}`} checked={selectedNotebookIdsInModal.has(nb.id)} onCheckedChange={() => handleToggleNotebookSelection(nb.id)}/>
                <label htmlFor={`bm-nb-${nb.id}`} className="text-sm font-medium leading-none flex-1 cursor-pointer">{nb.notebook_name}</label><Badge variant="outline" className="text-xs">{nb.questionCount || 0} Qs</Badge>
            </div>))}</div></ScrollArea>
          )}
          <Button type="button" variant="outline" size="sm" className="w-full justify-start text-primary hover:text-primary/90" onClick={() => router.push(Routes.notebooks)} ><PlusCircle className="mr-2 h-4 w-4"/>Create New Notebook</Button>
          <div className="mt-4 pt-4 border-t"><p className="text-sm font-medium mb-2 text-muted-foreground">Add tags (optional):</p><div className="flex flex-wrap gap-2">{PREDEFINED_TAGS.map(tag => (<Button key={tag} variant={selectedModalTags.includes(tag) ? "default" : "outline"} size="sm" className="text-xs" onClick={() => handleToggleTagSelection(tag)}>{selectedModalTags.includes(tag) && <Check className="mr-1.5 h-3.5 w-3.5"/>}{tag}</Button>))}</div><p className="text-xs text-muted-foreground mt-2">Tags apply to this question in selected notebooks.</p></div>
          <DialogFooter className="mt-4"><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button onClick={handleSaveToNotebooks} disabled={selectedNotebookIdsInModal.size === 0 || isLoadingUserNotebooks}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
