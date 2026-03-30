import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, UserRole } from '@/types';
import { hasPermission, normalizeRole } from '@/lib/rbac';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
  canManageRecords: boolean;
  canManageUsers: boolean;
  isLoading: boolean;
  needsMfaVerification: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface ProfileRecord {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department: string | null;
  avatar_url: string | null;
  status: string;
  created_at: string;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    promise
      .then((value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function mapProfileToUser(profile: ProfileRecord): User {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: normalizeRole(profile.role),
    avatar: profile.avatar_url || undefined,
    department: profile.department || undefined,
    status: profile.status,
    createdAt: profile.created_at,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsMfaVerification, setNeedsMfaVerification] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    const supabaseClient = supabase;
    let isMounted = true;

    const loadProfile = async (userId: string): Promise<User | null> => {
      const { data: profile, error } = await withTimeout(
        (async () =>
          supabaseClient
            .from('profiles')
            .select('id, email, name, role, department, avatar_url, status, created_at')
            .eq('id', userId)
            .maybeSingle<ProfileRecord>())(),
        8000,
        'Timed out while loading user profile'
      );

      if (error) {
        throw error;
      }

      return profile ? mapProfileToUser(profile) : null;
    };

    const loadMfaRequirement = async (): Promise<boolean> => {
      const { data, error } = await supabaseClient.auth.mfa.getAuthenticatorAssuranceLevel();

      if (error) {
        throw error;
      }

      return data.nextLevel === 'aal2' && data.currentLevel !== 'aal2';
    };

    const loadSession = async () => {
      try {
        const {
          data: { session },
        } = await withTimeout(
          supabaseClient.auth.getSession(),
          8000,
          'Timed out while restoring session'
        );

        if (!session?.user) {
          if (isMounted) {
            setUser(null);
          }
          return;
        }

        const mappedUser = await loadProfile(session.user.id);
        const mfaRequired = await loadMfaRequirement();

        if (isMounted) {
          setUser(mappedUser);
          setNeedsMfaVerification(mfaRequired);
        }
      } catch (error) {
        console.error('Failed to restore Supabase session.', error);
        if (isMounted) {
          setUser(null);
          setNeedsMfaVerification(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadSession();

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setIsLoading(true);

      if (!session?.user) {
        setUser(null);
        setNeedsMfaVerification(false);
        setIsLoading(false);
        return;
      }

      void (async () => {
        try {
          const mappedUser = await loadProfile(session.user.id);
          const mfaRequired = await loadMfaRequirement();
          if (isMounted) {
            setUser(mappedUser);
            setNeedsMfaVerification(mfaRequired);
          }
        } catch (error) {
          console.error('Failed to load Supabase profile after auth change.', error);
          if (isMounted) {
            setUser(null);
            setNeedsMfaVerification(false);
          }
        } finally {
          if (isMounted) {
            setIsLoading(false);
          }
        }
      })();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshUser = async () => {
    if (!supabase) {
      setUser(null);
      setNeedsMfaVerification(false);
      return;
    }

    try {
      const {
        data: { session },
      } = await withTimeout(
        supabase.auth.getSession(),
        8000,
        'Timed out while refreshing session'
      );

      if (!session?.user) {
        setUser(null);
        setNeedsMfaVerification(false);
        return;
      }

      const { data: profile, error } = await withTimeout(
        (async () =>
          supabase
            .from('profiles')
            .select('id, email, name, role, department, avatar_url, status, created_at')
            .eq('id', session.user.id)
            .maybeSingle<ProfileRecord>())(),
        8000,
        'Timed out while refreshing user profile'
      );

      if (error) {
        throw error;
      }

      const { data: assuranceData, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (assuranceError) {
        throw assuranceError;
      }

      setUser(profile ? mapProfileToUser(profile) : null);
      setNeedsMfaVerification(assuranceData.nextLevel === 'aal2' && assuranceData.currentLevel !== 'aal2');
    } catch (error) {
      console.error('Failed to refresh user profile.', error);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    if (!supabase) {
      return false;
    }

    const { error } = await withTimeout(
      supabase.auth.signInWithPassword({
        email,
        password,
      }),
      8000,
      'Timed out while signing in'
    );

    return !error;
  };

  const logout = () => {
    if (supabase) {
      void supabase.auth.signOut();
    }
    setUser(null);
    setNeedsMfaVerification(false);
  };

  const hasRole = (roles: UserRole[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  const canManageRecords = user ? hasPermission(user.role, 'manage_records') : false;
  const canManageUsers = user ? hasPermission(user.role, 'manage_users') : false;

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        hasRole,
        canManageRecords,
        canManageUsers,
        isLoading,
        needsMfaVerification,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
