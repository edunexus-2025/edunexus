
import PocketBase from 'pocketbase';

// Read the PocketBase URL from the environment variable
// Fallback to the hardcoded URL if the environment variable is not set (for safety, but should be configured)
export const POCKETBASE_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'https://ae8425c5-5ede-4664-bdaa-b238298ae1be-00-4oi013hd9264.sisko.replit.dev';

if (!process.env.NEXT_PUBLIC_POCKETBASE_URL) {
  console.warn(
    ` PocketBase URL is not set in environment variables (NEXT_PUBLIC_POCKETBASE_URL).
    Falling back to default: ${POCKETBASE_URL}
    Please set this variable in your .env.local file for better configuration management.`
  );
} else {
  console.log(`Initializing PocketBase client with URL from environment: ${POCKETBASE_URL}`);
}


export const pb = new PocketBase(POCKETBASE_URL);

// To make authStore persistent, you can optionally load it from localStorage
// Automating this behavior by default in the SDK.
// pb.authStore.loadFromCookie(document.cookie || ''); 
// pb.authStore.onChange(() => {
//     document.cookie = pb.authStore.exportToCookie({ httpOnly: false });
// });

export default pb;

