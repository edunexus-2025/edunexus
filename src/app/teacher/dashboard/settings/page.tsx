
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import Image from 'next/image';

export default function TeacherSettingsPage() {
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-foreground">Teacher Settings</CardTitle>
          <CardDescription>
            Manage your teacher profile, account settings, and preferences.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center text-center p-10 border-2 border-dashed rounded-lg">
            <Image 
              src="https://placehold.co/300x200.png" 
              alt="Teacher Settings Coming Soon" 
              width={300} 
              height={200} 
              className="mb-4 rounded-md" 
              data-ai-hint="gear settings cog"
            />
            <p className="text-xl font-semibold text-muted-foreground">Feature Coming Soon!</p>
            <p className="text-sm text-muted-foreground">Detailed settings for teachers will be available here.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
