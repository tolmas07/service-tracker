# ServiceTracker — Руководство по развёртыванию

## Шаг 1: Supabase (5 минут)

### 1.1 Создать проект
1. Зайдите на https://supabase.com → зарегистрируйтесь
2. **New Project** → имя: `service-tracker`, пароль: любой, регион: ближайший
3. Ждите ~2 минуты пока создастся

### 1.2 Создать базу данных
1. В левом меню → **SQL Editor**
2. Нажмите **New query**
3. Скопируйте содержимое файла `supabase/schema.sql` → вставьте → **Run**
4. Создайте ещё один query, выполните `supabase/migration_delete_points.sql`
5. Создайте ещё один query, выполните `supabase/migration_status.sql`
6. Создайте ещё один query, выполните `supabase/migration_fixes_performance.sql` — RLS для удаления фото + индексы

### 1.3 Получить ключи
1. **Settings** (шестерёнка) → **API**
2. Скопируйте:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** ключ → `VITE_SUPABASE_ANON_KEY`

### 1.4 Настроить аутентификацию
1. **Authentication** → **Providers** → убедитесь что **Email** включён
2. **Authentication** → **URL Configuration** → добавьте ваш домен в **Redirect URLs**:
   - `http://localhost:5173` (для разработки)
   - `https://ваш-домен.vercel.app` (для продакшена)

---

## Шаг 2: Создание аккаунтов

**Регистрация отключена.** Админ создаёт аккаунты вручную.

### Создать аккаунт руководителя (для тестирования):
1. **Authentication** → **Users** → **Add user (invite)**
2. Email: `manager@test.com`, Password: `Test123456`
3. После создания скопируйте UUID нового пользователя
4. Выполните SQL:
```sql
INSERT INTO profiles (id, full_name, role)
VALUES ('UUID_СЮДА', 'Тестовый Руководитель', 'manager');
```

### Создать аккаунт специалиста:
1. **Authentication** → **Users** → **Add user (invite)**
2. Email и пароль — какие хотите
3. SQL:
```sql
INSERT INTO profiles (id, full_name, role)
VALUES ('UUID_СЮДА', 'Фамилия Имя Отчество', 'worker');
```

### Сброс пароля пользователя:
1. **Authentication** → **Users** → найдите пользователя
2. Нажмите на троеточие → **Send password recovery**
3. Пользователь получит email со ссылкой для смены пароля

---

## Шаг 3: Импорт точек (2 минуты)

1. Откройте файл `supabase/seed_points.sql` в блокноте
2. Скопируйте всё содержимое
3. **SQL Editor** → **New query** → вставьте → **Run**
4. Все 44 точки появятся на карте

---

## Шаг 4: Запуск локально

```bash
cd C:\Users\Tolmas\service-tracker
npm install
npm run dev
```

- ПК: http://localhost:5173
- Телефон (один Wi-Fi): http://ВАШ-IP:5173

---

## Шаг 5: Деплой на Vercel (бесплатно)

### 5.1 Загрузить на GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/ВАШ/service-tracker.git
git push -u origin main
```

### 5.2 Подключить Vercel
1. Зайдите на https://vercel.com → войдите через GitHub
2. **Import Project** → выберите `service-tracker`
3. Добавьте переменные окружения:
   - `VITE_SUPABASE_URL` = ваш URL из Supabase
   - `VITE_SUPABASE_ANON_KEY` = ваш ключ из Supabase
4. **Deploy**

### 5.3 Обновить Redirect URL в Supabase
1. Supabase → **Authentication** → **URL Configuration**
2. Добавьте: `https://service-tracker-xxx.vercel.app`

### 5.4 ОБЯЗАТЕЛЬНО: Отключить Vercel Deployment Protection
1. Vercel → проект → **Settings** → **Deployment Protection**
2. **Vercel Authentication** → переключите на **"Only Preview Deployments"** (или выключите)
3. Без этого manifest.json, version.json и все запросы блокируются SSO авторизацией

---

## Шаг 6: Установка PWA на телефон

### Android (Chrome):
1. Откройте сайт в Chrome
2. Меню (⋮) → "Добавить на главный экран"
3. Приложение появится на рабочем столе

