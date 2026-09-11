import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, Wrench, MapPin, Pencil } from 'lucide-react';
import type { Visit } from '../../types';

const statusLabels: Record<string, string> = {
  working: 'Работает',
  not_working: 'Не работает',
  sent_to_repair: 'Отправлен на ремонт',
  unknown: 'Неизвестно',
};

const statusBadgeClass: Record<string, string> = {
  working: 'bg-green-100 text-green-700',
  not_working: 'bg-red-100 text-red-700',
  sent_to_repair: 'bg-amber-100 text-amber-700',
  unknown: 'bg-gray-100 text-gray-600',
};

function WorkTypeBadges({ workType }: { workType: string }) {
  const types = workType.split(',').map(s => s.trim()).filter(Boolean);
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {types.map((type, i) => (
        <span key={i} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-md font-medium">
          {type}
        </span>
      ))}
    </div>
  );
}

export function HistoryPage() {
  const [filter, setFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const navigate = useNavigate();

  const { data: visits = [], isLoading: visitsLoading } = useQuery({
    queryKey: ['visits'],
    queryFn: async () => {
      const { data } = await supabase
        .from('visits')
        .select('*, point:points(*)')
        .order('visited_at', { ascending: false });
      return (data || []) as Visit[];
    },
  });

  const filteredVisits = visits.filter((v) => {
    if (filter) {
      const match = v.work_type?.toLowerCase().includes(filter.toLowerCase()) ||
                    v.work_description?.toLowerCase().includes(filter.toLowerCase()) ||
                    v.point?.name?.toLowerCase().includes(filter.toLowerCase());
      if (!match) return false;
    }
    const d = new Date(v.visited_at);
    if (dateFrom && d < new Date(dateFrom)) return false;
    if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  });

  return (
    <div className="flex-1 min-h-0 bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
        <h2 className="text-lg font-bold text-gray-900">История отчетов</h2>
        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
          {filteredVisits.length} шт
        </span>
      </div>

      <div className="p-3 bg-white border-b border-gray-100 shrink-0 space-y-3">
        <input
          type="text"
          placeholder="Поиск по точке, типу работ..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
        />
        
        {/* Date Filter */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-[10px] font-medium text-gray-500 mb-1">Период с</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-medium text-gray-500 mb-1">Период по</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="self-end px-3 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">Сброс</button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-3">
          <Link
            to="/visits/new"
            className="block w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl text-center font-medium hover:from-blue-700 hover:to-blue-800 transition-all shadow-md active:scale-[0.98]"
          >
            + Новый отчёт
          </Link>
        </div>
        
        {visitsLoading ? (
          <div className="text-center text-gray-400 py-12">Загрузка...</div>
        ) : filteredVisits.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <Wrench size={32} className="mx-auto mb-2 opacity-50" />
            <p>Нет посещений</p>
          </div>
        ) : (
          <div className="px-3 pb-3 space-y-2.5">
            {filteredVisits.map((visit) => (
              <div key={visit.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin size={14} className="text-blue-600 shrink-0" />
                      <span className="font-semibold text-sm text-gray-900 truncate">
                        {visit.point?.name || 'Неизвестная точка'}
                      </span>
                    </div>

                    {/* Work types as tags */}
                    <WorkTypeBadges workType={visit.work_type} />

                    {visit.work_description && (
                      <p className="text-xs text-gray-600 mt-1.5 line-clamp-2 leading-relaxed">{visit.work_description}</p>
                    )}

                    {/* Status badge */}
                    {visit.status_after && (
                      <span className={`inline-block mt-2.5 text-[11px] px-2.5 py-1 rounded-full font-medium ${statusBadgeClass[visit.status_after] || 'bg-gray-100 text-gray-600'}`}>
                        {statusLabels[visit.status_after] || visit.status_after}
                      </span>
                    )}

                    {visit.notes && (
                      <p className="text-[11px] text-gray-400 mt-2 bg-gray-50 p-2 rounded-lg border border-gray-100">📝 {visit.notes}</p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 ml-3 shrink-0">
                    <div className="text-[11px] text-gray-400 flex items-center gap-1 font-medium bg-gray-50 px-2 py-1 rounded-md">
                      <Calendar size={12} />
                      {format(new Date(visit.visited_at), 'dd MMM, HH:mm', { locale: ru })}
                    </div>
                    <button
                      onClick={() => navigate(`/visits/${visit.id}/edit`)}
                      className="mt-1 flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors font-medium border border-transparent hover:border-blue-100"
                    >
                      <Pencil size={12} /> Изменить
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
