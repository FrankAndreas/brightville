# Stage 1: build the app
FROM node:26-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit
COPY . .
# The body-tracking files normally arrive with the install scripts skipped above
RUN node scripts/fetch-pose-assets.mjs && npm run build

# Stage 2: serve it with nginx as a non-root user, on port 8080
FROM nginxinc/nginx-unprivileged:alpine
COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html
COPY --chown=nginx:nginx nginx.conf /etc/nginx/conf.d/default.conf
COPY --chown=nginx:nginx security-headers.conf /etc/nginx/security-headers.conf
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]
