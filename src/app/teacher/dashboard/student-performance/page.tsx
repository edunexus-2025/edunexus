
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import Image from 'next/image';

export default function TeacherStudentPerformancePage() {
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-foreground">Student Performance</CardTitle>
          <CardDescription>
            Track the progress and performance of your students.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center text-center p-10 border-2 border-dashed rounded-lg">
             <Image 
              src="https://placehold.co/300x200.png" 
              alt="Student Performance Coming Soon" 
              width={300} 
              height={200} 
              className="mb-4 rounded-md" 
              data-ai-hint="analytics chart graph"
            />
            <p className="text-xl font-semibold text-muted-foreground">Feature Coming Soon!</p>
            <p className="text-sm text-muted-foreground">Student performance tracking tools are under development.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
