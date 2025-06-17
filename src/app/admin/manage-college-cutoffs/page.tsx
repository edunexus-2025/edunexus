'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Routes } from "@/lib/constants";
import { Database, AlertTriangle, Construction } from "lucide-react";

export default function ManageCollegeCutoffsPage() {
  return (
    <div className="space-y-8 p-4 md:p-6">
      <Card className="shadow-xl border-t-4 border-primary">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Database className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl md:text-3xl font-bold text-foreground">
                Manage College Cut-offs
              </CardTitle>
              <CardDescription className="text-md text-muted-foreground">
                View, upload, and manage college cut-off data for various exams.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-center p-10">
          <Construction className="mx-auto h-16 w-16 text-amber-500 mb-4" />
          <h3 className="text-xl font-semibold text-amber-600">Page Under Construction</h3>
          <p className="text-muted-foreground mt-2">
            This section is being developed. Soon you'll be able to manage all college cut-off data from here.
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            In the meantime, you can view publicly available cut-off data (if imported) at:
            <Button variant="link" asChild className="px-1">
              <Link href={Routes.collegeCutoffs}>
                Public College Cut-offs Page
              </Link>
            </Button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
