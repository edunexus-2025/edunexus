
import { CollegeDetailsSignupForm } from '@/components/auth/CollegeDetailsSignupForm';
// Navbar is included in CollegeDetailsLayout

export default function CollegeDetailsSignupPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex flex-1 items-center justify-center p-4">
        <CollegeDetailsSignupForm />
      </main>
    </div>
  );
}
