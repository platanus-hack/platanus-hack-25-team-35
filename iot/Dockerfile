# Dockerfile para aplicación IoT con reproducción de audio
# Flujos de audio disponibles:
#   Flujo 1 (Frontend → vicevalds):
#     1. Frontend graba audio y lo envía a vicevalds
#     2. Vicevalds procesa y devuelve audio de respuesta
#     3. Frontend descarga y lo envía al endpoint /api/audio/play
#     4. El servidor reproduce el audio en los parlantes
#   Flujo 2 (Recepción directa):
#     1. Fuente externa envía audio a /api/audio/receive
#     2. El servidor guarda y reproduce automáticamente el audio

# Stage 1: Build frontend
FROM node:20-alpine AS builder

# Instalar pnpm
RUN npm install -g pnpm@10.13.1

WORKDIR /app

# Copiar archivos de configuración
COPY package.json pnpm-lock.yaml* ./

# Instalar dependencias
RUN pnpm install --frozen-lockfile || pnpm install

# Copiar código fuente
COPY . .

# Construir frontend
RUN pnpm run build

# Stage 2: Production image
FROM node:20-slim

# Instalar dependencias del sistema para reproducción de audio
# - pulseaudio (paplay): reproduce archivos WAV directamente
# - ffmpeg (ffplay): reproduce webm, mp3, ogg y otros formatos multimedia
#   Usado por: /api/audio/play y /api/audio/receive
# - curl: para healthchecks
RUN apt-get update && apt-get install -y \
    pulseaudio \
    pulseaudio-utils \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Instalar pnpm
RUN npm install -g pnpm@10.13.1

WORKDIR /app

# Copiar package.json y instalar solo dependencias de producción
# Dependencias de los endpoints:
#   - express: servidor HTTP
#   - multer: manejo de uploads (multipart/form-data)
#   - axios, form-data: para proxy a vicevalds
#   - socket.io: comunicación en tiempo real con clientes web
# Endpoints: /api/audio/play, /api/audio/receive, /api/agent/process-audio
COPY package.json ./
RUN pnpm install --prod --frozen-lockfile || pnpm install --prod

# Copiar código del servidor
COPY server.js ./

# Copiar archivos construidos del frontend desde el builder
COPY --from=builder /app/dist ./dist

# Crear directorios para archivos de audio
# - temp: archivos temporales del endpoint /api/audio/play (en memoria)
# - uploads/audio: archivos permanentes del endpoint /api/audio/receive
RUN mkdir -p temp uploads/audio && chmod -R 777 temp uploads

# Exponer puerto
EXPOSE 3000

# Variable de entorno para PulseAudio (requerida por el endpoint /api/audio/play)
# Permite que paplay y ffplay se conecten al servidor PulseAudio del host
ENV PULSE_SERVER=unix:/run/user/1000/pulse/native

# Comando para iniciar el servidor
CMD ["node", "server.js"]

