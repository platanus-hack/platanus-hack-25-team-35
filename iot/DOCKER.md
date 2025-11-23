# Docker - Guía de Uso

## 🐳 Configuración Docker para Reproducción de Audio

Este proyecto usa Docker con soporte completo para reproducción de audio mediante PulseAudio y ffplay.

---

## 📦 ¿Qué incluye el contenedor?

### Software instalado:
- ✅ **Node.js 20** (runtime)
- ✅ **pnpm** (gestor de paquetes)
- ✅ **ffmpeg/ffplay** (reproducción de audio: mp3, webm, wav, ogg)
- ✅ **PulseAudio** (sistema de audio)
- ✅ **curl** (healthchecks)

### Endpoints disponibles:
- `POST /api/audio/receive` - Recibir y reproducir audios externos
- `POST /api/audio/play` - Reproducir audios desde frontend
- `POST /api/agent/process-audio` - Proxy a vicevalds

---

## 🚀 Comandos Principales

### 1. Construir e iniciar contenedores
```bash
docker-compose up -d --build
```

### 2. Ver logs en tiempo real
```bash
docker-compose logs -f app
```

### 3. Detener contenedores
```bash
docker-compose down
```

### 4. Reiniciar contenedores
```bash
docker-compose restart
```

### 5. Reconstruir desde cero
```bash
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

---

## 🔧 Configuración Previa

### ⚠️ IMPORTANTE: Ajustar UID

Antes de ejecutar, verifica tu UID:
```bash
id -u
```

Si tu UID **NO es 1000**, edita `docker-compose.yml`:

```yaml
# Cambiar estas líneas:
- PULSE_SERVER=unix:/run/user/1000/pulse/native
- /run/user/1000/pulse:/run/user/1000/pulse:ro

# Por tu UID (ejemplo para UID 1001):
- PULSE_SERVER=unix:/run/user/1001/pulse/native
- /run/user/1001/pulse:/run/user/1001/pulse:ro
```

---

## 📁 Volúmenes Montados

| Host | Contenedor | Propósito |
|------|-----------|-----------|
| `./temp` | `/app/temp` | Archivos temporales de `/api/audio/play` |
| `./uploads` | `/app/uploads` | Audios permanentes de `/api/audio/receive` |
| `/run/user/{UID}/pulse` | `/run/user/{UID}/pulse` | Socket de PulseAudio (audio) |

**Nota:** Los audios en `./uploads/audio/` persisten entre reinicios del contenedor.

---

## 🧪 Probar el Audio

### Desde el host:
```bash
# Enviar audio de prueba
curl -X POST \
  -F "file=@audio.mp3" \
  http://localhost/api/audio/receive
```

### Desde otro servidor:
```bash
curl -X POST \
  -F "file=@audio.mp3" \
  http://tu-servidor:80/api/audio/receive
```

---

## 🔍 Verificar Estado

### Ver estado de contenedores:
```bash
docker-compose ps
```

### Verificar que ffplay esté instalado:
```bash
docker-compose exec app which ffplay
# Debe mostrar: /usr/bin/ffplay
```

### Verificar conexión a PulseAudio:
```bash
docker-compose exec app ls -la /run/user/1000/pulse/
# Debe mostrar el socket 'native'
```

### Verificar directorios de audio:
```bash
docker-compose exec app ls -la /app/uploads/audio/
```

---

## 🐛 Solución de Problemas

### Error: "spawn ffplay ENOENT"
**Causa:** ffplay no está instalado
**Solución:**
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Error: "Connection refused" al reproducir audio
**Causa:** PulseAudio no está accesible
**Solución:**
1. Verifica tu UID: `id -u`
2. Ajusta `docker-compose.yml` con tu UID correcto
3. Verifica que PulseAudio esté corriendo: `pactl info`

### Los audios no persisten
**Causa:** El volumen no está montado correctamente
**Solución:**
```bash
# Verifica que el volumen esté montado
docker-compose exec app ls -la /app/uploads/audio/

# Si está vacío, recrea los contenedores
docker-compose down
docker-compose up -d
```

### Contenedor no inicia (unhealthy)
**Causa:** El servidor no responde en el puerto 3000
**Solución:**
```bash
# Ver logs para identificar el error
docker-compose logs app

# Verificar que el puerto 3000 esté libre
lsof -i:3000
```

---

## 📊 Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                         Host System                          │
│  ┌────────────────────┐           ┌─────────────────────┐  │
│  │  PulseAudio Server │◄──────────┤  Docker Volumes     │  │
│  │  /run/user/UID/    │           │  - ./temp           │  │
│  └────────────────────┘           │  - ./uploads        │  │
│           ▲                        └─────────────────────┘  │
│           │                                                  │
│  ┌────────┴──────────────────────────────────────────────┐ │
│  │             Docker Container (iot-app)                │ │
│  │  ┌──────────────────────────────────────────────┐    │ │
│  │  │  Node.js Server (port 3000)                  │    │ │
│  │  │  - ffplay (reproduce audio)                  │    │ │
│  │  │  - Endpoints: /api/audio/*                   │    │ │
│  │  └──────────────────────────────────────────────┘    │ │
│  └───────────────────────────────────────────────────────┘ │
│           ▲                                                  │
│  ┌────────┴──────────────────────────────────────────────┐ │
│  │        Apache2 Proxy (port 80 → 3000)                 │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                          ▲
                          │ HTTP Requests
                          │
                   [Fuentes Externas]
```

---

## 🔒 Seguridad

- El socket de PulseAudio se monta como **solo lectura** (`ro`)
- Los directorios de audio tienen permisos `777` dentro del contenedor
- El contenedor se reinicia automáticamente (`restart: unless-stopped`)
- Healthchecks activos cada 30 segundos

---

## 📚 Referencias

- Dockerfile: [./Dockerfile](./Dockerfile)
- Docker Compose: [./docker-compose.yml](./docker-compose.yml)
- API de Audio: [./AUDIO_RECEIVE_API.md](./AUDIO_RECEIVE_API.md)
- Código del servidor: [./server.js](./server.js)

---

## ✅ Checklist Post-Instalación

Después de hacer `docker-compose up -d`, verifica:

- [ ] Contenedores corriendo: `docker-compose ps` (ambos "healthy")
- [ ] Logs sin errores: `docker-compose logs -f app`
- [ ] ffplay instalado: `docker-compose exec app which ffplay`
- [ ] Endpoint accesible: `curl http://localhost/`
- [ ] Audio funciona: Enviar audio de prueba con curl

---

## 💡 Tips

1. **Desarrollo local:** Usa `node server.js` fuera de Docker para desarrollo rápido
2. **Producción:** Usa Docker Compose para deployment
3. **Logs persistentes:** Monta `/app/logs` si necesitas guardar logs
4. **Base de datos:** Agrega un servicio PostgreSQL al `docker-compose.yml` si lo necesitas
