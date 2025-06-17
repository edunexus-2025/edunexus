import { LoginForm } from '@/components/auth/LoginForm';
import { Navbar } from '@/components/layout/Navbar';

// This page is a Server Component by default.
// We are not explicitly using searchParams here, so we remove it from the props.
export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex flex-1 items-center justify-center p-4 bg-gradient-to-br from-primary/10 via-background to-background">
        <LoginForm />
      </main>
    </div>
  );
}
