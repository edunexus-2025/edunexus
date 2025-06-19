
'use client';

import { useState, useCallback, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import pb from '@/lib/pocketbase';
import type { RecordModel, ClientResponseError } from 'pocketbase';
import { UploadCloud, Loader2, AlertTriangle, FileSpreadsheet, CheckCircle, ListChecks, Info, FileText, FileUp } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';

// This structure matches the NEW FLAT schema for `college_cutoffs`
interface ProcessedCollegeDataFlat {
  college_code: string;
  college_name: string;
  college_district?: string;
  college_url?: string;
  college_status?: string;
  cutoff_year: number;
  exam_context?: string;
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

const EXPECTED_CATEGORY_COLUMNS_ORDER: Array<keyof ProcessedCollegeDataFlat> = [
  "GOPENS", "GSCS", "GSTS", "GNT1S", "GNT2S", "GNT3S", "GOBCS", "GSEBCS",
  "LOPENS", "LSCS", "LSTS", "LVJS", "LNT1S", "LNT2S", "LNT3S", "LOBCS", "LSEBCS",
  "PWDOPENS", "PWDOBCS", "PWDSCS", "PWDSTS", "PWDVJS", "PWDNT1S", "PWDNT2S", "PWDNT3S", "PWDSEBCS",
  "DEFOPENS", "DEFSCS", "DEFSTS", "DEFVJS", "DEFNT1S", "DEFNT2S", "DEFNT3S", "DEFOBCS", "DEFSEBCS",
  "TFWS", "EWS", "GVJS", "ORPHANS", "MI"
];


export default function UploadCollegeCutoffsPage() {
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
  const [academicYear, setAcademicYear] = useState<string>(String(new Date().getFullYear()));
  const [collegeStatusInput, setCollegeStatusInput] = useState<string>('');
  const [examContextInput, setExamContextInput] = useState<string>('');

  const [processedData, setProcessedData] = useState<ProcessedCollegeDataFlat[]>([]);
  const [isProcessingPdfBackend, setIsProcessingPdfBackend] = useState(false);
  const [backendProcessingProgress, setBackendProcessingProgress] = useState(0);
  const [isSavingToDb, setIsSavingToDb] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveCounts, setSaveCounts] = useState({ created: 0, updated: 0, failed: 0, skipped: 0 });

  const { toast } = useToast();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setSelectedPdfFile(file);
      setError(null);
      setProcessedData([]); // Clear previous processed data
    } else {
      setSelectedPdfFile(null);
      setError("Please select a valid PDF file.");
      toast({ title: "Invalid File", description: "Please select a PDF file.", variant: "destructive" });
    }
  };

  const handleUploadAndProcessPdf = async () => {
    if (!selectedPdfFile) {
      setError('Please select a PDF file to upload.');
      return;
    }
    const currentAcademicYearNum = parseInt(academicYear, 10);
    if (isNaN(currentAcademicYearNum) || currentAcademicYearNum < 1900 || currentAcademicYearNum > 2100) {
      setError('Please enter a valid Academic Year (e.g., 2024).');
      return;
    }
    if (!examContextInput.trim()) {
      setError('Please enter the Exam Name/Context for this data batch.');
      return;
    }

    setIsProcessingPdfBackend(true);
    setBackendProcessingProgress(0);
    setError(null);
    setProcessedData([]);

    const formData = new FormData();
    formData.append('pdfFile', selectedPdfFile);
    formData.append('academicYear', academicYear);
    formData.append('collegeStatus', collegeStatusInput.trim());
    formData.append('examContext', examContextInput.trim());

    // Simulate upload progress
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += 10;
      if (progress <= 100) {
        setBackendProcessingProgress(progress);
      } else {
        clearInterval(progressInterval);
      }
    }, 200);

    try {
      // **HYPOTHETICAL BACKEND CALL**
      // Replace this with your actual fetch call to the backend API endpoint
      // const response = await fetch('/api/admin/process-cutoff-pdf', {
      //   method: 'POST',
      //   body: formData,
      // });
      // clearInterval(progressInterval); // Stop simulation
      // setBackendProcessingProgress(100);

      // if (!response.ok) {
      //   const errorData = await response.json().catch(() => ({ message: "Failed to process PDF on the server." }));
      //   throw new Error(errorData.message || `Server error: ${response.status}`);
      // }
      // const dataFromServer: { colleges: ProcessedCollegeDataFlat[], skipped: number } = await response.json();
      // setProcessedData(dataFromServer.colleges || []);
      // setSaveCounts(prev => ({ ...prev, skipped: dataFromServer.skipped || 0 }));
      // if (dataFromServer.colleges && dataFromServer.colleges.length > 0) {
      //   toast({ title: "PDF Processed", description: `${dataFromServer.colleges.length} college entries parsed. ${dataFromServer.skipped || 0} rows skipped by backend.` });
      // } else {
      //   setError("Backend processed the PDF but returned no valid college data rows. Check PDF content and backend parser.");
      // }

      // --- MOCK RESPONSE (REMOVE THIS WHEN YOU HAVE A BACKEND) ---
      await new Promise(resolve => setTimeout(resolve, 2500)); // Simulate delay
      clearInterval(progressInterval);
      setBackendProcessingProgress(100);
      const mockCollegeData: ProcessedCollegeDataFlat = {
        college_code: "C012345", college_name: "Mock Engineering College from PDF", college_district: "Mockville",
        cutoff_year: currentAcademicYearNum, exam_context: examContextInput.trim(), college_status: collegeStatusInput.trim() || undefined,
        GOPENS: 95.5, GSCS: 88.2, TFWS: 98.1, // Example data
      };
      const mockSkipped = 1;
      setProcessedData([mockCollegeData, {...mockCollegeData, college_code: "C012346", college_name: "Another Mock College"}]);
      setSaveCounts(prev => ({...prev, skipped: mockSkipped}));
      toast({title: "PDF Processed (Mocked)", description: `2 college entries parsed (mock). ${mockSkipped} rows skipped.`});
      // --- END MOCK RESPONSE ---

    } catch (e: any) {
      clearInterval(progressInterval);
      setBackendProcessingProgress(0);
      setError(`Error processing PDF: ${e.message}`);
      toast({ title: "PDF Processing Error", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessingPdfBackend(false);
    }
  };


  const saveToPocketBase = async () => {
    if (processedData.length === 0) {
      toast({ title: "No Data", description: "No data processed to save.", variant: "default" });
      return;
    }
    setIsSavingToDb(true);
    setSaveProgress(0);
    let localSaveCounts = { created: 0, updated: 0, failed: 0, skipped: saveCounts.skipped };

    for (let i = 0; i < processedData.length; i++) {
      const college = processedData[i];
      const dataForPocketBase: Record<string, any> = {};
      for (const key in college) {
        if (college[key as keyof ProcessedCollegeDataFlat] !== undefined) {
          dataForPocketBase[key] = college[key as keyof ProcessedCollegeDataFlat];
        }
      }
      
      try {
        const filter = `college_code = "${college.college_code}" && cutoff_year = ${college.cutoff_year} && exam_context = "${college.exam_context || ''}"`;
        const existing = await pb.collection('college_cutoffs').getFullList<RecordModel>({ filter });

        if (existing.length > 0) {
          await pb.collection('college_cutoffs').update(existing[0].id, dataForPocketBase);
          localSaveCounts.updated++;
        } else {
          await pb.collection('college_cutoffs').create(dataForPocketBase);
          localSaveCounts.created++;
        }
      } catch (e: any) {
        localSaveCounts.failed++;
        console.error(`Failed to save/update college ${college.college_name} (${college.college_code}). Data:`, dataForPocketBase, "Error:", e.data || e);
      }
      setSaveProgress(((i + 1) / processedData.length) * 100);
      setSaveCounts({...localSaveCounts});
    }

    setIsSavingToDb(false);
    toast({
      title: "Database Sync Complete",
      description: `${localSaveCounts.created} created, ${localSaveCounts.updated} updated, ${localSaveCounts.failed} failed. Original PDF rows skipped: ${localSaveCounts.skipped}.`,
      duration: localSaveCounts.failed > 0 ? 9000 : 5000,
      variant: localSaveCounts.failed > 0 ? "destructive" : "default",
    });
  };

  return (
    <div className="space-y-8 p-4 md:p-6">
      <Card className="shadow-xl border-t-4 border-primary">
        <CardHeader>
          <div className="flex items-center gap-3">
            <FileUp className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl font-bold text-foreground">Upload College Cutoffs PDF</CardTitle>
              <CardDescription className="text-muted-foreground">
                Upload a PDF file containing college cutoff data. The backend will process it.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-1">
              <Label htmlFor="academic-year" className="block mb-1.5 text-sm font-medium">Academic Year *</Label>
              <Input id="academic-year" type="number" placeholder="e.g., 2024" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className="bg-card border-border"/>
            </div>
            <div className="md:col-span-1">
              <Label htmlFor="exam-context" className="block mb-1.5 text-sm font-medium">Exam Name/Context *</Label>
              <Input id="exam-context" type="text" placeholder="e.g., MHT-CET Engineering 2024 CAP1" value={examContextInput} onChange={(e) => setExamContextInput(e.target.value)} className="bg-card border-border"/>
            </div>
            <div className="md:col-span-1">
              <Label htmlFor="college-status" className="block mb-1.5 text-sm font-medium">College Status/Type (Optional)</Label>
              <Input id="college-status" type="text" placeholder="e.g., Government Aided" value={collegeStatusInput} onChange={(e) => setCollegeStatusInput(e.target.value)} className="bg-card border-border"/>
            </div>
          </div>

          <div>
            <Label htmlFor="pdf-file-input" className="block mb-1.5 text-sm font-medium">Select PDF File *</Label>
            <Input
              id="pdf-file-input"
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="bg-card border-border file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
            />
            {selectedPdfFile && <p className="text-xs text-muted-foreground mt-1">Selected: {selectedPdfFile.name}</p>}
          </div>

          <Button onClick={handleUploadAndProcessPdf} disabled={!selectedPdfFile || !academicYear.trim() || !examContextInput.trim() || isProcessingPdfBackend} className="w-full md:w-auto">
            {isProcessingPdfBackend ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
            {isProcessingPdfBackend ? `Processing PDF... (${backendProcessingProgress.toFixed(0)}%)` : 'Upload & Process PDF'}
          </Button>
          {isProcessingPdfBackend && (
            <Progress value={backendProcessingProgress} className="w-full h-2 mt-2" />
          )}

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <CardTitle>Error</CardTitle>
              <AlertDescription className="whitespace-pre-wrap">{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {processedData.length > 0 && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2"><ListChecks className="text-primary"/>Processed Data Preview ({processedData.length} Colleges)</CardTitle>
            <CardDescription>Review the structured data (from backend) before saving. Showing first 5 entries.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-72 border rounded-md p-3 bg-muted/30">
              <pre className="text-xs whitespace-pre-wrap">
                {JSON.stringify(processedData.slice(0, 5).map(p => ({...p, college_status: p.college_status || 'N/A', exam_context: p.exam_context || 'N/A'})), null, 2)}
                {processedData.length > 5 && `\n\n... (and ${processedData.length - 5} more entries)`}
              </pre>
            </ScrollArea>
            <Button onClick={saveToPocketBase} disabled={isSavingToDb} className="w-full mt-4">
              {isSavingToDb ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              {isSavingToDb ? `Saving... (${saveProgress.toFixed(0)}%)` : `Save ${processedData.length} Colleges to Database`}
            </Button>
            {isSavingToDb && (
              <div className="mt-2">
                <Progress value={saveProgress} className="w-full h-2" />
                <p className="text-xs text-muted-foreground text-center mt-1">
                  Created: {saveCounts.created}, Updated: {saveCounts.updated}, Failed: {saveCounts.failed}, PDF rows skipped by backend: {saveCounts.skipped}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
       <Card className="bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700 mt-6">
        <CardHeader><CardTitle className="text-blue-700 dark:text-blue-300 text-md flex items-center gap-2"><Info className="h-5 w-5"/> Important Instructions for PDF Upload</CardTitle></CardHeader>
        <CardContent className="text-xs text-blue-600 dark:text-blue-200 space-y-1">
            <p>1. Ensure your PDF contains selectable text, not just images of text. Scanned PDFs might not work.</p>
            <p>2. The backend parser will attempt to extract tabular data. Complex layouts might cause issues.</p>
            <p>3. **Backend Implementation Needed:** The actual PDF parsing and data extraction logic must be implemented in a backend API endpoint (e.g., `/api/admin/process-cutoff-pdf`). This frontend page only handles the file upload and displays data returned by that API.</p>
            <p>4. The backend should be designed to return data matching the 'flat' structure of your `college_cutoffs` PocketBase collection (i.e., separate columns for GOPENS, GSCS, etc.).</p>
            <p>5. **Context Fields:** Academic Year, Exam Context, and College Status from the form will be sent to the backend along with the PDF. The backend should use the Academic Year for the `cutoff_year` field and College Status for `college_status` field for each processed record.</p>
        </CardContent>
      </Card>
    </div>
  );
}

