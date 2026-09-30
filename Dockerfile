# POLARIS web app (API + built frontend) in one container.
# Data lives in PostgreSQL: pass DATABASE_URL at run time.
FROM node:22-slim

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    UPLOAD_DIR=/data/uploads

COPY package.json package-lock.json ./
# Dev dependencies are needed for the Vite build and the tsx runtime.
RUN npm ci --include=dev

COPY . .
RUN npm run build

# /data holds uploaded files; mount a persistent volume here.
VOLUME ["/data"]
EXPOSE 3000
CMD ["npm", "start"]
