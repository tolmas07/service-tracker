import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { usePoints } from '../../hooks/usePoints';
import type { Point } from '../../types';
import { X, Check, Search, Map as MapIcon, List, MapPin } from 'lucide-react';

const statusColors: Record<string, string> = {
  working: '#16a34a',
  not_working: '#dc2626',
  sent_to_repair: '#f59e0b',
  unknown: '#6b7280',
};

const pickerIconCache = new Map<string, L.DivIcon>();

function getPickerIcon(color: string, selected: boolean) {
  const key = `${color}_${selected ? '1' : '0'}`;
  const cached = pickerIconCache.get(key);
  if (cached) return cached;

  const icon = L.divIcon({
    className: '',
    html: `<div style="width:${selected ? 32 : 26}px;height:${selected ? 32 : 26}px;background:${color};border:${selected ? '4px' : '3px'} solid ${selected ? '#2563eb' : 'white'};border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`,
    iconSize: selected ? [32, 32] : [26, 26],
    iconAnchor: selected ? [16, 16] : [13, 13],
  });
  pickerIconCache.set(key, icon);
  return icon;
}

function MapInitHelper() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 120);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 11),
        () => {},
        { enableHighAccuracy: false, timeout: 4000, maximumAge: 60000 }
      );
    }

    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

interface MapPointPickerProps {
  onSelect: (point: Point) => void;
  onClose: () => void;
  selectedPointId?: string;
}

export function MapPointPicker({ onSelect, onClose, selectedPointId }: MapPointPickerProps) {
  const { data: points = [], isLoading } = usePoints();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [previewPoint, setPreviewPoint] = useState<Point | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return points.filter((p) => {
      if (!q) return true;
      return (
        p.name?.toLowerCase().includes(q) ||
        p.address?.toLowerCase().includes(q)
      );
    });
  }, [points, search]);

  const validMapPoints = useMemo(
    () =>
      filtered.filter(
        (p) =>
          typeof p.latitude === 'number' &&
          typeof p.longitude === 'number' &&
          Number.isFinite(p.latitude) &&
          Number.isFinite(p.longitude)
      ),
    [filtered]
  );

  const center: [number, number] = [39.65, 66.96];

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col bg-white h-[100dvh] w-screen overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-2 shrink-0 shadow-sm safe-top">
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 hover:bg-gray-100 rounded-xl cursor-pointer"
        >
          <X size={20} className="text-gray-600" />
        </button>
        <h2 className="text-base font-bold text-gray-900 flex-1 truncate">Выберите точку</h2>
        <div className="inline-flex bg-gray-100 p-0.5 rounded-lg text-xs font-semibold">
          <button
            type="button"
            onClick={() => setViewMode('map')}
            className={`px-2.5 py-1 rounded-md flex items-center gap-1 cursor-pointer ${
              viewMode === 'map' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            <MapIcon size={13} /> Карта
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`px-2.5 py-1 rounded-md flex items-center gap-1 cursor-pointer ${
              viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            <List size={13} /> Список
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-2 bg-white border-b border-gray-100 shrink-0">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Поиск по названию или адресу..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      {viewMode === 'map' ? (
        <div className="flex-1 min-h-0 relative">
          <MapContainer
            center={center}
            zoom={7}
            className="h-full w-full"
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
            attributionControl={false}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapInitHelper />

            {validMapPoints.map((point) => (
              <Marker
                key={point.id}
                position={[point.latitude, point.longitude]}
                icon={getPickerIcon(
                  statusColors[point.status] || '#6b7280',
                  point.id === selectedPointId || point.id === previewPoint?.id
                )}
                eventHandlers={{
                  click: () => setPreviewPoint(point),
                }}
              />
            ))}
          </MapContainer>

          {/* Bottom confirmation card when a marker is tapped */}
          {previewPoint && (
            <div className="absolute bottom-4 left-4 right-4 z-[1000] bg-white rounded-2xl shadow-2xl border border-gray-200 p-3.5 safe-bottom">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm text-gray-900 leading-tight">{previewPoint.name}</div>
                  {previewPoint.address && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{previewPoint.address}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewPoint(null)}
                  className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => onSelect(previewPoint)}
                className="mt-3 w-full py-2.5 bg-blue-600 text-white text-sm rounded-xl font-bold hover:bg-blue-700 active:scale-[0.98] flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Check size={16} strokeWidth={2.5} /> Выбрать эту точку
              </button>
            </div>
          )}

          {/* Quick search results overlay when typing */}
          {search && filtered.length > 0 && !previewPoint && (
            <div className="absolute bottom-0 left-0 right-0 z-[1000] bg-white border-t border-gray-200 max-h-52 overflow-y-auto shadow-lg">
              {filtered.map((point) => (
                <button
                  type="button"
                  key={point.id}
                  onClick={() => onSelect(point)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-50 flex items-center gap-3 cursor-pointer"
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
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto bg-gray-50 divide-y divide-gray-100">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-gray-400">Загрузка точек...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">Ничего не найдено</div>
          ) : (
            filtered.map((point) => {
              const isSelected = point.id === selectedPointId;
              return (
                <button
                  type="button"
                  key={point.id}
                  onClick={() => onSelect(point)}
                  className={`w-full px-4 py-3.5 text-left flex items-center gap-3 transition-colors cursor-pointer ${
                    isSelected ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  <MapPin
                    size={16}
                    style={{ color: statusColors[point.status] || '#6b7280' }}
                    className="shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{point.name}</p>
                    {point.address && <p className="text-xs text-gray-400 truncate mt-0.5">{point.address}</p>}
                  </div>
                  {isSelected && <Check size={16} className="text-blue-600 shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>,
    document.body
  );
}
