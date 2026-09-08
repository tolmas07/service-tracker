-- Создание тестового аккаунта руководителя
-- ВАЖНО: Выполните это через Supabase Dashboard → Authentication → Users → Invite user
-- ИЛИ используйте SQL ниже (замените email и пароль)

-- Шаг 1: Создайте пользователя через Supabase Dashboard
-- Authentication → Users → Add user → введите email и пароль
-- Например: manager@test.com / Test123456

-- Шаг 2: После создания пользователя, найдите его UUID в списке пользователей
-- и выполните этот SQL (замените UUID):

-- INSERT INTO profiles (id, full_name, role)
-- VALUES ('UUID_ПОЛЬЗОВАТЕЛЯ', 'Тестовый Руководитель', 'manager');

-- Или автоматически для последнего созданного пользователя:
INSERT INTO profiles (id, full_name, role)
SELECT id, 'Тестовый Руководитель', 'manager'
FROM auth.users
WHERE email = 'manager@test.com'
AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.users.id);
