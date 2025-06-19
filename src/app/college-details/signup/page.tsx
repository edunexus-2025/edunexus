
import { CollegeDetailsSignupForm } from '@/components/auth/CollegeDetailsSignupForm';
// Navbar is now correctly handled by CollegeDetailsLayout

export default function CollegeDetailsSignupPage() {
  return (
    // The CollegeDetailsLayout will wrap this page and provide the CollegeDetailsNavbar
    <div className="flex min-h-screen flex-col"> {/* Ensure this div allows layout to control Navbar */}
      <main className="flex flex-1 items-center justify-center p-4">
        <CollegeDetailsSignupForm />
      </main>
    </div>
  );
}
