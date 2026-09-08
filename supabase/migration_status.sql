-- Migration: add 'sent_to_repair' to status_after check constraint
-- Run this in Supabase SQL Editor AFTER the initial schema

-- Drop old constraint on visits.status_after if exists
ALTER TABLE visits DROP CONSTRAINT IF EXISTS visits_status_after_check;

-- Add new constraint with sent_to_repair
ALTER TABLE visits ADD CONSTRAINT visits_status_after_check
  CHECK (status_after IS NULL OR status_after IN ('working', 'not_working', 'unknown', 'sent_to_repair'));
