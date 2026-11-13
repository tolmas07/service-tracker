# ServiceTracker — Проект

## Описание
PWA + Capacitor Android приложение для технических специалистов обслуживающих ПК и принтеры для смарт-карт по точкам в Узбекистане (Самарканд, Сырдарья, Джиззах). GPS-трекер маршрута (1000 сум/км), карта с точками, история посещений, фотоотчёты.

## Стек
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS 4
- **Карты**: Leaflet.js + OpenStreetMap
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **State**: Zustand (GPS) + React Query (server state)
- **Деплой**: Vercel (frontend) + Supabase (backend)
- **Мобильное**: Capacitor (Android APK)

## ВАЖНО: Коммиты и релизы
- **Коммиты ВСЕГДА на русском языке** — пользователь не читает английские сообщения
- **Не собирать APK вручную** — пользователь делает это в Android Studio
- **GitHub Actions** автоматически при пуше на master: бамп версии → сборка APK → GitHub Release → обновление version.json
- **Vercel** автоматически деплоит при пуше на GitHub

## Автоматическая система обновлений
- **Workflow**: `.github/workflows/release.yml`
- **Скрипт бампа**: `scripts/bump-version.mjs` — обновляет версию в package.json, constants.ts, build.gradle, version.json
- **Хук проверки**: `src/hooks/useVersionCheck.ts` — проверяет `/version.json` каждые 30 минут
- **Диалог обновления**: `src/components/Layout/UpdateDialog.tsx` — два режима: обязательное и рекомендуемое
- **Константа версии**: `src/lib/constants.ts`
- **Файл версии**: `public/version.json` — содержит версию, minVersion, ссылку на APK, changelog
- **APK URL**: `https://github.com/tolmas07/service-tracker/releases/latest/download/UzmulkTracker.apk`
- **Принудительное обновление**: установить `"forceUpdate": true` в version.json

## Структура проекта
```
src/
├── components/
│   ├── Auth/LoginPage.tsx          — Вход (регистрация отключена)
│   ├── Map/MapView.tsx             — Карта с точками, навигация, CRUD
│   ├── Map/MapPointPicker.tsx      — Выбор точки на карте (полноэкранный)
│   ├── Tracker/TripPage.tsx        — GPS-трекер (СТАРТ/СТОП)
│   ├── Tracker/ManualTripForm.tsx  — Ручное добавление пробега
│   ├── Visits/VisitForm.tsx        — Создание/редактирование отчёта + фото
│   ├── Visits/HistoryPage.tsx      — История посещений + TripsTab
│   ├── Visits/EditVisitPage.tsx    — Страница редактирования отчёта
│   ├── Points/PointDetailPage.tsx  — Детали точки + навигация
│   └── Layout/                     — Header, BottomNav, ManagerDashboard, UpdateDialog
├── hooks/
│   ├── usePoints.ts                — CRUD точек (create, read, update, delete)
│   ├── useVisits.ts                — CRUD посещений + фото (upload, delete)
│   ├── useGPSTracker.ts            — GPS трекинг (offline-first, batch upload)
│   └── useVersionCheck.ts          — Проверка версии при запуске
├── stores/
│   ├── gpsStore.ts                 — Zustand store для GPS (in-place mutation)
│   └── authStore.ts                — Авторизация (Supabase Auth)
├── lib/
│   ├── supabase.ts                 — Клиент Supabase
│   ├── geo.ts                      — Haversine, фильтрация GPS
│   ├── idb.ts                      — IndexedDB через Dexie (offline GPS buffer)
│   └── constants.ts                — APP_VERSION
├── types/index.ts                  — Все TypeScript типы
└── App.tsx                         — Маршрутизация + React Query config + диалог обновления
```

