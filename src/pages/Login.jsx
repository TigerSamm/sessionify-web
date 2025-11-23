import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getSupabaseClient } from '../lib/supabaseClient.js';
import { persistSession, hydrateSession } from '../lib/sessionStorage.js';
import { ACCOUNT_PORTAL_URL } from '../config.js';
import logoColour from '../assets/logo-colour.png';

const REMEMBER_ME_KEY = 'sessionifyRememberMeEmail';

const LoginPage = () => {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);

  const launchedByDesktop = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(window.opener && !window.opener.closed);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedEmail = window.localStorage.getItem(REMEMBER_ME_KEY);
    if (storedEmail) {
      setEmail(storedEmail);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    hydrateSession(supabase);
  }, [supabase]);

  const showMessage = (text, type) => setMessage({ text, type });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    showMessage('', '');
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      persistSession(authData.session);

      const { data: userRecord, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();
      if (userError || !userRecord) {
        throw new Error('User record not found. Please contact support.');
      }

      const { data: organisationRecord, error: orgError } = await supabase
        .from('organisations')
        .select('*')
        .or(`admin.eq.${userRecord.id},members.cs.{${userRecord.id}}`)
        .limit(1)
        .maybeSingle();
      if (orgError) {
        console.error('Org fetch error:', orgError);
        throw new Error('Error fetching organisation. Please contact support.');
      }
      
      if (!organisationRecord) {
        throw new Error('Organisation record not found. Please contact support.');
      }

      const licenseExpiry = new Date(userRecord.license_expiry);
      if (Number.isFinite(licenseExpiry) && licenseExpiry < new Date()) {
        throw new Error('Your license has expired. Please renew your subscription.');
      }

      if (rememberMe) {
        window.localStorage.setItem(REMEMBER_ME_KEY, email);
      } else {
        window.localStorage.removeItem(REMEMBER_ME_KEY);
      }

      const userData = {
        id: userRecord.id,
        email: userRecord.email || authData.user.email,
        name: userRecord.name,
        license_expiry: userRecord.license_expiry,
        license: userRecord.license,
        company: organisationRecord.name,
        company_logo: userRecord.company_logo,
        modules: userRecord.modules,
        stripe_customer_id: userRecord.stripe_customer_id,
        access_token: authData.session.access_token,
      };

      showMessage('Authentication successful!', 'success');

      if (typeof window !== 'undefined' && window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'NOTEHUB_AUTH_SUCCESS', data: userData }, '*');
        setTimeout(() => window.close(), 800);
        return;
      }

      const nextRoute = searchParams.get('redirect') || ACCOUNT_PORTAL_URL;
      setTimeout(() => navigate(nextRoute, { replace: true }), 600);
    } catch (err) {
      console.error('Authentication error:', err);
      showMessage(err.message || 'Authentication failed. Please check your credentials.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-950 via-slate-900 to-slate-950 text-slate-100 p-4">
      <div className="w-full max-w-md bg-white text-slate-900 rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <img src={logoColour} alt="Sessionize Logo" className="mx-auto w-36" />
          <p className="mt-3 text-gray-500" id="subheading">
            {launchedByDesktop ? 'Sign in to continue to the Sessionize app...' : 'Sign in to continue to the Account Center...'}
          </p>
        </div>
        {message.text && (
          <div className={`message show ${message.type}`}>
            {message.text}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              className="mt-2 w-full rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-2 w-full rounded-xl border-2 border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-indigo-500 focus:ring-indigo-400"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Remember my email on this device
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full btn btn-primary btn-lg justify-center"
          >
            {loading ? 'Signing In…' : 'Sign In'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          Need an account?{' '}
          <button
            type="button"
            className="text-indigo-600 font-semibold"
            onClick={() => navigate('/app/signup')}
          >
            Create one now
          </button>
        </p>
        <p className="mt-4 text-center text-xs text-gray-400">© {new Date().getFullYear()} LunaFox Apps. All rights reserved.</p>
      </div>
    </div>
  );
};

export default LoginPage;
