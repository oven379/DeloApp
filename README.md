# Дело

Приложение для того, чтобы выгрузить дела из головы и не забывать. Если задача не выполнена до 23:59 — она переносится на завтра и подсвечивается красным.

---

## Что сейчас является основным проектом

**Главное приложение для App Store / Play Market — `mobile-expo/`.**

Корневые Vite/Capacitor-файлы (`src/`, `android/`, `ios/`, `capacitor.config.json`) оставлены как web/legacy-направление. Папка `frontend/` помечена как legacy-копия. Новые мобильные функции, багфиксы и релизные правки нужно вносить в `mobile-expo/`.

Быстрая проверка всего проекта из корня:

```bash
npm run verify
```

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

## MVP web/legacy-версии

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

Для актуального мобильного приложения используйте инструкции из **[mobile-expo/README.md](mobile-expo/README.md)**. Старые инструкции по Capacitor/Android Studio относятся к legacy-направлению.

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

1. Перейдите в `mobile-expo/`.
2. Выполните `npm install`, если зависимости ещё не установлены.
3. Выполните `npm run lint`, `npm run typecheck`, `npm test` или из корня `npm run verify`.
4. Для Android используйте `npm run android` / `npm run android:bundle` и инструкции из **[mobile-expo/README.md](mobile-expo/README.md)**.
5. Старые чек-листы Capacitor могут быть полезны как справочные, но не являются главным релизным путём.

## Расширяемость

- Данные задач проходят только через `getTasks`/`saveTasks` (frontend). Синхронизацию с сервером или другим устройством можно добавить поверх этого слоя без переписывания UI.
- Бэкенд в `app/` (Laravel), API для задач можно добавить в `app/routes/api.php`. Подробно: **[SYNC_READINESS.md](SYNC_READINESS.md)**.

## Структура проекта

- `mobile-expo/` — основное приложение «Дело» для App Store / Play Market (Expo, React Native, TypeScript).
- `src/` — web/legacy-версия на React + Vite.
- `android/`, `ios/`, `capacitor.config.json` — legacy Capacitor-обвязка для web-версии.
- `frontend/` — вложенный git-репозиторий и legacy-копия старой структуры, см. `FRONTEND_LEGACY.md`.
- `landing/` — лендинг и политика конфиденциальности (privacy.html).
- `app/` — зарезервировано под бэкенд (Laravel).
- `docker-compose.yml` — запуск web/legacy-фронтенда в режиме разработки.

## Следующий этап (позже)

- **Синхронизация с сервером или другим устройством** — начинать с `mobile-expo/src/lib/storage.ts` и бэкенда в `app/` (Laravel), API-маршруты можно добавить в `app/routes/api.php`. Подробно: **[SYNC_READINESS.md](SYNC_READINESS.md)**.
- Веб-версия + аккаунт (логин/регистрация для sync).
- Вкладки «Просроченные» и «Выполненные за 7 дней».
