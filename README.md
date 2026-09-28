# MELLCOIN

> ⚠️ **Work in progress — the project is unfinished.**
> An attempt to build a faithful (and better) copy of an existing tap-to-earn game in the style of
> Notcoin. The core game loop works; many features are still stubs — see
> [«Что не сделано намеренно»](#что-не-сделано-намеренно) at the end.
>
> **English summary.** Web client in React (Vite), backend in NestJS with Socket.IO and PostgreSQL.
> Taps are batched on the client every 250 ms, applied to in-memory player state on the server and
> flushed to PostgreSQL in a single transaction every 3 s; energy is computed lazily from timestamps
> instead of per-player timers. Login/password auth with the session in an httpOnly cookie, leagues,
> boosts and a Docker Compose setup (Postgres + API + nginx). Not done yet: Telegram Mini App auth,
> anti-cheat, migrations, referrals, task rewards, tests.
>
> **Проект не доделан** — это моя попытка сделать точную (и даже лучшую) копию существующей игры.

Тап-ту-эрн игра в стиле Notcoin (1 сезон). База: веб-приложение без Telegram-интеграции,
авторизация логин/пароль на отдельной странице, сессия в httpOnly-куке.

**Стек:** TypeScript · NestJS · PostgreSQL (TypeORM) · WebSocket (socket.io) · React (Vite)

---

## Запуск

Есть два режима. Для написания кода — первый, для проверки системы целиком — второй.

### Вариант A: разработка (hot reload)

```bash
npm install
```

```bash
npm run db:up
```

```bash
npm run dev
```

- Клиент: http://localhost:5173
- API: http://localhost:3000/api

### Вариант B: всё в Docker

Требуется запущенный Docker Desktop.

```bash
npm run docker:up
```

- Клиент: http://localhost:8080
- API: http://localhost:3000/api

Поднимает три контейнера — база, бэкенд, фронтенд. Подробный разбор
с пояснениями: **[DOCKER.md](DOCKER.md)**.

Режимы конфликтуют за порт 3000 — запускайте что-то одно.

Схема БД создаётся автоматически (`DB_SYNCHRONIZE=true`) — миграции не нужны.

### Полезные команды

| Команда | Что делает |
| --- | --- |
| `npm run dev` | Сервер и клиент одновременно (hot reload) |
| `npm run dev:server` | Только NestJS (watch) |
| `npm run dev:client` | Только Vite |
| `npm run db:up` / `db:down` | Поднять / остановить только PostgreSQL |
| `npm run db:reset` | Снести том с данными и поднять чистую БД |
| `npm run build` | Прод-сборка сервера и клиента |
| `npm run docker:up` | Собрать образы и поднять всю систему |
| `npm run docker:down` | Остановить контейнеры (данные остаются) |
| `npm run docker:logs` | Логи всех сервисов в реальном времени |
| `npm run docker:ps` | Статус контейнеров |
| `npm run docker:reset` | Полный сброс: снести данные и пересобрать |

---

## Структура

```
server/                 NestJS
  src/config/           game.config.ts — вся экономика игры в одном файле
  src/admin/            тестовая админка без авторизации (по флагу)
  src/database/         сущность User
  src/auth/             регистрация, вход, JWT в куке
  src/users/            доступ к БД, пакетная запись, топ игроков
  src/game/             player-state.ts (правила), game.service.ts (RAM+флаш),
                        game.gateway.ts (WebSocket), game.controller.ts (REST)
  src/common/           AuthGuard, socket.io-адаптер, health

client/                 React + Vite
  src/hooks/GameProvider.tsx   сокет, оптимистичные тапы, батчинг
  src/pages/                   Login, Admin, Game (Главный / Бусты /
                               Задания / Френы / Лиги)
  src/components/              Emoji (декоратор), CoinArt, LeagueTrophy,
                               Sheet, Icons
  src/lib/emoji-map.generated.ts  карта эмодзи -> картинка (генерируется)
  public/emoji/                картинки эмодзи Apple
  src/styles/global.css        тёмная тема в духе Notcoin
  nginx.conf                   SPA-fallback и кеширование для Docker

scripts/sync-emoji.mjs  скачивает эмодзи Apple и строит карту

docker-compose.yml      три сервиса: postgres, server, client
server/Dockerfile       многостадийная сборка NestJS
client/Dockerfile       сборка Vite -> отдача через nginx
DOCKER.md               разбор всего этого с пояснениями
```

---

## Как устроена обработка тапов

Тап **не идёт в базу**. Путь такой:

1. **Клиент** сразу рисует `+N` и списывает энергию локально (оптимистичный UI),
   а тапы копит в счётчике.
2. Раз в **250 мс** накопленная пачка уходит одним сообщением `tap { count }`.
3. **Сервер** держит игрока в `Map` в памяти, применяет пачку и отвечает лёгким
   `tap:ack` — только баланс и энергия.
4. Раз в **3 секунды** все изменённые игроки пишутся в PostgreSQL одной транзакцией.
   Ещё один флаш — при отключении последнего сокета игрока.

Энергия считается **лениво**: в БД лежат `energy` и `energyUpdatedAt`, реальное
значение вычисляется по прошедшему времени при первом обращении. Никаких
фоновых таймеров на каждого игрока.

Из ограничений на клиента стоит только мягкий token bucket
(`MAX_TAPS_PER_SECOND`) — это защита от мусорных пакетов, а не античит.
Настоящий ограничитель — энергия, она же источник правды на сервере.

---

## Экономика

Всё правится в [`server/src/config/game.config.ts`](server/src/config/game.config.ts).

**Улучшения** (покупаются за монеты, цена растёт по формуле):

| Буст | Эффект | Уровни | Цена 1-го апгрейда |
| --- | --- | --- | --- |
| Multitap | +1 монета за тап | до 20 | 1 000 (×2 за уровень) |
| Energy Limit | +500 к запасу энергии | до 20 | 1 000 (×2 за уровень) |
| Recharge Speed | +1 энергии/сек | до 5 | 5 000 (×4 за уровень) |

**Бесплатные дневные бустеры** (сброс в 00:00 UTC): полная энергия — 6 раз,
турбо ×5 на 20 секунд — 3 раза.

**Лиги** считаются по `totalEarned` за всё время:

| Лига | Порог входа |
| --- | --- |
| Bronze | 0 |
| Silver | 200 000 |
| Gold | 1 000 000 |
| Platinum | 5 000 000 |
| Diamond | 10 000 000 |

---

## API

Все защищённые запросы ходят с `credentials: include` — токен лежит в httpOnly-куке.

| Метод | Путь | Описание |
| --- | --- | --- |
| POST | `/api/auth/register` | `{ username, password }`, ставит куку |
| POST | `/api/auth/login` | то же, для существующего аккаунта |
| POST | `/api/auth/logout` | чистит куку |
| GET | `/api/auth/me` | текущий пользователь |
| GET | `/api/game/config` | лиги, таблица цен бустов, лимиты |
| GET | `/api/game/state` | полное состояние игрока |
| GET | `/api/game/leaderboard` | топ-100, своя позиция, онлайн |
| POST | `/api/game/tap` | `{ count }` — запасной путь без сокета |
| POST | `/api/game/boost/buy` | `{ type }` |
| POST | `/api/game/boost/daily` | `{ type }` |

### WebSocket

Авторизация — по той же куке из handshake.

| Направление | Событие | Данные |
| --- | --- | --- |
| → | `tap` | `{ count }` |
| → | `boost:buy` | `{ type }` |
| → | `boost:daily` | `{ type }` |
| → | `sync` | — |
| ← | `state` | полное состояние |
| ← | `tap:ack` | баланс, энергия, лига |
| ← | `leaderboard` | топ (рассылается раз в 10 с) |
| ← | `action:error` | `{ message }` |
| ← | `unauthorized` | кука невалидна |

---

## Конфигурация

При локальном запуске переменные берутся из `server/.env` (по образцу
`.env.example`). В Docker этот файл не читается — там всё приходит из
`docker-compose.yml`.

```
PORT=3000
DB_HOST=localhost           # в Docker: postgres
DB_PORT=5433                # в Docker: 5432
DB_USER=mellcoin
DB_PASSWORD=mellcoin
DB_NAME=mellcoin
DB_SYNCHRONIZE=true         # автосоздание схемы; для прода false + миграции
JWT_SECRET=dev_super_secret_change_me
COOKIE_NAME=mell_token
COOKIE_SECURE=false         # true только при HTTPS
COOKIE_SAMESITE=lax         # при COOKIE_SECURE=true нужно none
CLIENT_ORIGIN=http://localhost:5173   # в Docker: http://localhost:8080
```

`client/.env`: `VITE_API_URL=http://localhost:3000`. В Docker то же значение
передаётся аргументом сборки — Vite подставляет его в бандл при сборке,
а не при запуске.

Порт PostgreSQL снаружи — 5433, чтобы не конфликтовать с локально
установленной базой. Внутри сети Docker он остаётся 5432.

---

## Графика

Исходники лежат в корне проекта: `coin.jpeg`, `logo.jpeg`, `bronze_cup.png`,
`silver_cup.png`, `gold_cup.png`.

```bash
npm run art:prepare
```

[`scripts/prepare_art.py`](scripts/prepare_art.py) готовит из них
`client/public/art/`:

| Что | Как обрабатывается |
| --- | --- |
| `coin.png` | снят зелёный хромакей + despill (иначе по контуру остаётся салатовая кайма) |
| `coin-small.png` | та же монета 128px — для баланса и цен |
| `logo.png` | убран белый фон, включая просветы внутри буквы |
| `cup-bronze/silver/gold.png` | исходники, увеличены до 256px |
| `cup-platinum.png` | перекрашен из серебряного — жемчуг с сиреневым отливом |
| `cup-diamond.png` | перекрашен из серебряного — голубой лёд |

Перекраска идёт по светлоте серебряного кубка (он нейтральный, поэтому
переносится чище всего) через `ImageOps.colorize`, альфа сохраняется.

Турбо-монета не отдельный файл: золото уводится в фиолетовый
css-фильтром `hue-rotate(218deg)`.

Скрипту нужны `Pillow` и `numpy`:

```bash
pip install pillow numpy
```

---

## Оформление под лигу

Фон **один на всех экранах**, меняется только его цвет — от текущей лиги
игрока. Палитры собраны в
[`client/src/lib/league-theme.ts`](client/src/lib/league-theme.ts).

| Лига | Фон |
| --- | --- |
| Bronze | тёплый янтарь |
| Silver | холодный графит |
| Gold | золото |
| Platinum | жемчуг с сиреневым |
| Diamond | глубокий голубой |

Тема отдаётся через CSS-переменные (`--bg-top`, `--bg-mid`, `--bg-bottom`,
`--bg-glow`, `--league-accent`), поэтому вместе с фоном перекрашиваются
полоска энергии и прогресс лиги.

На **главном экране** пятно подсветки крупнее (`--glow-*`) — там по центру
лежит монета. На остальных экранах оно приглушено, чтобы не спорить
с содержимым.

---

## Эмодзи

Системные эмодзи не используются: на Windows и Android они рисуются
шрифтом Segoe/Noto и выглядят иначе, чем на iPhone, а часть новых
(например 🪙) вообще отсутствует и превращается в квадрат.

Вместо символов подставляются картинки из набора Apple
([iamcal/emoji-data](https://github.com/iamcal/emoji-data)).

```bash
npm run emoji:sync
```

Скрипт сканирует `client/src`, скачивает нужные PNG в `client/public/emoji/`
и генерирует карту `client/src/lib/emoji-map.generated.ts`. Запускать после
того, как добавили в код новый эмодзи.

Использование — компонент-обёртка:

```tsx
<Emoji>Осталось ⚡ 1500</Emoji>      // заменит эмодзи внутри текста
<EmojiIcon char="🚀" size={30} />    // один значок нужного размера
```

`Emoji` обходит вложенные элементы рекурсивно и трогает только текстовые
узлы. Если картинки для символа нет — символ остаётся как есть.

---

## Тестовая админка

Открывается на **/admin**, работает **без авторизации** — это инструмент
для отладки, чтобы быстро выставить игроку баланс, уровни бустов и энергию.

Включается флагом `ADMIN_ENABLED=true` (в `server/.env` и в
`docker-compose.yml`). Без него модуль вообще не подключается к приложению.

> На боевом сервере флаг должен быть выключен. Иначе любой желающий
> сможет выдать себе миллиард монет.

Правки идут **через игровое состояние в памяти**, а не напрямую в БД:
если игрок сейчас онлайн, прямой `UPDATE` затёрло бы ближайшим флашем.
Изменения сразу рассылаются в открытые вкладки игрока по WebSocket.

| Метод | Путь | Описание |
| --- | --- | --- |
| GET | `/api/admin/users?q=` | список с поиском по логину |
| GET | `/api/admin/users/:id` | полное состояние игрока |
| PATCH | `/api/admin/users/:id` | правка полей (шлётся только изменённое) |
| POST | `/api/admin/users/:id/reset-daily` | сбросить дневные лимиты |
| DELETE | `/api/admin/users/:id` | удалить игрока |

---

## Что не сделано намеренно

Это база под дальнейшее развитие. Осознанно отложено:

- **Telegram Mini App** — авторизации по `initData` нет, только логин/пароль.
- **Античит** — нет проверок на автокликеры, только token bucket от мусорных пакетов.
- **Миграции** — схема поднимается через `synchronize`. Перед продом заменить.
- **Рефералы и сквады** — завязаны на Telegram, экран «Френы» свёрстан,
  но список всегда пуст.
- **Задания** — считаются из состояния игрока (реальный прогресс),
  но наград за них пока нет.
- **Авто-тапалка и скины** — только в макете, показаны выключенными.
- **Масштабирование на несколько инстансов** — состояние живёт в памяти одного
  процесса. Для нескольких нод понадобится Redis-адаптер для socket.io и общий
  кеш состояния.
- **Тесты** — не написаны.
