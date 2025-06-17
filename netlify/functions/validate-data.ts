import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { z } from "zod";

// Define the schema for the expected request body
const SubmissionSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters long." }),
  email: z.string().email({ message: "Invalid email address." }),
  age: z.number().min(18, { message: "You must be at least 18 years old." }).optional(),
});

type SubmissionInput = z.infer<typeof SubmissionSchema>;

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: "Method Not Allowed" }),
      headers: { "Content-Type": "application/json" },
    };
  }

  let inputData: SubmissionInput;

  try {
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Request body is missing." }),
        headers: { "Content-Type": "application/json" },
      };
    }
    inputData = JSON.parse(event.body);
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Invalid JSON in request body." }),
      headers: { "Content-Type": "application/json" },
    };
  }

  const validationResult = SubmissionSchema.safeParse(inputData);

  if (!validationResult.success) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Validation failed.",
        errors: validationResult.error.flatten().fieldErrors,
      }),
      headers: { "Content-Type": "application/json" },
    };
  }

  // At this point, validationResult.data contains the valid data
  const validData = validationResult.data;

  // TODO: Process the valid data (e.g., save to database, call another API, etc.)
  // For this example, we'll just return a success message.

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: `Hello, ${validData.name}! Your data was received and validated successfully.`,
      receivedData: validData,
    }),
    headers: { "Content-Type": "application/json" },
  };
};

export { handler };
