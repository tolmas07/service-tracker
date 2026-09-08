# ServiceTracker — Проект

## Описание
PWA-приложение для технических специалистов обслуживающих ПК и принтеры для смарт-карт по точкам в Узбекистане (Самарканд, Сырдарья, Джиззах). GPS-трекер маршрута (1000 сум/км), карта с точками, история посещений, фотоотчёты.

## Стек
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS 4
- **Карты**: Leaflet.js + OpenStreetMap
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **State**: Zustand (GPS) + React Query (server state)
- **Деплой**: Vercel (frontend) + Supabase (backend)

## Структура проекта
```
src/
├── components/
│   ├── Auth/LoginPage.tsx          — Вход (регистрация отключена)
│   ├── Map/MapView.tsx             — Карта с точками, навигация, CRUD
│   ├── Tracker/TripPage.tsx        — GPS-трекер (СТАРТ/СТОП)
│   ├── Tracker/ManualTripForm.tsx  — Ручное добавление пробега
│   ├── Visits/VisitForm.tsx        — Создание/редактирование отчёта
│   ├── Visits/HistoryPage.tsx      — История посещений + TripsTab
│   ├── Visits/EditVisitPage.tsx    — Страница редактирования отчёта
│   ├── Points/PointDetailPage.tsx  — Детали точки + навигация
│   └── Layout/                     — Header, BottomNav, ManagerDashboard
├── hooks/usePoints.ts              — CRUD точек (create, read, update, delete)
├── hooks/useVisits.ts              — CRUD посещений + фото
├── hooks/useGPSTracker.ts          — GPS трекинг (watchPosition, batch upload)
├── stores/gpsStore.ts              — Zustand store для GPS
├── stores/authStore.ts             — Авторизация (Supabase Auth)
├── lib/supabase.ts                 — Клиент Supabase
├── lib/geo.ts                      — Haversine, фильтрация GPS
├── types/index.ts                  — Все TypeScript типы
└── App.tsx                         — Маршрутизация
```

## База данных (Supabase)
Таблицы: `profiles`, `points`, `trips`, `trip_points`, `visits`, `photos`
- RLS: worker — полный доступ к своим данным, manager — read-only
- SQL схема: `supabase/schema.sql`
- Миграции: `supabase/migration_*.sql`

## Роли
| Роль | Доступ |
|------|--------|
| worker | CRUD точек, GPS трекер, отчёты, фото, удаление |
| manager | Read-only: карта, маршруты, статистика |

## Ключевые решения
- GPS трекинг через `navigator.geolocation.watchPosition` с `enableHighAccuracy: true`
- Wake Lock API для удержания экрана во время трекинга
- Предупреждение при закрытии вкладки во время трекинга
- Batch upload GPS точек каждые 10 секунд
- Фильтрация GPS выбросов: accuracy > 50м, speed > 180 км/ч, расстояние < 5м
- Формула Haversine для расчёта расстояния
- Фото через Supabase Storage
- Мульти-выбор типов работ (запятое-separated в БД)
- Статусы: working, not_working, sent_to_repair, unknown
- Навигация: deep links в Яндекс Навигатор и Google Maps
- Регистрация отключена — админ создаёт аккаунты вручную через Supabase Dashboard

## Важно при доработке
1. Supabase бесплатный тариф: 500MB DB, 1GB Storage — не перебарщивать с данными
2. GPS работает только когда приложение открыто (PWA) — нельзя закрывать браузер
3. Все координаты в десятичном формате (lat, lng)
4. Названия точек на русском, адреса на узбекском (из Excel)
5. COST_PER_KM = 1000 (сум) — константа в types/index.ts
6. При изменении схемы БД — создавать миграцию в supabase/migration_*.sql
7. Не удалять Supabase Storage bucket "photos" — там все загруженные фото

## Env переменные
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
```
