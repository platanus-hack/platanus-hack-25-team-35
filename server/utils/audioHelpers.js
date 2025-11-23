const fs = require('fs');
const path = require('path');
const pool = require('../db');
const openai = require('../openai');
const { buildSystemWithProfile } = require('./profileHelpers');

const uploadsAudioDir = path.join(__dirname, '../../uploads', 'audio');

// Ensure directory exists
if (!fs.existsSync(uploadsAudioDir)) {
  fs.mkdirSync(uploadsAudioDir, { recursive: true });
}

async function saveAudioMessage(audioData, fromSource) {
  try {
    // Decode base64 and save to file
    const base64Data = audioData.replace(/^data:audio\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const filename = `message-${Date.now()}.webm`;
    const filePath = path.join(uploadsAudioDir, filename);
    const fileUrl = `/uploads/audio/${filename}`;

    fs.writeFileSync(filePath, buffer);

    // Save to database
    const result = await pool.query(
      `INSERT INTO audio_messages (from_source, file_path, file_url, timestamp)
             VALUES ($1, $2, $3, $4) RETURNING *`,
      [fromSource, filePath, fileUrl, new Date()]
    );

    return result.rows[0];
  } catch (err) {
    console.error('Error saving audio:', err);
    throw err;
  }
}

async function processAudioIntelligence(transcriptionText, source = 'web') {
  try {
    console.log(`[AI] Processing audio intelligence from ${source}...`);

    const currentDate = new Date().toISOString().split('T')[0];
    const currentTime = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Eres un asistente inteligente para el cuidado de adultos mayores. Analiza el siguiente texto transcrito de un mensaje de audio.

Tu tarea es extraer tres tipos de información:

1. **Actividades/Recordatorios**: CUALQUIER tarea, evento o recordatorio mencionado (compras, llamadas, citas NO médicas, tareas del hogar, etc.)
2. **Medicamentos**: Medicaciones con instrucciones de dosificación
3. **Citas Médicas**: SOLO citas con médicos o profesionales de la salud

REGLAS IMPORTANTES:
- Fecha/hora actual: ${currentDate} ${currentTime}
- **Si NO se menciona fecha**: usa "${currentDate}" (HOY)
- **Si NO se menciona hora**: usa "09:00" por defecto
- **Interpreta tiempo relativo**: "mañana", "el lunes", "pasado mañana", "en 3 días"
- **Extrae TODAS las tareas**: no seas restrictivo, si alguien dice "comprar pan", "llamar a mamá", "dar comida al perro" son actividades válidas
- **Si dice "todos los días"**: solo crea UNA entrada, el sistema manejará la recurrencia
- **Si hay múltiples items**: extráelos TODOS por separado

Devuelve SOLO un objeto JSON válido (sin markdown, sin explicaciones):

{
  "activities": [
    {
      "title": "título descriptivo",
      "date": "YYYY-MM-DD",
      "time": "HH:MM",
      "type": "medical" | "activity"
    }
  ],
  "medications": [
    {
      "name": "nombre del medicamento",
      "dosage": "dosis (ej: 50mg, 1 pastilla)",
      "frequency": "frecuencia (ej: cada 8 horas, 2 veces al día, todos los días)",
      "instructions": "instrucciones adicionales opcionales"
    }
  ],
  "appointments": [
    {
      "doctor": "nombre del doctor o especialidad",
      "type": "tipo de cita (ej: Consulta, Control, Chequeo)",
      "date": "YYYY-MM-DD",
      "time": "HH:MM",
      "notes": "notas adicionales opcionales"
    }
  ]
}`
        },
        {
          role: "user",
          content: transcriptionText
        }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const responseText = completion.choices[0].message.content.trim();
    const extracted = JSON.parse(responseText);

    console.log('[AI] Extraction result:', JSON.stringify(extracted, null, 2));

    return {
      activities: extracted.activities || [],
      medications: extracted.medications || [],
      appointments: extracted.appointments || []
    };

  } catch (err) {
    console.error('[AI] Error in audio intelligence processing:', err);
    return {
      activities: [],
      medications: [],
      appointments: []
    };
  }
}

// ========== ENHANCED MEMORY PROCESSING (Phase 2) ==========

/**
 * Process memory with enhanced classification (Evento vs Recuerdo)
 * Uses profile context for personalized extraction
 */
async function processMemoryWithChatGPT(text) {
  try {
    const currentDate = new Date().toISOString().split('T')[0];
    const currentTime = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });

    const baseInstructions = `
Eres un asistente de MEMORIA para una persona mayor. La idea es que esta persona te use para ir guardando información importante, recuerdos, etc. 
A veces no va a ser explícita la información, por lo que tienes que lograr interpretar las cosas obvias. Por ejemplo, si dice "médico de la cabeza", se
refiere al neurólogo. Si te dice "este lunes tengo algo", asume que estamos en la fecha del día de hoy (${currentDate}), y por ende entrega la fecha del lunes que viene
correspondiente. Trata de interpretar solo cuando se pueda, no inventes o uses información que no ha dicho.

Vas a recibir el TEXTO de algo que la persona dijo en voz alta.
En un MISMO audio puede haber VARIAS ideas distintas:
- varios eventos (cumpleaños, citas, salidas)
- varios recuerdos o pedidos (comprar algo, llamar a alguien, pensamientos)

Tu tarea es:

1) LEER TODO el texto y separar cada "pieza de información" en ítems independientes.
   Por ejemplo, si dice:
   "El jueves es el cumpleaños de mi hija. También tengo que comprar limones.
    Y hace mucho que no sé de Juanito Perez, debería llamarlo."
   → Son 3 ítems distintos.

2) Para CADA ítem, clasificarlo como:

   ● ACTIVIDADES PREVISTAS O RECORDATORIOS  → tipo = "Evento"
     Ejemplos:
     - "Ir al neurólogo el martes 25 de noviembre a las 15:00."
     - "Cumpleaños de Pepita jueves 27 de noviembre."
     - "Tomar té con Juanita este lunes a las 16:00 en su casa."

     Para cada Evento extrae:
     - fecha: texto amigable de la fecha ("martes 25 de noviembre", "este lunes", etc.).
     - hora: en formato HH:MM si es posible ("15:00", "16:00"), o null si no se menciona.
     - descripcion: frase corta que describa el evento ("Ir al neurólogo", "Cumpleaños de Pepita").
     - personas: lista de nombres de personas mencionadas, si las hay.
     - lugar: lugar mencionado si aplica ("su casa", "el hospital", "el parque", etc.).
     - clasificacion: null
     - responsable_requerido: null

   ● RECUERDOS O PEDIDOS → tipo = "Recuerdo"
     Ejemplos:
     - "¿Cómo estará Antonio Perez? No lo veo hace años, debería llamarlo."
     - "Sería bueno comprar una nueva almohada."
     - "Qué linda fue la graduación de mi nieta, qué buenos recuerdos."

     Para cada Recuerdo extrae:
     - clasificacion (una sola palabra, minúsculas):
         * "tarea"       → acción concreta que la persona podría hacer: llamar, visitar, anotar algo.
         * "compra"      → comprar algo (ej: "comprar almohada", "comprar limones").
         * "pensamiento" → reflexión/recuerdo/comentario sin acción clara.
         * "familiar"    → conversación o interacción con familiares (hijos, nietos, etc.).
         * "otro"        → si no encaja en lo anterior.
     - responsable_requerido:
         * "Si"  → si parece algo que otra persona (familiar/cuidador) debería gestionar
                   (especialmente compras u otras gestiones).
         * "No"  → si es algo que la persona mayor podría hacer sola o es solo un recuerdo/pensamiento.
     - descripcion: frase corta y accionable si corresponde:
         * "Llamar a Antonio Perez"
         * "Comprar limones"
         * "Recuerdo graduación de mi nieta"
     - personas: lista de nombres de personas mencionadas, si las hay.
     - lugar: lugar mencionado si aplica.
     - fecha: normalmente null, a menos que se mencione explícitamente una fecha.
     - hora: normalmente null, a menos que se mencione explícitamente una hora.

   ● OTROS CASOS → tipo = "Ninguno"
     Si el fragmento no parece ni Evento ni Recuerdo útil (ruido, cosas sin sentido, etc.).
     En ese caso:
     - tipo = "Ninguno"
     - puedes dejar el resto en null/listas vacías.

MUY IMPORTANTE – FORMATO DE RESPUESTA:
--------------------------------------
Debes responder SIEMPRE con una LISTA JSON (array JSON) que contenga UN OBJETO POR ÍTEM.

Ejemplos de salida válidos:

1) Cuando hay varios ítems:

