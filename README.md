# Дело

Приложение для того, чтобы выгрузить дела из головы и не забывать. Если задача не выполнена до 23:59 — она переносится на завтра и подсвечивается красным.

---

## Мобильное приложение (App Store / Play Market) — React Native Expo

**Приложение для публикации в магазинах — это React Native Expo**, не Vite и не Capacitor. Оно находится в папке **`mobile-expo/`**.

- **Технологии:** Expo SDK 54, React Native, expo-router, TypeScript.
- **Запуск:** команды нужно выполнять **из папки `mobile-expo`** (в корне DeloApp нет Expo — там Vite/Capacitor, поэтому `npx expo start` в корне выдаст ошибку «expo is not installed»).
  ```bash
  cd mobile-expo
  npm install
  npx expo start
  ```
  Для Android: в другом терминале из `mobile-expo` выполните `npm run android`, либо сначала Metro (`npx expo start`), затем Run в Android Studio.
  **Из корня** можно вызвать: `npm run mobile:start` или `npm run mobile:android` (скрипты переходят в `mobile-expo` и запускают Expo).
- **Подробная инструкция:** см. **[mobile-expo/README.md](mobile-expo/README.md)**.

В **корне** репозитория (эта папка) находится **веб-вариант** приложения (React + Vite + Capacitor) — это отдельный проект для браузера и упаковки веба в Capacitor. Для нативного мобильного приложения всегда используйте **`mobile-expo/`**.

---

## MVP (текущая версия)

- **Без регистрации** — все данные в локальном хранилище браузера (localStorage).
- Создание задачи одним вводом и Enter.
- Чекбокс → зачёркивание и перенос в конец списка выполненных.
- Удаление с подтверждением (опция «Больше не спрашивать»).
- Автоматический перенос невыполненных на завтра + красный цвет.
- Два режима списка: компактный / развернутый (кнопка в шапке).
- Перетаскивание задач (drag & drop).
- Прогресс-бар дня в шапке: «Сегодня выполнен X из Y».
- Колокольчик с количеством просроченных задач.
- Уведомление в 21:00: «У тебя N невыполненных дел за сегодня».
- Светлая / тёмная тема + авто по системе.

**Сборка под Android и список папок:** см. **[ЗАПУСК_И_СБОРКА.md](ЗАПУСК_И_СБОРКА.md)**. В корне DeloApp: `run.bat` или `.\run.ps1`, затем `открыть_android_studio.bat`.

## Запуск (разработка)

### Вариант 1: через Docker

Из папки `DeloApp`:

```bash
docker compose up
```

Откройте в браузере: **http://localhost:5173**

### Вариант 2: без Docker (Node.js локально)

```bash
cd frontend
npm install
npm run dev
```

Откройте: **http://localhost:5173**

## Сборка для продакшена

```bash
cd frontend
npm run build
```

Файлы появятся в `frontend/dist`. Их можно положить на любой веб-сервер или использовать как PWA.

## Перед публикацией в Play Market / App Store

1. Соберите приложение: в корне запустите **run.bat** (или `.\run.ps1`).
2. Откройте **frontend/android** в Android Studio → Build → Generate Signed Bundle / APK.
3. **iOS (Xcode):** если собираете на Mac — см. **[ЧТО_ДЕЛАТЬ_ДАЛЬШЕ.md](ЧТО_ДЕЛАТЬ_ДАЛЬШЕ.md)**. Если передаёте код с Windows на Mac через GitHub — **[ПЕРЕДАЧА_НА_ВЫКЛАДКУ_IOS.md](ПЕРЕДАЧА_НА_ВЫКЛАДКУ_IOS.md)**.
4. Чек-листы и требования: **[RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)**, **[PUBLISH_GUIDE.md](PUBLISH_GUIDE.md)**, **[STORE_READINESS.md](STORE_READINESS.md)**.

## Расширяемость

- Данные задач проходят только через `getTasks`/`saveTasks` (frontend). Синхронизацию с сервером или другим устройством можно добавить поверх этого слоя без переписывания UI.
- Бэкенд в `app/` (Laravel), API для задач можно добавить в `app/routes/api.php`. Подробно: **[SYNC_READINESS.md](SYNC_READINESS.md)**.

## Структура проекта

- `frontend/` — приложение «Дело» (React + Vite + Capacitor).
- `frontend/android/` — проект для Android Studio (сборка APK/AAB).
- `frontend/ios/` — проект для Xcode (сборка для App Store).
- `landing/` — лендинг и политика конфиденциальности (privacy.html).
- `app/` — зарезервировано под бэкенд (Laravel).
- `docker-compose.yml` — запуск фронтенда в режиме разработки.

## Следующий этап (позже)

- **Синхронизация с сервером или другим устройством** — структура готова: данные проходят через `getTasks`/`saveTasks` (frontend), бэкенд в `app/` (Laravel), API-маршруты можно добавить в `app/routes/api.php`. Подробно: **[SYNC_READINESS.md](SYNC_READINESS.md)**.
- Веб-версия + аккаунт (логин/регистрация для sync).
- Вкладки «Просроченные» и «Выполненные за 7 дней».
