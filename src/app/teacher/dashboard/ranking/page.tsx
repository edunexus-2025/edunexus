
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Award } from "lucide-react";
import Image from 'next/image';

export default function TeacherRankingPage() {
  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Award className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-3xl font-bold text-foreground">Teacher Ranking</CardTitle>
              <CardDescription>
                View your ranking and performance among other educators on the platform.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center text-center p-10 border-2 border-dashed rounded-lg">
            <Image 
              src="https://placehold.co/300x200.png" 
              alt="Teacher Ranking Coming Soon" 
              width={300} 
              height={200} 
              className="mb-4 rounded-md"
              data-ai-hint="leaderboard trophy chart"
            />
            <p className="text-xl font-semibold text-muted-foreground">Feature Coming Soon!</p>
            <p className="text-sm text-muted-foreground">
              The teacher ranking system is currently under development. Check back later!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
