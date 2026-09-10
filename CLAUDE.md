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
