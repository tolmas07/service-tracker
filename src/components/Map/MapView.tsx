import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { usePoints, useCreatePoint, useUpdatePointStatus, useUpdatePoint, useDeletePoint } from '../../hooks/usePoints';
import { usePrintSummary30d, useLastVisitsByPoint, getVisitAgeInfo } from '../../hooks/usePrintStats';
import { useAuthStore } from '../../stores/authStore';
import type { Point, PointStatus } from '../../types';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Locate, Pencil, Trash2, Navigation, Check, ClipboardList, Route as RouteIcon, Clock, Sparkles, Printer } from 'lucide-react';

// Fix Leaflet default icon
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const statusColors: Record<PointStatus, string> = {
  working: '#16a34a',
  not_working: '#dc2626',
  unknown: '#6b7280',
};

const statusLabels: Record<PointStatus, string> = {
  working: 'Работает',
  not_working: 'Не работает',
  unknown: 'Неизвестно',
};

// Icon cache to avoid recreating Leaflet DivIcons on every render
const iconCache = new Map<string, L.DivIcon>();

function getPointIcon(color: string, isOverdue: boolean, routeOrder: number | null) {
  const key = `${color}_${isOverdue ? '1' : '0'}_${routeOrder ?? 'n'}`;
  const cached = iconCache.get(key);
  if (cached) return cached;

  let html: string;
  if (routeOrder !== null) {
    html = `<div style="width:32px;height:32px;background:#2563eb;color:#fff;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;border:3px solid white;border-radius:50%;box-shadow:0 3px 10px rgba(37,99,235,0.5)">${routeOrder}</div>`;
  } else {
    const ring = isOverdue ? 'box-shadow:0 0 0 3px #f59e0b,0 2px 8px rgba(0,0,0,0.3)' : 'box-shadow:0 2px 8px rgba(0,0,0,0.3)';
    html = `<div style="width:28px;height:28px;background:${color};border:3px solid white;border-radius:50%;${ring}"></div>`;
  }

  const icon = L.divIcon({
    className: '',
    html,
    iconSize: routeOrder !== null ? [32, 32] : [28, 28],
    iconAnchor: routeOrder !== null ? [16, 16] : [14, 14],
    popupAnchor: [0, -16],
  });
  iconCache.set(key, icon);
  return icon;
}

