
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TeacherSignupSchema, type TeacherSignupInput, TeacherFavExamEnum, TeacherSubjectsOfferedEnum } from '@/lib/schemas';
import Link from 'next/link';
import { Routes, AppConfig } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, EyeOff } from 'lucide-react';

const teacherTotalStudentsOptions = ["1-10", "11-30", "31-60", "61-100", ">100"] as const;
const teacherLevelOptions = ["Beginner", "Experienced"] as const;
const teacherFavExamOptions = TeacherFavExamEnum.options;
const teacherSubjectsOfferedOptions = TeacherSubjectsOfferedEnum.options;


export function TeacherSignupForm() {
  const { teacherSignup, teacher, isLoadingTeacher } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);


  const form = useForm<TeacherSignupInput>({
    resolver: zodResolver(TeacherSignupSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      institute_name: '',
      phone_number: '',
      total_students: undefined,
      level: undefined,
      EduNexus_Name: '',
      favExam: [],
      about: '',
      profile_picture: null,
      subjects_offered: [],
    },
  });

  const watchedName = form.watch('name');
  const watchedInstituteName = form.watch('institute_name');
  const watchedSubjects = form.watch('subjects_offered');
  const watchedExams = form.watch('favExam');
  const watchedLevel = form.watch('level');
  const watchedTotalStudents = form.watch('total_students');

  useEffect(() => {
    if (teacher && !isLoadingTeacher) {
      router.replace(Routes.teacherDashboard);
    }
  }, [teacher, isLoadingTeacher, router]);

  useEffect(() => {
    const currentAbout = form.getValues('about');
    if (!currentAbout?.trim() && (watchedName || watchedInstituteName || watchedSubjects?.length || watchedExams?.length || watchedLevel || watchedTotalStudents)) {
      let aboutText = "";
      if (watchedName) {
        aboutText += `Hey there! I am ${watchedName}`;
        if (watchedInstituteName) {
          aboutText += ` from ${watchedInstituteName}`;
        }
        aboutText += ".";
      } else if (watchedInstituteName) {
        aboutText += `I represent ${watchedInstituteName}.`;
      } else {
        aboutText += "Hey there!";
      }

      if (watchedLevel) {
        aboutText += ` I am an ${watchedLevel.toLowerCase()} educator`;
      }
      if (watchedSubjects && watchedSubjects.length > 0) {
        const subjectsString = watchedSubjects.join(', ');
        aboutText += ` specializing in ${subjectsString}`;
      }
      if (watchedExams && watchedExams.length > 0) {
        const examsString = watchedExams.join(', ');
        aboutText += ` for exams like ${examsString}`;
      }
      if (watchedTotalStudents) {
        const studentRange = watchedTotalStudents === '>100' ? 'over 100' : watchedTotalStudents;
        aboutText += `, and I currently guide ${studentRange} students`;
      }
      aboutText += ". I'm passionate about teaching and helping students achieve their academic goals!";
      form.setValue('about', aboutText.trim());
    }
  }, [watchedName, watchedInstituteName, watchedSubjects, watchedExams, watchedLevel, watchedTotalStudents, form]);


  async function onSubmit(values: TeacherSignupInput) {
    setIsSubmitting(true);
    console.log("Teacher Signup Form Values:", values);
    try {
      const success = await teacherSignup(values);
      if (success) {
        toast({
          title: 'Teacher Signup Successful',
          description: `Welcome to ${AppConfig.appName}! Your teacher account has been created.`,
        });
      } else {
        toast({
          title: 'Teacher Signup Failed',
          description: 'Could not create your teacher account. Please check your details or try again later.',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('AuthContext (Teacher Signup): PocketBase signup error:', error.data || error.message, 'Full error:', error);
      toast({
        title: 'Teacher Signup Failed',
        description: error.data?.data?.EduNexus_Name?.message || error.data?.message || error.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoadingTeacher || (teacher && !isSubmitting)) {
     return (
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader><CardTitle className="text-2xl">Loading...</CardTitle></CardHeader>
        <CardContent><p>Checking authentication status...</p></CardContent>
      </Card>
    );
  }


  return (
    <Card className="w-full max-w-lg shadow-xl my-8">
      <CardHeader>
        <CardTitle className="text-2xl">Teacher Registration</CardTitle>
        <CardDescription>Join {AppConfig.appName} as an educator. Fields marked with * are required.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => ( <FormItem> <FormLabel>Full Name *</FormLabel> <FormControl><Input placeholder="Your Name" {...field} /></FormControl> <FormMessage /> </FormItem> )}/>
                <FormField control={form.control} name="email" render={({ field }) => ( <FormItem> <FormLabel>Email *</FormLabel> <FormControl><Input type="email" placeholder="you@example.com" {...field} /></FormControl> <FormMessage /> </FormItem> )}/>
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password *</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            {...field}
                            className="pr-10"
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password *</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input
                            type={showConfirmPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            {...field}
                            className="pr-10"
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                        >
                          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="institute_name" render={({ field }) => ( <FormItem> <FormLabel>Institute Name *</FormLabel> <FormControl><Input placeholder="Your Coaching Institute" {...field} /></FormControl> <FormMessage /> </FormItem> )}/>
                <FormField control={form.control} name="phone_number" render={({ field }) => ( <FormItem> <FormLabel>Phone Number *</FormLabel> <FormControl><Input type="tel" placeholder="e.g. 9876543210" {...field} /></FormControl> <FormMessage /> </FormItem> )}/>
                <FormField control={form.control} name="total_students" render={({ field }) => ( <FormItem> <FormLabel>Total Students You Teach *</FormLabel> <Select onValueChange={field.onChange} value={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Select range" /></SelectTrigger></FormControl> <SelectContent>{teacherTotalStudentsOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent> </Select> <FormMessage /> </FormItem> )}/>
                <FormField control={form.control} name="level" render={({ field }) => ( <FormItem> <FormLabel>Your Experience Level *</FormLabel> <Select onValueChange={field.onChange} value={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger></FormControl> <SelectContent>{teacherLevelOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent> </Select> <FormMessage /> </FormItem> )}/>
                <FormField
                  control={form.control}
                  name="EduNexus_Name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>EduNexus Username *</FormLabel>
                      <FormControl><Input placeholder="Your unique username" {...field} /></FormControl>
                      <FormDescription>
                        This will be your unique public username. No spaces or special characters.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>

            <FormField
              control={form.control}
              name="subjects_offered"
              render={() => (
                <FormItem>
                  <div className="mb-2">
                    <FormLabel className="text-base">Subjects You Offer *</FormLabel>
                    <FormDescription>Select all subjects you teach.</FormDescription>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {teacherSubjectsOfferedOptions.map((item) => (
                      <FormField
                        key={item}
                        control={form.control}
                        name="subjects_offered"
                        render={({ field }) => {
                          return (
                            <FormItem
                              key={item}
                              className="flex flex-row items-center space-x-2 space-y-0"
                            >
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(item)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...(field.value || []), item])
                                      : field.onChange(
                                          field.value?.filter(
                                            (value) => value !== item
                                          )
                                        )
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-normal text-sm">
                                {item}
                              </FormLabel>
                            </FormItem>
                          )
                        }}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="favExam"
              render={() => (
                <FormItem>
                  <div className="mb-2">
                    <FormLabel className="text-base">Exams You Prepare Students For * (max 3)</FormLabel>
                    <FormDescription>Select the competitive exams you focus on.</FormDescription>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {teacherFavExamOptions.map((item) => (
                      <FormField
                        key={item}
                        control={form.control}
                        name="favExam"
                        render={({ field }) => {
                          return (
                            <FormItem
                              key={item}
                              className="flex flex-row items-center space-x-2 space-y-0"
                            >
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(item)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...(field.value || []), item])
                                      : field.onChange(
                                          field.value?.filter(
                                            (value) => value !== item
                                          )
                                        )
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-normal text-sm">
                                {item}
                              </FormLabel>
                            </FormItem>
                          )
                        }}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="about"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>About You *</FormLabel>
                  <FormControl><Textarea placeholder="Tell students a bit about your teaching style or experience." {...field} rows={4} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
                control={form.control}
                name="profile_picture"
                render={({ field: { onChange, value, ...rest } }) => (
                    <FormItem>
                        <FormLabel>Profile Picture (Optional)</FormLabel>
                        <FormControl>
                            <Input
                                type="file"
                                accept="image/png, image/jpeg, image/webp"
                                onChange={(e) => onChange(e.target.files ? e.target.files[0] : null)}
                                {...rest}
                            />
                        </FormControl>
                        <FormDescription>Max 5MB. JPG, PNG, WEBP accepted.</FormDescription>
                        {value && <p className="text-xs text-green-600">Selected: {value.name}</p>}
                        <FormMessage />
                    </FormItem>
                )}
            />

            <Button type="submit" className="w-full" disabled={isSubmitting || isLoadingTeacher}>
              {isSubmitting ? 'Creating Account...' : 'Register as Teacher'}
            </Button>
          </form>
        </Form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have a teacher account?{' '}
          <Link href={Routes.teacherLogin} className="font-medium text-primary hover:underline">
            Login
          </Link>
        </p>
         <p className="mt-2 text-center text-sm text-muted-foreground">
          Are you a student?{' '}
          <Link href={Routes.signup} className="font-medium text-primary hover:underline">
            Student Signup
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
