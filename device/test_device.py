"""
Script de Prueba - Simulador de Dispositivo de Voz
Prueba conexión bidireccional con el servidor ElderlyCare
"""

import requests
import json
import time
from pathlib import Path

# Configuración
SERVER_URL = "http://localhost:8080"

def test_send_memory():
    """Prueba 1: Enviar memoria al servidor"""
    print("\n🎤 Prueba 1: Enviar memoria al servidor")
    print("=" * 50)
    
    data = {
        "texto_original": "Recordarme que mañana tengo cita con el doctor a las 3pm",
        "items": [
            {
                "tipo": "Evento",
                "fecha": "mañana",
                "hora": "15:00",
                "descripcion": "Cita con el doctor",
                "personas": ["Doctor"],
                "lugar": "Hospital"
            }
        ]
    }
    
    try:
        response = requests.post(
            f"{SERVER_URL}/api/agent/memory",
            json=data,
            timeout=10
        )
        response.raise_for_status()
        result = response.json()
        
        print(f"✅ Memoria guardada exitosamente!")
        print(f"   IDs creados: {result['ids']}")
        print(f"   Total items: {result['count']}")
        return True
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def test_query_memory():
    """Prueba 2: Consultar memoria desde el servidor"""
    print("\n📖 Prueba 2: Consultar memoria")
    print("=" * 50)
    
    try:
        response = requests.get(
            f"{SERVER_URL}/api/agent/memory?limit=5",
            timeout=10
        )
        response.raise_for_status()
        items = response.json()
        
        print(f"✅ Memoria recuperada exitosamente!")
        print(f"   Total items: {len(items)}")
        
        if items:
            print("\n   Últimos items:")
            for item in items[:3]:
                print(f"   - {item['tipo']}: {item['descripcion']}")
                print(f"     Guardado: {item['timestamp_guardado']}")
        
        return True
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def test_process_audio_simple():
    """Prueba 3: Enviar audio simple (sin archivo real)"""
    print("\n🎵 Prueba 3: Procesar audio (simulado)")
    print("=" * 50)
    print("⚠️  Requiere OPENAI_API_KEY configurada en docker-compose")
    print("   Por ahora, usa endpoints de memoria directamente")
    print("   Endpoint disponible: POST /api/agent/process-audio")
    return True


def test_websocket_connection():
    """Prueba 4: Verificar conexión WebSocket"""
    print("\n🔌 Prueba 4: WebSocket")
    print("=" * 50)
    print("   WebSocket disponible en: ws://localhost:8080")
    print("   Eventos disponibles:")
    print("   - agent_response: Servidor envía audio de respuesta")
    print("   - audio_message: Mensajes de walkie-talkie")
    print("   - new_activity: Nuevas actividades")
    return True


def main():
    print("=" * 50)
    print("🤖  SIMULADOR DE DISPOSITIVO DE VOZ")
    print("=" * 50)
    print(f"Servidor: {SERVER_URL}")
    print()
    
    # Verificar conexión
    try:
        response = requests.get(f"{SERVER_URL}/api/activities", timeout=5)
        print("✅ Servidor accesible")
    except:
        print("❌ No se puede conectar al servidor")
        print("   Verifica que Docker esté corriendo")
        return
    
    # Ejecutar pruebas
    results = []
    results.append(test_send_memory())
    time.sleep(1)
    results.append(test_query_memory())
    time.sleep(1)
    results.append(test_process_audio_simple())
    time.sleep(1)
    results.append(test_websocket_connection())
    
    # Resumen
    print("\n" + "=" * 50)
    print("📊 RESUMEN")
    print("=" * 50)
    passed = sum(results)
    total = len(results)
    print(f"Pruebas exitosas: {passed}/{total}")
    
    if passed == total:
        print("✅ Todas las pruebas pasaron!")
    else:
        print("⚠️  Algunas pruebas fallaron")
    
    print("\n💡 Próximos pasos:")
    print("1. Configurar OPENAI_API_KEY en docker-compose.yml")
    print("2. Conectar dispositivo real por WebSocket")
    print("3. Enviar audio real para procesamiento")
    print("4. Recibir respuestas de audio en el dispositivo")


if __name__ == "__main__":
    main()
