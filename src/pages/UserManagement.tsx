import { useEffect, useState } from 'react';
import type { User } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { supabase, supabaseAnonKey, supabaseUrl } from '@/lib/supabase';
import { normalizeRole, type CanonicalRole } from '@/lib/rbac';

type ManagedUser = User & {
  profileStatus: string;
};

const roleLabels: Record<CanonicalRole, string> = {
  system_admin: 'System Admin',
  editor: 'Editor',
  end_user: 'End User',
};

export default function UserManagement() {
  const { canManageUsers, user: currentUser } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [userPendingDelete, setUserPendingDelete] = useState<ManagedUser | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'end_user' as CanonicalRole,
    department: '',
  });

  useEffect(() => {
    void loadUsers();
  }, []);

  const loadUsers = async () => {
    if (!supabase || !canManageUsers) {
      setUsers([]);
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, name, role, department, avatar_url, status, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load user accounts');
      setIsLoading(false);
      return;
    }

    setUsers(
      (data ?? []).map((profile) => ({
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: normalizeRole(profile.role as User['role']),
        department: profile.department || undefined,
        avatar: profile.avatar_url || undefined,
        status: profile.status,
        profileStatus: profile.status,
        createdAt: profile.created_at,
      }))
    );
    setIsLoading(false);
  };

  const handleRoleChange = async (userId: string, role: CanonicalRole) => {
    if (!supabase) {
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId);

    if (error) {
      toast.error('Failed to update user role');
      return;
    }

    toast.success('User role updated');
    await loadUsers();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'end_user',
      department: '',
    });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!supabase) {
      toast.error('Supabase is not configured');
      return;
    }

    if (!formData.name || !formData.email || !formData.password || !formData.role) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsCreatingUser(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token || !supabaseUrl || !supabaseAnonKey) {
      toast.error('No active session found for user creation');
      setIsCreatingUser(false);
      return;
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${session.access_token}`,
        'x-access-token': session.access_token,
      },
      body: JSON.stringify({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        department: formData.department || null,
      }),
    });

    const responseBody = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error(responseBody?.error || 'Failed to create user account');
      setIsCreatingUser(false);
      return;
    }

    toast.success('User account created');
    setIsCreateDialogOpen(false);
    resetForm();
    setIsCreatingUser(false);
    await loadUsers();
  };

  const handleDeleteUser = async () => {
    if (!supabase || !userPendingDelete) {
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token || !supabaseUrl || !supabaseAnonKey) {
      toast.error('No active session found for user deletion');
      return;
    }

    try {
      setIsDeletingUser(true);
      const response = await fetch(`${supabaseUrl}/functions/v1/delete-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${session.access_token}`,
          'x-access-token': session.access_token,
        },
        body: JSON.stringify({
          userId: userPendingDelete.id,
        }),
      });

      const responseBody = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(responseBody?.error || 'Failed to delete user account');
      }

      toast.success('User account deleted');
      setUserPendingDelete(null);
      await loadUsers();
    } catch (error) {
      console.error('Failed to delete user account.', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete user account');
    } finally {
      setIsDeletingUser(false);
    }
  };

  if (!canManageUsers) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-gray-500">
          You do not have permission to manage user accounts.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <p className="text-gray-500">Assign roles to existing user accounts.</p>
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Create User
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create User Account</DialogTitle>
            <DialogDescription>
              Create a new login and assign one of the three app roles.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUser}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Temporary Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, role: value as CanonicalRole }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(roleLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => setFormData((prev) => ({ ...prev, department: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreatingUser}>
                {isCreatingUser ? 'Creating...' : 'Create User'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4 text-sm text-amber-900">
          Account creation uses a secure Supabase Edge Function. If the button fails, deploy the setup in
          `/docs/user-management-setup.md`.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5" />
            User Accounts
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-gray-500">
                    Loading users...
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-gray-500">
                    No user accounts found.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{user.profileStatus || 'Active'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.role as CanonicalRole}
                        disabled={currentUser?.id === user.id}
                        onValueChange={(value) => void handleRoleChange(user.id, value as CanonicalRole)}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(roleLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {currentUser?.id === user.id && (
                        <p className="mt-1 text-xs text-gray-500">
                          Your own role cannot be changed here.
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={
                          currentUser?.id === user.id ||
                          (user.role === 'system_admin' &&
                            users.filter((item) => item.role === 'system_admin').length <= 1)
                        }
                        onClick={() => setUserPendingDelete(user)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(userPendingDelete)} onOpenChange={(open) => !open && setUserPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User Account</AlertDialogTitle>
            <AlertDialogDescription>
              {userPendingDelete
                ? `This will permanently remove ${userPendingDelete.name} (${userPendingDelete.email}) from the app and Supabase Auth. They will lose access immediately.`
                : 'This will permanently remove the selected user account.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingUser}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={isDeletingUser}
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteUser();
              }}
            >
              {isDeletingUser ? 'Deleting...' : 'Delete User'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
