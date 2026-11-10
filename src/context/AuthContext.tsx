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
    let currentUserId: string | null = null;
    let hydratingUserId: string | null = null;

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

    const hydrateSession = async (
      session: Awaited<ReturnType<typeof supabaseClient.auth.getSession>>['data']['session'],
      force = false
    ) => {
      if (!session?.user) {
        currentUserId = null;
        hydratingUserId = null;
        if (isMounted) {
          setUser(null);
          setNeedsMfaVerification(false);
          setIsLoading(false);
        }
        return;
      }

      if (!force && (currentUserId === session.user.id || hydratingUserId === session.user.id)) {
        if (isMounted && currentUserId === session.user.id) {
          setIsLoading(false);
        }
        return;
      }

      hydratingUserId = session.user.id;
      try {
        const [mappedUser, mfaRequired] = await Promise.all([
          loadProfile(session.user.id),
          loadMfaRequirement(),
        ]);

        if (isMounted) {
          currentUserId = session.user.id;
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
        if (hydratingUserId === session.user.id) {
          hydratingUserId = null;
        }
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((event, session) => {
      setIsLoading(true);

      if (event === 'TOKEN_REFRESHED' && session?.user.id === currentUserId) {
        setIsLoading(false);
        return;
      }

      window.setTimeout(() => {
        // Sign-in and MFA verification can issue a new session for the same user.
        // Refresh the assurance level instead of treating that session as a duplicate.
        void hydrateSession(session, event !== 'INITIAL_SESSION');
      }, 0);
    });

    const initializationTimeout = window.setTimeout(() => {
      if (isMounted) {
        setIsLoading(false);
      }
    }, 10_000);

    return () => {
      isMounted = false;
      window.clearTimeout(initializationTimeout);
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

    setIsLoading(true);

    try {
      const { error } = await withTimeout(
        supabase.auth.signInWithPassword({
          email,
          password,
        }),
        8000,
        'Timed out while signing in'
      );

      if (error) {
        setIsLoading(false);
      }

      return !error;
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
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

// The provider and its hook intentionally share this module so they use the same context instance.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
