# =====================================================================
#  MELLCOIN · backend (NestJS)
#
#  Многостадийная сборка (multi-stage build). Идея простая:
#  собираем в одном контейнере, а в финальный образ переносим только
#  готовый результат. TypeScript, @nestjs/cli и прочие dev-зависимости
#  в итоговый образ не попадают — он получается в разы легче.
#
#  Контекст сборки — КОРЕНЬ проекта (см. docker-compose.yml), потому что
#  это npm workspaces: package-lock.json лежит в корне и описывает сразу
#  оба пакета. Из папки server/ такую установку не сделать.
# =====================================================================


# ---------------------------------------------------------------------
# Стадия 1: build — ставим зависимости сервера (включая dev) и компилируем TS
# ---------------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

# Сначала только манифесты, потом код — это нужно для кеша слоёв.
# Docker кеширует каждую инструкцию. Пока package.json и package-lock.json
# не менялись, шаг `npm ci` берётся из кеша и не выполняется заново.
# Если бы мы копировали весь проект одной строкой, любая правка в коде
# сбрасывала бы кеш и переустанавливала все зависимости.
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# npm ci (не install) — ставит строго по package-lock.json.
# Воспроизводимо и быстрее: не пересчитывает дерево зависимостей.
#
# --workspace server — ставим только то, что нужно серверу.
# Без этого сюда приедут ещё и react с vite: package-lock.json общий на оба
# пакета, и по умолчанию npm ставит зависимости всех workspace сразу.
# --include-workspace-root нужен, чтобы подхватились и корневые зависимости.
RUN npm ci --workspace server --include-workspace-root

# Теперь исходники сервера и сборка
COPY server ./server
RUN npm run build --workspace server


# ---------------------------------------------------------------------
# Стадия 2: deps — только production-зависимости
# ---------------------------------------------------------------------
# Отдельная стадия, потому что в стадии build node_modules «загрязнён»
# dev-пакетами. Здесь ставим то же самое, но без них.
FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# --omit=dev отсекает devDependencies: TypeScript-тулчейн, @nestjs/cli и т.п.
# Примечание: сам пакет typescript всё равно останется — typeorm объявляет его
# опциональной peer-зависимостью, и в package-lock.json он помечен devOptional.
# Убирать его через --omit=optional не стоит: заодно снесёт нужные опциональные
# пакеты. ~23 МБ, с которыми проще смириться.
RUN npm ci --omit=dev --workspace server --include-workspace-root


# ---------------------------------------------------------------------
# Стадия 3: runtime — то, что реально поедет в контейнер
# ---------------------------------------------------------------------
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

# Забираем готовое из предыдущих стадий.
# Копируем /app целиком, а не только node_modules: npm workspaces обычно
# поднимает всё в корневой node_modules, но часть пакетов может осесть
# в server/node_modules — так ничего не потеряется.
COPY --from=deps --chown=node:node /app ./
COPY --from=build --chown=node:node /app/server/dist ./server/dist

# Запуск не от root — базовая гигиена. В образах node пользователь
# `node` уже создан, отдельно заводить не нужно.
USER node

WORKDIR /app/server

# EXPOSE — документация: «сервис слушает 3000».
# Порт наружу это НЕ открывает, за публикацию отвечает ports: в compose.
EXPOSE 3000

# Проверка живости. Docker сам дёргает её и держит статус контейнера
# (starting → healthy). Клиент в compose ждёт именно healthy.
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Форма-массив (exec form): процесс становится PID 1 и получает сигналы
# напрямую. Через shell-форму (CMD node dist/main) сигнал SIGTERM ушёл бы
# в sh, а Nest не успел бы корректно завершиться — а у нас на выключении
# сбрасывается состояние игроков в БД (app.enableShutdownHooks).
CMD ["node", "dist/main"]
