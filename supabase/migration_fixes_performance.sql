-- Миграция: исправление RLS для фото + индексы для производительности

-- 1. RLS: добавить DELETE политику для таблицы photos
CREATE POLICY "Photos: delete own" ON photos
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM visits
      WHERE visits.id = photos.visit_id
        AND visits.worker_id = auth.uid()
    )
  );

-- 2. RLS: добавить DELETE политику для Supabase Storage (удаление файлов)
CREATE POLICY "Photos storage: delete" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'photos');

-- 3. Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_photos_visit_id ON photos(visit_id);
CREATE INDEX IF NOT EXISTS idx_trip_points_recorded_at ON trip_points(recorded_at);
CREATE INDEX IF NOT EXISTS idx_visits_visited_at ON visits(visited_at DESC);
CREATE INDEX IF NOT EXISTS idx_points_name ON points(name);
CREATE INDEX IF NOT EXISTS idx_points_status ON points(status);
