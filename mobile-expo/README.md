# Дело (Delo) — мобильное приложение (React Native Expo)

Это приложение собрано на **React Native Expo** (Expo SDK, expo-router, React Native). Оно **не** использует Vite, Capacitor или react-dom для нативной сборки — только Expo и React Native для App Store и Play Market.

Приложение для управления делами: задачи на сегодня/завтра, напоминания, календарь, настройки тем и уведомлений.

---

## Тест в Android Studio — что обновить и в каком порядке

Чтобы не было ошибки **«Unable to load script»**, делайте всегда в таком порядке:

| Шаг | Где | Что сделать |
|-----|-----|--------------|
| 1 | **Терминал** (Cursor или PowerShell) | Сначала перейти в папку проекта: `cd C:\Users\PC\Desktop\projects\cursor\DeloApp\mobile-expo` (без этого все команды ниже выдадут ошибку «package.json не найден»). |
| 2 | Тот же терминал | `npm install` (один раз) |
| 3 | Тот же терминал | `npx expo start` — **оставить окно открытым** (это Metro) |
| 4 | **Android Studio** | **File → Open** → папка **`mobile-expo/android`** (не DeloApp) |
| 5 | Android Studio | Дождаться синхронизации Gradle |
| 6 | Android Studio | Запустить эмулятор: **Tools → Device Manager** → ▶ у нужного устройства |
| 7 | Android Studio | Нажать **Run** (▶), **не Debug** (жук) |
| 8 | Эмулятор | Дождаться загрузки — должен открыться экран «Дело» |

**Если «Unable to load script»:** значит Metro не был запущен до Run. Закройте приложение на эмуляторе, в терминале выполните шаги 1 и 3, затем снова **Run** в Android Studio. Либо в терминале с Metro нажмите **R** дважды — перезагрузка бандла.

**Если несколько эмуляторов:** перед Run выполните в другом терминале `adb devices`, затем `adb -s emulator-5554 reverse tcp:8081 tcp:8081` (подставьте свой серийник из вывода).

**Обновление кода при тесте:** сохраните файлы → в терминале с Metro нажмите **R** дважды. Пересборка в Android Studio не нужна.

#### Как посмотреть изменения в Android Studio

1. Запустите Metro из папки `mobile-expo`: `npx expo start` (окно не закрывать).
2. В Android Studio откройте **`mobile-expo/android`** и нажмите **Run** (▶).
3. Внесите правки в код (JS/TS, стили) и сохраните файлы.
4. В терминале, где запущен Metro, нажмите **R** дважды — приложение на эмуляторе перезагрузит бандл и покажет изменения. Пересборка в Android Studio не нужна.

**Обновление иконки / app.json / сплеша:** в терминале: `npx expo prebuild --platform android --clean`, затем `npm run android` (Metro можно запустить в другом окне).

---

## Что сделать, чтобы обновить код и проверить доработки в Android Studio

Чтобы все последние доработки отображались в Android Studio и на эмуляторе, сделайте по шагам.

**Важно:** все команды `npm` и `npx` нужно выполнять **из папки проекта** `mobile-expo`. Если вы в домашней папке (`C:\Users\PC`) или в корне DeloApp — команды выдадут ошибку «package.json does not exist». Сначала всегда переходите в папку проекта (шаг 3 ниже).

### На компьютере

1. **Сохраните все файлы** в Cursor/редакторе (Ctrl+S).
2. Если код подтягиваете из Git — выполните в папке проекта `git pull` (или синхронизируйте репозиторий как обычно).
3. Откройте **терминал** и **обязательно** перейдите в папку проекта:
   ```bash
   cd C:\Users\PC\Desktop\projects\cursor\DeloApp\mobile-expo
   ```
   Проверьте, что в приглашении терминала виден путь с `mobile-expo` (например `PS ...\DeloApp\mobile-expo>`). Только после этого выполняйте следующие команды.
   (Если проект у вас в другом месте — укажите свой путь.)
4. Если добавлялись новые зависимости (в `package.json`) — один раз выполните:
   ```bash
   npm install
   ```
5. **Запустите Metro** (если он ещё не запущен):
   ```bash
   npx expo start
   ```
   Оставьте этот терминал открытым — Metro должен работать, пока вы тестируете.

