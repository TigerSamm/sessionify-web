import { useEffect, useState } from 'react';
import { persistSession, clearPersistedSession, hydrateSession } from '../lib/sessionStorage.js';

const usePortalSession = (supabase) => {
  const [session, setSession] = useState(null);
  const [userId, setUserId] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const unsub = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUserId(nextSession?.user?.id || null);
      if (nextSession) {
        persistSession(nextSession);
      } else {
        clearPersistedSession();
      }
    });
    return () => {
      unsub.data.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const restored = await hydrateSession(supabase);
      if (!isMounted) return;
      if (restored) {
        setSession(restored);
        setUserId(restored.user?.id || null);
      }
      setHydrated(true);
    })();
    return () => {
      isMounted = false;
    };
  }, [supabase]);

  return { session, userId, setSession, setUserId, hydrated };
};

export default usePortalSession;
