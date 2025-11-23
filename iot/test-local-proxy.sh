#!/bin/bash

# Script para probar el endpoint local que hace proxy a vicevalds

echo "═══════════════════════════════════════════════════"
echo "🧪 TEST DEL PROXY LOCAL A VICEVALDS"
echo "═══════════════════════════════════════════════════"
echo ""

# Verificar que el servidor local esté corriendo
echo "1️⃣  Verificando servidor local..."
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Servidor local está corriendo en puerto 3000"
else
    echo "❌ Servidor local NO está corriendo"
    echo "   Por favor, inicia el servidor con: npm run server"
    exit 1
fi

echo ""
echo "2️⃣  Creando archivo de audio de prueba..."

# Crear archivo de prueba
TEST_FILE="/tmp/test_audio_local_$$.webm"

# Generar un archivo webm de prueba con ffmpeg si está disponible
if command -v ffmpeg &> /dev/null; then
    echo "   → Generando audio de prueba con ffmpeg..."
    ffmpeg -f lavfi -i "sine=frequency=1000:duration=1" -acodec libopus "$TEST_FILE" -y 2>&1 | grep -q "Output" && echo "   ✅ Audio generado" || echo "   ⚠️  Usando método alternativo"
fi

# Si no se pudo generar con ffmpeg, usar un webm mínimo
if [ ! -f "$TEST_FILE" ]; then
    echo "   → Creando archivo webm mínimo..."
    echo "GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwH/////////FUmpZpkq17GDD0JATYCGQ2hyb21lV0GGQ2hyb21lFlSua7+uvdeBAXPFh4EF/Kx/8AAAGFg=" | base64 -d > "$TEST_FILE" 2>/dev/null
fi

if [ ! -f "$TEST_FILE" ]; then
    echo "❌ No se pudo crear archivo de prueba"
    exit 1
fi

echo ""
echo "3️⃣  Enviando audio al servidor LOCAL (que lo reenviará a vicevalds)..."
echo "   URL: http://localhost:3000/api/agent/process-audio"
echo "   Método: POST"
echo "   Campo: audio"
echo ""

# Enviar el archivo con curl al servidor LOCAL
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  http://localhost:3000/api/agent/process-audio \
  -F "audio=@$TEST_FILE" \
  2>&1)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "═══════════════════════════════════════════════════"
echo "📡 RESPUESTA DEL SERVIDOR LOCAL"
echo "═══════════════════════════════════════════════════"
echo ""
echo "Status Code: $HTTP_CODE"
echo ""
echo "Body:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

# Analizar el resultado
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo "✅ ¡ÉXITO! El servidor local actuó como proxy exitosamente"
    echo ""
    echo "Verificando campos de respuesta de vicevalds..."

    # Verificar que tenga los campos esperados de vicevalds
    if echo "$BODY" | jq -e '.success' > /dev/null 2>&1; then
        echo "  ✅ Campo 'success' presente"
    fi
    if echo "$BODY" | jq -e '.transcription' > /dev/null 2>&1; then
        echo "  ✅ Campo 'transcription' presente"
    fi
    if echo "$BODY" | jq -e '.interaction_type' > /dev/null 2>&1; then
        echo "  ✅ Campo 'interaction_type' presente"
    fi
    if echo "$BODY" | jq -e '.response_audio_url' > /dev/null 2>&1; then
        echo "  ✅ Campo 'response_audio_url' presente"
    fi

    echo ""
    echo "El proxy está funcionando correctamente!"
else
    echo "❌ ERROR: Status $HTTP_CODE"
fi

echo ""
echo "═══════════════════════════════════════════════════"

# Limpiar
rm -f "$TEST_FILE"

exit 0