### В Android Studio

6. Откройте проект: **File → Open** → выберите папку **`mobile-expo/android`** (внутри DeloApp, не корень DeloApp). Дождитесь окончания синхронизации Gradle.
7. Запустите эмулятор: **Tools → Device Manager** → нажмите ▶ у нужного устройства (например, Pixel 9).
8. Нажмите **Run** (▶) — не Debug. Дождитесь установки и запуска приложения на эмуляторе.
9. Чтобы подхватить новые правки кода (JS/TS, стили) **без пересборки**: в терминале, где запущен Metro, нажмите **R** дважды. Либо снова нажмите **Run** в Android Studio.

### Если меняли иконку, сплеш или app.json

В терминале **из папки проекта** (сначала `cd ...\mobile-expo`):

```bash
npx expo prebuild --platform android --clean
npm run android
```

После этого в Android Studio снова откройте **`mobile-expo/android`**, при необходимости **Build → Clean Project**, затем **Run**. Metro при этом должен быть запущен (`npx expo start` в другом окне).

**Кратко:** на компьютере — сохранить код, при необходимости `npm install`, запустить `npx expo start`; в Android Studio — открыть `mobile-expo/android`, Run (▶), для обновления кода — **R** дважды в терминале с Metro.

---

## Что сделать для теста

Сделайте по шагам:

1. **Откройте терминал** и перейдите в папку проекта:
   ```bash
   cd C:\Users\PC\Desktop\projects\cursor\DeloApp\mobile-expo
   ```

2. **Установите зависимости** (один раз):
   ```bash
   npm install
   ```

3. **Запустите эмулятор Android:** откройте Android Studio → **Tools** → **Device Manager** → выберите устройство (например, Pixel 7) → нажмите **Run** (▶). Либо подключите телефон по USB с включённой отладкой.

4. **Соберите и запустите приложение:**
   ```bash
   npm run android
   ```
   Дождитесь окончания сборки — приложение установится на эмулятор и откроется.

5. **Если правите код** — перезагрузите бандл: в терминале, где запущен Metro (его откроет `npm run android`), нажмите **R** дважды. Либо снова нажмите **Run** в Android Studio.

**Если сборка упала** — см. раздел ниже «Если сборка падает». **Если экран белый/красный** — убедитесь, что Metro запущен и нажмите **R** дважды на эмуляторе.

---

## Ошибка «Unable to load script» — что сделать по шагам

Если на эмуляторе или телефоне красный/чёрный экран и текст **«Unable to load script»** (бандл не загружается), сделайте по порядку:

### Шаг 1: Запустить Metro

Metro — это сервер, который отдаёт JavaScript приложению. Без него приложение не может загрузить код.

1. Откройте **терминал** (Cursor или PowerShell).
2. Перейдите в папку проекта:
   ```bash
   cd C:\Users\PC\Desktop\projects\cursor\DeloApp\mobile-expo
   ```
3. Запустите Metro:
   ```bash
   npx expo start
   ```
4. Оставьте этот терминал открытым — в нём будет работать Metro (логи, перезагрузка по **R**).

### Шаг 2: Подключить эмулятор/устройство к Metro

- **Эмулятор:** обычно подхватывает `localhost:8081` сам. Если не подключается, в **другом** терминале выполните:
  ```bash
  adb reverse tcp:8081 tcp:8081
  ```
  (порт именно **8081**, не 8881 — на нём слушает Metro.)
- **Телефон по USB:** включите отладку по USB и выполните:
  ```bash
  adb reverse tcp:8081 tcp:8081
  ```
- **Телефон по Wi‑Fi:** телефон и компьютер должны быть в одной сети; в приложении или настройках Expo может понадобиться указать IP компьютера (порт 8081).

**Если пишет «adb не распознан» (или "adb is not recognized"):** в системе не найден Android Debug Bridge. Сделайте по шагам:

1. Узнайте путь к Android SDK: в **Android Studio** → **File** → **Settings** (или **Android Studio** → **Settings** на Mac) → **Languages & Frameworks** → **Android SDK**. Вверху указан **Android SDK Location**, например `C:\Users\PC\AppData\Local\Android\Sdk`.
2. Папка с `adb` — это **`platform-tools`** внутри SDK, например:  
   `C:\Users\PC\AppData\Local\Android\Sdk\platform-tools`
