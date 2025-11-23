import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSupabaseClient } from '../lib/supabaseClient';
import { clearPersistedSession } from '../lib/sessionStorage';

const AccountSidebarIcon = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('Account');
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const supabase = getSupabaseClient();

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      
      const { data } = await supabase
        .from('users')
        .select('name')
        .eq('id', session.user.id)
        .maybeSingle();
        
      if (data?.name) {
        setName(data.name);
      }
    };
    loadProfile();
  }, [supabase]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearPersistedSession();
    navigate('/app/login');
  };

  return (
    <div className="relative mt-auto" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 transition-colors w-full text-left group"
      >
        <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold shadow-lg group-hover:scale-105 transition-transform">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{name}</p>
          <p className="text-xs text-slate-300 truncate">Manage & Support</p>
        </div>
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 w-full mb-2 bg-slate-900 border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
          <button
            onClick={() => navigate('/help')}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm text-slate-200 hover:bg-white/5 hover:text-white transition-colors text-left"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            Support Center
          </button>
          <div className="h-px bg-white/10 mx-2"></div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm text-rose-300 hover:bg-rose-500/10 hover:text-rose-200 transition-colors text-left"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
};

export default AccountSidebarIcon;
