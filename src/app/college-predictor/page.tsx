
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
import { AppConfig, escapeForPbFilter, Routes } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';

// Matches NEW FLAT schema
interface CollegeCutoffFlatRecord extends RecordModel {
  id: string;
  college_code: string;
  college_name: string;
  college_district?: string;
  college_url?: string;
  college_status?: string;
  cutoff_year: number;
  exam_context?: string; // Added field
  GOPENS?: number | null; GSCS?: number | null; GSTS?: number | null; GNT1S?: number | null;
  GNT2S?: number | null; GNT3S?: number | null; GOBCS?: number | null; GSEBCS?: number | null;
  LOPENS?: number | null; LSCS?: number | null; LSTS?: number | null; LVJS?: number | null; LNT1S?: number | null;
  LNT2S?: number | null; LNT3S?: number | null; LOBCS?: number | null; LSEBCS?: number | null;
  PWDOPENS?: number | null; PWDOBCS?: number | null; PWDSCS?: number | null; PWDSTS?: number | null;
  PWDVJS?: number | null; PWDNT1S?: number | null; PWDNT2S?: number | null; PWDNT3S?: number | null;
  PWDSEBCS?: number | null; DEFOPENS?: number | null; DEFSCS?: number | null; DEFSTS?: number | null;
  DEFVJS?: number | null; DEFNT1S?: number | null; DEFNT2S?: number | null; DEFNT3S?: number | null;
  DEFOBCS?: number | null; DEFSEBCS?: number | null; TFWS?: number | null; EWS?: number | null;
  GVJS?: number | null; ORPHANS?: number | null; MI?: number | null;
  [key: string]: any; // For dynamic access
}

const CollegePredictorFormSchemaNew = z.object({
  scoreType: z.enum(['MHT CET', 'JEE MAINS', 'OTHER_EXAM'], { required_error: "Exam type is required." }), // Updated
  percentile: z.coerce.number({ invalid_type_error: "Percentile must be a number."})
    .min(0, "Percentile must be 0-100.")
    .max(100, "Percentile must be 0-100."),
  category: z.enum(['OPEN', 'OBC', 'SC', 'ST', 'EWS', 'VJNT', 'SBC', 'TFWS', 'DEFENCE', 'PWD', 'ORPHAN', 'MINORITY', 'OTHER'], { required_error: "Category is required." }), // Expanded categories
  gender: z.enum(['Male', 'Female', 'Other'], { required_error: "Gender is required." }), // Added Other
  region: z.string().max(100).optional().nullable(), // District/Region
  class12District: z.string().min(1, "12th District is required.").max(100),
  academicYear: z.coerce.number().int().min(2000).max(new Date().getFullYear() + 2),
});
type CollegePredictorFormInputNew = z.infer<typeof CollegePredictorFormSchemaNew>;

const currentYear = new Date().getFullYear();
const academicYearOptions = Array.from({ length: 10 }, (_, i) => ({ value: String(currentYear - i), label: String(currentYear - i) }));

// Mapping from form category and gender to PocketBase column names
const categoryColumnMapping: Record<string, Partial<Record<'Male' | 'Female' | 'Other' | 'Any', (keyof CollegeCutoffFlatRecord)[]>>> = {
  'OPEN': { 'Any': ['GOPENS', 'LOPENS', 'ORPHANS', 'MI'] }, // MI is often Minority Institute Open
  'OBC': { 'Any': ['GOBCS', 'LOBCS', 'PWDOBCS', 'DEFOBCS'] },
  'SC': { 'Any': ['GSCS', 'LSCS', 'PWDSCS', 'DEFSCS'] },
  'ST': { 'Any': ['GSTS', 'LSTS', 'PWDSTS', 'DEFSTS'] },
  'EWS': { 'Any': ['EWS'] },
  'VJNT': { 'Any': ['GVJS', 'LVJS', 'GNT1S', 'LNT1S', 'GNT2S', 'LNT2S', 'GNT3S', 'LNT3S', 'PWDVJS', 'PWDNT1S', 'PWDNT2S', 'PWDNT3S', 'DEFVJS', 'DEFNT1S', 'DEFNT2S', 'DEFNT3S'] },
  'SBC': { 'Any': ['GSEBCS', 'LSEBCS', 'PWDSEBCS', 'DEFSEBCS'] }, // Assuming SEBC maps here
  'TFWS': { 'Any': ['TFWS'] },
  'DEFENCE': { 'Any': ['DEFOPENS', 'DEFSCS', 'DEFSTS', 'DEFVJS', 'DEFNT1S', 'DEFNT2S', 'DEFNT3S', 'DEFOBCS', 'DEFSEBCS'] },
  'PWD': { 'Any': ['PWDOPENS', 'PWDOBCS', 'PWDSCS', 'PWDSTS', 'PWDVJS', 'PWDNT1S', 'PWDNT2S', 'PWDNT3S', 'PWDSEBCS'] },
  'ORPHAN': { 'Any': ['ORPHANS'] },
  'MINORITY': { 'Any': ['MI']},
  'OTHER': { 'Any': [] }, // Fallback for other, maybe no specific column
};


