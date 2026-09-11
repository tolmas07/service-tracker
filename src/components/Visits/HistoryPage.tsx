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
    <div className="flex-1 min-h-0 bg-gray-50 dark:bg-zinc-950 flex flex-col overflow-hidden transition-colors duration-200">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 pt-3 px-4 pb-0 shrink-0 transition-colors">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100 mb-4">История посещений</h2>

        {/* Filter Tabs */}
        <div className="flex bg-gray-100/80 dark:bg-zinc-800/50 p-1 rounded-xl mb-4 shadow-inner border border-gray-200/50 dark:border-zinc-700/50">
          <button
            onClick={() => setFilter('')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
              !filter ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'
            }`}
          >
            Все
          </button>
          <button
            onClick={() => setFilter('working')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
              filter === 'working' ? 'bg-white dark:bg-zinc-700 text-green-600 dark:text-green-400 shadow-sm' : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'
            }`}
          >
            В работе
          </button>
          <button
            onClick={() => setFilter('not_working')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
              filter === 'not_working' ? 'bg-white dark:bg-zinc-700 text-red-600 dark:text-red-400 shadow-sm' : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'
            }`}
          >
            Не в работе
          </button>
        </div>
        
        {/* Date Filter */}
        <div className="flex gap-2 pb-3">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Период с</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-zinc-100 rounded-xl text-xs font-medium focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" />
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Период по</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-zinc-100 rounded-xl text-xs font-medium focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" />
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="self-end px-3 py-2 text-xs font-medium text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors mb-[1px]">Сброс</button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4">
          <Link
            to="/visits/new"
            className="block w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-center font-medium text-sm shadow-sm hover:shadow transition-all active:scale-[0.98]"
          >
            + Новый отчёт
          </Link>
        </div>
        
        {visitsLoading ? (
          <div className="text-center text-gray-400 dark:text-zinc-500 py-12">Загрузка...</div>
        ) : filteredVisits.length === 0 ? (
          <div className="text-center text-gray-400 dark:text-zinc-500 py-12 bg-white dark:bg-zinc-900 mx-4 rounded-2xl border border-gray-200 dark:border-zinc-800">
            <Wrench size={32} className="mx-auto mb-3 opacity-30 text-gray-400 dark:text-zinc-500" />
            <p className="font-medium text-sm">Нет посещений</p>
          </div>
        ) : (
          <div className="px-4 pb-4 space-y-3">
            {filteredVisits.map((visit) => (
              <div key={visit.id} className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-gray-200/60 dark:border-zinc-800 shadow-sm transition-all hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="font-semibold text-base text-gray-900 dark:text-zinc-100 tracking-tight truncate">
                        {visit.point?.name || 'Неизвестная точка'}
                      </span>
                    </div>

                    {/* Work types as tags */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {visit.work_type?.split(',').map(s => s.trim()).filter(Boolean).map((type, i) => (
                        <span key={i} className="text-[11px] px-2 py-0.5 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 rounded-md font-medium">
                          {type}
                        </span>
                      ))}
                    </div>

                    {visit.work_description && (
                      <p className="text-xs text-gray-600 dark:text-zinc-400 mt-2 line-clamp-2 leading-relaxed">{visit.work_description}</p>
                    )}

                    {/* Status badge */}
                    {visit.status_after && (
                      <span className={`inline-block mt-3 text-[11px] px-2 py-0.5 rounded-md font-medium ${
                        visit.status_after === 'working' ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400' :
                        visit.status_after === 'not_working' ? 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400' :
                        'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400'
                      }`}>
                        {statusLabels[visit.status_after] || visit.status_after}
                      </span>
                    )}

                    {visit.notes && (
                      <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-2 bg-gray-50 dark:bg-zinc-800/50 p-2.5 rounded-xl border border-gray-100 dark:border-zinc-800 font-medium">📝 {visit.notes}</p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 ml-3 shrink-0">
                    <div className="text-xs text-gray-500 dark:text-zinc-400 flex items-center gap-1 font-medium bg-gray-50 dark:bg-zinc-800 px-2 py-1 rounded-lg border border-gray-200/50 dark:border-zinc-700/50">
                      <Calendar size={12} />
                      {format(new Date(visit.visited_at), 'dd MMM, HH:mm', { locale: ru })}
                    </div>
                    <button
                      onClick={() => navigate(`/visits/${visit.id}/edit`)}
                      className="mt-1 flex items-center justify-center w-8 h-8 text-gray-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 bg-gray-50 dark:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-full transition-colors"
                    >
                      <Pencil size={14} />
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
