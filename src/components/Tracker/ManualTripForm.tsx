import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useAllPoints } from '../../hooks/usePoints';
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  Plus, List, Ruler, Pencil, Trash2, Check, Wallet, Route, MapPin,
  Clock, ChevronLeft, ChevronRight, Download, Home, X, Locate, Sparkles, Calendar
} from 'lucide-react';
import type { Point, Trip, Visit } from '../../types';
import { COST_PER_KM } from '../../types';
import {
  exportTripsToStyledExcel,
  loadHomeBase,
  saveHomeBase,
  saveTripRoute,
  type HomeBase,
} from '../../lib/tripExcelExport';
import { MapPointPicker } from '../Map/MapPointPicker';

function formatDuration(seconds?: number): string | null {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}ч ${m}м`;
  if (h > 0) return `${h}ч`;
  return `${m}м`;
}

function HomeBaseModal({
  home,
  onSave,
  onClose,
}: {
  home: HomeBase;
  onSave: (next: HomeBase) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: home.name,
    region: home.region,
    address: home.address,
    lat: String(home.lat),
    lng: String(home.lng),
  });
  const [locating, setLocating] = useState(false);

  const detectGps = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        }));
        setLocating(false);
      },
      () => {
        setLocating(false);
        alert('Не удалось определить GPS. Проверьте разрешение геолокации.');
      },
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 }
    );
  };

  const handleSubmit = () => {
    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    if (!form.name.trim() || isNaN(lat) || isNaN(lng)) return;
    const next: HomeBase = {
      name: form.name.trim(),
      region: form.region.trim() || 'Samarqand',
      address: form.address.trim() || '—',
      lat,
      lng,
    };
    saveHomeBase(next);
    onSave(next);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-3.5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
            <Home size={18} className="text-blue-600" /> Мой дом (база)
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg cursor-pointer">
            <X size={18} className="text-gray-400" />
          </button>
        </div>
        <p className="text-[11px] text-gray-500">
          Используется как начальная и конечная точка («Uy») при формировании Excel-отчёта по поездкам.
        </p>

        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="min-w-0">
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Название</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Uy"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div className="min-w-0">
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Область</label>
              <input
                type="text"
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                placeholder="Samarqand"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Адрес</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Ziyolilar 6-uy"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="min-w-0">
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Широта</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.000001"
                value={form.lat}
                onChange={(e) => setForm({ ...form, lat: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono outline-none focus:border-blue-500"
              />
            </div>
            <div className="min-w-0">
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Долгота</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.000001"
                value={form.lng}
                onChange={(e) => setForm({ ...form, lng: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={detectGps}
            disabled={locating}
            className="w-full py-2 bg-blue-50 text-blue-700 rounded-xl text-xs font-semibold hover:bg-blue-100 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Locate size={14} className={locating ? 'animate-pulse' : ''} />
            {locating ? 'Определение...' : 'Взять текущие GPS координаты'}
          </button>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-200 cursor-pointer"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 cursor-pointer"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

export function ManualTripForm() {
  const { user } = useAuthStore();
  const { data: points = [] } = useAllPoints(true);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'new' | 'list'>('new');

  // Home base state
  const [homeBase, setHomeBase] = useState<HomeBase>(() => loadHomeBase());
  const [showHomeModal, setShowHomeModal] = useState(false);

  // Form State
  const today = new Date();
  const [date, setDate] = useState(format(today, 'yyyy-MM-dd'));
  const [timeStart, setTimeStart] = useState('08:00');
  const [timeEnd, setTimeEnd] = useState(format(today, 'HH:mm'));
  const [distanceKm, setDistanceKm] = useState('');
  const [selectedStops, setSelectedStops] = useState<Point[]>([]);
  const [returnHome, setReturnHome] = useState(true);
  const [showPointPicker, setShowPointPicker] = useState(false);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [saving, setSaving] = useState(false);

  // List State
  const [periodMode, setPeriodMode] = useState<'month' | 'range' | 'all'>('month');
  const [monthValue, setMonthValue] = useState(() => format(new Date(), 'yyyy-MM'));
  const [rangeFrom, setRangeFrom] = useState(() => {
    const d = new Date();
    const prev = subMonths(d, 1);
    return format(new Date(prev.getFullYear(), prev.getMonth(), 15), 'yyyy-MM-dd');
  });
  const [rangeTo, setRangeTo] = useState(() => {
    const d = new Date();
    return format(new Date(d.getFullYear(), d.getMonth(), 15), 'yyyy-MM-dd');
  });
  const [exporting, setExporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKm, setEditKm] = useState('');
  const [editDate, setEditDate] = useState('');

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ['trips', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('trips')
        .select('*')
        .eq('worker_id', user?.id)
        .order('started_at', { ascending: false });
      return (data || []) as Trip[];
    },
    enabled: !!user?.id,
  });

  const computedKm = useMemo(() => {
    const v = parseFloat(distanceKm.replace(',', '.'));
    return isNaN(v) || v <= 0 ? 0 : v;
  }, [distanceKm]);

  const previewDuration = useMemo(() => {
    const startMs = new Date(`${date}T${timeStart}:00`).getTime();
    const endMs = new Date(`${date}T${timeEnd}:00`).getTime();
    if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) return null;
    return formatDuration(Math.floor((endMs - startMs) / 1000));
  }, [date, timeStart, timeEnd]);

  const filteredTrips = useMemo(() => {
    if (periodMode === 'all') return trips;
    if (periodMode === 'range') {
      const startMs = rangeFrom ? new Date(`${rangeFrom}T00:00:00`).getTime() : 0;
      const endMs = rangeTo ? new Date(`${rangeTo}T23:59:59.999`).getTime() : Infinity;
      return trips.filter((t) => {
        const ts = new Date(t.started_at).getTime();
        return ts >= startMs && ts <= endMs;
      });
    }
    const [y, m] = monthValue.split('-').map(Number);
    const start = startOfMonth(new Date(y, (m || 1) - 1, 1)).getTime();
    const end = endOfMonth(new Date(y, (m || 1) - 1, 1));
    end.setHours(23, 59, 59, 999);
    const endMs = end.getTime();
    return trips.filter((t) => {
      const ts = new Date(t.started_at).getTime();
      return ts >= start && ts <= endMs;
    });
  }, [trips, periodMode, monthValue, rangeFrom, rangeTo]);

  const totalKm = useMemo(
    () => filteredTrips.reduce((s, t) => s + (t.total_distance_m || 0) / 1000, 0),
    [filteredTrips]
  );
  const totalCompensation = useMemo(
    () => filteredTrips.reduce((s, t) => s + (t.compensation_uzs || 0), 0),
    [filteredTrips]
  );

  const monthLabel = useMemo(() => {
    if (periodMode === 'all') return 'За всё время';
    if (periodMode === 'range') {
      const f = rangeFrom ? format(new Date(`${rangeFrom}T00:00:00`), 'dd.MM.yyyy') : '...';
      const t = rangeTo ? format(new Date(`${rangeTo}T00:00:00`), 'dd.MM.yyyy') : '...';
      return `${f} — ${t}`;
    }
    const [y, m] = monthValue.split('-').map(Number);
    return format(new Date(y, (m || 1) - 1, 1), 'LLLL yyyy', { locale: ru });
  }, [periodMode, monthValue, rangeFrom, rangeTo]);

  const shiftMonth = (delta: number) => {
    const [y, m] = monthValue.split('-').map(Number);
    const next = delta > 0 ? addMonths(new Date(y, m - 1, 1), 1) : subMonths(new Date(y, m - 1, 1), 1);
    setMonthValue(format(next, 'yyyy-MM'));
    setPeriodMode('month');
  };

  const addQuickKm = (delta: number) => {
    const cur = parseFloat(distanceKm.replace(',', '.')) || 0;
    setDistanceKm(String(Math.round((cur + delta) * 10) / 10));
  };

  const loadStopsFromDayVisits = async () => {
    if (!user?.id) return;
    setLoadingVisits(true);
    try {
      const dayStart = new Date(`${date}T00:00:00`).toISOString();
      const dayEnd = new Date(`${date}T23:59:59.999`).toISOString();
      const { data } = await supabase
        .from('visits')
        .select('point_id, visited_at, point:points(*)')
        .eq('worker_id', user.id)
        .gte('visited_at', dayStart)
        .lte('visited_at', dayEnd)
        .order('visited_at', { ascending: true });

      const seen = new Set<string>();
      const found: Point[] = [];
      for (const row of (data || []) as unknown as Visit[]) {
        const pt = row.point || points.find((p) => p.id === row.point_id);
        if (pt && !seen.has(pt.id)) {
          seen.add(pt.id);
          found.push(pt);
        }
      }
      if (found.length === 0) {
        alert('За выбранную дату отчётов о визитах ещё нет. Вы можете добавить точки вручную.');
      } else {
        setSelectedStops(found);
      }
    } finally {
      setLoadingVisits(false);
    }
  };

  const handleSaveForm = async () => {
    if (!user || computedKm <= 0) return;
    setSaving(true);

    const distM = Math.round(computedKm * 1000);
    const compensation = Math.round(computedKm * COST_PER_KM);
    const startedAt = new Date(`${date}T${timeStart}:00`).toISOString();
    const endedAt = new Date(`${date}T${timeEnd}:00`).toISOString();
    const durationS = Math.max(0, Math.floor((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000));

    const { data: inserted, error } = await supabase
      .from('trips')
      .insert({
        worker_id: user.id,
        status: 'completed',
        started_at: startedAt,
        ended_at: endedAt,
        total_distance_m: distM,
        total_duration_s: durationS,
        compensation_uzs: compensation,
      })
      .select('id')
      .single();

    setSaving(false);
    if (error) {
      alert(`Ошибка сохранения: ${error.message}`);
    } else {
      if (inserted?.id && selectedStops.length > 0) {
        saveTripRoute(inserted.id, {
          pointIds: selectedStops.map((p) => p.id),
          returnHome,
        });
      }
      setDistanceKm('');
      setSelectedStops([]);
      setMonthValue(date.slice(0, 7));
      setPeriodMode('month');
      setActiveTab('list');
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    }
  };

  const startEdit = (trip: Trip) => {
    setEditingId(trip.id);
    setEditKm((trip.total_distance_m / 1000).toFixed(1));
    const d = trip.started_at ? new Date(trip.started_at) : new Date();
    setEditDate(format(d, 'yyyy-MM-dd'));
  };

  const saveEdit = async (trip: Trip) => {
    const km = parseFloat(editKm.replace(',', '.'));
    if (isNaN(km) || km < 0) return;

    let startedAt = trip.started_at;
    if (editDate) {
      const existingTime = trip.started_at ? trip.started_at.split('T')[1] : '08:00:00.000Z';
      startedAt = `${editDate}T${existingTime}`;
    }

    const { error } = await supabase
      .from('trips')
      .update({
        started_at: startedAt,
        total_distance_m: Math.round(km * 1000),
        compensation_uzs: Math.round(km * COST_PER_KM),
      })
      .eq('id', trip.id);

    if (error) alert(`Ошибка: ${error.message}`);
    else {
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    }
  };

  const handleDeleteTrip = async (tripId: string) => {
    if (!window.confirm('Удалить эту поездку?')) return;
    try {
      const { error } = await supabase.from('trips').delete().eq('id', tripId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    } catch (err: unknown) {
      alert(`Ошибка: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleExportExcel = async () => {
    if (filteredTrips.length === 0) return;
    setExporting(true);
    try {
      let visits: Visit[] = [];
      if (user?.id) {
        const { data } = await supabase
          .from('visits')
          .select('*, point:points(*)')
          .eq('worker_id', user.id)
          .order('visited_at', { ascending: true });
        visits = (data || []) as Visit[];
      }

      const fileSuffix =
        periodMode === 'month'
          ? monthValue
          : periodMode === 'range'
          ? `${rangeFrom}_${rangeTo}`
          : 'barchasi';

      await exportTripsToStyledExcel({
        trips: filteredTrips,
        visits,
        points,
        periodLabel: monthLabel,
        fileName: `Safarlar_hisoboti_${fileSuffix}.xlsx`,
        workerName: user?.full_name,
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 bg-gray-50 flex flex-col overflow-hidden">
      {/* Compact Sticky Header */}
      <div className="bg-white border-b border-gray-200 pt-3 px-4 pb-3 shrink-0">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">Поездки и пробег</h2>
            <button
              type="button"
              onClick={() => setShowHomeModal(true)}
              className="text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
              title="Настроить адрес и координаты дома для Excel-отчёта"
            >
              <Home size={13} /> {homeBase.name}
            </button>
          </div>

          {/* Segmented Control */}
          <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200/60">
            <button
              onClick={() => setActiveTab('new')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'new'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Plus size={16} /> Новая поездка
            </button>
            <button
              onClick={() => setActiveTab('list')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'list'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <List size={16} /> Мои поездки
              {trips.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-bold">
                  {trips.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 pb-24 md:pb-8">
          {activeTab === 'new' && (
            <div className="space-y-4">
              <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                {/* Date */}
                <div className="min-w-0">
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    Дата поездки
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full min-w-0 max-w-full px-3.5 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>

                {/* Time range + Duration badge */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      Время в пути
                    </label>
                    {previewDuration && (
                      <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Clock size={11} /> {previewDuration}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="min-w-0">
                      <span className="block text-[10px] text-gray-400 mb-1">Выезд</span>
                      <input
                        type="time"
                        value={timeStart}
                        onChange={(e) => setTimeStart(e.target.value)}
                        className="w-full min-w-0 max-w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[10px] text-gray-400 mb-1">Прибытие</span>
                      <input
                        type="time"
                        value={timeEnd}
                        onChange={(e) => setTimeEnd(e.target.value)}
                        className="w-full min-w-0 max-w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Multi-stop route builder for Excel */}
                <div className="pt-1">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      Точки за день (для Excel)
                    </label>
                    <button
                      type="button"
                      onClick={loadStopsFromDayVisits}
                      disabled={loadingVisits}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles size={12} /> {loadingVisits ? 'Поиск...' : 'Из визитов'}
                    </button>
                  </div>

                  {/* Route Chain Pills */}
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200/80 space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded-lg font-semibold text-gray-700">
                        <Home size={11} className="text-blue-600" /> {homeBase.name}
                      </span>

                      {selectedStops.map((pt, idx) => (
                        <span
                          key={`${pt.id}-${idx}`}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded-lg font-semibold text-blue-800 max-w-full"
                        >
                          <span className="text-[10px] text-blue-500">{idx + 1}.</span>
                          <span className="truncate max-w-[160px]">{pt.name}</span>
                          <button
                            type="button"
                            onClick={() => setSelectedStops((prev) => prev.filter((_, i) => i !== idx))}
                            className="p-0.5 hover:bg-blue-100 rounded text-blue-500 cursor-pointer"
                          >
                            <X size={11} />
                          </button>
                        </span>
                      ))}

                      {returnHome && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded-lg font-semibold text-gray-700">
                          → <Home size={11} className="text-blue-600" /> {homeBase.name}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowPointPicker(true)}
                        className="px-3 py-1.5 bg-white border border-blue-200 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-50 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={13} /> Добавить точку
                      </button>

                      <label className="flex items-center gap-1.5 text-[11px] text-gray-600 font-medium cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={returnHome}
                          onChange={(e) => setReturnHome(e.target.checked)}
                          className="rounded border-gray-300 text-blue-600"
                        />
                        Возврат домой
                      </label>
                    </div>
                  </div>
                </div>

                {/* Distance (direct km only — odometer removed) */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    Общее расстояние (км)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Ruler size={18} className="text-gray-400" />
                    </div>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={distanceKm}
                      onChange={(e) => setDistanceKm(e.target.value)}
                      placeholder="0.0"
                      step="0.1"
                      min="0"
                      className="w-full pl-11 pr-12 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-xl font-bold text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                    <span className="absolute inset-y-0 right-4 flex items-center text-sm font-semibold text-gray-400">
                      км
                    </span>
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    {[10, 25, 50, 100].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => addQuickKm(v)}
                        className="flex-1 py-1.5 bg-gray-100 hover:bg-blue-50 hover:text-blue-700 active:scale-95 text-gray-600 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                      >
                        +{v} км
                      </button>
                    ))}
                  </div>

                  {computedKm > 0 && (
                    <div className="mt-3 p-3.5 bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl border border-emerald-200/80 flex items-center justify-between">
                      <div>
                        <div className="text-[11px] font-medium text-emerald-700">Итого компенсация</div>
                        <div className="text-[11px] text-emerald-600/80">{computedKm} км</div>
                      </div>
                      <span className="text-lg font-extrabold text-emerald-700">
                        {Math.round(computedKm * COST_PER_KM).toLocaleString('ru-RU')} сум
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handleSaveForm}
                disabled={saving || computedKm <= 0}
                className="w-full min-h-[52px] py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-sm hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {saving ? 'Сохранение...' : (
                  <>
                    <Check size={18} strokeWidth={3} />
                    Сохранить поездку
                  </>
                )}
              </button>
            </div>
          )}

          {activeTab === 'list' && (
            <div className="space-y-4">
              {/* Period Filter (Month / Exact Date Range / All) & Excel Export */}
              <div className="bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1">
                    {([
                      { id: 'month', label: 'Месяц' },
                      { id: 'range', label: 'Даты' },
                      { id: 'all', label: 'Все' },
                    ] as const).map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setPeriodMode(tab.id)}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
                          periodMode === tab.id
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {tab.id === 'range' && <Calendar size={12} />}
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleExportExcel}
                    disabled={exporting || filteredTrips.length === 0}
                    className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[11px] font-semibold hover:bg-emerald-700 disabled:opacity-40 flex items-center gap-1 cursor-pointer shadow-sm"
                  >
                    <Download size={13} /> {exporting ? 'Расчёт...' : 'Excel'}
                  </button>
                </div>

                {periodMode === 'month' && (
                  <div className="flex items-center justify-between bg-gray-50 rounded-lg px-1 py-0.5">
                    <button
                      onClick={() => shiftMonth(-1)}
                      className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-600 active:scale-95 cursor-pointer"
                      title="Предыдущий месяц"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs font-bold text-gray-800 capitalize">{monthLabel}</span>
                    <button
                      onClick={() => shiftMonth(1)}
                      className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-600 active:scale-95 cursor-pointer"
                      title="Следующий месяц"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}

                {periodMode === 'range' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="min-w-0">
                      <span className="block text-[10px] text-gray-400 mb-0.5">С даты</span>
                      <input
                        type="date"
                        value={rangeFrom}
                        onChange={(e) => setRangeFrom(e.target.value)}
                        className="w-full min-w-0 max-w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[10px] text-gray-400 mb-0.5">По дату</span>
                      <input
                        type="date"
                        value={rangeTo}
                        onChange={(e) => setRangeTo(e.target.value)}
                        className="w-full min-w-0 max-w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Compensation Stats Card */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
                <div className="absolute -top-2 -right-2 p-4 opacity-10">
                  <Route size={84} />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-white/10 rounded-lg">
                      <Wallet size={16} className="text-blue-300" />
                    </div>
                    <span className="text-[11px] font-semibold text-blue-100 uppercase tracking-wider">
                      Компенсация • {monthLabel}
                    </span>
                  </div>
                  <div className="text-3xl font-extrabold tracking-tight">
                    {totalCompensation.toLocaleString('ru-RU')}{' '}
                    <span className="text-base text-blue-300 font-semibold">сум</span>
                  </div>
                  <div className="flex items-center gap-2 mt-3 text-xs text-slate-200 font-medium">
                    <span className="bg-white/10 px-2.5 py-1 rounded-lg">{totalKm.toFixed(1)} км</span>
                    <span className="bg-white/10 px-2.5 py-1 rounded-lg">{filteredTrips.length} поездок</span>
                  </div>
                </div>
              </div>

              {/* Trips List */}
              {isLoading ? (
                <div className="text-center text-gray-400 py-12 text-sm">Загрузка...</div>
              ) : filteredTrips.length === 0 ? (
                <div className="text-center text-gray-400 py-12 bg-white rounded-2xl border border-gray-100">
                  <MapPin size={32} className="mx-auto mb-2 opacity-30 text-gray-500" />
                  <p className="font-medium text-sm">Нет поездок за выбранный период</p>
                  <button
                    onClick={() => setActiveTab('new')}
                    className="mt-3 text-blue-600 text-xs font-semibold hover:underline cursor-pointer"
                  >
                    + Добавить поездку
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredTrips.map((trip) => {
                    const km = ((trip.total_distance_m || 0) / 1000).toFixed(1);
                    const isEditing = editingId === trip.id;
                    const startStr = format(new Date(trip.started_at), 'HH:mm');
                    const endStr = trip.ended_at ? format(new Date(trip.ended_at), 'HH:mm') : null;
                    const durStr = formatDuration(trip.total_duration_s);

                    return (
                      <div
                        key={trip.id}
                        className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                      >
                        <div className="p-3.5 sm:p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-bold text-gray-900">
                                {format(new Date(trip.started_at), 'd MMMM yyyy', { locale: ru })}
                              </div>
                              <div className="text-[11px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                                <Clock size={11} />
                                <span>
                                  {startStr}
                                  {endStr ? ` – ${endStr}` : ''}
                                  {durStr ? ` • ${durStr}` : ''}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700">
                                  <Ruler size={11} /> {km} км
                                </span>
                                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700">
                                  {(trip.compensation_uzs || 0).toLocaleString('ru-RU')} сум
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => (isEditing ? setEditingId(null) : startEdit(trip))}
                                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                                  isEditing
                                    ? 'bg-blue-100 text-blue-600'
                                    : 'bg-gray-50 text-gray-400 hover:bg-blue-50 hover:text-blue-600'
                                }`}
                                title="Изменить"
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                onClick={() => handleDeleteTrip(trip.id)}
                                className="w-9 h-9 rounded-xl flex items-center justify-center bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                                title="Удалить"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>

                          {/* Inline Edit Form */}
                          {isEditing && (
                            <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                              <div className="grid grid-cols-2 gap-2.5">
                                <div className="min-w-0">
                                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                                    Дата
                                  </label>
                                  <input
                                    type="date"
                                    value={editDate}
                                    onChange={(e) => setEditDate(e.target.value)}
                                    className="w-full min-w-0 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium outline-none focus:border-blue-500"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                                    Пробег (км)
                                  </label>
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    value={editKm}
                                    onChange={(e) => setEditKm(e.target.value)}
                                    step="0.1"
                                    min="0"
                                    className="w-full min-w-0 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-blue-700 outline-none focus:border-blue-500"
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => saveEdit(trip)}
                                  className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 cursor-pointer"
                                >
                                  Сохранить
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-200 cursor-pointer"
                                >
                                  Отмена
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Home Base Modal */}
      {showHomeModal && (
        <HomeBaseModal
          home={homeBase}
          onSave={setHomeBase}
          onClose={() => setShowHomeModal(false)}
        />
      )}

      {/* Multi-stop Map Point Picker */}
      {showPointPicker && (
        <MapPointPicker
          onSelect={(pt) => {
            setSelectedStops((prev) => [...prev, pt]);
            setShowPointPicker(false);
          }}
          onClose={() => setShowPointPicker(false)}
        />
      )}
    </div>
  );
}
