-- Migration: allow deleting points (cascade visits, add RLS policy)

-- 1. Add ON DELETE CASCADE to visits → points FK
ALTER TABLE visits DROP CONSTRAINT IF EXISTS visits_point_id_fkey;
ALTER TABLE visits ADD CONSTRAINT visits_point_id_fkey
  FOREIGN KEY (point_id) REFERENCES points(id) ON DELETE CASCADE;

-- 2. Add DELETE policy for points (workers only)
CREATE POLICY "Points: workers delete" ON points FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'worker'));
