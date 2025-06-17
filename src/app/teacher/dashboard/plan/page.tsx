
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { DollarSign } from "lucide-react";
import Image from 'next/image';

export default function TeacherPlanPage() {
  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-3xl font-bold text-foreground">Your Teacher Plan</CardTitle>
              <CardDescription>
                View details about your current subscription plan and available upgrade options.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center text-center p-10 border-2 border-dashed rounded-lg">
            <Image 
              src="https://placehold.co/300x200.png" 
              alt="Teacher Plan Details Coming Soon" 
              width={300} 
              height={200} 
              className="mb-4 rounded-md"
              data-ai-hint="subscription price tag"
            />
            <p className="text-xl font-semibold text-muted-foreground">Feature Coming Soon!</p>
            <p className="text-sm text-muted-foreground">
              Detailed plan information and management options will be available here soon.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
