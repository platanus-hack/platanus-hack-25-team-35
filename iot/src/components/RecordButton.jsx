import React, { useRef, useState } from 'react';
import {
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
} from 'motion/react';

const MAX_DURATION = 60000; // 60 segundos en milisegundos

export default function RecordButton({ onRecordingComplete }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const animationRef = useRef(null);

  const progress = useMotionValue(0);

  const startRecording = async () => {
    console.log('🎙️ [RecordButton] Iniciando grabación...');
    try {
      console.log('🎤 [RecordButton] Solicitando acceso al micrófono...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('✅ [RecordButton] Acceso al micrófono concedido');

      // Intentar usar audio/webm;codecs=opus (mejor compatibilidad)
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
      });
      console.log(`📹 [RecordButton] MediaRecorder creado con formato ${mimeType}`);

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log('📦 [RecordButton] Chunk de audio recibido:', event.data.size, 'bytes');
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('🛑 [RecordButton] Grabación detenida');
        console.log('📊 [RecordButton] Total de chunks:', chunksRef.current.length);

        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        console.log('📊 [RecordButton] Tamaño total del Blob:', audioBlob.size, 'bytes');

        // Validar que el Blob tenga contenido
        if (audioBlob.size === 0 || chunksRef.current.length === 0) {
          console.warn('⚠️ [RecordButton] Blob vacío - grabación demasiado corta');
          alert('La grabación es demasiado corta. Mantén presionado el botón por al menos 1 segundo.');
          stream.getTracks().forEach((track) => track.stop());
          console.log('🔇 [RecordButton] Micrófono desactivado');
          return;
        }

        console.log('🔄 [RecordButton] Llamando a onRecordingComplete...');
        onRecordingComplete(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
        console.log('🔇 [RecordButton] Micrófono desactivado');
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      console.log('▶️ [RecordButton] Grabación en curso...');

      // Animar el progreso circular
      animationRef.current = animate(progress, 100, {
        ease: 'linear',
        duration: MAX_DURATION / 1000,
        onUpdate: (latest) => {
          setRecordingTime(Math.floor((latest / 100) * MAX_DURATION));
        },
        onComplete: () => {
          stopRecording();
        },
      });

      // Timer de seguridad
      timerRef.current = setTimeout(() => {
        console.log('⏱️ [RecordButton] Tiempo máximo alcanzado (60s)');
        stopRecording();
      }, MAX_DURATION);
    } catch (error) {
      console.error('❌ [RecordButton] Error al acceder al micrófono:', error);
      console.error('📊 [RecordButton] Detalles:', error.message);
      alert('No se pudo acceder al micrófono. Por favor, permite el acceso.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      console.log('⏹️ [RecordButton] Deteniendo grabación...');
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }

      // Resetear el progreso con animación de resorte
      animate(progress, 0, {
        type: 'spring',
        stiffness: 500,
        damping: 50,
      });

      setRecordingTime(0);
      console.log('✅ [RecordButton] Grabación detenida correctamente');
    }
  };

  const handlePointerDown = () => {
    console.log('👆 [RecordButton] Botón presionado');
    if (!isRecording) {
      startRecording();
    }
  };

  const handlePointerUp = () => {
    console.log('👆 [RecordButton] Botón liberado');
    if (isRecording) {
      stopRecording();
    }
  };

  const handleMouseLeave = () => {
    console.log('🖱️ [RecordButton] Mouse salió del botón');
    if (isRecording) {
      stopRecording();
    }
  };

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    return `${seconds}s`;
  };

  // Progreso circular (cónica) como Instagram
  // Comienza desde las 6 en punto (180deg) y avanza en sentido horario
  const circleProgress = useMotionTemplate`conic-gradient(
    from 180deg,
    var(--color-red) ${progress}%, 
    transparent ${progress}%
  )`;

  return (
    <div className="relative flex-center">
      {/* Botón principal */}
      <button
        className="relative rounded-full w-32 h-32 flex-center bg-gray5 hover:bg-gray6 active:bg-gray7 overflow-hidden cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 ease-swift shadow-lg"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onMouseLeave={handleMouseLeave}
        onTouchEnd={handlePointerUp}
        style={{
          touchAction: 'none',
        }}
      >
        {/* Icono de micrófono */}
        <div className="relative z-10 flex-center flex-col gap-2">
          <IconMicrophone
            className={`transition-colors ${
              isRecording ? 'text-white' : 'text-gray12'
            }`}
          />
          {isRecording && (
            <span className="text-12 text-white font-mono">
              {formatTime(recordingTime)}
            </span>
          )}
        </div>

        {/* Overlay circular de progreso */}
        {isRecording && (
          <motion.div
            className="absolute inset-0 rounded-full flex-center pointer-events-none"
            style={{
              background: circleProgress,
            }}
          >
            {/* Círculo interior para mantener el centro visible */}
            <div className="w-28 h-28 rounded-full bg-red flex-center">
              <div className="w-24 h-24 rounded-full bg-red" />
            </div>
          </motion.div>
        )}

        {/* Indicador de pulsación */}
        {isRecording && (
          <motion.div
            className="absolute inset-0 rounded-full bg-red opacity-20"
            initial={{ scale: 1 }}
            animate={{ scale: [1, 1.1, 1] }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}
      </button>
    </div>
  );
}

function IconMicrophone({ className }) {
  return (
    <svg
      width="48px"
      height="48px"
      viewBox="0 0 24 24"
      strokeWidth="2"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      color="currentColor"
      className={className}
    >
      <rect
        x="9"
        y="2"
        width="6"
        height="12"
        rx="3"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M5 10v1a7 7 0 007 7v0a7 7 0 007-7v-1M12 18v4m0 0H9m3 0h3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

