#!/bin/sh

# Script de entrada para Apache2 (configuración HTTP simple)

set -e

echo "🔧 Inicializando Apache2..."

# Verificar la configuración de Apache antes de iniciar
echo "🔍 Verificando configuración de Apache2..."
if httpd -t 2>&1; then
    echo "✅ Configuración de Apache2 válida"
else
    echo "❌ Error en la configuración de Apache2"
    exit 1
fi

# Ejecutar Apache2 en primer plano
echo "🚀 Iniciando Apache2 en puerto 80 (HTTP)..."
exec httpd -D FOREGROUND
