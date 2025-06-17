
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import pb from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Search, Sparkles, Loader2, MapPin, Briefcase, BookOpen, University, ChevronRight } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AppConfig, escapeForPbFilter } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';

// --- College Cutoffs Data Structure (from college-cutoffs/page.tsx) ---
interface CategoryCutoff {
  category_name: string;
  cutoff_type?: 'Percentile' | 'Rank' | 'Score' | string;
  cutoff_value: number | string;
  seat_type_details?: string;
}
interface StageCutoff {
  stage_name: string;
  categories: CategoryCutoff[];
}
interface CourseCutoff {
  course_code?: string;
  course_name: string;
  stages: StageCutoff[];
}
interface CollegeRecordForPrediction extends RecordModel {
  id: string;
  college_name: string;
  college_code?: string;
  type?: string;
  location?: string; // Maps to Region
  website?: string;
  cutoffs?: CourseCutoff[];
  fees?: any;
  exam_name?: string; // Maps to Score Type
  academic_year?: number;
}
// --- End College Cutoffs Data Structure ---

const CollegePredictorFormSchema = z.object({
  scoreType: z.enum(['MHT CET', 'JEE MAINS'], { required_error: "Score type is required." }),
  percentile: z.coerce.number({ invalid_type_error: "Percentile must be a number."})
    .min(0, "Percentile must be 0-100.")
    .max(100, "Percentile must be 0-100."),
  category: z.enum(['OPEN', 'OBC', 'SC', 'ST', 'EWS', 'OTHER'], { required_error: "Category is required." }),
  gender: z.enum(['Male', 'Female'], { required_error: "Gender is required." }),
  branch: z.string().min(1, "Branch is required.").max(100, "Branch name too long."),
  region: z.string().min(1, "Region is required.").max(100, "Region name too long."),
  class12District: z.string().min(1, "12th District is required.").max(100, "District name too long."),
  academicYear: z.coerce.number().int().min(2000, "Invalid year.").max(2050, "Invalid year."),
});
type CollegePredictorFormInput = z.infer<typeof CollegePredictorFormSchema>;

const currentYear = new Date().getFullYear();
const academicYearOptions = Array.from({ length: 10 }, (_, i) => currentYear - i).map(String);

const mapCategoryToCutoffJson = (formCategory: string): string[] => {
  const lowerFormCategory = formCategory.toLowerCase();
  if (lowerFormCategory === 'open') return ['open', 'general open', 'gopenh', 'gopens', 'gopeno']; // Add common variations
  if (lowerFormCategory === 'obc') return ['obc', 'gobch', 'gobcs', 'gobco'];
  if (lowerFormCategory === 'sc') return ['sc', 'gsch', 'gscs', 'gsco'];
  if (lowerFormCategory === 'st') return ['st', 'gststh', 'gststo', 'gststs'];
  if (lowerFormCategory === 'ews') return ['ews', 'tfws']; // TFWS often related to EWS
  return [lowerFormCategory, 'other']; // Fallback for "OTHER" or direct match
};


