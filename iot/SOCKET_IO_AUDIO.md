# Socket.io - Reproducción de Audio en Tiempo Real

## 🎯 ¿Qué hace?

Cuando alguien envía un audio al endpoint `/api/audio/receive`, ese audio se reproduce **automáticamente en TODOS los navegadores conectados** a través de Socket.io.

---

## 🔄 Flujo Completo

```
1. 📤 Fuente externa (vicevalds, curl, etc.)
      ↓
   POST /api/audio/receive con archivo de audio
      ↓
2. 💾 Servidor guarda el audio en /uploads/audio/
      ↓
3. 🔊 Servidor reproduce audio en parlantes (si ffplay está disponible)
      ↓
4. 📡 Servidor emite evento 'new-audio' via Socket.io
      ↓
5. 🌐 TODOS los navegadores conectados reciben el evento
      ↓
6. 🔊 Navegadores reproducen el audio automáticamente
      ↓
7. 💬 Aparece notificación visual en la interfaz web
```

---

## 🧪 Cómo Probar

### **1. Abre el navegador en localhost**
```
http://localhost:3000
```

Verás en la consola del navegador:
```
🔌 Conectando a Socket.io...
✅ Conectado a Socket.io: [socket-id]
```

### **2. Envía un audio desde otra terminal**
```bash
curl -X POST \
  -F "file=@audio.mp3" \
  http://localhost:3000/api/audio/receive
```

### **3. Observa lo que sucede:**

**En la terminal del servidor:**
```
[AUDIO RECEIVE] 🎤 Audio recibido exitosamente
[AUDIO RECEIVE] 💾 Guardando archivo permanentemente
[AUDIO RECEIVE] ✅ Archivo guardado exitosamente
[AUDIO RECEIVE] 🔊 Reproduciendo audio en parlantes del servidor
[AUDIO RECEIVE] ✅ Audio reproducido en parlantes del servidor
[AUDIO RECEIVE] 📡 Emitiendo audio a clientes web conectados
[AUDIO RECEIVE] ✅ Evento emitido a clientes web
```

**En la consola del navegador:**
```
═══════════════════════════════════════════════════
🎵 [Socket.io] NUEVO AUDIO RECIBIDO
═══════════════════════════════════════════════════
📁 Archivo: audio.mp3
🔗 URL: /uploads/audio/received-1763894936686.mp3
⏰ Timestamp: 2025-11-23T10:48:56.899Z

🔊 Reproduciendo audio automáticamente en el navegador...
✅ Audio reproduciéndose en el navegador
```

**En la interfaz web:**
```
┌─────────────────────────────────────────┐
│ 🎵 Nuevo audio recibido                │
│ audio.mp3                               │
└─────────────────────────────────────────┘
(Notificación verde con animación pulse)
```

**Y el audio se reproduce automáticamente** 🔊

---

## 📊 Arquitectura

### **Backend (server.js)**

```javascript
// 1. Crear servidor Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// 2. Escuchar conexiones
io.on('connection', (socket) => {
  console.log('🔌 Cliente conectado:', socket.id);
});

// 3. Emitir evento cuando se reciba audio
app.post('/api/audio/receive', async (req, res) => {
  // ... guardar audio ...

  io.emit('new-audio', {
    audioUrl: '/uploads/audio/received-123.mp3',
    filename: 'received-123.mp3',
    originalName: 'audio.mp3',
    timestamp: new Date().toISOString()
  });
});
```

### **Frontend (App.jsx)**

```javascript
// 1. Conectar a Socket.io
useEffect(() => {
  const socket = io(window.location.origin);

  socket.on('connect', () => {
    console.log('✅ Conectado a Socket.io');
  });

  // 2. Escuchar evento de nuevo audio
  socket.on('new-audio', (data) => {
    console.log('🎵 Nuevo audio recibido:', data.audioUrl);

    // 3. Reproducir automáticamente
    audioRef.current.src = data.audioUrl;
    audioRef.current.play();

    // 4. Mostrar notificación
    setReceivedAudioNotification({
      filename: data.originalName,
      timestamp: data.timestamp
    });
  });
}, []);
```

---

## 🎨 Interfaz Visual

### **Notificación de Audio Recibido**

Cuando se recibe un audio, aparece una notificación verde en la parte superior de la pantalla con:

- ✅ Icono de audio animado (pulse)
- 📁 Nombre del archivo original
- ⏰ Timestamp de recepción
- 🕐 Se oculta automáticamente después de 5 segundos

Ejemplo:
```
╔═══════════════════════════════════════╗
║  🎵  Nuevo audio recibido             ║
║     response-1763865734912.mp3        ║
╚═══════════════════════════════════════╝
```

---

## 🔧 Configuración Técnica

### **Dependencias Instaladas**

**Backend:**
```json
{
  "socket.io": "4.8.1"
}
```

**Frontend:**
```json
{
  "socket.io-client": "4.8.1"
}
```

### **Puerto y CORS**

Socket.io comparte el mismo puerto que el servidor HTTP (3000) y acepta conexiones desde cualquier origen:

```javascript
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
```

### **Transports**

El cliente intenta conectarse usando:
1. **WebSocket** (preferido, más rápido)
2. **Polling** (fallback, más compatible)

```javascript
const socket = io(window.location.origin, {
  transports: ['websocket', 'polling']
});
```

---

## 📝 Eventos Socket.io

### **Eventos del servidor**

