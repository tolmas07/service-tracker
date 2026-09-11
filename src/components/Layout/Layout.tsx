import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { useDarkMode } from '../../hooks/useDarkMode';
import { Map, Route, ClipboardList, BarChart3, LogOut, Key, X, Sun, Moon } from 'lucide-react';
import { APP_VERSION } from '../../lib/constants';
import { Logo } from '../Logo';

const workerLinks = [
  { to: '/', icon: Map, label: 'Карта' },
  { to: '/trip', icon: Route, label: 'Поездка' },
  { to: '/history', icon: ClipboardList, label: 'История' },
];

const managerLinks = [
  { to: '/manager', icon: BarChart3, label: 'Обзор' },
  { to: '/', icon: Map, label: 'Карта' },
];

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 6) {
      setError('Пароль должен быть минимум 6 символов');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setError(error.message);
    } else {
      setSuccess('Пароль успешно изменён!');
      setTimeout(onClose, 1500);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-sm shadow-xl border border-zinc-100 dark:border-zinc-800 transition-colors">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Сменить пароль</h3>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
            <X size={20} className="text-zinc-400 dark:text-zinc-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">Новый пароль</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Минимум 6 символов"
              required
              minLength={6}
              className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">Подтвердите пароль</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Повторите пароль"
              required
              className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
            />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-3 py-2">
              <p className="text-red-600 dark:text-red-400 text-xs font-medium">{error}</p>
            </div>
          )}
          {success && (
            <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-xl px-3 py-2">
              <p className="text-green-700 dark:text-green-400 text-xs font-medium">{success}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Сохранение...' : 'Сохранить'}
          </button>
        </form>
      </div>
    </div>
  );
}

export function Header() {
  const { user, signOut } = useAuthStore();
  const [showMenu, setShowMenu] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const { isDark, toggle } = useDarkMode();

  return (
    <>
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 h-14 flex items-center justify-between shrink-0 z-50 transition-colors duration-200">
        <Link to="/" className="flex items-center no-underline">
          <Logo className="h-7 w-auto text-zinc-900 dark:text-white" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {user && (user.role === 'manager' ? managerLinks : workerLinks).map(({ to, icon: Icon, label }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3 relative">
          <button
            onClick={toggle}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {user && (
            <>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center gap-2 p-1 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-left"
              >
                <div className="w-8 h-8 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-semibold border border-blue-100 dark:border-blue-500/20">
                  {user.full_name?.charAt(0)?.toUpperCase()}
                </div>
                <div className="hidden sm:block mr-1">
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-tight">{user.full_name}</div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    {user.role === 'manager' ? 'Руководитель' : 'Специалист'}
                  </div>
                </div>
              </button>

              {/* Dropdown */}
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-[100]" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-800 py-1 w-52 z-[101] transition-colors">
                    <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{user.full_name}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{user.role === 'manager' ? 'Руководитель' : 'Специалист'}</p>
                    </div>
                    <button
                      onClick={() => { setShowMenu(false); setShowChangePassword(true); }}
                      className="w-full px-3 py-2.5 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2 transition-colors"
                    >
                      <Key size={16} className="text-zinc-400 dark:text-zinc-500" />
                      Сменить пароль
                    </button>
                    <button
                      onClick={() => { setShowMenu(false); signOut(); }}
                      className="w-full px-3 py-2.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2 transition-colors"
                    >
                      <LogOut size={16} />
                      Выйти
                    </button>
                    <div className="px-3 py-1.5 border-t border-zinc-100 dark:border-zinc-800">
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 text-center">Версия {APP_VERSION}</p>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </header>

      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
    </>
  );
}

export function BottomNav() {
  const location = useLocation();
  const { user } = useAuthStore();
  const isManager = user?.role === 'manager';
  const links = isManager ? managerLinks : workerLinks;

  return (
    <nav className="md:hidden bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex justify-around py-1.5 shrink-0 safe-bottom transition-colors duration-200">
      {links.map(({ to, icon: Icon, label }) => {
        const active = location.pathname === to;
        return (
          <Link
            key={to}
            to={to}
            className={`flex flex-col items-center text-[10px] px-3 py-1.5 rounded-lg transition-colors ${
              active ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
            }`}
          >
            <Icon size={22} strokeWidth={active ? 2.5 : 2} />
            <span className="mt-0.5 font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