## База данных (Supabase)
Таблицы: `profiles`, `points`, `trips`, `trip_points`, `visits`, `photos`
- RLS: worker — полный доступ к своим данным, manager — read-only
- SQL схема: `supabase/schema.sql`
- Миграции (порядок важен):
  1. `supabase/schema.sql` — основная схема
  2. `supabase/migration_delete_points.sql` — каскадное удаление + RLS
  3. `supabase/migration_status.sql` — статус "на ремонт"
  4. `supabase/migration_fixes_performance.sql` — RLS DELETE для фото + Storage DELETE + индексы
  5. `supabase/seed_points.sql` — 44 точки из Excel
  6. `supabase/assign_points_to_me.sql` — привязка точек к работнику

## Роли
| Роль | Доступ |
|------|--------|
| worker | CRUD точек, GPS трекер, отчёты, фото (вкл. удаление), удаление |
| manager | Read-only: карта, маршруты, статистика |

## Добавление пользователей и импорт точек (Руководство для ИИ-агента)

### 1. Архитектура изоляции данных (Per-Worker)
* **Пользователи**: хранятся в `auth.users` Supabase.
* **Профили**: таблица `profiles` (`id` = `auth.users.id`, `full_name`, `role`: `'worker'` | `'manager'`).
* **Точки**: таблица `points` имеет поле `worker_id UUID REFERENCES profiles(id)`.
* **Правило видимости**:
  * Сотрудник (`worker`) видит в приложении **только свои точки** (`points.worker_id = auth.uid()`) и свои поездки/отчёты.
  * Руководитель (`manager`) видит все точки с возможностью фильтрации по сотрудникам.

### 2. Текущие учетные записи и регионы (в базе)
| ФИО / Название | Email | Роль | Регион / Описание |
|----------------|-------|------|-------------------|
| `tolmasbek murtazoev` | `tolmasofficial@gmail.com` | `worker` | Самарканд, Сырдарья, Джизак |
| `Тестовый Руководитель` | `manager@test.com` | `manager` | Панель руководителя |
| `Javlon` | `javlon@uzmulk.uz` | `worker` | Андижан, Наманган, Фергана |
| `Сотрудник (Бухоро и Навои)` | `buxoro_navoiy@tracker.uz` | `worker` | Бухара и Навои |
| `Сотрудник (Қашқадарё ва Сурхондарё)` | `qashqa_surxon@tracker.uz` | `worker` | Кашкадарья и Сурхандарья |
*Стандартный пароль для технических учеток: `Tolmas2003!!`*

### 3. Алгоритм создания нового пользователя и импорта точек
Поскольку регистрация через форму в приложении отключена, добавление выполняется через Node.js скрипт (примеры в `scratch/import_*.mjs`):

1. **Создание в Supabase Auth & подтверждение Email:**
   ```javascript
   const { data, error } = await supabase.auth.signUp({ email, password });
   // Обязательно подтвердить email в PostgreSQL, иначе вход будет заблокирован:
   await pgClient.query('UPDATE auth.users SET email_confirmed_at = now() WHERE id = $1', [userId]);
   ```
2. **Создание профиля:**
   ```sql
   INSERT INTO profiles (id, full_name, role)
   VALUES ($1, $2, 'worker')
   ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role;
   ```
3. **Парсинг точек из Excel (`xlsx`):**
   * **Колонки файлов кадастра:**
     * Краткое имя: `Худудий бошқармалар туман шаҳар номи`
     * Полное/официальное имя: `Расмий номи` (сохранять в `points.name`)
     * Адрес: `Манзили` (сохранять в `points.address`)
     * Координаты: `Локацияси линки`
   * **Форматы координат в файлах:**
     * Десятичные: `38.174344, 67.729844`
     * DMS (градусы/минуты/секунды): `38°49'52.12"N 65°46'59.42"E` или с кириллицей `37°12'52.51"С  67°16'24.59"В` (С = Север, В = Восток).
     * Конвертация в десятичные: `deg + min/60 + sec/3600`.
   * **Вставка в базу:**
     ```sql
     INSERT INTO points (name, address, latitude, longitude, status, worker_id)
     VALUES ($1, $2, $3, $4, 'unknown', $workerId);
     ```

