
import PocketBase from 'pocketbase';

// New PocketBase URL provided by the user
export const POCKETBASE_URL = 'https://ae8425c5-5ede-4664-bdaa-b238298ae1be-00-4oi013hd9264.sisko.replit.dev';

console.log(`Initializing PocketBase client with URL: ${POCKETBASE_URL}`);

export const pb = new PocketBase(POCKETBASE_URL);

// To make authStore persistent, you can optionally load it from localStorage
// Automating this behavior by default in the SDK.
// pb.authStore.loadFromCookie(document.cookie || ''); 
// pb.authStore.onChange(() => {
//     document.cookie = pb.authStore.exportToCookie({ httpOnly: false });
// });

export default pb;
