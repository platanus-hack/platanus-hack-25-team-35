const cron = require('node-cron');
const pool = require('../db');
const openai = require('../openai');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const IOT_ENDPOINT = 'https://iot.vicevalds.dev/api/audio/receive';

// Reminder timings in minutes before event
const REMINDER_TIMINGS = {
    ONE_HOUR_BEFORE: { minutes: 60, key: '1_hour_before', tolerance: 2 },
    FIFTEEN_MIN_BEFORE: { minutes: 15, key: '15_min_before', tolerance: 2 },
    AT_TIME: { minutes: 0, key: 'at_time', tolerance: 2 }
};

// Post-event medication reminder interval
const POST_EVENT_INTERVAL_MINUTES = 5;

/**
 * Get user profile data for personalization
 */
async function getUserProfile() {
    try {
        const result = await pool.query('SELECT * FROM user_profile LIMIT 1');
        return result.rows[0] || { nombre: 'Usuario' };
    } catch (err) {
        console.error('[REMINDER] Error fetching user profile:', err.message);
        return { nombre: 'Usuario' };
    }
}

/**
 * Generate personalized reminder message based on event type, data, timing and user profile
 */
function generateReminderMessage(eventType, eventData, timing, userProfile) {
    const nombre = userProfile.nombre || 'Usuario';

    // Timing prefix
    let timePrefix = '';
    switch (timing) {
        case '1_hour_before':
            timePrefix = 'en una hora';
            break;
        case '15_min_before':
            timePrefix = 'en quince minutos';
            break;
        case 'at_time':
            timePrefix = 'ahora';
            break;
        case 'post_event_5min':
            timePrefix = 'ahora';
            break;
    }

    switch (eventType) {
        case 'activity':
            if (timing === 'at_time') {
                return `Hola ${nombre}, es momento de tu actividad: ${eventData.title}. Espero que tengas un buen día.`;
            }
            return `Hola ${nombre}, este es un recordatorio amigable. ${timePrefix} tienes programado: ${eventData.title}${eventData.time ? ` a las ${eventData.time}` : ''}. Espero que tengas un buen día.`;

        case 'appointment':
            if (timing === 'at_time') {
                return `Hola ${nombre}, es el momento de tu cita con ${eventData.doctor}. No olvides llevar tu documentación médica si es necesario.`;
            }
            return `Hola ${nombre}, quería recordarte que ${timePrefix} tienes tu cita con ${eventData.doctor}${eventData.time ? ` a las ${eventData.time}` : ''}. No olvides llevar tu documentación médica si es necesario.`;

        case 'medication':
            if (timing === 'post_event_5min') {
                return `Hola ${nombre}, aún no he recibido confirmación de que tomaste tu medicamento ${eventData.name}${eventData.dosage ? `, ${eventData.dosage}` : ''}. Por favor, tómalo y confírmame diciendo "confirmación" o "listo".`;
            }
            if (timing === 'at_time') {
                return `Hola ${nombre}, es hora de tomar tu medicamento ${eventData.name}${eventData.dosage ? `, ${eventData.dosage}` : ''}. Por favor confírmame cuando lo hayas tomado diciendo "confirmación" o "listo".`;
            }
            return `Hola ${nombre}, ${timePrefix} debes tomar tu medicamento ${eventData.name}${eventData.dosage ? `, ${eventData.dosage}` : ''}. Recuerda mantener tu tratamiento al día.`;

        default:
            return `Hola ${nombre}, tienes un evento programado.`;
    }
}

/**
 * Generate TTS audio using OpenAI with soft voice
 */
async function generateReminderAudio(messageText) {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-placeholder') {
        throw new Error('OpenAI API key not configured');
    }

    try {
        const speech = await openai.audio.speech.create({
            model: 'tts-1',
            voice: 'nova', // Soft female voice
            input: messageText,
            speed: 0.95 // Slightly slower for clarity
        });

        const timestamp = Date.now();
        const filename = `reminder-${timestamp}.mp3`;
        const uploadsDir = path.join(__dirname, '../../uploads/audio');

        // Ensure directory exists
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const filePath = path.join(uploadsDir, filename);
        const buffer = Buffer.from(await speech.arrayBuffer());
        fs.writeFileSync(filePath, buffer);

        console.log('[REMINDER] ✅ Audio generated:', filename);
        return { filePath, filename };
    } catch (err) {
        console.error('[REMINDER] ❌ TTS generation failed:', err.message);
        throw err;
    }
}

