
'use client';

import { useState, useCallback, ChangeEvent, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import NextImage from 'next/image';
import { UploadCloud, X, ImagePlus as ImageIcon, Trash2, Loader2, CheckCircle } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import pb from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { RecordModel } from 'pocketbase';
import { Input } from '../ui/input';
import { cn } from '@/lib/utils';

interface ImageRecord extends RecordModel {
  images: string | string[]; 
  teacher: string;
}

interface ImageImportModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onImageAssign: (imageUrl: string | null) => void; // Changed: passes only URL string or null
  currentImageTargetField: string | null;
}

export function ImageImportModal({
  isOpen,
  onOpenChange,
  onImageAssign,
  currentImageTargetField, 
}: ImageImportModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [teacherImages, setTeacherImages] = useState<ImageRecord[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [selectedImageInModal, setSelectedImageInModal] = useState<{ id: string; url: string } | null>(null);

  const { teacher } = useAuth();
  const { toast } = useToast();

  const fetchTeacherImages = useCallback(async () => {
    let isMounted = true;
    if (!teacher?.id || !isOpen) {
      if (isMounted) setTeacherImages([]);
      return;
    }
    if (isMounted) setIsLoadingImages(true);
    try {
      const records = await pb.collection('images').getFullList<ImageRecord>({
        filter: `teacher = "${teacher.id}"`,
        sort: '-created',
      });
      if (isMounted) setTeacherImages(records);
    } catch (error) {
      console.error("Failed to fetch teacher images:", error);
      if (isMounted) {
        toast({ title: "Error", description: "Could not load your image library.", variant: "destructive" });
        setTeacherImages([]);
      }
    } finally {
      if (isMounted) setIsLoadingImages(false);
    }
  }, [teacher?.id, toast, isOpen]);

  useEffect(() => {
    let ignore = false;
    if (isOpen && !ignore) {
      fetchTeacherImages();
    }
    return () => { ignore = true; };
  }, [isOpen, fetchTeacherImages]);


  const handleFileChangeAndUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!teacher || !teacher.id) {
      toast({ title: "Authentication Error", description: "Teacher not found. Cannot upload image.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('teacher', teacher.id);
    formData.append('images', file); // Field name in 'images' collection for the file itself

    try {
      const newImageRecord = await pb.collection('images').create<ImageRecord>(formData);
      
      let newImageFilename: string | null = null;
      // Assuming 'images' field in 'images' collection is single file as per updated schema
      if (typeof newImageRecord.images === 'string') {
        newImageFilename = newImageRecord.images;
      } else if (Array.isArray(newImageRecord.images) && newImageRecord.images.length > 0) {
        newImageFilename = newImageRecord.images[0]; 
      }


      if (!newImageFilename) {
        throw new Error("Uploaded image filename not found in response.");
      }

      const newImageUrl = pb.files.getUrl(newImageRecord, newImageFilename);
      
      toast({ title: "Image Uploaded", description: `${file.name} added to your library.` });
      setTeacherImages(prev => [newImageRecord, ...prev]); // Add to the top of the list
      setSelectedImageInModal({ id: newImageRecord.id, url: newImageUrl }); // Auto-select the newly uploaded image

    } catch (error: any) {
      console.error("Image upload error:", error.data || error);
      toast({ title: "Upload Failed", description: error.data?.message || error.message || "Could not upload image.", variant: "destructive" });
    } finally {
      setIsUploading(false);
      // Reset file input to allow re-uploading the same file if needed
      const fileInput = document.getElementById('image-library-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    }
  };

  const handleAssignSelectedImage = () => {
    if (selectedImageInModal) {
      onImageAssign(selectedImageInModal.url); // Pass only the URL
      toast({ title: "Image Selected", description: `Image ready to be assigned.` });
      onOpenChange(false); // Close modal
    } else {
      toast({ title: "No Image Selected", description: "Please select an image from your library or upload a new one.", variant: "destructive" });
    }
  };
  
  const handleCloseModal = () => {
    setSelectedImageInModal(null); // Clear selection when modal closes
    onOpenChange(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleCloseModal}>
      <DialogContent className="sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="text-lg flex items-center gap-2">
            <ImageIcon className="text-primary" /> Your Image Library
          </DialogTitle>
          <DialogDescription>Upload new images or select an existing one to assign.</DialogDescription>
        </DialogHeader>
        
        <div className="flex-grow p-4 grid grid-cols-1 md:grid-cols-3 gap-4 overflow-hidden">
          {/* Upload Section */}
          <div className="md:col-span-1 flex flex-col gap-4">
            <label
              htmlFor="image-library-file-input"
              className="w-full h-40 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              {isUploading ? (
                  <>
                      <Loader2 className="h-10 w-10 text-primary animate-spin mb-2" />
                      <span className="text-xs text-primary">Uploading...</span>
                  </>
              ) : (
                  <>
                      <UploadCloud className="h-10 w-10 text-slate-400 dark:text-slate-500 mb-2" />
                      <span className="text-xs text-slate-500 dark:text-slate-400">Click to upload new image</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">PNG, JPG, WEBP (Max 5MB)</span>
                  </>
              )}
              <Input
                id="image-library-file-input"
                type="file"
                className="hidden"
                accept="image/png, image/jpeg, image/webp"
                onChange={handleFileChangeAndUpload}
                disabled={isUploading}
              />
            </label>
          </div>

          {/* Image Library Display Section */}
          <div className="md:col-span-2 flex flex-col overflow-hidden border border-border rounded-lg bg-muted/20">
            <p className="text-sm font-medium p-2 border-b text-center text-muted-foreground">Your Uploaded Images</p>
            {isLoadingImages ? (
              <div className="flex-grow flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : teacherImages.length === 0 ? (
              <div className="flex-grow flex items-center justify-center">
                <p className="text-sm text-muted-foreground p-4 text-center">Your library is empty. Upload an image to get started.</p>
              </div>
            ) : (
              <ScrollArea className="flex-grow p-2">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                  {teacherImages.map((imgRecord) => {
                    let filename: string | null = null;
                    // Handle 'images' field being string or array
                    if (typeof imgRecord.images === 'string') {
                        filename = imgRecord.images;
                    } else if (Array.isArray(imgRecord.images) && imgRecord.images.length > 0) {
                        filename = imgRecord.images[0]; // Use the first image if it's an array
                    }
                    
                    const thumbUrl = filename ? pb.files.getUrl(imgRecord, filename, {'thumb': '100x100'}) : '/placeholder.png';
                    const fullUrl = filename ? pb.files.getUrl(imgRecord, filename) : '/placeholder.png';
                    const isSelected = selectedImageInModal?.id === imgRecord.id;
                    return (
                      <button
                        key={imgRecord.id}
                        onClick={() => setSelectedImageInModal({ id: imgRecord.id, url: fullUrl })}
                        className={cn(
                          "aspect-square rounded-md overflow-hidden border-2 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all",
                          isSelected ? "border-primary ring-2 ring-primary shadow-lg" : "border-transparent hover:border-primary/50 hover:shadow-md"
                        )}
                        aria-pressed={isSelected}
                        aria-label={`Select image uploaded on ${new Date(imgRecord.created).toLocaleDateString()}`}
                      >
                        {thumbUrl !== '/placeholder.png' && filename ? ( // Ensure filename exists before rendering NextImage
                            <NextImage
                              src={thumbUrl}
                              alt={`Uploaded ${new Date(imgRecord.created).toLocaleDateString()}`}
                              width={100}
                              height={100}
                              className="object-cover w-full h-full"
                              data-ai-hint="diagram illustration"
                            />
                          ) : (
                            <div className="w-full h-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                              <ImageIcon className="h-6 w-6 text-slate-400 dark:text-slate-500" />
                            </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter className="p-4 border-t mt-auto flex-shrink-0">
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isUploading}>
              Cancel
            </Button>
          </DialogClose>
          <Button 
            onClick={handleAssignSelectedImage} 
            disabled={!selectedImageInModal || isUploading}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <CheckCircle className="mr-2 h-4 w-4"/> Assign Selected Image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
