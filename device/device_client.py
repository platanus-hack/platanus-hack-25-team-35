"""
Cliente de Dispositivo de Voz - Comunicación Bidireccional
Conecta dispositivo al servidor vía WebSocket para:
1. Enviar audio al servidor para procesamiento
2. Recibir recordatorios y respuestas en audio
"""

import socketio
import requests
import time
import os
from pathlib import Path

# Configuración
SERVER_URL = "http://localhost:8080"

# Cliente WebSocket
sio = socketio.Client()

# Estado
receiving_audio = False

@sio.event
def connect():
    """Cuando el dispositivo se conecta al servidor"""
    print("Dispositivo conectado al servidor")
    print(f"   ID de sesión: {sio.sid}")
    print()

@sio.event
def disconnect():
    """Cuando el dispositivo se desconecta"""
    print("Dispositivo desconectado del servidor")

@sio.on('agent_response')
def on_agent_response(data):
    """
    IMPORTANTE: Servidor envía respuesta de audio al dispositivo
    El dispositivo debe reproducir este audio
    """
    print("\nRESPUESTA DEL SERVIDOR:")
    print(f"   Texto: {data['text']}")
    print(f"   Audio URL: {data['audioUrl']}")
    print(f"   Timestamp: {data['timestamp']}")
    
    # Descargar y reproducir audio
    if data['audioUrl']:
        audio_url = f"{SERVER_URL}{data['audioUrl']}"
        print(f"\n   Descargando audio: {audio_url}")
        
        try:
            response = requests.get(audio_url)
            if response.status_code == 200:
                # Guardar audio localmente
                audio_file = f"device_audio_{int(time.time())}.mp3"
                with open(audio_file, 'wb') as f:
                    f.write(response.content)
                
                print(f"   Audio guardado: {audio_file}")
                print(f"   REPRODUCIR ESTE AUDIO EN EL DISPOSITIVO")
                print()
                
                # Aquí el dispositivo real reproduciría el audio
                # Por ejemplo: playsound(audio_file)
        except Exception as e:
            print(f"   Error descargando audio: {e}")

@sio.on('new_activity')
def on_new_activity(data):
    """
    Cuando se crea una actividad nueva en el sistema
    Puede ser usado para enviar recordatorio al adulto mayor
    """
    print("\nNUEVA ACTIVIDAD DETECTADA:")
    print(f"   Título: {data.get('title')}")
    print(f"   Fecha: {data.get('date')}")
    print(f"   Hora: {data.get('time')}")
    print()

@sio.on('audio_message')
def on_audio_message(data):
    """
    Mensajes de walkie-talkie del sistema web
    """
    print("\nMENSAJE DE AUDIO (Walkie-Talkie):")
    print(f"   De: {data.get('from')}")
    print(f"   URL: {data.get('fileUrl')}")
    print()


def send_audio_to_server(audio_file_path):
    """
    Envía archivo de audio al servidor para procesamiento
    """
    print(f"\nEnviando audio al servidor: {audio_file_path}")
    
    if not os.path.exists(audio_file_path):
        print(f"   Archivo no encontrado: {audio_file_path}")
        return False
    
    try:
        with open(audio_file_path, 'rb') as f:
            files = {'file': f}
            response = requests.post(
                f"{SERVER_URL}/api/agent/process-audio",
                files=files,
                timeout=30
            )
        
        if response.status_code == 200:
            result = response.json()
            print("   Audio procesado exitosamente!")
            print(f"   Transcripción: {result.get('transcription')}")
            print(f"   Items guardados: {result.get('items_saved')}")
            print(f"   Respuesta: {result.get('response_text')}")
            
            # La respuesta en audio llegará por WebSocket en evento 'agent_response'
            print("\n   Esperando respuesta en audio vía WebSocket...")
            return True
        else:
            print(f"   Error: {response.status_code}")
            print(f"   {response.text}")
            return False
            
    except Exception as e:
        print(f"   Error: {e}")
        return False


