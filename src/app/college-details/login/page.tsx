
import { CollegeDetailsLoginForm } from '@/components/auth/CollegeDetailsLoginForm';
// Navbar is now correctly handled by CollegeDetailsLayout

export default function CollegeDetailsLoginPage() {
  return (
    // The CollegeDetailsLayout will wrap this page and provide the CollegeDetailsNavbar
    <div className="flex min-h-screen flex-col"> {/* Ensure this div allows layout to control Navbar */}
      <main className="flex flex-1 items-center justify-center p-4">
        <CollegeDetailsLoginForm />
      </main>
    </div>
  );
}
