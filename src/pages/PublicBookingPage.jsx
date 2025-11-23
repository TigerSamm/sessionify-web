import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getSupabaseClient } from '../lib/supabaseClient.js';
import '../styles/portal.css';

const PublicBookingPage = () => {
  const { slug } = useParams();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [page, setPage] = useState(null);
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const { data: pageData, error: pageError } = await supabase
          .from('booking_pages')
          .select('*')
          .eq('slug', slug)
          .eq('is_live', true)
          .maybeSingle();

        if (pageError) throw pageError;
        if (!pageData) {
          setError('This booking page is not available. Please check the link or contact your practitioner.');
          setLoading(false);
          return;
        }

        setPage(pageData);

        const { data: productRows, error: productsError } = await supabase
          .from('booking_products')
          .select('id, name, description, duration_minutes, price_cents, is_active, is_in_person, location')
          .eq('booking_page_id', pageData.id)
          .eq('is_active', true)
          .order('created_at', { ascending: true });

        if (productsError) throw productsError;
        setProducts(productRows || []);
      } catch (err) {
        console.error('Failed to load booking page:', err);
        setError(err.message || 'Unable to load booking page.');
      } finally {
        setLoading(false);
      }
    })();
  }, [slug, supabase]);

  useEffect(() => {
    const loadSlots = async () => {
      if (!page || !selectedProductId) return;
      setLoadingSlots(true);
      setSlots([]);
      setSelectedSlot(null);
      try {
        const now = new Date();
        const startWindow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endWindow = new Date(startWindow.getTime() + 14 * 24 * 60 * 60 * 1000);

        const { data: rules, error: rulesError } = await supabase
          .from('booking_availability_rules')
          .select('*')
          .eq('booking_page_id', page.id);
        if (rulesError) throw rulesError;

        const { data: overrides, error: overridesError } = await supabase
          .from('booking_availability_overrides')
          .select('*')
          .eq('booking_page_id', page.id)
          .gte('end_at', startWindow.toISOString())
          .lte('start_at', endWindow.toISOString());
        if (overridesError) throw overridesError;

        const { data: existingBookings, error: bookingsError } = await supabase
          .from('public_bookings')
          .select('start_at, end_at, status')
          .eq('booking_page_id', page.id)
          .in('status', ['requested', 'accepted'])
          .gte('end_at', startWindow.toISOString())
          .lte('start_at', endWindow.toISOString());
        if (bookingsError) throw bookingsError;

        const product = products.find((p) => p.id === selectedProductId);
        const durationMinutes = Number(product?.duration_minutes || 60);
        const minGapMinutes = page.min_gap_minutes !== null ? Number(page.min_gap_minutes) : 15;

        const slotsGenerated = [];
        const daySlotsMap = {};

        const isOverlapping = (startA, endA, startB, endB) => {
          return startA < endB && startB < endA;
        };

        for (
          let day = new Date(startWindow.getTime());
          day <= endWindow;
          day = new Date(day.getTime() + 24 * 60 * 60 * 1000)
        ) {
          const weekday = day.getDay();
          const dateKey = day.toISOString().slice(0, 10);

          const applicableRules = (rules || []).filter((r) => {
            // Map stored weekday (1 = Monday .. 7 = Sunday) to JS getDay (0 = Sunday .. 6 = Saturday)
            const stored = r.weekday;
            const jsWeekday = stored === 7 ? 0 : stored;
            if (jsWeekday !== weekday) return false;

            const fromOk = !r.valid_from || dateKey >= r.valid_from;
            const toOk = !r.valid_to || dateKey <= r.valid_to;
            return fromOk && toOk;
          });

          const dayOverrides = (overrides || []).filter((o) => {
            const oStartDateKey = o.start_at.slice(0, 10);
            const oEndDateKey = o.end_at.slice(0, 10);
            return oStartDateKey <= dateKey && oEndDateKey >= dateKey;
          });

          const hasFullBlock = dayOverrides.some((o) => {
            if (o.type !== 'unavailable') return false;
            const oStart = new Date(o.start_at);
            const oEnd = new Date(o.end_at);
            const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
            const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
            return oStart <= dayStart && oEnd >= dayEnd;
          });

          if (!applicableRules.length || hasFullBlock) {
            daySlotsMap[dateKey] = [];
            continue;
          }

          const daySlotsForDate = [];

          applicableRules.forEach((rule) => {
            const [startHour, startMinute] = rule.start_time.split(':').map(Number);
            const [endHour, endMinute] = rule.end_time.split(':').map(Number);
            const ruleStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), startHour, startMinute);
            const ruleEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), endHour, endMinute);

            for (
              let slotStart = new Date(ruleStart.getTime());
              slotStart <= new Date(ruleEnd.getTime() - durationMinutes * 60 * 1000);
              slotStart = new Date(
                slotStart.getTime() + (durationMinutes + minGapMinutes) * 60 * 1000,
              )
            ) {
              const slotEnd = new Date(
                slotStart.getTime() + durationMinutes * 60 * 1000,
              );

              if (
                dayOverrides.some((o) =>
                  o.type === 'unavailable' &&
                  isOverlapping(slotStart, slotEnd, new Date(o.start_at), new Date(o.end_at)),
                )
              ) {
                continue;
              }

              const conflicts = (existingBookings || []).some((b) => {
                const bStart = new Date(b.start_at);
                const bEnd = new Date(b.end_at);
                return isOverlapping(slotStart, slotEnd, bStart, bEnd);
              });

              if (conflicts) continue;

              const slot = {
                id: `${dateKey}-${slotStart.toISOString()}`,
                dateKey,
                start: slotStart,
                end: slotEnd,
              };
              slotsGenerated.push(slot);
              daySlotsForDate.push(slot);
            }
          });

          daySlotsMap[dateKey] = daySlotsForDate;
        }

        setSlots(slotsGenerated);

        if (!selectedDate) {
          const firstWithSlots = Object.entries(daySlotsMap).find(([, arr]) => arr.length > 0);
          if (firstWithSlots) {
            setSelectedDate(firstWithSlots[0]);
          }
        }
      } catch (err) {
        console.error('Failed to load slots:', err);
        setError(err.message || 'Unable to load available times.');
      } finally {
        setLoadingSlots(false);
      }
    };

    loadSlots();
  }, [page, selectedProductId, products, selectedDate, supabase]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setStatus('');

    if (!page) return;
    if (!selectedProductId || !selectedSlot || !clientName || !clientEmail) {
      setError('Please complete all required fields.');
      return;
    }

    const product = products.find((p) => p.id === selectedProductId);
    if (!product || !selectedSlot) {
      setError('Please choose a session type.');
      return;
    }
    const start = selectedSlot.start;
    const end = selectedSlot.end;

    setSubmitting(true);
    try {
      const payload = {
        booking_page_id: page.id,
        booking_product_id: product.id,
        host_user_id: page.owner_user_id,
        client_name: clientName.trim(),
        client_email: clientEmail.trim(),
        client_notes: clientNotes.trim(),
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        price_cents: product.price_cents,
        currency: product.currency || 'GBP',
        status: 'requested',
      };

      const { error: insertError } = await supabase.from('bookings').insert(payload);
      if (insertError) throw insertError;

      setStatus('Your booking request has been sent! You will receive a confirmation once it is accepted.');
      setClientName('');
      setClientEmail('');
      setClientNotes('');
      setSelectedSlot(null);
    } catch (err) {
      console.error('Failed to create booking:', err);
      setError(err.message || 'Unable to create booking right now.');
    } finally {
      setSubmitting(false);
    }
  };

  const today = new Date();
  const datesToShow = [];
  for (let i = 0; i < 14; i += 1) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    datesToShow.push({ key, date: d });
  }

  const slotsByDate = slots.reduce((acc, slot) => {
    if (!acc[slot.dateKey]) acc[slot.dateKey] = [];
    acc[slot.dateKey].push(slot);
    return acc;
  }, {});

  const canContinueFromStep1 = !!selectedProductId;
  const canContinueFromStep2 = !!selectedSlot;

  const selectedProduct = products.find(p => p.id === selectedProductId);

  return (
    <div className="portal-page min-h-screen bg-gradient-to-br from-purple-950 via-slate-900 to-slate-950 text-slate-100 flex items-stretch justify-center p-4 md:p-8">
      <div className="shell w-full max-w-5xl">
        <aside className="sidebar">
          <span className="pill">Session booking</span>
          {page?.logo_url && (
            <div className="mt-0 mb-0">
              <img src={page.logo_url} alt={`${page.title || 'Booking page'} logo`} className="max-h-16 object-contain" />
            </div>
          )}
          <h2 className="text-3xl font-semibold mt-0">{page?.title || 'Book a session'}</h2>
          {page?.description && <p className="text-slate-100/80 mt-0 text-sm">{page.description}</p>}
          Powered by Sessionize.
        </aside>
        <main className="content bg-slate-950/40 p-6 md:p-8">
          {loading && (
            <p className="text-slate-300 text-sm mb-4">Loading booking page…</p>
          )}

          {status && <div className="message show success mb-4">{status}</div>}
          {error && <div className="message show error mb-4">{error}</div>}

          {!status && !error && page && (
          <>
          <div className="flex items-center gap-3 mb-4 text-xs text-slate-300">
            <div className={`flex items-center gap-2 ${step === 1 ? 'font-semibold text-white' : ''}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                step >= 1 ? 'bg-violet-500 text-slate-900' : 'bg-slate-700 text-slate-200'
              }`}>1</span>
              <span>Session type</span>
            </div>
            <span className="opacity-50">→</span>
            <div className={`flex items-center gap-2 ${step === 2 ? 'font-semibold text-white' : ''}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                step >= 2 ? 'bg-violet-500 text-slate-900' : 'bg-slate-700 text-slate-200'
              }`}>2</span>
              <span>Time slot</span>
            </div>
            <span className="opacity-50">→</span>
            <div className={`flex items-center gap-2 ${step === 3 ? 'font-semibold text-white' : ''}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                step >= 3 ? 'bg-violet-500 text-slate-900' : 'bg-slate-700 text-slate-200'
              }`}>3</span>
              <span>Details</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {step === 1 && (
              <div>
                <label className="block text-sm text-slate-200 mb-1">Select a session type</label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {products.map((product) => {
                    const isSelected = selectedProductId === product.id;
                    return (
                      <button
                        key={product.id}
                        type="button"
                        className={`text-left rounded-xl border px-4 py-3 text-sm transition flex flex-col gap-1 ${
                          isSelected
                            ? 'border-violet-400 bg-violet-500/10 shadow-[0_0_0_1px_rgba(167,139,250,0.6)]'
                            : 'border-slate-700/80 bg-slate-900/60 hover:border-violet-400/60 hover:bg-slate-900'
                        }`}
                        onClick={() => {
                          setSelectedProductId(product.id);
                          setSelectedSlot(null);
                          setSelectedDate(null);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-50">{product.name}</span>
                          <span className="text-xs font-semibold text-violet-300">
                            £{((product.price_cents || 0) / 100).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-300 mt-1">
                          <span>{product.duration_minutes} min</span>
                          {product.is_in_person ? (
                            <span className="text-amber-300/80 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                              In Person
                            </span>
                          ) : (
                            <span className="text-blue-300/80 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                              Online
                            </span>
                          )}
                        </div>
                        {product.description && (
                          <div className="text-xs text-slate-400 mt-1 truncate">{product.description}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <label className="block text-sm text-slate-200 mb-2">Choose a time</label>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <div className="grid grid-cols-7 gap-1 text-xs mb-2">
                      {datesToShow.map(({ key, date }) => {
                        const hasSlots = (slotsByDate[key] || []).length > 0;
                        const isSelected = selectedDate === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            disabled={!hasSlots || loadingSlots}
                            className={`rounded-lg px-2 py-2 border text-center transition text-[11px] leading-tight ${
                              isSelected
                                ? 'bg-violet-500 text-slate-900 border-violet-300'
                                : hasSlots
                                ? 'bg-slate-900/70 text-slate-100 border-slate-600'
                                : 'bg-slate-900/30 text-slate-500 border-slate-800 cursor-not-allowed'
                            }`}
                            onClick={() => setSelectedDate(key)}
                          >
                            <div>{date.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                            <div>{date.getDate()}</div>
                          </button>
                        );
                      })}
                    </div>
                  <p className="text-xs text-slate-400">
                    Coloured days have available sessions; greyed-out days are fully booked or unavailable.
                  </p>
                </div>
                <div className="flex-1">
                  <div className="border border-white/10 rounded-lg p-3 min-h-[80px]">
                    {loadingSlots && <p className="text-xs text-slate-400">Loading available times…</p>}
                    {!loadingSlots && (!selectedDate || !(slotsByDate[selectedDate] || []).length) && (
                      <p className="text-xs text-slate-400">No available times for the selected day.</p>
                    )}
                    {!loadingSlots && selectedDate && (slotsByDate[selectedDate] || []).length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {(slotsByDate[selectedDate] || []).map((slot) => (
                          <button
                            key={slot.id}
                            type="button"
                            className={`text-xs px-3 py-2 rounded-full border transition ${
                              selectedSlot?.id === slot.id
                                ? 'bg-violet-500 text-slate-900 border-violet-300'
                                : 'bg-slate-900/70 text-slate-100 border-slate-600'
                            }`}
                            onClick={() => setSelectedSlot(slot)}
                          >
                            {slot.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              </div>
            )}

            {step === 3 && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm text-slate-200">
                    Your name
                    <input
                      required
                      className="input mt-1 w-full"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                    />
                  </label>
                  <label className="block text-sm text-slate-200">
                    Email
                    <input
                      required
                      type="email"
                      className="input mt-1 w-full"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                    />
                  </label>
                </div>

                <label className="block text-sm text-slate-200">
                  Notes (optional)
                  <textarea
                    className="input mt-1 w-full min-h-[80px]"
                    value={clientNotes}
                    onChange={(e) => setClientNotes(e.target.value)}
                    placeholder="Anything helpful for this session?"
                  />
                </label>
              </>
            )}

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                className="btn btn-secondary text-xs"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                disabled={step === 1}
              >
                Back
              </button>
              {step < 3 && (
                <button
                  type="button"
                  className="btn btn-primary text-xs"
                  onClick={() => setStep((s) => Math.min(3, s + 1))}
                  disabled={(step === 1 && !canContinueFromStep1) || (step === 2 && !canContinueFromStep2)}
                >
                  Next
                </button>
              )}
              {step === 3 && (
                <button
                  type="submit"
                  className="btn btn-primary text-xs"
                  disabled={submitting || products.length === 0 || !selectedSlot}
                >
                  {submitting ? 'Sending request…' : 'Request booking'}
                </button>
              )}
            </div>
          </form>
          </>
          )}

          {products.length === 0 && !status && !error && (
            <p className="text-xs text-slate-400 mt-4">
              The host has not configured any session types yet.
            </p>
          )}
        </main>
      </div>
    </div>
  );
};

export default PublicBookingPage;
