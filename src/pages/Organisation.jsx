import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getSupabaseClient } from '../lib/supabaseClient.js';
import { clearPersistedSession } from '../lib/sessionStorage.js';
import usePortalSession from '../hooks/usePortalSession.js';
import AccountSidebarIcon from '../components/AccountSidebarIcon.jsx';
import '../styles/portal.css';

const OrganisationPage = () => {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const navigate = useNavigate();
  const location = useLocation();
  const { session, userId, setSession, setUserId, hydrated } = usePortalSession(supabase);
  const [organisation, setOrganisation] = useState(null);
  const [orgMembers, setOrgMembers] = useState([]);
  const [orgLoading, setOrgLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [banner, setBanner] = useState({ text: '', type: '' });

  const isOrgAdmin = organisation?.admin === userId;

  useEffect(() => {
    if (!hydrated) return;
    if (!session) {
      const redirectTo = `${location.pathname}${location.search}` || '/app/organisation';
      navigate(`/app/login?redirect=${encodeURIComponent(redirectTo)}`, { replace: true });
    }
  }, [hydrated, session, navigate, location]);

  useEffect(() => {
    if (!userId) {
      setOrganisation(null);
      setOrgMembers([]);
      setOrgLoading(false);
      return;
    }
    loadOrganisation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const loadOrganisation = async () => {
    if (!userId) return;
    setOrgLoading(true);
    setBanner({ text: '', type: '' });
    try {
      let org = null;
      const adminQuery = await supabase
        .from('organisations')
        .select('id, org_id, name, admin, members, extras, created_at')
        .eq('admin', userId)
        .order('created_at', { ascending: true })
        .maybeSingle();

      if (adminQuery.data) {
        org = adminQuery.data;
      } else {
        const memberQuery = await supabase
          .from('organisations')
          .select('id, org_id, name, admin, members, extras, created_at')
          .contains('members', [userId])
          .order('created_at', { ascending: true })
          .maybeSingle();
        if (memberQuery.data) {
          org = memberQuery.data;
        } else if (memberQuery.error && memberQuery.error.code !== 'PGRST116') {
          throw memberQuery.error;
        }
      }

      if (adminQuery.error && adminQuery.error.code !== 'PGRST116') {
        throw adminQuery.error;
      }

      setOrganisation(org);
      if (org) {
        await hydrateOrgMembers(org);
      } else {
        setOrgMembers([]);
      }
    } catch (error) {
      console.error('Organisation load failed', error);
      setOrganisation(null);
      setOrgMembers([]);
      setBanner({ text: 'Unable to load organisation details right now.', type: 'error' });
    } finally {
      setOrgLoading(false);
    }
  };

  const hydrateOrgMembers = async (org) => {
    const ids = Array.from(new Set([org.admin, ...(org.members || [])]));
    if (!ids.length) {
      setOrgMembers([]);
      return;
    }
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, company')
      .in('id', ids);
    if (error) {
      console.error('Member hydration failed', error);
      setOrgMembers([]);
      setBanner({ text: 'Unable to load member details.', type: 'error' });
      return;
    }
    const ordered = ids
      .map((memberId) => {
        const record = data.find((row) => row.id === memberId);
        if (!record) return { id: memberId, name: 'Pending invite', email: '—' };
        return record;
      })
      .map((record) => ({
        ...record,
        role: record.id === org.admin ? 'Admin' : 'Member',
      }));
    setOrgMembers(ordered);
  };

  const handleInviteSubmit = async (event) => {
    event.preventDefault();
    if (!organisation || !isOrgAdmin) return;
    if (!inviteEmail.trim()) {
      setBanner({ text: 'Enter an email to invite.', type: 'error' });
      return;
    }
    setInviteLoading(true);
    setBanner({ text: '', type: '' });
    try {
      const { data, error } = await supabase.functions.invoke('invite-member', {
        body: {
          email: inviteEmail.trim(),
          organisationId: organisation.id,
        },
      });
      if (error) throw error;
      const statusText = data?.status === 'already-member'
        ? 'That person is already on your team.'
        : data?.status === 'invited'
          ? 'Invite sent! They will receive an email shortly.'
          : 'Member added to your team.';
      setBanner({ text: statusText, type: 'success' });
      setInviteEmail('');
      await loadOrganisation();
    } catch (err) {
      console.error('Invite failed', err);
      setBanner({ text: err.message || 'Unable to send invite right now.', type: 'error' });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    clearPersistedSession();
    setSession(null);
    setUserId(null);
    setOrganisation(null);
    setOrgMembers([]);
    navigate('/app/login', { replace: true });
  };

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
        <aside className="sidebar bg-gradient-to-br from-amber-300/40 to-purple-900 p-8 flex flex-col gap-6">
          <span className="pill">Sessionize Portal</span>
          <h1 className="text-3xl font-semibold leading-tight">Workspace organisation.</h1>
          <p className="text-slate-100/80">
            Invite teammates, review roles, and keep your Sessionize workspace tidy. Changes sync instantly to the desktop app.
          </p>
          <button className="btn btn-ghost mt-4" onClick={() => navigate('/app')}>
            Back to portal
          </button>
          <div>
            <p className="text-slate-200/70 text-sm">Need help?</p>
            <div className="flex flex-wrap gap-3 mt-2">
              <a href="mailto:lunafoxapp@gmail.com?subject=Organisation%20Help" className="text-violet-200 text-sm font-semibold">
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
            <div className={`message show mb-6 ${banner.type}`}>{banner.text}</div>
          )}

          <section className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Organisation</p>
                <h2 className="text-3xl font-semibold mt-1">
                  {organisation?.name || 'No workspace yet'}
                </h2>
                {organisation && (
                  <p className="text-slate-300">ID · {organisation.org_id || organisation.id}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <button className="btn btn-secondary" onClick={loadOrganisation} disabled={orgLoading}>
                  {orgLoading ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>
            </div>

            {orgLoading ? (
              <p className="text-sm text-slate-400">Checking your workspace…</p>
            ) : organisation ? (
              <div className="space-y-6">
                <div className="rounded-2xl border border-white/10 p-4 bg-slate-900/30">
                  <p className="text-sm text-slate-300">
                    <strong>Role:</strong> {isOrgAdmin ? 'You are the admin' : 'Member access'}
                  </p>
                  <p className="text-sm text-slate-300">
                    <strong>Created:</strong> {organisation?.created_at ? new Date(organisation.created_at).toLocaleDateString() : 'Unknown'}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-200 mb-3">Team members</p>
                  <div className="space-y-3">
                    {orgMembers.length ? (
                      orgMembers.map((member) => (
                        <div key={member.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-slate-900/30 px-4 py-3">
                          <div>
                            <p className="font-medium">{member.name || member.email || 'Pending user'}</p>
                            <p className="text-xs text-slate-400">{member.email || 'Invitation not accepted yet'}</p>
                          </div>
                          <span className="text-xs uppercase tracking-widest text-slate-400">{member.role}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">No other members yet.</p>
                    )}
                  </div>
                </div>

                
                {isOrgAdmin ? (
                  <form className="space-y-3" onSubmit={handleInviteSubmit}>
                    <div>
                      <label className="block text-sm text-slate-200 mb-2">Invite teammate by email</label>
                      <div className="flex flex-col md:flex-row gap-3">
                        <input
                          type="email"
                          required
                          className="flex-1 rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="teammate@example.com"
                        />
                        <button type="submit" className="btn btn-primary min-w-[150px]" disabled={inviteLoading}>
                          {inviteLoading ? 'Sending…' : 'Send invite'}
                        </button>
                      </div>
                    </div>
                  </form>
                ) : (
                  <p className="text-xs text-slate-500">Only admins can invite new members.</p>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 p-6 bg-slate-900/30">
                <p className="text-sm text-slate-300">No organisation found yet. Finish onboarding inside the Sessionize app to create one.</p>
                <button className="btn btn-primary mt-4" onClick={() => navigate('/app')}>
                  Return to portal
                </button>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
};

export default OrganisationPage;