/**
 * Send audio file to IoT endpoint
 */
async function sendAudioToIoT(audioFilePath) {
    try {
        const FormData = require('form-data');
        const form = new FormData();

        form.append('audio', fs.createReadStream(audioFilePath), {
            filename: path.basename(audioFilePath),
            contentType: 'audio/mpeg'
        });

        const response = await axios.post(IOT_ENDPOINT, form, {
            headers: {
                ...form.getHeaders()
            },
            timeout: 30000 // 30 seconds timeout
        });

        console.log('[REMINDER] ✅ Audio sent to IoT:', response.status);
        return true;
    } catch (err) {
        console.error('[REMINDER] ❌ Failed to send audio to IoT:', err.message);
        throw err;
    }
}

/**
 * Check if reminder was already sent for this event and timing
 */
async function wasReminderSent(eventType, eventId, eventDatetime, timing) {
    try {
        const result = await pool.query(
            `SELECT id, confirmed FROM sent_reminders
             WHERE event_type = $1 AND event_id = $2 AND event_datetime = $3 AND reminder_timing = $4`,
            [eventType, eventId, eventDatetime, timing]
        );
        return result.rows.length > 0 ? result.rows[0] : null;
    } catch (err) {
        console.error('[REMINDER] Error checking sent reminders:', err.message);
        return null;
    }
}

/**
 * Mark reminder as sent in database
 */
async function markReminderAsSent(eventType, eventId, eventDatetime, timing, audioFilePath, status = 'sent', errorMessage = null) {
    try {
        const requiresConfirmation = (eventType === 'medication');

        await pool.query(
            `INSERT INTO sent_reminders
             (event_type, event_id, event_datetime, reminder_timing, audio_file_path, status, error_message, requires_confirmation, confirmed)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (event_type, event_id, event_datetime, reminder_timing) DO NOTHING`,
            [eventType, eventId, eventDatetime, timing, audioFilePath, status, errorMessage, requiresConfirmation, false]
        );
    } catch (err) {
        console.error('[REMINDER] Error marking reminder as sent:', err.message);
    }
}

/**
 * Parse date and time strings into a Date object
 */
function parseEventDateTime(dateStr, timeStr) {
    try {
        const date = new Date(dateStr);

        // Parse time (formats: "10:00 AM", "10:00", "15:30")
        const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
        if (!timeMatch) return null;

        let hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const period = timeMatch[3];

        // Convert to 24-hour format
        if (period) {
            if (period.toUpperCase() === 'PM' && hours !== 12) hours += 12;
            if (period.toUpperCase() === 'AM' && hours === 12) hours = 0;
        }

        date.setHours(hours, minutes, 0, 0);
        return date;
    } catch (err) {
        console.error('[REMINDER] Error parsing datetime:', err.message);
        return null;
    }
}

/**
 * Find upcoming events for a specific timing window
 */
