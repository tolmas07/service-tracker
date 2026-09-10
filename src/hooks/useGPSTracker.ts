import { useEffect, useRef, useCallback } from 'react';
import { useGpsStore } from '../stores/gpsStore';
import { supabase } from '../lib/supabase';
import { isValidPosition } from '../lib/geo';
import { persistPoint, getUnsyncedPoints, markSynced } from '../lib/idb';
import { registerPlugin } from '@capacitor/core';
import type { GPSPosition } from '../types';

// Background Geolocation types
interface WatcherOptions {
  backgroundMessage?: string;
  backgroundTitle?: string;
  requestPermissions?: boolean;
  stale?: boolean;
  distanceFilter?: number;
}
interface Location { latitude: number; longitude: number; accuracy?: number; speed?: number; time?: number; }
interface CallbackError { code: string; message: string; }
interface BackgroundGeolocationPlugin {
  addWatcher(options: WatcherOptions, callback: (position?: Location, error?: CallbackError) => void): Promise<string>;
  removeWatcher(options: { id: string }): Promise<void>;
}

// Register the native plugin (only works in Capacitor native shell)
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

function isNativeApp(): boolean {
  return !!(window as unknown as Record<string, unknown>).Capacitor;
}

const BATCH_INTERVAL_MS = 10000;
const BATCH_SIZE = 50;

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
  const batchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watcherRef = useRef<string | number | null>(null);

  const flushBuffer = useCallback(async () => {
    if (!currentTripId || bufferRef.current.length === 0) return;
    const batch = bufferRef.current.splice(0, BATCH_SIZE);

    // Save to IndexedDB first (survives crash)
    for (const p of batch) {
      await persistPoint({
        tripId: currentTripId,
        lat: p.lat,
        lng: p.lng,
        accuracy: p.accuracy,
        speed: p.speed,
        timestamp: p.timestamp,
      });
    }

    // Try to sync to Supabase
    try {
      // Ensure trip exists in Supabase (may not if started offline)
      const { data: existingTrip } = await supabase
        .from('trips')
        .select('id')
        .eq('id', currentTripId)
        .single();

      if (!existingTrip) {
        // Trip doesn't exist in Supabase — create it now
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase.from('trips').insert({
            id: currentTripId,
            worker_id: session.user.id,
            status: 'active',
            started_at: new Date().toISOString(),
          });
        }
      }

      const { error } = await supabase.from('trip_points').insert(
        batch.map((p) => ({
          trip_id: currentTripId,
          latitude: p.lat,
          longitude: p.lng,
          accuracy: p.accuracy,
          speed: p.speed,
          recorded_at: new Date(p.timestamp).toISOString(),
        }))
      );
      if (!error) {
        const unsynced = await getUnsyncedPoints(currentTripId);
        if (unsynced.length > 0) {
          const ids = unsynced.slice(0, batch.length).map(p => p.id!).filter(Boolean);
          if (ids.length > 0) await markSynced(ids);
        }
      }
    } catch {
      // Points safe in IndexedDB
    }
  }, [currentTripId]);

  const syncPendingPoints = useCallback(async () => {
    if (!currentTripId) return;
    try {
      const unsynced = await getUnsyncedPoints(currentTripId);
      if (unsynced.length === 0) return;
      const { error } = await supabase.from('trip_points').insert(
        unsynced.map((p) => ({
          trip_id: p.tripId,
          latitude: p.lat,
          longitude: p.lng,
          accuracy: p.accuracy,
          speed: p.speed,
          recorded_at: new Date(p.timestamp).toISOString(),
        }))
      );
      if (!error) await markSynced(unsynced.map(p => p.id!));
    } catch {}
  }, [currentTripId]);

  useEffect(() => {
    if (!isTracking) {
      flushBuffer();
      if (batchTimerRef.current) clearInterval(batchTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      // Stop watcher
      if (watcherRef.current !== null) {
        if (isNativeApp()) {
          BackgroundGeolocation.removeWatcher({ id: watcherRef.current as string }).catch(() => {});
        } else {
          navigator.geolocation.clearWatch(watcherRef.current as number);
        }
        watcherRef.current = null;
      }
      return;
    }

    // Start tracking
    if (isNativeApp()) {
      startNativeTracking();
    } else {
      startBrowserTracking();
    }

    batchTimerRef.current = setInterval(flushBuffer, BATCH_INTERVAL_MS);
    elapsedTimerRef.current = setInterval(updateElapsed, 1000);
    syncPendingPoints();

    return () => {
      if (batchTimerRef.current) clearInterval(batchTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, [isTracking]); // eslint-disable-line react-hooks/exhaustive-deps

  function handlePosition(lat: number, lng: number, accuracy: number, speed: number | null, timestamp: number) {
    const pos: GPSPosition = { lat, lng, accuracy, speed, timestamp };
    if (!isValidPosition(pos, positions[positions.length - 1])) return;
    addPosition(pos);
    setCurrentPosition(pos);
    bufferRef.current.push(pos);
  }

  function startBrowserTracking() {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        handlePosition(
          position.coords.latitude,
          position.coords.longitude,
          position.coords.accuracy,
          position.coords.speed,
          position.timestamp
        );
      },
      (error) => { console.error('GPS Error:', error.message); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
    watcherRef.current = watchId;
  }

  async function startNativeTracking() {
    try {
      const id = await BackgroundGeolocation.addWatcher(
        {
          requestPermissions: true,
          stale: false,
          distanceFilter: 5,
          backgroundMessage: 'Отслеживание маршрута активно',
          backgroundTitle: 'ServiceTracker',
        },
        (location, error) => {
          if (error) {
            if (error.code === 'NOT_AUTHORIZED') {
              alert('Разрешите геолокацию "Всегда" в настройках приложения.');
            }
            return;
          }
          if (location) {
            handlePosition(
              location.latitude,
              location.longitude,
              location.accuracy ?? 10,
              location.speed ?? null,
              location.time ?? Date.now()
            );
          }
        }
      );
      watcherRef.current = id;
    } catch (err) {
      console.error('BackgroundGeolocation error, falling back to browser:', err);
      startBrowserTracking();
    }
  }

  return { isTracking, currentTripId };
}
