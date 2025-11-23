const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const port = process.env.PORT || 3000;

// Crear servidor HTTP para Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Directorio para almacenar audios recibidos
const uploadsAudioDir = path.join(__dirname, 'uploads', 'audio');

// Asegurar que el directorio existe
if (!fs.existsSync(uploadsAudioDir)) {
  fs.mkdirSync(uploadsAudioDir, { recursive: true });
}

// Configurar multer para manejar archivos en memoria (proxy a vicevalds)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB límite
  }
});

// Configurar multer para recibir y almacenar audios entrantes
const uploadReceiveAudio = multer({
  dest: uploadsAudioDir,
  limits: { fileSize: 5 * 1024 * 1024 } // Límite: 5MB
});

// Middleware para parsear JSON
app.use(express.json());

// Servir archivos estáticos del directorio uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'dist')));

// Socket.io - Manejo de conexiones
io.on('connection', (socket) => {
  console.log('🔌 Cliente conectado via Socket.io:', socket.id);

  socket.on('disconnect', () => {
    console.log('🔌 Cliente desconectado:', socket.id);
  });
});

// Función para reproducir audio en Linux
function playAudio(audioBuffer, mimetype) {
  return new Promise((resolve, reject) => {
    // Crear archivo temporal
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const timestamp = Date.now();
    let extension = 'webm';
    let playerCommand = 'paplay'; // PulseAudio player por defecto
    
    // Determinar extensión y comando según el tipo MIME
    if (mimetype.includes('webm')) {
      extension = 'webm';
    } else if (mimetype.includes('mp3')) {
      extension = 'mp3';
    } else if (mimetype.includes('wav')) {
      extension = 'wav';
      playerCommand = 'paplay'; // paplay soporta wav directamente
    } else if (mimetype.includes('ogg')) {
      extension = 'ogg';
    }

    // Si es webm u otro formato que paplay no soporta directamente, usar ffplay
    if (extension === 'webm' || extension === 'mp3' || extension === 'ogg') {
      playerCommand = 'ffplay';
    }

    const tempFilePath = path.join(tempDir, `audio_${timestamp}.${extension}`);
    
    // Escribir buffer a archivo temporal
    fs.writeFileSync(tempFilePath, audioBuffer);

    // Reproducir audio
    let player;
    
    if (playerCommand === 'ffplay') {
      // ffplay reproduce automáticamente y no bloquea
      player = spawn('ffplay', [
        '-autoexit',
        '-nodisp',
        '-loglevel', 'quiet',
        tempFilePath
      ]);
    } else {
      // paplay para wav
      player = spawn('paplay', [tempFilePath]);
    }

    let errorOutput = '';

    player.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    player.on('close', (code) => {
      // Eliminar archivo temporal después de reproducir
      setTimeout(() => {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }, 1000);

      if (code === 0 || code === null) {
        resolve();
      } else {
        reject(new Error(`Error al reproducir audio: ${errorOutput || 'Código de salida ' + code}`));
      }
    });

    player.on('error', (err) => {
      // Eliminar archivo temporal en caso de error
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      reject(new Error(`Error al ejecutar el reproductor de audio: ${err.message}. Asegúrate de tener ${playerCommand} instalado.`));
    });
  });
}

// Endpoint POST para enviar audio al servidor vicevalds y procesar la respuesta
// Este endpoint actúa como proxy entre el cliente y vicevalds
// Flujo:
// 1. Recibe audio desde el cliente (campo 'audio' o 'file')
// 2. Reenvía el audio a vicevalds (https://app.vicevalds.dev/api/agent/process-audio)
// 3. Devuelve la respuesta completa de vicevalds al cliente
app.post('/api/agent/process-audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No se recibió ningún archivo de audio'
      });
    }

    const audioBuffer = req.file.buffer;
    const mimetype = req.file.mimetype;

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📤 ENVIANDO AUDIO AL SERVIDOR VICEVALDS');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`📁 Archivo: ${req.file.originalname}`);
    console.log(`📊 Tamaño: ${audioBuffer.length} bytes (${(audioBuffer.length / 1024).toFixed(2)} KB)`);
    console.log(`📋 MIME: ${mimetype}`);
    console.log(`🌐 Endpoint: https://app.vicevalds.dev/api/agent/process-audio`);
    console.log('⏳ Enviando petición...');

    // Crear FormData para enviar a vicevalds
    const formData = new FormData();
    // IMPORTANTE: vicevalds espera el campo 'file'
    formData.append('file', audioBuffer, {
      filename: req.file.originalname || 'recording.webm',
      contentType: mimetype,
    });

    // Enviar a vicevalds
    const response = await axios.post('https://app.vicevalds.dev/api/agent/process-audio', formData, {
      headers: formData.getHeaders(),
      validateStatus: () => true, // No lanzar error en status no-2xx
    });

    console.log('');
    console.log('───────────────────────────────────────────────────────────────');
    console.log('📥 RESPUESTA DEL SERVIDOR VICEVALDS');
    console.log('───────────────────────────────────────────────────────────────');
    console.log(`📊 Status: ${response.status} ${response.statusText}`);

    if (response.status >= 200 && response.status < 300) {
      const data = response.data;

      console.log('✅ AUDIO ENVIADO EXITOSAMENTE');
      console.log('📦 Datos de respuesta:');
      console.log(JSON.stringify(data, null, 2));
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('');

      // Devolver la respuesta completa de vicevalds al cliente
      res.json(data);
    } else {
      const errorText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

      console.log('❌ ERROR: NO SE PUDO ENVIAR EL AUDIO');
      console.log(`⚠️  Status: ${response.status} ${response.statusText}`);
      console.log('📄 Detalles del error:');
      console.log(errorText);
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('');

      res.status(response.status).json({
        success: false,
        error: `Error del servidor vicevalds: ${response.statusText}`,
        details: errorText,
      });
    }

  } catch (error) {
    console.log('');
    console.log('❌ EXCEPCIÓN AL COMUNICARSE CON VICEVALDS');
    console.log(`⚠️  Error: ${error.message}`);
    console.log('📄 Stack trace:');
    console.log(error.stack);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Error al conectar con el servidor vicevalds',
    });
  }
});

