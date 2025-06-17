'use client';

import type React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { UploadCloud, Sparkles, AlertTriangle, Loader2, CheckCircle, ImageOff, Salad } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from "@/components/ui/progress";
import { suggestIngredientsAction } from '@/app/actions';

export default function PhotoRecipeClient() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [suggestedIngredients, setSuggestedIngredients] = useState<string[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0); // For visual feedback, not actual upload progress here

  useEffect(() => {
    let objectUrl: string | null = null;
    if (file) {
      objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      setSuggestedIngredients(null); // Clear previous suggestions
      setError(null); // Clear previous errors
    } else {
      setPreviewUrl(null);
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [file]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
        if (selectedFile.size > 5 * 1024 * 1024) { // 5MB limit
            setError('File is too large. Maximum size is 5MB.');
            setFile(null);
            return;
        }
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(selectedFile.type)) {
            setError('Invalid file type. Please upload a JPG, PNG, WEBP or GIF.');
            setFile(null);
            return;
        }
        setFile(selectedFile);
        setError(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setError('Please select an image file first.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuggestedIngredients(null);
    setUploadProgress(0);

    // Simulate upload progress
    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress += 10;
      if (currentProgress <= 100) {
        setUploadProgress(currentProgress);
      } else {
        clearInterval(progressInterval);
      }
    }, 100);


    const formData = new FormData();
    formData.append('imageFile', file);

    try {
      const result = await suggestIngredientsAction(formData);
      clearInterval(progressInterval);
      setUploadProgress(100);

      if (result.error) {
        setError(result.error);
        setSuggestedIngredients(null);
      } else if (result.ingredients) {
        setSuggestedIngredients(result.ingredients);
        setError(null);
      }
    } catch (e) {
      clearInterval(progressInterval);
      setUploadProgress(0);
      setError(e instanceof Error ? e.message : 'An unexpected error occurred.');
      setSuggestedIngredients(null);
    } finally {
      setIsLoading(false);
      // Keep uploadProgress at 100 on success, or reset if needed
    }
  };

  const MemoizedImagePreview = useMemo(() => {
    if (!previewUrl) return null;
    return (
        <div className="mt-6 border-2 border-dashed border-primary/50 rounded-lg p-2 bg-background shadow-inner">
            <Image
            src={previewUrl}
            alt="Selected food"
            width={500}
            height={300}
            className="rounded-md object-contain max-h-[300px] w-full"
            data-ai-hint="food photography"
            />
        </div>
    );
  }, [previewUrl]);

  return (
    <Card className="w-full shadow-xl bg-card/80 backdrop-blur-sm border-primary/20">
      <CardHeader>
        <div className="flex items-center space-x-3">
          <UploadCloud className="h-8 w-8 text-primary" />
          <div>
            <CardTitle className="text-2xl font-headline text-primary">Upload Your Food Photo</CardTitle>
            <CardDescription className="text-muted-foreground">
              Let our AI suggest ingredients for your next culinary masterpiece!
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="imageUpload"
              className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-muted/50 transition-colors duration-200 group border-primary/30 hover:border-primary"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <UploadCloud className="w-10 h-10 mb-3 text-primary/70 group-hover:text-primary transition-colors" />
                <p className="mb-2 text-sm text-foreground group-hover:text-primary">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">JPG, PNG, WEBP, or GIF (MAX. 5MB)</p>
              </div>
              <Input
                id="imageUpload"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileChange}
                className="hidden"
                aria-label="Upload food photo"
              />
            </label>
            {file && <p className="mt-2 text-sm text-green-600 flex items-center"><CheckCircle className="w-4 h-4 mr-1" />Selected: {file.name}</p>}
          </div>

          {MemoizedImagePreview}

          {isLoading && (
            <div className="space-y-2 pt-2">
              <Progress value={uploadProgress} className="w-full h-2 [&>div]:bg-gradient-to-r [&>div]:from-accent [&>div]:to-primary" />
              <p className="text-sm text-center text-primary animate-pulse">Analyzing your delicious photo...</p>
            </div>
          )}

          {error && (
            <Alert variant="destructive" className="mt-4 bg-destructive/10 border-destructive/30 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <AlertTitle className="font-semibold">Oops! Something went wrong.</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button 
            type="submit" 
            disabled={!file || isLoading} 
            className="w-full text-lg py-6 bg-gradient-to-r from-accent to-primary hover:from-accent/90 hover:to-primary/90 text-primary-foreground transition-all duration-300 ease-in-out transform hover:scale-105 shadow-lg focus:ring-4 focus:ring-primary/50"
            aria-live="polite"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                Suggesting...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-6 w-6" />
                Suggest Ingredients
              </>
            )}
          </Button>
        </form>
      </CardContent>

      {suggestedIngredients && suggestedIngredients.length > 0 && (
        <CardFooter className="flex-col items-start space-y-4 pt-6 border-t border-primary/20 mt-6">
           <div className="flex items-center space-x-2">
            <Salad className="h-7 w-7 text-primary"/>
            <h3 className="text-xl font-semibold text-primary font-headline">Suggested Ingredients:</h3>
           </div>
          <div className="flex flex-wrap gap-3">
            {suggestedIngredients.map((ingredient, index) => (
              <Badge 
                key={index} 
                variant="secondary" 
                className="text-md px-4 py-2 rounded-full bg-secondary/70 text-secondary-foreground shadow-md border border-primary/20 hover:bg-secondary transition-colors cursor-default"
                role="listitem"
                aria-label={ingredient}
              >
                {ingredient}
              </Badge>
            ))}
          </div>
        </CardFooter>
      )}
       {suggestedIngredients && suggestedIngredients.length === 0 && (
         <CardFooter className="flex-col items-start space-y-2 pt-6 border-t border-primary/20">
            <div className="flex items-center space-x-2">
                <ImageOff className="h-6 w-6 text-muted-foreground"/>
                <h3 className="text-lg font-semibold text-muted-foreground">No Ingredients Suggested</h3>
            </div>
            <p className="text-sm text-muted-foreground">We couldn't identify specific ingredients in this photo. Try another one!</p>
        </CardFooter>
      )}
    </Card>
  );
}
