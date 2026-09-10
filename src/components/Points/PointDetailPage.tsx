import { useParams, Link, useNavigate } from 'react-router-dom';
import { usePoint, useDeletePoint, useUpdatePoint } from '../../hooks/usePoints';
import { useVisits, useVisitPhotos } from '../../hooks/useVisits';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { MapPin, ArrowLeft, Wrench, Trash2, Pencil, X, Check } from 'lucide-react';
import { useState, useEffect } from 'react';

function VisitPhotos({ visitId }: { visitId: string }) {
  const { data: photos = [] } = useVisitPhotos(visitId);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadUrls = async () => {
      const entries: Record<string, string> = {};
      for (const photo of photos) {
        const { data } = supabase.storage.from('photos').getPublicUrl(photo.storage_path);
        entries[photo.id] = data.publicUrl;
      }
      setUrls(entries);
    };
    loadUrls();
  }, [photos]);

  if (photos.length === 0) return null;

  return (
    <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
      {photos.map((photo) => (
        <img
          key={photo.id}
          src={urls[photo.id]}
          alt={photo.caption || ''}
          className="w-20 h-20 object-cover rounded-xl border border-gray-200 flex-shrink-0"
        />
      ))}
    </div>
  );
}

// Edit modal
function EditPointModal({ point, onClose }: { point: { name: string; address?: string; latitude: number; longitude: number; notes?: string }; onClose: () => void }) {
  const updatePoint = useUpdatePoint();
  const { id } = useParams<{ id: string }>();
  const [form, setForm] = useState({
    name: point.name,
    address: point.address || '',
    lat: point.latitude.toFixed(6),
    lng: point.longitude.toFixed(6),
    notes: point.notes || '',
  });

  const handleSave = async () => {
    if (!id || !form.name || !form.lat || !form.lng) return;
    await updatePoint.mutateAsync({
      id,
      name: form.name,
      address: form.address || undefined,
      latitude: parseFloat(form.lat),
      longitude: parseFloat(form.lng),
      notes: form.notes || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1001] p-4">
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Редактировать</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X size={20} className="text-gray-400" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Название</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Адрес</label>
            <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Широта</label>
              <input type="number" value={form.lat} onChange={e => setForm({ ...form, lat: e.target.value })}
                step="0.000001" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Долгота</label>
              <input type="number" value={form.lng} onChange={e => setForm({ ...form, lng: e.target.value })}
                step="0.000001" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Заметки</label>
            <input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">Отмена</button>
          <button onClick={handleSave} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-1.5">
            <Check size={14} /> Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

export function PointDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: point, isLoading: pointLoading } = usePoint(id!);
  const { data: visits = [], isLoading: visitsLoading } = useVisits(id);
  const deletePoint = useDeletePoint();
  const { user } = useAuthStore();
  const isWorker = user?.role === 'worker';

  const [showEditModal, setShowEditModal] = useState(false);

  const handleDelete = async () => {
    if (!point) return;
    if (!confirm(`Удалить точку "${point.name}"? Все связанные посещения тоже будут удалены.`)) return;
    try {
      await deletePoint.mutateAsync(point.id);
      navigate('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Не удалось удалить: ${msg}`);
    }
  };

  if (pointLoading) {
    return <div className="flex-1 flex items-center justify-center text-gray-400">Загрузка...</div>;
  }

  if (!point) {
    return <div className="flex-1 flex items-center justify-center text-gray-400">Точка не найдена</div>;
  }

  return (
    <div className="flex-1 min-h-0 bg-gray-50 flex flex-col overflow-hidden">
      {/* Header — always shows info, never changes */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 shrink-0">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-blue-600 mb-2 hover:text-blue-700">
          <ArrowLeft size={16} /> Назад
        </button>
        <h2 className="text-xl font-bold text-gray-900">{point.name}</h2>
        {point.address && <p className="text-sm text-gray-500 mt-0.5">{point.address}</p>}
        {point.notes && <p className="text-xs text-gray-400 mt-1">{point.notes}</p>}
        <div className="flex items-center gap-2 mt-2">
          <MapPin size={12} className="text-gray-400" />
          <span className="text-xs text-gray-400">{point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="p-4 shrink-0 space-y-2">
        <Link
          to={`/visits/new?point=${point.id}`}
          className="block py-3 bg-blue-600 text-white rounded-xl text-center font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          + Новый отчёт
        </Link>

        {isWorker && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowEditModal(true)}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5"
            >
              <Pencil size={14} /> Изменить
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2.5 rounded-xl text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5"
            >
              <Trash2 size={14} /> Удалить
            </button>
          </div>
        )}
      </div>

      {/* Visit History */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        <h3 className="font-bold text-sm text-gray-700 mb-3">История посещений</h3>
        {visitsLoading ? (
          <p className="text-gray-400 text-sm text-center py-8">Загрузка...</p>
        ) : visits.length === 0 ? (
          <div className="text-center py-8">
            <Wrench size={32} className="mx-auto mb-2 text-gray-300" />
            <p className="text-gray-400 text-sm">Нет посещений</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visits.map((visit) => (
              <div key={visit.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">{visit.work_type}</span>
                  <span className="text-[11px] text-gray-400">
                    {format(new Date(visit.visited_at), 'dd MMM yyyy, HH:mm', { locale: ru })}
                  </span>
                </div>
                {visit.work_description && <p className="text-sm text-gray-600">{visit.work_description}</p>}
                {visit.notes && <p className="text-xs text-gray-400 mt-1.5">📝 {visit.notes}</p>}
                {visit.status_after && (
                  <span className={`inline-block mt-2 text-[11px] px-2 py-0.5 rounded-full font-medium ${
                    visit.status_after === 'working' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {visit.status_after === 'working' ? 'Работает' : 'Не работает'}
                  </span>
                )}
                <VisitPhotos visitId={visit.id} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal — overlay, doesn't move anything */}
      {showEditModal && point && (
        <EditPointModal point={point} onClose={() => setShowEditModal(false)} />
      )}
    </div>
  );
}
