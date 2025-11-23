import { AUTH_SESSION_STORAGE_KEY } from '../config.js';

const isBrowser = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export const persistSession = (session) => {
  if (!isBrowser() || !session) return;
  try {
    const payload = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
    };
    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('Unable to persist session', err);
  }
};

export const clearPersistedSession = () => {
  if (!isBrowser()) return;
  window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
};

export const hydrateSession = async (supabaseClient) => {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw);
    if (!saved?.access_token || !saved?.refresh_token) {
      clearPersistedSession();
      return null;
    }
    const { data, error } = await supabaseClient.auth.setSession({
      access_token: saved.access_token,
      refresh_token: saved.refresh_token,
    });
    if (error) throw error;
    if (data?.session) persistSession(data.session);
    return data?.session || null;
  } catch (err) {
    console.warn('Failed to hydrate saved session', err);
    clearPersistedSession();
    return null;
  }
};
