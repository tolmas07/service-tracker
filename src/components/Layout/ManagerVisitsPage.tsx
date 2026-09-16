import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { MapPin, ClipboardList, Users } from 'lucide-react';
import { useManagerStore } from '../../stores/managerStore';
import { useSearchParams } from 'react-router-dom';

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="text-center py-12 text-gray-400">
      <Icon size={32} className="mx-auto mb-2 opacity-50" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

export function ManagerVisitsPage() {
  const { selectedWorker, setSelectedWorker } = useManagerStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPointName = searchParams.get('pointName') || '';
  const [filter, setFilter] = useState(initialPointName);
  
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: workers = [] } = useQuery({
    queryKey: ['workers'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('role', 'worker');
      return data || [];
    },
  });

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['reports', selectedWorker],
    queryFn: async () => {
      let q = supabase
        .from('visits')
        .select('*, point:points(*), worker:profiles(full_name), photos(url:storage_path, photo_type)')
        .order('visited_at', { ascending: false })
        .limit(200);
      if (selectedWorker !== 'all') q = q.eq('worker_id', selectedWorker);
      const { data } = await q;
      return (data || []) as any[];
    },
  });

  const filteredReports = reports.filter(r => {
    // Text search by point name or work type
    if (filter) {
      const match = r.point?.name?.toLowerCase().includes(filter.toLowerCase()) ||
                    r.work_type?.toLowerCase().includes(filter.toLowerCase()) ||
                    r.work_description?.toLowerCase().includes(filter.toLowerCase());
      if (!match) return false;
    }
    // Date filter
    const d = new Date(r.visited_at);
    if (dateFrom && d < new Date(dateFrom)) return false;
    if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  });

  return (
    <div className="flex-1 bg-gray-50 flex flex-col overflow-hidden">
      {/* Header / Filters Area */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 shrink-0 space-y-3">
        <h2 className="text-lg font-bold text-gray-900">Отчеты специалистов</h2>
        
        {/* Worker Filter */}
        <div className="flex items-center gap-2">
          <Users size={16} className="text-gray-400 shrink-0" />
          <select
            value={selectedWorker}
            onChange={(e) => setSelectedWorker(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          >
            <option value="all">Все специалисты</option>
            {workers.map((w: { id: string; full_name: string }) => (
              <option key={w.id} value={w.id}>{w.full_name}</option>
            ))}
          </select>
        </div>

        {/* Text Filter */}
        <input
          type="text"
          placeholder="Поиск по точке, типу работ..."
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            // update URL if needed
            if (e.target.value) {
              setSearchParams({ pointName: e.target.value });
            } else {
              setSearchParams({});
            }
          }}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
        />

        {/* Global Date Filter */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-[10px] font-medium text-gray-500 mb-1">Период с</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:border-blue-500" />
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-medium text-gray-500 mb-1">Период по</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:border-blue-500" />
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="self-end px-3 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">Сброс</button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-blue-50 rounded-xl p-3 flex items-center justify-between mb-4">
          <div className="text-xs text-blue-700">
            <strong>{filteredReports.length}</strong> отчетов
            <div className="mt-0.5 text-[10px] opacity-80">По выбранным фильтрам</div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center text-gray-400 py-12">Загрузка...</div>
        ) : (
          <div className="space-y-3 pb-4">
            {filteredReports.map(report => (
              <div key={report.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center text-[9px] font-bold text-blue-700 shrink-0">
                        {report.worker?.full_name?.charAt(0) || '?'}
                      </div>
                      <span className="font-medium text-xs text-gray-900 truncate">{report.worker?.full_name || 'Неизвестный'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-blue-600 shrink-0" />
                      <span className="font-bold text-sm text-gray-900 truncate">
                        {report.point?.name || 'Неизвестная точка'}
                      </span>
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-400 bg-gray-50 px-2 py-1 rounded-md shrink-0">
                    {format(new Date(report.visited_at), 'dd MMM, HH:mm', { locale: ru })}
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  <div>
                    <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">Выполненные работы</div>
                    <div className="flex flex-wrap gap-1">
                      {report.work_type.split(',').map((type: string, i: number) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-md font-medium">
                          {type.trim()}
                        </span>
                      ))}
                    </div>
                  </div>

                  {report.work_description && (
                    <div>
                      <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-0.5">Описание</div>
                      <p className="text-xs text-gray-700 bg-gray-50 p-2 rounded-lg leading-relaxed">{report.work_description}</p>
                    </div>
                  )}

                  {report.notes && (
                    <div>
                      <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-0.5">Заметки</div>
                      <p className="text-[11px] text-gray-500 italic bg-amber-50/50 p-2 rounded-lg border border-amber-100/50">
                        {report.notes}
                      </p>
                    </div>
                  )}
                </div>

                {/* Photos */}
                {report.photos && report.photos.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">Фотоотчет ({report.photos.length})</div>
                    <div className="flex overflow-x-auto gap-2 pb-2 snap-x">
                      {report.photos.map((photo: any, i: number) => {
                        const publicUrl = supabase.storage.from('photos').getPublicUrl(photo.url).data.publicUrl;
                        return (
                          <a
                            key={i}
                            href={publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-gray-200 snap-start bg-gray-50 block"
                          >
                            <img src={publicUrl} alt="Фото" className="w-full h-full object-cover" loading="lazy" />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {filteredReports.length === 0 && (
              <EmptyState icon={ClipboardList} text="Нет отчетов за выбранный период" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
