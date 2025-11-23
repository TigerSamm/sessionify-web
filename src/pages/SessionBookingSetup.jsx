import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSupabaseClient } from '../lib/supabaseClient.js';
import { hydrateSession } from '../lib/sessionStorage.js';
import AccountSidebarIcon from '../components/AccountSidebarIcon.jsx';
import '../styles/portal.css';

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
    <div className="bg-slate-900 border border-white/10 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <div className="p-6 overflow-y-auto">
        {children}
      </div>
    </div>
  </div>
);

const SessionBookingSetupPage = () => {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [page, setPage] = useState(null);
  const [slug, setSlug] = useState('');
  const [slugStatus, setSlugStatus] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [minGapMinutes, setMinGapMinutes] = useState(15);
  const [products, setProducts] = useState([]);
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    duration_minutes: 60,
    price_cents: 0,
    is_in_person: false,
    location: '',
  });
  const [editingProductId, setEditingProductId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [availabilityRules, setAvailabilityRules] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  
  // New state for dashboard
  const [requests, setRequests] = useState([]);
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [pastSessions, setPastSessions] = useState([]);
  const [activeModal, setActiveModal] = useState(null); // 'requests', 'details', 'availability', 'types', 'past-sessions'

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.auth.getSession();
      let activeSession = data?.session || null;
      if (!activeSession) {
        activeSession = await hydrateSession(supabase);
      }
      if (!activeSession?.user?.id) {
        navigate('/app/login?redirect=/app/booking', { replace: true });
        return;
      }
      setSession(activeSession);

      try {
        const { data: existingPage, error: pageError } = await supabase
          .from('booking_pages')
          .select('*')
          .eq('owner_user_id', activeSession.user.id)
          .limit(1)
          .maybeSingle();

        if (pageError) throw pageError;

        if (existingPage) {
          setPage(existingPage);
          setSlug(existingPage.slug || '');
          setIsLive(!!existingPage.is_live);
          setTitle(existingPage.title || '');
          setDescription(existingPage.description || '');
          setLogoUrl(existingPage.logo_url || '');
          setMinGapMinutes(existingPage.min_gap_minutes || 15);

          const { data: productRows, error: productsError } = await supabase
            .from('booking_products')
            .select('*')
            .eq('booking_page_id', existingPage.id)
            .order('created_at', { ascending: true });

          if (productsError) throw productsError;
          setProducts(productRows || []);

          setAvailabilityLoading(true);
          const { data: rulesRows, error: rulesError } = await supabase
            .from('booking_availability_rules')
            .select('*')
            .eq('booking_page_id', existingPage.id)
            .order('weekday', { ascending: true });
          if (rulesError) throw rulesError;
          setAvailabilityRules(rulesRows || []);

          const { data: overridesRows, error: overridesError } = await supabase
            .from('booking_availability_overrides')
            .select('*')
            .eq('booking_page_id', existingPage.id)
            .order('start_at', { ascending: true });
          if (overridesError) throw overridesError;
          setOverrides(overridesRows || []);
          setAvailabilityLoading(false);

          // Fetch requests
          const { data: reqs, error: reqError } = await supabase
            .from('bookings')
            .select('*, booking_products(name, is_in_person, location)')
            .eq('booking_page_id', existingPage.id)
            .eq('status', 'requested')
            .order('start_at', { ascending: true });
          
          if (reqError) console.error('Error fetching requests:', reqError);
          setRequests(reqs || []);

          // Fetch upcoming sessions
          const now = new Date().toISOString();
          const { data: upcoming, error: upcomingError } = await supabase
            .from('bookings')
            .select('*, booking_products(name, is_in_person, location)')
            .eq('booking_page_id', existingPage.id)
            .eq('status', 'accepted')
            .gte('start_at', now)
            .order('start_at', { ascending: true });
          
          if (upcomingError) console.error('Error fetching upcoming sessions:', upcomingError);
          setUpcomingSessions(upcoming || []);

          // Fetch past sessions
          const { data: past, error: pastError } = await supabase
            .from('bookings')
            .select('*, booking_products(name, is_in_person, location)')
            .eq('booking_page_id', existingPage.id)
            .eq('status', 'accepted')
            .lt('end_at', now)
            .order('start_at', { ascending: false });
          
          if (pastError) console.error('Error fetching past sessions:', pastError);
          setPastSessions(past || []);
        }
      } catch (err) {
        console.error('Failed to load session booking config:', err);
        setError(err.message || 'Unable to load your booking configuration.');
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate, supabase]);

  const handleSlugBlur = async () => {
    setSlugStatus('');
    if (!slug) return;
    const clean = slug.trim().toLowerCase();
    setSlug(clean);
    const { data, error: slugError } = await supabase
      .from('booking_pages')
      .select('id')
      .eq('slug', clean)
      .limit(1)
      .maybeSingle();
    if (slugError) {
      console.error(slugError);
      setSlugStatus('Unable to validate slug right now.');
      return;
    }
    if (data && data.id !== page?.id) {
      setSlugStatus('This address is already taken. Try another.');
    } else {
      setSlugStatus('This address is available.');
    }
  };

  const ensurePage = async () => {
    if (page) return page;
    if (!session?.user?.id) return null;
    const proposedSlug = slug || session.user.email.split('@')[0].toLowerCase();
    const { data: created, error: createError } = await supabase
      .from('booking_pages')
      .insert({
        owner_user_id: session.user.id,
        slug: proposedSlug,
        title: title || 'Session bookings',
        description: description || 'Book time with me.',
          logo_url: logoUrl || null,
          min_gap_minutes: minGapMinutes || 15,
      })
      .select('*')
      .single();
    if (createError) throw createError;
    setPage(created);
    setSlug(created.slug);
    return created;
  };

  const handleSaveSettings = async (shouldClose = true) => {
    if (!slug) {
      setSlugStatus('Please choose a booking page address.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const pageRecord = await ensurePage();
      if (!pageRecord) throw new Error('Unable to create booking page.');

      const { data: updated, error: updateError } = await supabase
        .from('booking_pages')
        .update({
          slug,
          is_live: isLive,
          title: title || null,
          description: description || null,
          logo_url: logoUrl || null,
          min_gap_minutes: minGapMinutes || 15,
        })
        .eq('id', pageRecord.id)
        .select('*')
        .single();

      if (updateError) throw updateError;
      setPage(updated);
      if (shouldClose !== false) setActiveModal(null); // Close modal on save unless explicitly false
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError(err.message || 'Unable to save settings right now.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleLive = async () => {
    setSaving(true);
    setError('');
    try {
      const pageRecord = await ensurePage();
      if (!pageRecord) throw new Error('Unable to create booking page.');

      const newIsLive = !isLive;
      const { data: updated, error: updateError } = await supabase
        .from('booking_pages')
        .update({ is_live: newIsLive })
        .eq('id', pageRecord.id)
        .select('*')
        .single();

      if (updateError) throw updateError;
      setPage(updated);
      setIsLive(newIsLive);
    } catch (err) {
      console.error('Failed to toggle live state:', err);
      setError(err.message || 'Unable to update live state right now.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddProduct = async () => {
    setError('');
    try {
      const pageRecord = await ensurePage();
      if (!pageRecord) throw new Error('Create your booking page first.');

      const payload = {
        booking_page_id: pageRecord.id,
        name: newProduct.name.trim(),
        description: newProduct.description.trim(),
        duration_minutes: Number(newProduct.duration_minutes) || 60,
        price_cents: Number(newProduct.price_cents) || 0,
        is_in_person: newProduct.is_in_person,
        location: newProduct.is_in_person ? newProduct.location.trim() : null,
      };

      if (!payload.name) {
        setError('Please give your product a name.');
        return;
      }

      if (editingProductId) {
        const { data: updated, error: updateError } = await supabase
          .from('booking_products')
          .update(payload)
          .eq('id', editingProductId)
          .select('*')
          .single();

        if (updateError) throw updateError;
        setProducts((prev) => prev.map((p) => (p.id === editingProductId ? updated : p)));
        setEditingProductId(null);
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('booking_products')
          .insert(payload)
          .select('*')
          .single();

        if (insertError) throw insertError;
        setProducts((prev) => [...prev, inserted]);
      }

      setNewProduct({ name: '', description: '', duration_minutes: 60, price_cents: 0, is_in_person: false, location: '' });
    } catch (err) {
      console.error('Failed to save product:', err);
      setError(err.message || 'Unable to save product right now.');
    }
  };

  const handleEditProduct = (product) => {
    setNewProduct({
      name: product.name,
      description: product.description || '',
      duration_minutes: product.duration_minutes,
      price_cents: product.price_cents,
      is_in_person: product.is_in_person || false,
      location: product.location || '',
    });
    setEditingProductId(product.id);
  };

  const handleCancelEdit = () => {
    setNewProduct({ name: '', description: '', duration_minutes: 60, price_cents: 0, is_in_person: false, location: '' });
    setEditingProductId(null);
  };

  const handleDeleteProduct = async (productId) => {
    if (!confirm('Are you sure you want to delete this session type?')) return;
    try {
      const { error } = await supabase
        .from('booking_products')
        .delete()
        .eq('id', productId);
      
      if (error) throw error;
      setProducts(prev => prev.filter(p => p.id !== productId));
      if (editingProductId === productId) handleCancelEdit();
    } catch (err) {
      console.error('Failed to delete product:', err);
      setError('Failed to delete product');
    }
  };

  const toggleProductActive = async (product) => {
    try {
      const { data: updated, error: updateError } = await supabase
        .from('booking_products')
        .update({ is_active: !product.is_active })
        .eq('id', product.id)
        .select('*')
        .single();

      if (updateError) throw updateError;
      setProducts((prev) => prev.map((p) => (p.id === product.id ? updated : p)));
    } catch (err) {
      console.error('Failed to update product:', err);
      setError(err.message || 'Unable to update product.');
    }
  };

  const handleAcceptRequest = async (bookingId) => {
    const request = requests.find(r => r.id === bookingId);
    if (!request) return;

    try {
      // If it's an online session, create a Google Meet
      if (!request.booking_products?.is_in_person) {
        const { error: functionError } = await supabase.functions.invoke('create-meet-portal', {
          body: { booking_id: bookingId }
        });
        
        if (functionError) {
          console.error('Edge function error:', functionError);
          throw new Error('Failed to create Google Meet link. Have you linked your Google account?');
        }
      }

      // Update status to accepted (if the edge function didn't already do it, but we do it here to be safe/fast)
      // Actually, if the edge function does it, we might not need to, but let's do it to ensure UI updates immediately
      // Wait, if the edge function updates it, we should just refresh or update local state.
      // But let's stick to the plan: Edge function creates meet link and updates booking.
      // If we update it here too, we might overwrite the meet link if we are not careful.
      // So let's just update the status here IF the edge function didn't fail.
      
      // However, the edge function might take a second.
      // Let's assume the edge function handles the update of the meet link, and we update the status here.
      
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'accepted' })
        .eq('id', bookingId);
      if (error) throw error;

      setRequests((prev) => prev.filter((r) => r.id !== bookingId));
      
      // Refresh upcoming sessions to show the new one
      const { data: newSession } = await supabase
        .from('bookings')
        .select('*, booking_products(name, is_in_person, location)')
        .eq('id', bookingId)
        .single();
        
      if (newSession) {
        setUpcomingSessions(prev => [...prev, newSession].sort((a, b) => new Date(a.start_at) - new Date(b.start_at)));
      }

    } catch (err) {
      console.error('Failed to accept request:', err);
      alert(err.message || 'Failed to accept request');
    }
  };

  const bookingUrl = slug ? `${window.location.origin}/booking/${slug}` : '';

  return (
    <div className="portal-page min-h-screen bg-gradient-to-br from-purple-950 via-slate-900 to-slate-950 text-slate-100 flex items-stretch justify-center p-4 md:p-8">
      <div className="shell w-full max-w-5xl">
        <aside className="sidebar">
          <span className="pill">Session booking</span>
          <h2 className="text-3xl font-semibold mt-1">Configure your booking page</h2>
          <button className="btn btn-ghost mt-4" onClick={() => navigate('/app')}>
            Back to portal
          </button>
          <AccountSidebarIcon />
        </aside>
        <main className="content bg-slate-950/40 p-6 md:p-10">
          {loading && (
            <p className="text-slate-200 text-sm tracking-wide mb-4">Loading your booking settings…</p>
          )}

          {error && <div className="message show error mb-4">{error}</div>}

          {/* Upcoming Sessions Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Upcoming Sessions</h2>
              <button 
                className="text-sm text-violet-300 hover:text-violet-200 transition-colors"
                onClick={() => setActiveModal('past-sessions')}
              >
                View past sessions
              </button>
            </div>
            
            {upcomingSessions.length === 0 ? (
              <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6 text-center">
                <p className="text-slate-400">No upcoming sessions scheduled.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {upcomingSessions.map((session) => (
                  <div key={session.id} className="bg-slate-900/70 border border-white/10 rounded-xl p-4 hover:border-violet-500/30 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-medium bg-violet-500/20 text-violet-200 px-2 py-1 rounded">
                        {new Date(session.start_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(session.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <h3 className="font-semibold text-white mb-1">{session.client_name}</h3>
                    <p className="text-sm text-slate-400 mb-2">{session.booking_products?.name}</p>
                    
                    {session.booking_products?.is_in_person ? (
                      <p className="text-xs text-amber-300 mb-2 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        {session.booking_products.location || 'In Person'}
                      </p>
                    ) : (
                      session.meet_link && (
                        <a 
                          href={session.meet_link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-blue-300 hover:text-blue-200 mb-2 flex items-center gap-1 underline"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                          Join Google Meet
                        </a>
                      )
                    )}

                    {session.client_notes && (
                      <p className="text-xs text-slate-500 italic truncate">"{session.client_notes}"</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Requests Card */}
            <div 
              className="card bg-slate-900/70 border border-white/10 hover:border-violet-500/50 transition cursor-pointer group"
              onClick={() => setActiveModal('requests')}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-white group-hover:text-violet-300 transition">Requests</h3>
                {requests.length > 0 && (
                  <span className="bg-violet-500 text-slate-900 text-xs font-bold px-2 py-0.5 rounded-full">
                    {requests.length}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-400">
                {requests.length === 0 
                  ? "No pending requests." 
                  : `${requests.length} pending request${requests.length === 1 ? '' : 's'} waiting for approval.`}
              </p>
            </div>

            {/* Booking Page Details Card */}
            <div 
              className="card bg-slate-900/70 border border-white/10 hover:border-violet-500/50 transition cursor-pointer group"
              onClick={() => setActiveModal('details')}
            >
              <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-violet-300 transition">Page Details</h3>
              <p className="text-sm text-slate-400 mb-2">
                {title || 'Untitled Page'}
              </p>
              <div className="flex items-center gap-2 text-xs">
                <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500' : 'bg-slate-500'}`}></span>
                <span className="text-slate-300">{isLive ? 'Live' : 'Offline'}</span>
              </div>
            </div>

            {/* Availability Card */}
            <div 
              className="card bg-slate-900/70 border border-white/10 hover:border-violet-500/50 transition cursor-pointer group"
              onClick={() => setActiveModal('availability')}
            >
              <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-violet-300 transition">Availability</h3>
              <p className="text-sm text-slate-400">
                {availabilityRules.length} weekly rule{availabilityRules.length !== 1 ? 's' : ''} configured.
              </p>
              {overrides.length > 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  {overrides.length} date override{overrides.length !== 1 ? 's' : ''}.
                </p>
              )}
            </div>

            {/* Session Types Card */}
            <div 
              className="card bg-slate-900/70 border border-white/10 hover:border-violet-500/50 transition cursor-pointer group"
              onClick={() => setActiveModal('types')}
            >
              <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-violet-300 transition">Session Types</h3>
              <p className="text-sm text-slate-400">
                {products.length} product{products.length !== 1 ? 's' : ''} available.
              </p>
            </div>
          </div>

          {/* Modals */}
          {activeModal === 'requests' && (
            <Modal title="Booking Requests" onClose={() => setActiveModal(null)}>
              {requests.length === 0 ? (
                <p className="text-slate-400 text-center py-8">No pending requests at the moment.</p>
              ) : (
                <div className="space-y-4">
                  {requests.map((req) => (
                    <div key={req.id} className="border border-white/10 rounded-lg p-4 bg-slate-950/30">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-semibold text-white">{req.client_name}</h4>
                          <p className="text-sm text-slate-400">{req.client_email}</p>
                        </div>
                        <span className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded">
                          {new Date(req.start_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-sm text-slate-300 mb-3">
                        <p><span className="text-slate-500">Session:</span> {req.booking_products?.name}</p>
                        <p><span className="text-slate-500">Time:</span> {new Date(req.start_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(req.end_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                        {req.client_notes && (
                          <p className="mt-2 p-2 bg-slate-900 rounded text-slate-400 italic">"{req.client_notes}"</p>
                        )}
                      </div>
                      <div className="flex justify-end gap-2">
                        <button 
                          className="btn btn-primary text-xs"
                          onClick={() => handleAcceptRequest(req.id)}
                        >
                          Accept Request
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Modal>
          )}

          {activeModal === 'details' && (
            <Modal title="Booking Page Details" onClose={() => setActiveModal(null)}>
              <div className="grid gap-4 md:grid-cols-2 mb-4">
                <label className="block text-sm text-slate-200">
                  Title
                  <input
                    className="input mt-1 w-full"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Book a session with Sam"
                  />
                </label>
                <label className="block text-sm text-slate-200">
                  Logo URL
                  <input
                    className="input mt-1 w-full"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://example.com/logo.png"
                  />
                </label>
                <label className="block text-sm text-slate-200 md:col-span-2">
                  Description
                  <textarea
                    className="input mt-1 w-full min-h-[70px]"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Explain what clients can expect from sessions with you."
                  />
                </label>
              </div>
              <div className="space-y-3">
                <label className="block text-sm text-slate-200">
                  Slug (used at /booking/&lt;slug&gt;)
                  <input
                    className="input mt-1 w-full"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    onBlur={handleSlugBlur}
                    placeholder="your-name-or-business"
                  />
                </label>
                {slugStatus && <p className="text-xs text-slate-300">{slugStatus}</p>}

                {bookingUrl && (
                  <p className="text-xs text-slate-400 break-all">
                    Your booking link: <span className="text-violet-200 font-mono">{bookingUrl}</span>
                  </p>
                )}

                <div className="flex items-center gap-3 mt-3 pt-4 border-t border-white/10">
                  <button
                    className={`btn ${isLive ? 'btn-primary text-slate-900' : 'btn-secondary'}`}
                    onClick={handleToggleLive}
                    type="button"
                    disabled={saving}
                  >
                    {isLive ? 'Go offline' : 'Go live'}
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleSaveSettings}
                    disabled={saving}
                    type="button"
                  >
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </Modal>
          )}

          {activeModal === 'availability' && (
            <Modal title="Availability Settings" onClose={() => setActiveModal(null)}>
              <p className="text-sm text-slate-300 mb-4">
                Define weekly hours when clients can book, and block specific dates.
              </p>

              <div className="mb-6 border-b border-white/10 pb-6">
                 <label className="block text-sm text-slate-200">
                  Break time between sessions (minutes)
                  <div className="flex gap-3 mt-1">
                    <input
                        type="number"
                        min="0"
                        step="5"
                        className="input w-full"
                        value={minGapMinutes}
                        onChange={(e) => setMinGapMinutes(Number(e.target.value) || 0)}
                    />
                    <button 
                        className="btn btn-primary whitespace-nowrap"
                        onClick={() => handleSaveSettings(false)}
                        disabled={saving}
                    >
                        {saving ? 'Saving...' : 'Save Gap'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Default is 15 minutes. This gap is added before and after each booking.
                  </p>
                </label>
              </div>

              <WeeklyAvailabilityEditor
                loading={availabilityLoading}
                rules={availabilityRules}
                setRules={setAvailabilityRules}
                page={page}
                supabase={supabase}
              />

              <OverridesEditor
                overrides={overrides}
                setOverrides={setOverrides}
                page={page}
                supabase={supabase}
              />
            </Modal>
          )}

          {activeModal === 'types' && (
            <Modal title="Session Types" onClose={() => setActiveModal(null)}>
              <p className="text-sm text-slate-300 mb-4">
                Create products clients can book, with duration and price.
              </p>

              <div className="grid gap-3 mb-4 sm:grid-cols-2">
                <label className="block text-sm text-slate-200">
                  Name
                  <input
                    className="input mt-1 w-full"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Coaching session"
                  />
                </label>
                <label className="block text-sm text-slate-200">
                  Duration (minutes)
                  <input
                    type="number"
                    min="15"
                    step="15"
                    className="input mt-1 w-full"
                    value={newProduct.duration_minutes}
                    onChange={(e) => setNewProduct((p) => ({ ...p, duration_minutes: e.target.value }))}
                  />
                </label>
                <label className="block text-sm text-slate-200 sm:col-span-2">
                  Description
                  <textarea
                    className="input mt-1 w-full min-h-[60px]"
                    value={newProduct.description}
                    onChange={(e) => setNewProduct((p) => ({ ...p, description: e.target.value }))}
                    placeholder="What will clients get from this session?"
                  />
                </label>
                <label className="block text-sm text-slate-200">
                  Price (in pence)
                  <input
                    type="number"
                    min="0"
                    step="50"
                    className="input mt-1 w-full"
                    value={newProduct.price_cents}
                    onChange={(e) => setNewProduct((p) => ({ ...p, price_cents: e.target.value }))}
                  />
                </label>
                
                <div className="sm:col-span-2 border-t border-white/10 pt-4 mt-2">
                  <label className="block text-sm text-slate-200 mb-2">Session Format</label>
                  <div className="flex gap-3 mb-3">
                    <button
                      type="button"
                      className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-all ${
                        !newProduct.is_in_person
                          ? 'bg-violet-600 border-violet-500 text-white shadow-[0_0_15px_rgba(124,58,237,0.3)]'
                          : 'bg-slate-900/50 border-white/10 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                      onClick={() => setNewProduct(p => ({ ...p, is_in_person: false }))}
                    >
                      Online (Google Meet)
                    </button>
                    <button
                      type="button"
                      className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-all ${
                        newProduct.is_in_person
                          ? 'bg-violet-600 border-violet-500 text-white shadow-[0_0_15px_rgba(124,58,237,0.3)]'
                          : 'bg-slate-900/50 border-white/10 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                      onClick={() => setNewProduct(p => ({ ...p, is_in_person: true }))}
                    >
                      In Person
                    </button>
                  </div>

                  {newProduct.is_in_person && (
                    <label className="block text-sm text-slate-200 animate-in fade-in slide-in-from-top-2">
                      Location Address
                      <input
                        className="input mt-1 w-full"
                        value={newProduct.location}
                        onChange={(e) => setNewProduct((p) => ({ ...p, location: e.target.value }))}
                        placeholder="e.g. 123 Business St, London"
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="flex gap-2 mb-6">
                <button className="btn btn-primary flex-1" type="button" onClick={handleAddProduct}>
                  {editingProductId ? 'Update Product' : 'Add Product'}
                </button>
                {editingProductId && (
                  <button className="btn btn-secondary" type="button" onClick={handleCancelEdit}>
                    Cancel
                  </button>
                )}
              </div>

              {products.length > 0 && (
                <div className="space-y-3">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border rounded-lg p-3 ${
                        editingProductId === product.id ? 'border-violet-500 bg-violet-500/10' : 'border-white/10'
                      }`}
                    >
                      <div>
                        <h3 className="font-semibold text-white">
                          {product.name}{' '}
                          {!product.is_active && <span className="text-xs text-slate-400">(inactive)</span>}
                        </h3>
                        {product.description && (
                          <p className="text-sm text-slate-300">{product.description}</p>
                        )}
                        <p className="text-xs text-slate-400 mt-1">
                          {product.duration_minutes} minutes · £{(product.price_cents || 0) / 100}
                          <span className="mx-2 text-slate-600">|</span>
                          {product.is_in_person 
                            ? <span className="text-amber-300">In Person {product.location ? `at ${product.location}` : ''}</span>
                            : <span className="text-blue-300">Online (Google Meet)</span>
                          }
                        </p>
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-center">
                        <button
                          className="btn btn-secondary text-xs px-2 py-1"
                          type="button"
                          onClick={() => handleEditProduct(product)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-secondary text-xs px-2 py-1"
                          type="button"
                          onClick={() => toggleProductActive(product)}
                        >
                          {product.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          className="btn btn-ghost text-xs px-2 py-1 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                          type="button"
                          onClick={() => handleDeleteProduct(product.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Modal>
          )}

          {activeModal === 'past-sessions' && (
            <Modal title="Past Sessions" onClose={() => setActiveModal(null)}>
              {pastSessions.length === 0 ? (
                <p className="text-slate-400 text-center py-8">No past sessions found.</p>
              ) : (
                <div className="space-y-4">
                  {pastSessions.map((session) => (
                    <div key={session.id} className="border border-white/10 rounded-lg p-4 bg-slate-950/30">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-semibold text-white">{session.client_name}</h4>
                          <p className="text-sm text-slate-400">{session.client_email}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded block mb-1">
                            {new Date(session.start_at).toLocaleDateString()}
                          </span>
                          <span className="text-xs text-slate-500">
                            {new Date(session.start_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                      </div>
                      <div className="text-sm text-slate-300">
                        <p><span className="text-slate-500">Session:</span> {session.booking_products?.name}</p>
                        {session.client_notes && (
                          <p className="mt-2 p-2 bg-slate-900 rounded text-slate-400 italic">"{session.client_notes}"</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Modal>
          )}
        </main>
      </div>
    </div>
  );
};

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const WeeklyAvailabilityEditor = ({ loading, rules, setRules, page, supabase }) => {
  const [newRule, setNewRule] = useState({ weekday: 1, start_time: '09:00', end_time: '17:00' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async () => {
    if (!page?.id) return;
    setError('');
    setSaving(true);
    try {
      const payload = {
        booking_page_id: page.id,
        weekday: Number(newRule.weekday),
        start_time: newRule.start_time,
        end_time: newRule.end_time,
      };

      const { data, error: insertError } = await supabase
        .from('booking_availability_rules')
        .insert(payload)
        .select('*')
        .single();
      if (insertError) throw insertError;
      setRules((prev) => [...prev, data]);
    } catch (err) {
      console.error('Failed to add rule:', err);
      setError(err.message || 'Unable to add rule.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ruleId) => {
    if (!ruleId) return;
    setSaving(true);
    setError('');
    try {
      const { error: deleteError } = await supabase
        .from('booking_availability_rules')
        .delete()
        .eq('id', ruleId);
      if (deleteError) throw deleteError;
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
    } catch (err) {
      console.error('Failed to delete rule:', err);
      setError(err.message || 'Unable to delete rule.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-slate-200 mb-2">Weekly hours</h3>
      {error && <p className="text-xs text-red-300 mb-2">{error}</p>}
      {loading ? (
        <p className="text-xs text-slate-400 mb-2">Loading availability…</p>
      ) : (
        <div className="space-y-2 mb-3">
          {rules.length === 0 && (
            <p className="text-xs text-slate-400">No weekly hours set yet.</p>
          )}
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center justify-between gap-3 border border-white/10 rounded-lg px-3 py-2 text-xs"
            >
              <span className="text-slate-200">
                {weekdayLabels[rule.weekday]} · {rule.start_time.slice(0, 5)}–{rule.end_time.slice(0, 5)}
              </span>
              <button
                type="button"
                className="btn btn-secondary text-xs px-2 py-1"
                onClick={() => handleDelete(rule.id)}
                disabled={saving}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,1fr)] items-end text-xs">
        <label className="block text-slate-200">
          Day
          <select
            className="mt-1 input"
            value={newRule.weekday}
            onChange={(e) => setNewRule((r) => ({ ...r, weekday: Number(e.target.value) }))}
          >
            {weekdayLabels.map((label, idx) => (
              <option key={label} value={idx}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-slate-200">
          From
          <input
            type="time"
            className="mt-1 input"
            value={newRule.start_time}
            onChange={(e) => setNewRule((r) => ({ ...r, start_time: e.target.value }))}
          />
        </label>
        <label className="block text-slate-200">
          To
          <input
            type="time"
            className="mt-1 input"
            value={newRule.end_time}
            onChange={(e) => setNewRule((r) => ({ ...r, end_time: e.target.value }))}
          />
        </label>
        <button
          type="button"
          className="btn btn-primary text-xs mt-1"
          onClick={handleAdd}
          disabled={saving || !page?.id}
        >
          Add
        </button>
      </div>
    </div>
  );
};

const OverridesEditor = ({ overrides, setOverrides, page, supabase }) => {
  const [newOverride, setNewOverride] = useState({
    date: '',
    start_time: '00:00',
    end_time: '23:59',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async () => {
    if (!page?.id || !newOverride.date) return;
    setSaving(true);
    setError('');
    try {
      const startAt = new Date(`${newOverride.date}T${newOverride.start_time}:00`);
      const endAt = new Date(`${newOverride.date}T${newOverride.end_time}:00`);
      const payload = {
        booking_page_id: page.id,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        type: 'unavailable',
      };
      const { data, error: insertError } = await supabase
        .from('booking_availability_overrides')
        .insert(payload)
        .select('*')
        .single();
      if (insertError) throw insertError;
      setOverrides((prev) => [...prev, data]);
    } catch (err) {
      console.error('Failed to add override:', err);
      setError(err.message || 'Unable to add override.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!id) return;
    setSaving(true);
    setError('');
    try {
      const { error: deleteError } = await supabase
        .from('booking_availability_overrides')
        .delete()
        .eq('id', id);
      if (deleteError) throw deleteError;
      setOverrides((prev) => prev.filter((o) => o.id !== id));
    } catch (err) {
      console.error('Failed to delete override:', err);
      setError(err.message || 'Unable to delete override.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-slate-200 mb-2">Blocked dates</h3>
      {error && <p className="text-xs text-red-300 mb-2">{error}</p>}
      <div className="space-y-2 mb-3 max-h-40 overflow-y-auto pr-1">
        {overrides.length === 0 && (
          <p className="text-xs text-slate-400">No specific dates blocked.</p>
        )}
        {overrides.map((o) => {
          const start = new Date(o.start_at);
          const end = new Date(o.end_at);
          return (
            <div
              key={o.id}
              className="flex items-center justify-between gap-3 border border-white/10 rounded-lg px-3 py-2 text-xs"
            >
              <span className="text-slate-200">
                {start.toLocaleDateString()} · {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {' – '}
                {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <button
                type="button"
                className="btn btn-secondary text-xs px-2 py-1"
                onClick={() => handleDelete(o.id)}
                disabled={saving}
              >
                Remove
              </button>
            </div>
          );
        })}
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,1fr)] items-end text-xs">
        <label className="block text-slate-200">
          Date
          <input
            type="date"
            className="mt-1 input"
            value={newOverride.date}
            onChange={(e) => setNewOverride((v) => ({ ...v, date: e.target.value }))}
          />
        </label>
        <label className="block text-slate-200">
          From
          <input
            type="time"
            className="mt-1 input"
            value={newOverride.start_time}
            onChange={(e) => setNewOverride((v) => ({ ...v, start_time: e.target.value }))}
          />
        </label>
        <label className="block text-slate-200">
          To
          <input
            type="time"
            className="mt-1 input"
            value={newOverride.end_time}
            onChange={(e) => setNewOverride((v) => ({ ...v, end_time: e.target.value }))}
          />
        </label>
        <button
          type="button"
          className="btn btn-primary text-xs mt-1"
          onClick={handleAdd}
          disabled={saving || !page?.id}
        >
          Block
        </button>
      </div>
    </div>
  );
};

export default SessionBookingSetupPage;