const userIcon = L.divIcon({
  className: '',
  html: `<div style="width:20px;height:20px;background:#2563eb;border:3px solid white;border-radius:50%;box-shadow:0 0 0 8px rgba(37,99,235,0.2),0 2px 8px rgba(0,0,0,0.3)"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Component to fly map to a position
function FlyTo({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, 15, { duration: 1 });
    }
  }, [position, map]);
  return null;
}

// Blue dot on map
function UserPositionMarker({ onPosition }: { onPosition: (pos: [number, number]) => void }) {
  const [pos, setPos] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (p) => {
        const coords: [number, number] = [p.coords.latitude, p.coords.longitude];
        setPos(coords);
        onPosition(coords);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [onPosition]);

  if (!pos) return null;
  return <Marker position={pos} icon={userIcon} />;
}

type MapFilter = 'all' | 'not_working' | 'overdue';

export function MapView() {
  const { data: points = [] } = usePoints();
  const { data: printSummary = {} } = usePrintSummary30d();
  const { data: lastVisits = {} } = useLastVisitsByPoint();
  const createPoint = useCreatePoint();
  const updateStatus = useUpdatePointStatus();
  const updatePoint = useUpdatePoint();
  const deletePoint = useDeletePoint();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const isWorker = user?.role === 'worker';

  const [showForm, setShowForm] = useState(false);
  const [editingPoint, setEditingPoint] = useState<Point | null>(null);
  const [form, setForm] = useState({ name: '', lat: '', lng: '', address: '', notes: '' });
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const userPosRef = useRef<[number, number] | null>(null);
  const [filter, setFilter] = useState<MapFilter>('all');

  // Route builder state
  const [routeMode, setRouteMode] = useState(false);
  const [routeIds, setRouteIds] = useState<string[]>([]);

  const handleUserPos = useCallback((coords: [number, number]) => {
    userPosRef.current = coords;
  }, []);

  const counts = useMemo(() => {
    let working = 0;
    let notWorking = 0;
    let unknown = 0;
    let overdue = 0;
    for (const p of points) {
      if (p.status === 'working') working++;
      else if (p.status === 'not_working') notWorking++;
      else unknown++;
      if (getVisitAgeInfo(lastVisits[p.id]).isOverdue) overdue++;
    }
    return { working, notWorking, unknown, overdue };
  }, [points, lastVisits]);

  const visiblePoints = useMemo(() => {
    if (filter === 'not_working') return points.filter((p) => p.status === 'not_working');
    if (filter === 'overdue') return points.filter((p) => getVisitAgeInfo(lastVisits[p.id]).isOverdue);
    return points;
  }, [points, filter, lastVisits]);

  const toggleRoutePoint = useCallback((pointId: string) => {
    setRouteIds((prev) =>
      prev.includes(pointId) ? prev.filter((id) => id !== pointId) : [...prev, pointId]
    );
  }, []);

  const optimizeRouteOrder = useCallback(() => {
    if (routeIds.length < 2) return;
    const byId = new Map(points.map((p) => [p.id, p]));
    const remaining = routeIds.map((id) => byId.get(id)).filter((p): p is Point => !!p);
    if (remaining.length < 2) return;

    const ordered: Point[] = [];
    const currentPos = userPosRef.current;
    let curLat = currentPos ? currentPos[0] : remaining[0].latitude;
    let curLng = currentPos ? currentPos[1] : remaining[0].longitude;

    if (!currentPos) {
      ordered.push(remaining.shift()!);
    }

    while (remaining.length > 0) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d = haversineKm(curLat, curLng, remaining[i].latitude, remaining[i].longitude);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      const next = remaining.splice(bestIdx, 1)[0];
      ordered.push(next);
      curLat = next.latitude;
      curLng = next.longitude;
    }

    setRouteIds(ordered.map((p) => p.id));
  }, [routeIds, points]);

  const openYandexRoute = useCallback(() => {
    const byId = new Map(points.map((p) => [p.id, p]));
    const stops = routeIds
      .map((id) => byId.get(id))
      .filter((p): p is Point => !!p)
      .map((p) => `${p.latitude},${p.longitude}`);

    if (stops.length === 0) return;

    const currentPos = userPosRef.current;
    const rtext = currentPos
      ? `${currentPos[0]},${currentPos[1]}~${stops.join('~')}`
      : stops.length === 1
      ? `~${stops[0]}`
      : stops.join('~');

    window.open(`https://yandex.uz/maps/?rtext=${rtext}&rtt=auto`, '_blank', 'noopener,noreferrer');
  }, [routeIds, points]);

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Геолокация не поддерживается вашим браузером');
      return;
    }

    // 1. Instant fly if live GPS position is already cached (0ms delay!)
    if (userPosRef.current) {
      setFlyTo([userPosRef.current[0], userPosRef.current[1]]);
      // Silently refresh high-accuracy position in background
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          userPosRef.current = coords;
        },
        () => {},
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 }
      );
      return;
    }

    // 2. Fast initial fix (Wi-Fi/Cell/cached GPS in <1s), then refine
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        userPosRef.current = coords;
        setFlyTo(coords);
        setLocating(false);
      },
      () => {
        // Fallback to high accuracy if fast fix failed
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
            userPosRef.current = coords;
            setFlyTo(coords);
            setLocating(false);
          },
          (err) => {
            setLocating(false);
            if (err.code === 1) {
              alert('Доступ к геолокации запрещён. Разрешите доступ в настройках браузера.');
            } else {
              alert('Не удалось определить местоположение. Проверьте что GPS включён.');
            }
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
        );
      },
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 60000 }
    );
  }, []);

  const openAddForm = (lat?: number, lng?: number) => {
    setEditingPoint(null);
    setForm({
      name: '',
      lat: lat ? lat.toFixed(6) : '',
      lng: lng ? lng.toFixed(6) : '',
      address: '',
      notes: '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.lat || !form.lng) return;

    if (editingPoint) {
      await updatePoint.mutateAsync({
        id: editingPoint.id,
        name: form.name,
        latitude: parseFloat(form.lat),
        longitude: parseFloat(form.lng),
        address: form.address || undefined,
        notes: form.notes || undefined,
      });
    } else {
      if (!user) return;
      await createPoint.mutateAsync({
        name: form.name,
        latitude: parseFloat(form.lat),
        longitude: parseFloat(form.lng),
        address: form.address || undefined,
        notes: form.notes || undefined,
        status: 'unknown',
        worker_id: user.id,
      });
    }
    setShowForm(false);
    setEditingPoint(null);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Удалить точку "${name}"? Все связанные посещения тоже будут удалены.`)) return;
    try {
      await deletePoint.mutateAsync(id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Не удалось удалить: ${msg}`);
    }
  };

  const center: [number, number] = [41.2995, 69.2401];

  return (
    <div className="flex-1 relative">
      <MapContainer
        center={center}
        zoom={6}
        className="h-full w-full"
        zoomControl={false}
        attributionControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <UserPositionMarker onPosition={handleUserPos} />
        <FlyTo position={flyTo} />

        {visiblePoints.map((point) => {
          const visitInfo = getVisitAgeInfo(lastVisits[point.id]);
          const printInfo = printSummary[point.id];
          const routeIdx = routeIds.indexOf(point.id);
          const routeOrder = routeIdx >= 0 ? routeIdx + 1 : null;

          return (
            <Marker
              key={point.id}
              position={[point.latitude, point.longitude]}
              icon={getPointIcon(statusColors[point.status], visitInfo.isOverdue, routeOrder)}
              eventHandlers={
                routeMode
                  ? {
                      click: () => toggleRoutePoint(point.id),
                    }
                  : undefined
              }
            >
              {!routeMode && (
                <Popup maxWidth={290} minWidth={230}>
                  <div className="p-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm text-gray-900 leading-tight">{point.name}</h3>
                        {point.address && <p className="text-xs text-gray-500 mt-0.5 break-words">{point.address}</p>}
                      </div>
                      <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        point.status === 'working' ? 'bg-green-100 text-green-700' :
                        point.status === 'not_working' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {statusLabels[point.status]}
                      </span>
                    </div>

                    {point.notes && (
                      <p className="text-[11px] text-gray-500 mt-1.5">{point.notes}</p>
                    )}

                    {/* Last visit reminder (2-month cycle) */}
                    <div className={`mt-2 px-2 py-1.5 rounded-lg text-[11px] flex items-center justify-between gap-2 ${
                      visitInfo.isOverdue
                        ? 'bg-amber-50 text-amber-800 border border-amber-200/80'
                        : 'bg-gray-50 text-gray-600 border border-gray-100'
                    }`}>
                      <span className="flex items-center gap-1 font-medium">
                        <Clock size={12} className={visitInfo.isOverdue ? 'text-amber-600' : 'text-gray-400'} />
                        Посл. визит:
                      </span>
                      <span className="font-semibold">
                        {visitInfo.isOverdue ? `⚠️ ${visitInfo.label}` : visitInfo.label}
                      </span>
                    </div>

                    {/* Телеметрия принтера, расходников и печати */}
                    {(point.ribbon_level != null || point.film_level != null || point.last_seen || printInfo) && (
                      <div className="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-100 text-[11px] space-y-1.5">
                        <div className="flex items-center justify-between font-medium text-gray-700">
                          <div className="flex flex-col">
                            <span>Принтер {point.printer_model ? point.printer_model.split('[')[0].trim() : 'XID8300'}</span>
                            {point.printer_model && point.printer_model.includes('[') && (
                              <span className={`text-[10px] font-semibold ${
                                point.printer_model.includes('Готов') ? 'text-emerald-600' :
                                point.printer_model.includes('греется') ? 'text-amber-600' :
                                point.printer_model.includes('карту') ? 'text-blue-600' : 'text-red-600'
                              }`}>
                                ● {point.printer_model.substring(point.printer_model.indexOf('[') + 1, point.printer_model.indexOf(']'))}
                              </span>
                            )}
                          </div>
                          {(() => {
                            if (!point.last_seen) return null;
                            const diffSec = Math.round((Date.now() - new Date(point.last_seen).getTime()) / 1000);
                            const isOnline = diffSec <= 150;
                            const timeStr = new Date(point.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            const dateStr = new Date(point.last_seen).toLocaleDateString([], { day: '2-digit', month: '2-digit' });

                            return (
                              <span
                                className={`text-[10px] font-semibold flex items-center gap-1 ${
                                  isOnline ? 'text-emerald-600' : 'text-gray-400'
                                }`}
                                title={`Последний сигнал: ${dateStr} ${timeStr}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                                {isOnline
                                  ? 'В сети'
                                  : diffSec < 3600
                                  ? `${Math.round(diffSec / 60)} мин назад`
                                  : `${dateStr} ${timeStr}`}
                              </span>
                            );
                          })()}
                        </div>

                        {point.ribbon_level != null && (
                          <div>
                            <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                              <span>Цветная лента</span>
                              <span className="font-semibold text-gray-800">{point.ribbon_level}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full ${point.ribbon_level <= 15 ? 'bg-red-500' : point.ribbon_level <= 30 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                style={{ width: `${Math.min(100, Math.max(0, point.ribbon_level))}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {point.film_level != null && (
                          <div>
                            <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                              <span>Ретрансферная пленка</span>
                              <span className="font-semibold text-gray-800">{point.film_level}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full ${point.film_level <= 15 ? 'bg-red-500' : point.film_level <= 30 ? 'bg-amber-500' : 'bg-blue-500'}`}
                                style={{ width: `${Math.min(100, Math.max(0, point.film_level))}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {printInfo && (
                          <div className="pt-1 border-t border-gray-200/70 flex items-center justify-between text-[10px] text-gray-600">
                            <span className="flex items-center gap-1">
                              <Printer size={11} className="text-blue-500" /> За 30 дн.:
                            </span>
                            <span className="font-semibold text-gray-900">
                              {printInfo.last30d} карт{printInfo.today > 0 ? ` (сегодня: ${printInfo.today})` : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Navigation buttons */}
                    <div className="flex gap-1.5 mt-2.5">
                      <a
                        href={`https://yandex.uz/maps/?rtext=~${point.latitude},${point.longitude}&rtt=auto`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-xs px-2 py-2 bg-yellow-50 text-yellow-800 rounded-lg hover:bg-yellow-100 transition-colors font-medium flex items-center justify-center gap-1.5"
                      >
                        <Navigation size={14} /> Яндекс
                      </a>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${point.latitude},${point.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-xs px-2 py-2 bg-green-50 text-green-800 rounded-lg hover:bg-green-100 transition-colors font-medium flex items-center justify-center gap-1.5"
                      >
                        <Navigation size={14} /> Google
                      </a>
                    </div>

                    {isWorker && (
                      <>
                        <div className="flex gap-1.5 mt-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              updateStatus.mutate({ id: point.id, status: 'working' });
                            }}
                            disabled={updateStatus.isPending}
                            className={`flex-1 text-xs px-2 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1 cursor-pointer ${
                              point.status === 'working'
                                ? 'bg-green-600 text-white shadow-sm ring-2 ring-green-600 ring-offset-1 font-semibold'
                                : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                            }`}
                          >
                            {point.status === 'working' && <Check size={12} strokeWidth={3} />}
                            Работает
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              updateStatus.mutate({ id: point.id, status: 'not_working' });
                            }}
                            disabled={updateStatus.isPending}
                            className={`flex-1 text-xs px-2 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1 cursor-pointer ${
                              point.status === 'not_working'
                                ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-600 ring-offset-1 font-semibold'
                                : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                            }`}
                          >
                            {point.status === 'not_working' && <Check size={12} strokeWidth={3} />}
                            Не работает
                          </button>
                        </div>
                        <div className="flex gap-1.5 mt-2">
                          <button
                            onClick={() => navigate(`/points/${point.id}`)}
                            className="flex-1 text-xs px-2 py-1.5 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Pencil size={12} /> Подробнее
                          </button>
                          <button
                            onClick={() => handleDelete(point.id, point.name)}
                            className="text-xs px-2 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </>
                    )}

                    {!isWorker && (
                      <div className="flex gap-1.5 mt-2">
                        <button
                          onClick={() => navigate(`/points/${point.id}`)}
                          className="flex-1 text-xs text-blue-600 py-1.5 bg-blue-50/50 hover:bg-blue-50 rounded-lg transition-colors font-medium cursor-pointer"
                        >
                          Детали
                        </button>
                        <button
                          onClick={() => navigate(`/manager/visits?pointName=${encodeURIComponent(point.name)}`)}
                          className="flex-1 text-xs text-purple-600 py-1.5 bg-purple-50/50 hover:bg-purple-50 rounded-lg transition-colors font-medium flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <ClipboardList size={12} /> Отчеты
                        </button>
                      </div>
                    )}
                  </div>
                </Popup>
              )}
            </Marker>
          );
        })}
      </MapContainer>

      {/* Legend + Quick Filters (z-[500] so open Leaflet popups z-700 float cleanly above it) */}
      <div className="absolute top-4 left-4 bg-white/95 backdrop-blur rounded-xl shadow-lg p-3 text-xs z-[500] border border-gray-100 min-w-[165px]">
        <div className="font-semibold text-gray-700 mb-2">Статус точек</div>
        <div className="space-y-1">
          <button
            onClick={() => setFilter('all')}
            className={`w-full flex items-center justify-between gap-3 px-1.5 py-1 rounded-lg transition-colors cursor-pointer ${
              filter === 'all' ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-gray-50 text-gray-600'
            }`}
          >
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-green-500"></span><span>Работает</span></div>
            <strong className="text-green-600">{counts.working}</strong>
          </button>
          <button
            onClick={() => setFilter(filter === 'not_working' ? 'all' : 'not_working')}
            className={`w-full flex items-center justify-between gap-3 px-1.5 py-1 rounded-lg transition-colors cursor-pointer ${
              filter === 'not_working' ? 'bg-red-50 text-red-700 font-semibold' : 'hover:bg-gray-50 text-gray-600'
            }`}
          >
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span><span>Не работает</span></div>
            <strong className="text-red-600">{counts.notWorking}</strong>
          </button>
          <button
            onClick={() => setFilter(filter === 'overdue' ? 'all' : 'overdue')}
            className={`w-full flex items-center justify-between gap-3 px-1.5 py-1 rounded-lg transition-colors cursor-pointer ${
              filter === 'overdue' ? 'bg-amber-50 text-amber-800 font-semibold' : 'hover:bg-gray-50 text-gray-600'
            }`}
            title="Точки без посещения более 60 дней (2 месяца)"
          >
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-amber-200"></span><span>&gt;60 дн.</span></div>
            <strong className="text-amber-600">{counts.overdue}</strong>
          </button>
        </div>
        <div className="mt-2 pt-1.5 border-t border-gray-100 text-gray-500 flex justify-between px-1">
          <span>Всего:</span>
          <strong>{points.length}</strong>
        </div>
      </div>

      {/* Route Mode Toggle Button */}
      <button
        onClick={() => {
          setRouteMode((prev) => {
            if (prev) setRouteIds([]);
            return !prev;
          });
        }}
        className={`absolute top-4 right-4 z-[1000] px-3.5 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
          routeMode
            ? 'bg-blue-600 text-white border-blue-700'
            : 'bg-white/95 text-gray-700 border-gray-200 hover:bg-gray-50'
        }`}
        title="Выбрать несколько точек для маршрута в Яндекс Картах"
      >
        <RouteIcon size={16} />
        {routeMode ? 'Отмена маршрута' : 'Маршрут'}
      </button>

      {/* Route Builder Bottom Bar */}
      {routeMode && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1001] w-[calc(100%-2rem)] max-w-md bg-white rounded-2xl shadow-2xl border border-blue-100 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-gray-900">
                Режим маршрута {routeIds.length > 0 ? `(${routeIds.length} точек)` : ''}
              </div>
              <div className="text-[11px] text-gray-500">
                Нажимайте на маркеры на карте, чтобы добавить в маршрут
              </div>
            </div>
            {routeIds.length > 0 && (
              <button
                onClick={() => setRouteIds([])}
                className="text-[11px] text-gray-400 hover:text-red-500 px-2 py-1 cursor-pointer"
              >
                Очистить
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {routeIds.length >= 2 && (
              <button
                onClick={optimizeRouteOrder}
                className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-semibold hover:bg-indigo-100 flex items-center gap-1 cursor-pointer"
                title="Упорядочить точки по кратчайшему пути"
              >
                <Sparkles size={14} /> Оптимизировать
              </button>
            )}
            <button
              onClick={openYandexRoute}
              disabled={routeIds.length === 0}
              className="flex-1 py-2 px-3 bg-yellow-400 text-gray-900 rounded-xl text-xs font-bold hover:bg-yellow-500 disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Navigation size={14} /> Открыть в Яндекс Картах
            </button>
          </div>
        </div>
      )}

      {/* Location Button */}
      {!routeMode && (
        <button
          onClick={handleLocate}
          className="absolute bottom-6 right-4 z-[1000] w-12 h-12 bg-white rounded-xl shadow-lg flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all border border-gray-200 cursor-pointer"
          title="Моё местоположение"
        >
          <Locate size={22} className={locating ? 'text-blue-600 animate-pulse' : 'text-gray-600'} />
        </button>
      )}

      {/* Add Point FAB */}
      {isWorker && !routeMode && (
        <button
          onClick={() => openAddForm()}
          className="absolute bottom-6 left-4 z-[1000] w-12 h-12 bg-blue-600 text-white rounded-xl shadow-lg flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all cursor-pointer"
          title="Добавить точку"
        >
          <Plus size={24} />
        </button>
      )}

      {/* Add/Edit Point Modal */}
      {showForm && isWorker && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1001] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                {editingPoint ? 'Редактировать точку' : 'Новая точка'}
              </h3>
              <button onClick={() => { setShowForm(false); setEditingPoint(null); }} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Название *</label>
                <input
                  type="text"
                  placeholder="Например: Булунгурский район"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Адрес</label>
                <input
                  type="text"
                  placeholder="ул. Навои, 15"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Широта *</label>
                  <input
                    type="number"
                    placeholder="41.299500"
                    value={form.lat}
                    onChange={(e) => setForm({ ...form, lat: e.target.value })}
                    step="0.000001"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Долгота *</label>
                  <input
                    type="number"
                    placeholder="69.240100"
                    value={form.lng}
                    onChange={(e) => setForm({ ...form, lng: e.target.value })}
                    step="0.000001"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Заметки</label>
                <input
                  type="text"
                  placeholder="Тел: 99 123 45 67"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setShowForm(false); setEditingPoint(null); }}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={handleSave}
                disabled={!form.name || !form.lat || !form.lng}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {editingPoint ? 'Сохранить' : 'Добавить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
