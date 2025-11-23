#!/bin/bash

# Script para probar el endpoint de vicevalds

echo "═══════════════════════════════════════════════════"
echo "🧪 TEST DEL ENDPOINT VICEVALDS"
echo "═══════════════════════════════════════════════════"
echo ""

# Verificar que curl está instalado
if ! command -v curl &> /dev/null; then
    echo "❌ Error: curl no está instalado"
    exit 1
fi

echo "1️⃣  Verificando conectividad básica..."
if curl -s -I https://app.vicevalds.dev > /dev/null 2>&1; then
    echo "✅ Servidor vicevalds es accesible"
else
    echo "❌ No se puede conectar a app.vicevalds.dev"
    echo ""
    echo "Posibles causas:"
    echo "  • Servidor está apagado"
    echo "  • Problema de red"
    echo "  • Firewall bloqueando la conexión"
    exit 1
fi

echo ""
echo "2️⃣  Verificando endpoint /api/audio..."

# Crear un archivo de audio de prueba muy simple (silencio)
# Este es un archivo webm válido mínimo
echo "Creando archivo de prueba..."

# Archivo webm base64 (audio muy corto con silencio)
TEST_FILE="/tmp/test_audio_$$.webm"

# Generar un archivo webm de prueba con ffmpeg si está disponible
if command -v ffmpeg &> /dev/null; then
    echo "   → Generando audio de prueba con ffmpeg..."
    ffmpeg -f lavfi -i "sine=frequency=1000:duration=1" -acodec libopus "$TEST_FILE" -y 2>&1 | grep -q "Output" && echo "   ✅ Audio generado" || echo "   ⚠️  Usando método alternativo"
fi

# Si no se pudo generar con ffmpeg, usar un webm mínimo
if [ ! -f "$TEST_FILE" ]; then
    echo "   → Creando archivo webm mínimo..."
    # WebM header + silent opus audio (base64)
    echo "GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwH/////////FUmpZpkq17GDD0JATYCGQ2hyb21lV0GGQ2hyb21lFlSua7+uvdeBAXPFh4EF/Kx/8AAAGFg=" | base64 -d > "$TEST_FILE" 2>/dev/null
fi

if [ ! -f "$TEST_FILE" ]; then
    echo "❌ No se pudo crear archivo de prueba"
    exit 1
fi

echo ""
echo "3️⃣  Enviando audio al servidor vicevalds..."
echo "   URL: https://app.vicevalds.dev/api/agent/process-audio"
echo "   Método: POST"
echo "   Campo: file (requerido por vicevalds)"
echo ""

# Enviar el archivo con curl - IMPORTANTE: usar 'file' como campo
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  https://app.vicevalds.dev/api/agent/process-audio \
  -F "file=@$TEST_FILE" \
  2>&1)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "═══════════════════════════════════════════════════"
echo "📡 RESPUESTA DEL SERVIDOR"
echo "═══════════════════════════════════════════════════"
echo ""
echo "Status Code: $HTTP_CODE"
echo ""
echo "Body:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

# Analizar el resultado
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo "✅ ¡ÉXITO! El servidor vicevalds respondió correctamente"
    echo ""
    echo "El endpoint está funcionando. Tu aplicación debería poder"
    echo "enviar audio sin problemas."
elif [ "$HTTP_CODE" = "000" ]; then
    echo "❌ ERROR DE CONEXIÓN"
    echo ""
    echo "No se pudo conectar al servidor. Posibles causas:"
    echo "  • Servidor está apagado"
    echo "  • Timeout de conexión"
    echo "  • Firewall bloqueando"
    echo "  • DNS no resuelve"
elif [ "$HTTP_CODE" = "404" ]; then
    echo "❌ ENDPOINT NO ENCONTRADO (404)"
    echo ""
    echo "El endpoint /api/agent/process-audio no existe en el servidor."
    echo "Verifica la URL correcta."
elif [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "422" ]; then
    echo "⚠️  ERROR DE VALIDACIÓN ($HTTP_CODE)"
    echo ""
    echo "El servidor rechazó el audio. Posibles causas:"
    echo "  • Formato incorrecto (debe ser MP3 o WebM)"
    echo "  • Campo incorrecto (debe ser 'file')"
    echo "  • Validación fallida"
elif [ "$HTTP_CODE" = "500" ] || [ "$HTTP_CODE" = "502" ] || [ "$HTTP_CODE" = "503" ]; then
    echo "❌ ERROR DEL SERVIDOR ($HTTP_CODE)"
    echo ""
    echo "El servidor tiene un problema interno."
    echo "Contacta al administrador del servidor vicevalds."
else
    echo "⚠️  RESPUESTA INESPERADA: $HTTP_CODE"
fi

echo ""
echo "═══════════════════════════════════════════════════"

# Limpiar
rm -f "$TEST_FILE"

exit 0
