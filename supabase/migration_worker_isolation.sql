-- Миграция: изоляция данных по специалистам
-- Каждый видит только СВОИ точки, поездки и посещения
-- Руководитель видит всё (read-only)

-- ============================================================
-- POINTS: каждый работник видит только свои точки
-- ============================================================

-- Удаляем старые политики
DROP POLICY IF EXISTS "Points: read all" ON points;
DROP POLICY IF EXISTS "Points: workers insert" ON points;
DROP POLICY IF EXISTS "Points: workers update" ON points;
DROP POLICY IF EXISTS "Points: workers delete" ON points;

-- Worker видит только свои точки
CREATE POLICY "Points: worker reads own" ON points FOR SELECT
  USING (
    worker_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
  );

-- Worker создаёт точки только от своего имени
CREATE POLICY "Points: worker insert own" ON points FOR INSERT
  WITH CHECK (
    worker_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'worker')
  );

-- Worker обновляет только свои точки
CREATE POLICY "Points: worker update own" ON points FOR UPDATE
  USING (
    worker_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'worker')
  );

-- Worker удаляет только свои точки
CREATE POLICY "Points: worker delete own" ON points FOR DELETE
  USING (
    worker_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'worker')
  );

-- ============================================================
-- TRIPS: каждый работник видит только свои поездки
-- ============================================================

DROP POLICY IF EXISTS "Trips: workers own" ON trips;
DROP POLICY IF EXISTS "Trips: workers insert" ON trips;
DROP POLICY IF EXISTS "Trips: workers update own" ON trips;

CREATE POLICY "Trips: worker reads own" ON trips FOR SELECT
  USING (
    worker_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
  );

CREATE POLICY "Trips: worker insert own" ON trips FOR INSERT
  WITH CHECK (worker_id = auth.uid());

CREATE POLICY "Trips: worker update own" ON trips FOR UPDATE
  USING (worker_id = auth.uid());

-- ============================================================
-- TRIP_POINTS: через trips
-- ============================================================

DROP POLICY IF EXISTS "Trip points: select" ON trip_points;
DROP POLICY IF EXISTS "Trip points: insert" ON trip_points;

CREATE POLICY "Trip points: select" ON trip_points FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM trips WHERE trips.id = trip_points.trip_id
    AND (
      trips.worker_id = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
    )
  ));

CREATE POLICY "Trip points: insert own" ON trip_points FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM trips WHERE trips.id = trip_points.trip_id
    AND trips.worker_id = auth.uid()
  ));

-- ============================================================
-- VISITS: каждый работник видит только свои посещения
-- ============================================================

DROP POLICY IF EXISTS "Visits: select" ON visits;
DROP POLICY IF EXISTS "Visits: workers insert" ON visits;
DROP POLICY IF EXISTS "Visits: workers update own" ON visits;

CREATE POLICY "Visits: worker reads own" ON visits FOR SELECT
  USING (
    worker_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
  );

CREATE POLICY "Visits: worker insert own" ON visits FOR INSERT
  WITH CHECK (worker_id = auth.uid());

CREATE POLICY "Visits: worker update own" ON visits FOR UPDATE
  USING (worker_id = auth.uid());

-- ============================================================
-- PHOTOS: через visits
-- ============================================================

DROP POLICY IF EXISTS "Photos: select" ON photos;
DROP POLICY IF EXISTS "Photos: insert" ON photos;

CREATE POLICY "Photos: select" ON photos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM visits WHERE visits.id = photos.visit_id
    AND (
      visits.worker_id = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
    )
  ));

CREATE POLICY "Photos: insert own" ON photos FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM visits WHERE visits.id = photos.visit_id
    AND visits.worker_id = auth.uid()
  ));

-- ============================================================
-- MANAGER: только чтение (запрет INSERT/UPDATE/DELETE)
-- ============================================================

-- Manager не может менять данные (уже обеспечено тем что все INSERT/UPDATE/DELETE
-- проверяют worker_id = auth.uid(), а у manager другой uid)
-- Но для явности можно добавить deny-политики если нужно