3. Добавьте её в PATH:
   - **Windows:** Поиск → «изменение системных переменных среды» → **Переменные среды** → в **Переменные среды пользователя** выберите **Path** → **Изменить** → **Создать** → вставьте путь к `platform-tools` → **ОК**. Либо в PowerShell для текущей сессии выполните **две команды по очереди** (сначала одну, нажать Enter, потом вторую):
     ```powershell
     $env:Path += ";C:\Users\PC\AppData\Local\Android\Sdk\platform-tools"
     adb reverse tcp:8081 tcp:8081
     ```
     Важно: не вводите обе команды в одну строку — иначе будет ошибка «Непредвиденная лексема "adb"». Сначала первая строка, Enter, затем вторая.
     (Подставьте свой путь к SDK, если он другой.)
4. Закройте и снова откройте терминал, затем выполните:
   ```bash
   adb reverse tcp:8081 tcp:8081
   ```
   Если `adb` по-прежнему не найден — проверьте, что в папке `platform-tools` есть файл `adb.exe`.

**Если «adb не распознан» в терминале Android Studio:** встроенный терминал Android Studio часто не видит ваш PATH (где вы добавили platform-tools). Варианты:
- Выполнять `adb` **в обычном PowerShell или в Cursor**: откройте новый терминал вне Android Studio, добавьте путь к `platform-tools` (команда выше с `$env:Path += ...`), затем выполните `adb reverse tcp:8081 tcp:8081`.
- Либо в терминале Android Studio вызвать `adb` по полному пути (подставьте свой путь к SDK):
  ```powershell
  & "C:\Users\PC\AppData\Local\Android\Sdk\platform-tools\adb.exe" reverse tcp:8081 tcp:8081
  ```

**Если пишет «more than one device/emulator»:** подключено несколько устройств или эмуляторов. Нужно указать, для какого делать проброс порта.

1. Посмотрите список устройств:
   ```bash
   adb devices
   ```
   В списке будут серийные номера, например `emulator-5554` (эмулятор) или длинный ID телефона.

2. Выполните `reverse` для **конкретного** устройства (подставьте свой серийник из вывода `adb devices`):
   ```bash
   adb -s emulator-5554 reverse tcp:8081 tcp:8081
   ```
   Либо, если запущен **только один эмулятор**, можно так:
   ```bash
   adb -e reverse tcp:8081 tcp:8081
   ```
   (`-e` = использовать единственное подключённое эмуляторное устройство.)

### Шаг 3: Запустить или перезагрузить приложение

- Если приложение уже открыто на эмуляторе — в терминале, где запущен Metro, нажмите **R** дважды (Reload).
- Если запускаете из **Android Studio:** откройте папку **`mobile-expo/android`** → **Run** (▶). **Не нажимайте Debug** (жук).
- Если запускаете из терминала:
  ```bash
  cd C:\Users\PC\Desktop\projects\cursor\DeloApp\mobile-expo
  npm run android
  ```
  (Metro при этом может быть уже запущен в другом окне — так и должно быть.)

### Шаг 4: Проверить результат

После Reload или Run приложение должно загрузить бандл и показать интерфейс «Дело». Если ошибка остаётся:

- Убедитесь, что в терминале с Metro нет ошибок и написано что-то вроде «Metro waiting on...».
- Закройте приложение на эмуляторе и снова нажмите **Run** в Android Studio или выполните `npm run android`.
- Перезапустите эмулятор и повторите шаги 1–3.

**Кратко:** сначала всегда запускайте **`npx expo start`** (Metro), затем запускайте приложение (Run или `npm run android`). Для перезагрузки бандла — **R** дважды в терминале с Metro.

### Красный экран на эмуляторе (ошибка приложения)

Если приложение открылось, но экран красный с текстом ошибки (Red Screen):

1. Убедитесь, что **Metro запущен** в отдельном терминале (`npx expo start` из папки `mobile-expo`). Без Metro приложение не может загрузить код.
2. В терминале, где работает Metro, нажмите **R** дважды — перезагрузка бандла. Часто после этого экран пропадает.
3. Если красный экран остаётся — откройте в Android Studio панель **Logcat** (внизу), выберите устройство и фильтр по уровню **Error** или по тегу вашего приложения. Текст ошибки подскажет причину (например, отсутствующий модуль или ошибка в коде).
4. Проверьте, что команды `npm`/`npx` вы выполняли из папки **`mobile-expo`**, а не из `C:\Users\PC` или из `mobile-expo/android`.

