import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

function hasPasswordRecoveryParams() {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

  return (
    searchParams.get('type') === 'recovery' ||
    hashParams.get('type') === 'recovery' ||
    searchParams.get('recovery') === 'true' ||
    searchParams.has('code')
  );
}

function getAuthRequestErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : '';

  if (/failed to fetch|gateway timeout|network request failed/i.test(message)) {
    return 'The authentication service is temporarily unavailable. Please try again in a few minutes.';
  }

  return message || fallback;
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showConfirmResetPassword, setShowConfirmResetPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(hasPasswordRecoveryParams);
  const [isRecoverySessionReady, setIsRecoverySessionReady] = useState(false);
  const [isCheckingRecoveryMfa, setIsCheckingRecoveryMfa] = useState(false);
  const [recoveryNeedsMfa, setRecoveryNeedsMfa] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [isVerifyingMfa, setIsVerifyingMfa] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { login, needsMfaVerification, user, logout, refreshUser } = useAuth();

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const recoveryParamsPresent = hasPasswordRecoveryParams();
    if (!recoveryParamsPresent) {
      return;
    }

    let recoveryCheckFinished = false;
    const recoveryCheckTimeout = window.setTimeout(() => {
      if (recoveryCheckFinished) {
        return;
      }

      recoveryCheckFinished = true;
      setIsRecoveryMode(true);
      setIsRecoverySessionReady(false);
      setRecoveryError(
        'This password reset link is invalid or has expired. Request a new link and try again.'
      );
    }, 6000);
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== 'PASSWORD_RECOVERY') {
        return;
      }

      recoveryCheckFinished = true;
      window.clearTimeout(recoveryCheckTimeout);
      setIsRecoveryMode(true);
      setIsRecoverySessionReady(Boolean(session));
      setRecoveryError(session ? null : 'This password reset link is invalid or has expired.');
    });

    void (async () => {
      const { data, error } = await supabase.auth.getSession();

      if (recoveryCheckFinished) {
        return;
      }

      recoveryCheckFinished = true;
      window.clearTimeout(recoveryCheckTimeout);
      setIsRecoveryMode(true);
      setIsRecoverySessionReady(Boolean(data.session));
      setRecoveryError(
        error
          ? getAuthRequestErrorMessage(
              error,
              'This password reset link could not be validated. Request a new link and try again.'
            )
          : !data.session
            ? 'This password reset link is invalid or has expired. Request a new link and try again.'
            : null
      );
    })();

    return () => {
      subscription.unsubscribe();
      window.clearTimeout(recoveryCheckTimeout);
    };
  }, []);

  useEffect(() => {
    if (isRecoveryMode || !needsMfaVerification || !supabase) {
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
  }, [isRecoveryMode, needsMfaVerification]);

  useEffect(() => {
    if (!isRecoveryMode || !isRecoverySessionReady || !supabase) {
      setIsCheckingRecoveryMfa(false);
      setRecoveryNeedsMfa(false);
      return;
    }

    let isCancelled = false;

    void (async () => {
      setIsCheckingRecoveryMfa(true);

      try {
        const { data: assurance, error: assuranceError } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

        if (assuranceError) {
          throw assuranceError;
        }

        const requiresMfa =
          assurance.nextLevel === 'aal2' && assurance.currentLevel !== 'aal2';

        if (!requiresMfa) {
          if (!isCancelled) {
            setRecoveryNeedsMfa(false);
            setMfaFactorId(null);
          }
          return;
        }

        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();

        if (factorsError) {
          throw factorsError;
        }

        const firstVerifiedFactor =
          factors?.all?.find((factor) => factor.status === 'verified') ?? null;

        if (!firstVerifiedFactor) {
          throw new Error(
            'This account requires two-factor verification, but no verified authenticator was found.'
          );
        }

        if (!isCancelled) {
          setMfaFactorId(firstVerifiedFactor.id);
          setRecoveryNeedsMfa(true);
        }
      } catch (error) {
        console.error('Failed to check MFA requirements for password recovery.', error);
        if (!isCancelled) {
          setRecoveryError(
            getAuthRequestErrorMessage(
              error,
              'We could not check this account\'s security settings. Request a new reset link and try again.'
            )
          );
        }
      } finally {
        if (!isCancelled) {
          setIsCheckingRecoveryMfa(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [isRecoveryMode, isRecoverySessionReady]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const success = await login(email, password);
      if (success) {
        if (!supabase) {
          toast.error('Supabase is not configured');
          return;
        }

        const { data: assurance, error: assuranceError } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

        if (assuranceError) {
          throw assuranceError;
        }

        await refreshUser();

        if (assurance.nextLevel === 'aal2' && assurance.currentLevel !== 'aal2') {
          toast.info('Enter your authenticator code to complete sign in.');
          return;
        }

        toast.success('Login successful');
        navigate('/', { replace: true });
      } else {
        toast.error('Invalid credentials');
      }
    } catch {
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
      const recoveryUrl = new URL('/login', window.location.origin);
      recoveryUrl.searchParams.set('type', 'recovery');

      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: recoveryUrl.toString(),
      });

      if (error) {
        throw error;
      }

      toast.success('Password reset email sent');
      setShowForgotPassword(false);
      setResetEmail('');
    } catch (error) {
      console.error('Failed to send password reset email.', error);
      toast.error(getAuthRequestErrorMessage(error, 'Failed to send reset email'));
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
      setIsRecoveryMode(false);
      setIsRecoverySessionReady(false);
      setRecoveryError(null);
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Failed to reset password.', error);
      const message = error instanceof Error ? error.message : '';

      if (/aal2 session is required/i.test(message)) {
        setRecoveryNeedsMfa(true);
        toast.error('Verify your authenticator code before updating your password.');
      } else {
        toast.error(message || 'Failed to reset password');
      }
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

    const normalizedMfaCode = mfaCode.replace(/\s/g, '');
    if (!/^\d{6}$/.test(normalizedMfaCode)) {
      toast.error('Enter the 6-digit code from your authenticator app');
      return;
    }

    try {
      setIsVerifyingMfa(true);
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: mfaFactorId,
        code: normalizedMfaCode,
      });

      if (error) {
        throw error;
      }

      setMfaCode('');

      if (isRecoveryMode) {
        setRecoveryNeedsMfa(false);
        setMfaFactorId(null);
        toast.success('Identity verified. You can now create your new password.');
      } else {
        await refreshUser();
        toast.success('Two-factor verification complete');
        navigate('/', { replace: true });
      }
    } catch (error) {
      console.error('Failed to verify MFA challenge.', error);
      toast.error(error instanceof Error ? error.message : 'Failed to verify MFA code');
    } finally {
      setIsVerifyingMfa(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-[#f3f4f1] lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-[#111d62] p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        <img
          src="/lekki-free-zone-login.jpg"
          alt="Lekki Free Trade Zone facility"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(13,22,71,0.65)_0%,rgba(13,22,71,0.12)_35%,rgba(13,22,71,0.9)_100%)]" />
        <div className="relative flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-lg">
            <img src="/lfzdc-logo.png" alt="LFZDC Logo" className="h-12 w-12 object-contain" />
          </span>
          <span>
            <span className="block text-lg font-semibold tracking-tight">LFZ Fleet</span>
            <span className="mt-0.5 block text-xs text-blue-100">Lekki Free Zone Development Company</span>
          </span>
        </div>

        <div className="relative max-w-xl">
          <h1 className="text-4xl font-semibold leading-tight tracking-[-0.035em] xl:text-5xl">
            Fleet management<br />at Lekki Free Zone.
          </h1>
          <p className="mt-5 max-w-sm text-base leading-7 text-blue-100">
            Vehicles, drivers and daily records for the LFZDC transport team.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-10 lg:px-16">
      <Card className="w-full max-w-md border-0 bg-transparent shadow-none">
        <CardHeader className="px-0 text-left">
          <div className="mb-5 flex items-center gap-3 lg:hidden">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/[0.06]">
              <img src="/lfzdc-logo.png" alt="LFZDC Logo" className="h-10 w-10 object-contain" />
            </span>
            <span className="font-semibold text-[#111d62]">LFZ Fleet</span>
          </div>
          <CardTitle className="text-3xl font-semibold tracking-[-0.04em]">
            {isRecoveryMode
              ? recoveryNeedsMfa
                ? 'Verify your identity'
                : 'Create new password'
              : needsMfaVerification
                ? 'Verify your identity'
                : showForgotPassword ? 'Reset your password' : 'Sign in'}
          </CardTitle>
          <CardDescription>
            {isRecoveryMode
              ? recoveryNeedsMfa
                ? 'Enter the code from your authenticator app before changing your password'
                : 'Set a new password to recover access to your account'
              : needsMfaVerification
                ? 'Enter the code from your authenticator app to complete sign in'
              : showForgotPassword ? 'We will email you a link to choose a new password.' : 'Use your staff account to access fleet records.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pt-2">
          {isRecoveryMode ? (
            recoveryError ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
                  {recoveryError}
                </div>
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => {
                    window.history.replaceState({}, document.title, '/login');
                    setIsRecoveryMode(false);
                    setRecoveryError(null);
                    setShowForgotPassword(true);
                  }}
                >
                  Request Another Link
                </Button>
              </div>
            ) : !isRecoverySessionReady || isCheckingRecoveryMfa ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                {isRecoverySessionReady
                  ? 'Checking account security...'
                  : 'Validating password reset link...'}
              </div>
            ) : recoveryNeedsMfa ? (
              <form onSubmit={handleVerifyMfa} className="space-y-4">
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-[#111d62]">
                  Open the authenticator app used for this account and enter its current 6-digit code.
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recoveryMfaCode">Authenticator Code</Label>
                  <Input
                    id="recoveryMfaCode"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit code"
                    autoFocus
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isVerifyingMfa || !mfaFactorId}
                >
                  {isVerifyingMfa ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying code...
                    </>
                  ) : (
                    'Verify and Continue'
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="resetPassword">New Password</Label>
                  <div className="relative">
                    <Input
                      id="resetPassword"
                      type={showResetPassword ? 'text' : 'password'}
                      className="pr-11"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      placeholder="Enter your new password"
                      required
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-400 transition-colors hover:text-[#111d62]"
                      onClick={() => setShowResetPassword((visible) => !visible)}
                      aria-label={showResetPassword ? 'Hide new password' : 'Show new password'}
                      aria-pressed={showResetPassword}
                    >
                      {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmResetPassword">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmResetPassword"
                      type={showConfirmResetPassword ? 'text' : 'password'}
                      className="pr-11"
                      value={confirmResetPassword}
                      onChange={(e) => setConfirmResetPassword(e.target.value)}
                      placeholder="Confirm your new password"
                      required
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-400 transition-colors hover:text-[#111d62]"
                      onClick={() => setShowConfirmResetPassword((visible) => !visible)}
                      aria-label={showConfirmResetPassword ? 'Hide confirmed password' : 'Show confirmed password'}
                      aria-pressed={showConfirmResetPassword}
                    >
                      {showConfirmResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isResettingPassword}>
                  {isResettingPassword ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating password...
                    </>
                  ) : (
                    'Update Password'
                  )}
                </Button>
              </form>
            )
          ) : needsMfaVerification ? (
            <form onSubmit={handleVerifyMfa} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mfaCode">Authenticator Code</Label>
                <Input
                  id="mfaCode"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
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
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      className="pr-11"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-400 transition-colors hover:text-[#111d62]"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="mt-2 h-11 w-full" disabled={isLoading}>
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
                <p className="text-xs text-gray-400">Protected access for registered LFZDC personnel.</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      </section>
    </div>
  );
}
