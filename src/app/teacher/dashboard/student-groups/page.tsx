
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import Image from 'next/image';
import { Users2 } from "lucide-react";

export default function StudentGroupsPage() {
  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Users2 className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-3xl font-bold text-foreground">Manage Student Groups</CardTitle>
              <CardDescription>
                Organize your students into groups for discussions, targeted assignments, and communication.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center text-center p-10 border-2 border-dashed rounded-lg">
            <Image 
              src="https://placehold.co/300x200.png" 
              alt="Student Groups Coming Soon" 
              width={300} 
              height={200} 
              className="mb-4 rounded-md" 
              data-ai-hint="people group collaboration"
            />
            <p className="text-xl font-semibold text-muted-foreground">Feature Coming Soon!</p>
            <p className="text-sm text-muted-foreground">
              You'll be able to create, edit, and manage student groups for various purposes here.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
