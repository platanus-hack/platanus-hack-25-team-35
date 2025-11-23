# Sistema de Recordatorios Automáticos

## Descripción General

Sistema automatizado de recordatorios que envía notificaciones de audio personalizadas al dispositivo IoT del usuario en momentos específicos antes y durante los eventos.

## Características Principales

### 1. **Tiempos de Recordatorio**

Para **actividades** y **citas médicas**:
- ⏰ **1 hora antes** del evento
- ⏰ **15 minutos antes** del evento
- ⏰ **Al momento exacto** del evento

Para **medicamentos**:
- ⏰ **1 hora antes** de la toma
- ⏰ **15 minutos antes** de la toma
- ⏰ **Al momento exacto** de la toma
- ⚠️ **Cada 5 minutos después** (si no hay confirmación)

### 2. **Confirmación de Medicamentos**

Los medicamentos requieren confirmación del usuario:
- El usuario debe confirmar verbalmente que tomó el medicamento
- Palabras clave detectadas: `confirmación`, `confirmo`, `listo`, `tomé`, `ok`, `hecho`
- La confirmación se envía al endpoint: `https://app.vicevalds.dev/api/agent/process-audio`
- Si no hay confirmación, el sistema continúa enviando recordatorios cada 5 minutos

### 3. **Mensajes Personalizados**

Los mensajes se personalizan según:
- Nombre del usuario (desde `user_profile`)
- Tipo de evento (actividad, cita médica, medicamento)
- Timing del recordatorio (1h, 15min, hora exacta, post-evento)

#### Ejemplos de mensajes:

**Actividad (1 hora antes):**
```
"Hola María, este es un recordatorio amigable. En una hora tienes programado: Caminata en el parque a las 9:00 AM. Espero que tengas un buen día."
```

**Cita médica (hora exacta):**
```
"Hola María, es el momento de tu cita con el Cardiólogo. No olvides llevar tu documentación médica si es necesario."
```

**Medicamento (post-evento sin confirmación):**
```
"Hola María, aún no he recibido confirmación de que tomaste tu medicamento Losartán, 50mg. Por favor, tómalo y confírmame diciendo 'confirmación' o 'listo'."
```

## Arquitectura Técnica

### Base de Datos

**Tabla `sent_reminders`:**
```sql
- event_type: 'activity' | 'medication' | 'appointment'
- event_id: ID del evento
- event_datetime: Fecha y hora del evento
- reminder_timing: '1_hour_before' | '15_min_before' | 'at_time' | 'post_event_5min'
- requires_confirmation: Boolean (true para medicamentos)
- confirmed: Boolean
- confirmed_at: Timestamp de confirmación
- status: 'sent' | 'failed'
```

### Scheduler (`server/services/reminderScheduler.js`)

- **Frecuencia**: Ejecuta cada 2 minutos
- **Tolerancia**: ±2 minutos para detectar eventos
- **Funciones principales**:
  - `findUpcomingEvents()`: Busca eventos próximos para cada timing
  - `findOverdueMedications()`: Busca medicamentos sin confirmar
  - `processReminder()`: Genera audio y envía al IoT
  - `generateReminderAudio()`: TTS con OpenAI (voz `nova`, velocidad 0.95x)
  - `sendAudioToIoT()`: POST al endpoint IoT

### Endpoint de Confirmación (`/api/agent/process-audio`)

1. Transcribe el audio recibido (Whisper)
2. Detecta palabras clave de confirmación
3. Busca el medicamento pendiente más reciente
4. Marca todos los recordatorios de ese medicamento como confirmados
5. Responde: "Perfecto, he registrado que tomaste tu medicamento. Gracias por confirmar."

## Configuración

### Variables de Entorno
```env
OPENAI_API_KEY=sk-...  # Requerido para TTS y transcripción
```

### Endpoints
- **Envío de audio IoT**: `https://iot.vicevalds.dev/api/audio/receive`
- **Confirmaciones**: `https://app.vicevalds.dev/api/agent/process-audio`

### Ajustes en Código

En `server/services/reminderScheduler.js`:

```javascript
// Tiempos de recordatorio (líneas 11-15)
const REMINDER_TIMINGS = {
    ONE_HOUR_BEFORE: { minutes: 60, key: '1_hour_before', tolerance: 2 },
    FIFTEEN_MIN_BEFORE: { minutes: 15, key: '15_min_before', tolerance: 2 },
    AT_TIME: { minutes: 0, key: 'at_time', tolerance: 2 }
};

// Intervalo post-evento para medicamentos (línea 18)
const POST_EVENT_INTERVAL_MINUTES = 5;

// Frecuencia del scheduler (línea 489)
cron.schedule('*/2 * * * *', () => { // Cada 2 minutos
    checkAndSendReminders();
});
```

