import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import type { Point, Trip, TripPoint, PointStatus } from '../../types';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { formatDistance } from '../../lib/geo';
import { useState } from 'react';
import { ChevronDown, ChevronUp, Route, MapPin, Ruler, Wallet } from 'lucide-react';

const statusColors: Record<PointStatus, string> = {
  working: '#16a34a',
  not_working: '#dc2626',
  unknown: '#6b7280',
};

function createIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="width:24px;height:24px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
    iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -14],
  });
}

function TripRouteInline({ tripId }: { tripId: string }) {
  const { data: points = [] } = useQuery({
    queryKey: ['trip-points', tripId],
    queryFn: async () => {
      const { data } = await supabase.from('trip_points').select('*').eq('trip_id', tripId).order('recorded_at');
      return (data || []) as TripPoint[];
    },
  });

  if (points.length < 2) return null;
  const positions: [number, number][] = points.map((p) => [p.latitude, p.longitude]);
  const bounds = L.latLngBounds(positions);

  return (
    <div className="h-32 rounded-xl overflow-hidden border border-gray-200 mt-3">
      <MapContainer bounds={bounds} boundsOptions={{ padding: [15, 15] }} className="h-full w-full" zoomControl={false} attributionControl={false} dragging={false} scrollWheelZoom={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Polyline positions={positions} color="#2563eb" weight={3} opacity={0.7} />
      </MapContainer>
    </div>
  );
}

export function ManagerDashboard() {
  const [expandedTrip, setExpandedTrip] = useState<string | null>(null);

  const { data: points = [] } = useQuery({
    queryKey: ['points'],
    queryFn: async () => {
      const { data } = await supabase.from('points').select('*').order('name');
      return (data || []) as Point[];
    },
  });

  const { data: trips = [] } = useQuery({
    queryKey: ['trips-all'],
    queryFn: async () => {
      const { data } = await supabase
        .from('trips')
        .select('*, worker:profiles(full_name)')
        .order('started_at', { ascending: false })
        .limit(50);
      return (data || []) as (Trip & { worker?: { full_name: string } })[];
    },
  });

  const totalKm = trips.reduce((sum, t) => sum + (t.total_distance_m || 0), 0) / 1000;
  const totalCompensation = trips.reduce((sum, t) => sum + (t.compensation_uzs || 0), 0);
  const workingCount = points.filter((p) => p.status === 'working').length;
  const notWorkingCount = points.filter((p) => p.status === 'not_working').length;

  const center: [number, number] = [41.2995, 69.2401];

  return (
    <div className="flex-1 bg-gray-50 overflow-y-auto">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 p-4">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Ruler size={16} className="text-blue-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{totalKm.toFixed(1)} км</div>
          <div className="text-xs text-gray-500 mt-0.5">Всего пути</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <Wallet size={16} className="text-green-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{totalCompensation.toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-0.5">Сум компенсация</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <MapPin size={16} className="text-green-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-green-600">{workingCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">Работают</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
              <MapPin size={16} className="text-red-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-red-600">{notWorkingCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">Не работают</div>
        </div>
      </div>

      {/* Map */}
      <div className="px-4 mb-4">
        <h3 className="font-bold text-sm text-gray-700 mb-2">Карта точек</h3>
        <div className="h-56 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
          <MapContainer center={center} zoom={12} className="h-full w-full" zoomControl={false} attributionControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {points.map((point) => (
              <Marker key={point.id} position={[point.latitude, point.longitude]} icon={createIcon(statusColors[point.status])}>
                <Popup>
                  <div className="min-w-[150px]">
                    <strong className="text-sm">{point.name}</strong>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {point.status === 'working' ? 'Работает' : point.status === 'not_working' ? 'Не работает' : 'Неизвестно'}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>

      {/* Recent Trips */}
      <div className="px-4 pb-6">
        <h3 className="font-bold text-sm text-gray-700 mb-2">Последние поездки</h3>
        <div className="space-y-2">
          {trips.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Route size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Нет поездок</p>
            </div>
          ) : (
            trips.map((trip) => (
              <div key={trip.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpandedTrip(expandedTrip === trip.id ? null : trip.id)}
                  className="w-full p-3.5 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-700">
                        {trip.worker?.full_name?.charAt(0) || '?'}
                      </div>
                      <span className="text-sm font-medium text-gray-900">{trip.worker?.full_name || 'Неизвестный'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 ml-9">
                      <span>{format(new Date(trip.started_at), 'dd MMM, HH:mm', { locale: ru })}</span>
                      <span className="text-blue-600 font-medium">{formatDistance(trip.total_distance_m)}</span>
                      <span className="text-green-600 font-medium">{trip.compensation_uzs?.toLocaleString()} сум</span>
                    </div>
                  </div>
                  {expandedTrip === trip.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </button>

                {expandedTrip === trip.id && (
                  <div className="px-3.5 pb-3.5">
                    <TripRouteInline tripId={trip.id} />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
