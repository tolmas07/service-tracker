import Dexie, { type Table } from 'dexie';

interface TripBufferPoint {
  id?: number;
  tripId: string;
  lat: number;
  lng: number;
  accuracy: number;
  speed: number | null;
  timestamp: number;
  synced: boolean;
}

interface ActiveTripState {
  tripId: string;
  startTimestamp: number;
  totalDistanceM: number;
}

class ServiceTrackerDB extends Dexie {
  tripBuffer!: Table<TripBufferPoint>;
  activeTrip!: Table<ActiveTripState>;

  constructor() {
    super('service-tracker-db');
    this.version(1).stores({
      tripBuffer: '++id, tripId, synced, timestamp',
      activeTrip: 'tripId',
    });
  }
}

export const db = new ServiceTrackerDB();

// Save a GPS point to IndexedDB (survives app crash/reload)
export async function persistPoint(point: Omit<TripBufferPoint, 'id' | 'synced'>) {
  await db.tripBuffer.add({ ...point, synced: false });
}

// Get all unsynced points for a trip
export async function getUnsyncedPoints(tripId: string) {
  return db.tripBuffer.where('tripId').equals(tripId).and(p => !p.synced).toArray();
}

// Mark points as synced
export async function markSynced(ids: number[]) {
  await db.tripBuffer.where('id').anyOf(ids).modify({ synced: true });
}

// Save active trip state (survives reload)
export async function saveActiveTrip(tripId: string, startTimestamp: number, totalDistanceM: number) {
  await db.activeTrip.put({ tripId, startTimestamp, totalDistanceM });
}

// Get active trip state
export async function getActiveTrip(): Promise<ActiveTripState | undefined> {
  const trips = await db.activeTrip.toArray();
  return trips[0];
}

// Clear active trip
export async function clearActiveTrip() {
  await db.activeTrip.clear();
}

// Clear synced points older than 1 day
export async function cleanupOldPoints() {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  await db.tripBuffer.where('timestamp').below(oneDayAgo).and(p => p.synced).delete();
}