[
  {
    "tipo": "Evento",
    "fecha": "jueves 27 de noviembre",
    "hora": null,
    "descripcion": "Cumpleaños de mi hija",
    "clasificacion": null,
    "responsable_requerido": null,
    "personas": ["mi hija"],
    "lugar": null
  },
  {
    "tipo": "Recuerdo",
    "fecha": null,
    "hora": null,
    "descripcion": "Comprar limones",
    "clasificacion": "compra",
    "responsable_requerido": "Si",
    "personas": [],
    "lugar": null
  }
]

2) Cuando solo hay un ítem:

[
  {
    "tipo": "Recuerdo",
    "fecha": null,
    "hora": null,
    "descripcion": "Llamar a Juanito Perez",
    "clasificacion": "tarea",
    "responsable_requerido": "No",
    "personas": ["Juanito Perez"],
    "lugar": null
  }
]

3) Cuando no hay nada útil:

[]

Reglas:
- SIEMPRE responde con una lista JSON: empieza con [ y termina con ].
- NO añadas comentarios, explicaciones ni texto fuera del JSON.
- Si no hay personas, usa "personas": [].
- Si no hay fecha/hora/lugar, usa null en esos campos.
`;

    const systemMsgBuilder = buildSystemWithProfile(baseInstructions);
    const systemMsg = await systemMsgBuilder();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: systemMsg },
        { role: "user", content: text }
      ]
    });

    const raw = completion.choices[0].message.content;
    let data = JSON.parse(raw);

    // Safety: if model returns single object instead of array
    if (!Array.isArray(data)) {
      data = [data];
    }

    return data;
  } catch (err) {
    console.error('[Enhanced Memory] Error processing:', err);
    return [];
  }
}

/**
 * Classify interaction as "captura" (storing) or "consulta" (querying)
 */
async function classifyInteraction(text) {
  try {
    const baseInstructions = `
