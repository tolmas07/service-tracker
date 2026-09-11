import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Plus, List, Ruler, Pencil, Trash2, ChevronDown, ChevronUp, Check, Wallet, Route, MapPin } from 'lucide-react';
import { MapContainer, TileLayer, Polyline, Marker } from 'react-leaflet';
import L from 'leaflet';
import type { Trip, TripPoint } from '../../types';
import { COST_PER_KM } from '../../types';

const startIcon = L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;background:#16a34a;border:2px solid white;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
  iconSize: [16, 16], iconAnchor: [8, 8],
});
const endIcon = L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;background:#dc2626;border:2px solid white;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
  iconSize: [16, 16], iconAnchor: [8, 8],
});

function TripRouteMap({ tripId }: { tripId: string }) {
  const { data: points = [] } = useQuery({
    queryKey: ['trip-points', tripId],
    queryFn: async () => {
      const { data } = await supabase
        .from('trip_points')
        .select('*')
        .eq('trip_id', tripId)
        .order('recorded_at');
      return (data || []) as TripPoint[];
    },
    enabled: !!tripId,
  });

  if (points.length < 2) {
    return (
      <div className="h-32 bg-gray-50 rounded-xl flex items-center justify-center text-xs text-gray-400 border border-dashed border-gray-200">
        Недостаточно данных для маршрута
      </div>
    );
  }

  const positions: [number, number][] = points.map((p) => [p.latitude, p.longitude]);
  const bounds = L.latLngBounds(positions);

  return (
    <div className="h-40 rounded-xl overflow-hidden border border-gray-200 shadow-inner">
      <MapContainer
        bounds={bounds}
        boundsOptions={{ padding: [20, 20] }}
        className="h-full w-full"
        zoomControl={false}
        attributionControl={false}
        dragging={false}
        scrollWheelZoom={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Polyline positions={positions} color="#3b82f6" weight={4} opacity={0.8} />
        <Marker position={positions[0]} icon={startIcon} />
        <Marker position={positions[positions.length - 1]} icon={endIcon} />
      </MapContainer>
    </div>
  );
}

export function ManualTripForm() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'new' | 'list'>('new');

  // Form State
  const today = new Date();
  const [date, setDate] = useState(today.toISOString().split('T')[0]);
  const [timeStart, setTimeStart] = useState('08:00');
  const [timeEnd, setTimeEnd] = useState(today.toTimeString().slice(0, 5));
  const [distanceKm, setDistanceKm] = useState('');
  const [saving, setSaving] = useState(false);

  // List State
  const [expandedTrip, setExpandedTrip] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKm, setEditKm] = useState('');
  const [editDate, setEditDate] = useState('');

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ['trips'],
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

  const totalKm = trips.reduce((s, t) => s + (t.total_distance_m || 0) / 1000, 0);
  const totalCompensation = trips.reduce((s, t) => s + (t.compensation_uzs || 0), 0);

  const handleSaveForm = async () => {
    if (!user || !distanceKm) return;
    setSaving(true);

    const distM = parseFloat(distanceKm) * 1000;
    const compensation = Math.round(parseFloat(distanceKm) * COST_PER_KM);
    const startedAt = new Date(`${date}T${timeStart}:00`).toISOString();
    const endedAt = new Date(`${date}T${timeEnd}:00`).toISOString();
    const durationS = Math.max(0, Math.floor((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000));

    const { error } = await supabase.from('trips').insert({
      worker_id: user.id,
      status: 'completed',
      started_at: startedAt,
      ended_at: endedAt,
      total_distance_m: distM,
      total_duration_s: durationS,
      compensation_uzs: compensation,
    });

    setSaving(false);
    if (!error) {
      setDistanceKm('');
      setActiveTab('list');
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    }
  };

  const startEdit = (trip: Trip) => {
    setEditingId(trip.id);
    setEditKm((trip.total_distance_m / 1000).toFixed(1));
    const d = trip.started_at ? new Date(trip.started_at) : new Date();
    setEditDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  };

  const saveEdit = async (trip: Trip) => {
    const km = parseFloat(editKm);
    if (isNaN(km) || km < 0) return;
    
    let startedAt = trip.started_at;
    if (editDate) {
      const existingTime = trip.started_at ? trip.started_at.split('T')[1] : '08:00:00.000Z';
      startedAt = `${editDate}T${existingTime}`;
    }

    const { error } = await supabase.from('trips').update({
      started_at: startedAt,
      total_distance_m: km * 1000,
      compensation_uzs: Math.round(km * COST_PER_KM),
    }).eq('id', trip.id);

    if (error) alert(`Ошибка: ${error.message}`);
    else {
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    }
  };

  const handleDeleteTrip = async (tripId: string) => {
    if (!window.confirm('Вы уверены, что хотите удалить эту поездку?')) return;
    try {
      const { error } = await supabase.from('trips').delete().eq('id', tripId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    } catch (err: unknown) {
      alert(`Ошибка: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="flex-1 min-h-0 bg-gray-50 dark:bg-zinc-950 flex flex-col overflow-hidden transition-colors duration-200">
      <div className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 pt-3 px-4 pb-0 shrink-0 transition-colors">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100 mb-4">Маршрут и пробег</h2>
        
        <div className="flex bg-gray-100/80 dark:bg-zinc-800/50 p-1 rounded-xl mb-4 shadow-inner border border-gray-200/50 dark:border-zinc-700/50">
          <button
            onClick={() => setActiveTab('new')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
              activeTab === 'new' 
                ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'
            }`}
          >
            <Plus size={16} /> Новая поездка
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
              activeTab === 'list' 
                ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'
            }`}
          >
            <List size={16} /> Мои поездки
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === 'new' && (
          <div className="p-4 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 space-y-5 transition-colors">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-2">Дата поездки</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl text-sm focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-2">Выезд</label>
                  <input
                    type="time"
                    value={timeStart}
                    onChange={(e) => setTimeStart(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl text-sm focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-2">Прибытие</label>
                  <input
                    type="time"
                    value={timeEnd}
                    onChange={(e) => setTimeEnd(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl text-sm focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-2">Общее расстояние (км)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Ruler size={16} className="text-gray-400 dark:text-zinc-500" />
                  </div>
                  <input
                    type="number"
                    value={distanceKm}
                    onChange={(e) => setDistanceKm(e.target.value)}
                    placeholder="Пример: 47.5"
                    step="0.1"
                    min="0"
                    className="w-full pl-11 pr-4 py-2.5 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl text-sm focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                
                {distanceKm && !isNaN(parseFloat(distanceKm)) && (
                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-100 dark:border-blue-500/20 flex items-center justify-between animate-in fade-in zoom-in-95 duration-200">
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Итого компенсация:</span>
                    <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                      {(parseFloat(distanceKm) * COST_PER_KM).toLocaleString()} сум
                    </span>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleSaveForm}
              disabled={saving || !distanceKm}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              {saving ? 'Сохранение...' : (
                <>
                  <Check size={18} />
                  Сохранить поездку
                </>
              )}
            </button>
          </div>
        )}

        {activeTab === 'list' && (
          <div className="p-4 space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="bg-zinc-900 dark:bg-zinc-800 rounded-2xl p-5 text-zinc-100 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Route size={80} />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-white/10 rounded-lg">
                    <Wallet size={16} className="text-zinc-300" />
                  </div>
                  <span className="text-xs font-medium text-zinc-300 uppercase tracking-wider">Компенсация</span>
                </div>
                <div className="text-2xl font-bold mb-1">
                  {totalCompensation.toLocaleString()} <span className="text-base text-zinc-400 font-medium">UZS</span>
                </div>
                <div className="text-sm text-zinc-400 font-medium flex items-center gap-2 mt-3">
                  <span className="bg-zinc-800/50 dark:bg-zinc-900/50 px-2 py-1 rounded-md">{totalKm.toFixed(1)} км</span>
                  <span className="bg-zinc-800/50 dark:bg-zinc-900/50 px-2 py-1 rounded-md">{trips.length} поездок</span>
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="text-center text-gray-400 dark:text-zinc-500 py-12">Загрузка...</div>
            ) : trips.length === 0 ? (
              <div className="text-center text-gray-400 dark:text-zinc-500 py-12 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800">
                <MapPin size={32} className="mx-auto mb-3 opacity-30 text-gray-500" />
                <p className="font-medium text-sm">У вас еще нет поездок</p>
                <button onClick={() => setActiveTab('new')} className="mt-3 text-blue-600 dark:text-blue-400 text-xs font-medium hover:underline">
                  Добавить первую поездку
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {trips.map((trip) => {
                  const km = (trip.total_distance_m / 1000).toFixed(1);
                  const isEditing = editingId === trip.id;

                  return (
                    <div key={trip.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200/60 dark:border-zinc-800 shadow-sm overflow-hidden transition-colors">
                      <div className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-gray-900 dark:text-zinc-100 mb-1.5">
                              {format(new Date(trip.started_at), 'dd MMMM yyyy', { locale: ru })}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400">
                                <Ruler size={10} /> {km} км
                              </span>
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400">
                                {trip.compensation_uzs?.toLocaleString()} сум
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => (isEditing ? setEditingId(null) : startEdit(trip))}
                              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                                isEditing ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-gray-50 dark:bg-zinc-800 text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400'
                              }`}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteTrip(trip.id)}
                              className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-50 dark:bg-zinc-800 text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                            <button
                              onClick={() => setExpandedTrip(expandedTrip === trip.id ? null : trip.id)}
                              className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-50 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors ml-1"
                            >
                              {expandedTrip === trip.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          </div>
                        </div>

                        {/* Edit Form */}
                        {isEditing && (
                          <div className="mt-4 p-3 bg-gray-50 dark:bg-zinc-950 rounded-xl border border-gray-200 dark:border-zinc-800 animate-in fade-in duration-200">
                            <div className="grid grid-cols-2 gap-3 mb-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Дата</label>
                                <input
                                  type="date"
                                  value={editDate}
                                  onChange={(e) => setEditDate(e.target.value)}
                                  className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-zinc-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Км</label>
                                <input
                                  type="number"
                                  value={editKm}
                                  onChange={(e) => setEditKm(e.target.value)}
                                  step="0.1" min="0"
                                  className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-zinc-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveEdit(trip)}
                                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                              >
                                Сохранить
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
                              >
                                Отмена
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Expanded details */}
                        {expandedTrip === trip.id && (
                          <div className="mt-4 animate-in slide-in-from-top-2 fade-in duration-200">
                            <TripRouteMap tripId={trip.id} />
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
  );
}