### Только чёрный экран, приложение не запускается

Если после Run виден только **чёрный экран** и интерфейс не появляется:

1. **Metro должен быть запущен первым.** Без Metro приложение не получает JavaScript и остаётся на чёрном экране (или на сплеше, затем чёрный).
2. Выполните **по порядку**:
   - Терминал 1: `cd mobile-expo` → `npm install` (один раз) → `npx expo start`. Окно не закрывать.
   - Подождите, пока в терминале появится «Metro waiting on...».
   - Android Studio: **File → Open** → папка **`mobile-expo/android`** → дождаться синхронизации Gradle.
   - Запустите эмулятор (**Tools → Device Manager** → ▶).
   - Нажмите **Run** (▶). Подождите 30–60 секунд — первая загрузка бандла может быть долгой.
3. Если экран по-прежнему чёрный: в терминале с Metro нажмите **R** дважды (Reload). Либо закройте приложение на эмуляторе и снова нажмите **Run**.
4. Если эмулятор не подключается к Metro: в **другом** терминале выполните `adb reverse tcp:8081 tcp:8081` (при нескольких устройствах — `adb -s emulator-5554 reverse tcp:8081 tcp:8081`).

**Порядок критичен:** сначала Metro (`npx expo start` из `mobile-expo`), потом Run в Android Studio.

### Долго загружает или чёрный экран после Run

- **Сборка прошла, экран чёрный:** приложение ждёт JavaScript с Metro. Убедитесь, что **Metro запущен до Run**: в отдельном терминале из папки `mobile-expo` выполните `npx expo start` и не закрывайте окно. Затем в Android Studio нажмите **Run**. Первая загрузка бандла может занять **30–60 секунд** — подождите, на экране может появиться индикатор загрузки или сплеш.
- **«Terminating the app» внизу Android Studio:** Android Studio завершает предыдущий запуск. Пока идёт завершение, кнопка **Run** может быть неактивна или новый запуск не начнётся. Дождитесь, пока индикатор «Terminating the app» исчезнет (прогресс-бар дойдёт до конца), затем снова нажмите **Run**. Не нажимайте Run несколько раз подряд — это может только продлить завершение.
- **Всё равно долго или чёрный экран:** в терминале с Metro нажмите **R** дважды (перезагрузка бандла). Если эмулятор не подключается к Metro, в другом терминале выполните `adb reverse tcp:8081 tcp:8081` (при нескольких устройствах — `adb -s emulator-5554 reverse tcp:8081 tcp:8081`).
- **Ускорить следующие запуски:** оставляйте Metro запущенным; для перезапуска приложения используйте **Run** в Android Studio или **R** в терминале с Metro, без полной пересборки.

**В терминале Metro пишет «No apps connected. Sending "reload" to all React Native apps failed»:** это значит, что на эмуляторе или телефоне сейчас нет приложения, подключённого к этому Metro. Сделайте так: сначала запустите Metro (`npx expo start`), затем в Android Studio нажмите **Run** — приложение установится и подключится к Metro. После этого команда **R** (reload) будет работать. Если приложение уже запускали, но сообщение не исчезло — проверьте, что эмулятор видит Metro (при необходимости выполните `adb reverse tcp:8081 tcp:8081`).

**Первая сборка бандла 5–6 секунд (например, «Android Bundled 5758ms»)** — это нормально для проекта с большим числом модулей. Следующие перезагрузки (R) будут быстрее (сотни миллисекунд).

---

## Как ещё можно запустить

- **Только Metro** (без сборки): `npm start` — затем в консоли нажмите **a** для Android или отсканируйте QR-код в Expo Go.
- **Через Android Studio:** запустите в другом терминале `npm start`, откройте в Android Studio папку **`mobile-expo/android`**, нажмите **Run** (▶). Debug не используйте.

## Иконка приложения и логотип