async function findUpcomingEvents(timingConfig) {
    const now = new Date();
    const targetTime = new Date(now.getTime() + timingConfig.minutes * 60 * 1000);
    const toleranceMs = timingConfig.tolerance * 60 * 1000;

    const events = { activities: [], appointments: [], medications: [] };

    try {
        // Find activities
        const activitiesResult = await pool.query(
            `SELECT id, date, title, type, time
             FROM activities
             WHERE date >= CURRENT_DATE
             AND date <= CURRENT_DATE + INTERVAL '2 days'
             ORDER BY date, time`
        );

        for (const activity of activitiesResult.rows) {
            if (!activity.time) continue;
            const activityDatetime = parseEventDateTime(activity.date, activity.time);
            if (!activityDatetime) continue;

            const timeDiffMs = Math.abs(activityDatetime - targetTime);
            if (timeDiffMs <= toleranceMs) {
                const alreadySent = await wasReminderSent('activity', activity.id, activityDatetime, timingConfig.key);
                if (!alreadySent) {
                    events.activities.push({ ...activity, datetime: activityDatetime });
                }
            }
        }

        // Find appointments
        const appointmentsResult = await pool.query(
            `SELECT id, doctor, type, date, time, status
             FROM appointments
             WHERE date >= CURRENT_DATE
             AND date <= CURRENT_DATE + INTERVAL '2 days'
             AND status = 'scheduled'
             ORDER BY date, time`
        );

        for (const appt of appointmentsResult.rows) {
            const apptDatetime = parseEventDateTime(appt.date, appt.time);
            if (!apptDatetime) continue;

            const timeDiffMs = Math.abs(apptDatetime - targetTime);
            if (timeDiffMs <= toleranceMs) {
                const alreadySent = await wasReminderSent('appointment', appt.id, apptDatetime, timingConfig.key);
                if (!alreadySent) {
                    events.appointments.push({ ...appt, datetime: apptDatetime });
                }
            }
        }

        // Find medications based on frequency
        const medicationsResult = await pool.query(
            `SELECT id, name, dosage, frequency, active
             FROM medications
             WHERE active = true`
        );

        for (const med of medicationsResult.rows) {
            if (!med.frequency) continue;

            // Parse frequency (e.g., "8 hrs", "12 hrs", "24 hrs")
            const freqMatch = med.frequency.match(/(\d+)\s*hr/i);
            if (!freqMatch) continue;

            const frequencyHours = parseInt(freqMatch[1]);

            // Calculate next medication times for today
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Generate medication times based on frequency (starting at 8 AM)
            const startHour = 8;
            const medTimes = [];
            for (let hour = startHour; hour < 24; hour += frequencyHours) {
                const medTime = new Date(today);
                medTime.setHours(hour, 0, 0, 0);
                if (medTime > now) { // Only future times
                    medTimes.push(medTime);
                }
            }

            // Check each medication time
            for (const medDatetime of medTimes) {
                const timeDiffMs = Math.abs(medDatetime - targetTime);
                if (timeDiffMs <= toleranceMs) {
                    const alreadySent = await wasReminderSent('medication', med.id, medDatetime, timingConfig.key);
                    if (!alreadySent) {
                        events.medications.push({ ...med, datetime: medDatetime, time: medDatetime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) });
                    }
                }
            }
        }

        return events;
    } catch (err) {
        console.error('[REMINDER] Error finding upcoming events:', err.message);
        return events;
    }
}

/**
 * Find overdue medications that haven't been confirmed
 */
async function findOverdueMedications() {
    try {
        const now = new Date();

        // Find medications where 'at_time' was sent but not confirmed, and event time has passed
        const result = await pool.query(
            `SELECT DISTINCT sr.event_id, sr.event_datetime, sr.reminder_sent_at, m.name, m.dosage
             FROM sent_reminders sr
             JOIN medications m ON m.id = sr.event_id
             WHERE sr.event_type = 'medication'
             AND sr.reminder_timing = 'at_time'
             AND sr.requires_confirmation = true
             AND sr.confirmed = false
             AND sr.event_datetime < $1
             ORDER BY sr.event_datetime DESC`,
            [now]
        );

        const overdueMeds = [];

        for (const row of result.rows) {
            // Check if we've sent a post-event reminder in the last 5 minutes
            const lastPostEventCheck = await pool.query(
                `SELECT MAX(reminder_sent_at) as last_sent
                 FROM sent_reminders
                 WHERE event_type = 'medication'
                 AND event_id = $1
                 AND event_datetime = $2
                 AND reminder_timing = 'post_event_5min'`,
                [row.event_id, row.event_datetime]
            );

            const lastSent = lastPostEventCheck.rows[0]?.last_sent;
            const shouldSend = !lastSent || (now - new Date(lastSent)) >= (POST_EVENT_INTERVAL_MINUTES * 60 * 1000);

            if (shouldSend) {
                overdueMeds.push({
                    id: row.event_id,
                    name: row.name,
                    dosage: row.dosage,
                    datetime: row.event_datetime
                });
            }
        }

        return overdueMeds;
    } catch (err) {
        console.error('[REMINDER] Error finding overdue medications:', err.message);
        return [];
    }
}

/**
 * Process a single reminder
 */
