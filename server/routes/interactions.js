const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getIO } = require('../socket');
const { logInteraction } = require('../utils/logger');

// Get recent interactions
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM interactions ORDER BY timestamp DESC LIMIT 100');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching interactions:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Delete interaction
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM interactions WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Interaction not found' });
        }

        const deletedInteraction = result.rows[0];
        console.log('[API] Deleted interaction:', deletedInteraction);

        const io = getIO();
        io.emit('delete_interaction', deletedInteraction.id);

        res.json({ success: true, message: 'Interaction deleted' });
    } catch (err) {
        console.error('Error deleting interaction:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get daily interactions
router.get('/daily/:date', async (req, res) => {
    try {
        const targetDate = req.params.date;
        const result = await pool.query(
            `SELECT * FROM interactions 
             WHERE DATE(timestamp) = $1 
             ORDER BY timestamp DESC`,
            [targetDate]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching daily interactions:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get daily report
router.get('/report/:date', async (req, res) => {
    try {
        const targetDate = req.params.date;
        const result = await pool.query(
            `SELECT * FROM interactions 
             WHERE DATE(timestamp) = $1 
             ORDER BY timestamp DESC`,
            [targetDate]
        );

        const dayInteractions = result.rows;

        // Generate summary
        const summary = {
            date: targetDate,
            totalInteractions: dayInteractions.length,
            byCategory: {
                activity: dayInteractions.filter(i => i.category === 'activity').length,
                medication: dayInteractions.filter(i => i.category === 'medication').length,
                appointment: dayInteractions.filter(i => i.category === 'appointment').length,
                audio_message: dayInteractions.filter(i => i.category === 'audio_message').length
            },
            bySource: {
                web: dayInteractions.filter(i => i.source === 'web').length,
                agent: dayInteractions.filter(i => i.source === 'agent').length,
                system: dayInteractions.filter(i => i.source === 'system').length
            },
            interactions: dayInteractions
        };

        res.json(summary);
    } catch (err) {
        console.error('Error generating report:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
