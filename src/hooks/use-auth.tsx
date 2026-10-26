import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { db } from '../lib/supabase';
import type { Role } from '../lib/domain';
const AuthContext = createContext<{
  session: Session | null;
  role: Role;
  loading: boolean;
  error: string | null;
}>({ session: null, role: 'CUSTOMER', loading: true, error: null });
export function AuthProvider({ children }: { children: ReactNode }) {
  const cache = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role>('CUSTOMER');
  const [loading, setLoading] = useState(Boolean(db));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!db) return;
    let alive = true;
    let revision = 0;
    // Keep this local to the subscription lifetime so StrictMode's new effect
    // still completes its own initial permission check.
    let currentUser: string | null | undefined;

    async function apply(next: Session | null) {
      const nextUser = next?.user.id ?? null;
      setSession(next);
      // Supabase emits SIGNED_IN again on tab focus and TOKEN_REFRESHED when
      // renewing credentials. Neither changes the owner of the mounted forms.
      // Do not reset permissions/loading, cancel the initial check, or clear
      // queries unless the actual account changes.
      if (currentUser === nextUser) return;
      const current = ++revision;
      if (currentUser !== undefined) void cache.resetQueries();
      if (currentUser) sessionStorage.removeItem(`fp-draft:${currentUser}`);
      currentUser = nextUser;
      setRole('CUSTOMER');
      setError(null);
      if (next) {
        setLoading(true);
        const result = await db!.from('user_roles').select('role').eq('user_id', next.user.id);
        if (!alive || revision !== current) return;
        if (result.error) setError('Nije moguće provjeriti ovlasti. Pokušajte ponovno.');
        else if (result.data?.some((x) => x.role === 'ADMIN')) setRole('ADMIN');
      }
      if (alive && revision === current) setLoading(false);
    }
    void db.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) {
        setError('Nije moguće obnoviti sesiju.');
        setLoading(false);
      } else void apply(data.session);
    });
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((_event, next) => {
      if (alive)
        queueMicrotask(() => {
          if (alive) void apply(next);
        });
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [cache]);
  return (
    <AuthContext.Provider value={{ session, role, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