### iPhone (Safari):
1. Откройте сайт в Safari
2. Кнопка "Поделиться" → "На экран Домой"

---

## Важные замечания

### GPS трекинг на смартфоне
- **Приложение должно быть открыто** — GPS работает только в активном приложении
- **Не закрывайте браузер** — приложение покажет предупреждение при попытке закрыть
- **Wake Lock** — экран не будет гаснуть во время трекинга
- **PWA работает лучше** — установите как приложение для стабильной работы

### Бесплатные лимиты Supabase
- 500 MB база данных — достаточно для тысяч поездок
- 1 GB хранилища фото — ~500-1000 фото
- 50,000 активных пользователей в месяц
- Если лимиты подходят к концу — Supabase предупредит по email

### Безопасность
- RLS (Row Level Security) включён — каждый видит только свои данные
- Manager видит всё но не может изменить
- Пароли хранятся в Supabase Auth (хешированы)
- API ключ (anon) безопасен для фронтенда — RLS ограничивает доступ

---

## Структура файлов проекта

```
service-tracker/
├── CLAUDE.md                        — Документация для ИИ-агентов
├── DEPLOY.md                        — Руководство по развёртыванию
├── README.md                        — Основная документация
├── .github/workflows/release.yml    — GitHub Actions: авто-релиз
├── scripts/
│   ├── bump-version.mjs             — Бамп версии
│   └── parse_excel.py               — Импорт точек из Excel
├── supabase/
│   ├── schema.sql                   — Основная схема БД
│   ├── migration_delete_points.sql  — Каскадное удаление + RLS
│   ├── migration_status.sql         — Статус "на ремонт"
│   ├── migration_fixes_performance.sql — RLS DELETE фото + индексы
│   ├── seed_points.sql              — 44 точки из Excel
│   └── assign_points_to_me.sql      — Привязка точек к работнику
├── public/
│   ├── version.json                 — Версия + ссылка на APK
│   └── manifest.json                — PWA манифест
├── src/                             — Исходный код React
├── android/                         — Capacitor Android проект
├── capacitor.config.ts              — Конфигурация Capacitor
├── vercel.json                      — Конфигурация Vercel (SPA rewrites + CORS)
├── .env                             — Переменные окружения (НЕ коммитить!)
└── .gitignore
```

## Обновления

### Автоматический релиз (GitHub Actions)
При каждом пуше на `master` GitHub Actions автоматически:
1. Бампит версию (1.0.0 → 1.0.1 → 1.0.2...)
2. Собирает Android APK
3. Создаёт GitHub Release с APK
4. Обновляет `version.json` со ссылкой на APK
5. Vercel автоматически деплоит обновлённый сайт

**Никаких ручных действий не требуется** — просто `git push`.

### Как работает проверка обновлений на устройстве
1. При запуске приложение загружает `/version.json` с сервера
2. Сравнивает серверную версию с локальной (`src/lib/constants.ts`)
3. Если версия новее — показывает диалог с кнопкой "Скачать обновление"
4. Каждые 30 минут повторяет проверку
5. Если `forceUpdate: true` в version.json — пользователь не может закрыть диалог

### Принудительное обновление
Чтобы заблокировать старые версии:
1. Отредактируйте `public/version.json` → `"forceUpdate": true`
2. Запушьте → GitHub Actions создаст новый релиз

### Ручной бамп версии (если нужно)
```bash
node scripts/bump-version.mjs
```
Обновит версию в: `package.json`, `src/lib/constants.ts`, `android/app/build.gradle`, `public/version.json`

### Сборка APK в Android Studio
1. Сначала синхронизируйте web assets: `npx cap sync android`
2. Откройте `android/` в Android Studio
3. Sync Gradle
4. Build → Build Bundle(s) / APK(s) → Build APK
5. APK: `android/app/build/outputs/apk/debug/app-debug.apk`

**Важно:** после каждого изменения кода нужно делать `npx cap sync android` перед сборкой APK, иначе APK будет содержать старую версию сайта.

Для изменений в базе данных — создавайте миграции в `supabase/migration_*.sql` и выполняйте в SQL Editor.
