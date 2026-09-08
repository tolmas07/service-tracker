import { useEffect, useRef, useCallback } from 'react';
import { useGpsStore } from '../stores/gpsStore';
import { isValidPosition } from '../lib/geo';
import { supabase } from '../lib/supabase';
import type { GPSPosition } from '../types';

const WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
};

const BATCH_INTERVAL_MS = 10000; // Send to server every 10s

export function useGPSTracker() {
  const {
    isTracking,
    currentTripId,
    positions,
    addPosition,
    setCurrentPosition,
    updateElapsed,
  } = useGpsStore();

  const bufferRef = useRef<GPSPosition[]>([]);
  const watchIdRef = useRef<number | null>(null);
  const batchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const flushBuffer = useCallback(async () => {
    if (!currentTripId || bufferRef.current.length === 0) return;
    const batch = bufferRef.current.splice(0);
    try {
      await supabase.from('trip_points').insert(
        batch.map((p) => ({
          trip_id: currentTripId,
          latitude: p.lat,
          longitude: p.lng,
          accuracy: p.accuracy,
          speed: p.speed,
          recorded_at: new Date(p.timestamp).toISOString(),
        }))
      );
    } catch {
      // Re-add to buffer on failure
      bufferRef.current.unshift(...batch);
    }
  }, [currentTripId]);

  useEffect(() => {
    if (!isTracking) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (batchTimerRef.current) clearInterval(batchTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      flushBuffer(); // Final flush
      return;
    }

    // Start watching GPS
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const pos: GPSPosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          timestamp: position.timestamp,
        };

        if (!isValidPosition(pos, positions[positions.length - 1])) return;

        addPosition(pos);
        setCurrentPosition(pos);
        bufferRef.current.push(pos);
      },
      (error) => {
        console.error('GPS Error:', error.message);
      },
      WATCH_OPTIONS
    );

    // Batch upload timer
    batchTimerRef.current = setInterval(flushBuffer, BATCH_INTERVAL_MS);

    // Elapsed time updater
    elapsedTimerRef.current = setInterval(updateElapsed, 1000);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (batchTimerRef.current) clearInterval(batchTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, [isTracking, addPosition, setCurrentPosition, updateElapsed, flushBuffer, positions]);

  return { isTracking, currentTripId };
}
