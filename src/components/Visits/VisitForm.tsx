import { useState, useEffect } from 'react';
import { useCreateVisit, useUploadPhoto, useVisitPhotos } from '../../hooks/useVisits';
import { usePoints } from '../../hooks/usePoints';
import { useAuthStore } from '../../stores/authStore';
import { WORK_TYPES, VISIT_STATUSES } from '../../types';
import type { Visit, Point } from '../../types';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, X, ArrowLeft, Check, Trash2, MapPin } from 'lucide-react';
import { MapPointPicker } from '../Map/MapPointPicker';

function FilePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl); // Cleanup memory leak
  }, [file]);

  return (
    <div className="relative">
      <img src={url} alt="" className="w-20 h-20 object-cover rounded-xl border border-gray-200" loading="lazy" />
      <button
        type="button"
        onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 shadow active:scale-90 transition-transform"
      >
        <X size={12} />
      </button>
    </div>
  );
}

interface VisitFormProps {
  pointId?: string;
  initialData?: {
    id: string;
    point_id: string;
    work_type: string;
    work_description?: string;
    status_after?: string;
    notes?: string;
  };
  onSave?: (data: Record<string, string | undefined>) => Promise<void>;
}

function ExistingPhotos({ visitId, onDelete }: { visitId: string; onDelete: () => void }) {
  const { data: photos = [] } = useVisitPhotos(visitId);
  const queryClient = useQueryClient();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const entries: Record<string, string> = {};
      for (const photo of photos) {
        const { data } = supabase.storage.from('photos').getPublicUrl(photo.storage_path);
        entries[photo.id] = data.publicUrl;
      }
      setUrls(entries);
    };
    load();
  }, [photos]);

  const handleDelete = async (photoId: string, storagePath: string) => {
    if (deletingId) return; // Prevent double-tap
    setDeletingId(photoId);
    try {
      // 1. Delete from storage (ignore error if file doesn't exist)
      await supabase.storage.from('photos').remove([storagePath]).catch(() => {});

      // 2. Delete from database
      const { error } = await supabase.from('photos').delete().eq('id', photoId);
      if (error) {
        alert(`Ошибка удаления: ${error.message}`);
        setDeletingId(null);
        return;
      }

      // 3. Refresh
      queryClient.invalidateQueries({ queryKey: ['photos', visitId] });
      onDelete();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Неизвестная ошибка';
      alert(`Ошибка: ${msg}`);
    } finally {
      setDeletingId(null);
    }
  };

  if (photos.length === 0) return null;

  return (
    <div className="flex gap-2 flex-wrap">
      {photos.map((photo) => (
        <div key={photo.id} className="relative">
          <img
            src={urls[photo.id]}
            alt={photo.caption || ''}
            className="w-20 h-20 object-cover rounded-xl border border-gray-200"
            loading="lazy"
          />
          <button
            type="button"
            onClick={() => handleDelete(photo.id, photo.storage_path)}
            disabled={deletingId === photo.id}
            className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg active:scale-90 transition-transform disabled:opacity-50"
          >
            {deletingId === photo.id ? (
              <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Trash2 size={10} />
            )}
          </button>
          {photo.caption && (
            <p className="text-[9px] text-gray-400 text-center mt-0.5 truncate w-20">{photo.caption}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export function VisitForm({ pointId: initialPointId, initialData, onSave }: VisitFormProps) {
  const { user } = useAuthStore();
  const { data: points = [] } = usePoints();
  const createVisit = useCreateVisit();
  const uploadPhoto = useUploadPhoto();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isEdit = !!initialData;

  const [pointId, setPointId] = useState(initialData?.point_id || initialPointId || '');
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    initialData?.work_type ? initialData.work_type.split(',').map(s => s.trim()) : []
  );
  const [description, setDescription] = useState(initialData?.work_description || '');
  const [statusAfter, setStatusAfter] = useState<string>(initialData?.status_after || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [photoRefreshKey, setPhotoRefreshKey] = useState(0);

  const toggleType = (type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles([...files, ...Array.from(e.target.files)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !pointId || selectedTypes.length === 0) return;
    setSubmitting(true);

    try {
      const workTypeStr = selectedTypes.join(', ');

      if (isEdit && onSave) {
        await onSave({
          id: initialData!.id,
          point_id: pointId,
          work_type: workTypeStr,
          work_description: description || undefined,
          status_after: statusAfter || undefined,
          notes: notes || undefined,
        });

        // Upload new photos in edit mode
        for (const file of files) {
          await uploadPhoto.mutateAsync({
            visitId: initialData!.id,
            file,
            photoType: file.name.toLowerCase().includes('printer') ? 'printer' : 'pc',
          });
        }
      } else {
        const visit = await createVisit.mutateAsync({
          point_id: pointId,
          worker_id: user.id,
          work_type: workTypeStr,
          work_description: description || undefined,
          status_after: (statusAfter || undefined) as Visit['status_after'],
          notes: notes || undefined,
          visited_at: new Date().toISOString(),
        });

        for (const file of files) {
          await uploadPhoto.mutateAsync({
            visitId: visit.id,
            file,
            photoType: file.name.toLowerCase().includes('printer') ? 'printer' : 'pc',
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['visits'] });
      navigate('/history');
    } catch (err) {
      console.error('Error saving visit:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const statusColors: Record<string, string> = {
    working: 'bg-green-50 border-green-500 text-green-700',
    not_working: 'bg-red-50 border-red-500 text-red-700',
    sent_to_repair: 'bg-amber-50 border-amber-500 text-amber-700',
    unknown: 'bg-gray-50 border-gray-400 text-gray-600',
  };

  return (
    <div className="flex-1 min-h-0 bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={() => navigate(-1)} className="p-1 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <h2 className="text-lg font-bold text-gray-900">
          {isEdit ? 'Редактировать отчёт' : 'Новый отчёт'}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Scrollable Fields */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {/* Point selector — map-based picker */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Точка обслуживания *</label>
            <button
              type="button"
              onClick={() => setShowMapPicker(true)}
              className={`w-full px-3 py-2.5 border rounded-xl text-sm text-left flex items-center gap-2 transition-colors ${
                pointId
                  ? 'border-blue-300 bg-blue-50 text-blue-800'
                  : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
              }`}
            >
              <MapPin size={16} className={pointId ? 'text-blue-500' : 'text-gray-400'} />
              <span className="truncate flex-1">
                {pointId
                  ? points.find(p => p.id === pointId)
                    ? `${points.find(p => p.id === pointId)!.name}${points.find(p => p.id === pointId)!.address ? ` — ${points.find(p => p.id === pointId)!.address}` : ''}`
                    : 'Выбранная точка'
                  : 'Нажмите чтобы выбрать точку на карте'
                }
              </span>
            </button>
            {pointId && (
              <button
                type="button"
                onClick={() => setPointId('')}
                className="text-xs text-gray-400 hover:text-red-500 mt-1 transition-colors"
              >
                Очистить выбор
              </button>
            )}
          </div>

          {/* Map Point Picker Modal */}
          {showMapPicker && (
            <MapPointPicker
              onSelect={(point: Point) => {
                setPointId(point.id);
                setShowMapPicker(false);
              }}
              onClose={() => setShowMapPicker(false)}
              selectedPointId={pointId}
            />
          )}

          {/* Work types — multi-select */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Тип работы * <span className="text-gray-400">(можно несколько)</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {WORK_TYPES.map((wt) => {
                const selected = selectedTypes.includes(wt);
                return (
                  <button
                    key={wt}
                    type="button"
                    onClick={() => toggleType(wt)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-medium border transition-colors flex items-center justify-center gap-1.5 ${
                      selected
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {selected && <Check size={14} />}
                    {wt}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Описание работ</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Что было сделано..."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Status after */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Статус после работ</label>
            <div className="grid grid-cols-2 gap-2">
              {VISIT_STATUSES.map((s) => {
                const active = statusAfter === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setStatusAfter(active ? '' : s.value)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-medium border transition-colors flex items-center justify-center gap-1.5 ${
                      active ? statusColors[s.value] : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {active && <Check size={14} />}
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Заметки</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Дополнительные заметки"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Photos — always visible */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Фотографии</label>

            {/* Existing photos (edit mode) */}
            {isEdit && initialData?.id && (
              <div className="mb-3" key={photoRefreshKey}>
                <p className="text-[11px] text-gray-400 mb-1.5">Загруженные фото (нажмите ✕ чтобы удалить):</p>
                <ExistingPhotos
                  visitId={initialData.id}
                  onDelete={() => setPhotoRefreshKey(k => k + 1)}
                />
              </div>
            )}

            {/* New photo upload */}
            <label className="flex items-center justify-center gap-2 px-4 py-4 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 text-sm text-gray-500 transition-colors">
              <Camera size={20} />
              <span>{isEdit ? 'Добавить ещё фото' : 'Сделать фото или выбрать из галереи'}</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {files.length > 0 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {files.map((file, i) => (
                  <FilePreview key={i} file={file} onRemove={() => removeFile(i)} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Submit — docked at bottom */}
        <div className="p-3 bg-white border-t border-gray-200 shrink-0 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
          <button
            type="submit"
            disabled={submitting || !pointId || selectedTypes.length === 0}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors shadow-sm"
          >
            {submitting ? 'Сохранение...' : isEdit ? 'Сохранить изменения' : 'Сохранить отчёт'}
          </button>
        </div>
      </form>
    </div>
  );
}
