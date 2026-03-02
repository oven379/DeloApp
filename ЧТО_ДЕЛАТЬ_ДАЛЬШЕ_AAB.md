# Что сделать, чтобы загрузить приложение в Google Play

Проверены папки проекта. Ниже — по шагам, что у вас есть и что нужно сделать.

---

## Что проверено

| Что | Результат |
|-----|------------|
| **Папка проекта** | `DeloApp\frontend` — на месте |
| **Android-проект** | `frontend\android` — есть, `applicationId`: `app.delodelai` |
| **Ключ (.jks)** | В папках проекта, на рабочем столе и в «Документах» не найден. Вы создавали его в Android Studio — вспомните, куда сохранили (например `C:\Users\PC\delo-keystore.jks` или другая папка). |
| **Release AAB** | Файла `app-release.aab` в `frontend\android\app\build\outputs\bundle\` пока нет — его нужно собрать. |

В `build.gradle` исправлен `namespace` на `app.delodelai` (раньше был `com.delo.app`).

---

## Что нужно сделать по шагам

### 1. Найти свой ключ (.jks)

- Вспомните, куда сохраняли keystore при создании в Android Studio (путь вроде `C:\Users\PC\delo-keystore.jks` или папка на рабочем столе).
- Если не найдёте — придётся создать новый ключ при сборке (см. шаг 4). Старый тогда использовать будет нельзя.

### 2. Открыть Android-проект в Android Studio

В терминале (в папке проекта):

```bash
cd c:\Users\PC\Desktop\projects\cursor\DeloApp\frontend
npm run build
npx cap sync
npx cap open android
```

Дождитесь полной загрузки проекта в Android Studio.

### 3. Собрать подписанный App Bundle (не APK)

1. В меню: **Build** → **Generate Signed Bundle / APK...**
2. Выберите **Android App Bundle** → **Next**.

### 4. Указать ключ (keystore)

- **Если ключ есть:** нажмите на иконку папки у **Key store path** и укажите ваш файл `.jks`. Введите пароль хранилища и **Key alias** (например `delo`), выберите alias в списке.
- **Если ключа нет:** нажмите **Create new...**, укажите путь (например `C:\Users\PC\delo-keystore.jks`), пароль, alias (например `delo`), срок действия 25 лет, заполните имя/организацию/страну и нажмите **OK**.

Убедитесь, что внизу стоят зелёные галочки → **Next**.

### 5. Выбрать release и собрать

1. В **Build Variants** выберите **release** (не debug).
2. Нажмите **Create** (или **Finish**).
3. Дождитесь **BUILD SUCCESSFUL** внизу.

### 6. Найти готовый AAB и загрузить в Google Play

Файл появится здесь:

```
c:\Users\PC\Desktop\projects\cursor\DeloApp\frontend\android\app\build\outputs\bundle\release\app-release.aab
```

В Google Play Console загружайте именно **app-release.aab** (не app-debug.aab).

---

## Важно

- Файл **app-debug.aab** Google Play не принимает — только **app-release.aab**.
- Keystore (`.jks`) и пароли сохраните в надёжном месте — без них нельзя будет выкладывать обновления.

Подробности: **ИНСТРУКЦИЯ_СБОРКА_AAB.md**.
