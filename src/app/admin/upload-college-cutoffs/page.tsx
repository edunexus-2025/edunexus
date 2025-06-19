
'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea'; // Changed from Input
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import pb from '@/lib/pocketbase';
import type { RecordModel, ClientResponseError } from 'pocketbase';
import { UploadCloud, Loader2, AlertTriangle, FileSpreadsheet, CheckCircle, ListChecks, Info, FileText } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input'; // For Academic Year and College Type

// This structure matches the NEW FLAT schema for `college_cutoffs`
interface ProcessedCollegeDataFlat {
  college_code: string;
  college_name: string;
  college_district?: string;
  college_url?: string;
  college_status?: string;
  cutoff_year: number;
  exam_context?: string; // Added for context, from form input
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

// Define the expected order of columns in the PDF text if no headers are found or to validate headers.
// This MUST match the order of data columns in the PDF after College Code, Name, District, URL.
// The keys here should match the PocketBase schema field names (case-sensitive).
const EXPECTED_CATEGORY_COLUMNS_ORDER: Array<keyof ProcessedCollegeDataFlat> = [
  "GOPENS", "GSCS", "GSTS", "GNT1S", "GNT2S", "GNT3S", "GOBCS", "GSEBCS",
  "LOPENS", "LSCS", "LSTS", "LVJS", "LNT1S", "LNT2S", "LNT3S", "LOBCS", "LSEBCS",
  "PWDOPENS", "PWDOBCS", "PWDSCS", "PWDSTS", "PWDVJS", "PWDNT1S", "PWDNT2S", "PWDNT3S", "PWDSEBCS",
  "DEFOPENS", "DEFSCS", "DEFSTS", "DEFVJS", "DEFNT1S", "DEFNT2S", "DEFNT3S", "DEFOBCS", "DEFSEBCS",
  "TFWS", "EWS", "GVJS", "ORPHANS", "MI"
];

const EXPECTED_HEADER_MAPPING: Record<string, keyof ProcessedCollegeDataFlat> = {
    // PDF Header (lowercase) : PocketBase Field Name
    'college code': 'college_code',
    'college name': 'college_name',
    'district': 'college_district', // Assuming PDF has 'District'
    'website': 'college_url',       // Assuming PDF has 'Website' or similar
    // Add mappings for all your category columns as they appear in the PDF header
    // Example:
    'gopens': 'GOPENS',
    'gscs': 'GSCS',
    'gsts': 'GSTS',
    // ... and so on for ALL category columns in EXPECTED_CATEGORY_COLUMNS_ORDER
};
// Populate the rest of EXPECTED_HEADER_MAPPING based on your PDF's actual headers
EXPECTED_CATEGORY_COLUMNS_ORDER.forEach(colKey => {
    if (typeof colKey === 'string' && !EXPECTED_HEADER_MAPPING[colKey.toLowerCase()]) {
        EXPECTED_HEADER_MAPPING[colKey.toLowerCase()] = colKey;
    }
});


export default function UploadCollegeCutoffsPage() {
  const [pastedText, setPastedText] = useState<string>('');
  const [academicYear, setAcademicYear] = useState<string>(String(new Date().getFullYear()));
  const [collegeStatusInput, setCollegeStatusInput] = useState<string>('');
  const [examContextInput, setExamContextInput] = useState<string>(''); // New input for exam context

  const [processedData, setProcessedData] = useState<ProcessedCollegeDataFlat[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isSavingToDb, setIsSavingToDb] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveCounts, setSaveCounts] = useState({ created: 0, updated: 0, failed: 0, skipped: 0 });

  const { toast } = useToast();