export default function CollegePredictorPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [predictedColleges, setPredictedColleges] = useState<CollegeRecordForPrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchPerformed, setSearchPerformed] = useState(false);

  const [branchOptions, setBranchOptions] = useState<{ value: string; label: string }[]>([]);
  const [regionOptions, setRegionOptions] = useState<{ value: string; label: string }[]>([]);
  const [isLoadingDropdownData, setIsLoadingDropdownData] = useState(true);

  const form = useForm<CollegePredictorFormInput>({
    resolver: zodResolver(CollegePredictorFormSchema),
    defaultValues: {
      academicYear: currentYear,
      scoreType: undefined, category: undefined, gender: undefined,
      branch: '', region: '', class12District: '', percentile: undefined
    },
  });

  const fetchDropdownData = useCallback(async (isMountedGetter: () => boolean) => {
    if (!isMountedGetter()) return;
    setIsLoadingDropdownData(true);
    try {
      const records = await pb.collection('college_cutoffs').getFullList<CollegeRecordForPrediction>({
        fields: 'location,cutoffs', // Fetch only necessary fields
      });
      if (!isMountedGetter()) return;

      const distinctRegions = new Set<string>();
      const distinctBranches = new Set<string>();

      records.forEach(college => {
        if (college.location) distinctRegions.add(college.location);
        if (college.cutoffs && Array.isArray(college.cutoffs)) {
          college.cutoffs.forEach(course => {
            if (course.course_name) distinctBranches.add(course.course_name);
          });
        }
      });
      if (isMountedGetter()) {
        setRegionOptions(Array.from(distinctRegions).sort().map(r => ({ value: r, label: r })));
        setBranchOptions(Array.from(distinctBranches).sort().map(b => ({ value: b, label: b })));
      }
    } catch (err) {
      if (isMountedGetter()) console.error("Failed to fetch dropdown data:", err);
    } finally {
      if (isMountedGetter()) setIsLoadingDropdownData(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchDropdownData(() => isMounted);
    return () => { isMounted = false; };
  }, [fetchDropdownData]);


  const onSubmit = async (values: CollegePredictorFormInput) => {
    setIsLoading(true);
    setError(null);
    setPredictedColleges([]);
    setSearchPerformed(true);

    try {
      // 1. Save user's query
      const queryDataToSave = {
        ...values,
        student: user?.id || null,
        academic_year_preference: values.academicYear,
      };
      await pb.collection('college_list_checher').create(queryDataToSave);

      // 2. Fetch colleges based on Score Type (exam_name) and Academic Year
      const filterString = `exam_name = "${escapeForPbFilter(values.scoreType)}" && academic_year = ${values.academicYear}`;
      console.log("Fetching colleges with filter:", filterString);

      const collegesFromDb = await pb.collection('college_cutoffs').getFullList<CollegeRecordForPrediction>({
        filter: filterString,
      });
      console.log(`Fetched ${collegesFromDb.length} colleges from DB.`);

      // 3. Client-side filtering
      const matchedColleges: CollegeRecordForPrediction[] = [];
      const userBranchLower = values.branch.toLowerCase();
      const userRegionLower = values.region.toLowerCase();
      const userCategoryOptionsLower = mapCategoryToCutoffJson(values.category);

      collegesFromDb.forEach(college => {
        if (values.region && college.location?.toLowerCase() !== userRegionLower) {
          return; // Skip if region doesn't match (and region filter is applied)
        }

        const matchingCoursesForCollege: CourseCutoff[] = [];
        if (college.cutoffs && Array.isArray(college.cutoffs)) {
          college.cutoffs.forEach(course => {
            if (course.course_name?.toLowerCase().includes(userBranchLower)) {
              let isCourseMatch = false;
              course.stages.forEach(stage => {
                stage.categories.forEach(category => {
                  const categoryNameLower = category.category_name?.toLowerCase();
                  if (categoryNameLower && userCategoryOptionsLower.includes(categoryNameLower)) {
                    if (category.cutoff_type?.toLowerCase() === 'percentile') {
                      const cutoffVal = Number(category.cutoff_value);
                      if (!isNaN(cutoffVal) && values.percentile >= cutoffVal) {
                        isCourseMatch = true;
                      }
                    }
                  }
                });
              });
              if (isCourseMatch) {
                // Only include relevant stages/categories in the display for this course
                const relevantCourseData: CourseCutoff = {
                    ...course,
                    stages: course.stages.map(stage => ({
                        ...stage,
                        categories: stage.categories.filter(cat => {
                            const catNameLower = cat.category_name?.toLowerCase();
                            return catNameLower && userCategoryOptionsLower.includes(catNameLower) &&
                                   cat.cutoff_type?.toLowerCase() === 'percentile' &&
                                   Number(cat.cutoff_value) <= values.percentile;
                        })
                    })).filter(stage => stage.categories.length > 0)
                };
                if(relevantCourseData.stages.length > 0) {
                   matchingCoursesForCollege.push(relevantCourseData);
                }
              }
            }
          });
        }
        if (matchingCoursesForCollege.length > 0) {
          matchedColleges.push({...college, cutoffs: matchingCoursesForCollege});
        }
      });
      
      console.log(`Found ${matchedColleges.length} matched colleges after filtering.`);
      setPredictedColleges(matchedColleges);
      if (matchedColleges.length === 0) {
        toast({ title: "No Colleges Found", description: "No colleges match your criteria. Try adjusting your filters." });
      }

    } catch (error: any) {
      console.error("College predictor error:", error);
      let errorMsg = "An error occurred while predicting colleges.";
      if (error.data?.message) errorMsg = error.data.message;
      else if (error.message) errorMsg = error.message;
      setError(errorMsg);
      toast({ title: "Error", description: errorMsg, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-900 text-slate-50">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8">
        <Card className="max-w-3xl mx-auto shadow-xl border-cyan-500/30 bg-slate-800/60 backdrop-blur-md">
          <CardHeader className="text-center border-b border-slate-700">
            <Sparkles className="mx-auto h-10 w-10 text-cyan-400 mb-2" />
            <CardTitle className="text-3xl font-bold text-cyan-300">
              {AppConfig.appName} College Predictor
            </CardTitle>
            <CardDescription className="text-slate-400">
              Enter your details to find suitable colleges.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <div className="grid md:grid-cols-2 gap-5">
                  <FormField control={form.control} name="scoreType" render={({ field }) => (<FormItem><FormLabel>Score Type *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="bg-slate-700 border-slate-600 text-slate-50"><SelectValue placeholder="Select Score Type" /></SelectTrigger></FormControl><SelectContent className="bg-slate-700 border-slate-600 text-slate-50">{['MHT CET', 'JEE MAINS'].map(type => <SelectItem key={type} value={type} className="hover:bg-slate-600 focus:bg-slate-600">{type}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                  <FormField control={form.control} name="percentile" render={({ field }) => (<FormItem><FormLabel>Percentile *</FormLabel><FormControl><Input type="number" step="0.0000001" placeholder="e.g., 95.1234567" {...field} className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"/></FormControl><FormMessage /></FormItem>)}/>
                  <FormField control={form.control} name="category" render={({ field }) => (<FormItem><FormLabel>Category *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="bg-slate-700 border-slate-600 text-slate-50"><SelectValue placeholder="Select Category" /></SelectTrigger></FormControl><SelectContent className="bg-slate-700 border-slate-600 text-slate-50">{['OPEN', 'OBC', 'SC', 'ST', 'EWS', 'OTHER'].map(cat => <SelectItem key={cat} value={cat} className="hover:bg-slate-600 focus:bg-slate-600">{cat}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                  <FormField control={form.control} name="gender" render={({ field }) => (<FormItem><FormLabel>Gender *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="bg-slate-700 border-slate-600 text-slate-50"><SelectValue placeholder="Select Gender" /></SelectTrigger></FormControl><SelectContent className="bg-slate-700 border-slate-600 text-slate-50">{['Male', 'Female'].map(gen => <SelectItem key={gen} value={gen} className="hover:bg-slate-600 focus:bg-slate-600">{gen}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                  <FormField control={form.control} name="branch" render={({ field }) => (<FormItem><FormLabel>Preferred Branch *</FormLabel><FormControl><Combobox options={branchOptions} value={field.value || ''} onChange={field.onChange} placeholder="Select or type Branch" inputPlaceholder="Search Branch..." className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500" /></FormControl><FormMessage /></FormItem>)}/>
                  <FormField control={form.control} name="region" render={({ field }) => (<FormItem><FormLabel>Preferred Region *</FormLabel><FormControl><Combobox options={regionOptions} value={field.value || ''} onChange={field.onChange} placeholder="Select or type Region" inputPlaceholder="Search Region..." className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500" /></FormControl><FormMessage /></FormItem>)}/>
                  <FormField control={form.control} name="class12District" render={({ field }) => (<FormItem><FormLabel>Class 12th District *</FormLabel><FormControl><Input placeholder="e.g., Pune" {...field} className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"/></FormControl><FormMessage /></FormItem>)}/>
                  <FormField control={form.control} name="academicYear" render={({ field }) => (<FormItem><FormLabel>Academic Year for Cutoffs *</FormLabel><Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}><FormControl><SelectTrigger className="bg-slate-700 border-slate-600 text-slate-50"><SelectValue placeholder="Select Year" /></SelectTrigger></FormControl><SelectContent className="bg-slate-700 border-slate-600 text-slate-50">{academicYearOptions.map(year => <SelectItem key={year} value={year} className="hover:bg-slate-600 focus:bg-slate-600">{year}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                </div>
                <Button type="submit" className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-900 font-semibold py-3 text-lg shadow-lg hover:shadow-cyan-500/50 transition-all" disabled={isLoading || isLoadingDropdownData}>
                  {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Search className="mr-2 h-5 w-5"/>}
                  {isLoading ? 'Predicting...' : (isLoadingDropdownData ? 'Loading Filters...' : 'Predict Colleges')}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {searchPerformed && !isLoading && (
          <section className="mt-10">
            <h2 className="text-2xl font-bold text-cyan-300 mb-6 text-center">Predicted Colleges ({predictedColleges.length})</h2>
            {error && <p className="text-destructive text-center mb-4">{error}</p>}
            {predictedColleges.length > 0 ? (
              <ScrollArea className="max-h-[600px] pr-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {predictedColleges.map((college) => (
                    <Card key={college.id} className="bg-slate-800/70 border-slate-700 text-slate-200 shadow-md hover:shadow-cyan-500/20 transition-shadow">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg text-cyan-400 flex items-center gap-2"><University className="h-5 w-5"/>{college.college_name}</CardTitle>
                        <div className="text-xs text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
                            {college.college_code && <span>Code: {college.college_code}</span>}
                            {college.location && <span><MapPin className="inline h-3 w-3 mr-0.5"/>{college.location}</span>}
                            {college.type && <span>Type: {college.type}</span>}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <h4 className="text-sm font-semibold text-cyan-300 mb-1.5 mt-2 flex items-center gap-1.5"><Briefcase className="h-4 w-4"/>Eligible Branches:</h4>
                        {college.cutoffs && college.cutoffs.length > 0 ? (
                          <ul className="space-y-1.5 pl-2">
                            {college.cutoffs.map((course, idx) => (
                              <li key={idx} className="text-xs border-l-2 border-cyan-600/50 pl-2 py-1 bg-slate-700/30 rounded-r-md">
                                <strong className="text-slate-300">{course.course_name}:</strong>
                                {course.stages.map((stage, sIdx) => (
                                  <div key={sIdx} className="pl-2">
                                    {stage.categories.map((cat, cIdx) => (
                                      <span key={cIdx} className="block text-slate-400">
                                        {cat.category_name} Cutoff: <Badge variant="secondary" className="bg-cyan-400/10 text-cyan-300 border-cyan-400/30 px-1.5 py-0.5">{cat.cutoff_value}</Badge>
                                      </span>
                                    ))}
                                  </div>
                                ))}
                              </li>
                            ))}
                          </ul>
                        ) : <p className="text-xs text-slate-500 italic">No specific branches matched your percentile for the selected category.</p>}
                      </CardContent>
                      {college.website && <CardFooter className="pt-2"><Button variant="link" asChild className="text-cyan-400 hover:text-cyan-300 p-0 h-auto text-xs"><a href={college.website} target="_blank" rel="noopener noreferrer">Visit Website <ChevronRight className="h-3 w-3 ml-1"/></a></Button></CardFooter>}
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              !error && <p className="text-slate-400 text-center">No colleges found matching your criteria. Please try adjusting your inputs.</p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

