import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { usePoints, useCreatePoint, useUpdatePointStatus, useUpdatePoint, useDeletePoint } from '../../hooks/usePoints';
import { useAuthStore } from '../../stores/authStore';
import type { Point, PointStatus } from '../../types';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Locate, Pencil, Trash2, Navigation } from 'lucide-react';

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

  const openEditForm = (point: Point) => {
    setEditingPoint(point);
    setForm({
      name: point.name,
      lat: point.latitude.toFixed(6),
      lng: point.longitude.toFixed(6),
      address: point.address || '',
      notes: point.notes || '',
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
                    href={`yandexmaps://build_route?to=${point.latitude},${point.longitude}`}
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
                        onClick={() => updateStatus.mutate({ id: point.id, status: 'working' })}
                        className="flex-1 text-xs px-2 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors font-medium"
                      >
                        Работает
                      </button>
                      <button
                        onClick={() => updateStatus.mutate({ id: point.id, status: 'not_working' })}
                        className="flex-1 text-xs px-2 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors font-medium"
                      >
                        Не работает
                      </button>
                    </div>
                    <div className="flex gap-1.5 mt-2">
                      <button
                        onClick={() => openEditForm(point)}
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

                <button
                  onClick={() => navigate(`/points/${point.id}`)}
                  className="w-full mt-2 text-xs text-blue-600 py-1.5 hover:bg-blue-50 rounded-lg transition-colors font-medium"
                >
                  Подробнее →
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Legend */}
      <div className="absolute top-4 left-4 bg-white/95 backdrop-blur rounded-xl shadow-lg p-3 text-xs z-[1000] border border-gray-100">
        <div className="font-semibold text-gray-700 mb-2">Статус точек</div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500"></span><span className="text-gray-600">Работает</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500"></span><span className="text-gray-600">Не работает</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-gray-500"></span><span className="text-gray-600">Неизвестно</span></div>
        </div>
        <div className="mt-2 pt-2 border-t border-gray-100 text-gray-500">
          Всего: <strong>{points.length}</strong>
        </div>
      </div>

      {/* Location Button — uses navigator.geolocation directly */}
      <button
        onClick={handleLocate}
        className="absolute bottom-6 right-4 z-[1000] w-12 h-12 bg-white rounded-xl shadow-lg flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all border border-gray-200"
        title="Моё местоположение"
      >
        <Locate size={22} className={locating ? 'text-blue-600 animate-pulse' : 'text-gray-600'} />
      </button>

      {/* Add Point FAB */}
      {isWorker && (
        <button
          onClick={() => openAddForm()}
          className="absolute bottom-6 left-4 z-[1000] w-12 h-12 bg-blue-600 text-white rounded-xl shadow-lg flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all"
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
