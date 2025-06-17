
'use client';

import { useState, useEffect, useCallback } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import pb from '@/lib/pocketbase';
import type { RecordModel, ClientResponseError } from 'pocketbase';
import { useToast } from '@/hooks/use-toast';
import { AppConfig, escapeForPbFilter, Routes } from '@/lib/constants';
import { Settings2, Users, Swords, Send, Loader2, AlertCircle } from 'lucide-react';
import type { User } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';

const subjectOptionsSchema = z.enum(['Physics', 'Chemistry', 'Mathematics', 'Biology'], {
  required_error: "Subject is required."
});

const createChallengeSchema = z.object({
  subject: subjectOptionsSchema,
  lesson: z.string().min(1, "Lesson is required."),
  numQuestions: z.coerce.number().int().min(1, "Min 1 question.").max(50, "Max 50 questions."),
  difficulty: z.enum(["All", "Easy", "Medium", "Hard"], { required_error: "Difficulty is required." }),
  examSpecific: z.string().optional(),
  challengedFriends: z.array(z.string()).min(1, "Select at least one friend.").max(10, "You can select up to 10 friends."),
  duration: z.coerce.number().int().min(5, "Min 5 minutes.").max(180, "Max 180 minutes."),
});

type CreateChallengeInput = z.infer<typeof createChallengeSchema>;

interface FollowRecord extends RecordModel {
  user: string;
  following: string[];
  expand?: {
    following?: User[];
  };
}

