'use server';
/**
 * @fileOverview An AI agent that generates hints for DPP questions based on student performance.
 *
 * - generateDppHints - A function that generates hints for DPP questions.
 * - GenerateDppHintsInput - The input type for the generateDppHints function.
 * - GenerateDppHintsOutput - The return type for the generateDppHints function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateDppHintsInputSchema = z.object({
  question: z.string().describe('The DPP question for which hints are needed.'),
  studentPerformance: z
    .string()
    .describe(
      'The student performance data related to the question, including topics the student struggles with.'
    ),
});
export type GenerateDppHintsInput = z.infer<typeof GenerateDppHintsInputSchema>;

const GenerateDppHintsOutputSchema = z.object({
  hint: z.string().describe('The AI-generated hint for the DPP question.'),
  stepByStepSolution: z
    .string()
    .describe('A step-by-step solution for the DPP question.'),
});
export type GenerateDppHintsOutput = z.infer<typeof GenerateDppHintsOutputSchema>;

export async function generateDppHints(input: GenerateDppHintsInput): Promise<GenerateDppHintsOutput> {
  return generateDppHintsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateDppHintsPrompt',
  input: {schema: GenerateDppHintsInputSchema},
  output: {schema: GenerateDppHintsOutputSchema},
  prompt: `You are an AI assistant designed to provide hints and step-by-step solutions for Daily Practice Problems (DPP) questions.

  Based on the student's performance data, provide a hint and a step-by-step solution to help them solve the following question:

  Question: {{{question}}}

  Student Performance Data: {{{studentPerformance}}}

  Hint:
  Step-by-step solution: `,
});

const generateDppHintsFlow = ai.defineFlow(
  {
    name: 'generateDppHintsFlow',
    inputSchema: GenerateDppHintsInputSchema,
    outputSchema: GenerateDppHintsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
