import { useState, useEffect } from 'react';
import imageCompression from 'browser-image-compression';
import { useCreateVisit, useUploadPhoto, useVisitPhotos } from '../../hooks/useVisits';
import { usePoints } from '../../hooks/usePoints';
import { useAuthStore } from '../../stores/authStore';
import { WORK_TYPES, VISIT_STATUSES } from '../../types';
import type { Visit, Point } from '../../types';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, X, ArrowLeft, Check, MapPin } from 'lucide-react';
import { MapPointPicker } from '../Map/MapPointPicker';

function FilePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return (
    <div className="relative group">
      <img src={url} alt="" className="w-20 h-20 object-cover rounded-xl border border-gray-200 dark:border-zinc-700" loading="lazy" />
      <button
        type="button"
        onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-1 shadow-md opacity-90 hover:opacity-100 hover:scale-110 active:scale-95 transition-all"
      >
        <X size={12} strokeWidth={3} />
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
    <div className="flex gap-3 flex-wrap">
      {photos.map((photo) => (
        <div key={photo.id} className="flex flex-col items-center gap-1.5">
          <div className="relative group">
            <img
              src={urls[photo.id]}
              alt={photo.caption || ''}
              className="w-20 h-20 object-cover rounded-xl border border-gray-200 dark:border-zinc-700"
              loading="lazy"
            />
            <button
              type="button"
              onClick={() => handleDelete(photo.id, photo.storage_path)}
              disabled={deletingId === photo.id}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center shadow-md opacity-90 hover:opacity-100 hover:scale-110 active:scale-95 transition-all disabled:opacity-50 border-2 border-white dark:border-zinc-900"
            >
              {deletingId === photo.id ? (
                <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <X size={13} strokeWidth={3} />
              )}
            </button>
          </div>
          <button
            type="button"
            onClick={() => handleDelete(photo.id, photo.storage_path)}
            disabled={deletingId === photo.id}
            className="text-[10px] text-red-600 dark:text-red-400 font-medium px-2 py-0.5 rounded bg-red-50 dark:bg-red-500/10 active:bg-red-100 dark:active:bg-red-500/20 transition-colors"
          >
            Удалить
          </button>
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
  const [uploadProgress, setUploadProgress] = useState('');
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
    setUploadProgress('Сохранение...');

    try {
      const workTypeStr = selectedTypes.join(', ');
      let currentVisitId = initialData?.id;

      if (isEdit && onSave) {
        await onSave({
          id: initialData!.id,
          point_id: pointId,
          work_type: workTypeStr,
          work_description: description || undefined,
          status_after: statusAfter || undefined,
          notes: notes || undefined,
        });
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
        currentVisitId = visit.id;
      }

      if (files.length > 0 && currentVisitId) {
        setUploadProgress('Сжатие фото...');
        
        const compressOptions = {
          maxSizeMB: 0.3, // Reduced from 0.5 for faster upload
          maxWidthOrHeight: 1024, // Reduced from 1280
          useWebWorker: true,
        };

        const uploadPromises = files.map(async (file) => {
          try {
            const compressedFile = await imageCompression(file, compressOptions);
            return uploadPhoto.mutateAsync({
              visitId: currentVisitId!,
              file: compressedFile,
              photoType: file.name.toLowerCase().includes('printer') ? 'printer' : 'pc',
            });
          } catch (error) {
            console.error('Ошибка сжатия или загрузки файла', error);
            throw error;
          }
        });

        setUploadProgress(`Загрузка фото (0 из ${files.length})...`);
        
        let completed = 0;
        await Promise.all(
          uploadPromises.map(p => p.then(() => {
            completed++;
            setUploadProgress(`Загрузка фото (${completed} из ${files.length})...`);
          }))
        );
      }

      queryClient.invalidateQueries({ queryKey: ['visits'] });
      navigate('/history');
    } catch (err) {
      console.error('Error saving visit:', err);
    } finally {
      setSubmitting(false);
      setUploadProgress('');
    }
  };

  const statusColors: Record<string, string> = {
    working: 'bg-green-50 dark:bg-green-500/10 border-green-500/50 dark:border-green-500/30 text-green-700 dark:text-green-400',
    not_working: 'bg-red-50 dark:bg-red-500/10 border-red-500/50 dark:border-red-500/30 text-red-700 dark:text-red-400',
    sent_to_repair: 'bg-amber-50 dark:bg-amber-500/10 border-amber-500/50 dark:border-amber-500/30 text-amber-700 dark:text-amber-400',
    unknown: 'bg-gray-50 dark:bg-zinc-800/50 border-gray-400 dark:border-zinc-600 text-gray-600 dark:text-zinc-400',
  };

  return (
    <div className="flex-1 min-h-0 bg-gray-50 dark:bg-zinc-950 flex flex-col overflow-hidden transition-colors duration-200">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 px-4 py-3 flex items-center gap-3 shrink-0 transition-colors">
        <button onClick={() => navigate(-1)} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
          <ArrowLeft size={20} className="text-gray-600 dark:text-zinc-400" />
        </button>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">
          {isEdit ? 'Редактировать отчёт' : 'Новый отчёт'}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Scrollable Fields */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-5">
          {/* Point selector — map-based picker */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1.5">Точка обслуживания *</label>
            <button
              type="button"
              onClick={() => setShowMapPicker(true)}
              className={`w-full px-3 py-2.5 border rounded-xl text-sm text-left flex items-center gap-2 transition-colors ${
                pointId
                  ? 'border-blue-300 dark:border-blue-500/50 bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300'
                  : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-400 dark:text-zinc-500 hover:border-gray-300 dark:hover:border-zinc-600'
              }`}
            >
              <MapPin size={16} className={pointId ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-zinc-500'} />
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
                className="text-xs text-gray-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 mt-1.5 transition-colors"
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
            <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1.5">
              Тип работы * <span className="text-gray-400 dark:text-zinc-500">(можно несколько)</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {WORK_TYPES.map((wt) => {
                const selected = selectedTypes.includes(wt);
                return (
                  <button
                    key={wt}
                    type="button"
                    onClick={() => toggleType(wt)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-medium border transition-colors flex items-center justify-center gap-1.5 ${
                      selected
                        ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-500/50 dark:border-blue-500/30 text-blue-700 dark:text-blue-400'
                        : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800'
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
            <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1.5">Описание работ</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Что было сделано..."
              className="w-full px-3 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-zinc-100 rounded-xl text-sm resize-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors"
            />
          </div>

          {/* Status after */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1.5">Статус после работ</label>
            <div className="grid grid-cols-2 gap-2">
              {VISIT_STATUSES.map((s) => {
                const active = statusAfter === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setStatusAfter(active ? '' : s.value)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-medium border transition-colors flex items-center justify-center gap-1.5 ${
                      active ? statusColors[s.value] : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800'
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
            <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1.5">Заметки</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Дополнительные заметки"
              className="w-full px-3 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-zinc-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors"
            />
          </div>

          {/* Photos — always visible */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1.5">Фотографии</label>

            {/* Existing photos (edit mode) */}
            {isEdit && initialData?.id && (
              <div className="mb-3" key={photoRefreshKey}>
                <p className="text-[11px] text-gray-400 dark:text-zinc-500 mb-1.5">Загруженные фото (нажмите ✕ чтобы удалить):</p>
                <ExistingPhotos
                  visitId={initialData.id}
                  onDelete={() => setPhotoRefreshKey(k => k + 1)}
                />
              </div>
            )}

            {/* New photo upload */}
            <label className="flex items-center justify-center gap-2 px-4 py-4 bg-white dark:bg-zinc-900 border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800 text-sm text-gray-500 dark:text-zinc-400 transition-colors">
              <Camera size={20} />
              <span>{isEdit ? 'Добавить ещё фото' : 'Сделать фото или выбрать'}</span>
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
        <div className="p-3 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 shrink-0 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] dark:shadow-none transition-colors">
          <button
            type="submit"
            disabled={submitting || !pointId || selectedTypes.length === 0}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors shadow-sm"
          >
            {submitting ? (uploadProgress || 'Сохранение...') : isEdit ? 'Сохранить изменения' : 'Сохранить отчёт'}
          </button>
        </div>
      </form>
    </div>
  );
}
