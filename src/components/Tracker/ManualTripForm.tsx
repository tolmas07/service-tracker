import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { usePoints } from '../../hooks/usePoints';
import { ArrowLeft, ArrowRight, ArrowLeftRight, MapPin } from 'lucide-react';
import { COST_PER_KM } from '../../types';

export function ManualTripForm() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { data: points = [] } = usePoints();

  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  const timeStr = today.toTimeString().slice(0, 5);

  const [date, setDate] = useState(dateStr);
  const [timeStart, setTimeStart] = useState('08:00');
  const [timeEnd, setTimeEnd] = useState(timeStr);
  const [pointA, setPointA] = useState('');
  const [pointAName, setPointAName] = useState('');
  const [pointB, setPointB] = useState('');
  const [pointBName, setPointBName] = useState('');
  const [direction, setDirection] = useState<'there' | 'back' | 'roundtrip'>('there');
  const [distanceKm, setDistanceKm] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSelectA = (pointId: string) => {
    setPointA(pointId);
    const p = points.find(pt => pt.id === pointId);
    setPointAName(p ? `${p.name}${p.address ? ` — ${p.address}` : ''}` : '');
  };

  const handleSelectB = (pointId: string) => {
    setPointB(pointId);
    const p = points.find(pt => pt.id === pointId);
    setPointBName(p ? `${p.name}${p.address ? ` — ${p.address}` : ''}` : '');
  };

  const handleSave = async () => {
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
      navigate('/history');
    }
  };

  const directionOptions = [
    { value: 'there' as const, label: 'Туда', icon: ArrowRight },
    { value: 'back' as const, label: 'Обратно', icon: ArrowLeft },
    { value: 'roundtrip' as const, label: 'Туда-обратно', icon: ArrowLeftRight },
  ];

  return (
    <div className="flex-1 min-h-0 bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-center shrink-0">
        <h2 className="text-lg font-bold text-gray-900">Добавить пробег вручную</h2>
      </div>

      {/* Scrollable Fields */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {/* Date */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Дата</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {/* Time range */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Время выезда</label>
            <input
              type="time"
              value={timeStart}
              onChange={(e) => setTimeStart(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Время прибытия</label>
            <input
              type="time"
              value={timeEnd}
              onChange={(e) => setTimeEnd(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Direction */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Направление</label>
          <div className="grid grid-cols-3 gap-2">
            {directionOptions.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setDirection(value)}
                className={`py-2.5 px-2 rounded-xl text-xs font-medium border transition-colors flex flex-col items-center gap-1 ${
                  direction === value
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Point A */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            <MapPin size={12} className="inline text-green-600" /> Откуда (точка А)
          </label>
          <select
            value={pointA}
            onChange={(e) => handleSelectA(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
          >
            <option value="">Выберите точку или оставьте пустым</option>
            {points.map((p) => (
              <option key={p.id} value={p.id}>{p.name}{p.address ? ` — ${p.address}` : ''}</option>
            ))}
          </select>
          <input
            type="text"
            value={pointAName}
            onChange={(e) => setPointAName(e.target.value)}
            placeholder="или введите адрес вручную"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs mt-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-500"
          />
        </div>

        {/* Point B */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            <MapPin size={12} className="inline text-red-600" /> Куда (точка Б)
          </label>
          <select
            value={pointB}
            onChange={(e) => handleSelectB(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
          >
            <option value="">Выберите точку или оставьте пустым</option>
            {points.map((p) => (
              <option key={p.id} value={p.id}>{p.name}{p.address ? ` — ${p.address}` : ''}</option>
            ))}
          </select>
          <input
            type="text"
            value={pointBName}
            onChange={(e) => setPointBName(e.target.value)}
            placeholder="или введите адрес вручную"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs mt-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-500"
          />
        </div>

        {/* Distance */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Расстояние (км) *</label>
          <input
            type="number"
            value={distanceKm}
            onChange={(e) => setDistanceKm(e.target.value)}
            placeholder="Например: 47.5"
            step="0.1"
            min="0"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          {distanceKm && (
            <p className="text-xs text-green-600 mt-1">
              Компенсация: <strong>{(parseFloat(distanceKm) * COST_PER_KM).toLocaleString()} сум</strong>
            </p>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Заметки</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Дополнительная информация"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
      </div>

      {/* Save — docked at bottom */}
      <div className="p-3 bg-white border-t border-gray-200 shrink-0 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <button
          onClick={handleSave}
          disabled={saving || !distanceKm}
          className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors shadow-sm"
        >
          {saving ? 'Сохранение...' : 'Сохранить поездку'}
        </button>
      </div>
    </div>
  );
}
