#!/bin/bash

# Script de prueba para el endpoint /api/audio/receive
# Este script demuestra cómo enviar audios al dispositivo para que los reproduzca

echo "═══════════════════════════════════════════════════════════════"
echo "🧪 SCRIPT DE PRUEBA - ENDPOINT /api/audio/receive"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Este script prueba el endpoint que recibe audios externos"
echo "y los reproduce en los parlantes del dispositivo."
echo ""
echo "Requisitos:"
echo "  • Archivo de audio de prueba en formato webm, mp3, wav u ogg"
echo "  • Servidor corriendo en el puerto configurado (default: 3000)"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Configuración
SERVER_URL="http://localhost:3000"
ENDPOINT="/api/audio/receive"

# Verificar si el servidor está corriendo
echo "🔍 Verificando conexión al servidor..."
if ! curl -s -f -o /dev/null "$SERVER_URL"; then
    echo "❌ ERROR: No se puede conectar al servidor en $SERVER_URL"
    echo "   Asegúrate de que el servidor esté corriendo."
    exit 1
fi
echo "✅ Servidor accesible"
echo ""

# Buscar archivos de audio de prueba
echo "🔍 Buscando archivos de audio de prueba..."
AUDIO_FILE=""

# Buscar en el directorio temp o usar un archivo de prueba
if [ -f "temp/audio_test.webm" ]; then
    AUDIO_FILE="temp/audio_test.webm"
elif [ -f "test.mp3" ]; then
    AUDIO_FILE="test.mp3"
elif [ -f "test.wav" ]; then
    AUDIO_FILE="test.wav"
else
    echo "⚠️  No se encontró archivo de audio de prueba"
    echo ""
    echo "Para usar este script, necesitas un archivo de audio."
    echo "Opciones:"
    echo "  1. Crea un archivo temp/audio_test.webm"
    echo "  2. Crea un archivo test.mp3 en el directorio actual"
    echo "  3. Especifica la ruta manualmente:"
    echo "     $0 /ruta/al/archivo.mp3"
    echo ""

    # Verificar si se pasó un argumento
    if [ -n "$1" ]; then
        if [ -f "$1" ]; then
            AUDIO_FILE="$1"
            echo "✅ Usando archivo especificado: $AUDIO_FILE"
        else
            echo "❌ El archivo especificado no existe: $1"
            exit 1
        fi
    else
        exit 1
    fi
fi

echo "✅ Archivo de audio encontrado: $AUDIO_FILE"
FILE_SIZE=$(du -h "$AUDIO_FILE" | cut -f1)
echo "   └─ Tamaño: $FILE_SIZE"
echo ""

# Enviar el audio al servidor
echo "═══════════════════════════════════════════════════════════════"
echo "📤 ENVIANDO AUDIO AL SERVIDOR"
echo "═══════════════════════════════════════════════════════════════"
echo "URL: $SERVER_URL$ENDPOINT"
echo "Archivo: $AUDIO_FILE"
echo ""

echo "⏳ Enviando petición..."
RESPONSE=$(curl -s -X POST \
    -F "file=@$AUDIO_FILE" \
    "$SERVER_URL$ENDPOINT")

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "📥 RESPUESTA DEL SERVIDOR"
echo "═══════════════════════════════════════════════════════════════"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Verificar si fue exitoso
if echo "$RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
    echo "✅ ÉXITO: El audio fue recibido y reproducido correctamente"
    echo ""
    echo "Detalles:"
    echo "$RESPONSE" | jq -r '"  • Archivo guardado: \(.audio.filename)"' 2>/dev/null
    echo "$RESPONSE" | jq -r '"  • Tamaño: \(.audio.sizeKB) KB"' 2>/dev/null
    echo "$RESPONSE" | jq -r '"  • Tipo MIME: \(.audio.mimetype)"' 2>/dev/null
    echo "$RESPONSE" | jq -r '"  • URL: \(.audio.url)"' 2>/dev/null
else
    echo "❌ ERROR: No se pudo procesar el audio"
    echo ""
    ERROR_MSG=$(echo "$RESPONSE" | jq -r '.error // "Error desconocido"' 2>/dev/null)
    echo "Mensaje de error: $ERROR_MSG"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "🏁 PRUEBA COMPLETADA"
echo "═══════════════════════════════════════════════════════════════"
