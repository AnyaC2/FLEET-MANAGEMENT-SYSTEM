import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { User, Mail, Shield, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';

const roleLabels: Record<string, string> = {
  system_admin: 'System Admin',
  editor: 'Editor',
  end_user: 'End User',
};

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isMfaDialogOpen, setIsMfaDialogOpen] = useState(false);
  const [isLoadingMfa, setIsLoadingMfa] = useState(true);
  const [isEnrollingMfa, setIsEnrollingMfa] = useState(false);
  const [isVerifyingMfaSetup, setIsVerifyingMfaSetup] = useState(false);
  const [isDisablingMfa, setIsDisablingMfa] = useState(false);
  const [mfaFriendlyName, setMfaFriendlyName] = useState('LFZ Fleet Authenticator');
  const [mfaSetupCode, setMfaSetupCode] = useState('');
  const [mfaState, setMfaState] = useState<{
    currentLevel: string | null;
    nextLevel: string | null;
    verifiedFactorId: string | null;
    verifiedFriendlyName: string | null;
    pendingFactorId: string | null;
    qrCode: string | null;
    secret: string | null;
    uri: string | null;
  }>({
    currentLevel: null,
    nextLevel: null,
    verifiedFactorId: null,
    verifiedFriendlyName: null,
    pendingFactorId: null,
    qrCode: null,
    secret: null,
    uri: null,
  });
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });

  useEffect(() => {
    setFormData({
      name: user?.name || '',
      email: user?.email || '',
    });
  }, [user]);

  const handleSave = async () => {
    if (!supabase || !user) {
      toast.error('You need to be logged in to update your profile');
      return;
    }

    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error('Name and email are required');
      return;
    }

    try {
      setIsSavingProfile(true);

      if (formData.email.trim() !== user.email) {
        const { error: authUpdateError } = await supabase.auth.updateUser({
          email: formData.email.trim(),
        });

        if (authUpdateError) {
          throw authUpdateError;
        }
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: formData.name.trim(),
          email: formData.email.trim(),
        })
        .eq('id', user.id);

      if (profileError) {
        throw profileError;
      }

      await refreshUser();
      toast.success(
        formData.email.trim() !== user.email
          ? 'Profile updated. Check your inbox if Supabase asks you to confirm the new email.'
          : 'Profile updated successfully'
      );
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update profile.', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const loadMfaState = async () => {
    if (!supabase) {
      return;
    }

    try {
      setIsLoadingMfa(true);
      const [{ data: factorsData, error: factorsError }, { data: assuranceData, error: assuranceError }] =
        await Promise.all([
          supabase.auth.mfa.listFactors(),
          supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        ]);

      if (factorsError) {
        throw factorsError;
      }

      if (assuranceError) {
        throw assuranceError;
      }

      const verifiedFactor = factorsData?.all?.find((factor) => factor.status === 'verified') ?? null;
      const pendingFactor = factorsData?.all?.find((factor) => factor.status !== 'verified') ?? null;

      setMfaState((prev) => ({
        ...prev,
        currentLevel: assuranceData.currentLevel,
        nextLevel: assuranceData.nextLevel,
        verifiedFactorId: verifiedFactor?.id ?? null,
        verifiedFriendlyName: verifiedFactor?.friendly_name ?? null,
        pendingFactorId: pendingFactor?.id ?? prev.pendingFactorId,
      }));
    } catch (error) {
      console.error('Failed to load MFA state.', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load two-factor status');
    } finally {
      setIsLoadingMfa(false);
    }
  };

  useEffect(() => {
    if (!user) {
      return;
    }

    void loadMfaState();
  }, [user]);

  const handlePasswordChange = async () => {
    if (!supabase) {
      toast.error('Supabase is not configured');
      return;
    }

    if (!passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    try {
      setIsChangingPassword(true);
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });

      if (error) {
        throw error;
      }

      toast.success('Password changed successfully');
      setPasswordForm({
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      console.error('Failed to change password.', error);
      toast.error(error instanceof Error ? error.message : 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleStartMfaEnrollment = async () => {
    if (!supabase) {
      toast.error('Supabase is not configured');
      return;
    }

    try {
      setIsEnrollingMfa(true);
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: mfaFriendlyName,
      });

      if (error) {
        throw error;
      }

      setMfaState((prev) => ({
        ...prev,
        pendingFactorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
        uri: data.totp.uri,
      }));
      setMfaSetupCode('');
      setIsMfaDialogOpen(true);
      toast.success('Authenticator setup started');
    } catch (error) {
      console.error('Failed to enroll MFA factor.', error);
      toast.error(error instanceof Error ? error.message : 'Failed to start MFA setup');
    } finally {
      setIsEnrollingMfa(false);
    }
  };

  const handleVerifyMfaSetup = async () => {
    if (!supabase || !mfaState.pendingFactorId) {
      toast.error('No pending MFA setup found');
      return;
    }

    if (!mfaSetupCode) {
      toast.error('Enter the code from your authenticator app');
      return;
    }

    try {
      setIsVerifyingMfaSetup(true);
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: mfaState.pendingFactorId,
        code: mfaSetupCode,
      });

      if (error) {
        throw error;
      }

      toast.success('Two-factor authentication enabled');
      setIsMfaDialogOpen(false);
      setMfaSetupCode('');
      setMfaState((prev) => ({
        ...prev,
        pendingFactorId: null,
        qrCode: null,
        secret: null,
        uri: null,
      }));
      await loadMfaState();
    } catch (error) {
      console.error('Failed to verify MFA setup.', error);
      toast.error(error instanceof Error ? error.message : 'Failed to verify MFA code');
    } finally {
      setIsVerifyingMfaSetup(false);
    }
  };

  const handleDisableMfa = async () => {
    if (!supabase || !mfaState.verifiedFactorId) {
      toast.error('No verified MFA factor found');
      return;
    }

    try {
      setIsDisablingMfa(true);
      const { error } = await supabase.auth.mfa.unenroll({
        factorId: mfaState.verifiedFactorId,
      });

      if (error) {
        throw error;
      }

      toast.success('Two-factor authentication disabled');
      await loadMfaState();
    } catch (error) {
      console.error('Failed to disable MFA.', error);
      toast.error(error instanceof Error ? error.message : 'Failed to disable MFA');
    } finally {
      setIsDisablingMfa(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="text-gray-500">Manage your account information</p>
      </div>

      {/* Profile card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User info card */}
        <Card className="lg:col-span-1">
          <CardContent className="p-6 text-center">
            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-12 h-12 text-primary" />
            </div>
            <h2 className="text-xl font-bold">{user.name}</h2>
            <p className="text-gray-500">{user.email}</p>
            <Badge variant="secondary" className="mt-2">
              {roleLabels[user.role]}
            </Badge>
            <div className="mt-4 pt-4 border-t text-sm text-gray-500">
              <p>Member since {format(new Date(user.createdAt), 'MMMM yyyy')}</p>
            </div>
          </CardContent>
        </Card>

        {/* Edit profile form */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    disabled={!isEditing}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                    disabled={!isEditing}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="role"
                    value={roleLabels[user.role]}
                    disabled
                    className="pl-10 bg-gray-50"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="createdAt">Member Since</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="createdAt"
                    value={format(new Date(user.createdAt), 'MMM d, yyyy')}
                    disabled
                    className="pl-10 bg-gray-50"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 flex gap-2">
              {isEditing ? (
                <>
                  <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isSavingProfile}>
                    Cancel
                  </Button>
                  <Button onClick={() => void handleSave()} disabled={isSavingProfile}>
                    {isSavingProfile ? 'Saving...' : 'Save Changes'}
                  </Button>
                </>
              ) : (
                <Button onClick={() => setIsEditing(true)}>Edit Profile</Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Security section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium">Password</p>
              <p className="text-sm text-gray-500">Update your account password securely</p>
            </div>
            <Button
              variant="outline"
              onClick={() =>
                document.getElementById('newPassword')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }
            >
              Change Password
            </Button>
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium">Two-Factor Authentication</p>
              <p className="text-sm text-gray-500">
                {isLoadingMfa
                  ? 'Checking status...'
                  : mfaState.verifiedFactorId
                    ? `Enabled${mfaState.verifiedFriendlyName ? ` with ${mfaState.verifiedFriendlyName}` : ''}`
                    : 'Not enabled'}
              </p>
            </div>
            {mfaState.verifiedFactorId ? (
              <Button variant="outline" onClick={() => void handleDisableMfa()} disabled={isDisablingMfa}>
                {isDisablingMfa ? 'Disabling 2FA...' : 'Disable 2FA'}
              </Button>
            ) : (
              <Button variant="outline" onClick={() => void handleStartMfaEnrollment()} disabled={isEnrollingMfa}>
                {isEnrollingMfa ? 'Preparing 2FA...' : 'Enable 2FA'}
              </Button>
            )}
          </div>
          <div className="p-4 border rounded-lg space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                placeholder="Enter a new password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                placeholder="Confirm your new password"
              />
            </div>
            <Button onClick={() => void handlePasswordChange()} disabled={isChangingPassword}>
              {isChangingPassword ? 'Updating Password...' : 'Update Password'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isMfaDialogOpen} onOpenChange={setIsMfaDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Scan the QR code with your authenticator app, then enter the 6-digit code to verify setup.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {mfaState.qrCode && (
              <div className="flex justify-center rounded-lg border bg-white p-4">
                <img src={mfaState.qrCode} alt="Authenticator QR code" className="h-48 w-48" />
              </div>
            )}
            {mfaState.secret && (
              <div className="rounded-lg bg-gray-50 p-3 text-sm">
                <p className="font-medium text-gray-900">Manual setup key</p>
                <p className="mt-1 break-all font-mono text-gray-600">{mfaState.secret}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="mfaFriendlyName">Authenticator Name</Label>
              <Input
                id="mfaFriendlyName"
                value={mfaFriendlyName}
                onChange={(e) => setMfaFriendlyName(e.target.value)}
                placeholder="e.g. LFZ Fleet Authenticator"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mfaSetupCode">Verification Code</Label>
              <Input
                id="mfaSetupCode"
                inputMode="numeric"
                value={mfaSetupCode}
                onChange={(e) => setMfaSetupCode(e.target.value)}
                placeholder="Enter 6-digit code"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsMfaDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleVerifyMfaSetup()} disabled={isVerifyingMfaSetup}>
              {isVerifyingMfaSetup ? 'Verifying...' : 'Verify and Enable'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
