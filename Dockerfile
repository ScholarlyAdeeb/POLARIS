# POLARIS web app (API + built frontend) in one container.
# Node 22.13+ is required for the built-in node:sqlite module.
FROM node:22-slim

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/polaris.db \
    UPLOAD_DIR=/data/uploads

COPY package.json package-lock.json ./
# Dev dependencies are needed for the Vite build and the tsx runtime.
RUN npm ci --include=dev

COPY . .
RUN npm run build

# /data holds the SQLite database and uploaded files; mount a persistent volume here.
VOLUME ["/data"]
EXPOSE 3000
CMD ["npm", "start"]
