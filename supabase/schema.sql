-- ServiceTracker Database Schema for Supabase
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('worker', 'manager')),
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Points (service locations)
CREATE TABLE IF NOT EXISTS points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('working', 'not_working', 'unknown')),
  notes TEXT,
  worker_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trips (GPS tracking sessions)
CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  total_distance_m DOUBLE PRECISION DEFAULT 0,
  total_duration_s INTEGER DEFAULT 0,
  compensation_uzs INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trips_worker ON trips(worker_id);
CREATE INDEX IF NOT EXISTS idx_trips_date ON trips(started_at);

-- Trip points (individual GPS coordinates)
CREATE TABLE IF NOT EXISTS trip_points (
  id BIGSERIAL PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trip_points_trip ON trip_points(trip_id);

-- Visits
CREATE TABLE IF NOT EXISTS visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  point_id UUID NOT NULL REFERENCES points(id),
  worker_id UUID NOT NULL REFERENCES profiles(id),
  trip_id UUID REFERENCES trips(id),
  visited_at TIMESTAMPTZ DEFAULT NOW(),
  work_type TEXT NOT NULL,
  work_description TEXT,
  status_before TEXT CHECK (status_before IN ('working', 'not_working', 'unknown')),
  status_after TEXT CHECK (status_after IN ('working', 'not_working', 'unknown')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visits_worker ON visits(worker_id);
CREATE INDEX IF NOT EXISTS idx_visits_point ON visits(point_id);

-- Photos
CREATE TABLE IF NOT EXISTS photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  caption TEXT,
  photo_type TEXT CHECK (photo_type IN ('printer', 'pc', 'other')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create storage bucket for photos
INSERT INTO storage.buckets (id, name, public) VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE points ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all, update own
CREATE POLICY "Profiles: read all" ON profiles FOR SELECT USING (true);
CREATE POLICY "Profiles: update own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Profiles: insert own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Points: everyone can read, workers can insert/update
CREATE POLICY "Points: read all" ON points FOR SELECT USING (true);
CREATE POLICY "Points: workers insert" ON points FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'worker'));
CREATE POLICY "Points: workers update" ON points FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'worker'));

-- Trips: workers see own, managers see all
CREATE POLICY "Trips: workers own" ON trips FOR SELECT
  USING (worker_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));
CREATE POLICY "Trips: workers insert" ON trips FOR INSERT
  WITH CHECK (worker_id = auth.uid());
CREATE POLICY "Trips: workers update own" ON trips FOR UPDATE
  USING (worker_id = auth.uid());

-- Trip points: same as trips
CREATE POLICY "Trip points: select" ON trip_points FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM trips WHERE trips.id = trip_points.trip_id
    AND (trips.worker_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'))
  ));
CREATE POLICY "Trip points: insert" ON trip_points FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM trips WHERE trips.id = trip_points.trip_id AND trips.worker_id = auth.uid()
  ));

-- Visits: workers own, managers all
CREATE POLICY "Visits: select" ON visits FOR SELECT
  USING (worker_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));
CREATE POLICY "Visits: workers insert" ON visits FOR INSERT
  WITH CHECK (worker_id = auth.uid());
CREATE POLICY "Visits: workers update own" ON visits FOR UPDATE
  USING (worker_id = auth.uid());

-- Photos: same as visits
CREATE POLICY "Photos: select" ON photos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM visits WHERE visits.id = photos.visit_id
    AND (visits.worker_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'))
  ));
CREATE POLICY "Photos: insert" ON photos FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM visits WHERE visits.id = photos.visit_id AND visits.worker_id = auth.uid()
  ));

-- Storage policies for photos bucket
CREATE POLICY "Photos storage: read" ON storage.objects FOR SELECT
  USING (bucket_id = 'photos');
CREATE POLICY "Photos storage: insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'photos' AND auth.uid() IS NOT NULL);
