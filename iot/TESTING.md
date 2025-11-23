# Guía de Prueba - Sistema de Audio IoT

## 🎯 Objetivo
Verificar que el audio grabado se envíe correctamente al servidor vicevalds para procesamiento.

## 📋 Flujo Completo

```
1. Usuario mantiene presionado el botón de grabar
   ↓
2. Se graba audio (formato webm)
   ↓
3. Usuario suelta el botón
   ↓
4. Audio se envía a https://app.vicevalds.dev/api/agent/process-audio
   ↓
5. Vicevalds procesa y devuelve audio de respuesta
   ↓
6. Frontend descarga el audio de respuesta
   ↓
7. Frontend envía audio al servidor local (/api/audio/play)
   ↓
8. Servidor reproduce audio en parlantes
```

## ✅ Pasos para Probar

### 1. Construir el proyecto
```bash
pnpm run build
```

### 2. Iniciar el servidor local
```bash
npm run server
# O si usas Docker:
# docker-compose up
```

### 3. Abrir la aplicación
```
http://localhost:3000
```

### 4. Probar la grabación
1. **Mantén presionado** el botón del micrófono
2. **Habla** durante 2-5 segundos
3. **Suelta** el botón

### 5. Verificar en la consola del navegador

Deberías ver logs como:
```
🎙️ [App] INICIANDO ENVÍO DE AUDIO AL SERVIDOR VICEVALDS
🚀 [App] Enviando petición HTTP POST...
🌐 [App] Endpoint: https://app.vicevalds.dev/api/agent/process-audio
📡 [App] ¡Respuesta recibida del servidor vicevalds!
✅ [App] Respuesta exitosa (2xx)
✅ [App] Audio enviado exitosamente a vicevalds!
```

## 🔍 Diagnóstico de Errores

### Error: "Failed to fetch"
**Causa:** No se puede conectar al servidor vicevalds

**Soluciones:**
1. Verificar que `https://app.vicevalds.dev` esté accesible
2. Comprobar conexión a internet
3. Verificar firewall/proxy
4. Verificar CORS en el servidor vicevalds

**Probar manualmente:**
```bash
curl -X POST https://app.vicevalds.dev/api/agent/process-audio \
  -F "audio=@test.webm"
```

### Error: Status 404
**Causa:** Endpoint no existe

**Solución:** Verificar que el endpoint correcto es `/api/agent/process-audio`

### Error: Status 400/422
**Causa:** Formato de audio incorrecto o campo incorrecto

**Solución:** Verificar que:
- El campo se llama `file` (requerido por vicevalds)
- El formato es WebM u otro formato soportado
- El archivo no está vacío

### Error: Status 500
**Causa:** Error interno del servidor vicevalds

**Solución:** Revisar logs del servidor vicevalds

## 🧪 Test Manual del Endpoint Vicevalds

Crear un archivo de audio de prueba y enviarlo:

```bash
# Grabar audio de prueba (5 segundos)
ffmpeg -f pulse -i default -t 5 -acodec libopus test.webm

# Enviar al servidor vicevalds (IMPORTANTE: usar campo 'file')
curl -X POST https://app.vicevalds.dev/api/agent/process-audio \
  -F "file=@test.webm" \
  -v
```

Respuesta esperada:
```json
{
  "success": true,
  "message": "Audio procesado correctamente",
  "response_audio_url": "/path/to/response.webm"
}
```

## 📊 Checklist de Verificación

- [ ] El botón se puede presionar y mantener
- [ ] Se muestra el tiempo de grabación
- [ ] Al soltar aparece "Enviando a vicevalds..."
- [ ] La consola muestra logs detallados
- [ ] No hay errores de red en la consola
- [ ] Se recibe respuesta del servidor (200 OK)
- [ ] Aparece alerta de éxito
- [ ] Se reproduce audio en los parlantes (si hay respuesta)

## 🆘 Contacto de Emergencia

Si después de seguir esta guía el problema persiste:

1. **Captura de pantalla** de la consola del navegador (F12 → Console)
2. **Logs del servidor** vicevalds
3. **Comando curl** con resultado
4. **Descripción** del error exacto

## 🔧 Comandos Útiles

```bash
# Ver logs del servidor local
npm run server

# Ver logs de Docker
docker-compose logs -f app

# Reconstruir Docker
docker-compose up --build

# Test de conectividad
ping app.vicevalds.dev

# Test HTTPS
curl -I https://app.vicevalds.dev/api/agent/process-audio
```

## 📝 Notas Importantes

1. **Permisos del micrófono:** El navegador debe tener permisos para acceder al micrófono
2. **HTTPS:** Algunos navegadores requieren HTTPS para acceder al micrófono
3. **CORS:** El servidor vicevalds debe permitir peticiones desde tu dominio
4. **Tamaño:** El audio no debe estar vacío (mínimo 1 segundo de grabación)
