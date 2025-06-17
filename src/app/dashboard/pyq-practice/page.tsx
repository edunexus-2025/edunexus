
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import Image from 'next/image';
import { Grid, BookOpen, Edit } from 'lucide-react'; // Using Grid for PYQ Practice
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// --- PYQ DPPs Section Content (from former pyq-dpps/page.tsx) ---
interface PyqExam {
  id: string;
  name: string;
  iconUrl: string;
  dataAiHint: string;
}

interface PyqCategory {
  categoryName: string;
  exams: PyqExam[];
}

const jeeIconUrl = 'https://i.filecdn.in/755esias/image-1718508545561.png';
const medicalInstituteIconUrl = 'https://upload.wikimedia.org/wikipedia/en/thumb/8/85/All_India_Institute_of_Medical_Sciences%2C_Delhi.svg/1200px-All_India_Institute_of_Medical_Sciences%2C_Delhi.svg.png';
const mhtCetIconUrl = 'https://upload.wikimedia.org/wikipedia/en/6/60/MHT-CET_logo.png';
const ndaIconUrl = 'https://upload.wikimedia.org/wikipedia/commons/6/6e/National_Defence_Academy_NDA.png';
const kcetIconUrl = 'https://education.indianexpress.com/storage/images/kcet-exam_1686728759.jpg';

const pyqData: PyqCategory[] = [
  {
    categoryName: 'Engineering',
    exams: [
      { id: 'jee-main', name: 'JEE Main', iconUrl: jeeIconUrl, dataAiHint: 'engineering exam' },
      { id: 'jee-advanced', name: 'JEE Advanced', iconUrl: jeeIconUrl, dataAiHint: 'engineering exam' },
      { id: 'nda', name: 'NDA', iconUrl: ndaIconUrl, dataAiHint: 'defense exam' },
      { id: 'mht-cet-eng', name: 'MHT CET', iconUrl: mhtCetIconUrl, dataAiHint: 'state engineering' },
      { id: 'kcet', name: 'KCET', iconUrl: kcetIconUrl, dataAiHint: 'karnataka exam' },
    ],
  },
  {
    categoryName: 'Medical',
    exams: [
      { id: 'neet', name: 'NEET', iconUrl: jeeIconUrl, dataAiHint: 'medical exam' },
      { id: 'aiims-ug', name: 'AIIMS', iconUrl: medicalInstituteIconUrl, dataAiHint: 'medical institute' },
      { id: 'jipmer-ug', name: 'JIPMER', iconUrl: medicalInstituteIconUrl, dataAiHint: 'medical college' },
      { id: 'mht-cet-med', name: 'MHT CET', iconUrl: mhtCetIconUrl, dataAiHint: 'state medical' },
    ],
  },
];

function PyqDppsSection() {
  return (
    <section className="space-y-10 py-6">
      {pyqData.map(category => (
        <div key={category.categoryName}>
          <h2 className="text-2xl font-semibold mb-6 text-accent border-b pb-2">
            {category.categoryName} PYQ DPPs
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
            {category.exams.map(exam => (
              <Card 
                key={exam.id} 
                className="bg-card rounded-xl shadow-md hover:shadow-xl transition-all duration-300 ease-in-out transform hover:-translate-y-1 cursor-pointer group"
              >
                <CardContent className="flex flex-col items-center justify-center p-4 text-center space-y-2 h-full aspect-[5/4]">
                  <div className="relative w-12 h-12 sm:w-14 sm:h-14 mb-2 transition-transform duration-300 group-hover:scale-110">
                    <Image
                      src={exam.iconUrl}
                      alt={`${exam.name} logo`}
                      fill
                      className="rounded-lg object-contain"
                      data-ai-hint={exam.dataAiHint}
                    />
                  </div>
                  <p className="font-semibold text-sm md:text-base text-foreground leading-snug">{exam.name}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
// --- End PYQ DPPs Section Content ---


// --- PYQ Mock Tests Section Content (from former pyq-mock-tests/page.tsx) ---
function PyqMockTestsSection() {
  return (
    <section className="py-6">
      <h2 className="text-2xl font-semibold mb-6 text-accent border-b pb-2">
        PYQ Mock Tests
      </h2>
      <div className="flex flex-col items-center justify-center text-center p-10 border-2 border-dashed rounded-lg bg-card">
        <Image src="https://placehold.co/300x200.png" alt="PYQ Mock Tests Coming Soon" width={300} height={200} className="mb-4 rounded-md" data-ai-hint="exam paper"/>
        <p className="text-xl font-semibold text-muted-foreground">Content Coming Soon!</p>
        <p className="text-sm text-muted-foreground">Get ready for authentic PYQ-based mock tests.</p>
      </div>
    </section>
  );
}
// --- End PYQ Mock Tests Section Content ---


export default function PyqPracticePage() {
  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Grid className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-3xl font-bold text-foreground">PYQ Practice Center</CardTitle>
              <CardDescription>
                Sharpen your skills with Daily Practice Problems (DPPs) and full Mock Tests based on Previous Year Questions.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="pyq-dpps" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pyq-dpps">PYQ DPPs</TabsTrigger>
          <TabsTrigger value="pyq-mock-tests">PYQ Mock Tests</TabsTrigger>
        </TabsList>
        <TabsContent value="pyq-dpps" className="mt-6">
          <PyqDppsSection />
        </TabsContent>
        <TabsContent value="pyq-mock-tests" className="mt-6">
          <PyqMockTestsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
