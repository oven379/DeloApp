# Выкладка «Дело» в App Store

Краткая инструкция для публикации в Apple App Store.

---

## 1. Требования

- **Mac** с установленным Xcode
- **Apple Developer Program** ($99/год), аккаунт активен
- **App ID** зарегистрирован в Apple Developer с Bundle ID: `app.delodelai`

---

## 2. App Store Connect

1. Войдите: https://appstoreconnect.apple.com
2. **Мои приложения** → **«+»** → **Новое приложение**
3. Заполните:
   - **Платформы:** iOS
   - **Название:** Дело
   - **Основной язык:** Русский
   - **Bundle ID:** выберите `app.delodelai` (должен быть создан в Certificates, Identifiers & Profiles)
   - **SKU:** `delodelai-app` (любой уникальный)
   - **Пользовательский доступ:** Полный доступ

---

## 3. Сборка в Xcode

```bash
cd frontend
npm run build
npx cap sync ios
npx cap open ios
```

В Xcode:
1. Выберите **Team** (ваш Apple Developer аккаунт)
2. Убедитесь, что **Bundle Identifier** = `app.delodelai`
3. **Product** → **Archive**
4. После успешной сборки: **Distribute App** → **App Store Connect** → **Upload**

---

## 4. Контент в App Store Connect

| Поле | Значение |
|------|----------|
| **Подзаголовок** (до 30 симв.) | Задачи на сегодня и завтра |
| **Описание** | Текст из **ТЕКСТЫ_ДЛЯ_ВЫКЛАДКИ.md** |
| **Ключевые слова** | задачи,напоминания,список дел,планер,офлайн,без рекламы |
| **URL поддержки** | https://t.me/manager379team или https://delodelai.ru/ |
| **Политика конфиденциальности** | https://delodelai.ru/privacy/ |
| **Категория** | Productivity |
| **Скриншоты** | По размерам устройств (6.7", 6.5", 5.5" и т.д.) |
| **Иконка** | 1024×1024 px, PNG, без прозрачности |

---

## 5. Что нужно для Capabilities

Для напоминаний в приложении включите **Push Notifications** в Xcode:
- Проект → Signing & Capabilities → **+ Capability** → Push Notifications

(Локальные уведомления работают и без push-сервера, но capability может понадобиться.)

---

## 6. Отправка на проверку

1. В App Store Connect: **Тестовая информация** (если нужно)
2. **Версия** → **Отправить на проверку**
3. Ожидание: обычно 1–3 дня

---

**Bundle ID в проекте:** `app.delodelai`
