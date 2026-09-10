import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { usePoints } from '../../hooks/usePoints';
import type { Point } from '../../types';
import { X, Check, Search } from 'lucide-react';

// Fix Leaflet default icon
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const statusColors: Record<string, string> = {
  working: '#16a34a',
  not_working: '#dc2626',
  sent_to_repair: '#f59e0b',
  unknown: '#6b7280',
};

function createIcon(color: string, selected: boolean) {
  return L.divIcon({
    className: '',
    html: `<div style="width:${selected ? 32 : 24}px;height:${selected ? 32 : 24}px;background:${color};border:${selected ? '4px' : '3px'} solid ${selected ? '#2563eb' : 'white'};border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);transition:all 0.15s"></div>`,
    iconSize: selected ? [32, 32] : [24, 24],
    iconAnchor: selected ? [16, 16] : [12, 12],
    popupAnchor: [0, selected ? -18 : -14],
  });
}

function FlyToUser() {
  const map = useMap();
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 13),
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [map]);
  return null;
}

interface MapPointPickerProps {
  onSelect: (point: Point) => void;
  onClose: () => void;
  selectedPointId?: string;
}

export function MapPointPicker({ onSelect, onClose, selectedPointId }: MapPointPickerProps) {
  const { data: points = [] } = usePoints();
  const [search, setSearch] = useState('');

  const filtered = search
    ? points.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.address?.toLowerCase().includes(search.toLowerCase())
      )
    : points;

  // Center on Uzbekistan (Samarkand region)
  const center: [number, number] = [39.65, 66.96];

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shrink-0 shadow-sm">
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
          <X size={20} className="text-gray-600" />
        </button>
        <h2 className="text-base font-bold text-gray-900 flex-1">Выберите точку</h2>
        <span className="text-xs text-gray-400">{filtered.length} точек</span>
      </div>

      {/* Search */}
      <div className="px-4 py-2 bg-white border-b border-gray-100 shrink-0">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по названию или адресу..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <MapContainer
          center={center}
          zoom={8}
          className="h-full w-full"
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FlyToUser />

          {filtered.map((point) => (
            <Marker
              key={point.id}
              position={[point.latitude, point.longitude]}
              icon={createIcon(
                statusColors[point.status] || '#6b7280',
                point.id === selectedPointId
              )}
              eventHandlers={{
                click: () => onSelect(point),
              }}
            >
              <Popup>
                <div className="min-w-[160px]">
                  <p className="font-semibold text-sm">{point.name}</p>
                  {point.address && <p className="text-xs text-gray-500 mt-0.5">{point.address}</p>}
                  <button
                    onClick={() => onSelect(point)}
                    className="mt-2 w-full py-1.5 bg-blue-600 text-white text-xs rounded-lg font-medium flex items-center justify-center gap-1"
                  >
                    <Check size={12} /> Выбрать
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Bottom list (quick select) */}
      {search && filtered.length > 0 && (
        <div className="bg-white border-t border-gray-200 max-h-48 overflow-y-auto shrink-0">
          {filtered.map((point) => (
            <button
              key={point.id}
              onClick={() => onSelect(point)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-50 flex items-center gap-3 transition-colors"
            >
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: statusColors[point.status] || '#6b7280' }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{point.name}</p>
                {point.address && <p className="text-xs text-gray-400 truncate">{point.address}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
