
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ReferralCodeSchema, type ReferralCodeInput, StudentReferralPlanEnum } from "@/lib/schemas";
import { TicketPercent, PlusCircle, Edit2, Trash2, Save, XCircle, CalendarIcon, AlertTriangle, ListFilter, Search, Info } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import pb from "@/lib/pocketbase";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback, useMemo } from "react";
import type { RecordModel, ClientResponseError } from "pocketbase";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";


interface ReferralCodeRecord extends RecordModel, Omit<ReferralCodeInput, 'expiry_date'> {
  id: string;
  expiry_date?: string; // PocketBase stores date as string
}

const planOptions = StudentReferralPlanEnum.options.map(opt => ({ id: opt, label: opt }));

export default function AdminManageReferralsPage() {
  const { user: adminUser } = useAuth();
  const { toast } = useToast();
  const [referralCodes, setReferralCodes] = useState<ReferralCodeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingCode, setEditingCode] = useState<ReferralCodeRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlanFor, setFilterPlanFor] = useState<string>('all');

  const form = useForm<ReferralCodeInput>({
    resolver: zodResolver(ReferralCodeSchema),
    defaultValues: {
      refferal_name: '',
      discount: 0,
      plan_for: [],
      plan_by: [],
      expiry_date: '',
    },
  });

  const fetchReferralCodes = useCallback(async (isMountedGetter: () => boolean = () => true) => {
    if (!isMountedGetter()) return;
    setIsLoading(true); setError(null);
    try {
      const records = await pb.collection('students_refferals_edunexus_plan').getFullList<ReferralCodeRecord>({
        sort: '-created',
      });
      if (isMountedGetter()) setReferralCodes(records);
    } catch (fetchError: any) {
      if (isMountedGetter()) {
        const clientError = fetchError as ClientResponseError;
        let errorDesc = "Could not load referral codes.";
        if (clientError?.isAbort || (clientError?.name === 'ClientResponseError' && clientError?.status === 0)) {
          console.warn("Fetch referral codes request cancelled."); errorDesc = "Request cancelled.";
        } else {
          errorDesc = clientError.data?.message || clientError.message || "Unknown error.";
          console.error("Failed to fetch referral codes:", clientError.data || clientError);
        }
        setError(errorDesc);
        toast({ title: "Error", description: errorDesc, variant: "destructive" });
      }
    } finally {
      if (isMountedGetter()) setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    let isMounted = true;
    fetchReferralCodes(() => isMounted);
    return () => { isMounted = false; };
  }, [fetchReferralCodes]);

  const handleEdit = (code: ReferralCodeRecord) => {
    setEditingCode(code);
    form.reset({
      refferal_name: code.refferal_name,
      discount: code.discount,
      plan_for: Array.isArray(code.plan_for) ? code.plan_for : [],
      plan_by: Array.isArray(code.plan_by) ? code.plan_by : [],
      expiry_date: code.expiry_date ? format(new Date(code.expiry_date), "yyyy-MM-dd") : '',
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleAddNew = () => {
    setEditingCode(null);
    form.reset({ refferal_name: '', discount: 0, plan_for: [], plan_by: [], expiry_date: '' });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (codeId: string, codeName: string) => {
    try {
      await pb.collection('students_refferals_edunexus_plan').delete(codeId);
      toast({ title: "Referral Code Deleted", description: `Code "${codeName}" has been removed.` });
      fetchReferralCodes();
    } catch (deleteError: any) {
      toast({ title: "Deletion Failed", description: deleteError.data?.message || deleteError.message, variant: "destructive" });
    }
  };

  const onSubmit = async (values: ReferralCodeInput) => {
    if (!adminUser) {
      toast({ title: "Authentication Error", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const dataToSave = {
      ...values,
      expiry_date: values.expiry_date ? new Date(values.expiry_date).toISOString() : null,
    };

    try {
      if (editingCode) {
        await pb.collection('students_refferals_edunexus_plan').update(editingCode.id, dataToSave);
        toast({ title: "Referral Code Updated", description: "Changes saved successfully." });
      } else {
        await pb.collection('students_refferals_edunexus_plan').create(dataToSave);
        toast({ title: "Referral Code Created", description: "New code added successfully." });
      }
      form.reset();
      setShowForm(false);
      setEditingCode(null);
      fetchReferralCodes();
    } catch (submitError: any) {
      let errorMessage = "Could not save the referral code.";
      if (submitError.data?.data?.refferal_name?.message) {
        errorMessage = `Referral Name: ${submitError.data.data.refferal_name.message}`;
      } else if (submitError.data?.message) {
        errorMessage = submitError.data.message;
      } else if (submitError.message) {
        errorMessage = submitError.message;
      }
      toast({ title: "Submission Failed", description: errorMessage, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCodes = useMemo(() => {
    return referralCodes.filter(code => {
      const matchesSearch = code.refferal_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPlanFor = filterPlanFor === 'all' || (Array.isArray(code.plan_for) && code.plan_for.includes(filterPlanFor as any));
      return matchesSearch && matchesPlanFor;
    });
  }, [referralCodes, searchTerm, filterPlanFor]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <div className="flex items-center gap-3">
            <TicketPercent className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl md:text-3xl font-bold text-foreground">Manage Referral Codes</CardTitle>
              <CardDescription>Oversee, create, and edit referral codes for student plans.</CardDescription>
            </div>
          </div>
          <Button onClick={handleAddNew} className="w-full md:w-auto mt-3 md:mt-0">
            <PlusCircle className="mr-2 h-5 w-5" /> Add New Referral Code
          </Button>
        </CardHeader>
      </Card>

      {showForm && (
        <Card className="shadow-xl">
          <CardHeader><CardTitle>{editingCode ? "Edit Referral Code" : "Create New Referral Code"}</CardTitle></CardHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardContent className="space-y-6">
                <FormField control={form.control} name="refferal_name" render={({ field }) => (<FormItem><FormLabel>Referral Code Name*</FormLabel><FormControl><Input placeholder="e.g., SUMMER25" {...field} /></FormControl><FormDescription>Uppercase letters, numbers, and underscores only (3-50 chars).</FormDescription><FormMessage /></FormItem>)}/>
                <FormField control={form.control} name="discount" render={({ field }) => (<FormItem><FormLabel>Discount Percentage*</FormLabel><FormControl><Input type="number" step="0.01" placeholder="e.g., 10 or 15.5" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>)}/>
                <FormField control={form.control} name="plan_for" render={() => (<FormItem><FormLabel>Applicable Plans For (Student gets discount ON)*</FormLabel>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 border rounded-md bg-muted/30">
                    {planOptions.map((plan) => (<FormField key={`pf-${plan.id}`} control={form.control} name="plan_for" render={({ field: checkboxField }) => (<FormItem className="flex items-center gap-2 p-1.5 rounded hover:bg-background"><FormControl><Checkbox checked={checkboxField.value?.includes(plan.id)} onCheckedChange={(checked) => checkboxField.onChange(checked ? [...(checkboxField.value || []), plan.id] : checkboxField.value?.filter(id => id !== plan.id))} /></FormControl><FormLabel className="text-sm font-normal cursor-pointer">{plan.label}</FormLabel></FormItem>)}/>))}
                  </div><FormMessage /></FormItem>)}/>
                <FormField control={form.control} name="plan_by" render={() => (<FormItem><FormLabel>Usable By Students On Plans (Optional)</FormLabel>
                   <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 border rounded-md bg-muted/30">
                    {planOptions.map((plan) => (<FormField key={`pb-${plan.id}`} control={form.control} name="plan_by" render={({ field: checkboxField }) => (<FormItem className="flex items-center gap-2 p-1.5 rounded hover:bg-background"><FormControl><Checkbox checked={checkboxField.value?.includes(plan.id)} onCheckedChange={(checked) => checkboxField.onChange(checked ? [...(checkboxField.value || []), plan.id] : checkboxField.value?.filter(id => id !== plan.id))} /></FormControl><FormLabel className="text-sm font-normal cursor-pointer">{plan.label}</FormLabel></FormItem>)}/>))}
                  </div><FormDescription>If empty, any student can use this code (if eligible for 'Plan For').</FormDescription><FormMessage /></FormItem>)}/>
                <FormField control={form.control} name="expiry_date" render={({ field }) => (<FormItem><FormLabel>Expiry Date (Optional)</FormLabel><div className="relative"><CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><FormControl><Input type="date" className="pl-9" {...field} value={field.value || ''} /></FormControl></div><FormMessage /></FormItem>)}/>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingCode(null); }} disabled={isSubmitting}><XCircle className="mr-2 h-4 w-4"/>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}><Save className="mr-2 h-4 w-4"/>{isSubmitting ? (editingCode ? 'Saving...' : 'Creating...') : (editingCode ? 'Save Changes' : 'Create Code')}</Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      )}
      
      <Card className="shadow-md">
        <CardHeader>
            <CardTitle>Existing Referral Codes</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2 mt-3">
                <div className="relative flex-grow"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by code name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8"/></div>
            </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3"> {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}</div>
          ) : error ? (
            <div className="text-center p-6 border border-destructive bg-destructive/10 rounded-md"><AlertTriangle className="mx-auto h-8 w-8 text-destructive mb-2" /><p className="text-destructive font-semibold">Error loading codes:</p><p className="text-sm text-destructive/80">{error}</p></div>
          ) : filteredCodes.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No referral codes found matching your criteria.</p>
          ) : (
            <ScrollArea className="max-h-[500px] pr-3">
              <div className="space-y-3">
                {filteredCodes.map(code => (
                  <Card key={code.id} className={cn("p-3 hover:shadow-md transition-shadow", editingCode?.id === code.id && "ring-2 ring-primary")}>
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                      <div className="flex-grow">
                        <h3 className="font-semibold text-primary">{code.refferal_name} <Badge variant="secondary" className="ml-2 text-xs">{code.discount}% OFF</Badge></h3>
                        <div className="text-xs text-muted-foreground mt-1">
                          <p><strong>For Plans:</strong> {Array.isArray(code.plan_for) ? code.plan_for.join(', ') : 'Any'}</p>
                          {Array.isArray(code.plan_by) && code.plan_by.length > 0 && <p><strong>Usable By Students On:</strong> {code.plan_by.join(', ')}</p>}
                          <p><strong>Expires:</strong> {code.expiry_date ? format(new Date(code.expiry_date), "dd MMM yyyy") : 'Never'}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 self-start sm:self-center mt-2 sm:mt-0">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(code)}><Edit2 className="mr-1 h-3.5 w-3.5"/> Edit</Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="mr-1 h-3.5 w-3.5"/> Delete</Button></AlertDialogTrigger>
                          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Code: {code.refferal_name}?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(code.id, code.refferal_name)}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      
      <Card className="bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700">
        <CardHeader><CardTitle className="text-blue-700 dark:text-blue-300 text-md flex items-center gap-2"><Info className="h-5 w-5"/>How It Works</CardTitle></CardHeader>
        <CardContent className="text-xs text-blue-600 dark:text-blue-200 space-y-1">
          <p><strong>Referral Code Name:</strong> The unique code students will enter (e.g., TEACHER10).</p>
          <p><strong>Discount Percentage:</strong> The % discount applied to the plan price.</p>
          <p><strong>Applicable Plans For:</strong> Select which subscription plan(s) this discount code can be applied TO by a new student.</p>
          <p><strong>Usable By Students On Plans (Optional):</strong> If you want to restrict who can USE this code based on THEIR CURRENT plan (e.g., only 'Free' users can use this code to upgrade), select those plans here. If empty, any student can use it provided the 'Applicable Plans For' match.</p>
          <p><strong>Expiry Date:</strong> Optional. After this date, the code will no longer be valid.</p>
        </CardContent>
      </Card>
    </div>
  );
}

    