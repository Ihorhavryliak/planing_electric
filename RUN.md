# Як запустити DrawMyPlace

Покрокова інструкція для локального запуску. Порти за замовчуванням:

| Сервіс | Адреса |
|---|---|
| Веб-застосунок | <http://localhost:3004> |
| API | <http://localhost:5004> |
| Перевірка API | <http://localhost:5004/api/v1/health> |
| Перевірка API + PostgreSQL | <http://localhost:5004/api/v1/health/ready> |
| PostgreSQL | `localhost:5432` |

## 1. Що потрібно встановити

- **Node.js 22.12+** — перевірка: `node -v`
- **pnpm 9.5** — перевірка: `pnpm -v`
- **PostgreSQL 17** — Docker Desktop або локальний сервер
- **Git** — для роботи з репозиторієм

Якщо `pnpm` не встановлений:

```bash
corepack enable
corepack prepare pnpm@9.5.0 --activate
```

Альтернатива:

```bash
npm install -g pnpm@9.5.0
```

## 2. Перший запуск

Усі команди виконуються з кореня проєкту (там, де лежить `package.json`).

### Крок 1. Встановити залежності

```bash
pnpm install
```

### Крок 2. Створити файл `.env`

**Windows PowerShell:**

```powershell
Copy-Item .env.example .env
```

**Git Bash, macOS або Linux:**

```bash
cp .env.example .env
```

Перевірте вміст `.env`:

```env
NODE_ENV=development
API_PORT=5004
WEB_PORT=3004
WEB_ORIGIN=http://localhost:3004
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/drawmyplace
SESSION_TTL_DAYS=30
AUTH_RATE_LIMIT=10
AUTH_RATE_WINDOW_MINUTES=15
```

`.env` не комітиться в git. Змінюйте значення під своє середовище.

### Крок 3. Запустити PostgreSQL

**Варіант A — Docker Desktop (рекомендовано):**

1. Запустіть Docker Desktop і дочекайтеся, поки він стане готовий.
2. У корені проєкту виконайте:

```bash
pnpm db:up
```

3. Перевірте, що контейнер запущений:

```bash
docker ps
```

**Варіант B — локальний PostgreSQL:**

Створіть базу `drawmyplace` і користувача, який має до неї доступ. Потім вкажіть свої дані в `DATABASE_URL`, наприклад:

```env
DATABASE_URL=postgresql://my_user:my_password@localhost:5432/drawmyplace
```

### Крок 4. Застосувати міграції

```bash
pnpm db:migrate
```

Ця команда створює всі таблиці, enum-и, індекси та зовнішні ключі в базі з `DATABASE_URL`. Повторний запуск безпечний: уже застосовані міграції пропускаються.

### Крок 5. Запустити застосунок

```bash
pnpm dev
```

Команда одночасно запускає:

- API на <http://localhost:5004>
- веб-застосунок на <http://localhost:3004>

Відкрийте <http://localhost:3004>. На картці **System check** API і PostgreSQL мають бути **Online**.

Далі відкрийте <http://localhost:3004/register>, створіть акаунт і перевірте, що вас перекинуло на захищену сторінку <http://localhost:3004/app>. Вихід — кнопка **Sign out** у шапці.

На сторінці **Your electrical plans** створіть перший проєкт, відкрийте його, змініть назву або опис, збережіть зміни та перевірте архівування й відновлення. Проєкти інших користувачів недоступні: API повертає `404`.

## 3. Перевірка, що все працює

```bash
curl http://localhost:5004/api/v1/health
```

Очікувана відповідь:

```json
{
  "status": "ok",
  "service": "drawmyplace-api",
  "version": "0.1.0",
  "timestamp": "..."
}
```

```bash
curl http://localhost:5004/api/v1/health/ready
```

Очікувана відповідь:

```json
{
  "status": "ready",
  "database": "up",
  "timestamp": "..."
}
```

Якщо друга команда повертає `503` і `"Database is unavailable"`, API працює, але PostgreSQL недоступний або міграції не застосовані.

### Перевірка авторизації

Реєстрація зі збереженням cookie:

```bash
curl -c cookies.txt -X POST http://localhost:5004/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"correct-horse-battery"}'
```

Поточний користувач:

```bash
curl -b cookies.txt http://localhost:5004/api/v1/users/me
```

Вихід:

```bash
curl -b cookies.txt -X POST http://localhost:5004/api/v1/auth/logout
```

Після виходу `GET /users/me` з тим самим cookie має повертати `401`. У Windows PowerShell використовуйте `curl.exe`, бо `curl` там є аліасом `Invoke-WebRequest`.

### Перевірка проєктів

Створення проєкту з тим самим cookie:

```bash
curl -b cookies.txt -X POST http://localhost:5004/api/v1/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"Test apartment","description":"Ground floor"}'
```

Список активних проєктів:

```bash
curl -b cookies.txt "http://localhost:5004/api/v1/projects?status=active"
```

Архівування та відновлення (підставте `id` з відповіді):

```bash
curl -b cookies.txt -X POST http://localhost:5004/api/v1/projects/<id>/archive
curl -b cookies.txt -X POST http://localhost:5004/api/v1/projects/<id>/restore
```

## 4. Запуск без PostgreSQL

Це можливо для роботи над інтерфейсом або API без бази:

```bash
pnpm dev
```

- Веб-застосунок відкривається.
- `GET /api/v1/health` повертає `200`.
- `GET /api/v1/health/ready` повертає `503`.
- На головній сторінці PostgreSQL буде позначений як **Offline** — це очікувано.

