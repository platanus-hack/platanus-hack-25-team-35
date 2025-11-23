const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getIO } = require('../socket');
const { logInteraction } = require('../utils/logger');
const { uploadAgentAudio, uploadsAudioDir } = require('../utils/upload');
const { processAudioIntelligence } = require('../utils/audioHelpers');
const openai = require('../openai');
const fs = require('fs');
const path = require('path');

// Get audio messages
router.get('/messages', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM audio_messages ORDER BY timestamp DESC LIMIT 50'
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching audio messages:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Upload audio message (Walkie-Talkie)
router.post('/message', uploadAgentAudio.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file uploaded' });
        }

        console.log('[API] Received audio message upload:', req.file.originalname);

        const fromSource = req.body.from || 'device';

        // 1. Save audio permanently
        const ext = path.extname(req.file.originalname) || '.webm';
        const audioFilename = `message-${Date.now()}${ext}`;
        const audioPath = path.join(uploadsAudioDir, audioFilename);

        fs.renameSync(req.file.path, audioPath);
        const audioUrl = `/uploads/audio/${audioFilename}`;

        // 2. Save to database
        const result = await pool.query(
            `INSERT INTO audio_messages (from_source, file_path, file_url, timestamp)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [fromSource, audioPath, audioUrl, new Date()]
        );

        const audioMessage = result.rows[0];

        // 3. Log interaction
        await logInteraction(
            'audio_message_sent',
            'Mensaje de audio recibido del dispositivo',
            { audioId: audioMessage.id, url: audioUrl },
            fromSource
        );

        // 4. Broadcast to web clients
        const io = getIO();
        io.emit('audio_message', {
            id: audioMessage.id,
            from: fromSource,
            fileUrl: audioUrl,
            timestamp: audioMessage.timestamp
        });

        // 5. COMPREHENSIVE INTELLIGENT PROCESSING
        console.log('[API] Checking OpenAI Key availability:', process.env.OPENAI_API_KEY ? 'Present' : 'Missing');

        if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-placeholder') {
            console.log('[API] Starting async intelligence processing...');
            // Run asynchronously
            (async () => {
                try {
                    console.log(`[API] Transcribing ${fromSource} audio for comprehensive intelligence...`);
                    const transcription = await openai.audio.transcriptions.create({
                        file: fs.createReadStream(audioPath),
                        model: 'whisper-1'
                    });
                    const transcription_text = transcription.text;
                    console.log(`[API] ${fromSource} Audio Transcription:`, transcription_text);

                    await logInteraction('audio_transcribed', `Transcripción: ${transcription_text}`, { audioId: audioMessage.id }, fromSource);

                    // Extract ALL entities
                    const extracted = await processAudioIntelligence(transcription_text, fromSource);

                    // === CREATE ACTIVITIES ===
                    if (extracted.activities && extracted.activities.length > 0) {
                        for (const activity of extracted.activities) {
                            if (activity.date && activity.title) {
                                const actResult = await pool.query(
                                    `INSERT INTO activities (date, title, type, time, source, received_at)
                                     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                                    [
                                        activity.date,
                                        activity.title,
                                        activity.type || 'activity',
                                        activity.time || null,
                                        fromSource === 'web' ? 'family_web' : 'family_device',
                                        new Date()
                                    ]
                                );
                                const newActivity = actResult.rows[0];
                                console.log('[API] Auto-created activity from audio:', newActivity);

                                await logInteraction('activity_created', `Creado desde audio: ${activity.title}`, newActivity, fromSource);
                                io.emit('new_activity', newActivity);
                            }
                        }
                    }

                    // === CREATE MEDICATIONS ===
                    if (extracted.medications && extracted.medications.length > 0) {
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
                                        fromSource === 'web' ? 'family_web' : 'family_device',
                                        new Date()
                                    ]
                                );
                                const newMedication = medResult.rows[0];
                                console.log('[API] Auto-created medication from audio:', newMedication);

                                await logInteraction('medication_created', `Medicamento desde audio: ${med.name} - ${med.dosage} - ${med.frequency}`, newMedication, fromSource);
                                io.emit('new_medication', newMedication);
                            }
                        }
                    }

                    // === CREATE APPOINTMENTS ===
                    if (extracted.appointments && extracted.appointments.length > 0) {
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
                                console.log('[API] Auto-created appointment from audio:', newAppointment);

                                await logInteraction('appointment_created', `Cita desde audio: ${appt.doctor} - ${appt.date} ${appt.time}`, newAppointment, fromSource);
                                io.emit('new_appointment', newAppointment);
                            }
                        }
                    }

                } catch (err) {
                    console.error(`[API] Error processing ${fromSource} audio intelligence:`, err);
                }
            })();
        } else {
            console.log('[API] Skipping intelligence processing: No valid OpenAI Key found');
        }

        res.status(201).json(audioMessage);

    } catch (err) {
        console.error('Error processing audio message upload:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Endpoint dedicado para recibir audio de la App Externa (Test)
router.post('/external', uploadAgentAudio.single('file'), async (req, res) => {
    try {
        console.log('--- [EXTERNAL APP INTEGRATION] ---');

        if (!req.file) {
            console.log('Error: No audio file provided');
            return res.status(400).json({ error: 'No audio file uploaded' });
        }

        console.log('Audio recibido exitosamente');
        console.log('Nombre original:', req.file.originalname);
        console.log('Guardado en:', req.file.path);
        console.log('Tamaño:', req.file.size, 'bytes');

        res.json({
            success: true,
            message: 'Audio recibido en el servidor correctamente',
            fileId: req.file.filename
        });
    } catch (error) {
        console.error('Error en endpoint externo:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
