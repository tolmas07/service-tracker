-- Migration: fix trips deletion and point status updates
-- Выполните этот скрипт в Supabase Dashboard -> SQL Editor

-- 1. Разрешить специалистам (worker) удалять свои поездки
DROP POLICY IF EXISTS "Trips: worker delete own" ON trips;
CREATE POLICY "Trips: worker delete own" ON trips FOR DELETE
  USING (
    worker_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'worker')
  );

-- 2. Разрешить специалистам обновлять статус точек
-- (ранее стояло worker_id = auth.uid(), из-за чего точки без worker_id или созданные другим специалистом не меняли статус)
DROP POLICY IF EXISTS "Points: worker update own" ON points;
DROP POLICY IF EXISTS "Points: workers update" ON points;

CREATE POLICY "Points: workers update" ON points FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'worker')
  );

-- 3. Привязать точки с worker_id = NULL к текущему авторизованному пользователю:
UPDATE points SET worker_id = auth.uid() WHERE worker_id IS NULL;
