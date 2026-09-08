import { useParams, Link, useNavigate } from 'react-router-dom';
import { usePoint, useDeletePoint, useUpdatePointStatus } from '../../hooks/usePoints';
import { useVisits, useVisitPhotos } from '../../hooks/useVisits';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { MapPin, ArrowLeft, Wrench, Trash2, Navigation } from 'lucide-react';
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

export function PointDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: point, isLoading: pointLoading } = usePoint(id!);
  const { data: visits = [], isLoading: visitsLoading } = useVisits(id);
  const deletePoint = useDeletePoint();
  const updateStatus = useUpdatePointStatus();
  const { user } = useAuthStore();
  const isWorker = user?.role === 'worker';

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
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        Точка не найдена
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 shrink-0">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-blue-600 mb-2 hover:text-blue-700">
          <ArrowLeft size={16} /> Назад
        </button>
        <h2 className="text-xl font-bold text-gray-900">{point.name}</h2>
        {point.address && <p className="text-sm text-gray-500 mt-0.5">{point.address}</p>}
        <div className="flex items-center gap-3 mt-3">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            point.status === 'working' ? 'bg-green-100 text-green-700' :
            point.status === 'not_working' ? 'bg-red-100 text-red-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {point.status === 'working' ? 'Работает' :
             point.status === 'not_working' ? 'Не работает' : 'Неизвестно'}
          </span>
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <MapPin size={12} />
            {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
          </span>
        </div>
        <div className="flex gap-2 mt-3">
          <a
            href={`yandexmaps://build_route?to=${point.latitude},${point.longitude}`}
            className="flex-1 text-xs px-3 py-2.5 bg-yellow-50 text-yellow-800 rounded-xl hover:bg-yellow-100 transition-colors font-medium flex items-center justify-center gap-1.5 border border-yellow-200"
          >
            <Navigation size={14} /> Яндекс Навигатор
          </a>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${point.latitude},${point.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-xs px-3 py-2.5 bg-green-50 text-green-800 rounded-xl hover:bg-green-100 transition-colors font-medium flex items-center justify-center gap-1.5 border border-green-200"
          >
            <Navigation size={14} /> Google Maps
          </a>
        </div>
      </div>

      {/* Action */}
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
              onClick={() => updateStatus.mutate({ id: point.id, status: 'working' })}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                point.status === 'working' ? 'bg-green-100 border-green-400 text-green-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Работает
            </button>
            <button
              onClick={() => updateStatus.mutate({ id: point.id, status: 'not_working' })}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                point.status === 'not_working' ? 'bg-red-100 border-red-400 text-red-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Не работает
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2.5 rounded-xl text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
              title="Удалить точку"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Visit History */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
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
                {visit.work_description && (
                  <p className="text-sm text-gray-600">{visit.work_description}</p>
                )}
                {visit.notes && (
                  <p className="text-xs text-gray-400 mt-1.5">📝 {visit.notes}</p>
                )}
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
    </div>
  );
}
