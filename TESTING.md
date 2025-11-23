# Testing Phase 2: Enhanced Memory Processing

## Quick Test Guide

### 1. Test Core Functions (Without Server)

```bash
node test-enhanced-memory.js
```

This will test:
- ✅ Profile loading from database
- ✅ Memory processing with `processMemoryWithChatGPT()`
- ✅ Interaction classification with `classifyInteraction()`
- ✅ Memory querying with `answerQueryFromMemory()`

### 2. Test Profile Extraction (Requires Server Running)

```bash
# Terminal 1: Start server
docker-compose up

# Terminal 2: Run profile test
node test-enhanced-memory.js profile
```

### 3. Manual Testing via API

#### Test 1: Load Profile
```bash
curl http://localhost:8080/api/profile
```

#### Test 2: Extract Profile from Text
```bash
curl -X POST http://localhost:8080/api/profile/extract \
  -H "Content-Type: application/json" \
  -d '{"text": "Me llamo María, tengo 75 años y soy diabética"}'
```

#### Test 3: Update Profile Manually
```bash
curl -X POST http://localhost:8080/api/profile \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "María",
    "edad": 75,
    "condiciones_salud": ["diabetes"]
  }'
```

### 4. Test with Real Audio (Once Integrated)

Once we integrate the enhanced functions into `/api/agent/process-audio`, you can test with:

```bash
# Record audio and send
curl -X POST http://localhost:8080/api/agent/process-audio \
  -F "file=@test-audio.webm"
```

## Expected Results

### Memory Processing
Input: "El lunes 24 es el cumpleaños de mi hija. También necesito comprar limones."

Expected output:
```json
[
  {
    "tipo": "Evento",
    "fecha": "lunes 24",
    "descripcion": "Cumpleaños de mi hija",
    "personas": ["mi hija"]
  },
  {
    "tipo": "Recuerdo",
    "descripcion": "Comprar limones",
    "clasificacion": "compra",
    "responsable_requerido": "Si"
  }
]
```

### Interaction Classification
Input: "Recuérdame todo lo que tengo para esta semana"

Expected output:
```json
{
  "tipo_interaccion": "consulta",
  "pregunta": "Recuérdame todo lo que tengo para esta semana"
}
```

### Memory Query
Input: "¿Qué tengo que hacer hoy?"

Expected output (text):
```
"Hoy tienes el cumpleaños de tu hija y necesitas comprar limones."
```

## Troubleshooting

### Error: "Cannot find module"
```bash
npm install
```

### Error: "Database connection failed"
```bash
docker-compose up -d postgres
```

### Error: "OpenAI API key not found"
Check your `.env` file or `docker-compose.yml` has `OPENAI_API_KEY` set.

## Next Steps

After testing confirms everything works:
1. Integrate into `/api/agent/process-audio` endpoint
2. Test with real audio from device
3. Verify calendar updates in real-time
4. Move to Phase 3: PDF Document Analysis