  const parsePastedText = useCallback(() => {
    if (!pastedText.trim()) {
      setError('Please paste text from the PDF.');
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

    setIsProcessingFile(true); setError(null); setProcessedData([]);
    let localSkipped = 0; const tempProcessedData: ProcessedCollegeDataFlat[] = [];

    const lines = pastedText.trim().split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) {
      setError("Pasted text is empty or contains only whitespace.");
      setIsProcessingFile(false); return;
    }

    // Very basic header detection (can be improved if PDF format is known)
    const firstLineValues = lines[0].split(/\s{2,}|\t/); // Split by multiple spaces or tab
    let hasHeaders = false;
    let headerMap: Record<string, number> = {}; // maps PDF header to column index
    let dataStartIndex = 0;

    // Attempt to map known headers if they exist
    if (firstLineValues.some(val => EXPECTED_HEADER_MAPPING[val.toLowerCase().trim()])) {
        hasHeaders = true;
        dataStartIndex = 1;
        firstLineValues.forEach((header, index) => {
            const normalizedHeader = header.toLowerCase().trim();
            if (EXPECTED_HEADER_MAPPING[normalizedHeader]) {
                headerMap[EXPECTED_HEADER_MAPPING[normalizedHeader]] = index;
            } else if (EXPECTED_CATEGORY_COLUMNS_ORDER.includes(normalizedHeader.toUpperCase() as any)) {
                // If PDF header directly matches a PB schema category field name
                headerMap[normalizedHeader.toUpperCase()] = index;
            }
        });
        console.log("Detected headers and created map:", headerMap);
    } else {
        console.warn("No reliable headers detected in the first line. Will attempt positional parsing. Ensure pasted text matches expected column order.");
    }


    for (let i = dataStartIndex; i < lines.length; i++) {
      const line = lines[i];
      const values = line.split(/\s{2,}|\t/).map(v => v.trim()); // Split by 2+ spaces or tab

      const collegeData: ProcessedCollegeDataFlat = {
        cutoff_year: currentAcademicYearNum,
        college_status: collegeStatusInput.trim() || undefined,
        exam_context: examContextInput.trim(),
        college_code: '', // placeholder
        college_name: '', // placeholder
      };

      if (hasHeaders) {
        collegeData.college_code = values[headerMap['college_code']] || '';
        collegeData.college_name = values[headerMap['college_name']] || '';
        collegeData.college_district = values[headerMap['college_district']] || undefined;
        collegeData.college_url = values[headerMap['college_url']] || undefined;

        EXPECTED_CATEGORY_COLUMNS_ORDER.forEach(catKey => {
          const colIdx = headerMap[catKey as string];
          if (colIdx !== undefined && values[colIdx]) {
            const val = parseFloat(values[colIdx]);
            collegeData[catKey] = isNaN(val) ? null : val;
          } else {
            collegeData[catKey] = null;
          }
        });
      } else {
        // Positional - This is brittle and assumes a strict order:
        // Code, Name, District, URL, then all category columns in EXPECTED_CATEGORY_COLUMNS_ORDER
        let currentValIdx = 0;
        collegeData.college_code = values[currentValIdx++] || '';
        collegeData.college_name = values[currentValIdx++] || '';
        collegeData.college_district = values[currentValIdx++] || undefined;
        collegeData.college_url = values[currentValIdx++] || undefined;
        EXPECTED_CATEGORY_COLUMNS_ORDER.forEach(catKey => {
          if (values[currentValIdx]) {
            const val = parseFloat(values[currentValIdx]);
            collegeData[catKey] = isNaN(val) ? null : val;
          } else {
            collegeData[catKey] = null;
          }
          currentValIdx++;
        });
      }
      
      if (!collegeData.college_code || !collegeData.college_name) {
        console.warn(`Skipping line ${i + 1}: Missing College Code or Name. Parsed:`, values);
        localSkipped++;
        continue;
      }
      tempProcessedData.push(collegeData);
    }

    setProcessedData(tempProcessedData);
    setSaveCounts(prev => ({ ...prev, skipped: localSkipped }));
    if (tempProcessedData.length > 0) {
        toast({ title: "Processing Complete", description: `${tempProcessedData.length} college entries parsed. ${localSkipped} rows skipped.` });
    } else if (lines.length > dataStartIndex) {
        setError(`No valid college data rows could be parsed. Found ${lines.length - dataStartIndex} potential data lines. Please check the format of your pasted text and ensure it matches expected columns (Code, Name, District, URL, ${EXPECTED_CATEGORY_COLUMNS_ORDER.slice(0,2).join(', ')}... etc.).`);
    } else if (lines.length <= dataStartIndex && lines.length > 0) {
        setError("No data rows found after the header (or first line if no headers detected). Please ensure data is present.");
    } else {
        setError("No data parsed. The input text might be empty or incorrectly formatted.");
    }
    setIsProcessingFile(false);
  }, [pastedText, academicYear, collegeStatusInput, examContextInput, toast]);

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
      // Ensure only defined fields are sent to PocketBase
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
      description: `${localSaveCounts.created} created, ${localSaveCounts.updated} updated, ${localSaveCounts.failed} failed. Original Excel rows skipped: ${localSaveCounts.skipped}.`,
      duration: localSaveCounts.failed > 0 ? 9000 : 5000,
      variant: localSaveCounts.failed > 0 ? "destructive" : "default",
    });
  };

  return (
    <div className="space-y-8 p-4 md:p-6">
      <Card className="shadow-xl border-t-4 border-primary">
        <CardHeader>
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl font-bold text-foreground">Upload College Cutoffs (from PDF Text)</CardTitle>
              <CardDescription className="text-muted-foreground">
                Paste text copied from a PDF. Ensure columns include College Code, Name, District, URL (optional), and then category-wise cutoffs.
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
              <Input id="exam-context" type="text" placeholder="e.g., MHT-CET Engineering" value={examContextInput} onChange={(e) => setExamContextInput(e.target.value)} className="bg-card border-border"/>
            </div>
            <div className="md:col-span-1">
              <Label htmlFor="college-status" className="block mb-1.5 text-sm font-medium">College Status/Type (Optional)</Label>
              <Input id="college-status" type="text" placeholder="e.g., Government Aided" value={collegeStatusInput} onChange={(e) => setCollegeStatusInput(e.target.value)} className="bg-card border-border"/>
            </div>
          </div>

          <div>
            <Label htmlFor="pdf-text-area" className="block mb-1.5 text-sm font-medium">Paste Text from PDF *</Label>
            <Textarea
              id="pdf-text-area"
              placeholder="Paste your copied table data here. Ensure the first line contains headers like 'College Code', 'College Name', 'District', 'GOPENS', 'GSCS', etc., OR paste only data rows in the correct order."
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              rows={15}
              className="font-mono text-xs bg-card border-border"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Tip: Try to ensure columns are separated by tabs or multiple spaces when copying from PDF.
              The system will attempt to parse headers; if not found, a fixed column order is assumed (Code, Name, District, URL, then all categories in order).
            </p>
          </div>

          <Button onClick={parsePastedText} disabled={!pastedText.trim() || !academicYear.trim() || !examContextInput.trim() || isProcessingFile} className="w-full md:w-auto">
            {isProcessingFile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
            {isProcessingFile ? 'Processing Text...' : 'Process Pasted Text'}
          </Button>

          {error && (
            <Alert variant="destructive">
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
            <CardDescription>Review the structured data before saving. Showing first 5 entries.</CardDescription>
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
                  Created: {saveCounts.created}, Updated: {saveCounts.updated}, Failed: {saveCounts.failed}, PDF rows skipped: {saveCounts.skipped}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      <Card className="bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700 mt-6">
        <CardHeader><CardTitle className="text-blue-700 dark:text-blue-300 text-md flex items-center gap-2"><Info className="h-5 w-5"/> Important Instructions for PDF Text Upload</CardTitle></CardHeader>
        <CardContent className="text-xs text-blue-600 dark:text-blue-200 space-y-1">
            <p>1. Copy data from your PDF. Try to select only the table content.</p>
            <p>2. **Header Row (Recommended):** Ensure the first line of your pasted text contains column headers. Match these headers (case-insensitive) as closely as possible to the PocketBase field names (e.g., `college_code`, `GOPENS`, `LSCS`, `TFWS`). The system will try to map them.</p>
            <p>3. **No Headers (Positional):** If headers are not detected, the system will assume a fixed column order: College Code, College Name, District, URL (optional, leave blank if N/A), then ALL category columns in this exact order: {EXPECTED_CATEGORY_COLUMNS_ORDER.join(', ')}.</p>
            <p>4. **Data Format:** Cutoff values should be numbers. Missing values (e.g., "--", "N/A", or empty) will be stored as null.</p>
            <p>5. **Context Fields:** Academic Year and Exam Context apply to ALL rows in the pasted text. College Status/Type is also applied to all rows if provided.</p>
            <p>6. **Review Preview:** After processing, check the preview carefully before saving to the database.</p>
        </CardContent>
      </Card>
    </div>
  );
}

