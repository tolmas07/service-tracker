import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { Navigation, Eye, EyeOff, ArrowLeft } from 'lucide-react';

export function LoginPage() {
  const { signIn, user } = useAuthStore();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Redirect to home if already logged in
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await signIn(email, password);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    }
    // If success, the useEffect above will redirect
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess('Письмо для сброса пароля отправлено на ваш email. Проверьте почту.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/20">
            <Navigation size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ServiceTracker</h1>
          <p className="text-sm text-gray-500 mt-1">Учёт сервисных работ</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          {mode === 'login' ? (
            <>
              <h2 className="text-lg font-bold text-gray-900 mb-5">Вход в систему</h2>

              <form onSubmit={handleLogin} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Пароль</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Ваш пароль"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    <p className="text-red-600 text-xs">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm mt-2"
                >
                  {loading ? 'Загрузка...' : 'Войти'}
                </button>
              </form>

              <button
                onClick={() => { setMode('reset'); setError(''); setSuccess(''); }}
                className="w-full mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Забыли пароль?
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                className="flex items-center gap-1 text-sm text-blue-600 mb-4 hover:text-blue-700"
              >
                <ArrowLeft size={16} /> Назад к входу
              </button>

              <h2 className="text-lg font-bold text-gray-900 mb-2">Сброс пароля</h2>
              <p className="text-xs text-gray-500 mb-4">
                Введите email, указанный при регистрации. Мы отправим ссылку для сброса пароля.
              </p>

              <form onSubmit={handleReset} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {loading ? 'Отправка...' : 'Отправить ссылку'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
