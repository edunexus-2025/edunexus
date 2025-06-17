
import { TeacherLoginForm } from '@/components/auth/TeacherLoginForm';
// Navbar is already included in TeacherLayout, so it's removed from here.

export default function TeacherLoginPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* <Navbar />  Removed duplicate Navbar */}
      <main className="flex flex-1 items-center justify-center p-4 bg-gradient-to-br from-purple-500/10 via-background to-background">
        <TeacherLoginForm />
      </main>
    </div>
  );
}
