import PhotoRecipeClient from '@/components/photo-recipe-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 selection:bg-primary/20 selection:text-primary-foreground">
      <header className="mb-8 text-center">
        <div className="flex items-center justify-center mb-2">
           <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z" fill="currentColor"/>
            <path d="M12.5 7H11.5V12.5L15.42 15.42L16.12 14.71L12.5 11.83V7Z" fill="currentColor"/>
            <path d="M9 10C8.45 10 8 9.55 8 9C8 8.45 8.45 8 9 8C9.55 8 10 8.45 10 9C10 9.55 9.55 10 9 10Z" fill="currentColor"/>
            <path d="M15 10C14.45 10 14 9.55 14 9C14 8.45 14.45 8 15 8C15.55 8 16 8.45 16 9C16 9.55 15.55 10 15 10Z" fill="currentColor"/>
            <path d="M12 17.5C10.03 17.5 8.42 16.22 7.85 14.5H16.15C15.58 16.22 13.97 17.5 12 17.5Z" fill="currentColor"/>
           </svg>
          <h1 className="text-5xl font-bold text-primary font-headline ml-3">PhotoRecipe</h1>
        </div>
        <p className="text-xl text-muted-foreground mt-2">
          Upload a photo of a dish, and we'll suggest ingredients you can use!
        </p>
      </header>

      <main className="w-full max-w-2xl">
        <PhotoRecipeClient />
      </main>

      <footer className="mt-12 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} PhotoRecipe. Cook creatively!</p>
      </footer>
    </div>
  );
}
