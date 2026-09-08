import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Point, Trip, TripPoint, Visit, PointStatus } from '../../types';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Route, MapPin, Ruler, Wallet, Calendar, Users, BarChart3, ClipboardList } from 'lucide-react';

const statusColors: Record<PointStatus, string> = {
  working: '#16a34a',
  not_working: '#dc2626',
  unknown: '#6b7280',
};

const statusLabels: Record<string, string> = {
  working: 'Работает',
  not_working: 'Не работает',
  sent_to_repair: 'На ремонте',
  unknown: 'Неизвестно',
};

const statusBadge: Record<string, string> = {
  working: 'bg-green-100 text-green-700',
  not_working: 'bg-red-100 text-red-700',
  sent_to_repair: 'bg-amber-100 text-amber-700',
  unknown: 'bg-gray-100 text-gray-600',
};

function createIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="width:24px;height:24px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
    iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -14],
  });
}

// Fit map to markers
function FitBounds({ points }: { points: Point[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map(p => [p.latitude, p.longitude] as [number, number]));
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [points, map]);
  return null;
}

// Trip route map (inline)
function TripRouteMap({ tripId }: { tripId: string }) {
  const { data: points = [], isLoading } = useQuery({
    queryKey: ['trip-points', tripId],
    queryFn: async () => {
      const { data } = await supabase.from('trip_points').select('*').eq('trip_id', tripId).order('recorded_at');
      return (data || []) as TripPoint[];
    },
  });

  if (isLoading) return <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />;
  if (points.length < 2) return <div className="h-24 bg-gray-50 rounded-xl flex items-center justify-center text-xs text-gray-400">Нет данных маршрута</div>;

  const positions: [number, number][] = points.map((p) => [p.latitude, p.longitude]);
  const bounds = L.latLngBounds(positions);
  const startIcon = L.divIcon({ className: '', html: '<div style="width:14px;height:14px;background:#16a34a;border:2px solid white;border-radius:50%"></div>', iconSize: [14, 14], iconAnchor: [7, 7] });
  const endIcon = L.divIcon({ className: '', html: '<div style="width:14px;height:14px;background:#dc2626;border:2px solid white;border-radius:50%"></div>', iconSize: [14, 14], iconAnchor: [7, 7] });

  return (
    <div className="h-36 rounded-xl overflow-hidden border border-gray-200">
      <MapContainer bounds={bounds} boundsOptions={{ padding: [20, 20] }} className="h-full w-full" zoomControl={false} attributionControl={false} dragging={false} scrollWheelZoom={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Polyline positions={positions} color="#2563eb" weight={3} opacity={0.8} />
        <Marker position={positions[0]} icon={startIcon} />
        <Marker position={positions[positions.length - 1]} icon={endIcon} />
      </MapContainer>
    </div>
  );
}

type Tab = 'overview' | 'trips' | 'visits' | 'points';

export function ManagerDashboard() {
  const [selectedWorker, setSelectedWorker] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [expandedTrip, setExpandedTrip] = useState<string | null>(null);
  const [expandedVisit, setExpandedVisit] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Fetch all workers
  const { data: workers = [] } = useQuery({
    queryKey: ['workers'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('role', 'worker').order('full_name');
      return data || [];
    },
  });

  // Fetch points (ALL points always visible — they are shared locations)
  const { data: points = [] } = useQuery({
    queryKey: ['points'],
    queryFn: async () => {
      const { data } = await supabase.from('points').select('*').order('name');
      return (data || []) as Point[];
    },
  });

  // Fetch trips
  const { data: trips = [] } = useQuery({
    queryKey: ['trips', selectedWorker],
    queryFn: async () => {
      let q = supabase.from('trips').select('*, worker:profiles(full_name)').order('started_at', { ascending: false }).limit(100);
      if (selectedWorker !== 'all') q = q.eq('worker_id', selectedWorker);
      const { data } = await q;
      return (data || []) as (Trip & { worker?: { full_name: string } })[];
    },
  });

  // Fetch visits
  const { data: visits = [] } = useQuery({
    queryKey: ['visits-mgr', selectedWorker],
    queryFn: async () => {
      let q = supabase.from('visits').select('*, point:points(name)').order('visited_at', { ascending: false }).limit(100);
      if (selectedWorker !== 'all') q = q.eq('worker_id', selectedWorker);
      const { data } = await q;
      return (data || []) as (Visit & { point?: { name: string } })[];
    },
  });

  // Stats
  const filteredTrips = dateFrom || dateTo
    ? trips.filter(t => {
        const d = new Date(t.started_at);
        if (dateFrom && d < new Date(dateFrom)) return false;
        if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false;
        return true;
      })
    : trips;

  const totalKm = filteredTrips.reduce((s, t) => s + (t.total_distance_m || 0) / 1000, 0);
  const totalCompensation = filteredTrips.reduce((s, t) => s + (t.compensation_uzs || 0), 0);
  const workingCount = points.filter(p => p.status === 'working').length;
  const notWorkingCount = points.filter(p => p.status === 'not_working').length;
  const sentToRepairCount = points.filter(p => p.status === 'sent_to_repair' as string).length;

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'overview', label: 'Обзор', icon: BarChart3 },
    { key: 'trips', label: 'Поездки', icon: Route },
    { key: 'visits', label: 'Посещения', icon: ClipboardList },
    { key: 'points', label: 'Точки', icon: MapPin },
  ];

  return (
    <div className="flex-1 bg-gray-50 flex flex-col overflow-hidden">
      {/* Worker selector */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 shrink-0">
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
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 flex shrink-0 overflow-x-auto">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Overview tab */}
        {activeTab === 'overview' && (
          <div className="p-4 space-y-4">
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={Ruler} color="blue" value={`${totalKm.toFixed(1)} км`} label="Пробег" />
              <StatCard icon={Wallet} color="green" value={`${totalCompensation.toLocaleString()} сум`} label="Компенсация" />
              <StatCard icon={MapPin} color="green" value={String(workingCount)} label="Работают" />
              <StatCard icon={MapPin} color="red" value={String(notWorkingCount)} label="Не работают" />
            </div>

            {/* Map */}
            <div>
              <h3 className="font-bold text-sm text-gray-700 mb-2">Карта точек</h3>
              <div className="h-64 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                <MapContainer center={[39.65, 66.95]} zoom={8} className="h-full w-full" zoomControl={false} attributionControl={false}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <FitBounds points={points} />
                  {points.map(point => (
                    <Marker key={point.id} position={[point.latitude, point.longitude]} icon={createIcon(statusColors[point.status])}>
                      <Popup>
                        <div className="min-w-[150px]">
                          <strong className="text-sm">{point.name}</strong>
                          <p className="text-xs text-gray-500 mt-0.5">{statusLabels[point.status] || point.status}</p>
                          {point.notes && <p className="text-[10px] text-gray-400 mt-1">{point.notes}</p>}
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            </div>

            {/* Recent trips */}
            <div>
              <h3 className="font-bold text-sm text-gray-700 mb-2">Последние поездки</h3>
              <TripList trips={trips.slice(0, 5)} expandedTrip={expandedTrip} setExpandedTrip={setExpandedTrip} />
            </div>
          </div>
        )}

        {/* Trips tab */}
        {activeTab === 'trips' && (
          <div className="p-4 space-y-3">
            {/* Date filter */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[10px] text-gray-400 mb-1">С даты</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs" />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] text-gray-400 mb-1">По дату</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs" />
              </div>
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="self-end px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg">Сброс</button>
              )}
            </div>

            {/* Trip summary */}
            <div className="bg-blue-50 rounded-xl p-3 flex items-center justify-between">
              <span className="text-xs text-blue-700">{filteredTrips.length} поездок</span>
              <span className="text-sm font-bold text-blue-700">{totalKm.toFixed(1)} км · {totalCompensation.toLocaleString()} сум</span>
            </div>

            <TripList trips={filteredTrips} expandedTrip={expandedTrip} setExpandedTrip={setExpandedTrip} />
          </div>
        )}

        {/* Visits tab */}
        {activeTab === 'visits' && (
          <div className="p-4 space-y-3">
            {visits.length === 0 ? (
              <EmptyState icon={ClipboardList} text="Нет посещений" />
            ) : (
              visits.map(visit => (
                <div key={visit.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <button
                    onClick={() => setExpandedVisit(expandedVisit === visit.id ? null : visit.id)}
                    className="w-full p-3.5 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <MapPin size={14} className="text-blue-600 shrink-0" />
                          <span className="text-sm font-medium text-gray-900 truncate">{visit.point?.name || 'Неизвестная точка'}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {visit.work_type.split(',').map((t, i) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-md font-medium">{t.trim()}</span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        {visit.status_after && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusBadge[visit.status_after] || 'bg-gray-100 text-gray-600'}`}>
                            {statusLabels[visit.status_after] || visit.status_after}
                          </span>
                        )}
                        {expandedVisit === visit.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                      </div>
                    </div>
                  </button>

                  {expandedVisit === visit.id && (
                    <div className="px-3.5 pb-3.5 border-t border-gray-100 pt-2">
                      <div className="text-xs text-gray-400 flex items-center gap-1 mb-2">
                        <Calendar size={12} />
                        {format(new Date(visit.visited_at), 'dd MMMM yyyy, HH:mm', { locale: ru })}
                      </div>
                      {visit.work_description && <p className="text-xs text-gray-600 mb-2">{visit.work_description}</p>}
                      {visit.notes && <p className="text-xs text-gray-400">📝 {visit.notes}</p>}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Points tab */}
        {activeTab === 'points' && (
          <div className="p-4 space-y-3">
            {/* Status summary */}
            <div className="flex gap-2 flex-wrap">
              <StatusPill color="green" count={workingCount} label="Работают" />
              <StatusPill color="red" count={notWorkingCount} label="Не работают" />
              <StatusPill color="amber" count={sentToRepairCount} label="На ремонте" />
            </div>

            {/* Sorted: working first, then not_working, then sent_to_repair, then unknown */}
            {[...points]
              .sort((a, b) => {
                const order: Record<string, number> = { working: 0, not_working: 1, sent_to_repair: 2, unknown: 3 };
                return (order[a.status] ?? 9) - (order[b.status] ?? 9);
              })
              .map(point => (
              <div key={point.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3.5 flex items-center gap-3">
                <div className="w-4 h-4 rounded-full shrink-0" style={{ background: statusColors[point.status] || '#6b7280' }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{point.name}</div>
                  {point.address && <div className="text-[11px] text-gray-400 truncate">{point.address}</div>}
                  {point.notes && <div className="text-[10px] text-gray-400 truncate mt-0.5">{point.notes}</div>}
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${statusBadge[point.status] || 'bg-gray-100 text-gray-600'}`}>
                  {statusLabels[point.status] || point.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper components
function StatCard({ icon: Icon, color, value, label }: { icon: React.ElementType; color: string; value: string; label: string }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
      <div className={`w-8 h-8 bg-${color}-100 rounded-lg flex items-center justify-center mb-2`}>
        <Icon size={16} className={`text-${color}-600`} />
      </div>
      <div className="text-lg font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

function StatusPill({ color, count, label }: { color: string; count: number; label: string }) {
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium bg-${color}-100 text-${color}-700`}>
      {count} {label}
    </span>
  );
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="text-center py-12 text-gray-400">
      <Icon size={32} className="mx-auto mb-2 opacity-50" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

function TripList({ trips, expandedTrip, setExpandedTrip }: { trips: (Trip & { worker?: { full_name: string } })[]; expandedTrip: string | null; setExpandedTrip: (id: string | null) => void }) {
  if (trips.length === 0) return <EmptyState icon={Route} text="Нет поездок" />;

  return (
    <div className="space-y-2">
      {trips.map(trip => (
        <div key={trip.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            onClick={() => setExpandedTrip(expandedTrip === trip.id ? null : trip.id)}
            className="w-full p-3.5 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-[10px] font-bold text-blue-700">
                    {trip.worker?.full_name?.charAt(0) || '?'}
                  </div>
                  <span className="text-sm font-medium text-gray-900">{trip.worker?.full_name || 'Неизвестный'}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 ml-8">
                  <span>{format(new Date(trip.started_at), 'dd MMM yyyy', { locale: ru })}</span>
                  <span className="text-blue-600 font-medium">{(trip.total_distance_m / 1000).toFixed(1)} км</span>
                  <span className="text-green-600 font-medium">{(trip.compensation_uzs || 0).toLocaleString()} сум</span>
                </div>
              </div>
              {expandedTrip === trip.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
            </div>
          </button>

          {expandedTrip === trip.id && (
            <div className="px-3.5 pb-3.5">
              <TripRouteMap tripId={trip.id} />
              <div className="mt-2 grid grid-cols-2 gap-2 text-center">
                <div className="bg-blue-50 rounded-lg p-2">
                  <div className="text-sm font-bold text-blue-700">{(trip.total_distance_m / 1000).toFixed(1)}</div>
                  <div className="text-[10px] text-blue-500">Км</div>
                </div>
                <div className="bg-green-50 rounded-lg p-2">
                  <div className="text-sm font-bold text-green-700">{(trip.compensation_uzs || 0).toLocaleString()}</div>
                  <div className="text-[10px] text-green-600">Сум</div>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
