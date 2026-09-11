import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { usePoints, useCreatePoint, useUpdatePointStatus, useUpdatePoint, useDeletePoint } from '../../hooks/usePoints';
import { useAuthStore } from '../../stores/authStore';
import type { Point, PointStatus } from '../../types';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Locate, Pencil, Trash2, Navigation, Check, MapPin } from 'lucide-react';

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

function createIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="width:28px;height:28px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

const userIcon = L.divIcon({
  className: '',
  html: `<div style="width:20px;height:20px;background:#2563eb;border:3px solid white;border-radius:50%;box-shadow:0 0 0 8px rgba(37,99,235,0.2),0 2px 8px rgba(0,0,0,0.3)"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

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
function UserPositionMarker() {
  const [pos, setPos] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (p) => setPos([p.coords.latitude, p.coords.longitude]),
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  if (!pos) return null;
  return <Marker position={pos} icon={userIcon} />;
}

export function MapView() {
  const { data: points = [] } = usePoints();
  const createPoint = useCreatePoint();
  const updateStatus = useUpdatePointStatus();
  const updatePoint = useUpdatePoint();
  const deletePoint = useDeletePoint();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const isWorker = user?.role === 'worker';
  const userPointsCount = points.filter(p => p.worker_id === user?.id).length;

  const [showForm, setShowForm] = useState(false);
  const [editingPoint, setEditingPoint] = useState<Point | null>(null);
  const [form, setForm] = useState({ name: '', lat: '', lng: '', address: '', notes: '' });
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);

  // Geolocation — uses browser API directly, not Leaflet
  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Геолокация не поддерживается вашим браузером');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setFlyTo(coords);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        if (err.code === 1) {
          alert('Доступ к геолокации запрещён. Разрешите доступ в настройках браузера.');
        } else if (err.code === 2) {
          alert('Не удалось определить местоположение. Проверьте что GPS включён.');
        } else {
          alert('Не удалось определить местоположение. Попробуйте ещё раз.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
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
        <UserPositionMarker />
        <FlyTo position={flyTo} />

        {points.map((point) => (
          <Marker
            key={point.id}
            position={[point.latitude, point.longitude]}
            icon={createIcon(statusColors[point.status])}
          >
            <Popup maxWidth={280} minWidth={220}>
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

                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-gray-400">
                    {point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}
                  </span>
                </div>

                {/* Navigation buttons */}
                <div className="flex gap-1.5 mt-3">
                  <a
                    href={`https://yandex.ru/maps/?rtext=~${point.latitude},${point.longitude}&rtt=auto`}
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
                    <div className="flex gap-1.5 mt-3">
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
                        className="flex-1 text-xs px-2 py-1.5 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium flex items-center justify-center gap-1"
                      >
                        <Pencil size={12} /> Изменить
                      </button>
                      <button
                        onClick={() => handleDelete(point.id, point.name)}
                        className="text-xs px-2 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium flex items-center justify-center gap-1"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </>
                )}

                {!isWorker && (
                  <button
                    onClick={() => navigate(`/points/${point.id}`)}
                    className="w-full mt-2 text-xs text-blue-600 dark:text-blue-400 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-colors font-medium"
                  >
                    Подробнее →
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Top Statistics Card */}
      <div className="absolute top-4 left-4 right-4 sm:right-auto z-[1000] pointer-events-none flex justify-center sm:justify-start">
        <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md rounded-2xl shadow-xl p-4 pointer-events-auto w-full sm:w-72 border border-zinc-200/50 dark:border-zinc-800/50 transition-colors">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-blue-50 dark:bg-blue-500/10 p-2 rounded-xl text-blue-600 dark:text-blue-400">
              <MapPin size={18} />
            </div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Статистика точек</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-zinc-50 dark:bg-zinc-950 rounded-xl p-3 border border-zinc-100 dark:border-zinc-800/80 transition-colors">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-1 font-medium">Всего точек</div>
              <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                {points.length}
              </div>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-950 rounded-xl p-3 border border-zinc-100 dark:border-zinc-800/80 transition-colors">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-1 font-medium">Ваши точки</div>
              <div className="text-xl font-bold text-blue-600 dark:text-blue-400 tracking-tight">
                {userPointsCount}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Action Buttons */}
      <div className="absolute right-4 bottom-6 z-[1000] flex flex-col gap-3">
        <button
          onClick={handleLocate}
          className="w-12 h-12 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md rounded-2xl shadow-xl flex items-center justify-center hover:bg-white dark:hover:bg-zinc-900 active:scale-95 transition-all border border-zinc-200/50 dark:border-zinc-800/50"
          title="Моё местоположение"
        >
          <Locate size={20} className={locating ? 'text-blue-600 animate-pulse' : 'text-zinc-700 dark:text-zinc-300'} />
        </button>

        {isWorker && (
          <button
            onClick={() => openAddForm()}
            className="w-14 h-14 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl shadow-xl flex items-center justify-center hover:shadow-2xl active:scale-95 transition-all border border-blue-500/50"
            title="Добавить точку"
          >
            <Plus size={26} />
          </button>
        )}
      </div>

      {/* Add/Edit Point Modal */}
      {showForm && isWorker && (
        <div className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center z-[2000] p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-sm shadow-xl max-h-[90vh] overflow-y-auto border border-zinc-100 dark:border-zinc-800 transition-colors animate-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {editingPoint ? 'Редактировать' : 'Новая точка'}
              </h3>
              <button onClick={() => { setShowForm(false); setEditingPoint(null); }} className="w-8 h-8 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">Название *</label>
                <input
                  type="text"
                  placeholder="Например: Булунгурский район"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">Адрес</label>
                <input
                  type="text"
                  placeholder="ул. Навои, 15"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">Широта *</label>
                  <input
                    type="number"
                    placeholder="41.299500"
                    value={form.lat}
                    onChange={(e) => setForm({ ...form, lat: e.target.value })}
                    step="0.000001"
                    className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">Долгота *</label>
                  <input
                    type="number"
                    placeholder="69.240100"
                    value={form.lng}
                    onChange={(e) => setForm({ ...form, lng: e.target.value })}
                    step="0.000001"
                    className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">Заметки</label>
                <input
                  type="text"
                  placeholder="Доп. информация"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>
            
            <button
              onClick={handleSave}
              disabled={!form.name || !form.lat || !form.lng}
              className="w-full mt-6 py-3 bg-blue-600 text-white rounded-xl font-medium text-sm shadow-sm hover:shadow hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            >
              {editingPoint ? 'Сохранить изменения' : 'Создать точку'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
