import { create } from 'zustand';
import type { GPSPosition, TripStats } from '../types';
import { COST_PER_KM } from '../types';
import { haversine } from '../lib/geo';

interface GPSState {
  isTracking: boolean;
  currentTripId: string | null;
  positions: GPSPosition[];
  currentPosition: GPSPosition | null;
  totalDistanceM: number;
  startTime: number | null;
  elapsedS: number;

  startTracking: (tripId: string) => void;
  stopTracking: () => void;
  addPosition: (pos: GPSPosition) => void;
  setCurrentPosition: (pos: GPSPosition | null) => void;
  updateElapsed: () => void;
  getStats: () => TripStats;
  reset: () => void;
}

export const useGpsStore = create<GPSState>((set, get) => ({
  isTracking: false,
  currentTripId: null,
  positions: [],
  currentPosition: null,
  totalDistanceM: 0,
  startTime: null,
  elapsedS: 0,

  startTracking: (tripId: string) =>
    set({
      isTracking: true,
      currentTripId: tripId,
      positions: [],
      totalDistanceM: 0,
      startTime: Date.now(),
      elapsedS: 0,
    }),

  stopTracking: () => set({ isTracking: false }),

  addPosition: (pos: GPSPosition) => {
    const state = get();
    const lastPos = state.positions[state.positions.length - 1];
    let addedDist = 0;

    if (lastPos) {
      addedDist = haversine(lastPos, pos);
    }

    set({
      positions: [...state.positions.slice(-499), pos], // keep last 500
      totalDistanceM: state.totalDistanceM + addedDist,
    });
  },

  setCurrentPosition: (pos) => set({ currentPosition: pos }),

  updateElapsed: () => {
    const { startTime } = get();
    if (!startTime) return;
    set({ elapsedS: Math.floor((Date.now() - startTime) / 1000) });
  },

  getStats: () => {
    const { totalDistanceM, elapsedS } = get();
    const distanceKm = totalDistanceM / 1000;
    return {
      distanceM: totalDistanceM,
      distanceKm,
      durationS: elapsedS,
      compensationUzs: Math.round(distanceKm * COST_PER_KM),
      avgSpeedKmh: elapsedS > 0 ? (totalDistanceM / elapsedS) * 3.6 : 0,
    };
  },

  reset: () =>
    set({
      isTracking: false,
      currentTripId: null,
      positions: [],
      currentPosition: null,
      totalDistanceM: 0,
      startTime: null,
      elapsedS: 0,
    }),
}));
