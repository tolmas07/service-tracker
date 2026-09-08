import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { Map, Route, ClipboardList, BarChart3, LogOut, Navigation, Key, X } from 'lucide-react';

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
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Сменить пароль</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Новый пароль</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Минимум 6 символов"
              required
              minLength={6}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Подтвердите пароль</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Повторите пароль"
              required
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <p className="text-red-600 text-xs">{error}</p>
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2">
              <p className="text-green-700 text-xs">{success}</p>
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

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-4 h-14 flex items-center justify-between shrink-0 z-50 shadow-sm">
        <Link to="/" className="flex items-center gap-2.5 no-underline">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Navigation size={18} className="text-white" />
          </div>
          <span className="text-lg font-bold text-gray-900 hidden sm:block">ServiceTracker</span>
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
                  active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User menu */}
        <div className="flex items-center gap-2 relative">
          {user && (
            <>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-bold">
                  {user.full_name?.charAt(0)?.toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-medium text-gray-900 leading-tight">{user.full_name}</div>
                  <div className="text-[10px] text-gray-500">
                    {user.role === 'manager' ? 'Руководитель' : 'Специалист'}
                  </div>
                </div>
              </button>

              {/* Dropdown */}
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-[100]" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-200 py-1 w-52 z-[101]">
                    <div className="px-3 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900 truncate">{user.full_name}</p>
                      <p className="text-xs text-gray-500 truncate">{user.role === 'manager' ? 'Руководитель' : 'Специалист'}</p>
                    </div>
                    <button
                      onClick={() => { setShowMenu(false); setShowChangePassword(true); }}
                      className="w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                    >
                      <Key size={16} className="text-gray-400" />
                      Сменить пароль
                    </button>
                    <button
                      onClick={() => { setShowMenu(false); signOut(); }}
                      className="w-full px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                    >
                      <LogOut size={16} />
                      Выйти
                    </button>
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
    <nav className="md:hidden bg-white border-t border-gray-200 flex justify-around py-1.5 shrink-0 safe-bottom">
      {links.map(({ to, icon: Icon, label }) => {
        const active = location.pathname === to;
        return (
          <Link
            key={to}
            to={to}
            className={`flex flex-col items-center text-[10px] px-3 py-1.5 rounded-lg transition-colors ${
              active ? 'text-blue-600' : 'text-gray-400'
            }`}
          >
            <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
            <span className="mt-0.5 font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