## Flujo de Trabajo

### Para Actividades y Citas Médicas

```
1. Scheduler detecta evento a 1 hora
   └─> Genera audio personalizado
   └─> Envía a IoT endpoint
   └─> Registra en sent_reminders

2. Scheduler detecta evento a 15 minutos
   └─> Genera audio personalizado
   └─> Envía a IoT endpoint
   └─> Registra en sent_reminders

3. Scheduler detecta evento a hora exacta
   └─> Genera audio personalizado
   └─> Envía a IoT endpoint
   └─> Registra en sent_reminders
```

### Para Medicamentos

```
1. Scheduler detecta medicamento a 1 hora
   └─> Genera audio personalizado
   └─> Envía a IoT endpoint
   └─> Registra en sent_reminders

2. Scheduler detecta medicamento a 15 minutos
   └─> Genera audio personalizado
   └─> Envía a IoT endpoint
   └─> Registra en sent_reminders

3. Scheduler detecta medicamento a hora exacta
   └─> Genera audio (solicita confirmación)
   └─> Envía a IoT endpoint
   └─> Registra en sent_reminders (requires_confirmation=true)

4. Usuario envía audio con confirmación
   └─> /api/agent/process-audio detecta palabras clave
   └─> Marca medicamento como confirmado
   └─> Responde con confirmación

5. (Si no hay confirmación) Cada 5 minutos:
   └─> Scheduler detecta medicamento sin confirmar
   └─> Genera audio (insiste en confirmación)
   └─> Envía a IoT endpoint
   └─> Registra nuevo reminder post_event_5min
   └─> Repite hasta recibir confirmación
```

## Cálculo de Horarios de Medicamentos

Los medicamentos se calculan basándose en su frecuencia:

- **Frecuencia**: `"8 hrs"`, `"12 hrs"`, `"24 hrs"`
- **Hora de inicio**: 8:00 AM
- **Generación automática**: Se calculan múltiples tomas por día

Ejemplo con frecuencia "8 hrs":
- Primera toma: 8:00 AM
- Segunda toma: 4:00 PM (16:00)
- Tercera toma: 12:00 AM (00:00 del día siguiente)

## Logs del Sistema

El scheduler genera logs detallados:

```
[REMINDER] 🔔 Starting reminder check...
[REMINDER] ⏰ Current time: 2025-11-23T14:30:00.000Z
[REMINDER] 🔍 Checking ONE_HOUR_BEFORE reminders...
[REMINDER] 📊 Found 2 events for ONE_HOUR_BEFORE:
  ├─ Activities: 1
  ├─ Appointments: 0
  └─ Medications: 1
[REMINDER] 📋 Processing activity (1_hour_before): Caminata Parque
[REMINDER] 📝 Message: Hola Usuario, este es un recordatorio amigable...
[REMINDER] ✅ Audio generated: reminder-1732374600000.mp3
[REMINDER] ✅ Audio sent to IoT: 200
[REMINDER] ✅ Reminder sent successfully for activity #5 (1_hour_before)
[REMINDER] 📊 Summary:
  ├─ Successful: 2
  └─ Failed: 0
```

## Prevención de Duplicados

El sistema previene duplicados mediante:
- Constraint UNIQUE en `(event_type, event_id, event_datetime, reminder_timing)`
- Consultas que verifican si el recordatorio ya fue enviado
- Tracking de confirmaciones para medicamentos

## Integración con Docker

Las dependencias necesarias están en `package.json`:
```json
"axios": "^1.6.0",
"form-data": "^4.0.0",
"node-cron": "^3.0.3",
"openai": "^4.28.0"
```

El `Dockerfile` instalará automáticamente estas dependencias.

La tabla `sent_reminders` se crea automáticamente con `init.sql` al levantar el contenedor de PostgreSQL.

## Inicio del Sistema

En `server.js`:
```javascript
const { startReminderScheduler } = require('./server/services/reminderScheduler');

// Start Schedulers
startScheduler(); // Scheduler existente
startReminderScheduler(); // Nuevo scheduler de recordatorios
```

El scheduler inicia automáticamente cuando el servidor arranca.

## Testing Manual

Para probar el sistema manualmente:

```javascript
// En Node.js REPL o script
const { checkAndSendReminders } = require('./server/services/reminderScheduler');

// Ejecutar check manual
await checkAndSendReminders();
```
