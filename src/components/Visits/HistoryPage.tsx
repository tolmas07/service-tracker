import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { format, isToday, isYesterday, startOfMonth } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, Wrench, MapPin, Pencil, Trash2, Search, X, Plus, ChevronRight } from 'lucide-react';
import type { Visit } from '../../types';

const statusLabels: Record<string, string> = {
  working: 'Работает',
  not_working: 'Не работает',
  sent_to_repair: 'В ремонт',
  unknown: 'Неизвестно',
};

const statusBadgeClass: Record<string, string> = {
  working: 'bg-green-50 text-green-700 border-green-200',
  not_working: 'bg-red-50 text-red-700 border-red-200',
  sent_to_repair: 'bg-amber-50 text-amber-700 border-amber-200',
  unknown: 'bg-gray-100 text-gray-600 border-gray-200',
};

type PeriodPreset = 'all' | 'month' | '30d' | 'custom';
type StatusFilter = 'all' | 'working' | 'not_working' | 'sent_to_repair';

function WorkTypeBadges({ workType }: { workType: string }) {
  const types = workType.split(',').map((s) => s.trim()).filter(Boolean);
  if (types.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {types.map((type, i) => (
        <span
          key={i}
          className="text-[11px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-medium"
        >
          {type}
        </span>
      ))}
    </div>
  );
}

function getDateGroupLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return 'Сегодня';
  if (isYesterday(d)) return 'Вчера';
  return format(d, 'd MMMM yyyy', { locale: ru });
}

