
// This page is effectively replaced by /dashboard/connections
// You can redirect users from here or update sidebar links.
// For now, leaving a simple placeholder.
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import { Routes } from "@/lib/constants";
import { Link2 } from "lucide-react";

export default function FollowingPage() {
  return (
    <div className="space-y-8 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-foreground">Following</CardTitle>
          <CardDescription>
            This page has been moved. Please see your connections.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Link2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg text-muted-foreground mb-4">
            Your 'Following' and 'Followers' lists are now combined on the Connections page.
          </p>
          <Button asChild>
            <Link href={Routes.connections}>
              Go to Connections
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
