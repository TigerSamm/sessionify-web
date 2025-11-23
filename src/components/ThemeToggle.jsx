import { useTheme } from './ThemeProvider.jsx';

const ThemeToggle = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`btn btn-ghost hidden sm:inline-flex ${className}`.trim()}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
    </button>
  );
};

export default ThemeToggle;