async function processReminder(eventType, eventData, timing, userProfile) {
    try {
        console.log(`[REMINDER] 📋 Processing ${eventType} (${timing}):`, eventData.title || eventData.name || eventData.doctor);

        // Generate personalized message
        const message = generateReminderMessage(eventType, eventData, timing, userProfile);
        console.log('[REMINDER] 📝 Message:', message);

        // Generate audio
        const { filePath, filename } = await generateReminderAudio(message);

        // Send to IoT endpoint
        await sendAudioToIoT(filePath);

        // Mark as sent
        await markReminderAsSent(eventType, eventData.id, eventData.datetime, timing, filePath, 'sent', null);

        console.log(`[REMINDER] ✅ Reminder sent successfully for ${eventType} #${eventData.id} (${timing})`);
        return true;
    } catch (err) {
        console.error(`[REMINDER] ❌ Failed to process ${eventType} reminder:`, err.message);

        // Mark as failed
        await markReminderAsSent(eventType, eventData.id, eventData.datetime, timing, null, 'failed', err.message);
        return false;
    }
}

/**
 * Main reminder check function
 */
async function checkAndSendReminders() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('[REMINDER] 🔔 Starting reminder check...');
    console.log('[REMINDER] ⏰ Current time:', new Date().toISOString());

    try {
        // Get user profile
        const userProfile = await getUserProfile();

        let successCount = 0;
        let failureCount = 0;

        // Check all timing windows (1 hour, 15 min, at time)
        for (const [key, timingConfig] of Object.entries(REMINDER_TIMINGS)) {
            console.log(`[REMINDER] 🔍 Checking ${key} reminders...`);
            const events = await findUpcomingEvents(timingConfig);

            const totalEvents = events.activities.length + events.appointments.length + events.medications.length;

            if (totalEvents > 0) {
                console.log(`[REMINDER] 📊 Found ${totalEvents} events for ${key}:`);
                console.log(`  ├─ Activities: ${events.activities.length}`);
                console.log(`  ├─ Appointments: ${events.appointments.length}`);
                console.log(`  └─ Medications: ${events.medications.length}`);

                // Process all reminders for this timing
                for (const activity of events.activities) {
                    const success = await processReminder('activity', activity, timingConfig.key, userProfile);
                    if (success) successCount++;
                    else failureCount++;
                }

                for (const appointment of events.appointments) {
                    const success = await processReminder('appointment', appointment, timingConfig.key, userProfile);
                    if (success) successCount++;
                    else failureCount++;
                }

                for (const medication of events.medications) {
                    const success = await processReminder('medication', medication, timingConfig.key, userProfile);
                    if (success) successCount++;
                    else failureCount++;
                }
            }
        }

        // Check overdue medications (post-event reminders every 5 minutes)
        console.log('[REMINDER] 🔍 Checking overdue medications...');
        const overdueMeds = await findOverdueMedications();

        if (overdueMeds.length > 0) {
            console.log(`[REMINDER] ⚠️  Found ${overdueMeds.length} overdue medications without confirmation`);

            for (const med of overdueMeds) {
                const success = await processReminder('medication', med, 'post_event_5min', userProfile);
                if (success) successCount++;
                else failureCount++;
            }
        }

        console.log('[REMINDER] 📊 Summary:');
        console.log(`  ├─ Successful: ${successCount}`);
        console.log(`  └─ Failed: ${failureCount}`);
        console.log('═══════════════════════════════════════════════════════════');
    } catch (err) {
        console.error('[REMINDER] ❌ FATAL ERROR during reminder check:', err.message);
        console.log('═══════════════════════════════════════════════════════════');
    }
}

/**
 * Start the reminder scheduler
 */
function startReminderScheduler() {
    console.log('[REMINDER] 🚀 Starting reminder scheduler...');
    console.log('[REMINDER] ⏰ Will check every 2 minutes');
    console.log('[REMINDER] 📡 IoT Endpoint:', IOT_ENDPOINT);
    console.log('[REMINDER] ⏱️  Reminder timings: 1 hour, 15 min, at time, and post-event every 5 min for medications');

    // Run every 2 minutes for better precision
    cron.schedule('*/2 * * * *', () => {
        checkAndSendReminders();
    });

    console.log('[REMINDER] ✅ Scheduler started successfully');
}

module.exports = {
    startReminderScheduler,
    checkAndSendReminders // Export for manual testing
};
