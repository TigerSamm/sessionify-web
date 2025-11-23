import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { getSupabaseClient } from '../lib/supabaseClient.js';
import { persistSession } from '../lib/sessionStorage.js';
import logoColour from '../assets/logo-colour.png';

const orgTypes = ['Psychologist', 'Therapist', 'In-house Team', 'Nonprofit', 'Other'];
const moduleOptions = [
  { value: 'sessions', label: 'Session Notes' },
  { value: 'clients', label: 'Client Profiles' },
  { value: 'automation', label: 'Automation & Templates' },
  { value: 'backups', label: 'Cloud Backups' },
];

const SignupPage = () => {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    companyLogo: '',
    orgName: '',
    orgType: '',
    modules: [],
  });

  const showMessage = (text, type = 'info') => setMessage({ text, type });

  const updateField = (field) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleModule = (value) => {
    setForm((prev) => {
      const exists = prev.modules.includes(value);
      const modules = exists ? prev.modules.filter((item) => item !== value) : [...prev.modules, value];
      return { ...prev, modules };
    });
  };

  const steps = ['Your Profile', 'Organisation', 'Interests'];

  const validateCurrentStep = () => {
    if (step === 0) {
      if (!form.name.trim()) return 'Please provide your full name to continue.';
      if (!form.email.trim()) return 'Work email is required.';
      if (form.password.length < 8) return 'Password must be at least 8 characters.';
    }
    if (step === 1) {
      if (!form.orgName.trim()) return 'Add your organisation or practice name.';
      if (!form.orgType.trim()) return 'Pick an organisation type.';
    }
    return null;
  };

  const handleNext = () => {
    const error = validateCurrentStep();
    if (error) {
      showMessage(error, 'error');
      return;
    }
    showMessage('', 'info');
    setStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    showMessage('', 'info');
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.orgType) {
      showMessage('Please pick an organisation type.', 'error');
      return;
    }
    setLoading(true);
    showMessage('', 'info');

    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: { full_name: form.name?.trim() || undefined },
        },
      });

      if (error) throw error;

      if (data.session) {
        persistSession(data.session);
        const trimmedOrgName = form.orgName.trim();
        const { error: fnError } = await supabase.functions.invoke('onboard-signup', {
          body: {
            name: form.name.trim(),
            companyLogo: form.companyLogo.trim(),
            modules: form.modules,
            orgName:
              trimmedOrgName ||
              (form.name.trim() ? `${form.name.trim()}'s Org` : 'My Sessionize Organisation'),
            orgType: form.orgType,
          },
        });

        if (fnError) throw fnError;

        showMessage('Account created! Redirecting to your portal…', 'success');
        setTimeout(() => navigate('/app', { replace: true }), 800);
      } else {
        showMessage('We just sent a confirmation email. Please verify it to finish your setup.', 'info');
      }
    } catch (err) {
      console.error('Signup failed:', err);
      showMessage(err.message || 'Unable to create your account. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-950 via-slate-900 to-slate-950 text-slate-100 p-4">
      <div className="w-full max-w-2xl bg-white text-slate-900 rounded-3xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <img src={logoColour} alt="Sessionize Logo" className="mx-auto w-32" />
          <h1 className="text-3xl font-semibold mt-4">Create your Sessionize account</h1>
          <p className="mt-2 text-gray-500">Tell us about you and your organisation to get started.</p>
        </div>

        <div className="flex justify-between items-center mb-6">
          {steps.map((label, index) => (
            <div key={label} className="flex-1 flex flex-col items-center">
              <div
                className={clsx('w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm', {
                  'bg-indigo-600 text-white': index === step,
                  'bg-indigo-100 text-indigo-600': index < step,
                  'bg-slate-200 text-slate-500': index > step,
                })}
              >
                {index + 1}
              </div>
              <p className="text-xs mt-2 text-center text-slate-500 font-medium">{label}</p>
            </div>
          ))}
        </div>

        {message.text && (
          <div className={clsx('message show mb-6', message.type)}>{message.text}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {step === 0 && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Full name</label>
                  <input
                    type="text"
                    required
                    className="mt-2 w-full rounded-2xl border-2 border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    value={form.name}
                    onChange={updateField('name')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Work email</label>
                  <input
                    type="email"
                    required
                    className="mt-2 w-full rounded-2xl border-2 border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    value={form.email}
                    onChange={updateField('email')}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  className="mt-2 w-full rounded-2xl border-2 border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  value={form.password}
                  onChange={updateField('password')}
                />
                <p className="text-xs text-slate-400 mt-1">Minimum 8 characters.</p>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Organisation name</label>
                  <input
                    type="text"
                    required
                    className="mt-2 w-full rounded-2xl border-2 border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    value={form.orgName}
                    onChange={updateField('orgName')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Organisation type</label>
                  <select
                    required
                    className="mt-2 w-full rounded-2xl border-2 border-slate-200 px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    value={form.orgType}
                    onChange={updateField('orgType')}
                  >
                    <option value="" disabled>
                      Select an option
                    </option>
                    {orgTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Company logo URL</label>
                <input
                  type="url"
                  className="mt-2 w-full rounded-2xl border-2 border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  value={form.companyLogo}
                  onChange={updateField('companyLogo')}
                  placeholder="https://example.com/logo.png"
                />
              </div>
            </>
          )}

          {step === 2 && (
            <div>
              <p className="block text-sm font-medium text-gray-700 mb-3">Which Sessionize modules interest you?</p>
              <div className="grid gap-3 md:grid-cols-2">
                {moduleOptions.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-3 rounded-2xl border-2 border-slate-200 px-4 py-3 text-sm font-medium text-gray-700"
                  >
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-indigo-500 focus:ring-indigo-400"
                      checked={form.modules.includes(option.value)}
                      onChange={() => toggleModule(option.value)}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-3">You can switch modules later inside the portal.</p>
            </div>
          )}

          <div className="flex flex-wrap gap-4 pt-4">
            {step > 0 && (
              <button type="button" className="btn btn-secondary flex-1 min-w-[150px]" onClick={handleBack}>
                Back
              </button>
            )}
            {step < steps.length - 1 && (
              <button type="button" className="btn btn-primary flex-1 min-w-[200px]" onClick={handleNext}>
                Next step
              </button>
            )}
            {step === steps.length - 1 && (
              <button type="submit" className="btn btn-primary flex-1 min-w-[200px]" disabled={loading}>
                {loading ? 'Creating account…' : 'Create account'}
              </button>
            )}
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <button type="button" className="text-indigo-600 font-semibold" onClick={() => navigate('/app/login')}>
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
};

export default SignupPage;
