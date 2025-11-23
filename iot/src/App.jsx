import React, { useState, useEffect, useRef } from 'react';
import RecordButton from './components/RecordButton';
import io from 'socket.io-client';

function App() {
  const [loading, setLoading] = useState(false);
  const [responseAudioUrl, setResponseAudioUrl] = useState(null);
  const [isPlayingResponse, setIsPlayingResponse] = useState(false);
  const [receivedAudioNotification, setReceivedAudioNotification] = useState(null);
  const audioRef = useRef(null);
  const socketRef = useRef(null);

  // Conectar a Socket.io y escuchar audios entrantes
  useEffect(() => {
    // Conectar al servidor Socket.io
    socketRef.current = io(window.location.origin, {
      transports: ['websocket', 'polling']
    });

    console.log('🔌 Conectando a Socket.io...');

    socketRef.current.on('connect', () => {
      console.log('✅ Conectado a Socket.io:', socketRef.current.id);
    });

    socketRef.current.on('disconnect', () => {
      console.log('❌ Desconectado de Socket.io');
    });

    // Escuchar evento de nuevo audio recibido
    socketRef.current.on('new-audio', (data) => {
      console.log('');
      console.log('═══════════════════════════════════════════════════');
      console.log('🎵 [Socket.io] NUEVO AUDIO RECIBIDO');
      console.log('═══════════════════════════════════════════════════');
      console.log('📁 Archivo:', data.originalName);
      console.log('🔗 URL:', data.audioUrl);
      console.log('⏰ Timestamp:', data.timestamp);
      console.log('');
      console.log('🔊 Reproduciendo audio automáticamente en el navegador...');

      // Mostrar notificación al usuario
      setReceivedAudioNotification({
        filename: data.originalName,
        timestamp: data.timestamp
      });

      // Ocultar notificación después de 5 segundos
      setTimeout(() => {
        setReceivedAudioNotification(null);
      }, 5000);

      // Reproducir audio automáticamente
      if (audioRef.current) {
        audioRef.current.src = data.audioUrl;
        audioRef.current.play()
          .then(() => {
            console.log('✅ Audio reproduciéndose en el navegador');
            console.log('═══════════════════════════════════════════════════');
          })
          .catch((error) => {
            console.error('❌ Error al reproducir audio:', error);
            console.log('═══════════════════════════════════════════════════');
          });
      }
    });

    // Cleanup al desmontar
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const handleRecordingComplete = async (audioBlob) => {
    // Validación adicional de seguridad
    if (!audioBlob || audioBlob.size === 0) {
      alert('Error: Audio inválido. Por favor, intenta grabar nuevamente.');
      return;
    }

    setLoading(true);

    const formData = new FormData();
    // IMPORTANTE: El servidor vicevalds espera el campo 'file' (no 'audio')
    formData.append('file', audioBlob, 'recording.webm');

    try {
      // Enviar audio al servidor vicevalds para procesamiento
      const response = await fetch('https://app.vicevalds.dev/api/agent/process-audio', {
        method: 'POST',
        body: formData,
        // No establecer Content-Type manualmente, el navegador lo hará con boundary
      });

      if (response.ok) {
        const data = await response.json();

        // Manejar el audio de respuesta del servidor vicevalds
        if (data.response_audio_url) {
          const fullAudioUrl = `https://app.vicevalds.dev${data.response_audio_url}`;
          setResponseAudioUrl(fullAudioUrl);

          // Descargar el audio de respuesta y enviarlo al servidor local para reproducción
          try {
            const audioResponse = await fetch(fullAudioUrl);

            if (audioResponse.ok) {
              const audioBlob = await audioResponse.blob();

              // Enviar el audio al servidor local para reproducción en los parlantes
              const localFormData = new FormData();
              localFormData.append('audio', audioBlob, 'response.webm');

              setIsPlayingResponse(true);

              const localResponse = await fetch('/api/audio/play', {
                method: 'POST',
                body: localFormData,
              });

              if (localResponse.ok) {
                const localData = await localResponse.json();
                // Notificar éxito completo
                alert('✅ ÉXITO!\n\nEl audio fue:\n1. Enviado a vicevalds ✓\n2. Procesado correctamente ✓\n3. Reproducido en los parlantes ✓');
              } else {
                const errorText = await localResponse.text();
                alert(`⚠️ Audio procesado por vicevalds pero hubo un error al reproducir:\n\nStatus: ${localResponse.status}\nDetalles: ${errorText}`);
              }

              setIsPlayingResponse(false);
            }
          } catch (audioError) {
            setIsPlayingResponse(false);
          }
        }
      } else {
        // Intentar leer el cuerpo de la respuesta para obtener más detalles
        let errorBody = '';
        try {
          errorBody = await response.text();
        } catch (e) {
          // Ignorar error al leer respuesta
        }

        // Alerta al usuario
        alert(`❌ Error del servidor vicevalds:\n\nStatus: ${response.status} ${response.statusText}\n\nDetalles: ${errorBody || 'Sin detalles adicionales'}\n\nPor favor, verifica que el servidor vicevalds esté funcionando correctamente.`);
      }
    } catch (error) {
      // Determinar el tipo de error
      let errorMessage = '';
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        errorMessage = `❌ ERROR DE CONEXIÓN\n\nNo se pudo conectar al servidor vicevalds.\n\nPosibles causas:\n• El servidor está apagado o no responde\n• Problema de red o firewall\n• URL incorrecta\n• Problema CORS\n\nURL intentada: https://app.vicevalds.dev/api/agent/process-audio\n\nPor favor, verifica que el servidor vicevalds esté funcionando.`;
      } else {
        errorMessage = `❌ ERROR AL ENVIAR AUDIO\n\nError: ${error.name}\nMensaje: ${error.message}\n\nPor favor, intenta nuevamente.`;
      }

      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray1">
      {/* Elemento de audio oculto para reproducir audios recibidos */}
      <audio ref={audioRef} style={{ display: 'none' }} />

      {/* Botón fijo en el centro del viewport */}
      <div className="fixed inset-0 flex-center pointer-events-none">
        <div className="pointer-events-auto">
          <RecordButton onRecordingComplete={handleRecordingComplete} />
        </div>
      </div>

      {loading && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 text-center text-gray11 bg-gray3 px-4 py-2 rounded-8 shadow-lg border border-gray5">
          Enviando a vicevalds...
        </div>
      )}

      {isPlayingResponse && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 text-center text-blue-500 bg-gray3 px-4 py-2 rounded-8 shadow-lg border border-blue-500 flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Reproduciendo en parlantes...
        </div>
      )}

      {/* Notificación de audio recibido vía Socket.io */}
      {receivedAudioNotification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 text-center bg-green-900 text-green-100 px-6 py-3 rounded-8 shadow-lg border border-green-500 flex items-center gap-3 animate-pulse">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
          </svg>
          <div className="text-left">
            <div className="font-semibold">🎵 Nuevo audio recibido</div>
            <div className="text-12 text-green-200 mt-1">{receivedAudioNotification.filename}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