export function HistoryPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<PeriodPreset>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: visits = [], isLoading: visitsLoading } = useQuery({
    queryKey: ['visits', 'history', user?.id],
    queryFn: async () => {
      let query = supabase
        .from('visits')
        .select('*, point:points(*)')
        .order('visited_at', { ascending: false });

      if (user?.role === 'worker' && user.id) {
        query = query.eq('worker_id', user.id);
      }

      const { data } = await query;
      return (data || []) as Visit[];
    },
    enabled: !!user?.id,
  });

  const filteredVisits = useMemo(() => {
    const now = Date.now();
    const monthStartMs = startOfMonth(new Date()).getTime();
    const thirtyDaysAgoMs = now - 30 * 24 * 60 * 60 * 1000;
    const q = search.trim().toLowerCase();

    return visits.filter((v) => {
      if (q) {
        const match =
          v.work_type?.toLowerCase().includes(q) ||
          v.work_description?.toLowerCase().includes(q) ||
          v.notes?.toLowerCase().includes(q) ||
          v.point?.name?.toLowerCase().includes(q);
        if (!match) return false;
      }

      if (statusFilter !== 'all' && v.status_after !== statusFilter) {
        return false;
      }

      const ts = new Date(v.visited_at).getTime();
      if (period === 'month' && ts < monthStartMs) return false;
      if (period === '30d' && ts < thirtyDaysAgoMs) return false;
      if (period === 'custom') {
        if (dateFrom && ts < new Date(`${dateFrom}T00:00:00`).getTime()) return false;
        if (dateTo && ts > new Date(`${dateTo}T23:59:59.999`).getTime()) return false;
      }
      return true;
    });
  }, [visits, search, statusFilter, period, dateFrom, dateTo]);

  // Group visits by calendar date for clean mobile timeline
  const groupedVisits = useMemo(() => {
    const groups: { key: string; label: string; items: Visit[] }[] = [];
    const byKey = new Map<string, { key: string; label: string; items: Visit[] }>();

    for (const v of filteredVisits) {
      const key = format(new Date(v.visited_at), 'yyyy-MM-dd');
      let group = byKey.get(key);
      if (!group) {
        group = { key, label: getDateGroupLabel(v.visited_at), items: [] };
        byKey.set(key, group);
        groups.push(group);
      }
      group.items.push(v);
    }
    return groups;
  }, [filteredVisits]);

  const handleDelete = async (visitId: string) => {
    if (!confirm('Удалить этот отчёт?')) return;
    setDeletingId(visitId);
    try {
      const { error } = await supabase.from('visits').delete().eq('id', visitId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['last-visits-by-point'] });
    } catch (e: unknown) {
      alert('Ошибка при удалении: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex-1 min-h-0 bg-gray-50 flex flex-col overflow-hidden">
      {/* Compact Sticky Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 shrink-0">
        <div className="max-w-3xl mx-auto space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">История отчётов</h2>
              <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                {filteredVisits.length}
              </span>
            </div>
            <Link
              to="/visits/new"
              className="inline-flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 active:scale-95 transition-all shadow-sm no-underline"
            >
              <Plus size={15} strokeWidth={2.5} /> Отчёт
            </Link>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Поиск по точке, работам, заметкам..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Horizontal Scrollable Filter Chips (Mobile-First) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1">
            {([
              { id: 'all', label: 'Все' },
              { id: 'month', label: 'Этот месяц' },
              { id: '30d', label: '30 дн.' },
              { id: 'custom', label: 'Даты' },
            ] as const).map((chip) => (
              <button
                key={chip.id}
                onClick={() => setPeriod(chip.id)}
                className={`shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
                  period === chip.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {chip.id === 'custom' && <Calendar size={12} />}
                {chip.label}
              </button>
            ))}

            <span className="h-4 w-px bg-gray-200 shrink-0 mx-0.5" />

            {([
              { id: 'working', label: 'Работает', activeClass: 'bg-green-600 text-white' },
              { id: 'not_working', label: 'Не работает', activeClass: 'bg-red-600 text-white' },
              { id: 'sent_to_repair', label: 'В ремонт', activeClass: 'bg-amber-500 text-white' },
            ] as const).map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(statusFilter === st.id ? 'all' : st.id)}
                className={`shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  statusFilter === st.id
                    ? st.activeClass
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Expandable Custom Date Range */}
          {period === 'custom' && (
            <div className="flex items-center gap-2 pt-1">
              <div className="flex-1">
                <span className="block text-[10px] text-gray-400 mb-0.5">С</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex-1">
                <span className="block text-[10px] text-gray-400 mb-0.5">По</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-blue-500"
                />
              </div>
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => {
                    setDateFrom('');
                    setDateTo('');
                  }}
                  className="self-end px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded-lg cursor-pointer"
                >
                  Сброс
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Timeline List */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 pt-3 pb-24 md:pb-8">
          {visitsLoading ? (
            <div className="text-center text-gray-400 py-12 text-sm">Загрузка...</div>
          ) : groupedVisits.length === 0 ? (
            <div className="text-center text-gray-400 py-14 bg-white rounded-2xl border border-gray-100">
              <Wrench size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">Отчётов не найдено</p>
              <Link
                to="/visits/new"
                className="inline-block mt-3 text-xs font-semibold text-blue-600 hover:underline"
              >
                + Создать первый отчёт
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedVisits.map((group) => (
                <div key={group.key} className="space-y-2.5">
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      {group.label}
                    </span>
                    <span className="text-[10px] font-semibold text-gray-400 bg-gray-200/70 px-1.5 py-0.5 rounded-full">
                      {group.items.length}
                    </span>
                    <div className="flex-1 h-px bg-gray-200/70" />
                  </div>

                  {group.items.map((visit) => (
                    <div
                      key={visit.id}
                      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                    >
                      <div className="p-3.5 sm:p-4">
                        {/* Top row: Point link + time */}
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            to={visit.point_id ? `/points/${visit.point_id}` : '#'}
                            className="flex items-center gap-1.5 min-w-0 flex-1 group no-underline"
                          >
                            <MapPin size={15} className="text-blue-600 shrink-0" />
                            <span className="font-bold text-sm text-gray-900 group-hover:text-blue-600 truncate transition-colors">
                              {visit.point?.name || 'Неизвестная точка'}
                            </span>
                            <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-500 shrink-0" />
                          </Link>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {visit.status_after && (
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                                  statusBadgeClass[visit.status_after] || 'bg-gray-100 text-gray-600 border-gray-200'
                                }`}
                              >
                                {statusLabels[visit.status_after] || visit.status_after}
                              </span>
                            )}
                            <span className="text-[11px] text-gray-400 font-medium">
                              {format(new Date(visit.visited_at), 'HH:mm')}
                            </span>
                          </div>
                        </div>

                        {/* Work types */}
                        <WorkTypeBadges workType={visit.work_type} />

                        {/* Description */}
                        {visit.work_description && (
                          <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                            {visit.work_description}
                          </p>
                        )}

                        {/* Notes */}
                        {visit.notes && (
                          <p className="text-[11px] text-gray-500 mt-2 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100">
                            📝 {visit.notes}
                          </p>
                        )}
                      </div>

                      {/* Clean Mobile Bottom Action Footer */}
                      <div className="border-t border-gray-100 bg-gray-50/60 px-3 py-1.5 flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/visits/${visit.id}/edit`)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded-lg font-semibold transition-colors cursor-pointer"
                        >
                          <Pencil size={13} /> Изменить
                        </button>
                        <button
                          disabled={deletingId === visit.id}
                          onClick={() => handleDelete(visit.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg font-semibold transition-colors disabled:opacity-40 cursor-pointer"
                        >
                          <Trash2 size={13} /> {deletingId === visit.id ? '...' : 'Удалить'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
