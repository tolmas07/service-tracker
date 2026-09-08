import type { GPSPosition } from '../types';

const EARTH_RADIUS_M = 6_371_008.8;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversine(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

const ACCURACY_THRESHOLD = 50; // meters
const MIN_DISTANCE_M = 5;      // ignore GPS drift
const MAX_SPEED_MPS = 50;      // ~180 km/h impossible

export function isValidPosition(pos: GPSPosition, prev?: GPSPosition): boolean {
  if (pos.accuracy > ACCURACY_THRESHOLD) return false;
  if (pos.speed !== null && pos.speed > MAX_SPEED_MPS) return false;
  if (prev) {
    const dist = haversine(prev, pos);
    if (dist < MIN_DISTANCE_M) return false;
    // Check for impossible jump (time-distance)
    const timeDeltaS = (pos.timestamp - prev.timestamp) / 1000;
    if (timeDeltaS > 0 && dist / timeDeltaS > MAX_SPEED_MPS) return false;
  }
  return true;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} м`;
  return `${(meters / 1000).toFixed(1)} км`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}ч ${m}м`;
  if (m > 0) return `${m}м ${s}с`;
  return `${s}с`;
}

export function formatSpeed(mps: number | null): string {
  if (mps === null) return '—';
  return `${(mps * 3.6).toFixed(0)} км/ч`;
}