export default function CreateChallengePage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [subjects, setSubjects] = useState<string[]>([]);
  const [lessons, setLessons] = useState<string[]>([]);
  const [exams, setExams] = useState<string[]>(["Any Exam"]);
  const [following, setFollowing] = useState<User[]>([]);

  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
  const [isLoadingLessons, setIsLoadingLessons] = useState(false);
  const [isLoadingExams, setIsLoadingExams] = useState(false);
  const [isLoadingFollowing, setIsLoadingFollowing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);

  const form = useForm<CreateChallengeInput>({
    resolver: zodResolver(createChallengeSchema),
    defaultValues: {
      numQuestions: 10,
      difficulty: "All",
      examSpecific: "Any Exam",
      challengedFriends: [],
      duration: 30,
    },
  });

  const selectedSubject = form.watch('subject');

  useEffect(() => {
    let isMounted = true;
    setIsLoadingSubjects(true);
    setSubjectsError(null);
    pb.collection('question_bank').getFullList<{ subject: string }>({ fields: 'subject', '$autoCancel': false })
      .then(records => {
        if (isMounted) {
          const distinctSubjects = Array.from(new Set(records.map(r => r.subject).filter(Boolean))).sort();
          setSubjects(distinctSubjects);
          if (distinctSubjects.length === 0) {
            setSubjectsError("No subjects found in the question bank. Ensure API rules for 'question_bank' allow authenticated users to list records, especially the 'subject' field.");
          }
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          const errMessage = `Error fetching subjects: ${err.data?.message || err.message}. Please ensure API rules for 'question_bank' allow list access.`;
          toast({ title: "Error", description: errMessage, variant: "destructive", duration: 7000 });
          setSubjectsError(errMessage);
          console.error("Error fetching subjects:", err.data || err);
        }
      })
      .finally(() => { if (isMounted) setIsLoadingSubjects(false); });
    return () => { isMounted = false; };
  }, [toast]);

  useEffect(() => {
    let isMounted = true;
    if (selectedSubject) {
      setIsLoadingLessons(true);
      setLessons([]);
      form.setValue('lesson', '');

      pb.collection('question_bank').getFullList<{ lessonName: string }>({
        filter: `subject = "${escapeForPbFilter(selectedSubject)}"`,
        fields: 'lessonName',
        '$autoCancel': false,
      })
        .then(records => {
          if (isMounted) {
            const distinctLessons = Array.from(new Set(records.map(r => r.lessonName).filter(Boolean))).sort();
            setLessons(distinctLessons);
          }
        })
        .catch(() => { if (isMounted) toast({ title: "Error fetching lessons", variant: "destructive" }); })
        .finally(() => { if (isMounted) setIsLoadingLessons(false); });
    } else {
      setLessons([]);
    }
    return () => { isMounted = false; };
  }, [selectedSubject, form, toast]);

  useEffect(() => {
    let isMounted = true;
    setIsLoadingExams(true);
    pb.collection('question_bank').getFullList<{ ExamDpp: string, pyqExamName: string }>({ fields: 'ExamDpp,pyqExamName', '$autoCancel': false })
      .then(records => {
        if (isMounted) {
          const distinctExams = new Set<string>(["Any Exam"]);
          records.forEach(r => {
            if (r.ExamDpp) distinctExams.add(r.ExamDpp);
            if (r.pyqExamName) distinctExams.add(r.pyqExamName);
          });
          setExams(Array.from(distinctExams).sort());
        }
      })
      .catch(() => { if (isMounted) toast({ title: "Error fetching exam options", variant: "destructive" }); })
      .finally(() => { if (isMounted) setIsLoadingExams(false); });
    return () => { isMounted = false; };
  }, [toast]);

  useEffect(() => {
    let isMounted = true;
    if (user?.id && !authLoading) {
      setIsLoadingFollowing(true);
      pb.collection('following_followed').getFirstListItem<FollowRecord>(`user="${user.id}"`, { expand: 'following', '$autoCancel': false })
        .then(record => {
          if (isMounted && record.expand?.following) {
            setFollowing(record.expand.following as User[]);
          } else if (isMounted) {
            setFollowing([]);
          }
        })
        .catch((error: ClientResponseError) => {
          if (isMounted) {
            if (error.status === 404) {
              setFollowing([]);
            } else {
              toast({ title: "Error fetching friends list", variant: "destructive" });
            }
          }
        })
        .finally(() => { if (isMounted) setIsLoadingFollowing(false); });
    } else if (!authLoading && !user?.id && isMounted) {
        setFollowing([]);
        setIsLoadingFollowing(false);
    }
    return () => { isMounted = false; };
  }, [user, authLoading, toast]);

  const generateRandomAlphanumeric = (length: number): string => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  };

  const onSubmit = async (values: CreateChallengeInput) => {
    if (!user?.id) {
      toast({ title: "Authentication Error", description: "You must be logged in to create a challenge.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    const generatedChallengeName = `${values.subject.substring(0,3).toUpperCase()}-${values.lesson.substring(0,5).toUpperCase()}-${generateRandomAlphanumeric(4)}`;
    const calculatedExpiryTimeMin = values.duration + 20; // duration in minutes + 20 minutes

    const challengeData = {
      student: user.id, // Changed from challenge_created_student_name to student
      challenge_name: generatedChallengeName,
      Subject: values.subject,
      Lesson: values.lesson,
      number_of_question: values.numQuestions,
      Difficulty: values.difficulty,
      Exam_specific_questions: values.examSpecific === "Any Exam" ? null : values.examSpecific,
      challenged_friends: values.challengedFriends,
      duration: values.duration,
      status: "pending",
      expiry_time_min: calculatedExpiryTimeMin,
    };

    try {
      const createdChallenge = await pb.collection('student_create_challenge').create(challengeData);

      for (const friendId of values.challengedFriends) {
        await pb.collection('students_challenge_invites').create({
          student: friendId,
          created_challenged_data: createdChallenge.id,
        });

        await pb.collection('notification').create({
          bywho_if_student: user.id,
          towho: [friendId],
          message: `${user.name || 'A friend'} has challenged you to a ${values.subject} test on "${values.lesson}"! Challenge: ${generatedChallengeName}. Check your Challenge Invites.`,
          type: 'challenge_invite',
          related_challenge_id: createdChallenge.id,
          seen: false,
          deleted: false,
          approved: null, 
        });
      }

      toast({
        title: "Challenge Sent!",
        description: `Redirecting to challenge lobby...`,
      });
      
      router.push(Routes.challengeLobby(createdChallenge.id));
      
    } catch (error: any) {
      console.error("Create Challenge Error:", error.data?.data || error.message, "Full error:", error);
      let errorMsg = "Could not create the challenge. Please try again.";
      if (error.data?.data) {
          errorMsg = Object.entries(error.data.data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
      } else if (error.message) {
          errorMsg = error.message;
      }
      toast({ title: "Challenge Creation Failed", description: errorMsg, variant: "destructive", duration: 7000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAvatarFallback = (name?: string) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length > 1) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  if (authLoading) {
    return (
      <div className="p-8 text-center space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
        <p>Loading user data...</p>
      </div>
    );
  }
  if (!user) {
      return (
          <div className="p-8 text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
              <p>Please log in to create a challenge.</p>
          </div>
      );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="text-center mb-10">
        <Swords className="h-16 w-16 text-primary mx-auto mb-4" />
        <h1 className="text-4xl font-bold text-foreground">Create Challenge Test</h1>
        <p className="text-muted-foreground mt-2">Set up a test and challenge your friends!</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Settings2 className="h-6 w-6 text-primary" /> Test Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingSubjects || !!subjectsError}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingSubjects ? "Loading subjects..." : (subjectsError ? "Error loading subjects" : "Select Subject")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {subjectsError && !isLoadingSubjects && <FormMessage>{subjectsError}</FormMessage>}
                    {!subjectsError && <FormMessage />}
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lesson"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lesson *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedSubject || isLoadingLessons || !!subjectsError}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingLessons ? "Loading lessons..." : (selectedSubject ? "Select Lesson" : "Select Subject First")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {lessons.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="numQuestions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Questions (1-50) *</FormLabel>
                    <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select number" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[5, 10, 15, 20, 25, 30, 40, 50].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="difficulty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Difficulty *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Difficulty" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {["All", "Easy", "Medium", "Hard"].map(d => <SelectItem key={d} value={d}>{d === "All" ? "All Difficulties" : d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="examSpecific"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Exam Specific Questions (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingExams}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingExams ? "Loading exams..." : "Any Exam"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {exams.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Challenge Duration (minutes) *</FormLabel>
                    <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select duration" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[5, 10, 15, 20, 30, 45, 60, 90, 120, 180].map(d => <SelectItem key={d} value={d.toString()}>{d} minutes</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Users className="h-6 w-6 text-primary" /> Challenge Friends
              </CardTitle>
              <CardDescription>Select up to 10 friends you are following.</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="challengedFriends"
                render={() => (
                  <FormItem>
                    {isLoadingFollowing ? (
                        <div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
                    ) : following.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">You are not following anyone yet. Find friends to challenge!</p>
                    ) : (
                        <ScrollArea className="h-60 w-full rounded-md border p-3">
                            <div className="space-y-2">
                            {following.map((friend) => (
                                <FormField
                                key={friend.id}
                                control={form.control}
                                name="challengedFriends"
                                render={({ field }) => {
                                    return (
                                    <FormItem
                                        className="flex flex-row items-center space-x-3 space-y-0 p-2 hover:bg-muted/50 rounded-md"
                                    >
                                        <FormControl>
                                        <Checkbox
                                            checked={field.value?.includes(friend.id)}
                                            onCheckedChange={(checked) => {
                                            return checked
                                                ? field.onChange([...(field.value || []), friend.id])
                                                : field.onChange(
                                                    field.value?.filter(
                                                    (value) => value !== friend.id
                                                    )
                                                )
                                            }}
                                            disabled={(field.value?.length || 0) >= 10 && !field.value?.includes(friend.id)}
                                        />
                                        </FormControl>
                                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => {
                                            const isChecked = field.value?.includes(friend.id);
                                            const currentLength = field.value?.length || 0;
                                            if (isChecked) {
                                                field.onChange(field.value?.filter(value => value !== friend.id));
                                            } else if (currentLength < 10) {
                                                field.onChange([...(field.value || []), friend.id]);
                                            }
                                        }}>
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={friend.avatarUrl} alt={friend.name} />
                                            <AvatarFallback>{getAvatarFallback(friend.name)}</AvatarFallback>
                                        </Avatar>
                                        <FormLabel className="font-normal text-sm cursor-pointer">
                                            {friend.name}
                                        </FormLabel>
                                        </div>
                                    </FormItem>
                                    )
                                }}
                                />
                            ))}
                            </div>
                        </ScrollArea>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="w-full py-3 text-base" disabled={isSubmitting || !!subjectsError || isLoadingSubjects || isLoadingLessons || isLoadingExams || isLoadingFollowing}>
            {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
            {isSubmitting ? 'Sending Challenge...' : 'Create & Send Challenge'}
          </Button>
        </form>
      </Form>
    </div>
  );
}
