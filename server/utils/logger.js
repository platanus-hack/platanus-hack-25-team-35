const pool = require('../db');
const { getIO } = require('../socket');

async function logInteraction(type, description, data, source = 'web') {
    try {
        const result = await pool.query(
            `INSERT INTO interactions (timestamp, type, description, data, source, category)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [
                new Date(),
                type,
                description,
                data ? JSON.stringify(data) : null,
                source,
                type.includes('activity') ? 'activity' :
                    type.includes('medication') ? 'medication' :
                        type.includes('appointment') ? 'appointment' :
                            type.includes('audio') ? 'audio_message' : 'other'
            ]
        );

        const interaction = result.rows[0];

        // Emit to all connected clients
        try {
            const io = getIO();
            io.emit('new_interaction', interaction);
        } catch (e) {
            // Socket might not be initialized yet or error getting it
            console.warn('Could not emit new_interaction:', e.message);
        }

        return interaction;
    } catch (err) {
        console.error('Error logging interaction:', err);
        return null;
    }
}

module.exports = { logInteraction };
