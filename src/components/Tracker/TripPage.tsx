import { useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useGpsStore } from '../../stores/gpsStore';
import { useGPSTracker } from '../../hooks/useGPSTracker';
import { supabase } from '../../lib/supabase';
import { formatDistance, formatDuration, formatSpeed } from '../../lib/geo';
import { Play, Square, AlertTriangle, Smartphone, Shield, Zap } from 'lucide-react';

export function TripPage() {
  const {
    isTracking,
    currentTripId,
    positions,
    currentPosition,
    elapsedS,
    getStats,
    startTracking,
    stopTracking,
    reset,
  } = useGpsStore();

  useGPSTracker();
  const stats = getStats();

  // Warn before closing tab during tracking
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isTracking) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isTracking]);

  const handleStop = useCallback(async () => {
    stopTracking();
    if (currentTripId) {
      await supabase
        .from('trips')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString(),
          total_distance_m: stats.distanceM,
          total_duration_s: elapsedS,
          compensation_uzs: stats.compensationUzs,
        })
        .eq('id', currentTripId);
    }
  }, [stopTracking, currentTripId, stats, elapsedS]);

  const handleStart = useCallback(async () => {
    // Request native permissions if on Capacitor
    const isNative = !!(window as unknown as Record<string, unknown>).Capacitor;
    if (isNative) {
      try {
        const { Geolocation } = await import('@capacitor/geolocation');
        const perm = await Geolocation.requestPermissions();
        if (perm.location !== 'granted') {
          alert('Для работы трекера нужно разрешить геолокацию.');
          return;
        }
      } catch {}
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
      .from('trips')
      .insert({
        worker_id: session.user.id,
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (!error && data) {
      startTracking(data.id);
    }
  }, [startTracking]);

  // Wake lock
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;
    if (isTracking) {
      navigator.wakeLock?.request('screen').then((lock) => {
        wakeLock = lock;
      }).catch(() => {});
    }
    return () => { wakeLock?.release(); };
  }, [isTracking]);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-gray-50 overflow-hidden">
      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Live Stats */}
        {isTracking && (
          <div className="bg-white border-b border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse-gps"></span>
              <span className="text-sm font-medium text-green-700">GPS активен</span>
              <span className="text-xs text-gray-400 ml-auto">
                Точность: {currentPosition?.accuracy?.toFixed(0) ?? '—'}м · Точек: {positions.length}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-blue-50 rounded-xl">
                <div className="text-2xl font-bold text-blue-700">{formatDistance(stats.distanceM)}</div>
                <div className="text-[11px] text-blue-500 font-medium mt-0.5">Расстояние</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <div className="text-2xl font-bold text-gray-800">{formatDuration(elapsedS)}</div>
                <div className="text-[11px] text-gray-500 font-medium mt-0.5">Время</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-xl">
                <div className="text-2xl font-bold text-green-700">{stats.compensationUzs.toLocaleString()}</div>
                <div className="text-[11px] text-green-600 font-medium mt-0.5">Сум</div>
              </div>
            </div>
            {currentPosition && (
              <div className="mt-2 text-[11px] text-gray-400 text-center">
                {currentPosition.lat.toFixed(6)}, {currentPosition.lng.toFixed(6)} · {formatSpeed(currentPosition.speed)}
              </div>
            )}
          </div>
        )}

        {/* Completed trip summary */}
        {!isTracking && currentTripId && (
          <div className="flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center w-full max-w-sm border border-gray-100">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield size={28} className="text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">Поездка завершена</h3>
              <p className="text-sm text-gray-500 mb-6">Данные сохранены</p>
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="p-3 bg-blue-50 rounded-xl">
                  <div className="text-lg font-bold text-blue-700">{formatDistance(stats.distanceM)}</div>
                  <div className="text-[10px] text-blue-500">Путь</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <div className="text-lg font-bold text-gray-800">{formatDuration(elapsedS)}</div>
                  <div className="text-[10px] text-gray-500">Время</div>
                </div>
                <div className="p-3 bg-green-50 rounded-xl">
                  <div className="text-lg font-bold text-green-700">{stats.compensationUzs.toLocaleString()}</div>
                  <div className="text-[10px] text-green-600">Сум</div>
                </div>
              </div>
              <button
                onClick={() => reset()}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
              >
                Новая поездка
              </button>
            </div>
          </div>
        )}

        {/* Idle state info cards */}
        {!isTracking && !currentTripId && (
          <div className="p-4 space-y-3">
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                  <Zap size={18} className="text-blue-600" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">Как работает трекер</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    Нажмите <strong>СТАРТ</strong> и GPS начнёт записывать ваш маршрут.
                    Расстояние считается автоматически. Нажмите <strong>СТОП</strong> когда прибудете на место.
                    Компенсация: <strong>1000 сум за каждый км</strong>.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                  <AlertTriangle size={18} className="text-amber-600" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-amber-800">Важно: не закрывайте браузер!</h4>
                  <p className="text-xs text-amber-700 mt-1">
                    Если закрыть браузер во время трекинга, GPS остановится и пробег перестанет считаться.
                    Приложение покажет предупреждение при попытке закрыть вкладку.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                  <Smartphone size={18} className="text-green-600" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">Установка на телефон</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    <strong>Android (Chrome):</strong> Меню (⋮) → "Добавить на главный экран"<br />
                    <strong>iPhone (Safari):</strong> Кнопка "Поделиться" → "На экран Домой"<br />
                    Приложение будет работать как обычное приложение с иконкой на рабочем столе.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                  <Shield size={18} className="text-blue-600" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-blue-800">Совет для лучшего GPS</h4>
                  <p className="text-xs text-blue-700 mt-1">
                    Держите телефон у лобового стекла для лучшего сигнала GPS.
                    Не кладите в карман — сигнал может быть слабым.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Control Button — Fixed at bottom */}
      <div className="p-3 bg-white border-t border-gray-200 shrink-0 space-y-2 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        {!isTracking && (
          <Link
            to="/trips/new"
            className="block w-full py-2.5 border-2 border-blue-200 text-blue-600 rounded-xl text-center font-medium hover:bg-blue-50 transition-colors text-sm"
          >
            + Добавить пробег вручную
          </Link>
        )}
        {!isTracking ? (
          <button
            onClick={handleStart}
            className="w-full py-3.5 bg-green-600 text-white rounded-2xl text-lg font-bold flex items-center justify-center gap-3 hover:bg-green-700 active:scale-[0.98] transition-all shadow-lg shadow-green-600/20"
          >
            <Play size={22} fill="white" /> СТАРТ
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="w-full py-3.5 bg-red-600 text-white rounded-2xl text-lg font-bold flex items-center justify-center gap-3 hover:bg-red-700 active:scale-[0.98] transition-all shadow-lg shadow-red-600/20"
          >
            <Square size={22} fill="white" /> СТОП
          </button>
        )}
      </div>
    </div>
  );
}