- **Иконка на рабочем столе (эмулятор/телефон):** берётся из **`app.json`** → `expo.icon` и `expo.android.adaptiveIcon`. Файлы лежат в **`assets/images/`**:
  - `icon.png` — основная иконка (1024×1024 для Expo).
  - `android-icon-foreground.png`, `android-icon-background.png`, `android-icon-monochrome.png` — для Android (adaptive icon).

Чтобы иконка отображалась после изменений или на новом эмуляторе:
1. Подставьте свои файлы в `assets/images/` (те же имена или обновите пути в `app.json`).
2. Пересоберите нативный проект и установите заново:
   ```bash
   npx expo prebuild --platform android --clean
   npm run android
   ```
   Либо в Android Studio: **Build → Clean Project**, затем **Run**.

- **Логотип внутри приложения:** в шапке сейчас отображается название «Дело». Чтобы добавить картинку-логотип, замените или дополните заголовок в `app/index.tsx` (например, компонентом `Image` с `require('../assets/images/icon.png')`).

## Структура проекта

- **app/** — экраны (expo-router): `_layout.tsx`, `index.tsx` (главный экран).
- **src/** — логика приложения:
  - **types.ts** — типы `Task`, `Settings`, `DayStr` и др.
  - **lib/storage.ts** — сохранение задач и настроек (AsyncStorage).
  - **lib/tasks.ts** — создание задач, перенос, статистика по дням.
  - **lib/notifications.ts** — уведомления (напоминания по задачам, ежедневные, просроченные).
- **hooks/use-color-scheme.ts** — тема (используется в `_layout.tsx`).
- **plugins/withAndroidExported.js** — плагин Expo для `android:exported` в манифесте.

## Пути в проекте и неясности

Проверка путей и элементов: что откуда берётся и где возможны расхождения.

### Пути, которые работают (проверены)

| Назначение | Путь | Откуда используется |
|------------|------|----------------------|
| Корень проекта (alias `@/`) | `mobile-expo/` | `tsconfig.json` → `paths: { "@/*": ["./*"] }` |
| Хук темы | `@/hooks/use-color-scheme` | `app/_layout.tsx` |
| Типы | `../src/types` | `app/index.tsx` (относительно `app/`) |
| Хранилище | `../src/lib/storage` | `app/index.tsx` |
| Задачи | `../src/lib/tasks` | `app/index.tsx` |
| Уведомления | `../src/lib/notifications` | `app/index.tsx` |
| Типы из lib | `../types` | `src/lib/storage.ts`, `tasks.ts`, `notifications.ts` (относительно `src/lib/`) |
| Иконка и сплеш | `./assets/images/icon.png` и др. | `app.json` (относительно корня `mobile-expo`) |
| Плагин Android | `./plugins/withAndroidExported.js` | `app.json` → `plugins` |
| Точка входа | `expo-router/entry` | `package.json` → `main` (резолвит Metro) |
| Линт | `app src hooks` | `package.json` → `scripts.lint` (папки без `components`) |

Все эти пути ведут к существующим файлам; импорты и конфиги согласованы.

### Где возможны неясности или расхождения

1. **Путь к проекту в README**  
   В инструкциях везде указан каталог `C:\Users\PC\Desktop\projects\cursor\DeloApp\mobile-expo`. На другом компьютере или при переносе репозитория путь будет другим — везде нужно подставлять свой каталог (или перейти в него вручную). Относительные шаги («откройте папку `mobile-expo/android`») имеют в виду: из корня репозитория DeloApp открыть подпапку `mobile-expo/android`.

2. **Путь к JDK в Gradle**  
   В **`android/gradle.properties`** задано:  
   `org.gradle.java.home=C:\\Program Files\\Android\\Android Studio\\jbr`  
   Это путь к встроенному JBR в типичной установке Android Studio на Windows. Если Android Studio установлена в другое место или вы используете свой JDK, сборка может ругаться на Java. Что сделать: в **Android Studio** → **File → Settings → Build, Execution, Deployment → Build Tools → Gradle** посмотреть **Gradle JDK**, скопировать путь к нему и прописать его в `android/gradle.properties` в `org.gradle.java.home` (с двойными обратными слэшами `\\` в пути).

3. **Папка `components`**  
   В проекте нет папки `components`. Команда `npm run lint` запускает `eslint app src hooks`, поэтому линт не зависит от `components`. Если в будущем добавить папку `components`, при желании можно снова перейти на `expo lint` (тогда ESLint будет проверять и её).

4. **Ссылка «Сайт» в приложении**  
   В настройках кнопка «Сайт» открывает `https://delodelai.ru` (жёстко прописано в `app/index.tsx`). При смене домена или страницы нужно править этот URL в коде.

5. **Схема и пакет приложения**  
   В `app.json`: `scheme: "app.delodelai"`, Android `package: "app.delodelai"`. Deep links и установка второго варианта приложения с тем же package на одном устройстве могут конфликтовать — при смене пакета нужно обновить и scheme, и все места, где используется идентификатор приложения.

Итог: все рабочие пути проверены; неясности касаются только пользовательского пути к проекту, пути к JDK на конкретной машине, отсутствующей папки `components`, жёстко заданного URL сайта и возможной смены package/scheme.

### Адаптивность под разные устройства

Вёрстка построена на **Flexbox** и **SafeAreaView**, ширина календаря подстраивается под ширину экрана (`Dimensions.get('window').width`). Чтобы проверить отображение на разных размерах экрана: в Android Studio **Device Manager** создайте или выберите эмуляторы с разными разрешениями (например, телефон и планшет) и по очереди запускайте приложение (**Run**). При нескольких устройствах/эмуляторах используйте `adb -s <серийник> reverse tcp:8081 tcp:8081` для того устройства, на котором тестируете.

## Запуск (разработка)

```bash
npm install
npx expo start
```

Далее: откройте в эмуляторе Android/iOS или в Expo Go (ограниченная поддержка нативных модулей).

## Сборка и запуск для Android (Android Studio)image.png

Приложение загружает JavaScript с Metro. Без запущенного Metro на эмуляторе будет ошибка загрузки скрипта.

### Вариант 1: одной командой (Metro + сборка + установка)

Перед запуском **запустите эмулятор** (Android Studio → Device Manager → запуск AVD) или подключите телефон с включённой отладкой по USB. Иначе будет ошибка *No Android connected device found, and no emulators could be started automatically*.

```bash
npm install
npm run android
```

### Вариант 2: через Android Studio

1. **Сгенерировать папку android** (если её нет или после смены плагинов):
   ```bash
   npx expo prebuild --platform android --clean
   ```

2. **Открыть проект в Android Studio**
   - **File → Open** → выбрать папку **`mobile-expo/android`** (не корень DeloApp).
   - Дождаться синхронизации Gradle.
   - **Gradle JDK**: если сборка ругается на версию Java, укажите **File → Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle JDK** = встроенный JDK Android Studio (jbr).

3. **Запустить Metro** в терминале (в Cursor или **View → Tool Windows → Terminal** в Android Studio):
   ```bash
   cd C:\Users\PC\Desktop\projects\cursor\DeloApp\mobile-expo
   npx expo start
   ```

4. В Android Studio выбрать эмулятор (например Pixel 7) и нажать **Run** (зелёный треугольник ▶). **Не используйте Debug** (иконка с жуком) — иначе возможна ошибка «Invalid argument: port» и приложение не запустится. С Metro достаточно Run.

5. Если на эмуляторе красный или чёрный экран — проверьте, что Metro запущен, затем в терминале с Metro нажмите **R** дважды (Reload).

## Как обновить все правки для отображения в Android Studio

Чтобы последние изменения кода и ресурсов отображались при запуске из Android Studio:

### Только правки в коде (JS/TS, React, стили)

**Пересборка не нужна.** Приложение подгружает JavaScript с Metro.

1. Сохраните файлы в проекте.
2. В терминале с **Metro** (`npx expo start`) нажмите **`R`** дважды — перезагрузка бандла на эмуляторе.
3. Либо в Android Studio снова нажмите **Run** (▶) — приложение перезапустится и подхватит новый бандл.

Если Metro не запущен — сначала в папке `mobile-expo` выполните:
```bash
npx expo start
```
затем на эмуляторе нажмите **R** дважды или Run в Android Studio.

### Правки в нативной части (иконка, app.json, плагины, разрешения)

Если меняли **`app.json`** (иконки, имя, плагины, разрешения Android) или файлы в **`assets/images/`** для иконки:

1. В терминале перейдите в папку проекта:
   ```bash
   cd C:\Users\PC\Desktop\projects\cursor\DeloApp\mobile-expo
   ```

2. Пересоберите папку `android` и установите приложение заново:
   ```bash
   npx expo prebuild --platform android --clean
   npm run android
   ```
   Либо после `prebuild` откройте проект в Android Studio и запустите оттуда:
   - **File → Open** → папка **`mobile-expo/android`**
   - Дождитесь синхронизации Gradle
   - **Build → Clean Project**
   - Запустите **Run** (▶)

3. Перед запуском на эмуляторе убедитесь, что Metro запущен (`npx expo start` в другом терминале).

### Полное обновление (все правки сразу)

1. **Терминал 1** — Metro:
   ```bash
   cd C:\Users\PC\Desktop\projects\cursor\DeloApp\mobile-expo
   npm install
   npx expo start
   ```

2. **Терминал 2** — при необходимости обновить нативную часть (иконка, app.json):
   ```bash
   cd C:\Users\PC\Desktop\projects\cursor\DeloApp\mobile-expo
   npx expo prebuild --platform android --clean
   npm run android
   ```
   Либо после `prebuild` откройте в Android Studio **`mobile-expo/android`** → **Build → Clean Project** → **Run**.

3. На эмуляторе приложение подхватит новый бандл с Metro; если что-то не обновилось — нажмите **R** дважды в терминале с Metro.

### Если сборка падает (BUILD FAILED, ENOENT или NODE_ENV)

На Windows при падении сборки иногда появляется ошибка **`spawn gradlew.bat ENOENT`** в `cross-spawn`. Часто это следствие того, что **Gradle завершился с кодом 1** (например, из‑за отсутствия NODE_ENV), а не того, что файл не найден. Исправление — задать **NODE_ENV** до запуска сборки.

**Рекомендуемый способ** — запускать сборку скриптом, который сам выставляет NODE_ENV:

```bash
cd C:\Users\PC\Desktop\projects\cursor\DeloApp\mobile-expo
npm run android
```

Либо вручную задать переменную и вызвать Expo:

- **PowerShell:**
  ```powershell
  cd C:\Users\PC\Desktop\projects\cursor\DeloApp\mobile-expo
  $env:NODE_ENV = "development"
  npx expo run:android
  ```
- **CMD:**
  ```cmd
  cd C:\Users\PC\Desktop\projects\cursor\DeloApp\mobile-expo
  set NODE_ENV=development
  npx expo run:android
  ```

Если нужно запустить только Gradle (без Metro) из папки `android`, задайте NODE_ENV перед вызовом:

```powershell
cd C:\Users\PC\Desktop\projects\cursor\DeloApp\mobile-expo
$env:NODE_ENV = "development"
cd android
.\gradlew.bat app:assembleDebug -x lint -x test
```

В Android Studio: открывайте **`mobile-expo/android`**, дождитесь синхронизации Gradle, затем используйте **Run** (▶), а не Debug. Для обновления кода достаточно Metro + Reload (R дважды); полная пересборка — через **Build → Clean Project**, затем **Run**.

**Ошибка «Failed to create MD5 hash for ... libappmodules.so...tmp» или «add_subdirectory ... codegen/jni/ which is not an existing directory»** — это повреждённый кэш нативной сборки или порядок шагов после очистки. Что сделать:

1. Закройте **Android Studio** и все терминалы, где запускался Gradle (чтобы папка `android` не была занята).
2. В папке проекта выполните:
   ```bash
   npx expo prebuild --platform android --clean
   ```
   Если `prebuild` выдаёт **EBUSY: resource busy or locked** — закройте всё, что может держать папку `android` (в т.ч. проводник в этой папке), и повторите.
3. **Запустите эмулятор** (Android Studio → Device Manager → запуск AVD) или подключите устройство по USB, затем:
   ```bash
   npm run android
   ```
   Без запущенного эмулятора или устройства появится ошибка *No Android connected device found, and no emulators could be started automatically*.
4. Не запускайте **`gradlew clean`** перед первой сборкой: после clean папки codegen (JNI) удаляются, и CMake падает. Полная пересборка — только через `expo prebuild --clean` и затем сборку.

### Настройка JDK для Gradle (при необходимости)

Если при **BUILD FAILED** в логе есть **ENOENT** или «exited with non-zero code: 1», часто причина — Gradle не находит Java (в терминале не задан `JAVA_HOME` или в PATH старая Java 8). В проекте уже прописан путь к JDK в **android/gradle.properties**:

```properties
org.gradle.java.home=C:\\Program Files\\Android\\Android Studio\\jbr
```

Если Android Studio установлен в другую папку, измените путь в `gradle.properties` или задайте **JAVA_HOME** в системе (переменные среды) на каталог JDK 17 (например, `C:\Program Files\Android\Android Studio\jbr`). После этого снова выполните `npm run android`.

## Основные функции приложения

- Список дел на **сегодня** / **завтра** или выбранный день по календарю.
- Добавление, редактирование, удаление задач; перетаскивание для изменения порядка.
- **Напоминания**: выбор дня (Сегодня/Завтра/Дата) и времени (09:00, 13:00, 15:00 или своё); валидация прошедшей даты.
- Кнопка **«Завтра»** у задачи — перенос дела (и при необходимости напоминания) на завтра.
- **Календарь** «Планы на день» с одной точкой на дату: красная — до даты меньше 7 дней, зелёная — 7 дней и больше.
- **Настройки**: тема (Светлая/Тёмная/Моя), режим списка (Компактный/Развёрнутый), ежедневные уведомления (Утро/Вечер), поддержка.
- **Уведомления**: вкладка в настройках, кнопка «Очистить все».
- Подтверждение удаления с опцией «Больше не спрашивать (3 дня)».

## Скрипты

- `npm start` / `npx expo start` — запуск Metro.
- `npm run android` / `npx expo run:android` — сборка и запуск на Android (рекомендуется `npm run android`: задаёт NODE_ENV и снижает риск BUILD FAILED / ENOENT на Windows).
- `npx expo run:ios` — сборка и запуск на iOS.
- `npm run lint` — проверка кода.

Версия: 1.0.0. Разработано 379team.

---

## Подготовка к релизу (App Store / Play Market) и публикация на GitHub

### Проверка кода перед релизом

- В коде нет `console.log`, `__DEV__`-веток для отладки и тестовых данных.
- Используемые ресурсы: **assets/images/** — `icon.png`, `android-icon-foreground.png`, `android-icon-background.png`, `android-icon-monochrome.png`, `favicon.png`. Сплеш использует `icon.png`. Лишние файлы (например, `splash-icon.png`) удалены.
- **app.json**: указаны `name`, `slug`, `version`, `description`, `bundleIdentifier` / `package`, иконки и разрешения. Для магазинов приложений при публикации дополнительно потребуются: скриншоты, политика конфиденциальности (URL), при необходимости — категория и возрастной рейтинг.

### Публикация кода на GitHub

1. В корне репозитория (DeloApp или mobile-expo, в зависимости от того, что вы храните в Git):
   ```bash
   git add .
   git status
   ```
   Убедитесь, что в коммит не попадают `node_modules/`, `.env*.local`, ключи (`.jks`, `.p8`, `.p12`). Они должны быть в `.gitignore`.

2. Закоммитьте и отправьте изменения:
   ```bash
   git commit -m "Release 1.0.0: готовность к App Store и Play Market, удалён лишний ресурс"
   git push origin main
   ```
   (Замените `main` на имя вашей ветки при необходимости.)

3. Для сборки под магазины удобно использовать **EAS Build** (expo.dev): установите `eas-cli`, настройте `eas.json` и выполняйте сборку в облаке. Локальная папка `android/` в `.gitignore` — при EAS Build она генерируется из `app.json` и плагинов.

### Используемые материалы (актуально на момент релиза)

| Файл | Назначение |
|------|------------|
| `app.json` | Конфигурация Expo: имя, версия, иконки, сплеш, разрешения, scheme. |
| `assets/images/icon.png` | Иконка приложения и изображение сплеш-экрана. |
| `assets/images/android-icon-*.png` | Адаптивная иконка Android (foreground, background, monochrome). |
| `assets/images/favicon.png` | Иконка для веб-сборки. |
| `app/`, `src/`, `hooks/`, `plugins/` | Исходный код приложения. Никакие изображения из кода не подгружаются через `require()` — только конфигурация в `app.json`. |
