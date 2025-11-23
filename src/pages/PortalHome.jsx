import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getSupabaseClient } from '../lib/supabaseClient.js';
import { hydrateSession, clearPersistedSession } from '../lib/sessionStorage.js';
import { SESSIONIFY_PROTOCOL } from '../config.js';
import AccountSidebarIcon from '../components/AccountSidebarIcon.jsx';
import '../styles/portal.css';

const PortalHomePage = () => {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState({ text: '', type: '' });

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

  const loadProfile = async (activeSession) => {
    if (!activeSession?.user?.id) return;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('name, company')
        .eq('id', activeSession.user.id)
        .single();
      if (error) throw error;
      setProfile(data);
    } catch (err) {
      console.error('Profile load failed:', err);
      setStatus({ text: err.message || 'Unable to load your details right now.', type: 'error' });
    }
  };

  useEffect(() => {
    (async () => {
      const activeSession = await syncSession();
      if (activeSession) {
        await loadProfile(activeSession);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    if (!session) {
      const redirectTo = `${location.pathname}${location.search}` || '/app';
      navigate(`/app/login?redirect=${encodeURIComponent(redirectTo)}`, { replace: true });
    }
  }, [sessionReady, session, navigate, location]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    clearPersistedSession();
    setSession(null);
    setProfile(null);
  };

  const openSessionifyApp = () => {
    if (typeof window === 'undefined') return;
    window.location.href = `${SESSIONIFY_PROTOCOL}://launch`;
  };

  const openClientProfiler = () => {
    if (typeof window === 'undefined') return;
    window.open('https://sessionify.onrender.com/client-profiler', '_blank', 'noopener,noreferrer');
  };

  const openBackups = () => {
    if (typeof window === 'undefined') return;
    window.open('https://sessionify.onrender.com/backups', '_blank', 'noopener,noreferrer');
  };

  const goToAccount = () => {
    navigate('/app/account');
  };

  const goToGoogleIntegration = () => {
    navigate('/app/google-int');
  };

  const goToSessionBooking = () => {
    navigate('/app/booking');
  };

  if (!sessionReady && !session) {
    return (
      <div className="portal-page min-h-screen bg-gradient-to-br from-purple-950 via-slate-900 to-slate-950 text-slate-100 flex items-center justify-center">
        <p className="text-slate-200 text-sm tracking-wide">Preparing your portal…</p>
      </div>
    );
  }

  const greetingName = profile?.name?.trim() || session?.user?.email?.split('@')[0] || 'there';

  const quickActions = [
    {
      title: 'Open Sessionize Application',
      description: 'Launch the desktop workspace without touching the browser.',
      action: openSessionifyApp,
      variant: 'primary',
    },
    {
      title: 'Session booking',
      description: 'Configure your public booking page and availability.',
      action: goToSessionBooking,
    },
    {
      title: 'My backups',
      description: 'Download encrypted snapshots for safekeeping.',
      action: openBackups,
      comingSoon: true,
    },
    {
      title: 'Manage Account',
      description: 'Update billing, modules and integrations.',
      action: goToAccount,
    },
    {
      title: 'Organisation',
      description: 'Invite members and review workspace roles.',
      action: () => navigate('/app/organisation'),
    },
  ];

  return (
    <div className="portal-page min-h-screen bg-gradient-to-br from-purple-950 via-slate-900 to-slate-950 text-slate-100 flex items-stretch justify-center p-4 md:p-8">
      <div className="shell w-full max-w-5xl">
        <aside className="sidebar">
          <span className="pill">Sessionize Portal</span>
          <h2 className="text-3xl font-semibold mt-1"><small>Welcome back,</small><br />{greetingName}!</h2>
          <div>
            <p className="text-slate-200/70 text-sm">Support</p>
            <div className="flex flex-wrap gap-3 mt-2">
              <a href="mailto:lunafoxapp@gmail.com?subject=Portal%20Help" className="text-violet-200 text-sm font-semibold">
                lunafoxapp@gmail.com
              </a>
              <a href="https://sessionify.onrender.com/" target="_blank" rel="noreferrer" className="text-violet-100 text-sm font-semibold">
                Visit Website
              </a>
            </div>
          </div>
          <AccountSidebarIcon />
        </aside>
        <main className="content bg-slate-950/40 p-6 md:p-10">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-400">What would you like to do?</p>
            </div>
          </div>

          {status.text && <div className={`message show ${status.type}`}>{status.text}</div>}

          <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
            {quickActions.map((item) => (
              <div key={item.title} className="card flex flex-col gap-4 bg-slate-900/70 border border-white/10">
                <div>
                  <h3 className="text-xl font-semibold text-white mt-1">{item.title}</h3>
                  <p className="text-slate-300 mt-2">{item.description}</p>
                </div>
                <button
                  className={`btn ${item.variant === 'primary' ? 'btn-primary text-slate-900' : 'btn-secondary'} ${item.comingSoon ? 'opacity-60 cursor-not-allowed' : ''}`.trim()}
                  onClick={item.comingSoon ? undefined : item.action}
                  disabled={Boolean(item.comingSoon)}
                >
                  {item.comingSoon ? 'Coming soon' : item.variant === 'primary' ? 'Launch now' : 'Open'}
                </button>
              </div>
            ))}
          </div>

          <section className="card mt-8 bg-slate-900/70 border border-white/10">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Integrations</p>
            <h3 className="text-2xl font-semibold text-white mt-2">Connect your tools</h3>
            <p className="text-slate-300 mb-4">Launch key integrations without leaving the portal.</p>

            <div className="space-y-6">
              <div className="flex flex-wrap justify-between items-center gap-3 border-t border-white/10 pt-4">
                <div>
                  <strong>Google Workspace</strong>
                  <p className="text-sm text-slate-400">Sync Meet links, calendar slots, and contacts.</p>
                </div>
                <button className="btn btn-primary" onClick={goToGoogleIntegration}>
                  Open Google panel
                </button>
              </div>
            </div>
          </section>

        </main>
      </div>
    </div>
  );
};

export default PortalHomePage;
