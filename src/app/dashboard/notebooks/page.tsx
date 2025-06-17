
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // For single select
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { StudentBookmark, StudentBookmarkCategory } from '@/lib/types';
import { StudentNotebookSchema, type StudentNotebookInput, StudentBookmarkCategoriesEnum } from '@/lib/schemas';
import { useAuth } from '@/contexts/AuthContext';
import pb from '@/lib/pocketbase';
import { useToast } from '@/hooks/use-toast';
import { BookHeart, PlusCircle, Edit, Trash2, Search, Filter, AlertCircle, Loader2, NotebookPen, Eye as EyeIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Routes } from '@/lib/constants';
import type { ClientResponseError } from 'pocketbase';
import { Badge } from '@/components/ui/badge';

const bookmarkCategories: StudentBookmarkCategory[] = StudentBookmarkCategoriesEnum.options;

export default function NotebooksPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [notebooks, setNotebooks] = useState<StudentBookmark[]>([]);
  const [isLoadingNotebooks, setIsLoadingNotebooks] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingNotebook, setEditingNotebook] = useState<StudentBookmark | null>(null);
  const [isSubmittingModal, setIsSubmittingModal] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const form = useForm<StudentNotebookInput>({
    resolver: zodResolver(StudentNotebookSchema),
    defaultValues: {
      notebook_name: '',
      category: [],
    },
  });

  const fetchNotebooks = useCallback(async (isMountedGetter: () => boolean) => {
    if (!user?.id || authLoading) {
      if (isMountedGetter()) {
        setIsLoadingNotebooks(false);
        setNotebooks([]);
      }
      return;
    }
    if (isMountedGetter()) {
      setIsLoadingNotebooks(true);
      setError(null);
    }
    try {
      const records = await pb.collection('student_bookmarks').getFullList<StudentBookmark>({
        filter: `user = "${user.id}" && archived = false`,
        sort: '-updated',
        expand: 'questions', 
        $autoCancel: false, 
      });
      if (isMountedGetter()) {
        const mappedNotebooks = records.map(r => ({
          ...r,
          questionCount: Array.isArray(r.questions) ? r.questions.length : 0,
        }));
        setNotebooks(mappedNotebooks);
      }
    } catch (err: any) {
      if (isMountedGetter()) {
        const clientError = err as ClientResponseError;
        if (clientError.isAbort || (clientError.name === 'ClientResponseError' && clientError.status === 0) ) {
            console.warn('NotebooksPage: Fetch notebooks request was cancelled.');
        } else {
            console.error("NotebooksPage: Failed to fetch notebooks:", clientError.data || clientError);
            setError(`Could not load notebooks. Error: ${clientError.data?.message || clientError.message}`);
            toast({ title: "Error", description: "Failed to load your notebooks.", variant: "destructive" });
        }
      }
    } finally {
      if (isMountedGetter()) {
        setIsLoadingNotebooks(false);
      }
    }
  }, [user?.id, authLoading, toast]);

  useEffect(() => {
    let isMounted = true;
    const isMountedGetter = () => isMounted;

    if (!authLoading) { // Only fetch if auth state is resolved
        fetchNotebooks(isMountedGetter);
    }
    
    return () => {
      isMounted = false;
    };
  }, [authLoading, fetchNotebooks]); // Added fetchNotebooks to dependency array

  const handleOpenCreateModal = () => {
    setEditingNotebook(null);
    form.reset({ notebook_name: '', category: [] });
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (notebook: StudentBookmark) => {
    setEditingNotebook(notebook);
    form.reset({
      notebook_name: notebook.notebook_name,
      category: notebook.category || [],
    });
    setIsCreateModalOpen(true);
  };

  const onSubmitModal = async (values: StudentNotebookInput) => {
    if (!user) return;
    setIsSubmittingModal(true);
    try {
      const dataToSave = {
        ...values,
        user: user.id,
      };
      if (editingNotebook) {
        await pb.collection('student_bookmarks').update(editingNotebook.id, dataToSave);
        toast({ title: "Notebook Updated", description: `"${values.notebook_name}" has been updated.` });
      } else {
        await pb.collection('student_bookmarks').create(dataToSave);
        toast({ title: "Notebook Created", description: `"${values.notebook_name}" has been created.` });
      }
      fetchNotebooks(() => true); // Refresh list, assuming component is still mounted
      setIsCreateModalOpen(false);
      setEditingNotebook(null);
    } catch (error: any) {
      toast({
        title: editingNotebook ? "Update Failed" : "Creation Failed",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingModal(false);
    }
  };

  const handleDeleteNotebook = async (notebookId: string, notebookName: string) => {
    if (!confirm(`Are you sure you want to delete the notebook "${notebookName}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await pb.collection('student_bookmarks').delete(notebookId);
      toast({ title: "Notebook Deleted", description: `"${notebookName}" has been deleted.` });
      fetchNotebooks(() => true); // Refresh list
    } catch (error: any) {
      toast({ title: "Deletion Failed", description: error.message, variant: "destructive" });
    }
  };

  const filteredNotebooks = notebooks.filter(nb => {
    const matchesSearch = nb.notebook_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || (nb.category && nb.category.includes(filterCategory as StudentBookmarkCategory));
    return matchesSearch && matchesCategory;
  });

  if (authLoading || (!user && isLoadingNotebooks)) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-8 w-2/3" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <CardTitle className="text-2xl md:text-3xl font-bold text-foreground flex items-center">
              <BookHeart className="mr-3 h-7 w-7 text-primary" /> My Notebooks
            </CardTitle>
            <CardDescription>Organize your bookmarked questions and study materials.</CardDescription>
          </div>
          <Button onClick={handleOpenCreateModal} className="w-full md:w-auto">
            <PlusCircle className="mr-2 h-5 w-5" /> Create New Notebook
          </Button>
        </CardHeader>
        <CardContent>
           <p className="text-xs text-muted-foreground mb-4 italic">
            Note: Adding questions to notebooks is done from the question view or test result review pages.
          </p>
          <div className="flex flex-col md:flex-row gap-3 mb-6">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search notebooks by name..."
                className="pl-9 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full md:w-[200px]">
                <Filter className="mr-2 h-4 w-4 text-muted-foreground"/>
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {bookmarkCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isLoadingNotebooks && !error && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => <Skeleton key={`skel-nb-${i}`} className="h-40 rounded-lg" />)}
            </div>
          )}
          {error && (
            <Card className="text-center p-6 bg-destructive/10 border-destructive">
              <AlertCircle className="mx-auto h-10 w-10 text-destructive mb-3" />
              <CardTitle className="text-destructive">Error Loading Notebooks</CardTitle>
              <CardDescription className="text-destructive/80 whitespace-pre-wrap">{error}</CardDescription>
            </Card>
          )}
          {!isLoadingNotebooks && !error && filteredNotebooks.length === 0 && (
            <Card className="text-center p-10 border-dashed">
              <NotebookPen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <CardTitle className="text-xl">No Notebooks Found</CardTitle>
              <CardDescription>
                {searchTerm || filterCategory !== 'all' ? "No notebooks match your current filters." : "Click 'Create New Notebook' to get started."}
              </CardDescription>
            </Card>
          )}
          {!isLoadingNotebooks && !error && filteredNotebooks.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredNotebooks.map(nb => (
                <Card key={nb.id} className="shadow-md hover:shadow-lg transition-shadow flex flex-col">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-semibold text-primary truncate" title={nb.notebook_name}>
                      {nb.notebook_name}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Updated: {format(new Date(nb.updated), "dd MMM yyyy, p")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Questions: <span className="font-medium text-foreground">{nb.questionCount || 0}</span>
                    </p>
                    {nb.category && nb.category.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {nb.category.map(cat => (
                          <Badge key={cat} variant="secondary" className="text-xs">{cat}</Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="border-t pt-3 flex justify-end gap-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={Routes.viewNotebook(nb.id)}>
                        <EyeIcon className="mr-1.5 h-3.5 w-3.5"/> View
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleOpenEditModal(nb)}>
                      <Edit className="mr-1.5 h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteNotebook(nb.id, nb.notebook_name)}>
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Notebook Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingNotebook ? "Edit Notebook" : "Create New Notebook"}</DialogTitle>
            <DialogDescription>
              {editingNotebook ? "Update the details of your notebook." : "Give your new notebook a name and optionally assign categories."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitModal)} className="space-y-4 py-2">
              <FormField
                control={form.control}
                name="notebook_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notebook Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Tricky Physics Problems" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categories (Optional, select up to 2)</FormLabel>
                    <div className="space-y-2">
                      {bookmarkCategories.map((cat) => (
                        <FormField
                          key={cat}
                          control={form.control}
                          name="category"
                          render={({ field: checkboxField }) => {
                            return (
                              <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={checkboxField.value?.includes(cat)}
                                    onCheckedChange={(checked) => {
                                      let newValue = [...(checkboxField.value || [])];
                                      if (checked) {
                                        if (newValue.length < 2) {
                                          newValue.push(cat);
                                        } else {
                                          toast({ title: "Max 2 categories", description: "You can select up to two categories.", variant: "default" });
                                          return; 
                                        }
                                      } else {
                                        newValue = newValue.filter(value => value !== cat);
                                      }
                                      checkboxField.onChange(newValue);
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal text-sm">{cat}</FormLabel>
                              </FormItem>
                            );
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmittingModal}>Cancel</Button></DialogClose>
                <Button type="submit" disabled={isSubmittingModal}>
                  {isSubmittingModal && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingNotebook ? "Save Changes" : "Create Notebook"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
