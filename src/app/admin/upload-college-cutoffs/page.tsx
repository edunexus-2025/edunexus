
'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import pb from '@/lib/pocketbase';
import type { RecordModel, ClientResponseError } from 'pocketbase';
import * as XLSX from 'xlsx';
import { UploadCloud, Loader2, AlertTriangle, FileSpreadsheet, CheckCircle, ListChecks } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ParsedRow {
  college_code: string;
  college_name: string;
  exam_name: string; 
  location: string;  
  branch: string;    
  percentile: number | string; 
}

interface ProcessedCollegeData {
  college_code: string;
  college_name: string;
  exam_name: string;
  location: string;
  academic_year?: number; // Make academic_year optional here if it can be invalid from input
  type?: string; 
  cutoffs: Array<{
    course_name: string;
    stages: Array<{
      stage_name: string;
      categories: Array<{
        category_name: string;
        cutoff_type: string;
        cutoff_value: number | string;
        seat_type_details?: string;
      }>;
    }>;
  }>;
  fees?: any;
}

const EXPECTED_HEADERS = ['code', 'college name', 'score type', 'region', 'branch', 'percentile'];

export default function UploadCollegeCutoffsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [academicYear, setAcademicYear] = useState<string>(String(new Date().getFullYear()));
  const [collegeType, setCollegeType] = useState<string>('');
  const [processedData, setProcessedData] = useState<ProcessedCollegeData[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isSavingToDb, setIsSavingToDb] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveCounts, setSaveCounts] = useState({ created: 0, updated: 0, failed: 0, skipped: 0 });
  const [fileName, setFileName] = useState<string>('');

  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setProcessedData([]);
      setError(null);
      setSaveProgress(0);
      setSaveCounts({ created: 0, updated: 0, failed: 0, skipped: 0 });
    }
  };

  const processExcelFile = useCallback(async () => {
    if (!file) {
      setError('Please select an Excel file.');
      return;
    }
    const currentAcademicYearNum = parseInt(academicYear, 10);
    if (isNaN(currentAcademicYearNum) || currentAcademicYearNum < 1900 || currentAcademicYearNum > 2100) {
        setError('Please enter a valid Academic Year (e.g., 2024).');
        return;
    }

    setIsProcessingFile(true);
    setError(null);
    setProcessedData([]);
    let skippedRowCount = 0;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false }) as any[][];

        if (jsonData.length < 2) {
          throw new Error('Excel sheet is empty or has no data rows.');
        }

        const headerRow = jsonData[0].map(String).map(h => h.toLowerCase().trim());
        const missingHeaders = EXPECTED_HEADERS.filter(eh => !headerRow.includes(eh));
        if (missingHeaders.length > 0) {
            throw new Error(`Missing expected column headers: ${missingHeaders.join(', ')}. Ensure your Excel file has columns: ${EXPECTED_HEADERS.join(', ')} (case-insensitive).`);
        }
        
        const colMap: Record<string, number> = {};
        EXPECTED_HEADERS.forEach(eh => {
            const index = headerRow.findIndex(h => h === eh);
            if (index !== -1) colMap[eh] = index;
        });

        const parsedRows: ParsedRow[] = jsonData.slice(1).map((row, rowIndex) => {
          if (row.every(cell => cell === null || cell === undefined || String(cell).trim() === '')) {
             return null; 
          }
          const collegeCode = String(row[colMap['code']] || '').trim();
          const collegeName = String(row[colMap['college name']] || '').trim();

          if (!collegeCode || !collegeName) {
            console.warn(`Skipping row ${rowIndex + 2}: Missing College Code or College Name.`);
            skippedRowCount++;
            return null;
          }

          const percentileValue = row[colMap['percentile']];
          return {
            college_code: collegeCode,
            college_name: collegeName,
            exam_name: String(row[colMap['score type']] || '').trim(),
            location: String(row[colMap['region']] || '').trim(),
            branch: String(row[colMap['branch']] || '').trim(),
            percentile: typeof percentileValue === 'number' ? percentileValue : String(percentileValue || '0').trim(),
          };
        }).filter(row => row !== null) as ParsedRow[];


        const groupedData = new Map<string, ProcessedCollegeData>();

        parsedRows.forEach(row => {
          const key = `${row.college_code}-${row.exam_name}-${currentAcademicYearNum}`;
          let collegeEntry = groupedData.get(key);

          if (!collegeEntry) {
            collegeEntry = {
              college_code: row.college_code,
              college_name: row.college_name,
              exam_name: row.exam_name,
              location: row.location,
              academic_year: currentAcademicYearNum, // Store as number
              type: collegeType.trim() || undefined, 
              cutoffs: [],
              fees: {}, 
            };
            groupedData.set(key, collegeEntry);
          }
          
          if (row.college_name && collegeEntry.college_name !== row.college_name) {
            console.warn(`Inconsistent college name for code ${row.college_code}: "${collegeEntry.college_name}" vs "${row.college_name}". Using first encountered: "${collegeEntry.college_name}".`);
          }
          if (row.location && collegeEntry.location !== row.location) {
             console.warn(`Inconsistent location for code ${row.college_code}: "${collegeEntry.location}" vs "${row.location}". Using first encountered: "${collegeEntry.location}".`);
          }

          if (row.branch) { 
              const existingCourseIndex = collegeEntry.cutoffs.findIndex(c => c.course_name === row.branch);
              const percentileVal = typeof row.percentile === 'string' ? parseFloat(row.percentile) : row.percentile;

              const newCategory = {
                category_name: "General Open", 
                cutoff_type: "Percentile",     
                cutoff_value: isNaN(percentileVal) ? String(row.percentile) : percentileVal, 
                seat_type_details: "State Level" 
              };
              
              const newStage = {
                  stage_name: "Main Round", 
                  categories: [newCategory]
              };

              if (existingCourseIndex > -1) {
                  collegeEntry.cutoffs[existingCourseIndex].stages.push(newStage);
              } else {
                  collegeEntry.cutoffs.push({
                      course_name: row.branch,
                      stages: [newStage]
                  });
              }
          }
        });
        setProcessedData(Array.from(groupedData.values()));
        setSaveCounts(prev => ({ ...prev, skipped: skippedRowCount }));
        toast({ title: "Processing Complete", description: `${parsedRows.length} valid rows processed into ${groupedData.size} college entries. ${skippedRowCount} rows skipped.` });
      } catch (e: any) {
        console.error("Error processing Excel file:", e);
        setError(`Error processing file: ${e.message}`);
        toast({ title: "File Processing Error", description: e.message, variant: "destructive" });
      } finally {
        setIsProcessingFile(false);
      }
    };
    reader.readAsBinaryString(file);
  }, [file, academicYear, collegeType, toast]);

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
      const dataForPocketBase: Record<string, any> = {
        college_code: college.college_code,
        college_name: college.college_name,
        exam_name: college.exam_name,
        location: college.location,
        cutoffs: JSON.stringify(college.cutoffs),
        fees: JSON.stringify(college.fees || {}), // Ensure fees is stringified, defaults to {}
      };

      if (college.academic_year !== undefined && !isNaN(college.academic_year)) {
        dataForPocketBase.academic_year = college.academic_year;
      }
      if (college.type && college.type.trim() !== '') {
        dataForPocketBase.type = college.type.trim();
      }
      
      console.log(`Attempting to save/update: ${college.college_name} (${college.college_code}). Payload:`, JSON.stringify(dataForPocketBase));

      try {
        // Construct filter more carefully, especially for academic_year if it might be undefined
        let filter = `college_code = "${college.college_code}" && exam_name = "${college.exam_name}"`;
        if (college.academic_year !== undefined && !isNaN(college.academic_year)) {
            filter += ` && academic_year = ${college.academic_year}`;
        } else {
            // If academic_year is not valid, this record likely shouldn't be saved or needs special handling
            // For now, we'll assume it might exist without an academic year if the schema allows
            // However, your schema seems to expect academic_year if it's to be unique with other fields
            // This might be a source of error if academic_year is missing but relied upon for uniqueness
            console.warn(`College ${college.college_name} missing valid academic_year for DB lookup.`);
        }
        
        const existing = await pb.collection('college_cutoffs').getFullList<RecordModel>({ filter });

        if (existing.length > 0) {
          await pb.collection('college_cutoffs').update(existing[0].id, dataForPocketBase);
          localSaveCounts.updated++;
        } else {
          await pb.collection('college_cutoffs').create(dataForPocketBase);
          localSaveCounts.created++;
        }
      } catch (e: any) {
        let errorMessage = `Failed to save/update college ${college.college_name} (${college.college_code}). `;
        
        if (e instanceof Error && 'isAbort' in e && (e as any).isAbort) { 
            errorMessage += 'Request was aborted. ';
        } else if (e && typeof e === 'object') {
            const clientError = e as ClientResponseError;
            errorMessage += `Status: ${clientError.status || 'N/A'}. `;
            if (clientError.data && typeof clientError.data === 'object') {
                errorMessage += `Response: ${JSON.stringify(clientError.data)}. `;
                if (clientError.data.data && typeof clientError.data.data === 'object') { 
                    const fieldErrors = Object.entries(clientError.data.data as Record<string, {message: string}>)
                        .map(([key, val]) => `${key}: ${val.message}`)
                        .join('; ');
                    if (fieldErrors) errorMessage += `Field Errors: ${fieldErrors}. `;
                }
            } else if (clientError.message) {
                errorMessage += `Message: ${clientError.message}. `;
            }
        } else if (e instanceof Error) {
            errorMessage += `Name: ${e.name}, Message: ${e.message}. `;
        } else {
            errorMessage += `Error Details: ${String(e)}. `;
        }
        
        console.error(errorMessage, "Full error object:", e);
        localSaveCounts.failed++;
      }
      setSaveProgress(((i + 1) / processedData.length) * 100);
      setSaveCounts({...localSaveCounts});
    }

    setIsSavingToDb(false);
    toast({
      title: "Database Sync Complete",
      description: `${localSaveCounts.created} created, ${localSaveCounts.updated} updated, ${localSaveCounts.failed} failed, ${localSaveCounts.skipped} skipped from Excel.`,
      duration: localSaveCounts.failed > 0 ? 9000 : 5000,
      variant: localSaveCounts.failed > 0 ? "destructive" : "default",
    });
  };

  return (
    <div className="space-y-8 p-4 md:p-6">
      <Card className="shadow-xl border-t-4 border-primary">
        <CardHeader>
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl font-bold text-foreground">Upload College Cutoffs (Excel)</CardTitle>
              <CardDescription className="text-muted-foreground">
                Upload an Excel (.xlsx) file with college cutoff data.
                Expected columns: Code, College Name, Score Type, Region, Branch, Percentile.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-1">
              <Label htmlFor="excel-file" className="block mb-1.5 text-sm font-medium">Select Excel File (.xlsx)</Label>
              <Input id="excel-file" type="file" accept=".xlsx" onChange={handleFileChange} className="bg-card border-border"/>
              {fileName && <p className="text-xs text-muted-foreground mt-1">Selected: {fileName}</p>}
            </div>
            <div className="md:col-span-1">
              <Label htmlFor="academic-year" className="block mb-1.5 text-sm font-medium">Academic Year *</Label>
              <Input
                id="academic-year"
                type="number"
                placeholder="e.g., 2024"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="bg-card border-border"
              />
            </div>
             <div className="md:col-span-1">
              <Label htmlFor="college-type" className="block mb-1.5 text-sm font-medium">College Type (Optional)</Label>
              <Input
                id="college-type"
                type="text"
                placeholder="e.g., Government Aided"
                value={collegeType}
                onChange={(e) => setCollegeType(e.target.value)}
                className="bg-card border-border"
              />
              <p className="text-xs text-muted-foreground mt-1">This type will be applied to all colleges in this upload if provided.</p>
            </div>
          </div>

          <Button onClick={processExcelFile} disabled={!file || !academicYear.trim() || isProcessingFile} className="w-full md:w-auto">
            {isProcessingFile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
            {isProcessingFile ? 'Processing...' : 'Process Excel File'}
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
            <CardDescription>Review the structured data before saving to the database.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-72 border rounded-md p-3 bg-muted/30">
              <pre className="text-xs whitespace-pre-wrap">
                {JSON.stringify(processedData.slice(0, 5), null, 2)} 
                {processedData.length > 5 && "\n\n... (and " + (processedData.length - 5) + " more entries)"}
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
                  Created: {saveCounts.created}, Updated: {saveCounts.updated}, Failed: {saveCounts.failed}, Skipped from Excel: {saveCounts.skipped}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

