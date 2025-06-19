
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox'; // Assuming Combobox is used for branch/region
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import pb from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Search as SearchIconLucide, University, Briefcase, Percent as PercentIcon, MapPin, Filter, ChevronRight } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AppConfig, escapeForPbFilter, Routes } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { CollegeDetailsProtectedRoute } from '@/components/auth/CollegeDetailsProtectedRoute';
import type { RecordModel } from 'pocketbase';
import Link from 'next/link';

// Define Zod schema for the search form
const CollegeSearchSchema = z.object({
  examName: z.string().min(1, "Target exam is required."),
  percentile: z.coerce.number({ invalid_type_error: "Percentile must be a number." })
    .min(0, "Percentile must be between 0 and 100.")
    .max(100, "Percentile must be between 0 and 100."),
  category: z.string().min(1, "Category is required."),
  branch: z.string().min(1, "Branch is required.").max(100),
  region: z.string().optional(), // Preferred region/district
  academicYear: z.coerce.number().int().min(2000).max(new Date().getFullYear() + 1, `Year cannot be beyond ${new Date().getFullYear() + 1}`),
});
type CollegeSearchInput = z.infer<typeof CollegeSearchSchema>;

interface CollegeCutoffRecord extends RecordModel {
  college_name: string;
  college_code?: string;
  type?: string; // Government, Private etc.
  location?: string; // City/District
  exam_name?: string;
  academic_year?: number;
  cutoffs?: Array<{ // This is a JSON field in PocketBase, so it will be stringified
    course_name: string; // e.g., Computer Engineering
    stages?: Array<{
      stage_name: string; // e.g., CAP Round 1
      categories?: Array<{
        category_name: string; // e.g., GOPENH, LOBCH
        cutoff_type?: 'Percentile' | 'Rank' | 'Score';
        cutoff_value: number | string;
        seat_type_details?: string;
      }>;
    }>;
  }>;
  website?: string;
}

const currentYear = new Date().getFullYear();
const academicYearOptions = Array.from({ length: 10 }, (_, i) => ({ value: String(currentYear - i), label: String(currentYear - i) }));

// Helper function to map common category inputs to PocketBase values
const mapCategoryToPbValues = (formCategory: string): string[] => {
    const lowerFormCategory = formCategory.toLowerCase();
    if (lowerFormCategory.includes('open')) return ['open', 'gopen', 'gopenh', 'gopens', 'gopeno', 'ai']; // General Open Home/Other/State, All India
    if (lowerFormCategory.includes('obc')) return ['obc', 'gobch', 'gobcs', 'gobco', 'lobch', 'lobcs', 'lobco'];
    if (lowerFormCategory.includes('sc')) return ['sc', 'gsch', 'gscs', 'gsco', 'lsch', 'lscs', 'lsco'];
    if (lowerFormCategory.includes('st')) return ['st', 'gsth', 'gsts', 'gsto', 'lsth', 'lsts', 'lsto'];
    if (lowerFormCategory.includes('vj') || lowerFormCategory.includes('vjnt') || lowerFormCategory.includes('nt1') || lowerFormCategory.includes('nt-a')) return ['vj', 'gvjh', 'gvjs', 'gvjo', 'nt1', 'nt(a)'];
    if (lowerFormCategory.includes('nt2') || lowerFormCategory.includes('nt-b')) return ['nt2', 'nt(b)', 'gnt2h', 'gnt2s', 'gnt2o'];
    if (lowerFormCategory.includes('nt3') || lowerFormCategory.includes('nt-c')) return ['nt3', 'nt(c)', 'gnt3h', 'gnt3s', 'gnt3o'];
    if (lowerFormCategory.includes('nt4') || lowerFormCategory.includes('nt-d')) return ['nt4', 'nt(d)', 'gnt4h', 'gnt4s', 'gnt4o']; // Assuming nt4 is nt(d)
    if (lowerFormCategory.includes('ews')) return ['ews', 'tfws']; // TFWS is often related/similar benefits
    if (lowerFormCategory.includes('pwd') || lowerFormCategory.includes('ph')) return ['pwd', 'ph', 'def']; // PWD, Physically Handicapped, Defence
    return [lowerFormCategory]; // Default to the direct input
};


