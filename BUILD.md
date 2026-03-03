# Сборка приложения «Дело» для Android и iOS

Приложение работает **офлайн** на устройстве: задачи, настройки и уведомления сохраняются локально.

---

## Требования

- **Node.js** 18+
- **Android Studio** (для Android)
- **Xcode** (для iOS, только macOS)
- **JDK 17** (часто идёт с Android Studio)

---

## Подготовка проекта

```bash
cd DeloApp/frontend
npm install
```

---

## Android

### 1. Добавить платформу (если ещё нет)

```bash
npx cap add android
```

### 2. Сборка и синхронизация

```bash
npm run cap:sync
```

Или по шагам:
```bash
npm run build
npx cap sync android
```

### 3. Открыть в Android Studio

```bash
npx cap open android
```

### 4. Собрать APK/AAB

- **Debug APK:** Build → Build Bundle(s) / APK(s) → Build APK(s)
- **Release:** Build → Generate Signed Bundle / APK

Путь к APK: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## iOS

> Только на macOS с установленным Xcode.

### 1. Добавить платформу

```bash
npx cap add ios
```

### 2. Сборка и синхронизация

```bash
npm run cap:sync
```

### 3. Открыть в Xcode

```bash
npx cap open ios
```

### 4. Подпись и сборка

1. Выберите команду (Team) в Signing & Capabilities
2. Подключите устройство или выберите симулятор
3. Product → Run (⌘R) или Archive для App Store

---

## Обновление после изменений в коде

```bash
npm run cap:sync
```

Затем пересоберите в Android Studio / Xcode.

## Если обновления не появляются в приложении

1. Убедитесь, что `npm run build` завершился **до** `npx cap sync android`.
2. В Android Studio: **Build → Clean Project**, затем **Build → Rebuild Project**.
3. Удалите приложение с эмулятора/телефона (долгое нажатие на иконку → Удалить).
4. Запустите приложение снова (**Run** ▶).

**Важно:** после любых изменений в коде всегда выполняйте сборку и синхронизацию — так проект в папках (в т.ч. `android/`) будет актуальным:
```bash
npm run cap:sync
```
Или по шагам: `npm run build` → `npx cap sync`.

---

## Splash-экран

- **Нативный (Android):** логотип `logo.png` используется в `res/drawable*/splash.png` — показывается до загрузки WebView.
- **Веб-загрузка:** экран с логотипом и анимацией (появление + масштаб) показывается в HTML до загрузки React и скрывается после готовности приложения.

---

## Офлайн-работа

- Все данные хранятся в `localStorage`
- Нет внешних запросов при запуске (используются системные шрифты)
- Уведомления — через Capacitor Local Notifications (работают при закрытом приложении)
- Ссылка «Поддержка» (Telegram) требует интернет при нажатии

---

## Краткая шпаргалка

| Действие | Команда |
|----------|---------|
| Сборка веб-приложения | `npm run build` |
| Синхронизация с Capacitor | `npm run cap:sync` |
| Открыть Android | `npm run cap:android` |
| Открыть iOS | `npm run cap:ios` |
| Локальная разработка | `npm run dev` |
