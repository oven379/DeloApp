# Чек-лист релиза «Дело» v1.0.0

**Дата проверки:** 02.02.2025

---

## ✅ Выполнено

### Сборка
- [x] `npm run build` — успешно
- [x] `npx cap sync` — синхронизация с Android и web
- [x] Нет ошибок линтера в `src/`

### Функциональность
- [x] Задачи на сегодня/завтра
- [x] Напоминания по задаче (Сегодня, Завтра, Дата, 09:00, 13:00, 15:00, Другое)
- [x] Календарь «Планы на день»: точки зелёные (напоминание >7 дней), красные (≤7 дней), выбор года (текущий + 3)
- [x] Перенос невыполненных задач на следующий день
- [x] Уведомление о просрочке в 21:21
- [x] Ограничение переноса: при напоминании на сегодня показывается попап
- [x] Тема (светлая / тёмная / системная)
- [x] Режим списка (компактный / развёрнутый)
- [x] Ежедневные уведомления (Утро / Вечер)
- [x] Поиск по задачам
- [x] Drag & Drop для сортировки
- [x] Свайпы (влево — удалить, вправо — выполнить)

### Офлайн и PWA
- [x] Системные шрифты (без Google Fonts)
- [x] Относительные пути в manifest, index.html, Service Worker
- [x] Safe-area для iOS
- [x] Manifest и Service Worker для PWA

### Настройки
- [x] «Разработано 379team» + «Версия 1.0.0»
- [x] Кнопка «Поддержка» → https://delodelai.ru

### Android
- [x] Capacitor настроен
- [x] applicationId: `app.delodelai`
- [x] versionCode: 1, versionName: "1.0"
- [x] minSdk 24, targetSdk 36
- [x] Плагин Local Notifications

### iOS
- [x] Capacitor iOS настроен
- [x] Bundle ID: `app.delodelai`
- [x] Launch screen: UILaunchScreen в Info.plist (Splash) — для iPad Multitasking и прохождения валидации App Store
- [x] Локальные уведомления (Local Notifications)

---

## Перед публикацией в Google Play

1. **Собрать Release APK/AAB** в Android Studio:
   - Build → Generate Signed Bundle / APK
   - Выбрать keystore или создать новый

2. **Иконки приложения** — убедиться, что в `android/app/src/main/res/` есть набор mipmap (hdpi, mdpi, xhdpi, xxhdpi, xxxhdpi).

3. **Splash screen** — проверен (Capacitor Core Splash Screen).

4. **Политика конфиденциальности** — нужна ссылка для Google Play (данные только в localStorage, без аккаунта).

---

## Команды перед релизом

**Android:**
```bash
cd DeloApp/frontend
npm run cap:sync
npx cap open android
```
В Android Studio: Build → Clean Project → Rebuild Project → Run (или Generate Signed Bundle).

**iOS (на Mac или после клонирования с GitHub):** см. **[ЧТО_ДЕЛАТЬ_ДАЛЬШЕ.md](ЧТО_ДЕЛАТЬ_ДАЛЬШЕ.md)** и **[ПЕРЕДАЧА_НА_ВЫКЛАДКУ_IOS.md](ПЕРЕДАЧА_НА_ВЫКЛАДКУ_IOS.md)**.

---

## Перед публикацией в App Store

1. Код на Mac: клонировать с GitHub или получить ZIP (см. **[ПЕРЕДАЧА_НА_ВЫКЛАДКУ_IOS.md](ПЕРЕДАЧА_НА_ВЫКЛАДКУ_IOS.md)**).
2. В папке `frontend`: `npm install` → `npm run build` → `npx cap sync ios` → `npx cap open ios`.
3. В Xcode: выбрать Team, **Product** → **Archive**, затем **Distribute App** → App Store Connect.
4. В App Store Connect: привязать сборку к версии, заполнить метаданные (**ТЕКСТЫ_ДЛЯ_ВЫКЛАДКИ.md**, **store-assets/**), отправить на проверку.

Краткий пошаговый сценарий: **[ЧТО_ДЕЛАТЬ_ДАЛЬШЕ.md](ЧТО_ДЕЛАТЬ_ДАЛЬШЕ.md)**.

---

## Файлы для справки

| Файл | Назначение |
|------|------------|
| `ЧТО_ДЕЛАТЬ_ДАЛЬШЕ.md` | Что делать дальше: GitHub → Xcode (кратко) |
| `ПЕРЕДАЧА_НА_ВЫКЛАДКУ_IOS.md` | Передача кода на Mac (GitHub / ZIP), шаги для Xcode |
| `ИНСТРУКЦИЯ_APP_STORE.md` | App Store Connect, метаданные, отправка на проверку |
| `BUILD.md` | Инструкции по сборке |
| `package.json` | Версия 1.0.0, скрипты cap:sync, cap:android |
| `capacitor.config.json` | appId: app.delodelai |
| `manifest.json` | PWA, start_url: "./" |
