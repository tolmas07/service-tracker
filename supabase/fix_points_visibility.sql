-- Обновлённая RLS: все видят все точки, но редактировать только свои
-- Руководитель — только чтение

-- Удаляем старые политики
DROP POLICY IF EXISTS "Points: worker reads own" ON points;
DROP POLICY IF EXISTS "Points: worker insert own" ON points;
DROP POLICY IF EXISTS "Points: worker update own" ON points;
DROP POLICY IF EXISTS "Points: worker delete own" ON points;
DROP POLICY IF EXISTS "Points: read all" ON points;
DROP POLICY IF EXISTS "Points: workers insert" ON points;
DROP POLICY IF EXISTS "Points: workers update" ON points;
DROP POLICY IF EXISTS "Points: workers delete" ON points;

-- Все авторизованные видят все точки (для навигации и маршрутов)
CREATE POLICY "Points: everyone reads" ON points FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Worker добавляет точки от своего имени
CREATE POLICY "Points: worker insert" ON points FOR INSERT
  WITH CHECK (
    worker_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'worker')
  );

-- Worker редактирует точки и статусы
CREATE POLICY "Points: workers update" ON points FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'worker')
  );

-- Worker удаляет только свои точки
CREATE POLICY "Points: worker delete own" ON points FOR DELETE
  USING (
    worker_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'worker')
  );

-- Worker удаляет свои поездки
DROP POLICY IF EXISTS "Trips: worker delete own" ON trips;
CREATE POLICY "Trips: worker delete own" ON trips FOR DELETE
  USING (
    worker_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'worker')
  );

-- Назначить все непривязанные точки текущему пользователю
UPDATE points SET worker_id = auth.uid() WHERE worker_id IS NULL;
