const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getIO } = require('../socket');
const { logInteraction } = require('../utils/logger');
const { uploadAgentAudio, uploadsAudioDir } = require('../utils/upload');
const openai = require('../openai');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const {
    processAudioIntelligence,
    processMemoryWithChatGPT,
    classifyInteraction,
    answerQueryFromMemory
} = require('../utils/audioHelpers');

// Receive generic agent data
router.post('/data', async (req, res) => {
    try {
        const { type, data, timestamp, agentId } = req.body;

        console.log('[AGENT] Received data:', { type, data, agentId });

        let created = null;
        const io = getIO();

        if (type === 'activity' || type === 'reminder' || type === 'alarm') {
            const result = await pool.query(
                `INSERT INTO activities (date, title, type, time, source, agent_id, received_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                [
                    data.date,
                    data.title,
                    data.type || 'activity',
                    data.time || null,
                    'agent',
                    agentId,
                    timestamp || new Date()
                ]
            );

            created = result.rows[0];
            await logInteraction(`${type}_created`, `Agente creó: ${data.title}`, created, 'agent');
            io.emit('new_activity', created);

        } else if (type === 'medication') {
            const result = await pool.query(
                `INSERT INTO medications (name, dosage, frequency, active, source, agent_id, received_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                [
                    data.name,
                    data.dosage || null,
                    data.frequency || null,
                    true,
                    'agent',
                    agentId,
                    timestamp || new Date()
                ]
            );

            created = result.rows[0];
            await logInteraction('medication_created', `Agente creó medicamento: ${data.name}`, created, 'agent');
            io.emit('new_medication', created);
        } else {
            return res.status(400).json({ error: 'Invalid type' });
        }

        res.status(201).json({ success: true, id: created.id, data: created });
    } catch (err) {
        console.error('Error processing agent data:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Save agent memory
router.post('/memory', async (req, res) => {
    try {
        const { texto_original, items } = req.body;

        if (!items || !Array.isArray(items)) {
            return res.status(400).json({ error: 'items must be an array' });
        }

        const ids = [];

        for (const item of items) {
            const result = await pool.query(`
                INSERT INTO agent_memory 
                (texto_original, tipo, fecha, hora, descripcion, clasificacion,
                 responsable_requerido, personas, lugar)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING id
            `, [
                texto_original || '',
                item.tipo,
                item.fecha || null,
                item.hora || null,
                item.descripcion || null,
                item.clasificacion || null,
                item.responsable_requerido || null,
                JSON.stringify(item.personas || []),
                item.lugar || null
            ]);

            ids.push(result.rows[0].id);

            // Log interaction
            await logInteraction('memory_saved',
                `Agente guardó: ${item.descripcion || item.tipo}`,
                item, 'agent');
        }

        console.log('[AGENT] Stored memory items:', ids);
        res.json({ success: true, ids, count: ids.length });
    } catch (err) {
        console.error('Error saving agent memory:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get agent memory
router.get('/memory', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 30;
        const tipo = req.query.tipo;

        let query = 'SELECT * FROM agent_memory WHERE 1=1';
        const params = [];

        if (tipo) {
            params.push(tipo);
            query += ` AND tipo = $${params.length}`;
        }

        query += ` ORDER BY timestamp_guardado DESC LIMIT $${params.length + 1}`;
        params.push(limit);

        const result = await pool.query(query, params);

        // Parse personas JSON back to array
        const rows = result.rows.map(row => ({
            ...row,
            personas: typeof row.personas === 'string' ? JSON.parse(row.personas) : row.personas
        }));

        res.json(rows);
    } catch (err) {
        console.error('Error querying agent memory:', err);
        res.status(500).json({ error: 'Database error' });
    }
});



// Process agent audio (Memory feature)
router.post('/process-audio', uploadAgentAudio.single('file'), async (req, res) => {
    const startTime = Date.now();
    try {
        const io = getIO(); // Initialize io at the start

        if (!req.file) {
            console.log('[AGENT] ❌ Audio request rejected: No file uploaded');
            return res.status(400).json({ error: 'No audio file uploaded' });
        }

        console.log('═══════════════════════════════════════════════════════════');
        console.log('[AGENT] 🎤 Audio received');
        console.log('  ├─ Original filename:', req.file.originalname);
        console.log('  ├─ File size:', (req.file.size / 1024).toFixed(2), 'KB');
        console.log('  ├─ MIME type:', req.file.mimetype);
        console.log('  └─ Timestamp:', new Date().toISOString());

        // Check if audio is from WhatsApp (familiar interaction)
        const isWhatsAppAudio = req.file.originalname.toLowerCase().includes('whatsapp');
        if (isWhatsAppAudio) {
            console.log('[AGENT] 📱 WhatsApp audio detected - marking as FAMILIAR');
        }

        // 1. Save audio permanently with correct extension
        const ext = path.extname(req.file.originalname) || '.webm';
        const audioFilename = `agent-${Date.now()}${ext}`;
        const audioPath = path.join(uploadsAudioDir, audioFilename);

        // Rename/Move the file
        fs.renameSync(req.file.path, audioPath);
        const audioUrl = `/uploads/audio/${audioFilename}`;
        console.log('[AGENT] 💾 Audio saved:', audioFilename);

        // Save to audio_messages table
        await pool.query(`
            INSERT INTO audio_messages (from_source, file_path, file_url, timestamp)
            VALUES ($1, $2, $3, $4)
        `, ['device', audioPath, audioUrl, new Date()]);
        console.log('[AGENT] ✅ Audio registered in database');

        // 2. Transcribe
        console.log('[AGENT] 📝 Starting transcription...');
        let transcription_text = '';
        if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-placeholder') {
            try {
                const transcription = await openai.audio.transcriptions.create({
                    file: fs.createReadStream(audioPath),
                    model: 'whisper-1'
                });
                transcription_text = transcription.text;
                console.log('[AGENT] ✅ Transcription completed');
                console.log('  └─ Text:', transcription_text.substring(0, 100) + (transcription_text.length > 100 ? '...' : ''));
            } catch (err) {
                console.error('[AGENT] ❌ Whisper transcription failed:', err.message);
                transcription_text = 'Error en transcripción';
            }
        } else {
            transcription_text = req.body.texto || 'Audio sin transcribir (configurar OPENAI_API_KEY)';
            console.log('[AGENT] ⚠️  Transcription skipped: OpenAI API key not configured');
        }

        // 3. CHECK FOR MEDICATION CONFIRMATION
        let medication_confirmed = false;
        const confirmationKeywords = ['confirmación', 'confirmacion', 'confirmo', 'listo', 'tomé', 'tome', 'ya tomé', 'ya tome', 'si tomé', 'si tome', 'ok', 'hecho'];

        if (transcription_text && confirmationKeywords.some(keyword => transcription_text.toLowerCase().includes(keyword))) {
            console.log('[AGENT] 🔍 Detected potential medication confirmation in audio');

            // Find the most recent unconfirmed medication reminder
            const pendingMedResult = await pool.query(`
                SELECT sr.event_id, sr.event_datetime, sr.reminder_timing, m.name
                FROM sent_reminders sr
                JOIN medications m ON m.id = sr.event_id
                WHERE sr.event_type = 'medication'
                AND sr.requires_confirmation = true
                AND sr.confirmed = false
                AND sr.event_datetime <= $1
                ORDER BY sr.event_datetime DESC
                LIMIT 1
            `, [new Date()]);

            if (pendingMedResult.rows.length > 0) {
                const pendingMed = pendingMedResult.rows[0];

                // Mark all reminders for this medication as confirmed
                await pool.query(`
                    UPDATE sent_reminders
                    SET confirmed = true, confirmed_at = $1
                    WHERE event_type = 'medication'
                    AND event_id = $2
                    AND event_datetime = $3
                    AND requires_confirmation = true
                `, [new Date(), pendingMed.event_id, pendingMed.event_datetime]);

                medication_confirmed = true;
                console.log(`[AGENT] ✅ Medication confirmed: ${pendingMed.name} for ${pendingMed.event_datetime}`);

                // Log interaction
                await logInteraction('medication_confirmed',
                    `Medicamento confirmado: ${pendingMed.name}`,
                    { medication_id: pendingMed.event_id, datetime: pendingMed.event_datetime },
                    'agent');
            }
        }

        // 4. INTELLIGENT PROCESSING (New Flow)
        let response_text = '';
        let items_saved_count = 0;
        let interaction_type = 'otro';
        let extracted = { activities: [], medications: [], appointments: [] };

        if (transcription_text && transcription_text.length > 5) {
            // If medication was confirmed, generate appropriate response
            if (medication_confirmed) {
                response_text = 'Perfecto, he registrado que tomaste tu medicamento. Gracias por confirmar.';
                console.log('[AGENT] ✅ Medication confirmation response generated');
            } else {
                // A. Classify Interaction
                console.log('[AGENT] 🔍 Classifying interaction...');
                const interaction = await classifyInteraction(transcription_text);
                interaction_type = interaction.tipo_interaccion;
                console.log('[AGENT] ✅ Classification:', interaction_type.toUpperCase());

                if (interaction_type === 'consulta') {
                // B. Handle Query
                console.log('[AGENT] 💬 Processing query...');
                response_text = await answerQueryFromMemory(transcription_text);
                console.log('[AGENT] ✅ Query answered');
                console.log('  └─ Response:', response_text.substring(0, 80) + (response_text.length > 80 ? '...' : ''));
            } else {
                // C. Handle Capture/Other (Store)

                // 1. Enhanced Memory Processing (New System)
                if (interaction_type === 'captura') {
                    console.log('[AGENT] 💾 Processing memory capture...');
                    const items = await processMemoryWithChatGPT(transcription_text);

                    for (const item of items) {
                        // Override clasificacion to 'familiar' if audio is from WhatsApp
                        const finalClasificacion = isWhatsAppAudio ? 'familiar' : item.clasificacion;

                        await pool.query(`
                            INSERT INTO agent_memory
                            (texto_original, tipo, fecha, hora, descripcion, clasificacion,
                             responsable_requerido, personas, lugar, audio_file_path, origen)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                        `, [
                            transcription_text,
                            item.tipo,
                            item.fecha || null,
                            item.hora || null,
                            item.descripcion,
                            finalClasificacion,
                            item.responsable_requerido,
                            JSON.stringify(item.personas || []),
                            item.lugar,
                            audioPath,
                            'audio'
                        ]);
                        items_saved_count++;
                    }
                    console.log('[AGENT] ✅ Memory items saved:', items_saved_count);
                    if (isWhatsAppAudio) {
                        console.log('[AGENT] 📱 All items marked as FAMILIAR (WhatsApp source)');
                    }
                    response_text = 'Entendido, he guardado esa información.';
                } else {
                    response_text = 'He escuchado tu mensaje.';
                    console.log('[AGENT] ℹ️  Other interaction type - message acknowledged');
                }

                // 2. Legacy/Parallel Processing (Old System for Calendar/Tabs)
                // This ensures backward compatibility with existing UI
                console.log('[AGENT] 🔄 Processing for calendar integration...');
                extracted = await processAudioIntelligence(transcription_text, 'agent');

                // === CREATE ACTIVITIES IN DATABASE ===
                const createdActivities = [];
                if (extracted.activities && extracted.activities.length > 0) {
                    console.log('[AGENT] 📅 Creating', extracted.activities.length, 'activities...');
                    for (const activity of extracted.activities) {
                        if (activity.date && activity.title) {
                            const actResult = await pool.query(
                                `INSERT INTO activities (date, title, type, time, source, agent_id, received_at)
                                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                                [
                                    activity.date,
                                    activity.title,
                                    activity.type || 'activity',
                                    activity.time || null,
                                    'agent',
                                    null,
                                    new Date()
                                ]
                            );
                            const newActivity = actResult.rows[0];
                            createdActivities.push(newActivity);
                            console.log('[AGENT] ✅ Activity created:', newActivity.title);

                            // Emit WebSocket event for real-time update
                            io.emit('new_activity', newActivity);
                        }
                    }
                }

                // === GENERATE WHATSAPP-SPECIFIC RESPONSE ===
                if (isWhatsAppAudio && createdActivities.length > 0) {
                    console.log('[AGENT] 📱 Generating WhatsApp familiar reminder response...');
                    const activity = createdActivities[0]; // Use first created activity

                    let eventSummary = `${activity.title}`;
                    if (activity.date) {
                        const dateObj = new Date(activity.date);
                        const dateStr = dateObj.toLocaleDateString('es-ES', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        });
                        eventSummary += ` para el ${dateStr}`;
                    }
                    if (activity.time) {
                        eventSummary += ` a las ${activity.time}`;
                    }

                    response_text = `Te ha llegado un recordatorio de un familiar. Se añadió un evento: ${eventSummary}.`;
                    console.log('[AGENT] ✅ WhatsApp familiar response generated');
                }

                // === CREATE MEDICATIONS IN DATABASE ===
                if (extracted.medications && extracted.medications.length > 0) {
                    console.log('[AGENT] 💊 Creating', extracted.medications.length, 'medications...');
                    for (const med of extracted.medications) {
                        if (med.name) {
                            const medResult = await pool.query(
                                `INSERT INTO medications (name, dosage, frequency, active, source, received_at)
                                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                                [
                                    med.name,
                                    med.dosage || 'No especificado',
                                    med.frequency || 'No especificado',
                                    true,
                                    'agent',
                                    new Date()
                                ]
                            );
                            const newMedication = medResult.rows[0];
                            console.log('[AGENT] ✅ Medication created:', newMedication.name);

                            // Emit WebSocket event for real-time update
                            io.emit('new_medication', newMedication);
                        }
                    }
                }

                // === CREATE APPOINTMENTS IN DATABASE ===
                if (extracted.appointments && extracted.appointments.length > 0) {
                    console.log('[AGENT] 🏥 Creating', extracted.appointments.length, 'appointments...');
                    for (const appt of extracted.appointments) {
                        if (appt.doctor && appt.date && appt.time) {
                            const apptResult = await pool.query(
                                `INSERT INTO appointments (doctor, type, date, time, status)
                                 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                                [
                                    appt.doctor,
                                    appt.type || 'appointment',
                                    appt.date,
                                    appt.time,
                                    'scheduled'
                                ]
                            );
                            const newAppointment = apptResult.rows[0];
                            console.log('[AGENT] ✅ Appointment created:', newAppointment.doctor);

                            // Emit WebSocket event for real-time update
                            io.emit('new_appointment', newAppointment);
                        }
                    }
                }
            }
            } // Close else for medication_confirmed
        } else {
            response_text = 'No pude escuchar bien, ¿puedes repetir?';
            console.log('[AGENT] ⚠️  Transcription too short or empty');
        }

        // 4. Generate TTS Response
        let response_audio_url = null;

        if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-placeholder') {
            try {
                console.log('[AGENT] 🔊 Generating TTS response...');
                const speech = await openai.audio.speech.create({
                    model: 'tts-1',
                    voice: 'alloy',
                    input: response_text
                });

                const responseFilename = `response-${Date.now()}.mp3`;
                const responsePath = path.join(uploadsAudioDir, responseFilename);
                const buffer = Buffer.from(await speech.arrayBuffer());
                fs.writeFileSync(responsePath, buffer);
                response_audio_url = `/uploads/audio/${responseFilename}`;

                console.log('[AGENT] ✅ TTS audio generated:', responseFilename);

                // Send audio to external IoT endpoint
                try {
                    console.log('[AGENT] 📤 Sending audio to IoT endpoint...');
                    const formData = new FormData();
                    formData.append('audio', fs.createReadStream(responsePath), {
                        filename: responseFilename,
                        contentType: 'audio/mpeg'
                    });

                    await axios.post('https://iot.vicevalds.dev/api/audio/receive', formData, {
                        headers: {
                            ...formData.getHeaders()
                        },
                        timeout: 10000 // 10 seconds timeout
                    });

                    console.log('[AGENT] ✅ Audio successfully sent to IoT endpoint');
                } catch (iotError) {
                    console.error('[AGENT] ❌ Failed to send audio to IoT endpoint:', iotError.message);
                    if (iotError.response) {
                        console.error('[AGENT] IoT endpoint response:', iotError.response.status, iotError.response.data);
                    }
                    // Don't fail the request if IoT endpoint fails
                }

                // Broadcast to devices/web
                io.emit('agent_response', {
                    text: response_text,
                    audioUrl: response_audio_url,
                    timestamp: new Date().toISOString()
                });
                console.log('[AGENT] 📡 Response broadcasted via WebSocket');
            } catch (err) {
                console.error('[AGENT] ❌ TTS generation failed:', err.message);
            }
        } else {
            console.log('[AGENT] ⚠️  TTS skipped: OpenAI API key not configured');
        }

        const processingTime = Date.now() - startTime;

        // Count created entities
        const totalEntitiesCreated = items_saved_count +
            (extracted.activities?.length || 0) +
            (extracted.medications?.length || 0) +
            (extracted.appointments?.length || 0);

        console.log('[AGENT] ✅ Processing completed in', processingTime, 'ms');
        console.log('[AGENT] 📊 Summary:');
        console.log('  ├─ Interaction type:', interaction_type);
        console.log('  ├─ Medication confirmed:', medication_confirmed ? 'Yes' : 'No');
        console.log('  ├─ Memory items saved:', items_saved_count);
        console.log('  ├─ Activities created:', extracted.activities?.length || 0);
        console.log('  ├─ Medications created:', extracted.medications?.length || 0);
        console.log('  ├─ Appointments created:', extracted.appointments?.length || 0);
        console.log('  ├─ Total entities created:', totalEntitiesCreated);
        console.log('  ├─ Response generated:', response_text ? 'Yes' : 'No');
        console.log('  └─ Audio response:', response_audio_url ? 'Yes' : 'No');
        console.log('═══════════════════════════════════════════════════════════');

        res.json({
            success: true,
            transcription: transcription_text,
            interaction_type,
            medication_confirmed,
            items_saved: items_saved_count,
            response_text,
            response_audio_url,
            audio_url: audioUrl
        });

    } catch (err) {
        console.log('═══════════════════════════════════════════════════════════');
        console.error('[AGENT] ❌ FATAL ERROR during audio processing');
        console.error('  ├─ Error:', err.message);
        console.error('  ├─ Stack:', err.stack);
        console.error('  └─ Timestamp:', new Date().toISOString());
        console.log('═══════════════════════════════════════════════════════════');
        res.status(500).json({ error: 'Processing error', details: err.message });
    }
});

module.exports = router;