Повноцінно створювати проєкти й користувачів без бази не можна. `POST /auth/register` і `POST /auth/login` у цьому режимі повертатимуть `500`, бо їм потрібен PostgreSQL. `GET /users/me` без cookie повертає `401` — це очікувано.

## 5. Окремі команди

| Команда | Що робить |
|---|---|
| `pnpm dev` | Запускає API і веб одночасно в режимі розробки |
| `pnpm --filter @drawmyplace/api dev` | Запускає лише API |
| `pnpm --filter @drawmyplace/web dev` | Запускає лише веб |
| `pnpm build` | Збирає всі пакети, API і веб |
| `pnpm typecheck` | Перевіряє TypeScript у всіх пакетах |
| `pnpm lint` | Запускає ESLint |
| `pnpm test` | Запускає всі тести (Vitest + PGlite) |
| `pnpm db:generate` | Генерує нову міграцію після зміни схеми |
| `pnpm db:migrate` | Застосовує міграції до бази |
| `pnpm db:up` | Піднімає PostgreSQL у Docker |
| `pnpm db:down` | Зупиняє PostgreSQL у Docker |

Після `pnpm build` можна запустити production-версії:

```bash
pnpm --filter @drawmyplace/api start
pnpm --filter @drawmyplace/web preview
```

## 6. Як змінити порти

Порти читаються з кореневого `.env`:

```env
API_PORT=5004
WEB_PORT=3004
WEB_ORIGIN=http://localhost:3004
```

- `API_PORT` — порт NestJS API.
- `WEB_PORT` — порт Vite.
- `WEB_ORIGIN` — адреса веба для CORS на API.

Якщо змінюєте порт веба, обов'язково оновіть `WEB_ORIGIN`, щоб CORS продовжував працювати. Після зміни `.env` перезапустіть `pnpm dev`.

Порт PostgreSQL заданий у `infra/docker-compose.yml` (`5432`) і в `DATABASE_URL`. Якщо 5432 зайнятий, змініть мапінг порту в compose-файлі та `DATABASE_URL` разом.

## 7. Типові проблеми

### `pnpm: command not found`

Встановіть pnpm через `corepack` або `npm install -g pnpm@9.5.0` (див. розділ 1).

### `failed to connect to the docker API ... dockerDesktopLinuxEngine`

Docker CLI встановлений, але демон не запущений. Запустіть Docker Desktop. Якщо Docker Desktop не встановлений, використайте локальний PostgreSQL і не виконуйте `pnpm db:up`.

### Readiness повертає `503` / `Database is unavailable`

Перевірте:

1. PostgreSQL запущений (`docker ps` або служба PostgreSQL).
2. `DATABASE_URL` у `.env` правильний.
3. Міграції застосовані: `pnpm db:migrate`.

### Реєстрація або вхід повертає `500`

Найчастіше PostgreSQL недоступний або міграції не застосовані. Відкрийте <http://localhost:5004/api/v1/health/ready>: якщо там `503`, виконайте кроки з попереднього розділу.

### Реєстрація повертає `409`

Акаунт з такою електронною поштою вже існує. Увійдіть або використайте іншу адресу.

### Вхід або реєстрація повертає `429 Too Many Requests`

Спрацював ліміт спроб: за замовчуванням 10 запитів на 15 хвилин з однієї IP-адреси для кожного маршруту. Зачекайте або змініть `AUTH_RATE_LIMIT` і `AUTH_RATE_WINDOW_MINUTES` у `.env`, після чого перезапустіть API.

### `/users/me` повертає `401` після входу

Cookie сесії не зберігся, протермінувався або сесію відкликано. Увійдіть знову. Переконайтеся, що відкриваєте застосунок через `http://localhost:3004` (а не інший хост) і що API запущений.

### `EADDRINUSE` або `Port 3004 is already in use`

Порт зайнятий іншим процесом. Змініть `API_PORT`/`WEB_PORT` у `.env` і перезапустіть `pnpm dev`. Vite налаштований з `strictPort`, тому не перемикається на інший порт мовчки.

### `password authentication failed for user "postgres"`

Пароль або користувач у `DATABASE_URL` не збігається з налаштуваннями PostgreSQL. Виправте `DATABASE_URL` або створіть відповідного користувача.

### Зміни в `.env` не застосовуються

Файл `.env` має лежати в корені проєкту, поруч із `package.json`. Після редагування перезапустіть `pnpm dev`.

### Веб відкривається, але API-запити падають

Переконайтеся, що API запущений на `API_PORT` (за замовчуванням 5004) і що `WEB_ORIGIN` збігається з фактичною адресою веба. Vite проксіює `/api` на API автоматично.

## 8. Структура проєкту

```text
apps/
  api/        NestJS API
  web/        React + Vite + Tailwind
packages/
  contracts/  Спільні Zod-схеми
  database/   Drizzle-схема, міграції, клієнт PostgreSQL
infra/
  docker-compose.yml
```

## 9. Безпека

- Не комітьте `.env` і не публікуйте його вміст.
- Паролі хешуються Argon2id. У базі зберігається лише SHA-256 хеш токена сесії, а не сам токен.
- Cookie сесії має `HttpOnly`, `SameSite=Lax`, а в production — `Secure`.
- Авторизація проєктів перевіряє власника (`createdBy`): чужі проєкти повертають `404`. Організації, ролі та спільний доступ ще не реалізовані — не відкривайте застосунок у публічний доступ для командної роботи.
- Ліміт спроб входу зберігається в пам'яті процесу: після перезапуску скидається і не спільний між кількома інстансами API.
