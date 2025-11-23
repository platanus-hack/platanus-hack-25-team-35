const cron = require('node-cron');
const pool = require('./db');
const openai = require('./openai');
const path = require('path');
const fs = require('fs');
const { getIO } = require('./socket');
const { logInteraction } = require('./utils/logger');
const { uploadsAudioDir } = require('./utils/upload');

function startScheduler() {
    // Check for reminders every minute
    cron.schedule('* * * * *', async () => {
        try {
            const now = new Date();
            // Format date as YYYY-MM-DD
            const currentDate = now.toISOString().split('T')[0];
            // Format time as HH:MM (24h)
            const currentTime = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

            console.log(`[SCHEDULER] Checking reminders for ${currentDate} ${currentTime}`);

            // Find activities due now that haven't been reminded
            const result = await pool.query(`
                SELECT * FROM activities 
                WHERE date = $1 
                AND time = $2 
                AND (reminded IS NULL OR reminded = false)
            `, [currentDate, currentTime]);

            if (result.rows.length > 0) {
                console.log(`[SCHEDULER] Found ${result.rows.length} due activities`);

                for (const activity of result.rows) {
                    // Generate Audio Reminder
                    const reminderText = `Recordatorio: Tienes una actividad pendiente. ${activity.title}.`;
                    console.log(`[SCHEDULER] Sending reminder: ${reminderText}`);

                    let audioUrl = null;

                    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-placeholder') {
                        try {
                            const speech = await openai.audio.speech.create({
                                model: 'tts-1',
                                voice: 'alloy',
                                input: reminderText
                            });

                            const filename = `reminder-${activity.id}-${Date.now()}.mp3`;
                            const filePath = path.join(uploadsAudioDir, filename);
                            const buffer = Buffer.from(await speech.arrayBuffer());
                            fs.writeFileSync(filePath, buffer);
                            audioUrl = `/uploads/audio/${filename}`;
                        } catch (err) {
                            console.error('[SCHEDULER] TTS Error:', err);
                        }
                    }

                    // Send to Device via WebSocket
                    try {
                        const io = getIO();
                        io.emit('agent_response', {
                            text: reminderText,
                            audioUrl: audioUrl,
                            timestamp: new Date().toISOString(),
                            type: 'reminder',
                            activityId: activity.id
                        });
                    } catch (e) {
                        console.warn('[SCHEDULER] Could not emit reminder:', e.message);
                    }

                    // Mark as reminded
                    await pool.query('UPDATE activities SET reminded = true WHERE id = $1', [activity.id]);

                    // Log interaction
                    await logInteraction('reminder_sent', `Recordatorio automático: ${activity.title}`, activity, 'system');
                }
            }
        } catch (err) {
            console.error('[SCHEDULER] Error:', err);
        }
    });
}

module.exports = { startScheduler };
