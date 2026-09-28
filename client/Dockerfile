# =====================================================================
#  MELLCOIN · frontend (React + Vite)
#
#  Ключевое отличие от бэкенда: React после сборки — это просто набор
#  статических файлов (index.html + js + css). Node для их отдачи не нужен.
#  Поэтому финальный образ — nginx, а не node. Он весит ~50 МБ вместо ~200
#  и отдаёт статику быстрее, чем что-либо на Node.
# =====================================================================


# ---------------------------------------------------------------------
# Стадия 1: build — собираем бандл
# ---------------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# Только зависимости клиента — NestJS и pg для сборки бандла не нужны
RUN npm ci --workspace client --include-workspace-root

COPY client ./client

# ВАЖНО: Vite подставляет import.meta.env.VITE_* в момент СБОРКИ,
# зашивая значения прямо в JS-файлы. Задать их при запуске контейнера
# уже нельзя — бандл готов. Поэтому адрес API приходит через ARG
# (аргумент сборки), а не через environment.
#
# Если поменяете VITE_API_URL — нужно пересобрать образ, а не перезапустить.
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build --workspace client


# ---------------------------------------------------------------------
# Стадия 2: runtime — nginx со статикой
# ---------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

# Свой конфиг вместо дефолтного: нужен SPA-fallback (см. nginx.conf)
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

# Собранный бандл из первой стадии в корень раздачи nginx
COPY --from=build /app/client/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1

# Образ nginx уже содержит нужный CMD, но пишем явно:
# daemon off — чтобы nginx не уходил в фон. Контейнер живёт ровно столько,
# сколько работает его главный процесс; ушёл в фон — контейнер сразу умер.
CMD ["nginx", "-g", "daemon off;"]
