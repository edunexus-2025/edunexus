
import type { TestSeries } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HelpCircle, Clock, CheckSquare, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Routes } from '@/lib/constants';

interface TestSeriesCardProps {
  testSeries: TestSeries;
}

export function TestSeriesCard({ testSeries }: TestSeriesCardProps) {
  const isFree = testSeries.accessType === 'Free';
  const accessTagLabel = isFree ? 'Free' : 'Premium';
  const accessTagClass = isFree 
    ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-800/30 dark:text-green-300 dark:border-green-700' 
    : 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-800/30 dark:text-blue-300 dark:border-blue-700';

  return (
    <Card className="flex flex-col overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 ease-in-out transform hover:-translate-y-1.5 h-full border border-border/50 hover:border-primary/30 group bg-card">
      <CardHeader className="p-4 space-y-2">
        <div className="flex justify-between items-center">
          <Badge variant="outline" className="text-xs py-1 px-2.5 border-primary/30 text-primary font-medium group-hover:bg-primary/10 group-hover:text-primary transition-colors">
            {testSeries.subject}
          </Badge>
          <Badge variant="default" className={cn("text-xs py-1 px-2.5 font-semibold", accessTagClass)}>
            {accessTagLabel}
          </Badge>
        </div>
        <CardTitle className="text-lg font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-tight">
          {testSeries.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow p-4 space-y-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-primary/80" />
          <span>{testSeries.questionCount} Questions</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary/80" />
          <span>{testSeries.durationMinutes} min</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-primary/80" />
          <span>For: {testSeries.targetAudience}</span>
        </div>
      </CardContent>
      <CardFooter className="p-4 mt-auto border-t border-border/30 bg-muted/30 group-hover:bg-muted/50 transition-colors">
        <Link href={Routes.viewTestSeries(testSeries.id)} passHref className="w-full">
          <Button 
            variant="ghost" 
            className="w-full justify-between text-sm text-primary hover:text-primary/80 h-auto py-2.5 px-3 font-semibold group-hover:bg-primary/5 transition-colors"
            aria-label={`View details for ${testSeries.title}`}
          >
            View Details <ArrowRight className="h-4 w-4 transform transition-transform duration-300 group-hover:translate-x-1" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
