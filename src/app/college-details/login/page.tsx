
import { CollegeDetailsLoginForm } from '@/components/auth/CollegeDetailsLoginForm';
// Navbar is included in CollegeDetailsLayout

export default function CollegeDetailsLoginPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex flex-1 items-center justify-center p-4">
        <CollegeDetailsLoginForm />
      </main>
    </div>
  );
}
