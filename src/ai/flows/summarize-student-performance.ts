// Summarize student performance on tests and DPPs to identify areas for improvement.

'use server';

/**
 * @fileOverview Summarizes student performance on tests and DPPs.
 *
 * - summarizeStudentPerformance - A function that summarizes student performance.
 * - SummarizeStudentPerformanceInput - The input type for the summarizeStudentPerformance function.
 * - SummarizeStudentPerformanceOutput - The return type for the summarizeStudentPerformance function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeStudentPerformanceInputSchema = z.object({
  testPerformance: z
    .string()
    .describe('The student performance data for tests, including scores and topics covered.'),
  dppPerformance: z
    .string()
    .describe('The student performance data for DPPs, including problem areas and completion rates.'),
});
export type SummarizeStudentPerformanceInput = z.infer<typeof SummarizeStudentPerformanceInputSchema>;

const SummarizeStudentPerformanceOutputSchema = z.object({
  summary: z.string().describe('A summary of the student performance, highlighting strengths and weaknesses.'),
  recommendations: z
    .string()
    .describe('Specific recommendations for the student to improve their performance.'),
});
export type SummarizeStudentPerformanceOutput = z.infer<typeof SummarizeStudentPerformanceOutputSchema>;

export async function summarizeStudentPerformance(
  input: SummarizeStudentPerformanceInput
): Promise<SummarizeStudentPerformanceOutput> {
  return summarizeStudentPerformanceFlow(input);
}

const summarizeStudentPerformancePrompt = ai.definePrompt({
  name: 'summarizeStudentPerformancePrompt',
  input: {schema: SummarizeStudentPerformanceInputSchema},
  output: {schema: SummarizeStudentPerformanceOutputSchema},
  prompt: `You are an AI assistant designed to provide students with personalized performance summaries and recommendations.

  Based on the student's test performance:
  {{testPerformance}}

  And their DPP (Daily Practice Problems) performance:
  {{dppPerformance}}

  Provide a concise summary of their overall performance, highlighting their strengths and weaknesses. Also, suggest targeted recommendations for improvement.
  `,
});

const summarizeStudentPerformanceFlow = ai.defineFlow(
  {
    name: 'summarizeStudentPerformanceFlow',
    inputSchema: SummarizeStudentPerformanceInputSchema,
    outputSchema: SummarizeStudentPerformanceOutputSchema,
  },
  async input => {
    const {output} = await summarizeStudentPerformancePrompt(input);
    return output!;
  }
);