def send_message_to_server(audio_file_path):
    """
    Envía mensaje de audio (Walkie-Talkie) al servidor sin procesamiento de agente
    """
    print(f"\nEnviando mensaje de audio al servidor: {audio_file_path}")
    
    if not os.path.exists(audio_file_path):
        print(f"   Archivo no encontrado: {audio_file_path}")
        return False
    
    try:
        with open(audio_file_path, 'rb') as f:
            files = {'file': f}
            data = {'from': 'device'}
            response = requests.post(
                f"{SERVER_URL}/api/audio/message",
                files=files,
                data=data,
                timeout=30
            )
        
        if response.status_code == 201:
            result = response.json()
            print("   Mensaje enviado exitosamente!")
            print(f"   URL: {result.get('file_url')}")
            return True
        else:
            print(f"   Error: {response.status_code}")
            print(f"   {response.text}")
            return False
            
    except Exception as e:
        print(f"   Error: {e}")
        return False


def test_mode():
    """Modo de prueba interactivo"""
    print("\n" + "="*60)
    print("🤖  CLIENTE DE DISPOSITIVO DE VOZ - MODO PRUEBA")
    print("="*60)
    print()
    
    # Conectar al servidor
    print("Conectando al servidor...")
    try:
        sio.connect(SERVER_URL)
    except Exception as e:
        print(f"❌ No se pudo conectar: {e}")
        print("   Verifica que el servidor esté corriendo")
        return
    
    print("\n💡 Instrucciones:")
    print("   1. El dispositivo está conectado y escuchando")
    print("   2. Enviaremos un audio de prueba (si existe)")
    print("   3. El servidor procesará y responderá vía WebSocket")
    print("   4. El dispositivo recibirá y reproducirá la respuesta")
    print()
   
    # Esperar un momento para establecer conexión
    time.sleep(2)
    
    # Simular envío de audio (si tienes un archivo de prueba)
    test_audio = "test_audio.webm"  # Cambiar por archivo real
    if os.path.exists(test_audio):
        send_audio_to_server(test_audio)
        
        # Esperar respuesta del servidor (llegará por WebSocket)
        print("\n⏳ Manteniéndose conectado para recibir respuestas...")
        print("   (Presiona Ctrl+C para salir)")
        
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n\n👋 Cerrando conexión...")
    else:
        print(f"⚠️  No se encontró archivo de prueba: {test_audio}")
        print("   Puedes usar el siguiente comando para enviar audio:")
        print(f"   send_audio_to_server('tu_archivo.webm')")
        print()
        print("   Manteniendo conexión WebSocket para recibir eventos...")
        print("   (Presiona Ctrl+C para salir)")
        
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n\n👋 Cerrando conexión...")
    
    sio.disconnect()


def production_mode():
    """
    Modo producción - mantiene conexión permanente con el servidor
    """
    print("🚀 MODO PRODUCCIÓN - Dispositivo de Voz")
    print("="*60)
    
    while True:
        try:
            print("\n📡 Conectando al servidor...")
            sio.connect(SERVER_URL)
            
            print("✅ Conexión establecida")
            print("🎧 Escuchando eventos del servidor...")
            print()
            
            # Mantener conexión activa
            sio.wait()
            
        except KeyboardInterrupt:
            print("\n👋 Cerrando dispositivo...")
            break
        except Exception as e:
            print(f"❌ Error de conexión: {e}")
            print("⏳ Reintentando en 5 segundos...")
            time.sleep(5)
    
    sio.disconnect()


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        if arg == "production":
            production_mode()
        elif os.path.exists(arg):
            # Modo envío de archivo específico
            print(f"Enviando archivo: {arg}")
            try:
                sio.connect(SERVER_URL)
                time.sleep(1)
                send_audio_to_server(arg)
                print("\nEsperando respuesta del servidor (Ctrl+C para salir)...")
                sio.wait()
            except KeyboardInterrupt:
                print("\nCerrando...")
            except Exception as e:
                print(f"Error: {e}")
        else:
            print(f"Archivo no encontrado: {arg}")
            test_mode()
    else:
        test_mode()
