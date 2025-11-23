import { useCallback, useEffect, useMemo, useState } from 'react';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { useTheme } from '../components/ThemeProvider.jsx';
import { getSupabaseClient } from '../lib/supabaseClient.js';
import logoColour from '../assets/logo-colour.png';
import logoWhite from '../assets/logo-white.png';
import { SESSIONIFY_PROTOCOL } from '../config.js';

const detectEmbeddedContext = () => {
  if (typeof window === 'undefined') return false;
  const configFlag = window.SESSIONIFY_HELP_CONFIG?.embedded;
  if (typeof configFlag === 'boolean') return configFlag;
  const search = window.location?.search || '';
  if (/[?&](source|origin)=app(&|$)/i.test(search)) return true;
  const opener = Boolean(window.opener && !window.opener.closed);
  const ua = window.navigator?.userAgent || '';
  return opener || /Electron/i.test(ua);
};

const HelpCenterPage = () => {
  const { theme } = useTheme();
  const supabaseClient = useMemo(() => getSupabaseClient(), []);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const isEmbedded = useMemo(() => detectEmbeddedContext(), []);

  const loadArticles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: fetchError } = await supabaseClient
        .from('help_articles')
        .select('*')
        .eq('is_published', true)
        .order('published_at', { ascending: false });
      if (fetchError) throw fetchError;
      if (Array.isArray(data) && data.length) {
        setArticles(data);
        setSelectedArticle(null);
      } else {
        setArticles([]);
        setError('No published help articles yet.');
      }
    } catch (err) {
      console.error('Help articles fetch failed', err);
      setError(err.message || 'Unable to load live help content.');
      setArticles([]);
      setSelectedArticle(null);
    } finally {
      setLoading(false);
    }
  }, [supabaseClient]);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  const categories = useMemo(() => {
    const base = new Set(['all']);
    articles.forEach((article) => {
      if (article?.category) base.add(article.category);
    });
    return Array.from(base);
  }, [articles]);

  const filteredArticles = useMemo(() => {
    if (!Array.isArray(articles) || !articles.length) return [];
    const query = search.trim().toLowerCase();
    return articles.filter((article) => {
      const matchesCategory =
        activeCategory === 'all' || (article.category || '').toLowerCase() === activeCategory.toLowerCase();
      if (!matchesCategory) return false;
      if (!query) return true;
      const haystack = [
        article.title,
        article.summary,
        article.category,
        Array.isArray(article.tags) ? article.tags.join(' ') : '',
        typeof article.content === 'string' ? article.content : article.content_md || '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [articles, activeCategory, search]);

  return (
    <div className={`min-h-screen flex flex-col ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-gray-50 text-gray-800'}`}>
      <header className="p-6 flex flex-wrap gap-4 justify-between items-center">
        <div className="flex items-center gap-3">
          <img src={theme === 'dark' ? logoWhite : logoColour} alt="Sessionize" className="h-9 w-auto" />
          <div>
            <p className="font-semibold leading-tight">Sessionize Help Center</p>
            <p className="text-sm text-gray-400">Workflow guides for practitioners</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!isEmbedded && (
            <>
              <ThemeToggle />
              <a href="/" className="btn btn-secondary">
                Marketing Site
              </a>
              <a href={`${SESSIONIFY_PROTOCOL}://launch`} className="btn btn-primary">
                Launch App
              </a>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 pb-12">
        {!selectedArticle && (
          <section className="max-w-6xl mx-auto text-center py-10">
            <h1 className="text-4xl font-extrabold mb-4">How can we help?</h1>
            <p className="text-lg text-gray-500 dark:text-gray-300 max-w-2xl mx-auto">
              Search walkthroughs, get product updates, and share articles with your team.
            </p>
            <div className="mt-8 max-w-3xl mx-auto relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <input
                type="text"
                className="w-full rounded-full border border-white/10 bg-white/80 dark:bg-slate-800/60 px-12 py-4 text-base focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Search articles, tags, or categories"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {loading && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500">Loading…</span>}
            </div>
            {error && <p className="mt-3 text-sm text-amber-400">{error}</p>}
          </section>
        )}

        <section className="max-w-6xl mx-auto">
          {!selectedArticle ? (
            <div>
              <div className="flex flex-wrap gap-3 justify-center mb-8">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`btn ${activeCategory === category ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    {category === 'all' ? 'All topics' : category}
                  </button>
                ))}
              </div>
              <div className="space-y-4">
                {filteredArticles.map((article) => (
                  <article
                    key={article.id || article.slug}
                    className="card text-left border border-transparent hover:border-white/30 transition cursor-pointer"
                    onClick={() => {
                      setSelectedArticle(article);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    <div className="flex items-center gap-3 mb-2 text-xs uppercase tracking-wide text-indigo-500">
                      <span>{article.category}</span>
                      <span>•</span>
                      <span>{article.reading_time || 4} min read</span>
                    </div>
                    <h3 className="text-2xl font-semibold mb-2">{article.title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-300 mb-4">{article.summary}</p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {(article.tags || []).map((tag) => (
                        <span key={tag} className="px-3 py-1 rounded-full text-xs bg-white/40 dark:bg-white/10 text-gray-700 dark:text-gray-200">
                          #{tag}
                        </span>
                      ))}
                    </div>
                    <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
                      <span>{article.author || 'Sessionize Team'}</span>
                      <span className="font-semibold">Read →</span>
                    </div>
                  </article>
                ))}
                {!filteredArticles.length && (
                  <div className="card text-center opacity-80">
                    <p>No articles match your filters yet.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <article className="card max-w-4xl mx-auto text-left">
              <button type="button" className="btn btn-secondary mb-6" onClick={() => setSelectedArticle(null)}>
                ← Back to help center
              </button>
              <div className="text-xs uppercase tracking-wide text-indigo-400 mb-2">{selectedArticle.category}</div>
              <h1 className="text-3xl font-bold mb-4">{selectedArticle.title}</h1>
              <p className="text-base text-gray-500 dark:text-gray-300 mb-6">{selectedArticle.summary}</p>
              <div className="flex flex-wrap gap-2 mb-6">
                {(selectedArticle.tags || []).map((tag) => (
                  <span key={tag} className="px-3 py-1 rounded-full text-xs bg-white/30 dark:bg-white/10 text-gray-700 dark:text-gray-200">
                    #{tag}
                  </span>
                ))}
              </div>
              <div className="article-content text-base text-gray-700 dark:text-gray-100 space-y-4">
                {(selectedArticle?.content ?? selectedArticle?.content_md ?? '')
                  .split(/\n\n+/)
                  .filter(Boolean)
                  .map((paragraph, idx) => (
                    <p key={idx}>{paragraph}</p>
                  ))}
              </div>
              <div className="mt-10 text-sm text-gray-400 dark:text-gray-500 flex justify-between flex-wrap gap-2">
                <span>Author: {selectedArticle.author || 'Sessionize Team'}</span>
                <span>{new Date(selectedArticle.published_at || Date.now()).toLocaleDateString()}</span>
                <span>{selectedArticle.reading_time || 4} min read</span>
              </div>
            </article>
          )}
        </section>
      </main>

      <footer className="text-center p-6 text-sm text-gray-500">
        <p>
          &copy; {new Date().getFullYear()} Sessionize. Need more help? Email{' '}
          <a className="underline" href="mailto:lunafoxapp@gmail.com">
            lunafoxapp@gmail.com
          </a>
        </p>
      </footer>
    </div>
  );
};

export default HelpCenterPage;
