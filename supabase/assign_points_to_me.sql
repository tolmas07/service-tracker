-- Назначить ВСЕ точки без привязки текущему работнику
-- Выполните залогинившись под аккаунтом специалиста в Supabase SQL Editor
-- Или замените auth.uid() на конкретный UUID:

UPDATE points SET worker_id = auth.uid() WHERE worker_id IS NULL;
