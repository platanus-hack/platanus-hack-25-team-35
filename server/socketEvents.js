const fs = require('fs');
const pool = require('./db');
const openai = require('./openai');
const { saveAudioMessage, processAudioIntelligence } = require('./utils/audioHelpers');
const { logInteraction } = require('./utils/logger');

function setupSocketEvents(io) {
    io.on('connection', (socket) => {
        console.log('[WebSocket] Client connected:', socket.id);

        // Handle audio messages (walkie-talkie)
        socket.on('audio_message', async (data) => {
            console.log('[WebSocket] Audio message received from:', socket.id);

            try {
                // Save to database and file system
                const audioMessage = await saveAudioMessage(data.audioData, data.from);

                // Log interaction
                await logInteraction(
                    'audio_message_sent',
                    'Mensaje de audio enviado',
                    { audioId: audioMessage.id, duration: data.duration || 0 },
                    data.from === 'web' ? 'web' : 'agent'
                );

                // Broadcast with file URL instead of base64
                socket.broadcast.emit('audio_message', {
                    id: audioMessage.id,
                    from: audioMessage.from_source,
                    fileUrl: audioMessage.file_url,
                    timestamp: audioMessage.timestamp
                });

                // === INTELLIGENT PROCESSING ===
                if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-placeholder') {
                    (async () => {
                        try {
                            console.log(`[WebSocket] Transcribing audio for intelligence...`);
                            const transcription = await openai.audio.transcriptions.create({
                                file: fs.createReadStream(audioMessage.file_path),
                                model: 'whisper-1'
                            });
                            const transcription_text = transcription.text;
                            console.log(`[WebSocket] Audio Transcription:`, transcription_text);

                            await logInteraction('audio_transcribed', `Transcripción: ${transcription_text}`, { audioId: audioMessage.id }, data.from);

                            // Extract entities
                            const extracted = await processAudioIntelligence(transcription_text, data.from);

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
                                                data.from === 'web' ? 'family_web' : 'family_device',
                                                new Date()
                                            ]
                                        );
                                        const newActivity = actResult.rows[0];
                                        console.log('[WebSocket] Auto-created activity:', newActivity);
                                        await logInteraction('activity_created', `Creado desde audio: ${activity.title}`, newActivity, data.from);
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
                                                data.from === 'web' ? 'family_web' : 'family_device',
                                                new Date()
                                            ]
                                        );
                                        const newMedication = medResult.rows[0];
                                        console.log('[WebSocket] Auto-created medication:', newMedication);
                                        await logInteraction('medication_created', `Medicamento desde audio: ${med.name}`, newMedication, data.from);
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
                                        console.log('[WebSocket] Auto-created appointment:', newAppointment);
                                        await logInteraction('appointment_created', `Cita desde audio: ${appt.doctor}`, newAppointment, data.from);
                                        io.emit('new_appointment', newAppointment);
                                    }
                                }
                            }

                        } catch (err) {
                            console.error(`[WebSocket] Error processing audio intelligence:`, err);
                        }
                    })();
                }

            } catch (err) {
                console.error('Error processing audio message:', err);
            }
        });

        // Push-to-talk events
        socket.on('ptt_start', (data) => {
            console.log('[WebSocket] PTT started by:', socket.id);
            socket.broadcast.emit('ptt_active', { from: socket.id, ...data });
        });

        socket.on('ptt_end', (data) => {
            console.log('[WebSocket] PTT ended by:', socket.id);
            socket.broadcast.emit('ptt_inactive', { from: socket.id });
        });

        socket.on('disconnect', () => {
            console.log('[WebSocket] Client disconnected:', socket.id);
        });
    });
}

module.exports = { setupSocketEvents };
