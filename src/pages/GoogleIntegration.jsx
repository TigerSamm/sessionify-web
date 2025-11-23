import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { getSupabaseClient } from '../lib/supabaseClient.js';
import { clearPersistedSession, hydrateSession, persistSession } from '../lib/sessionStorage.js';
import { getGoogleEdgeFunctionUrl } from '../config.js';
import AccountSidebarIcon from '../components/AccountSidebarIcon.jsx';
import '../styles/portal.css';

const GoogleIntegrationPage = () => {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const EDGE_FUNCTION_URL = getGoogleEdgeFunctionUrl();
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginMessage, setLoginMessage] = useState({ text: '', type: '' });
  const [statusMessage, setStatusMessage] = useState('Use the button below to launch Google\'s consent screen.');
  const [statusChip, setStatusChip] = useState('info');
  const [statusLabel, setStatusLabel] = useState('Checking...');
  const [googleEmail, setGoogleEmail] = useState('');
  const [pendingCode, setPendingCode] = useState(() => new URLSearchParams(window.location.search).get('code'));
  const [nextStepsVisible, setNextStepsVisible] = useState(false);
  const [loading, setLoading] = useState({ login: false, oauth: false });

  const showLoginMessage = (text, type = 'info') => setLoginMessage({ text, type });

  const syncSession = async () => {
    const { data } = await supabase.auth.getSession();
    let activeSession = data?.session || null;
    if (!activeSession) {
      activeSession = await hydrateSession(supabase);
    }
    setSession(activeSession);
    setSessionReady(true);
    return activeSession;
  };

  const fetchGoogleStatus = async () => {
    if (!session) return;
    setStatusLabel('Checking...');
    setStatusChip('info');
    setStatusMessage('Contacting secure Edge Function...');
    try {
      const response = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'get-status' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Failed to read status');
      setStatusLabel(data.connected ? 'Connected' : 'Not linked');
      setStatusChip(data.connected ? 'success' : 'danger');
      setStatusMessage(
        data.connected ? `Google account linked${data.email ? ` as ${data.email}` : ''}.` : 'No Google account linked yet.'
      );
      if (data.connected && data.email) {
        setGoogleEmail(data.email);
        setNextStepsVisible(true);
      }
    } catch (err) {
      console.error('Status error:', err);
      setStatusLabel('Error');
      setStatusChip('danger');
      setStatusMessage(err.message || 'Unable to verify Google status.');
      showLoginMessage(err.message || 'Unable to fetch Google status.', 'error');
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    showLoginMessage('', 'info');
    setLoading((prev) => ({ ...prev, login: true }));
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginForm.email.trim(),
        password: loginForm.password.trim(),
      });
      if (error) throw error;
      setSession(data.session);
      persistSession(data.session);
      showLoginMessage('Authenticated. You can proceed to link Google.', 'success');
      await fetchGoogleStatus();
      if (pendingCode) {
        await exchangeCode(pendingCode);
      }
    } catch (err) {
      console.error('Login failed:', err);
      showLoginMessage(err.message || 'Authentication failed. Check your credentials.', 'error');
    } finally {
      setLoading((prev) => ({ ...prev, login: false }));
    }
  };

  const startGoogleOAuth = async () => {
    if (!session) {
      showLoginMessage('Sign in first to continue.', 'error');
      return;
    }
    setLoading((prev) => ({ ...prev, oauth: true }));
    setStatusMessage('Opening Google authorization window...');
    try {
      const returnUrl = window.location.origin + window.location.pathname;
      const response = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'get-auth-url', mode: 'web', returnUrl }),
      });
      const data = await response.json();
      if (!response.ok || !data?.authUrl) {
        throw new Error(data?.error || 'Failed to create Google link.');
      }
      window.location.href = data.authUrl;
    } catch (err) {
      console.error('OAuth start failed:', err);
      showLoginMessage(err.message || 'Unable to open Google authorization.', 'error');
      setLoading((prev) => ({ ...prev, oauth: false }));
    }
  };

  const exchangeCode = async (code) => {
    if (!session) {
      showLoginMessage('Please sign in again to finish linking.', 'error');
      return;
    }
    setStatusMessage('Finishing Google authorization...');
    setLoading((prev) => ({ ...prev, oauth: true }));
    try {
      const response = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'exchange-code', code }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Failed to exchange code');
      setStatusMessage('Google account linked successfully!');
      setStatusChip('success');
      setStatusLabel('Connected');
      setGoogleEmail(data?.email || '');
      setNextStepsVisible(true);
      await fetchGoogleStatus();
    } catch (err) {
      console.error('Exchange failed:', err);
      showLoginMessage(err.message || 'Unable to finish linking.', 'error');
    } finally {
      setPendingCode(null);
      removeQueryParams();
      setLoading((prev) => ({ ...prev, oauth: false }));
    }
  };

  const removeQueryParams = () => {
    if (window.history.replaceState) {
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    clearPersistedSession();
    setSession(null);
    setNextStepsVisible(false);
    setGoogleEmail('');
    setPendingCode(null);
    removeQueryParams();
    showLoginMessage('Signed out. Sign back in to continue.', 'info');
  };

  useEffect(() => {
    (async () => {
      const activeSession = await syncSession();
      if (activeSession) {
        await fetchGoogleStatus();
        if (pendingCode) {
          await exchangeCode(pendingCode);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    if (!session) {
      const redirectTo = `${location.pathname}${location.search}` || '/app/google-int';
      navigate(`/app/login?redirect=${encodeURIComponent(redirectTo)}`, { replace: true });
    }
  }, [sessionReady, session, navigate, location]);

  if (!sessionReady && !session) {
    return (
      <div className="portal-page min-h-screen bg-gradient-to-br from-purple-950 via-slate-900 to-slate-950 text-slate-100 flex items-center justify-center">
        <p className="text-slate-200 text-sm tracking-wide">Preparing Google integration…</p>
      </div>
    );
  }

  return (
    <div className="portal-page min-h-screen bg-gradient-to-br from-purple-950 via-slate-900 to-slate-950 text-slate-100 flex items-stretch justify-center p-4 md:p-8">
      <div className="shell w-full max-w-5xl bg-slate-900/70 border border-white/10 rounded-3xl shadow-2xl overflow-hidden grid md:grid-cols-[320px_1fr]">
        <aside className="sidebar bg-gradient-to-br from-indigo-400/40 to-purple-900 p-8 flex flex-col gap-6">
          <div className="pill">Sessionize Portal</div>
          <h1 className="text-3xl font-semibold leading-tight">Connect Google Workspace in two quick steps.</h1>
          <p className="text-slate-100/80">
            Authenticate with your Sessionize credentials, launch the Google consent screen, and you'll be ready to sync Meet links, calendar slots, and contacts.
          </p>
          <button className="btn btn-ghost mt-4" onClick={() => navigate('/app')}>
            Back to portal
          </button>
          <div>
            <p className="text-slate-200/70 text-sm">Need help?</p>
            <div className="flex flex-wrap gap-3 mt-2">
              <a href="mailto:lunafoxapp@gmail.com?subject=Account%20Help" className="text-violet-200 text-sm font-semibold">
                lunafoxapp@gmail.com
              </a>
              <a href="https://sessionify.onrender.com/" rel="noreferrer" className="text-violet-100 text-sm font-semibold">
                Visit Website
              </a>
            </div>
          </div>
          <AccountSidebarIcon />
        </aside>
        <main className="content bg-slate-950/40 p-6 md:p-10">

          <div className="grid lg:grid-cols-2 gap-6">
            <section className={clsx('card bg-slate-900/60 border border-white/10', !session && 'opacity-50 pointer-events-none')}>
              <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                <div>
                  <h2 className="text-2xl font-semibold">Link Google</h2>
                  <p className="text-sm text-slate-300">
                    Current user: <strong>{session?.user?.email || '—'}</strong>
                  </p>
                </div>
                <div className={clsx('status-chip px-4 py-1 rounded-full text-sm border', {
                  'border-blue-200 text-blue-100 bg-blue-500/10': statusChip === 'info',
                  'border-green-200 text-green-100 bg-green-500/10': statusChip === 'success',
                  'border-amber-200 text-amber-100 bg-amber-500/10': statusChip === 'pending',
                  'border-rose-200 text-rose-100 bg-rose-500/10': statusChip === 'danger',
                })}>
                  {statusLabel}
                </div>
              </div>
              <p className="message show info mb-4">{statusMessage}</p>
              <div className="flex flex-wrap gap-3">
                <button className="btn btn-primary" onClick={startGoogleOAuth} disabled={!session || loading.oauth}>
                  {loading.oauth ? 'Opening…' : 'Launch Google authorization'}
                </button>
                <button className="btn btn-secondary" onClick={fetchGoogleStatus} disabled={!session}>
                  Refresh status
                </button>
              </div>
            </section>
          </div>

          {nextStepsVisible && (
            <section className="card bg-slate-900/60 border border-white/10 mt-6">
              <h3 className="text-xl font-semibold mb-2">Next Steps</h3>
              <p className="text-slate-300">Google account: {googleEmail || 'Linked account'}</p>
              <p className="text-slate-400 mt-2">
                You're all set! Return to the Sessionize desktop app and refresh your status to start syncing.
              </p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
};

export default GoogleIntegrationPage;
