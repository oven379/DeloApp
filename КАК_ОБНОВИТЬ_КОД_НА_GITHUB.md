# Как обновить код на GitHub (репозиторий уже есть)

Пошаговая инструкция: как отправить отредактированный код в уже существующий репозиторий на GitHub.

**Важно:** репозиторий Git находится в папке **frontend**. Все команды выполняйте из неё:
`cd c:\Users\PC\Desktop\projects\cursor\DeloApp\frontend`

---

## Если выдаёт «fatal: not a git repository»

Значит, в этой папке Git ещё не инициализирован (нет папки `.git`). Сделайте **один раз**:

1. Перейдите в папку **frontend** в PowerShell:
   ```powershell
   cd c:\Users\PC\Desktop\projects\cursor\DeloApp\frontend
   ```

2. Инициализировать репозиторий:
   ```powershell
   git init
   ```

3. Привязать ваш репозиторий на GitHub (подставьте свой URL):
   ```powershell
   git remote add origin https://github.com/ВАШ_ЛОГИН/ИМЯ_РЕПОЗИТОРИЯ.git
   ```
   Пример: `git remote add origin https://github.com/ivanov/DeloApp.git`

4. Добавить файлы и сделать первый коммит:
   ```powershell
   git add .
   git commit -m "Обновление для iOS: UILaunchScreen, инструкции по GitHub и Xcode"
   git branch -M main
   ```

5. Отправить на GitHub. Если в репозитории на GitHub уже есть коммиты, сначала подтяните их:
   ```powershell
   git pull origin main --allow-unrelated-histories
   ```
   Если попросит сообщение для слияния — закройте открывшийся редактор (в VSCode/Cursor просто закройте вкладку). Затем:
   ```powershell
   git push -u origin main
   ```
   Если основная ветка на GitHub называется `master`, везде используйте `master` вместо `main`.

После этого папка станет полноценным репозиторием, и дальше можно пользоваться обычными шагами ниже (git add → commit → push).

---

## 1. Открыть папку проекта в терминале

1. Нажмите **Win + R**, введите `powershell` и нажмите Enter (или откройте PowerShell из меню Пуск).
2. Перейдите в папку **frontend** (здесь находится репозиторий):
   ```powershell
   cd c:\Users\PC\Desktop\projects\cursor\DeloApp\frontend
   ```
   Если проект лежит в другом месте — укажите путь к папке, в которой есть папка `.git`.

---

## 2. Проверить, что Git видит изменения

Выполните:

```powershell
git status
```

Вы увидите список изменённых и новых файлов (например, `Info.plist`, `ПЕРЕДАЧА_НА_ВЫКЛАДКУ_IOS.md`, `ЧТО_ДЕЛАТЬ_ДАЛЬШЕ.md` и т.д.). Это нормально — значит, Git видит правки.

---

## 3. Добавить все изменения в индекс

Добавить в «корзину» перед коммитом все изменённые и новые файлы:

```powershell
git add .
```

Точка в конце значит «все файлы в этой папке». Файлы из `.gitignore` (например, `node_modules`, `dist`) не попадут в коммит — так и задумано.

---

## 4. Создать коммит (сохранённая версия)

Напишите короткое сообщение, что изменили, и сделайте коммит:

```powershell
git commit -m "Обновление для iOS: UILaunchScreen, инструкции по GitHub и Xcode"
```

Если хотите своё сообщение — замените текст в кавычках. Без кавычек с пробелами команда может отработать некорректно.

---

## 5. Отправить изменения на GitHub

Отправка в удалённый репозиторий (ветка `main`):

```powershell
git push origin main
```

- **origin** — имя удалённого репозитория (обычно так и остаётся).
- **main** — ветка. Если у вас ветка называется `master`, используйте:
  ```powershell
  git push origin master
  ```

При первом `git push` в этой сессии Windows может открыть окно входа в GitHub (логин/пароль или браузер). Войдите в аккаунт, с которым связан репозиторий.

---

## 6. Убедиться, что всё залилось

1. Откройте в браузере ваш репозиторий на GitHub (например, `https://github.com/ВАШ_ЛОГИН/DeloApp`).
2. Обновите страницу (F5).
3. Проверьте:
   - последний коммит с вашим сообщением отображается сверху;
   - изменённые файлы (например, в `frontend/ios/App/App/Info.plist`, корневые `.md`) показывают новые версии.

После этого обновлённый код уже на GitHub. На Mac можно делать `git pull` и собирать в Xcode.

---

## Если что-то пошло не так

### Ошибка: «failed to push some refs» / «Updates were rejected»

Кто-то (или вы с другого компьютера) уже пушил в этот репозиторий. Сначала подтяните изменения с GitHub, потом снова пушьте:

```powershell
git pull origin main
```

Если попросит ввести сообщение для слияния — сохраните файл и закройте (в VSCode/Cursor просто закройте вкладку с сообщением коммита). Затем:

```powershell
git push origin main
```

Если ветка у вас `master`, везде используйте `master` вместо `main`.

---

### Ошибка: «remote: Permission denied» или «Authentication failed»

GitHub не принимает старый пароль. Нужна авторизация:

1. На GitHub: **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)** → **Generate new token**. Дайте право `repo`.
2. Скопируйте токен (один раз показывается).
3. При следующем `git push` введите логин GitHub и **вместо пароля вставьте этот токен**.

Либо настройте вход через **Git Credential Manager** (при `git push` откроется браузер для входа в GitHub).

---

### Команда «git» не найдена

Значит, Git не установлен или не добавлен в PATH. Скачайте установщик: https://git-scm.com/download/win. Установите, перезапустите PowerShell и снова выполните команды из шагов 2–5.

---

### Узнать имя ветки и адрес репозитория

Текущая ветка:

```powershell
git branch
```

Звёздочка будет рядом с активной веткой (например, `* main`).

Адрес удалённого репозитория:

```powershell
git remote -v
```

Будет выведен URL вида `https://github.com/.../DeloApp.git` — это и есть ваш репозиторий на GitHub.

---

## Краткая шпаргалка (репозиторий уже есть)

```powershell
cd c:\Users\PC\Desktop\projects\cursor\DeloApp
git status
git add .
git commit -m "Обновление для iOS: UILaunchScreen, инструкции по GitHub и Xcode"
git push origin main
```

После этого код на GitHub обновлён. На Mac: `git pull origin main` в папке проекта, затем сборка в Xcode по инструкции из **ЧТО_ДЕЛАТЬ_ДАЛЬШЕ.md**.