// Endpoint POST para recibir y reproducir audio en los parlantes del servidor
// Este endpoint está en escucha constante para recibir audio desde el frontend
// Flujo completo:
// 1. Frontend graba audio y lo envía a vicevalds con campo 'file' (https://app.vicevalds.dev/api/agent/process-audio)
// 2. Vicevalds procesa el audio y devuelve un audio de respuesta
// 3. Frontend descarga el audio de respuesta de vicevalds
// 4. Frontend envía el audio a este endpoint para reproducirlo en los parlantes
// NOTA: Este endpoint local acepta 'audio' como campo para mantener compatibilidad
app.post('/api/audio/play', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No se recibió ningún archivo de audio'
      });
    }

    const audioBuffer = req.file.buffer;
    const mimetype = req.file.mimetype;

    console.log(`Reproduciendo audio: ${req.file.originalname} (${mimetype}, ${audioBuffer.length} bytes)`);

    // Reproducir audio
    await playAudio(audioBuffer, mimetype);

    res.json({
      success: true,
      message: 'Audio reproducido exitosamente',
      filename: req.file.originalname,
      size: audioBuffer.length,
      mimetype: mimetype
    });

  } catch (error) {
    console.error('Error al reproducir audio:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint POST para recibir activamente audios externos y reproducirlos
// Este endpoint está diseñado para recibir audios de cualquier fuente externa
// Basado en la implementación robusta de recepción de audio
// Flujo:
// 1. Recibe audio mediante POST con campo 'file', 'audio', 'recording' o cualquier otro
// 2. Valida y guarda el archivo permanentemente
// 3. Reproduce el audio en los parlantes del dispositivo
// 4. Retorna confirmación con detalles del audio
app.post('/api/audio/receive', uploadReceiveAudio.any(), async (req, res) => {
  try {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🎧 RECIBIENDO AUDIO EXTERNO PARA REPRODUCCIÓN');
    console.log('═══════════════════════════════════════════════════════════════');

    // Multer.any() pone los archivos en req.files (array), no en req.file
    const uploadedFile = req.files && req.files.length > 0 ? req.files[0] : null;

    // Validar que se recibió un archivo
    if (!uploadedFile) {
      console.log('[AUDIO RECEIVE] ❌ Solicitud rechazada: No se subió ningún archivo');
      console.log('[AUDIO RECEIVE] ℹ️  Campos aceptados: file, audio, recording, o cualquier nombre');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('');
      return res.status(400).json({
        success: false,
        error: 'No audio file uploaded',
        hint: 'Accepted field names: file, audio, recording, or any other'
      });
    }

    console.log('[AUDIO RECEIVE] ℹ️  Campo recibido:', uploadedFile.fieldname);

    // Logging de recepción (siguiendo el patrón de referencia)
    console.log('[AUDIO RECEIVE] 🎤 Audio recibido exitosamente');
    console.log('  ├─ Nombre original:', uploadedFile.originalname);
    console.log('  ├─ Tamaño:', (uploadedFile.size / 1024).toFixed(2), 'KB');
    console.log('  ├─ Tipo MIME:', uploadedFile.mimetype);
    console.log('  └─ Timestamp:', new Date().toISOString());

    // Guardado permanente con nombre único
    const ext = path.extname(uploadedFile.originalname) || '.webm';
    const audioFilename = `received-${Date.now()}${ext}`;
    const audioPath = path.join(uploadsAudioDir, audioFilename);

    console.log('');
    console.log('[AUDIO RECEIVE] 💾 Guardando archivo permanentemente');
    console.log('  ├─ Nombre final:', audioFilename);
    console.log('  └─ Ruta:', audioPath);

    // Mover archivo temporal a ubicación permanente
    fs.renameSync(uploadedFile.path, audioPath);
    const audioUrl = `/uploads/audio/${audioFilename}`;

    console.log('[AUDIO RECEIVE] ✅ Archivo guardado exitosamente');
    console.log('  └─ URL pública:', audioUrl);

    // Leer el archivo guardado para reproducción
    console.log('');
    console.log('[AUDIO RECEIVE] 🔊 Reproduciendo audio en parlantes del servidor');
    const audioBuffer = fs.readFileSync(audioPath);
    const mimetype = uploadedFile.mimetype;

    // Reproducir audio en los parlantes del servidor
    await playAudio(audioBuffer, mimetype);

    console.log('[AUDIO RECEIVE] ✅ Audio reproducido en parlantes del servidor');

    // Emitir evento a todos los clientes web conectados para reproducir en navegador
    console.log('[AUDIO RECEIVE] 📡 Emitiendo audio a clientes web conectados');
    io.emit('new-audio', {
      audioUrl: audioUrl,
      filename: audioFilename,
      originalName: uploadedFile.originalname,
      timestamp: new Date().toISOString()
    });
    console.log('[AUDIO RECEIVE] ✅ Evento emitido a clientes web');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    // Respuesta exitosa
    res.json({
      success: true,
      message: 'Audio received and played successfully',
      audio: {
        filename: audioFilename,
        originalName: uploadedFile.originalname,
        fieldName: uploadedFile.fieldname,
        size: uploadedFile.size,
        sizeKB: (uploadedFile.size / 1024).toFixed(2),
        mimetype: mimetype,
        url: audioUrl,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.log('');
    console.log('[AUDIO RECEIVE] ❌ ERROR AL PROCESAR AUDIO');
    console.log('  ├─ Error:', error.message);
    console.log('  └─ Stack:', error.stack);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    // Limpiar archivo temporal si existe
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        if (file.path && fs.existsSync(file.path)) {
          try {
            fs.unlinkSync(file.path);
            console.log('[AUDIO RECEIVE] 🧹 Archivo temporal eliminado:', file.originalname);
          } catch (cleanupError) {
            console.error('[AUDIO RECEIVE] ⚠️  Error al limpiar archivo temporal:', cleanupError.message);
          }
        }
      });
    }

    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Error processing audio file'
    });
  }
});

