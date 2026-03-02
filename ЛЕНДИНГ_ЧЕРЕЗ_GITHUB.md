# Как выложить лендинг через GitHub (GitHub Pages)

Пошаговая инструкция: от репозитория до работающего сайта.

---

## Вариант 1: Отдельный репозиторий только для лендинга (проще всего)

Так сайт сразу откроется по адресу `ваш-логин.github.io/имя-репо`, а при желании можно привязать свой домен.

### Шаг 1. Создать репозиторий на GitHub

1. Откройте **https://github.com** и войдите в аккаунт.
2. Нажмите **«+»** → **«New repository»**.
3. Укажите:
   - **Repository name:** например `delo-landing` или `delodelai`.
   - **Public**.
   - **НЕ** ставьте галочку «Add a README» (репозиторий будет пустой).
4. Нажмите **«Create repository»**.

Ссылка: https://github.com/new  

---

### Шаг 2. Залить файлы лендинга в репозиторий

Нужны только файлы из папки **`landing`**: `index.html`, папка **`my-story`** (внутри `index.html`), папка **`privacy`** (внутри `index.html`), `styles.css`, `logo.png`, `favicon-32.png`, `favicon.svg`, папка **`screenshots`** со всеми картинками.

**Способ A — через сайт GitHub (без Git в системе):**

1. На странице созданного репозитория нажмите **«uploading an existing file»**.
2. Перетащите в окно браузера **все файлы и папки** из папки `landing` (содержимое, не саму папку).
3. Внизу напишите коммит, например: `Первый коммит: лендинг Дело`.
4. Нажмите **«Commit changes»**.

**Способ B — через командную строку (если установлен Git):**

Откройте терминал в папке проекта и выполните:

```bash
cd c:\Users\PC\Desktop\projects\cursor\DeloApp

# Создать новую папку для репо лендинга и скопировать туда файлы
mkdir delo-landing-gh
xcopy landing\* delo-landing-gh\ /E /I

cd delo-landing-gh

# Инициализировать Git и первый коммит
git init
git add .
git commit -m "Первый коммит: лендинг Дело"

# Подключить удалённый репозиторий (замените YOUR_USERNAME и delo-landing на свои)
git remote add origin https://github.com/YOUR_USERNAME/delo-landing.git

# Отправить код (ветка main)
git branch -M main
git push -u origin main
```

Вместо `YOUR_USERNAME/delo-landing` подставьте свой логин GitHub и имя репозитория.

---

### Шаг 3. Включить GitHub Pages

1. В репозитории откройте **«Settings»** (вкладка сверху).
2. Слева выберите **«Pages»** (в блоке «Code and automation»).
3. В разделе **«Build and deployment»**:
   - **Source:** выберите **«Deploy from a branch»**.
   - **Branch:** выберите **`main`** (или `master`), папка **`/ (root)`**.
4. Нажмите **«Save»**.

Через 1–2 минуты сайт будет доступен по адресу:

- **https://ВАШ_ЛОГИН.github.io/ИМЯ_РЕПОЗИТОРИЯ/**  

Например: `https://ivanov.github.io/delo-landing/`

Справка: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site  

---

### Шаг 4. (По желанию) Привязать свой домен delodelai.ru

1. В корне репозитория на GitHub нажмите **«Add file»** → **«Create new file»**.
2. Имя файла: **`CNAME`** (без расширения, только так).
3. В теле файла одна строка: **`delodelai.ru`**.
4. **«Commit new file»**.
5. Снова **Settings** → **Pages** → в поле **«Custom domain»** введите **`delodelai.ru`** → **Save**.
6. У регистратора домена добавьте DNS-записи (см. файл **ПОДКЛЮЧЕНИЕ_ДОМЕНА_К_ЛЕНДИНГУ.md**, раздел «Вариант C: GitHub Pages»).

---

## Вариант 2: Лендинг лежит в подпапке общего репозитория

Если весь проект DeloApp уже в одном репозитории и папка `landing` внутри него:

