import { useState } from 'react';
import { RotateCcw, Search, LogOut, Lock, User, CheckCircle2, AlertTriangle, Clock, RefreshCw, CreditCard } from 'lucide-react';

interface KadastrAuth {
  accessToken: string;
  refreshToken: string;
  username: string;
}

interface KadastrOrder {
  id: number | string;
  orderNumber?: string;
  kadastrNumber?: string;
  serialNumber?: string;
  printStatus?: string;
  address?: string;
  objectType?: string;
  dxmName?: string;
  [key: string]: unknown;
}

interface PrintAttempt {
  id?: number | string;
  status?: string;
  createdDate?: string;
  createdAt?: string;
  message?: string;
  errorMessage?: string;
  cardUid?: string;
  [key: string]: unknown;
}

interface ControlResponse {
  order: KadastrOrder;
  attempts?: PrintAttempt[];
}

const STORAGE_KEY = 'kadastr_auth_v1';
const BASIC_AUTH = 'Basic c2VydmljZToxMjM0NTY3OA==';

function loadAuth(): KadastrAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.accessToken) return parsed as KadastrAuth;
  } catch {}
  return null;
}

function saveAuth(auth: KadastrAuth | null) {
  try {
    if (auth) localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

const statusLabels: Record<string, { label: string; cls: string }> = {
  IN_WAIT: { label: 'В очереди (IN_WAIT)', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  PRINTING: { label: 'Печатается (PRINTING)', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  ENCODED: { label: 'Закодирована (ENCODED)', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  PRINTED: { label: 'Распечатана (PRINTED)', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  ISSUED: { label: 'Выдана (ISSUED)', cls: 'bg-green-100 text-green-800 border-green-300' },
  ERROR: { label: 'Ошибка (ERROR)', cls: 'bg-red-50 text-red-700 border-red-200' },
  CANCELED: { label: 'Отменена (CANCELED)', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
};

export function ResetOrderPage() {
  const [auth, setAuth] = useState<KadastrAuth | null>(() => loadAuth());
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [orderQuery, setOrderQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [issuing, setIssuing] = useState(false);

  const [result, setResult] = useState<ControlResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  async function proxyRequest(
    method: 'GET' | 'POST' | 'PUT',
    endpoint: string,
    params: Record<string, string>,
    token?: string
  ) {
    const qs = new URLSearchParams({ endpoint, ...params }).toString();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      hl: 'ru',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      headers['Authorization'] = BASIC_AUTH;
    }

    const res = await fetch(`/api/kadastr?${qs}`, {
      method,
      headers,
      body: method === 'PUT' ? '{}' : undefined,
    });

    const text = await res.text();
    let json: Record<string, unknown> | null = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { status: res.status, ok: res.ok, data: json, raw: text };
  }

  async function refreshTokenIfNeeded(currentAuth: KadastrAuth): Promise<KadastrAuth | null> {
    if (!currentAuth.refreshToken) return null;
    const res = await proxyRequest('POST', '/api/v2/auth/oauth/token', {
      grant_type: 'refresh_token',
      refresh_token: currentAuth.refreshToken,
    });
    if (res.ok && res.data?.access_token) {
      const updated: KadastrAuth = {
        accessToken: String(res.data.access_token),
        refreshToken: String(res.data.refresh_token || currentAuth.refreshToken),
        username: currentAuth.username,
      };
      saveAuth(updated);
      setAuth(updated);
      return updated;
    }
    return null;
  }

  async function authedRequest(
    method: 'GET' | 'PUT',
    endpoint: string,
    params: Record<string, string>
  ) {
    if (!auth) throw new Error('Необходимо войти');
    let res = await proxyRequest(method, endpoint, params, auth.accessToken);
    if (res.status === 401) {
      const refreshed = await refreshTokenIfNeeded(auth);
      if (refreshed) {
        res = await proxyRequest(method, endpoint, params, refreshed.accessToken);
      } else {
        saveAuth(null);
        setAuth(null);
        throw new Error('Сессия истекла. Войдите заново.');
      }
    }
    return res;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setErrorMsg('');
    setSuccessMsg('');
    setLoginLoading(true);
    try {
      const res = await proxyRequest('POST', '/api/v2/auth/oauth/token', {
        username: username.trim(),
        password,
        grant_type: 'password',
      });
      if (res.ok && res.data?.access_token) {
        const nextAuth: KadastrAuth = {
          accessToken: String(res.data.access_token),
          refreshToken: String(res.data.refresh_token || ''),
          username: username.trim(),
        };
        saveAuth(nextAuth);
        setAuth(nextAuth);
        setPassword('');
      } else {
        const msg =
          (res.data?.message as string) ||
          (res.data?.error_description as string) ||
          (res.status === 400 || res.status === 401
            ? 'Неверный логин или пароль'
            : `Ошибка сервера (${res.status})`);
        setErrorMsg(msg);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Ошибка соединения');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    saveAuth(null);
    setAuth(null);
    setResult(null);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = orderQuery.trim();
    if (!q) return;
    setSearching(true);
    setErrorMsg('');
    setSuccessMsg('');
    setResult(null);
    try {
      const res = await authedRequest('GET', '/api/v2/print/control', { orderNumber: q });
      if (res.ok && res.data && (res.data as unknown as ControlResponse).order) {
        setResult(res.data as unknown as ControlResponse);
      } else {
        const msg = (res.data?.message as string) || `Заказ "${q}" не найден (${res.status})`;
        setErrorMsg(msg);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Ошибка поиска');
    } finally {
      setSearching(false);
    }
  };

  const handleReset = async () => {
    if (!result?.order?.id) return;
    if (!window.confirm(`Сбросить статус печати заказа №${result.order.orderNumber || result.order.id}?`)) {
      return;
    }
    setResetting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await authedRequest('PUT', `/api/v2/print/control/reset/${result.order.id}`, {
        comment: 'Reset by engineer',
      });
      if (res.ok) {
        const updatedOrder = (res.data as unknown as KadastrOrder) || result.order;
        setResult((prev) => (prev ? { ...prev, order: { ...prev.order, ...updatedOrder } } : prev));
        setSuccessMsg('Статус печати успешно сброшен! Оператор может печатать карту заново.');
      } else {
        setErrorMsg((res.data?.message as string) || `Ошибка сброса (${res.status})`);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Ошибка сброса');
    } finally {
      setResetting(false);
    }
  };

  const handleIssue = async () => {
    if (!result?.order?.orderNumber) return;
    if (!window.confirm(`Отметить заказ №${result.order.orderNumber} как выданный (ISSUED)?`)) {
      return;
    }
    setIssuing(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await authedRequest('PUT', `/api/v2/print/order/issue/${result.order.orderNumber}`, {
        comment: 'Issued by engineer',
      });
      if (res.ok) {
        const updatedOrder = (res.data as unknown as KadastrOrder) || result.order;
        setResult((prev) => (prev ? { ...prev, order: { ...prev.order, ...updatedOrder } } : prev));
        setSuccessMsg('Статус заказа обновлён на ISSUED (Выдана).');
      } else {
        setErrorMsg((res.data?.message as string) || `Ошибка (${res.status})`);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setIssuing(false);
    }
  };

  const order = result?.order;
  const attempts = result?.attempts || [];
  const statusMeta = order?.printStatus
    ? statusLabels[order.printStatus] || { label: order.printStatus, cls: 'bg-gray-100 text-gray-700 border-gray-200' }
    : null;

  return (
    <div className="flex-1 min-h-0 bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 shrink-0">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <RotateCcw size={20} className="text-blue-600 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-extrabold text-gray-900 leading-tight truncate">
                Сброс печати (Кадастр)
              </h2>
              {auth && (
                <p className="text-[11px] text-gray-400 truncate">Вход: {auth.username}</p>
              )}
            </div>
          </div>
          {auth && (
            <button
              onClick={handleLogout}
              className="px-2.5 py-1.5 bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-600 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
            >
              <LogOut size={13} /> Выйти
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 pb-24 md:pb-8 space-y-4">
          {!auth ? (
            /* Kadastr Login Card */
            <form
              onSubmit={handleLogin}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4"
            >
              <div>
                <h3 className="text-base font-bold text-gray-900">Вход в систему Кадастра</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Введите ваш логин и пароль от сайта <span className="font-mono">195.158.3.130:22666</span>
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Логин</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Логин инженера"
                      required
                      autoComplete="username"
                      className="w-full pl-10 pr-3.5 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Пароль</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Пароль"
                      required
                      autoComplete="current-password"
                      className="w-full pl-10 pr-3.5 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-700">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-50 active:scale-[0.98] transition-all shadow-sm cursor-pointer"
              >
                {loginLoading ? 'Подключение...' : 'Войти'}
              </button>
            </form>
          ) : (
            /* Order Search & Reset Workspace */
            <>
              <form
                onSubmit={handleSearch}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3"
              >
                <label className="block text-[11px] font-bold text-gray-500 uppercase">
                  Номер заказа (Order Number)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1 min-w-0">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      value={orderQuery}
                      onChange={(e) => setOrderQuery(e.target.value)}
                      placeholder="Введите номер заказа..."
                      className="w-full pl-10 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={searching || !orderQuery.trim()}
                    className="px-5 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-40 active:scale-95 transition-all shrink-0 cursor-pointer"
                  >
                    {searching ? '...' : 'Найти'}
                  </button>
                </div>
              </form>

              {errorMsg && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-xs text-red-700">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-800 font-medium">
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600" />
                  <span>{successMsg}</span>
                </div>
              )}

              {order && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs text-gray-400 font-medium">Заказ №</div>
                      <div className="text-lg font-extrabold text-gray-900 break-all">
                        {order.orderNumber || order.id}
                      </div>
                    </div>
                    {statusMeta && (
                      <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full border ${statusMeta.cls}`}>
                        {statusMeta.label}
                      </span>
                    )}
                  </div>

                  {/* Order details grid */}
                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-2 text-xs">
                    {order.kadastrNumber && (
                      <div className="flex justify-between gap-2">
                        <span className="text-gray-400">Кадастровый №:</span>
                        <span className="font-semibold text-gray-800 text-right break-all">{order.kadastrNumber}</span>
                      </div>
                    )}
                    {order.serialNumber && (
                      <div className="flex justify-between gap-2">
                        <span className="text-gray-400">Серийный №:</span>
                        <span className="font-semibold text-gray-800 text-right">{order.serialNumber}</span>
                      </div>
                    )}
                    {order.address && (
                      <div className="flex justify-between gap-2">
                        <span className="text-gray-400 shrink-0">Адрес:</span>
                        <span className="font-medium text-gray-700 text-right">{order.address}</span>
                      </div>
                    )}
                    {order.dxmName && (
                      <div className="flex justify-between gap-2">
                        <span className="text-gray-400 shrink-0">ОГУ / Филиал:</span>
                        <span className="font-medium text-gray-700 text-right">{order.dxmName}</span>
                      </div>
                    )}
                  </div>

                  {/* Primary Action Buttons */}
                  <div className="space-y-2 pt-1">
                    <button
                      onClick={handleReset}
                      disabled={resetting}
                      className="w-full min-h-[48px] py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold text-sm hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 active:scale-[0.98] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <RefreshCw size={17} className={resetting ? 'animate-spin' : ''} />
                      {resetting ? 'Сброс статуса...' : 'Сбросить статус печати'}
                    </button>

                    <button
                      onClick={handleIssue}
                      disabled={issuing}
                      className="w-full py-2.5 bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 text-gray-700 rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CreditCard size={14} />
                      {issuing ? 'Обновление...' : 'Отметить как выдана (ISSUED)'}
                    </button>
                  </div>

                  {/* Print Attempts History */}
                  {attempts.length > 0 && (
                    <div className="pt-2 border-t border-gray-100 space-y-2">
                      <div className="text-xs font-bold text-gray-600 flex items-center gap-1.5">
                        <Clock size={13} className="text-gray-400" />
                        Попытки печати ({attempts.length})
                      </div>
                      <div className="space-y-1.5">
                        {attempts.map((att, idx) => (
                          <div
                            key={att.id ?? idx}
                            className="p-2.5 bg-gray-50 rounded-xl border border-gray-100 text-[11px] space-y-1"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-gray-800">{att.status || `Попытка #${idx + 1}`}</span>
                              <span className="text-gray-400">{att.createdDate || att.createdAt || ''}</span>
                            </div>
                            {(att.message || att.errorMessage) && (
                              <p className="text-red-600">{att.message || att.errorMessage}</p>
                            )}
                            {att.cardUid && (
                              <p className="text-gray-500 font-mono text-[10px]">UID: {att.cardUid}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