export default function CollegeSearchPage() {
  const { collegeUser, isLoadingCollegeUser } = useAuth();
  const { toast } = useToast();
  const [searchResults, setSearchResults] = useState<CollegeCutoffRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchPerformed, setSearchPerformed] = useState(false);

  const [examOptions, setExamOptions] = useState<{ value: string; label: string }[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<{ value: string; label: string }[]>([]);
  const [branchOptions, setBranchOptions] = useState<{ value: string; label: string }[]>([]);
  const [regionOptions, setRegionOptions] = useState<{ value: string; label: string }[]>([]);
  const [isLoadingDropdownData, setIsLoadingDropdownData] = useState(true);

  const form = useForm<CollegeSearchInput>({
    resolver: zodResolver(CollegeSearchSchema),
    defaultValues: { academicYear: currentYear, examName: undefined, percentile: undefined, category: undefined, branch: undefined, region: '' },
  });

  const fetchDropdownData = useCallback(async (isMountedGetter: () => boolean) => {
    if (!isMountedGetter()) return;
    setIsLoadingDropdownData(true);
    try {
      const records = await pb.collection('college_cutoffs').getFullList<CollegeCutoffRecord>({
        fields: 'exam_name,cutoffs,location', // Fetch minimal fields for dropdowns
      });
      if (!isMountedGetter()) return;

      const distinctExams = new Set<string>();
      const distinctCategories = new Set<string>();
      const distinctBranches = new Set<string>();
      const distinctRegions = new Set<string>();

      records.forEach(college => {
        if (college.exam_name) distinctExams.add(college.exam_name);
        if (college.location) distinctRegions.add(college.location);
        if (college.cutoffs && Array.isArray(college.cutoffs)) {
          college.cutoffs.forEach(course => {
            if (course.course_name) distinctBranches.add(course.course_name);
            course.stages?.forEach(stage => {
              stage.categories?.forEach(cat => {
                if (cat.category_name) distinctCategories.add(cat.category_name);
              });
            });
          });
        }
      });
      if(isMountedGetter()){
        setExamOptions(Array.from(distinctExams).sort().map(e => ({ value: e, label: e })));
        setCategoryOptions(Array.from(distinctCategories).sort().map(c => ({ value: c, label: c })));
        setBranchOptions(Array.from(distinctBranches).sort().map(b => ({ value: b, label: b })));
        setRegionOptions(Array.from(distinctRegions).sort().map(r => ({ value: r, label: r })));
      }
    } catch (err) {
      if(isMountedGetter()) console.error("Failed to fetch dropdown data for college search:", err);
    } finally {
      if(isMountedGetter()) setIsLoadingDropdownData(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchDropdownData(() => isMounted);
    return () => { isMounted = false; };
  }, [fetchDropdownData]);

  const onSubmit = async (values: CollegeSearchInput) => {
    setIsLoading(true); setError(null); setSearchResults([]); setSearchPerformed(true);

    try {
      const filterParts = [
        `exam_name = "${escapeForPbFilter(values.examName)}"`,
        `academic_year = ${values.academicYear}`,
      ];
      if (values.region && values.region.trim() !== '') {
        filterParts.push(`location ~ "${escapeForPbFilter(values.region.trim())}"`);
      }
      const filterString = filterParts.join(' && ');
      console.log("College Search: Fetching colleges with filter:", filterString);

      const collegesFromDb = await pb.collection('college_cutoffs').getFullList<CollegeCutoffRecord>({
        filter: filterString,
      });

      console.log(`College Search: Fetched ${collegesFromDb.length} colleges from DB matching exam & year.`);
      
      const userCategoryOptions = mapCategoryToPbValues(values.category);

      const matchedColleges = collegesFromDb.filter(college => {
        if (!college.cutoffs || !Array.isArray(college.cutoffs)) return false;
        return college.cutoffs.some(course => {
          if (course.course_name?.toLowerCase().includes(values.branch.toLowerCase())) {
            return course.stages?.some(stage => 
              stage.categories?.some(categoryCutoff => {
                const categoryNameLower = categoryCutoff.category_name?.toLowerCase();
                if (categoryNameLower && userCategoryOptions.includes(categoryNameLower)) {
                  if (categoryCutoff.cutoff_type?.toLowerCase() === 'percentile') {
                    const cutoffVal = Number(categoryCutoff.cutoff_value);
                    return !isNaN(cutoffVal) && values.percentile >= cutoffVal;
                  }
                }
                return false;
              }) ?? false
            ) ?? false;
          }
          return false;
        });
      }).map(college => { // Refine the displayed cutoffs for matched colleges
        return {
          ...college,
          cutoffs: college.cutoffs?.filter(course => course.course_name?.toLowerCase().includes(values.branch.toLowerCase()))
            .map(course => ({
                ...course,
                stages: course.stages?.map(stage => ({
                    ...stage,
                    categories: stage.categories?.filter(cat => {
                        const catNameLower = cat.category_name?.toLowerCase();
                        return catNameLower && userCategoryOptions.includes(catNameLower) &&
                               cat.cutoff_type?.toLowerCase() === 'percentile' &&
                               Number(cat.cutoff_value) <= values.percentile;
                    })
                })).filter(stage => stage.categories && stage.categories.length > 0)
            })).filter(course => course.stages && course.stages.length > 0)
        };
      }).filter(college => college.cutoffs && college.cutoffs.length > 0); // Only include colleges with matching branches after filtering stages/categories


      console.log(`College Search: Found ${matchedColleges.length} matched colleges after client-side filtering.`);
      setSearchResults(matchedColleges);
      if (matchedColleges.length === 0) {
        toast({ title: "No Colleges Found", description: "No colleges match your criteria based on the available data. Try adjusting filters or check available data." });
      }

    } catch (error: any) {
      console.error("College search error:", error);
      let errorMsg = "An error occurred while searching for colleges.";
      if (error.data?.message) errorMsg = error.data.message;
      else if (error.message) errorMsg = error.message;
      setError(errorMsg);
      toast({ title: "Search Error", description: errorMsg, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingCollegeUser || isLoadingDropdownData) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Card className="shadow-lg"><CardHeader><Skeleton className="h-10 w-3/4" /></CardHeader><CardContent className="grid md:grid-cols-2 gap-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></CardContent><CardFooter><Skeleton className="h-10 w-32" /></CardFooter></Card>
      </div>
    );
  }

  return (
    <CollegeDetailsProtectedRoute>
      <div className="space-y-8">
        <Card className="shadow-xl border-t-4 border-primary">
          <CardHeader>
            <div className="flex items-center gap-3">
              <University className="h-8 w-8 text-primary" />
              <div>
                <CardTitle className="text-2xl md:text-3xl font-bold text-foreground">College Search & Predictor</CardTitle>
                <CardDescription className="text-md text-muted-foreground">Find colleges based on your exam performance and preferences.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  <FormField control={form.control} name="examName" render={({ field }) => (<FormItem><FormLabel>Target Exam *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Exam" /></SelectTrigger></FormControl><SelectContent>{examOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                  <FormField control={form.control} name="percentile" render={({ field }) => (<FormItem><FormLabel>Your Percentile *</FormLabel><FormControl><Input type="number" step="0.000001" placeholder="e.g., 95.123456" {...field}/></FormControl><FormMessage /></FormItem>)}/>
                  <FormField control={form.control} name="category" render={({ field }) => (<FormItem><FormLabel>Your Category *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger></FormControl><SelectContent>{categoryOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                  <FormField control={form.control} name="branch" render={({ field }) => (<FormItem><FormLabel>Preferred Branch *</FormLabel><Combobox options={branchOptions} value={field.value || ''} onChange={field.onChange} placeholder="Select or type Branch" inputPlaceholder="Search Branch..."/><FormMessage /></FormItem>)}/>
                  <FormField control={form.control} name="region" render={({ field }) => (<FormItem><FormLabel>Preferred Region/District (Optional)</FormLabel><Combobox options={regionOptions} value={field.value || ''} onChange={field.onChange} placeholder="Any Region" inputPlaceholder="Search Region..."/><FormMessage /></FormItem>)}/>
                  <FormField control={form.control} name="academicYear" render={({ field }) => (<FormItem><FormLabel>Cutoff Academic Year *</FormLabel><Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}><FormControl><SelectTrigger><SelectValue placeholder="Select Year" /></SelectTrigger></FormControl><SelectContent>{academicYearOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                </div>
                <Button type="submit" className="w-full md:w-auto" disabled={isLoading}>
                  {isLoading ? <Skeleton className="h-5 w-20" /> : <><SearchIconLucide className="mr-2 h-5 w-5"/>Search Colleges</>}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {searchPerformed && !isLoading && (
          <section className="mt-10">
            <h2 className="text-xl font-bold text-foreground mb-4">Search Results ({searchResults.length})</h2>
            {error && <p className="text-destructive text-center mb-4">{error}</p>}
            {searchResults.length > 0 ? (
              <ScrollArea className="max-h-[600px] pr-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {searchResults.map((college) => (
                    <Card key={college.id} className="bg-card border text-card-foreground shadow-md hover:shadow-cyan-500/10 transition-shadow">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg text-primary flex items-center gap-2"><University className="h-5 w-5"/>{college.college_name}</CardTitle>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                          {college.college_code && <span>Code: {college.college_code}</span>}
                          {college.location && <span><MapPin className="inline h-3 w-3 mr-0.5"/>{college.location}</span>}
                          {college.type && <span>Type: {college.type}</span>}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <h4 className="text-sm font-semibold text-foreground mb-1.5 mt-2 flex items-center gap-1.5"><Briefcase className="h-4 w-4"/>Matching Cutoffs:</h4>
                        {college.cutoffs && college.cutoffs.length > 0 ? (
                          <ul className="space-y-1.5 pl-2 text-xs">
                            {college.cutoffs.map((course, idx) => (
                              <li key={idx} className="border-l-2 border-primary/30 pl-2 py-1 bg-muted/30 rounded-r-md">
                                <strong className="text-foreground">{course.course_name}:</strong>
                                {course.stages?.map((stage, sIdx) => (
                                  <div key={sIdx} className="pl-2">
                                    {stage.categories?.map((cat, cIdx) => (
                                      <span key={cIdx} className="block text-muted-foreground">
                                        <Badge variant="secondary" className="bg-primary/10 text-primary/90 border-primary/30 px-1.5 py-0.5 mr-1">{cat.category_name}</Badge> 
                                        Cutoff: <Badge variant="outline" className="px-1.5 py-0.5">{cat.cutoff_value}</Badge>
                                      </span>
                                    ))}
                                  </div>
                                ))}
                              </li>
                            ))}
                          </ul>
                        ) : <p className="text-xs text-muted-foreground italic">No specific cutoffs matched your criteria within this college's branches.</p>}
                      </CardContent>
                      {college.website && <CardFooter className="pt-2"><Button variant="link" asChild className="text-primary hover:text-primary/80 p-0 h-auto text-xs"><a href={college.website} target="_blank" rel="noopener noreferrer">Visit Website <ChevronRight className="h-3 w-3 ml-1"/></a></Button></CardFooter>}
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              !error && <p className="text-muted-foreground text-center">No colleges found matching your search criteria.</p>
            )}
          </section>
        )}
      </div>
    </CollegeDetailsProtectedRoute>
  );
}

