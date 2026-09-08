export type UserRole = 'worker' | 'manager';
export type PointStatus = 'working' | 'not_working' | 'unknown';
export type TripStatus = 'active' | 'paused' | 'completed' | 'cancelled';
export type PhotoType = 'printer' | 'pc' | 'other';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  created_at: string;
}

export interface Point {
  id: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  status: PointStatus;
  notes?: string;
  worker_id: string;
  created_at: string;
  updated_at: string;
}

export interface Trip {
  id: string;
  worker_id: string;
  status: TripStatus;
  started_at: string;
  ended_at?: string;
  total_distance_m: number;
  total_duration_s: number;
  compensation_uzs: number;
  created_at: string;
}

export interface TripPoint {
  id?: number;
  trip_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  recorded_at: string;
}

export interface Visit {
  id: string;
  point_id: string;
  worker_id: string;
  trip_id?: string;
  visited_at: string;
  work_type: string;           // comma-separated: "Профилактика,Настройка"
  work_description?: string;
  status_before?: PointStatus;
  status_after?: PointStatus | 'sent_to_repair';
  notes?: string;
  created_at: string;
  // Joined
  point?: Point;
}

export interface Photo {
  id: string;
  visit_id: string;
  storage_path: string;
  caption?: string;
  photo_type?: PhotoType;
  created_at: string;
}

export interface GPSPosition {
  lat: number;
  lng: number;
  accuracy: number;
  speed: number | null;
  timestamp: number;
}

export interface TripStats {
  distanceM: number;
  distanceKm: number;
  durationS: number;
  compensationUzs: number;
  avgSpeedKmh: number;
}

export const COST_PER_KM = 1000;
export const WORK_TYPES = [
  'Профилактика',
  'Замена комплектующих',
  'Настройка',
  'Установка ПО',
  'Диагностика',
  'Другое',
] as const;

export const VISIT_STATUSES = [
  { value: 'working', label: 'Работает', color: 'green' },
  { value: 'not_working', label: 'Не работает', color: 'red' },
  { value: 'sent_to_repair', label: 'Отправлен на ремонт', color: 'amber' },
  { value: 'unknown', label: 'Неизвестно', color: 'gray' },
] as const;
