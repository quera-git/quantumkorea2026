# --- Build stage ---
FROM node:20-alpine AS builder

WORKDIR /app

# Vite는 빌드 시점에 import.meta.env 값이 번들에 박힌다.
# docker-compose에서 build args로 VITE_BACKEND_URL을 전달받는다.
ARG VITE_BACKEND_URL
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

# --- Serve stage ---
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
