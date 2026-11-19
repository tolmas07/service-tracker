import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, differenceInCalendarDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Printer, Calendar, Download, Search, ChevronLeft, ChevronRight, Building2, TrendingUp, Award, AlertCircle } from 'lucide-react';
import { usePoints } from '../../hooks/usePoints';
import { usePrintReport } from '../../hooks/usePrintStats';

type FilterMode = 'month' | 'range' | 'all';

export function PrintReportPage() {
  const [mode, setMode] = useState<FilterMode>('month');
  const [monthValue, setMonthValue] = useState(() => format(new Date(), 'yyyy-MM'));
  const [fromDate, setFromDate] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);

  const { data: points = [] } = usePoints();

  const { fromIso, toIso, periodDays, periodLabel } = useMemo(() => {
    if (mode === 'all') {
      return { fromIso: undefined, toIso: undefined, periodDays: 0, periodLabel: 'За всё время' };
    }
    if (mode === 'month') {
      const [y, m] = monthValue.split('-').map(Number);
      const base = new Date(y, (m || 1) - 1, 1);
      const start = startOfMonth(base);
      const end = endOfMonth(base);
      end.setHours(23, 59, 59, 999);
      const days = Math.max(1, differenceInCalendarDays(end, start) + 1);
      return {
        fromIso: start.toISOString(),
        toIso: end.toISOString(),
        periodDays: days,
        periodLabel: format(base, 'LLLL yyyy', { locale: ru }),
      };
    }
    const start = new Date(`${fromDate}T00:00:00`);
    const end = new Date(`${toDate}T23:59:59.999`);
    const days = Math.max(1, differenceInCalendarDays(end, start) + 1);
    return {
      fromIso: start.toISOString(),
      toIso: end.toISOString(),
      periodDays: days,
      periodLabel: `${format(start, 'dd.MM.yyyy')} — ${format(end, 'dd.MM.yyyy')}`,
    };
  }, [mode, monthValue, fromDate, toDate]);

  const { data: reportData, isLoading } = usePrintReport(fromIso, toIso);
  const rows = reportData?.rows ?? [];
  const tableMissing = reportData?.tableMissing ?? false;

  const pointsById = useMemo(() => {
    const map = new Map<string, (typeof points)[number]>();
    for (const p of points) map.set(p.id, p);
    return map;
  }, [points]);

  const stats = useMemo(() => {
    const perPoint = new Map<string, { count: number; lastPrintedAt: string }>();
    const activeDays = new Set<string>();

    for (const r of rows) {
      const existing = perPoint.get(r.point_id);
      if (!existing) {
        perPoint.set(r.point_id, { count: 1, lastPrintedAt: r.printed_at });
      } else {
        existing.count++;
        if (r.printed_at > existing.lastPrintedAt) {
          existing.lastPrintedAt = r.printed_at;
        }
      }
      activeDays.add(r.printed_at.slice(0, 10));
    }

    const total = rows.length;
    const list = Array.from(perPoint.entries())
      .map(([pointId, info]) => {
        const pt = pointsById.get(pointId);
        return {
          pointId,
          name: pt?.name || 'Неизвестная точка',
          address: pt?.address || '',
          count: info.count,
          share: total > 0 ? Math.round((info.count / total) * 1000) / 10 : 0,
          lastPrintedAt: info.lastPrintedAt,
        };
      })
      .sort((a, b) => b.count - a.count);

    const divisor = periodDays > 0 ? periodDays : Math.max(1, activeDays.size);
    const avgPerDay = total > 0 ? Math.round((total / divisor) * 10) / 10 : 0;

    return {
      total,
      activePoints: list.length,
      avgPerDay,
      leader: list[0] ?? null,
      list,
    };
  }, [rows, pointsById, periodDays]);

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stats.list;
    return stats.list.filter(
      (item) => item.name.toLowerCase().includes(q) || item.address.toLowerCase().includes(q)
    );
  }, [stats.list, search]);

  const shiftMonth = (delta: number) => {
    const [y, m] = monthValue.split('-').map(Number);
    const next = delta > 0 ? addMonths(new Date(y, m - 1, 1), 1) : subMonths(new Date(y, m - 1, 1), 1);
    setMonthValue(format(next, 'yyyy-MM'));
  };

  const handleExportExcel = async () => {
    if (filteredList.length === 0) return;
    setExporting(true);
    try {
      const XLSX = await import('xlsx');
      const sheetRows = filteredList.map((item, idx) => ({
        '№': idx + 1,
        'Филиал / Точка': item.name,
        'Адрес': item.address,
        'Распечатано карт': item.count,
        'Доля (%)': item.share,
        'Последняя печать': format(new Date(item.lastPrintedAt), 'dd.MM.yyyy HH:mm'),
      }));
      sheetRows.push({
        '№': filteredList.length + 1,
        'Филиал / Точка': 'ИТОГО',
        'Адрес': periodLabel,
        'Распечатано карт': stats.total,
        'Доля (%)': 100,
        'Последняя печать': '',
      });
      const ws = XLSX.utils.json_to_sheet(sheetRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Отчет по печати');
      XLSX.writeFile(wb, `print-report-${mode === 'month' ? monthValue : mode}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-gray-50 p-4 pb-24 md:pb-6">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Printer className="text-blue-600" size={22} />
              Отчёт по печати карт
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">Статистика распечатанных кадастровых карт по филиалам</p>
          </div>
          <button
            onClick={handleExportExcel}
            disabled={exporting || filteredList.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-medium hover:bg-emerald-700 disabled:opacity-40 transition-colors shadow-sm cursor-pointer"
          >
            <Download size={14} />
            {exporting ? 'Экспорт...' : 'Скачать Excel'}
          </button>
        </div>

        {/* Filter Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {([
              { id: 'month', label: 'За месяц' },
              { id: 'range', label: 'Точные даты' },
              { id: 'all', label: 'За всё время' },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setMode(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  mode === tab.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {mode === 'month' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => shiftMonth(-1)}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 cursor-pointer"
                title="Предыдущий месяц"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5">
                <Calendar size={14} className="text-gray-400" />
                <input
                  type="month"
                  value={monthValue}
                  onChange={(e) => setMonthValue(e.target.value)}
                  className="bg-transparent text-sm font-medium text-gray-800 outline-none"
                />
              </div>
              <button
                onClick={() => shiftMonth(1)}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 cursor-pointer"
                title="Следующий месяц"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {mode === 'range' && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5">
                <span className="text-xs text-gray-500">С:</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="bg-transparent text-sm font-medium text-gray-800 outline-none"
                />
              </div>
              <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5">
                <span className="text-xs text-gray-500">По:</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="bg-transparent text-sm font-medium text-gray-800 outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {tableMissing && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-800">
            <AlertCircle size={18} className="shrink-0 mt-0.5 text-amber-600" />
            <div>
              <p className="font-semibold">Таблица print_events ещё не создана в Supabase</p>
              <p className="mt-1">Выполните SQL-скрипт создания таблицы в Supabase SQL Editor, после чего статистика печати начнёт автоматически поступать с компьютеров точек.</p>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm">
            <div className="text-[11px] text-gray-500 flex items-center gap-1">
              <Printer size={13} className="text-blue-500" /> Всего карт
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{stats.total.toLocaleString('ru-RU')}</div>
            <div className="text-[10px] text-gray-400 mt-0.5 capitalize">{periodLabel}</div>
          </div>

          <div className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm">
            <div className="text-[11px] text-gray-500 flex items-center gap-1">
              <Building2 size={13} className="text-emerald-500" /> Активных точек
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{stats.activePoints}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">из {points.length} всего</div>
          </div>

          <div className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm">
            <div className="text-[11px] text-gray-500 flex items-center gap-1">
              <TrendingUp size={13} className="text-indigo-500" /> Среднее в день
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{stats.avgPerDay}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">карт / день</div>
          </div>

          <div className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm">
            <div className="text-[11px] text-gray-500 flex items-center gap-1">
              <Award size={13} className="text-amber-500" /> Лидер периода
            </div>
            <div className="text-sm font-bold text-gray-900 mt-1.5 truncate" title={stats.leader?.name}>
              {stats.leader ? stats.leader.name : '—'}
            </div>
            <div className="text-[11px] text-amber-600 font-semibold mt-0.5">
              {stats.leader ? `${stats.leader.count} карт` : 'Нет данных'}
            </div>
          </div>
        </div>

        {/* Search + Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-3 border-b border-gray-100 flex items-center gap-2">
            <Search size={15} className="text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию района или адресу..."
              className="flex-1 text-sm outline-none text-gray-700 placeholder:text-gray-400"
            />
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-sm text-gray-400">Загрузка отчёта...</div>
          ) : filteredList.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-400">
              За выбранный период данных о печати пока нет
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredList.map((item, idx) => (
                <Link
                  key={item.pointId}
                  to={`/points/${item.pointId}`}
                  className="flex items-center justify-between gap-3 p-3.5 hover:bg-gray-50 transition-colors no-underline"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400 w-5">{idx + 1}.</span>
                      <span className="text-sm font-semibold text-gray-900 truncate">{item.name}</span>
                    </div>
                    {item.address && (
                      <p className="text-[11px] text-gray-400 ml-7 truncate">{item.address}</p>
                    )}
                    <div className="ml-7 mt-1.5 flex items-center gap-2">
                      <div className="flex-1 max-w-[180px] bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-1.5 bg-blue-500 rounded-full"
                          style={{ width: `${Math.min(100, Math.max(4, item.share))}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-400">
                        {item.share}% • посл.: {format(new Date(item.lastPrintedAt), 'dd.MM HH:mm')}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="inline-block px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm font-bold">
                      {item.count}
                    </span>
                    <div className="text-[10px] text-gray-400 mt-0.5">карт</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
