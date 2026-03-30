import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [isVerifyingMfa, setIsVerifyingMfa] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { login, needsMfaVerification, user, logout } = useAuth();
  const isRecoveryMode = useMemo(() => {
    const hash = window.location.hash;
    const search = window.location.search;
    return hash.includes('type=recovery') || search.includes('type=recovery');
  }, []);

  useEffect(() => {
    if (isRecoveryMode && supabase) {
      void supabase.auth.getSession();
    }
  }, [isRecoveryMode]);

  useEffect(() => {
    if (!needsMfaVerification || !supabase) {
      setMfaFactorId(null);
      setMfaCode('');
      return;
    }

    void (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        console.error('Failed to load MFA factors for verification.', error);
        return;
      }

      const firstVerifiedFactor = data?.all?.find((factor) => factor.status === 'verified') ?? null;
      setMfaFactorId(firstVerifiedFactor?.id ?? null);
    })();
  }, [needsMfaVerification]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const success = await login(email, password);
      if (success) {
        toast.success('Login successful');
        navigate('/');
      } else {
        toast.error('Invalid credentials');
      }
    } catch (error) {
      toast.error('Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!supabase) {
      toast.error('Supabase is not configured');
      return;
    }

    if (!resetEmail) {
      toast.error('Enter an email address');
      return;
    }

    try {
      setIsSendingReset(true);
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/login`,
      });

      if (error) {
        throw error;
      }

      toast.success('Password reset email sent');
      setShowForgotPassword(false);
      setResetEmail('');
    } catch (error) {
      console.error('Failed to send password reset email.', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send reset email');
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!supabase) {
      toast.error('Supabase is not configured');
      return;
    }

    if (!resetPassword || !confirmResetPassword) {
      toast.error('Please fill in all password fields');
      return;
    }

    if (resetPassword !== confirmResetPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (resetPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    try {
      setIsResettingPassword(true);
      const { error } = await supabase.auth.updateUser({
        password: resetPassword,
      });

      if (error) {
        throw error;
      }

      toast.success('Password updated successfully');
      setResetPassword('');
      setConfirmResetPassword('');
      window.history.replaceState({}, document.title, '/login');
      navigate('/');
    } catch (error) {
      console.error('Failed to reset password.', error);
      toast.error(error instanceof Error ? error.message : 'Failed to reset password');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!supabase || !mfaFactorId) {
      toast.error('No MFA factor is available for verification');
      return;
    }

    if (!mfaCode) {
      toast.error('Enter the authenticator code');
      return;
    }

    try {
      setIsVerifyingMfa(true);
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: mfaFactorId,
        code: mfaCode,
      });

      if (error) {
        throw error;
      }

      toast.success('Two-factor verification complete');
      setMfaCode('');
      navigate('/');
    } catch (error) {
      console.error('Failed to verify MFA challenge.', error);
      toast.error(error instanceof Error ? error.message : 'Failed to verify MFA code');
    } finally {
      setIsVerifyingMfa(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img
              src="/lfzdc-logo.png"
              alt="Lekki Free Zone Development Company"
              className="h-20 w-20 object-contain"
            />
          </div>
          <CardTitle className="text-2xl font-bold">LFZ Fleet Management</CardTitle>
          <CardDescription>
            {isRecoveryMode
              ? 'Set a new password to recover access to your account'
              : needsMfaVerification
                ? 'Enter the code from your authenticator app to complete sign in'
              : 'Sign in to access the fleet management system'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isRecoveryMode ? (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resetPassword">New Password</Label>
                <Input
                  id="resetPassword"
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Enter your new password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmResetPassword">Confirm New Password</Label>
                <Input
                  id="confirmResetPassword"
                  type="password"
                  value={confirmResetPassword}
                  onChange={(e) => setConfirmResetPassword(e.target.value)}
                  placeholder="Confirm your new password"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isResettingPassword}>
                {isResettingPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Updating password...
                  </>
                ) : (
                  'Update Password'
                )}
              </Button>
            </form>
          ) : needsMfaVerification ? (
            <form onSubmit={handleVerifyMfa} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mfaCode">Authenticator Code</Label>
                <Input
                  id="mfaCode"
                  inputMode="numeric"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isVerifyingMfa || !mfaFactorId}>
                {isVerifyingMfa ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying code...
                  </>
                ) : (
                  'Verify Code'
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  void logout();
                  setMfaCode('');
                  setMfaFactorId(null);
                }}
              >
                Cancel Sign In
              </Button>
              <div className="text-center text-sm text-gray-500">
                <p>Signed in as {user?.email ?? email}. Complete MFA to continue.</p>
              </div>
            </form>
          ) : showForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resetEmail">Email</Label>
                <Input
                  id="resetEmail"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isSendingReset}>
                {isSendingReset ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending reset email...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setShowForgotPassword(false);
                  setResetEmail('');
                }}
              >
                Back to Sign In
              </Button>
            </form>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>
              <div className="mt-4 text-center text-sm text-gray-500 space-y-2">
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => {
                    setResetEmail(email);
                    setShowForgotPassword(true);
                  }}
                >
                  Forgot password?
                </button>
                <p>Use your Supabase user email and password to sign in.</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
