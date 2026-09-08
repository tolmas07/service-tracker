import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, Wrench, MapPin, Route, ChevronDown, ChevronUp, Ruler, Pencil, Check, X, Wallet } from 'lucide-react';
import { MapContainer, TileLayer, Polyline, Marker } from 'react-leaflet';
import L from 'leaflet';
import type { Visit, Trip, TripPoint } from '../../types';
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
      <div className="h-32 bg-gray-100 rounded-xl flex items-center justify-center text-xs text-gray-400">
        Недостаточно данных для маршрута
      </div>
    );
  }

  const positions: [number, number][] = points.map((p) => [p.latitude, p.longitude]);
  const bounds = L.latLngBounds(positions);

  return (
    <div className="h-40 rounded-xl overflow-hidden border border-gray-200">
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
        <Polyline positions={positions} color="#2563eb" weight={4} opacity={0.8} />
        <Marker position={positions[0]} icon={startIcon} />
        <Marker position={positions[positions.length - 1]} icon={endIcon} />
      </MapContainer>
    </div>
  );
}

function TripsTab() {
  const queryClient = useQueryClient();
  const [expandedTrip, setExpandedTrip] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKm, setEditKm] = useState('');

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ['trips'],
    queryFn: async () => {
      const { data } = await supabase
        .from('trips')
        .select('*')
        .order('started_at', { ascending: false });
      return (data || []) as Trip[];
    },
  });

  const totalKm = trips.reduce((s, t) => s + (t.total_distance_m || 0) / 1000, 0);
  const totalCompensation = trips.reduce((s, t) => s + (t.compensation_uzs || 0), 0);

  const startEdit = (trip: Trip) => {
    setEditingId(trip.id);
    setEditKm((trip.total_distance_m / 1000).toFixed(1));
  };

  const saveEdit = async (tripId: string) => {
    const km = parseFloat(editKm);
    if (isNaN(km) || km < 0) return;
    const distM = km * 1000;
    const compensation = Math.round(km * COST_PER_KM);
    await supabase
      .from('trips')
      .update({
        total_distance_m: distM,
        compensation_uzs: compensation,
      })
      .eq('id', tripId);
    setEditingId(null);
    queryClient.invalidateQueries({ queryKey: ['trips'] });
  };

  return (
    <div className="p-3 space-y-2">
      {/* Total compensation summary */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-4 text-white shadow-md">
        <div className="flex items-center gap-2 mb-2">
          <Wallet size={20} />
          <span className="text-sm font-medium opacity-90">Общая компенсация</span>
        </div>
        <div className="text-3xl font-bold">{totalCompensation.toLocaleString()} сум</div>
        <div className="text-sm opacity-75 mt-1">
          Всего: {totalKm.toFixed(1)} км · {trips.length} {trips.length === 1 ? 'поездка' : trips.length < 5 ? 'поездки' : 'поездок'}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center text-gray-400 py-12">Загрузка...</div>
      ) : trips.length === 0 ? (
        <div className="text-center text-gray-400 py-12">
          <Route size={32} className="mx-auto mb-2 opacity-50" />
          <p>Нет поездок</p>
        </div>
      ) : (
        trips.map((trip) => {
          const km = (trip.total_distance_m / 1000).toFixed(1);
          const isEditing = editingId === trip.id;

          return (
            <div key={trip.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Route size={14} className="text-blue-600" />
                      <span className="text-sm font-medium text-gray-900">
                        {format(new Date(trip.started_at), 'dd MMMM yyyy', { locale: ru })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            value={editKm}
                            onChange={(e) => setEditKm(e.target.value)}
                            step="0.1"
                            min="0"
                            className="w-20 px-2 py-1 border border-blue-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-blue-500 outline-none"
                            autoFocus
                          />
                          <span className="text-gray-500">км</span>
                          <button
                            onClick={() => saveEdit(trip.id)}
                            className="p-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="flex items-center gap-1 font-medium text-blue-600">
                            <Ruler size={12} /> {km} км
                          </span>
                          <span className="text-green-600 font-medium">{trip.compensation_uzs?.toLocaleString()} сум</span>
                          <button
                            onClick={() => startEdit(trip)}
                            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Изменить пробег"
                          >
                            <Pencil size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setExpandedTrip(expandedTrip === trip.id ? null : trip.id)}
                    className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg ml-2"
                  >
                    {expandedTrip === trip.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>

                {expandedTrip === trip.id && (
                  <div className="mt-3">
                    <TripRouteMap tripId={trip.id} />
                    <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                      <div className="bg-blue-50 rounded-lg p-2.5">
                        <div className="text-lg font-bold text-blue-700">{km}</div>
                        <div className="text-[10px] text-blue-500">Км</div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-2.5">
                        <div className="text-lg font-bold text-green-700">{trip.compensation_uzs?.toLocaleString()}</div>
                        <div className="text-[10px] text-green-600">Сум</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export function HistoryPage() {
  const [activeTab, setActiveTab] = useState<'visits' | 'trips'>('visits');
  const [filter, setFilter] = useState('');
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

  const filteredVisits = filter
    ? visits.filter((v) =>
        v.work_type?.toLowerCase().includes(filter.toLowerCase()) ||
        v.work_description?.toLowerCase().includes(filter.toLowerCase()) ||
        v.point?.name?.toLowerCase().includes(filter.toLowerCase())
      )
    : visits;

  return (
    <div className="flex-1 bg-gray-50 flex flex-col">
      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 flex">
        <button
          onClick={() => setActiveTab('visits')}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'visits' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Посещения ({visits.length})
        </button>
        <button
          onClick={() => setActiveTab('trips')}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'trips' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Поездки
        </button>
      </div>

      {activeTab === 'visits' && (
        <div className="p-3 bg-white border-b border-gray-100">
          <input
            type="text"
            placeholder="Поиск по точке, типу работ..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'visits' && (
          <>
            <div className="p-3">
              <Link
                to="/visits/new"
                className="block w-full py-3 bg-blue-600 text-white rounded-xl text-center font-medium hover:bg-blue-700 transition-colors shadow-sm"
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
              <div className="px-3 pb-3 space-y-2">
                {filteredVisits.map((visit) => (
                  <div key={visit.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <MapPin size={14} className="text-blue-600 shrink-0" />
                          <span className="font-medium text-sm text-gray-900 truncate">
                            {visit.point?.name || 'Неизвестная точка'}
                          </span>
                        </div>

                        {/* Work types as tags */}
                        <WorkTypeBadges workType={visit.work_type} />

                        {visit.work_description && (
                          <p className="text-xs text-gray-600 mt-1.5 line-clamp-2">{visit.work_description}</p>
                        )}

                        {/* Status badge */}
                        {visit.status_after && (
                          <span className={`inline-block mt-2 text-[11px] px-2 py-0.5 rounded-full font-medium ${statusBadgeClass[visit.status_after] || 'bg-gray-100 text-gray-600'}`}>
                            {statusLabels[visit.status_after] || visit.status_after}
                          </span>
                        )}

                        {visit.notes && (
                          <p className="text-[11px] text-gray-400 mt-1">📝 {visit.notes}</p>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2 ml-3 shrink-0">
                        <div className="text-[11px] text-gray-400 flex items-center gap-1">
                          <Calendar size={12} />
                          {format(new Date(visit.visited_at), 'dd MMM, HH:mm', { locale: ru })}
                        </div>
                        <button
                          onClick={() => navigate(`/visits/${visit.id}/edit`)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Редактировать"
                        >
                          <Pencil size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'trips' && (
          <TripsTab />
        )}
      </div>
    </div>
  );
}
