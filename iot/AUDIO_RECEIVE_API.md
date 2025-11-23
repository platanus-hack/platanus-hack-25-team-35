# API de Recepción de Audio - Documentación

## Endpoint: `POST /api/audio/receive`

Este endpoint permite recibir archivos de audio de fuentes externas y reproducirlos automáticamente en los parlantes del dispositivo.

---

## 🎯 Características

- ✅ Recepción activa de audios mediante POST
- ✅ Validación automática del archivo
- ✅ Almacenamiento permanente con nombres únicos
- ✅ Reproducción automática en parlantes del dispositivo
- ✅ Logs detallados en terminal del servidor
- ✅ Límite de 5MB por archivo
- ✅ Respuesta JSON con detalles completos del audio

---

## 📋 Especificaciones

### URL
```
POST http://your-server:3000/api/audio/receive
```

### Headers
```
Content-Type: multipart/form-data
```

### Body (form-data)
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `file` (o cualquier nombre) | File | ✅ Sí | Archivo de audio (webm, mp3, wav, ogg) |

**Nota:** Este endpoint acepta cualquier nombre de campo (`file`, `audio`, `recording`, etc.). Es flexible y no requiere un nombre específico.

### Límites
- **Tamaño máximo:** 5 MB
- **Formatos soportados:** .webm, .mp3, .wav, .ogg

---

## 📤 Ejemplo de Petición

### cURL
```bash
# Con campo 'file' (recomendado)
curl -X POST \
  -F "file=@audio.webm" \
  http://localhost:3000/api/audio/receive

# O con cualquier otro nombre de campo
curl -X POST \
  -F "audio=@audio.webm" \
  http://localhost:3000/api/audio/receive

curl -X POST \
  -F "recording=@audio.webm" \
  http://localhost:3000/api/audio/receive
```

### JavaScript (fetch)
```javascript
const formData = new FormData();
formData.append('file', audioBlob, 'audio.webm');

const response = await fetch('http://localhost:3000/api/audio/receive', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log(result);
```

### Python (requests)
```python
import requests

url = 'http://localhost:3000/api/audio/receive'
files = {'file': open('audio.mp3', 'rb')}

response = requests.post(url, files=files)
print(response.json())
```

### Node.js (axios)
```javascript
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const form = new FormData();
form.append('file', fs.createReadStream('audio.webm'));

const response = await axios.post(
  'http://localhost:3000/api/audio/receive',
  form,
  { headers: form.getHeaders() }
);

console.log(response.data);
```

---

## 📥 Respuesta Exitosa (200 OK)

```json
{
  "success": true,
  "message": "Audio received and played successfully",
  "audio": {
    "filename": "received-1732374620000.webm",
    "originalName": "audio.webm",
    "fieldName": "file",
    "size": 45678,
    "sizeKB": "44.61",
    "mimetype": "audio/webm",
    "url": "/uploads/audio/received-1732374620000.webm",
    "timestamp": "2024-11-23T15:30:20.000Z"
  }
}
```

### Campos de la respuesta

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `success` | Boolean | Indica si la operación fue exitosa |
| `message` | String | Mensaje descriptivo del resultado |
| `audio.filename` | String | Nombre del archivo guardado en el servidor |
| `audio.originalName` | String | Nombre original del archivo subido |
| `audio.fieldName` | String | Nombre del campo usado en la petición (ej: 'file', 'audio') |
| `audio.size` | Number | Tamaño del archivo en bytes |
| `audio.sizeKB` | String | Tamaño del archivo en KB (formateado) |
| `audio.mimetype` | String | Tipo MIME del archivo |
| `audio.url` | String | URL pública para acceder al audio |
| `audio.timestamp` | String | Timestamp ISO 8601 de recepción |

---

## ❌ Respuestas de Error

### 400 Bad Request - No se envió archivo
```json
{
  "success": false,
  "error": "No audio file uploaded",
  "hint": "Accepted field names: file, audio, recording, or any other"
}
```

### 500 Internal Server Error - Error al procesar
```json
{
  "success": false,
  "error": "Error message here",
  "details": "Error processing audio file"
}
```

---

## 🔊 Flujo de Operación

