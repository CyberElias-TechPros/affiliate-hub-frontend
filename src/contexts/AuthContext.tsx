import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import type { LoginRequest, PublicUser, SignupRequest } from '@shared/api-contract';
import { AuthAPI, tokenStore, UNAUTHENTICATED_EVENT, resetUnauthenticatedFlag } from '@/lib/api';

/**
 * Session state.
 *
 * The prototype had no auth state at all: `/dashboard`, `/wallet` and `/profile`
 * were public routes that rendered a hardcoded "Welcome back, Chinedu". This
 * provider is what makes those routes real.
 *
 * Tokens live in localStorage, which matches the existing contract and keeps
 * the API stateless. The tradeoff is that a successful XSS could read them;
 * the mitigations are a strict CSP (see vercel.json) and no `dangerouslySet*`
 * anywhere in the codebase. Moving to httpOnly cookies is the stricter option
 * and is noted in docs/ARCHITECTURE.md as a follow-up.
 */

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: PublicUser | null;
  isAuthenticated: boolean;
  login: (input: LoginRequest) => Promise<PublicUser>;
  signup: (input: SignupRequest) => Promise<PublicUser>;
  logout: () => Promise<void>;
  /** Re-read the session from the API. */
  refresh: () => Promise<void>;
  /** Merge a server-returned user, e.g. after onboarding. */
  setUser: (user: PublicUser) => void;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = React.useState<PublicUser | null>(null);
  const [status, setStatus] = React.useState<AuthStatus>('loading');
  const navigate = useNavigate();

  const loadSession = React.useCallback(async () => {
    if (!tokenStore.access) {
      tokenStore.clear();
      setStatus('unauthenticated');
      return;
    }
    try {
      const { user: me } = await AuthAPI.me();
      setUser(me);
      setStatus('authenticated');
    } catch {
      // Expired or revoked. The client already cleared the tokens on 401.
      tokenStore.clear();
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  React.useEffect(() => {
    void loadSession();
  }, [loadSession]);

  // A 401 from any request means the session is gone. Handled here so the
  // whole app reacts consistently instead of each page guessing.
  React.useEffect(() => {
    const onUnauthenticated = () => {
      setUser(null);
      setStatus('unauthenticated');
      navigate('/auth', { replace: true, state: { from: window.location.pathname } });
    };
    window.addEventListener(UNAUTHENTICATED_EVENT, onUnauthenticated);
    return () => window.removeEventListener(UNAUTHENTICATED_EVENT, onUnauthenticated);
  }, [navigate]);

  const login = React.useCallback(async (input: LoginRequest) => {
    const session = await AuthAPI.login(input);
    tokenStore.set(session);
    // Re-arm the 401 guard: a new session can expire and must be able to fire.
    resetUnauthenticatedFlag();
    setUser(session.user);
    setStatus('authenticated');
    return session.user;
  }, []);

  const signup = React.useCallback(async (input: SignupRequest) => {
    const session = await AuthAPI.signup(input);
    tokenStore.set(session);
    resetUnauthenticatedFlag();
    setUser(session.user);
    setStatus('authenticated');
    return session.user;
  }, []);

  const logout = React.useCallback(async () => {
    // Tell the server to revoke the refresh token, but never block sign-out on
    // a failing network call — the local session must always clear.
    try {
      await AuthAPI.logout(tokenStore.refresh);
    } catch {
      /* best effort */
    }
    tokenStore.clear();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isAuthenticated: status === 'authenticated',
      login,
      signup,
      logout,
      refresh: loadSession,
      setUser,
    }),
    [status, user, login, signup, logout, loadSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}
