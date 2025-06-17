'use server';

// import { runFlow } from '@genkit-ai/flow';
// import { suggestIngredientsFlow } from '@/ai/flows/suggestIngredientsFlow'; // Assumed AI flow path

interface SuggestionResult {
  ingredients?: string[];
  error?: string;
}

export async function suggestIngredientsAction(formData: FormData): Promise<SuggestionResult> {
  const file = formData.get('imageFile') as File | null;

  if (!file) {
    return { error: 'No image file provided.' };
  }

  if (file.size > 5 * 1024 * 1024) { // 5MB limit
    return { error: 'File is too large. Maximum size is 5MB.' };
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    return { error: 'Invalid file type. Please upload a JPG, PNG, WEBP, or GIF image.' };
  }

  try {
    // Convert file to base64 data URL (if needed by the actual AI flow)
    // const arrayBuffer = await file.arrayBuffer();
    // const buffer = Buffer.from(arrayBuffer);
    // const base64Image = buffer.toString('base64');
    // const mimeType = file.type;
    // const imageDataUrl = `data:${mimeType};base64,${base64Image}`;

    // Call the Genkit AI flow
    // const result = await runFlow(suggestIngredientsFlow, { image: imageDataUrl });
    // return { ingredients: result.ingredients }; // Assuming result structure

    // MOCK IMPLEMENTATION (as direct AI flow interaction is restricted for now)
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate AI processing time
    
    const allPossibleIngredients = [
      "Tomato", "Onion", "Garlic", "Bell Pepper", "Carrot", "Celery", "Potato", "Broccoli", "Spinach", "Mushroom",
      "Chicken Breast", "Beef Steak", "Salmon Fillet", "Shrimp", "Tofu", "Egg", "Cheese", "Pasta", "Rice",
      "Olive Oil", "Butter", "Flour", "Sugar", "Salt", "Black Pepper", "Paprika", "Chili Flakes",
      "Basil", "Oregano", "Thyme", "Rosemary", "Cilantro", "Parsley", "Mint",
      "Lemon", "Lime", "Avocado", "Soy Sauce", "Honey", "Mustard", "Vinegar", "Yogurt"
    ];

    // Test error case with a specific file name pattern
    if (file.name.toLowerCase().includes("error")) {
      throw new Error("AI failed to process this image. Please try a different one.");
    }
    
    // Simulate successful suggestion
    const shuffled = [...allPossibleIngredients].sort(() => 0.5 - Math.random());
    const count = Math.floor(Math.random() * 4) + 4; // 4 to 7 ingredients
    const suggestedIngredients = shuffled.slice(0, count);

    return { ingredients: suggestedIngredients };

  } catch (e) {
    console.error("Error in ingredient suggestion action:", e);
    return { error: e instanceof Error ? e.message : "An unknown error occurred during ingredient suggestion." };
  }
}
