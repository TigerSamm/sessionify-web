import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { getSupabaseClient } from '../lib/supabaseClient.js';
import { clearPersistedSession, persistSession } from '../lib/sessionStorage.js';
import usePortalSession from '../hooks/usePortalSession.js';
import AccountSidebarIcon from '../components/AccountSidebarIcon.jsx';
import '../styles/portal.css';

const daysUntil = (iso) => {
  if (!iso) return '—';
  const target = new Date(iso);
  const now = new Date();
  const diff = target - now;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

const formatDate = (iso) => {
  if (!iso) return 'Unknown';
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch (err) {
    return iso;
  }
};

const AccountPage = () => {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const navigate = useNavigate();
  const location = useLocation();
  const { session, userId, setSession, setUserId, hydrated } = usePortalSession(supabase);
  const [profile, setProfile] = useState(null);
  const [banner, setBanner] = useState({ text: '', type: '' });
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', company: '', company_logo: '' });
  const [profileSaving, setProfileSaving] = useState(false);

  const showBanner = (text, type = 'success') => setBanner({ text, type });
  const clearBanner = () => setBanner({ text: '', type: '' });

  const fetchProfile = async (id = userId) => {
    if (!id) return null;
    const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
    if (error) throw error;
    setProfile(data);
    setProfileForm({
      name: data.name || '',
      company: data.company || '',
      company_logo: data.company_logo || '',
    });
    return data;
  };

  useEffect(() => {
    if (!userId) return;
    fetchProfile(userId).catch((err) => {
      console.error('Profile fetch failed', err);
      showBanner('Unable to load your profile automatically. Please sign in again.', 'error');
    });
  }, [userId]);

  const handleLogin = async (event) => {
    event.preventDefault();
    clearBanner();
    setLoginLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginForm.email.trim(),
        password: loginForm.password.trim(),
      });
      if (error) throw error;
      setSession(data.session);
      setUserId(data.user.id);
      persistSession(data.session);
      await fetchProfile(data.user.id);
      showBanner('Authenticated — your account data is now loaded.', 'success');
    } catch (err) {
      console.error(err);
      showBanner(err.message || 'Authentication failed', 'error');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    if (!userId) return;
    setProfileSaving(true);
    try {
      const payload = {
        name: profileForm.name.trim() || null,
        company: profileForm.company.trim() || null,
        company_logo: profileForm.company_logo.trim() || null,
      };
      const { error } = await supabase.from('users').update(payload).eq('id', userId);
      if (error) throw error;
      await fetchProfile();
      showBanner('Profile updated successfully.', 'success');
    } catch (err) {
      console.error(err);
      showBanner(err.message || 'Failed to update profile', 'error');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearPersistedSession();
    setSession(null);
    setUserId(null);
    setProfile(null);
    showBanner('Signed out.', 'success');
  };

  const handleRefresh = async () => {
    try {
      await fetchProfile();
      showBanner('Information refreshed.', 'success');
    } catch (err) {
      console.error(err);
      showBanner('Could not refresh details.', 'error');
    }
  };

  const expiry = profile?.license_expiry;
  const expired = expiry ? new Date(expiry) < new Date() : false;

  useEffect(() => {
    if (!hydrated) return;
    if (!session) {
      const redirectTo = `${location.pathname}${location.search}` || '/app/account';
      navigate(`/app/login?redirect=${encodeURIComponent(redirectTo)}`, { replace: true });
    }
  }, [hydrated, session, navigate, location]);

  if (!hydrated && !session) {
    return (
      <div className="portal-page min-h-screen bg-gradient-to-br from-purple-950 via-slate-900 to-slate-950 text-slate-100 flex items-center justify-center">
        <p className="text-slate-200 text-sm tracking-wide">Preparing your portal…</p>
      </div>
    );
  }

  return (
    <div className="portal-page min-h-screen bg-gradient-to-br from-purple-950 via-slate-900 to-slate-950 text-slate-100 flex items-stretch justify-center p-4 md:p-8">
      <div className="shell w-full max-w-5xl bg-slate-900/70 border border-white/10 rounded-3xl shadow-2xl overflow-hidden grid md:grid-cols-[320px_1fr]">
        <aside className="sidebar bg-gradient-to-br from-indigo-400/40 to-purple-900 p-8 flex flex-col gap-6">
          <span className="pill">Sessionize Portal</span>
          <h1 className="text-3xl font-semibold leading-tight">Manage your account in one place.</h1>
          <p className="text-slate-100/80">
            Review plan details, confirm billing, and keep your workspace profile up to date. Changes sync instantly with the Sessionize desktop app.
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
              <a href="https://sessionify.onrender.com/" target="_blank" rel="noreferrer" className="text-violet-100 text-sm font-semibold">
                Visit Website
              </a>
            </div>
          </div>
          <AccountSidebarIcon />
        </aside>
        <main className="content bg-slate-950/40 p-6 md:p-10">
          {banner.text && (
            <div className={clsx('message show mb-6', banner.type)}>{banner.text}</div>
          )}

          {!session ? (
            <section className="card  border border-white/10">
              <h3 className="text-xl font-semibold mb-2">Verify your identity</h3>
              <p className=" mb-6">Sign in with the same credentials you use inside Sessionize.</p>
              <form className="space-y-4" onSubmit={handleLogin}>
                <div>
                  <label htmlFor="loginEmail" className="block text-sm font-medium text-slate-200">
                    Email address
                  </label>
                  <input
                    id="loginEmail"
                    type="email"
                    required
                    autoComplete="email"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label htmlFor="loginPassword" className="block text-sm font-medium text-slate-200">
                    Password
                  </label>
                  <input
                    id="loginPassword"
                    type="password"
                    required
                    autoComplete="current-password"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
                  />
                </div>
                <button type="submit" className="btn btn-primary w-full justify-center" disabled={loginLoading}>
                  {loginLoading ? 'Continuing…' : 'Continue'}
                </button>
              </form>
            </section>
          ) : (
            <section className="space-y-6">
              <div className="flex flex-wrap justify-between items-center gap-4">
                <div className="flex items-center gap-3  border border-white/10 rounded-full px-5 py-2">
                  <strong>{profile?.name || 'Workspace owner'}</strong>
                  <span className=" text-sm">{profile?.email || session.user.email}</span>
                </div>
                <div className="flex gap-3">
                  <button className="btn btn-secondary" onClick={handleRefresh}>
                    Refresh data
                  </button>
                  <button className="btn btn-ghost" onClick={handleLogout}>
                    Sign out
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid lg:grid-cols-2 gap-6">
                  <div className="card  border border-white/10">
                    <div className="plan-pill mb-4 px-4 py-1 rounded-full inline-flex items-center gap-2 bg-indigo-500/20 text-indigo-100 text-sm">
                      Plan · {profile?.license || 'Unknown'}
                    </div>
                    <h3 className="text-2xl font-semibold mb-2">Subscription</h3>
                    <p className="">
                      {profile?.company ? `${profile.company} is running on Sessionize.` : 'Your workspace plan keeps everything running smoothly.'}
                    </p>
                    <div className={clsx('status mt-4 flex items-center gap-2 text-sm', expired && 'text-rose-200')}>
                      <span className="status-dot" style={{ background: expired ? '#f87171' : '#34d399' }} />
                      <span>{expired ? 'Expired — renew to continue' : 'Active and in good standing'}</span>
                    </div>
                    <p className="text-slate-400 text-sm">
                      Renews on <strong>{expiry ? formatDate(expiry) : 'Not set'}</strong> ({expiry ? daysUntil(expiry) : '—'} days remaining)
                    </p>
                    <div className="flex gap-3 mt-4">
                      <button className="btn btn-primary flex-1" onClick={() => window.open('https://sessionify.onrender.com/pricing', '_blank', 'noopener')}>
                        Upgrade plan
                      </button>
                      <button className="btn btn-secondary flex-1" onClick={() => window.open('mailto:lunafoxapp@gmail.com?subject=Sessionify%20Billing', '_blank')}>
                        Manage billing
                      </button>
                    </div>
                  </div>

                  <div className="card  border border-white/10">
                    <h3 className="text-2xl font-semibold mb-2">Profile</h3>
                    <p className="">Your information.</p>
                    <form className="space-y-4 mt-4" onSubmit={handleProfileSubmit}>
                      <div>
                        <label htmlFor="profileName" className="block text-sm text-slate-200">
                          Full name
                        </label>
                        <input
                          id="profileName"
                          type="text"
                          className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          value={profileForm.name}
                          onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label htmlFor="profileCompany" className="block text-sm text-slate-200">
                          Organisation name
                        </label>
                        <input
                          id="profileCompany"
                          type="text"
                          className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          value={profileForm.company}
                          onChange={(e) => setProfileForm((prev) => ({ ...prev, company: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label htmlFor="profileLogo" className="block text-sm text-slate-200">
                          Logo URL
                        </label>
                        <input
                          id="profileLogo"
                          type="url"
                          className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          value={profileForm.company_logo}
                          onChange={(e) => setProfileForm((prev) => ({ ...prev, company_logo: e.target.value }))}
                        />
                      </div>
                      <div className="flex justify-end pt-2">
                        <button type="submit" className="btn btn-primary" disabled={profileSaving}>
                          {profileSaving ? 'Saving…' : 'Save changes'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
};

export default AccountPage;