1. Откройте репозиторий на GitHub → **Settings** → **Pages**.
2. **Source:** «Deploy from a branch».
3. **Branch:** `main` (или ваша основная ветка).
4. **Folder:** выберите **`/landing`** (а не root).
5. **Save**.

Сайт будет по адресу: **https://ВАШ_ЛОГИН.github.io/ИМЯ_РЕПО/** (например, `https://ivanov.github.io/DeloApp/`).

Для своего домена в этом случае тоже создайте файл **CNAME** в **корне репозитория** (не в папке landing) с одной строкой `delodelai.ru`, и в **Settings → Pages** укажите Custom domain.

---

## Как обновить лендинг на GitHub (залить изменения)

После того как вы изменили файлы лендинга на компьютере, их нужно снова отправить в репозиторий. Есть два способа — в зависимости от того, как вы изначально заливали сайт.

### Способ A: Через сайт GitHub (без Git)

1. Откройте **свой репозиторий** на GitHub (тот, где лежит лендинг).
2. Перейдите в нужную папку или к нужному файлу (например, `index.html` или `my-story/index.html`).
3. Нажмите на **название файла** → откроется просмотр. Справа нажмите **иконку карандаша** («Edit this file»).
4. Внесите изменения в текст (или вставьте скопированное содержимое обновлённого файла с компьютера).
5. Внизу страницы в поле **Commit message** напишите, что изменили, например: `Обновление текста на странице истории`.
6. Нажмите **«Commit changes»**.

**Если изменили много файлов или добавили новые (папки, картинки):**

1. На странице репозитория нажмите **«Add file»** → **«Upload files»**.
2. Перетащите в окно **все файлы и папки** из папки `landing` с вашего компьютера (как при первой загрузке). Файлы с теми же именами **заменятся** на новые.
3. Внизу напишите коммит, например: `Обновление лендинга: правки текста и структура my-story, privacy`.
4. Нажмите **«Commit changes»**.

Через 1–2 минуты GitHub Pages подхватит изменения, и сайт обновится.

---

### Способ B: Через Git в терминале

Если вы работаете с репозиторием через Git (делали `git clone` или `git init` + `git remote`), обновления делаются так.

**Если лендинг — отдельная папка (отдельный репозиторий), например `delo-landing-gh`:**

```bash
cd путь\к\папке\delo-landing-gh

# Скопировать свежие файлы из проекта (если лендинг правите в DeloApp)
# Например: xcopy /E /I /Y c:\Users\PC\Desktop\projects\cursor\DeloApp\landing\* .

git add .
git status
git commit -m "Обновление лендинга: текст, ссылки, структура"
git push origin main
```

**Если весь проект DeloApp — один репозиторий и лендинг в папке `landing`:**

```bash
cd c:\Users\PC\Desktop\projects\cursor\DeloApp

git add landing/
git status
git commit -m "Обновление лендинга: правки на странице истории и др."
git push origin main
```

- `git add landing/` — добавляет все изменения в папке `landing`.
- `git status` — показывает, какие файлы будут в коммите (можно не выполнять).
- `git commit -m "..."` — фиксирует изменения с сообщением.
- `git push origin main` — отправляет коммиты на GitHub (ветка может называться `master` — тогда пишите `git push origin master`).

После `git push` GitHub Pages автоматически пересоберёт сайт, и через 1–2 минуты обновления появятся на delodelai.ru (или на вашем адресе github.io).

---

## Важно: ссылки внутри лендинга

- Ссылки на страницы: главная — `/`, история — `/my-story/`, политика — `/privacy/`. При публикации на GitHub Pages или с доменом **delodelai.ru** адреса будут: `delodelai.ru/`, `delodelai.ru/my-story/`, `delodelai.ru/privacy/`.

---

## Полезные ссылки

| Что | Ссылка |
|-----|--------|
| Создать репозиторий | https://github.com/new |
| Документация GitHub Pages | https://docs.github.com/en/pages |
| Кастомный домен для Pages | https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site |

После выполнения шагов 1–3 лендинг уже будет доступен по ссылке вида `https://ваш-логин.github.io/имя-репо/`.
