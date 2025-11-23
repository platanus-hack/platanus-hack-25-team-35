# IoT App


Aplicación web para grabar audio y enviarlo a un servidor externo, con capacidad de reproducir audio recibido.

## Requisitos

- Docker y Docker Compose
- pnpm (para desarrollo local)
- Node.js 20+ (para desarrollo local)

## Uso con Docker

### Construir y ejecutar

```bash
# Construir la imagen
docker compose build

# Ejecutar el contenedor
docker compose up -d

# Ver logs
docker compose logs -f

# Detener el contenedor
docker compose down
```

La aplicación estará disponible en `http://localhost:3000`

### Reproducción de audio

Para que la reproducción de audio funcione desde el contenedor Docker, necesitas:

1. **Opción 1: Usar PulseAudio del host (Recomendado)**
   
   Asegúrate de que PulseAudio esté ejecutándose en tu sistema:
   ```bash
   pulseaudio --start
   ```
   
   El docker-compose.yml ya está configurado para montar el socket de PulseAudio del host.

2. **Opción 2: Sin Docker (Desarrollo local)**
   
   Para desarrollo local, puedes ejecutar sin Docker:
   ```bash
   # Instalar dependencias
   pnpm install
   
   # Terminal 1: Frontend en desarrollo
   pnpm dev
   
   # Terminal 2: Servidor backend
   pnpm server
   ```

## Endpoints

- **POST** `/api/audio/play` - Recibe audio y lo reproduce en el servidor
  - Body: FormData con campo `audio` (archivo de audio)
  - Formatos soportados: WebM, MP3, WAV, OGG

## Desarrollo

```bash
# Instalar dependencias
pnpm install

# Ejecutar en modo desarrollo
pnpm dev        # Frontend (puerto 5173)
pnpm server     # Backend (puerto 3000)

# Construir para producción
pnpm build

# Ejecutar en producción
pnpm start
```

## Estructura del proyecto

```
├── src/              # Código fuente del frontend
│   ├── components/   # Componentes React
│   ├── App.jsx       # Componente principal
│   └── main.jsx      # Punto de entrada
├── server.js         # Servidor Express backend
├── Dockerfile        # Configuración Docker
├── docker-compose.yml # Configuración Docker Compose
└── package.json      # Dependencias y scripts
```