export default function CollegePredictorPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [predictedColleges, setPredictedColleges] = useState<CollegeCutoffFlatRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchPerformed, setSearchPerformed] = useState(false);

  const [examContextOptions, setExamContextOptions] = useState<{value: string, label: string}[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<{ value: string; label: string }[]>([]);
  const [regionOptions, setRegionOptions] = useState<{ value: string; label: string }[]>([]);
  const [isLoadingDropdownData, setIsLoadingDropdownData] = useState(true);

  const form = useForm<CollegePredictorFormInputNew>({
    resolver: zodResolver(CollegePredictorFormSchemaNew),
    defaultValues: { academicYear: currentYear, scoreType: undefined, category: undefined, gender: undefined, region: '', class12District: '', percentile: undefined },
  });

  const fetchDropdownData = useCallback(async (isMountedGetter: () => boolean) => {
    if (!isMountedGetter()) return;
    setIsLoadingDropdownData(true);
    try {
      const records = await pb.collection('college_cutoffs').getFullList<CollegeCutoffFlatRecord>({
        fields: 'exam_context,college_district', // Fetch exam_context and college_district
      });
      if (!isMountedGetter()) return;

      const distinctExams = new Set<string>();
      const distinctRegions = new Set<string>();
      records.forEach(college => {
        if (college.exam_context) distinctExams.add(college.exam_context);
        if (college.college_district) distinctRegions.add(college.college_district);
      });
      
      const predefinedCategories = Object.keys(categoryColumnMapping);

      if(isMountedGetter()){
        setExamContextOptions(Array.from(distinctExams).sort().map(e => ({ value: e, label: e })));
        setCategoryOptions(predefinedCategories.map(c => ({ value: c, label: c })));
        setRegionOptions(Array.from(distinctRegions).sort().map(r => ({ value: r, label: r })));
      }
    } catch (err) {
      if(isMountedGetter()) console.error("Failed to fetch dropdown data for college predictor:", err);
    } finally {
      if(isMountedGetter()) setIsLoadingDropdownData(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchDropdownData(() => isMounted);
    return () => { isMounted = false; };
  }, [fetchDropdownData]);


  const onSubmit = async (values: CollegePredictorFormInputNew) => {
    setIsLoading(true); setError(null); setPredictedColleges([]); setSearchPerformed(true);

    try {
      const filterParts = [
        `cutoff_year = ${values.academicYear}`,
        `exam_context = "${escapeForPbFilter(values.scoreType)}"`, // Filter by exam_context
      ];
      if (values.region && values.region.trim() !== '') {
        filterParts.push(`college_district ~ "${escapeForPbFilter(values.region.trim())}"`);
      }
      const filterString = filterParts.join(' && ');
      console.log("College Predictor: Fetching colleges with filter:", filterString);

      const collegesFromDb = await pb.collection('college_cutoffs').getFullList<CollegeCutoffFlatRecord>({
        filter: filterString,
      });
      console.log(`College Predictor: Fetched ${collegesFromDb.length} colleges from DB.`);
      
      const relevantCategoryColumns = categoryColumnMapping[values.category]?.[values.gender] || categoryColumnMapping[values.category]?.['Any'] || [];
      if (relevantCategoryColumns.length === 0) {
        console.warn(`No category columns mapped for category: ${values.category}, gender: ${values.gender}`);
      }

      const matchedColleges = collegesFromDb.filter(college => {
        for (const colKey of relevantCategoryColumns) {
          const cutoffVal = college[colKey];
          if (typeof cutoffVal === 'number' && values.percentile >= cutoffVal) {
            return true; // Match found for this college
          }
        }
        return false; // No matching category cutoff found for this college
      });

      console.log(`College Predictor: Found ${matchedColleges.length} matched colleges after client-side filtering.`);
      setPredictedColleges(matchedColleges);
      if (matchedColleges.length === 0) {
        toast({ title: "No Colleges Found", description: "No colleges match your criteria based on the available data. Try adjusting filters." });
      }
      
      // Save student query
      await pb.collection('college_list_checher').create({
        student: user?.id || null,
        Score_Type: values.scoreType,
        enter_percentile: values.percentile,
        category: values.category,
        Gender: values.gender,
        Branch: "N/A_General", // Branch removed from input, placeholder value
        Region: values.region || "N/A",
        Class_12th_District: values.class12District,
        academic_year_preference: values.academicYear,
      });

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
            <CardTitle className="text-3xl font-bold text-cyan-300">{AppConfig.appName} College Predictor</CardTitle>
            <CardDescription className="text-slate-400">Enter your details to find suitable colleges.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <div className="grid md:grid-cols-2 gap-5">
                  <FormField control={form.control} name="scoreType" render={({ field }) => (<FormItem><FormLabel>Exam Type *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="bg-slate-700 border-slate-600 text-slate-50"><SelectValue placeholder="Select Exam Type" /></SelectTrigger></FormControl><SelectContent className="bg-slate-700 border-slate-600 text-slate-50">{examContextOptions.map(opt => <SelectItem key={opt.value} value={opt.value} className="hover:bg-slate-600 focus:bg-slate-600">{opt.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                  <FormField control={form.control} name="percentile" render={({ field }) => (<FormItem><FormLabel>Your Percentile *</FormLabel><FormControl><Input type="number" step="0.000001" placeholder="e.g., 95.1234567" {...field} className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"/></FormControl><FormMessage /></FormItem>)}/>
                  <FormField control={form.control} name="category" render={({ field }) => (<FormItem><FormLabel>Your Category *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="bg-slate-700 border-slate-600 text-slate-50"><SelectValue placeholder="Select Category" /></SelectTrigger></FormControl><SelectContent className="bg-slate-700 border-slate-600 text-slate-50">{categoryOptions.map(opt => <SelectItem key={opt.value} value={opt.value} className="hover:bg-slate-600 focus:bg-slate-600">{opt.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                  <FormField control={form.control} name="gender" render={({ field }) => (<FormItem><FormLabel>Gender *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="bg-slate-700 border-slate-600 text-slate-50"><SelectValue placeholder="Select Gender" /></SelectTrigger></FormControl><SelectContent className="bg-slate-700 border-slate-600 text-slate-50">{['Male', 'Female', 'Other'].map(gen => <SelectItem key={gen} value={gen} className="hover:bg-slate-600 focus:bg-slate-600">{gen}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                  <FormField control={form.control} name="region" render={({ field }) => (<FormItem><FormLabel>Preferred Region/District (Optional)</FormLabel><FormControl><Combobox options={regionOptions} value={field.value || ''} onChange={field.onChange} placeholder="Any Region" inputPlaceholder="Search Region..." className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500" /></FormControl><FormMessage /></FormItem>)}/>
                  <FormField control={form.control} name="class12District" render={({ field }) => (<FormItem><FormLabel>Class 12th District *</FormLabel><FormControl><Input placeholder="e.g., Pune" {...field} className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"/></FormControl><FormMessage /></FormItem>)}/>
                  <FormField control={form.control} name="academicYear" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Academic Year for Cutoffs *</FormLabel><Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}><FormControl><SelectTrigger className="bg-slate-700 border-slate-600 text-slate-50"><SelectValue placeholder="Select Year" /></SelectTrigger></FormControl><SelectContent className="bg-slate-700 border-slate-600 text-slate-50">{academicYearOptions.map(opt => <SelectItem key={opt.value} value={opt.value} className="hover:bg-slate-600 focus:bg-slate-600">{opt.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
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
                  {predictedColleges.map((college) => {
                     const matchingCutoffValues: string[] = [];
                     const relevantCategoryColumns = categoryColumnMapping[form.getValues('category')]?.[form.getValues('gender')] || categoryColumnMapping[form.getValues('category')]?.['Any'] || [];
                     relevantCategoryColumns.forEach(colKey => {
                        const val = college[colKey];
                        if (typeof val === 'number' && form.getValues('percentile') >= val) {
                            matchingCutoffValues.push(`${colKey}: ${val.toFixed(4)}`);
                        }
                     });

                    return (
                    <Card key={college.id} className="bg-slate-800/70 border-slate-700 text-slate-200 shadow-md hover:shadow-cyan-500/20 transition-shadow">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg text-cyan-400 flex items-center gap-2"><University className="h-5 w-5"/>{college.college_name}</CardTitle>
                        <div className="text-xs text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
                            {college.college_code && <span>Code: {college.college_code}</span>}
                            {college.college_district && <span><MapPin className="inline h-3 w-3 mr-0.5"/>{college.college_district}</span>}
                            {college.college_status && <span>Type: {college.college_status}</span>}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <h4 className="text-sm font-semibold text-cyan-300 mb-1.5 mt-2 flex items-center gap-1.5"><Briefcase className="h-4 w-4"/>Your Matching Cutoffs:</h4>
                        {matchingCutoffValues.length > 0 ? (
                           <ul className="space-y-1 pl-2 text-xs">
                            {matchingCutoffValues.map((cv, idx) => (
                                <li key={idx} className="text-slate-400">
                                    <Badge variant="secondary" className="bg-cyan-400/10 text-cyan-300 border-cyan-400/30 px-1.5 py-0.5">{cv}</Badge>
                                </li>
                            ))}
                           </ul>
                        ) : <p className="text-xs text-slate-500 italic">No specific matching category cutoff displayed, but college may still be suitable based on general criteria.</p>}
                      </CardContent>
                      {college.college_url && <CardFooter className="pt-2"><Button variant="link" asChild className="text-cyan-400 hover:text-cyan-300 p-0 h-auto text-xs"><a href={college.college_url} target="_blank" rel="noopener noreferrer">Visit Website <ChevronRight className="h-3 w-3 ml-1"/></a></Button></CardFooter>}
                    </Card>
                  );
                 })}
                </div>
              </ScrollArea>
            ) : (
              !error && <p className="text-slate-400 text-center">No colleges found matching your search criteria. Please try adjusting your inputs.</p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

