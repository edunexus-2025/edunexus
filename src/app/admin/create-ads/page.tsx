
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { StudentDashboardAdSchema, type StudentDashboardAdInput } from "@/lib/schemas";
import { Megaphone, UploadCloud, Image as ImageIcon, Link as LinkIcon, Palette, CalendarIcon, List, Edit2, Trash2, PlusCircle, AlertCircle, Loader2 } from "lucide-react";
import NextImage from 'next/image';
import { useAuth } from "@/contexts/AuthContext";
import pb from "@/lib/pocketbase";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback } from "react";
import type { RecordModel } from "pocketbase";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

interface AdRecord extends RecordModel {
  ad_name: string;
  ad_expiry_date?: string;
  ad_image: string; // filename
  add_button?: string; // This is 'ad_button_link' in our form schema
  ad_button_name?: string;
  ad_description: string;
  background_colour?: string; // JSON string
}

const exampleBgJson = `{
  "type": "gradient",
  "from": "purple-500",
  "to": "pink-600",
  "direction": "r"
}`;


export default function AdminCreateAdsPage() {
  const { user: adminUser } = useAuth();
  const { toast } = useToast();
  const [ads, setAds] = useState<AdRecord[]>([]);
  const [isLoadingAds, setIsLoadingAds] = useState(true);
  const [editingAd, setEditingAd] = useState<AdRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<StudentDashboardAdInput>({
    resolver: zodResolver(StudentDashboardAdSchema),
    defaultValues: {
      ad_name: '',
      ad_expiry_date: '',
      ad_image_file: null,
      ad_button_link: '',
      ad_button_name: '',
      ad_description: '',
      background_colour_json: '',
    },
  });
  
  const fetchAds = useCallback(async (isMountedGetter: () => boolean = () => true) => {
    if (!isMountedGetter()) return;
    setIsLoadingAds(true);
    setError(null);
    try {
      const records = await pb.collection('student_dashboard_ads').getFullList<AdRecord>({
        sort: '-created',
      });
      if(isMountedGetter()) setAds(records);
    } catch (fetchError: any) {
      if(isMountedGetter()) {
        console.error("Failed to fetch ads:", fetchError.data || fetchError);
        setError("Could not load existing ads. Please try again later.");
        toast({ title: "Error", description: "Could not load existing ads.", variant: "destructive" });
      }
    } finally {
      if(isMountedGetter()) setIsLoadingAds(false);
    }
  }, [toast]);

  useEffect(() => {
    let isMounted = true;
    fetchAds(() => isMounted);
    return () => { isMounted = false; }
  }, [fetchAds]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      form.setValue('ad_image_file', file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      form.setValue('ad_image_file', null);
      setImagePreview(null);
    }
  };
  
  const handleEditAd = (ad: AdRecord) => {
    setEditingAd(ad);
    let imageUrl: string | null = null;
    if(ad.ad_image && ad.collectionId && ad.collectionName) {
        imageUrl = pb.files.getUrl(ad, ad.ad_image);
    }
    setImagePreview(imageUrl); // Show existing image
    form.reset({
      ad_name: ad.ad_name,
      ad_expiry_date: ad.ad_expiry_date ? format(new Date(ad.ad_expiry_date), "yyyy-MM-dd") : '',
      ad_image_file: null, // Reset file input, existing image is shown via preview
      ad_button_link: ad.add_button || '', // map from add_button
      ad_button_name: ad.ad_button_name || '',
      ad_description: ad.ad_description,
      background_colour_json: ad.background_colour || '',
    });
  };
  
  const handleDeleteAd = async (adId: string) => {
    if (!adId) {
      console.error("handleDeleteAd called with undefined adId");
      toast({ title: "Error", description: "Cannot delete ad: ID is missing.", variant: "destructive" });
      return;
    }
    console.log("Attempting to delete ad with ID:", adId);
    if (!confirm("Are you sure you want to delete this ad? This action cannot be undone.")) return;

    try {
      await pb.collection('student_dashboard_ads').delete(adId);
      toast({ title: "Ad Deleted", description: "The advertisement has been removed." });
      fetchAds(); // Refresh list
      if (editingAd?.id === adId) { // If editing the ad that was just deleted
        setEditingAd(null);
        form.reset();
        setImagePreview(null);
      }
    } catch (deleteError: any) {
      console.error("Detailed error deleting ad:", deleteError); // Log the full error object
      let errorMessage = "Could not delete the advertisement.";
      if (deleteError.data && deleteError.data.message) {
        errorMessage = deleteError.data.message;
      } else if (deleteError.message) {
        errorMessage = deleteError.message;
      } else if (deleteError.originalError && deleteError.originalError.message) { // PocketBase often wraps errors
        errorMessage = deleteError.originalError.message;
      }
      
      // Check for specific status codes that might indicate permission issues
      if (deleteError.status === 403) {
        errorMessage += " (Permission Denied - Check PocketBase collection rules for 'student_dashboard_ads' and ensure your admin user role is correctly configured and recognized by PocketBase.)";
      } else if (deleteError.status === 404) {
        errorMessage += " (Not Found - The ad might have already been deleted or the ID is incorrect)";
      } else if (deleteError.status === 400) {
        errorMessage += ` (Bad Request - PocketBase responded with: ${JSON.stringify(deleteError.data?.data) || 'No specific details from PB.'})`;
      }

      toast({ title: "Deletion Failed", description: errorMessage, variant: "destructive", duration: 9000 });
    }
  };

  const onSubmit = async (values: StudentDashboardAdInput) => {
    if (!adminUser) {
      toast({ title: "Authentication Error", description: "Admin user not found.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('ad_name', values.ad_name);
    formData.append('ad_description', values.ad_description);
    if (values.ad_expiry_date) formData.append('ad_expiry_date', new Date(values.ad_expiry_date).toISOString());
    if (values.ad_image_file) formData.append('ad_image', values.ad_image_file);
    if (values.ad_button_link) formData.append('add_button', values.ad_button_link); // map to add_button
    if (values.ad_button_name) formData.append('ad_button_name', values.ad_button_name);
    if (values.background_colour_json) formData.append('background_colour', values.background_colour_json);
    
    try {
      if (editingAd) {
        await pb.collection('student_dashboard_ads').update(editingAd.id, formData);
        toast({ title: "Ad Updated!", description: "Advertisement details saved." });
      } else {
        if (!values.ad_image_file) {
            toast({ title: "Image Required", description: "Please select an image for the new ad.", variant: "destructive" });
            setIsSubmitting(false);
            return;
        }
        await pb.collection('student_dashboard_ads').create(formData);
        toast({ title: "Ad Created!", description: "New advertisement added." });
      }
      form.reset({ ad_name: '', ad_expiry_date: '', ad_image_file: null, ad_button_link: '', ad_button_name: '', ad_description: '', background_colour_json: '' });
      setImagePreview(null);
      setEditingAd(null);
      fetchAds();
    } catch (submitError: any) {
      toast({ title: "Submission Failed", description: submitError.data?.message || submitError.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 p-4 md:p-6">
      <Card className="shadow-xl border-t-4 border-primary">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Megaphone className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl font-bold text-foreground">{editingAd ? "Edit Advertisement" : "Create Advertisement"}</CardTitle>
              <CardDescription>
                {editingAd ? "Modify the details of the selected ad." : "Add a new advertisement for the student dashboard."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
              <FormField control={form.control} name="ad_name" render={({ field }) => (<FormItem><FormLabel>Ad Name*</FormLabel><FormControl><Input placeholder="e.g., Summer Discount Offer" {...field} /></FormControl><FormMessage /></FormItem> )}/>
              <FormField control={form.control} name="ad_description" render={({ field }) => (<FormItem><FormLabel>Description* (Min 10, Max 250 chars)</FormLabel><FormControl><Textarea placeholder="Enter ad description..." {...field} rows={3} /></FormControl><FormMessage /></FormItem> )}/>
              <div className="grid md:grid-cols-2 gap-6">
                <FormField control={form.control} name="ad_image_file" render={({ fieldState }) => (<FormItem>
                  <FormLabel className="flex items-center gap-1"><ImageIcon className="h-4 w-4"/> Ad Image {editingAd ? "(Optional: Replace)" : "*"}</FormLabel>
                  <FormControl><Input type="file" accept="image/*" onChange={handleFileChange} /></FormControl>
                  {imagePreview && <NextImage src={imagePreview} alt="Ad preview" width={200} height={100} className="mt-2 rounded-md border object-contain" data-ai-hint="advertisement visual"/>}
                  {fieldState.error && <FormMessage>{fieldState.error.message}</FormMessage>}
                </FormItem> )}/>
                <FormField control={form.control} name="ad_expiry_date" render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-1"><CalendarIcon className="h-4 w-4"/> Expiry Date (Optional)</FormLabel><FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )}/>
              </div>
              <FormField control={form.control} name="background_colour_json" render={({ field }) => (<FormItem>
                <FormLabel className="flex items-center gap-1"><Palette className="h-4 w-4"/> Background Style JSON (Optional)</FormLabel>
                <FormControl><Textarea placeholder={exampleBgJson} {...field} value={field.value || ''} rows={4} className="font-mono text-xs"/></FormControl>
                <FormDescription className="text-xs">Enter JSON for background style, e.g., {`{"type": "solid", "value": "#RRGGBB"}`} or {`{"type": "gradient", "from": "blue-500", "to": "purple-600"}`}. Leave blank for default.</FormDescription>
                <FormMessage />
              </FormItem> )}/>
              <Card><CardHeader><CardTitle className="text-md">Call to Action (Optional)</CardTitle></CardHeader><CardContent className="space-y-4">
                <FormField control={form.control} name="ad_button_link" render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-1"><LinkIcon className="h-4 w-4"/> Button Link URL</FormLabel><FormControl><Input type="url" placeholder="https://example.com/offer" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )}/>
                <FormField control={form.control} name="ad_button_name" render={({ field }) => (<FormItem><FormLabel>Button Text</FormLabel><FormControl><Input placeholder="e.g., Learn More" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )}/>
              </CardContent></Card>
            </CardContent>
            <CardFooter className="flex justify-end gap-2 pt-6 border-t">
                {editingAd && <Button type="button" variant="outline" onClick={() => { setEditingAd(null); form.reset(); setImagePreview(null); }} disabled={isSubmitting}>Cancel Edit</Button>}
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UploadCloud className="mr-2 h-4 w-4" />}
                    {editingAd ? "Update Ad" : "Create Ad"}
                </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>

      <Card className="mt-8 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2"><List className="h-5 w-5 text-primary"/> Current Advertisements</CardTitle>
          <CardDescription>Manage existing ads displayed on the student dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingAds ? (
            <div className="space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
          ) : error ? (
            <div className="text-center p-6 border border-destructive bg-destructive/10 rounded-md">
              <AlertCircle className="mx-auto h-8 w-8 text-destructive mb-2" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          ) : ads.length === 0 ? (
            <p className="text-muted-foreground text-center">No advertisements found. Create one above!</p>
          ) : (
            <div className="space-y-3">
              {ads.map(ad => (
                <Card key={ad.id} className="p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-grow min-w-0">
                    {ad.ad_image && ad.collectionId && ad.collectionName &&
                      <NextImage src={pb.files.getUrl(ad, ad.ad_image, {thumb: '300x100'})} alt={ad.ad_name} width={100} height={33} className="rounded-md object-cover border flex-shrink-0" data-ai-hint="advertisement banner"/>
                    }
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate" title={ad.ad_name}>{ad.ad_name}</p>
                      <p className="text-xs text-muted-foreground truncate" title={ad.ad_description}>{ad.ad_description}</p>
                      {ad.ad_expiry_date && <p className="text-xs text-muted-foreground">Expires: {format(new Date(ad.ad_expiry_date), "dd MMM yyyy")}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2 self-start sm:self-center flex-shrink-0">
                    <Button variant="outline" size="sm" onClick={() => handleEditAd(ad)}><Edit2 className="mr-1 h-3.5 w-3.5"/> Edit</Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteAd(ad.id)}><Trash2 className="mr-1 h-3.5 w-3.5"/> Delete</Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
    