| Evento | Dirección | Datos | Descripción |
|--------|-----------|-------|-------------|
| `connection` | ← Cliente | `socket` | Un cliente se conecta |
| `disconnect` | ← Cliente | `socket` | Un cliente se desconecta |
| `new-audio` | → Cliente | `{audioUrl, filename, originalName, timestamp}` | Nuevo audio disponible |

### **Eventos del cliente**

| Evento | Dirección | Datos | Descripción |
|--------|-----------|-------|-------------|
| `connect` | ← Servidor | - | Conectado exitosamente |
| `disconnect` | ← Servidor | - | Desconectado del servidor |
| `new-audio` | ← Servidor | `{audioUrl, ...}` | Recibe notificación de audio |

---

## 🚀 Casos de Uso

### **1. Sistema de Notificaciones por Voz**

Un servidor genera alertas en audio y las envía a todos los dispositivos:

```bash
# Servidor de alertas genera audio
curl -X POST -F "file=@alerta-temperatura.mp3" http://dispositivo:3000/api/audio/receive
```

**Resultado:** Todos los navegadores conectados reproducen la alerta simultáneamente.

---

### **2. Asistente Virtual Distribuido**

Un asistente virtual responde y envía la respuesta a múltiples pantallas:

```bash
# Vicevalds envía respuesta de audio
curl -X POST -F "file=@respuesta.mp3" http://localhost/api/audio/receive
```

**Resultado:** La respuesta se escucha en:
- Parlantes del servidor ✅
- Todos los navegadores abiertos ✅
- Dispositivos móviles conectados ✅

---

### **3. Monitoreo Remoto**

Múltiples operadores monitoreando el mismo sistema:

```bash
# Sistema detecta anomalía y genera audio
curl -X POST -F "file=@anomalia-detectada.mp3" http://servidor:3000/api/audio/receive
```

**Resultado:** Todos los operadores con el navegador abierto reciben la alerta al mismo tiempo.

---

## 🐛 Solución de Problemas

### **No se conecta a Socket.io**

**Síntoma:** Consola del navegador muestra error de conexión

**Solución:**
```bash
# Verificar que el servidor esté corriendo
curl http://localhost:3000/

# Verificar logs del servidor
# Debe mostrar: 🔌 Socket.io habilitado
```

---

### **Audio no se reproduce en el navegador**

**Síntoma:** Se recibe el evento pero no suena

**Posibles causas:**
1. **Política de autoplay del navegador**
   - Chrome/Safari bloquean autoplay sin interacción del usuario
   - **Solución:** Haz clic en la página primero

2. **URL del audio incorrecta**
   - Verifica en la consola del navegador la URL
   - **Solución:** Asegúrate que `/uploads` esté servido estáticamente

3. **Formato de audio no soportado**
   - MP3 funciona en todos los navegadores
   - WebM puede fallar en Safari

---

### **El servidor dice que emitió pero no llega al navegador**

**Diagnóstico:**
```javascript
// En la consola del navegador
console.log('Socket conectado:', socketRef.current?.connected);
```

Si es `false`:
- Refresca la página
- Verifica que el puerto sea correcto
- Revisa CORS en server.js

---

### **Múltiples notificaciones superpuestas**

**Causa:** Varios audios llegando rápidamente

**Solución:** Ya implementada - las notificaciones se ocultan automáticamente después de 5 segundos

---

## 📈 Escalabilidad

### **Múltiples Clientes**

Socket.io puede manejar miles de conexiones simultáneas. Por defecto usa broadcasting eficiente:

```javascript
io.emit('new-audio', data); // Envía a TODOS los clientes
```

### **Rooms (opcional)**

Si necesitas enviar audios solo a ciertos clientes:

```javascript
// Servidor
socket.join('sala-1');
io.to('sala-1').emit('new-audio', data);

// Cliente
socket.emit('join-room', 'sala-1');
```

---

## 🔒 Seguridad

### **CORS Actual**
```javascript
cors: { origin: "*" } // Acepta cualquier origen
```

### **Para Producción (recomendado)**
```javascript
cors: {
  origin: "https://tu-dominio.com",
  methods: ["GET", "POST"]
}
```

---

## 📚 Referencias

- Socket.io Docs: https://socket.io/docs/v4/
- WebSocket vs Polling: https://socket.io/docs/v4/how-it-works/
- Cliente Socket.io: https://socket.io/docs/v4/client-api/

---

## ✅ Checklist de Funcionamiento

Verifica que todo funcione:

- [ ] Servidor muestra `🔌 Socket.io habilitado`
- [ ] Navegador muestra `✅ Conectado a Socket.io`
- [ ] Enviar audio con curl funciona
- [ ] Logs del servidor muestran `📡 Emitiendo audio a clientes web`
- [ ] Consola del navegador muestra `🎵 Nuevo audio recibido`
- [ ] Aparece notificación verde en la interfaz
- [ ] Audio se reproduce automáticamente
- [ ] Notificación desaparece después de 5 segundos

---

## 🎓 Resumen Ejecutivo

**Antes:**
- Audio se enviaba al servidor
- Solo se reproducía en parlantes del servidor
- Frontend no sabía que había nuevos audios

**Ahora:**
- Audio se envía al servidor ✅
- Se reproduce en parlantes del servidor ✅
- **TODOS los navegadores conectados reproducen el audio automáticamente** ✅
- Notificación visual en tiempo real ✅
- Sincronización perfecta entre múltiples clientes ✅
