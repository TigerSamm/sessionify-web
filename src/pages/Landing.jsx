import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../components/ThemeProvider.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import logoColour from '../assets/logo-colour.png';
import logoWhite from '../assets/logo-white.png';
import { SESSIONIFY_PROTOCOL } from '../config.js';
import '../styles/landing.css';

const LandingPage = () => {
  const { theme } = useTheme();

  const features = useMemo(() => {
    const items = [
      { icon: '🗂️', label: 'Client Profiles' },
      { icon: '📝', label: 'Session Notes' },
      { icon: '📅', label: 'Calendar' },
      { icon: '📂', label: 'Cloud Storage' },
      { icon: '💳', label: 'Payment Tracker' },
      { icon: '👥', label: 'Group Clients' },
      { icon: '⚡', label: 'Quick Actions' },
      { icon: '🔒', label: 'Privacy' },
      { icon: '📹', label: 'Google Meet' },
    ];
    return items.map((item, index) => ({
      ...item,
      left: `${10 + Math.random() * 75}%`,
      top: `${5 + Math.random() * 70}%`,
      delay: (index * 0.1 + Math.random() * 0.3).toFixed(2),
      floatDuration: (3 + Math.random() * 3).toFixed(2),
    }));
  }, []);

  return (
    <div className={`landing-page min-h-screen flex flex-col ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-gray-50 text-gray-800'}`}>
      <header className="p-6 flex flex-wrap gap-4 justify-between items-center">
        <div className="flex items-center gap-3">
          <img src={theme === 'dark' ? logoWhite : logoColour} alt="Sessionize" className="h-9 w-auto" />
          <div>
            <p className="font-semibold leading-tight">Client Session Management</p>
            <p className="text-sm text-gray-400">Purpose-built for practitioners</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link to="/app/login" className="btn btn-secondary">
            Log In
          </Link>
          <Link to="/app/login?signup=1" className="btn btn-primary">
            Sign Up
          </Link>
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center justify-center text-center px-4">
        <section className="max-w-5xl w-full">
          <div className="relative my-8">
            <div
              className={`mx-auto w-full max-w-3xl h-64 md:h-80 rounded-2xl shadow-2xl overflow-hidden relative ${
                theme === 'dark' ? 'bg-slate-800' : 'bg-white'
              }`}
            >
              <div className="absolute inset-0 p-6 flex flex-col md:flex-row gap-6">
                <div className={`md:w-32 rounded-2xl p-4 ${theme === 'dark' ? 'bg-slate-700/80' : 'bg-indigo-50'}`}>
                  <div className="h-3 rounded bg-white/30 mb-2 w-3/4" />
                  <div className="h-2 rounded bg-white/20 mb-2 w-5/6" />
                  <div className="space-y-2 mt-3">
                    {[0, 1, 2].map((row) => (
                      <div key={row} className="h-8 rounded bg-white/10" />
                    ))}
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[0, 1, 2, 3, 4, 5].map((col) => (
                    <div
                      key={col}
                      className={`rounded-xl p-3 flex flex-col justify-between ${
                        theme === 'dark' ? 'bg-slate-700/60' : 'bg-gray-100'
                      }`}
                    >
                      <div className="h-6 rounded bg-white/20 w-3/5 mb-3" />
                      <div className="h-3 rounded bg-white/10 mb-2" />
                      <div className="h-3 rounded bg-white/10 w-4/5" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {features.map((feature, index) => (
              <div
                key={`${feature.label}-${index}`}
                className={`absolute inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm shadow-lg pointer-events-none ${
                  theme === 'dark' ? 'bg-slate-700 text-white' : 'bg-white text-gray-800'
                }`}
                style={{
                  left: feature.left,
                  top: feature.top,
                  animation: `pop 700ms ${feature.delay}s cubic-bezier(.2,.9,.3,1) both, float ${feature.floatDuration}s ${feature.delay}s ease-in-out infinite alternate`,
                }}
              >
                <span className="text-lg">{feature.icon}</span>
                <span className="sm:inline">{feature.label}</span>
              </div>
            ))}
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 mt-8 leading-tight">Streamline Your Client Management</h1>
          <p className="text-lg mb-8 max-w-2xl mx-auto text-gray-500 dark:text-gray-300">
            Sessionize is the all-in-one platform to manage your clients, sessions, payments, and notes with ease. Focus on what matters most — your clients.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/app/login?signup=1" className="btn btn-primary btn-lg">
              Get Started for Free
            </Link>
            <a href={`${SESSIONIFY_PROTOCOL}://launch`} className="btn btn-secondary btn-lg">
              Launch the App
            </a>
          </div>
        </section>

        <section id="benefits" className="w-full max-w-6xl mx-auto mt-24 px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Why Choose Sessionize?</h2>
          <div className="grid md:grid-cols-3 gap-8 text-left">
            {[
              { icon: '🗂️', title: 'Centralized Data', desc: 'All client information, session history, and notes live together. Never lose track of context.' },
              { icon: '⚡', title: 'Efficient Workflow', desc: 'A clean, intuitive workspace so you can create, update, and find what you need in seconds.' },
              { icon: '🔒', title: 'Secure & Private', desc: "All of your client data is 100% local. We don't see a thing." },
              { icon: '🧩', title: 'Integrations', desc: 'Connect your favorite tools and automate the busywork across your practice.' },
              { icon: '📹', title: 'Google Meet Ready', desc: 'Sync Meet links, recordings, and notes so every session stays organized.' },
              { icon: '💡', title: 'Community Driven', desc: 'We ship improvements based on practitioner feedback, so your workflow keeps improving.' },
            ].map((item) => (
              <div key={item.title} className="card">
                <div className="text-3xl mb-4">{item.icon}</div>
                <h3 className="font-bold text-xl mb-2">{item.title}</h3>
                <p className="text-gray-500 dark:text-gray-300">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="text-center p-6 text-sm text-gray-500">
        <p>&copy; {new Date().getFullYear()} Sessionize. All rights reserved.</p>
        <p>
          <Link className="underline" to="/app/login">
            Log in to the workspace
          </Link>
        </p>
      </footer>
    </div>
  );
};

export default LandingPage;