1. **Recepción:** El endpoint recibe el archivo mediante POST multipart/form-data
2. **Validación:** Verifica que el archivo exista y sea válido
3. **Guardado:** Almacena el archivo permanentemente con nombre único
4. **Reproducción:** Reproduce automáticamente el audio en los parlantes
5. **Respuesta:** Retorna JSON con detalles del audio procesado

---

## 📝 Logs en Terminal

El servidor genera logs detallados en la terminal:

```
═══════════════════════════════════════════════════════════════
🎧 RECIBIENDO AUDIO EXTERNO PARA REPRODUCCIÓN
═══════════════════════════════════════════════════════════════
[AUDIO RECEIVE] 🎤 Audio recibido exitosamente
  ├─ Nombre original: audio.webm
  ├─ Tamaño: 44.61 KB
  ├─ Tipo MIME: audio/webm
  └─ Timestamp: 2024-11-23T15:30:20.000Z

[AUDIO RECEIVE] 💾 Guardando archivo permanentemente
  ├─ Nombre final: received-1732374620000.webm
  └─ Ruta: /home/user/iot/uploads/audio/received-1732374620000.webm
[AUDIO RECEIVE] ✅ Archivo guardado exitosamente
  └─ URL pública: /uploads/audio/received-1732374620000.webm

[AUDIO RECEIVE] 🔊 Reproduciendo audio en parlantes
[AUDIO RECEIVE] ✅ Audio reproducido exitosamente
═══════════════════════════════════════════════════════════════
```

---

## 🧪 Script de Prueba

Puedes usar el script de prueba incluido:

```bash
# Usando archivo por defecto (temp/audio_test.webm o test.mp3)
./test-audio-receive.sh

# Especificando un archivo
./test-audio-receive.sh /path/to/audio.webm
```

---

## 💾 Almacenamiento

Los archivos de audio se guardan en:
```
/uploads/audio/received-{timestamp}.{ext}
```

- Los archivos son accesibles vía HTTP en `/uploads/audio/{filename}`
- Se genera un nombre único basado en timestamp para evitar colisiones
- Se mantiene la extensión del archivo original

---

## 🔒 Seguridad

- Límite de tamaño: 5 MB por archivo
- Los archivos se almacenan con nombres únicos (sin sobreescritura)
- Limpieza automática de archivos temporales en caso de error

---

## 🆚 Comparación con otros endpoints

| Endpoint | Propósito | Almacenamiento | Campo |
|----------|-----------|----------------|-------|
| `/api/audio/receive` | Recibir audios externos | Permanente | `cualquiera` (flexible) |
| `/api/audio/play` | Reproducir desde frontend | Temporal (memoria) | `audio` (fijo) |
| `/api/agent/process-audio` | Proxy a vicevalds | Temporal (memoria) | `audio` (fijo) |

---

## 📖 Casos de Uso

### 1. Sistema de Notificaciones por Voz
```javascript
// Un servidor genera una notificación de audio y la envía al dispositivo
const tts = generateTextToSpeech("Alerta: temperatura alta detectada");
await sendToDevice(tts);
```

### 2. Asistente Virtual Remoto
```python
# Un asistente virtual procesa comandos y envía respuestas en audio
response_audio = process_command(user_input)
send_audio_to_device(response_audio)
```

### 3. Sistema de Alarmas
```bash
# Enviar alarma de audio programada
curl -X POST -F "file=@alarm.mp3" http://device:3000/api/audio/receive
```

---

## 🐛 Solución de Problemas

### El audio no se reproduce
- Verifica que ffplay o paplay estén instalados en el sistema
- Revisa los logs del servidor para ver errores específicos
- Confirma que el formato de audio sea compatible

### Error 400: No audio file uploaded
- Verifica que estás enviando un archivo (cualquier nombre de campo es aceptado)
- Confirma que estás usando multipart/form-data
- Asegúrate de que el archivo no está vacío

### Error 500: Error processing audio file
- Revisa los logs del servidor para detalles
- Verifica que el archivo no esté corrupto
- Confirma que el tamaño sea menor a 5 MB

---

## 📞 Soporte

Para más información, consulta:
- `server.js` líneas 257-359 (implementación del endpoint)
- `test-audio-receive.sh` (script de prueba)
- Logs del servidor en tiempo real