// Ruta catch-all para SPA (solo si existe el directorio dist)
app.get('*', (req, res) => {
  const distPath = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(distPath)) {
    res.sendFile(distPath);
  } else {
    res.status(404).json({ 
      message: 'Frontend no construido. Ejecuta "npm run build" primero.' 
    });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log('═══════════════════════════════════════════════════');
  console.log('🚀 Servidor IoT iniciado correctamente');
  console.log('═══════════════════════════════════════════════════');
  console.log(`🌐 Servidor escuchando en: http://0.0.0.0:${port}`);
  console.log(`🔌 Socket.io habilitado en: ws://0.0.0.0:${port}`);
  console.log('');
  console.log('📡 Endpoints disponibles:');
  console.log(`  • POST /api/agent/process-audio - Proxy a vicevalds`);
  console.log(`  • POST /api/audio/play - Reproducir en parlantes (memoria)`);
  console.log(`  • POST /api/audio/receive - Recibir y reproducir audios externos`);
  console.log('');
  console.log('💾 Directorio de almacenamiento:');
  console.log(`  • ${uploadsAudioDir}`);
  console.log('');
  console.log('Flujos disponibles:');
  console.log('  Opción 1 (con proxy):');
  console.log('    1️⃣  Cliente → Este servidor → vicevalds');
  console.log('    2️⃣  vicevalds → Este servidor → Cliente');
  console.log('    3️⃣  Cliente → Este servidor (reproducir)');
  console.log('');
  console.log('  Opción 2 (directo):');
  console.log('    1️⃣  Frontend → vicevalds (directo)');
  console.log('    2️⃣  vicevalds → Frontend');
  console.log('    3️⃣  Frontend → Este servidor (reproducir)');
  console.log('');
  console.log('  Opción 3 (recepción externa + web):');
  console.log('    1️⃣  Fuente externa → POST /api/audio/receive');
  console.log('    2️⃣  Audio se reproduce en parlantes del servidor');
  console.log('    3️⃣  Audio se envía via Socket.io a todos los clientes web');
  console.log('    4️⃣  Clientes web reproducen audio automáticamente');
  console.log('═══════════════════════════════════════════════════');
});