### 4. Подключение к БД для скриптов
* **PostgreSQL Direct / Pooler:**
  `postgresql://postgres.cdjnuvdxcmyyatocrkzq:Tolmas2003%21%21@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`
* **Supabase Client:** URL и Anon key брать из `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).


## Ключевые решения
- **GPS офлайн-first**: поездка создаётся локально через `crypto.randomUUID()`, GPS стартует мгновенно, синхронизируется с Supabase в фоне. `flushBuffer` создаёт поездку на сервере если её нет.
- **IndexedDB буфер**: GPS точки сохраняются в IndexedDB через Dexie перед отправкой на сервер. Переживают краш и потерю интернета.
- GPS трекинг через `navigator.geolocation.watchPosition` с `enableHighAccuracy: true`
- Wake Lock API для удержания экрана во время трекинга
- Предупреждение при закрытии вкладки во время трекинга
- Batch upload GPS точек каждые 10 секунд (до 50 точек за раз)
- Фильтрация GPS выбросов: accuracy > 50м, speed > 180 км/ч, расстояние < 5м
- Формула Haversine для расчёта расстояния
- **Выбор точки через карту**: MapPointPicker — полноэкранная карта с поиском вместо выпадающего списка
- Фото через Supabase Storage (выбор из галереи ИЛИ камера — НЕ только камера)
- Фото загружаются с `loading="lazy"` для производительности
- `URL.createObjectURL` корректно освобождается через `revokeObjectURL` в FilePreview компоненте
- Мульти-выбор типов работ (запятое-separated в БД). "Диагностика" заменена на "Обучение сотрудников"
- Статусы: working, not_working, sent_to_repair, unknown
- Навигация: Яндекс Карты через веб-URL `https://yandex.ru/maps/?rtext=~lat,lng&rtt=auto`, Google Maps через `https://www.google.com/maps/dir/?api=1&destination=lat,lng`
- Регистрация отключена — админ создаёт аккаунты вручную через Supabase Dashboard
- React Query: `staleTime: 30s`, `retry: 2`, `refetchOnWindowFocus: false`
- Версия приложения отображается в меню пользователя

## Важно при доработке
1. Supabase бесплатный тариф: 500MB DB, 1GB Storage — не перебарщивать с данными
2. GPS работает только когда приложение открыто (PWA/Android) — нельзя закрывать приложение
3. Все координаты в десятичном формате (lat, lng)
4. Названия точек на русском, адреса на узбекском (из Excel)
5. COST_PER_KM = 1000 (сум) — константа в types/index.ts
6. При изменении схемы БД — создавать миграцию в supabase/migration_*.sql
7. Не удалять Supabase Storage bucket "photos" — там все загруженные фото
8. **НЕ собирать APK через Gradle CLI** — пользователь собирает в Android Studio
9. При любом пуше на master GitHub Actions автоматически создаст релиз с APK
10. НЕ обновлять версию вручную — `scripts/bump-version.mjs` делает это автоматически
11. **После изменения кода нужно `npx cap sync android`** перед сборкой APK в Android Studio
12. **Vercel Deployment Protection** должен быть отключён (Settings → Deployment Protection → "Only Preview Deployments") — иначе manifest.json и version.json блокируются SSO
13. **Кнопки удаления** должны быть видны всегда на мобильном — НЕ использовать `opacity-0 group-hover:opacity-100` (hover не работает на тачскрине)
14. **RLS для фото**: DELETE политика для таблицы `photos` и для `storage.objects` обязательны — без них удаление фото silently fail

## Env переменные
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
```

## Пути к инструментам (Windows)
- **Java (JDK)**: `C:\Users\Tolmas\AppData\Local\Programs\Android Studio\jbr`
- **Android SDK**: `C:\Users\Tolmas\AppData\Local\Android\Sdk`
- **Проект**: `C:\Users\Tolmas\service-tracker`
