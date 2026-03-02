# Пошаговая инструкция: как собрать файл AAB для Google Play

Файл AAB (Android App Bundle) — это то, что нужно загружать в Google Play Console.  
Создаётся он **не через Settings**, а через меню **Build** в Android Studio.

---

## Шаг 0. Закройте Settings

Если у вас открыто окно **Settings** — нажмите **Cancel** или **OK** и закройте его.  
Settings (Inspections, Keymap и т.п.) для сборки AAB не нужны.

---

## Шаг 1. Откройте проект Android в Android Studio

1. В терминале (в папке проекта) выполните:
   ```bash
   cd c:\Users\PC\Desktop\projects\cursor\DeloApp\frontend
   npm run build
   npx cap sync
   npx cap open android
   ```
2. Дождитесь полной загрузки проекта в Android Studio.

---

## Шаг 2. Откройте меню Build

1. В верхней строке меню Android Studio найдите пункт **Build**.
2. Нажмите на **Build**.
3. В выпадающем меню выберите пункт:
   **Generate Signed Bundle / APK...**

![Он должен быть где-то в середине списка]

---

## Шаг 3. Выберите Android App Bundle

Откроется окно выбора типа сборки.

1. Выберите радиокнопку: **Android App Bundle** (не APK).
2. Нажмите **Next**.

---

## Шаг 4. Keystore (ключ подписи)

### Вариант А: У вас ещё нет keystore (первая сборка)

1. Нажмите **Create new...** (рядом с полем "Key store path").
2. Заполните поля:
   - **Key store path:** выберите папку и имя файла, например:
     `C:\Users\PC\delo-keystore.jks`  
     (сохраните этот путь — он понадобится для обновлений)
   - **Password:** придумайте пароль (запомните или запишите)
   - **Alias:** например `delo` или `upload`
   - **Key password:** тот же или другой пароль
   - **Validity:** 25 (лет)
   - **First and Last Name, Organizational Unit, Organization, City, State, Country:** можно кратко, например «Developer», «Delo», «Russia»
3. Нажмите **OK**.

### Вариант Б: Keystore уже есть

1. В поле **Key store path** нажмите на папку и укажите файл `.jks`.
2. Введите **Key store password** и **Key alias**.
3. Выберите нужный alias в списке.

### Общее

4. Убедитесь, что внизу отображаются зелёные галочки (данные введены верно).
5. Нажмите **Next**.

---

## Шаг 5. Выбор build variant

1. В поле **Build Variants** должно быть выбрано: **release**.
2. Галочки **Export encrypted key...** можно не ставить.
3. Нажмите **Create** (или **Finish**).

---

## Шаг 6. Дождитесь окончания сборки

1. Внизу Android Studio появится панель **Build**.
2. Дождитесь сообщения **BUILD SUCCESSFUL**.
3. Появится уведомление с путём к файлу — можно нажать **locate**, чтобы открыть папку.

---

## Шаг 7. Где лежит готовый AAB

Файл будет здесь:

```
C:\Users\PC\Desktop\projects\cursor\DeloApp\frontend\android\app\build\outputs\bundle\release\app-release.aab
```

Его можно скопировать и загрузить в Google Play Console.

---

## Важно: сохраните keystore

- Файл `.jks` и пароли **обязательно сохраните** в надёжном месте.
- Без них вы не сможете выкладывать обновления приложения в Google Play.

---

## Если что-то пошло не так

| Проблема | Что делать |
|----------|------------|
| Нет пункта "Generate Signed Bundle" | Убедитесь, что открыт именно Android-проект (папка `frontend/android`), а не корень DeloApp. |
| Ошибка "Keystore was tampered with" | Неверный пароль — проверьте пароль keystore и ключа. |
| Ошибка при сборке | Выполните **Build → Clean Project**, затем повторите шаги 2–6. |
| Не найден модуль app | Выполните в терминале `npm run build` и `npx cap sync`, затем снова откройте проект. |

---

## Краткая шпаргалка

1. **Build** → **Generate Signed Bundle / APK...**
2. Выбрать **Android App Bundle** → **Next**
3. Создать или выбрать keystore → **Next**
4. **release** → **Create**
5. Файл: `frontend/android/app/build/outputs/bundle/release/app-release.aab`