Eres un ROUTER de intenciones para un asistente de memoria de personas mayores.

Dado el texto que dijo la persona, debes decidir si es:

1) "captura"
   - Cuando parece que la persona está contando cosas nuevas para que se guarden
     como eventos o recuerdos.
   - Ejemplos:
     - "El jueves es el cumpleaños de mi hija."
     - "Tengo que comprar limones."
     - "Hace mucho que no sé de Juanito Perez, debería llamarlo."

2) "consulta"
   - Cuando la persona está pidiendo que le recuerdes algo que ya debería estar
     en memoria.
   - Ejemplos:
     - "Recuérdame todo lo que tengo para esta semana."
     - "¿Qué recordatorios tengo hoy?"
     - "¿Qué cosas tenía pendientes con Juanito Perez?"

3) "otro"
   - Cuando no encaja en los casos anteriores.

FORMATO DE RESPUESTA:
---------------------
Devuelve SIEMPRE un JSON con una de estas formas:

{"tipo_interaccion": "captura"}

{"tipo_interaccion": "consulta", "pregunta": "texto de la pregunta (puede ser el mismo texto original)"}

{"tipo_interaccion": "otro"}
`;

    const systemMsgBuilder = buildSystemWithProfile(baseInstructions);
    const systemMsg = await systemMsgBuilder();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: systemMsg },
        { role: "user", content: text }
      ]
    });

    const raw = completion.choices[0].message.content;
    const data = JSON.parse(raw);

    return data;
  } catch (err) {
    console.error('[Classify Interaction] Error:', err);
    return { tipo_interaccion: "otro" };
  }
}

/**
 * Answer query from memory using stored agent_memory
 */
async function answerQueryFromMemory(question, maxItems = 50) {
  try {
    // Load recent memories
    const result = await pool.query(
      'SELECT * FROM agent_memory ORDER BY timestamp_guardado DESC LIMIT $1',
      [maxItems]
    );

    const memories = result.rows;
    const contextMemories = JSON.stringify(memories, null, 2);

    const currentDate = new Date().toISOString().split('T')[0];

    const baseInstructions = `
Eres un asistente de MEMORIA para una persona mayor.

Tienes acceso a:
- Una PREGUNTA en lenguaje natural.
- Una lista de MEMORIAS en formato JSON.
  Cada memoria tiene:
    - id
    - timestamp_guardado
    - origen (p.ej. "audio", "documento_medico")
    - texto_original (si viene de audio)
    - item: con campos como:
        * tipo: "Evento", "Recuerdo", "Ninguno", etc.
        * fecha, hora, descripcion, clasificacion, responsable_requerido, personas, lugar...

La fecha de HOY es: ${currentDate}

Tu tarea:
- Interpretar la pregunta y buscar en las MEMORIAS la información relevante.
- Algunos ejemplos:
    * Si pregunta "¿Qué tengo que hacer hoy?" → revisar items de tipo "Evento"
      cuya fecha coincida con HOY.
    * Si pregunta "¿Qué fue lo que hice ayer?" → buscar eventos o recuerdos con fecha de AYER.
    * Si pregunta "¿Qué remedios tengo que tomarme?" → buscar en medicamentos activos.
    * Si pregunta por una persona ("¿Qué cosas tenía pendientes con Juanito Perez?")
      → buscar en descripciones / personas de items tipo "Recuerdo" o "Evento" donde aparezca ese nombre.

- Usa el campo "tipo" y la información de fechas/horas/descripcion para priorizar:
    * tipo "Evento" → cosas que la persona debe hacer en una fecha/hora.
    * tipo "Recuerdo" con clasificacion "tarea" o "compra" → pendientes.

- Si NO encuentras nada útil o no hay información suficiente, dilo claramente
  (por ejemplo: "Por ahora no tengo nada guardado para hoy" o
   "No tengo información sobre eso en este momento").

FORMA DE RESPONDER:
- Responde SIEMPRE en español.
- Usa un tono claro, cálido y breve, pensado para ser escuchado en voz alta.
- Máximo 2 o 3 frases.
- NO devuelvas JSON, solo el texto de la respuesta.
`;

    const systemMsgBuilder = buildSystemWithProfile(baseInstructions);
    const systemMsg = await systemMsgBuilder();

    const userMsg = `
PREGUNTA:
${question}

MEMORIAS (JSON):
${contextMemories}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: systemMsg },
        { role: "user", content: userMsg }
      ]
    });

    const responseText = completion.choices[0].message.content.trim();
    return responseText;
  } catch (err) {
    console.error('[Answer Query] Error:', err);
    return 'Lo siento, tuve un problema al buscar en mi memoria.';
  }
}

module.exports = {
  saveAudioMessage,
  processAudioIntelligence,
  processMemoryWithChatGPT,
  classifyInteraction,
  answerQueryFromMemory
};
