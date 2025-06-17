
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import pb from '@/lib/pocketbase';
import type { User, UserSubscriptionTierStudent } from '@/lib/types'; // Import UserSubscriptionTierStudent
import { useAuth } from '@/contexts/AuthContext';
import { Users, Save, RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { RecordModel } from 'pocketbase';

const userRoles: User['role'][] = ['User', 'Admin', 'Teacher'];
// Correctly define the array of student subscription tiers
const userSubscriptionTiers: UserSubscriptionTierStudent[] = ['Free', 'Chapterwise', 'Full_length', 'Dpp', 'Combo'];

const mapRecordToUserDisplay = (record: RecordModel): User => ({
  id: record.id,
  email: record.email || '',
  name: record.name || 'Unnamed User',
  username: record.username || '',
  verified: record.verified || false,
  grade: record.class as User['grade'],
  phoneNumber: record.phone as User['phoneNumber'],
  studentSubscriptionTier: record.model as UserSubscriptionTierStudent, // Mapped from 'model'
  role: record.role as User['role'],
  avatarUrl: record.avatarUrl ? pb.files.getUrl(record, record.avatarUrl as string) : (record.avatar ? pb.files.getUrl(record, record.avatar as string) : `https://ui-avatars.com/api/?name=${encodeURIComponent(record.name?.charAt(0) || 'U')}&background=random&color=fff&size=128`),
  favExam: record.favExam as User['favExam'],
  totalPoints: record.totalPoints as User['totalPoints'],
  targetYear: record.targetYear as User['targetYear'],
  referralCode: record.referralCode as User['referralCode'],
  referredByCode: record.referredByCode as User['referredByCode'],
  referralStats: record.referralStats as User['referralStats'],
  studyPlan: record.studyPlan,
  joineddate: record.joineddate,
  created: record.created,
  updated: record.updated,
  collectionId: record.collectionId,
  collectionName: record.collectionName,
  emailVisibility: record.emailVisibility,
  // teacher specific fields are undefined here
  teacherSubscriptionTier: undefined,
  institute_name: undefined,
  total_students: undefined,
  level: undefined,
  EduNexus_Name: undefined,
  teacherFavExams: undefined,
  about: undefined,
  subjects_offered: undefined,
  used_free_trial: undefined,
  can_create_ads: undefined,
  ads_subscription: undefined,
  subscription_by_teacher: record.subscription_by_teacher,
});


export default function UserManagementPage() {
  const { user: adminUser, isLoading: authLoading } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // State to hold edits for role and studentSubscriptionTier
  const [editingUserState, setEditingUserState] = useState<Record<string, { role: User['role'], studentSubscriptionTier: UserSubscriptionTierStudent | undefined }>>({});

  const fetchUsers = useCallback(async () => {
    if (authLoading || !adminUser?.id || adminUser.role !== 'Admin') {
      setIsLoadingUsers(false);
      return;
    }
    setIsLoadingUsers(true);
    setError(null);
    try {
      const records = await pb.collection('users').getFullList<RecordModel>({});
      const mappedUsers = records.map(mapRecordToUserDisplay);
      setUsers(mappedUsers);

      const initialEditingState: Record<string, { role: User['role'], studentSubscriptionTier: UserSubscriptionTierStudent | undefined }> = {};
      mappedUsers.forEach(user => {
        initialEditingState[user.id] = {
          role: user.role,
          studentSubscriptionTier: user.studentSubscriptionTier // Use studentSubscriptionTier
        };
      });
      setEditingUserState(initialEditingState);
    } catch (err: any) {
      if (err.name === 'AbortError' || err.isAbort) {
        console.log('Fetch users request was aborted');
      } else {
        console.error('Failed to fetch users:', err);
        setError('Could not load users. Please try again later. Details: ' + (err.message || 'Unknown error'));
        toast({ title: "Error Fetching Users", description: err.message || 'Unknown error', variant: "destructive" });
      }
    } finally {
      setIsLoadingUsers(false);
    }
  }, [adminUser?.id, adminUser?.role, authLoading, toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = (userId: string, newRole: User['role']) => {
    setEditingUserState(prev => ({
      ...prev,
      [userId]: { ...(prev[userId] || { role: newRole, studentSubscriptionTier: undefined }), role: newRole }
    }));
  };

  // Corrected to handle studentSubscriptionTier
  const handleStudentTierChange = (userId: string, newTier: UserSubscriptionTierStudent) => {
    setEditingUserState(prev => ({
      ...prev,
      [userId]: { ...(prev[userId] || { role: 'User', studentSubscriptionTier: newTier }), studentSubscriptionTier: newTier }
    }));
  };

  const handleSaveChanges = async (userId: string) => {
    const userToUpdate = users.find(u => u.id === userId);
    const changes = editingUserState[userId];

    if (!userToUpdate || !changes) {
      toast({ title: "Error", description: "User data not found for update.", variant: "destructive" });
      return;
    }

    // Compare with studentSubscriptionTier
    if (changes.role === userToUpdate.role && changes.studentSubscriptionTier === userToUpdate.studentSubscriptionTier) {
        toast({ title: "No Changes", description: "No modifications made to role or subscription tier." });
        return;
    }

    const oldRole = userToUpdate.role;
    const oldStudentSubscriptionTier = userToUpdate.studentSubscriptionTier;

    try {
      await pb.collection('users').update(userId, {
        role: changes.role,
        model: changes.studentSubscriptionTier, // PocketBase 'users' collection uses 'model' field for tier
      });
      toast({ title: "User Updated", description: `${userToUpdate.name}'s profile has been successfully updated.` });
      setUsers(prevUsers => prevUsers.map(u =>
        u.id === userId ? { ...u, role: changes.role, studentSubscriptionTier: changes.studentSubscriptionTier } : u
      ));

      if (adminUser?.id) {
        let logMessage = `Admin ${adminUser.name} (ID: ${adminUser.id}) updated user ${userToUpdate.name} (ID: ${userToUpdate.id}). `;
        if (oldRole !== changes.role) {
          logMessage += `Role changed from ${oldRole || 'N/A'} to ${changes.role || 'N/A'}. `;
        }
        if (oldStudentSubscriptionTier !== changes.studentSubscriptionTier) {
          logMessage += `Subscription tier changed from ${oldStudentSubscriptionTier || 'N/A'} to ${changes.studentSubscriptionTier || 'N/A'}.`;
        }

        try {
          await pb.collection('website_messages').create({
            user: adminUser.id,
            message: logMessage.trim(),
          });
          console.log("User update action logged to website_messages.");
        } catch (logError) {
          console.error("Failed to log user update action to website_messages:", logError);
        }
      }

    } catch (err: any) {
      console.error('Failed to update user:', err);
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    }
  };

  const getAvatarFallback = (name: string) => {
    const nameParts = name.split(' ');
    return nameParts.length > 1 ? nameParts[0][0] + nameParts[nameParts.length - 1][0] : name.substring(0, 2).toUpperCase();
  };

  if (isLoadingUsers || authLoading) {
    return (
      <div className="space-y-8 p-4 md:p-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl md:text-3xl font-bold text-foreground flex items-center">
              <Users className="mr-3 h-8 w-8 text-primary" /> User Management
            </CardTitle>
            <CardDescription>Loading user data...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8 p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-foreground flex items-center">
              <Users className="mr-3 h-8 w-8 text-primary" /> User Management
            </CardTitle>
            <CardDescription>Manage all users of the platform.</CardDescription>
          </CardHeader>
          <CardContent className="text-center p-10 bg-destructive/10 border-destructive">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <CardTitle className="text-destructive">Error Loading Users</CardTitle>
            <CardDescription className="text-destructive/80">{error}</CardDescription>
            <Button onClick={fetchUsers} variant="outline" className="mt-4">
              <RefreshCw className="mr-2 h-4 w-4" /> Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row justify-between items-center">
          <div>
            <CardTitle className="text-2xl md:text-3xl font-bold text-foreground flex items-center">
              <Users className="mr-3 h-8 w-8 text-primary" /> User Management
            </CardTitle>
            <CardDescription>
              View, edit roles, and manage subscription tiers for platform users. Total users: {users.length}
            </CardDescription>
          </div>
          <Button onClick={fetchUsers} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh List
          </Button>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-10">
              <Users className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-xl font-semibold text-muted-foreground">No Users Found</p>
              <p className="text-sm text-muted-foreground">The user list is currently empty.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Avatar</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Current Role</TableHead>
                    <TableHead>Current Tier</TableHead>
                    <TableHead className="w-[180px]">Change Role</TableHead>
                    <TableHead className="w-[200px]">Change Tier</TableHead>
                    <TableHead className="w-[120px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.avatarUrl} alt={user.name} />
                          <AvatarFallback>{getAvatarFallback(user.name)}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>{user.role}</TableCell>
                      <TableCell>{user.studentSubscriptionTier || 'N/A'}</TableCell> {/* Display studentSubscriptionTier */}
                      <TableCell>
                        <Select
                          value={editingUserState[user.id]?.role || user.role}
                          onValueChange={(newRole) => handleRoleChange(user.id, newRole as User['role'])}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            {userRoles.map(role => (
                              <SelectItem key={role} value={role || ''}>{role}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={editingUserState[user.id]?.studentSubscriptionTier || user.studentSubscriptionTier || ''}
                          onValueChange={(newTier) => handleStudentTierChange(user.id, newTier as UserSubscriptionTierStudent)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select tier" />
                          </SelectTrigger>
                          <SelectContent>
                            {userSubscriptionTiers.map(tier => (
                              <SelectItem key={tier} value={tier}>{tier}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => handleSaveChanges(user.id)}
                          disabled={
                            !editingUserState[user.id] ||
                            (editingUserState[user.id]?.role === user.role && editingUserState[user.id]?.studentSubscriptionTier === user.studentSubscriptionTier)
                          }
                        >
                          <Save className="mr-2 h-4 w-4" /> Save
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
    
    