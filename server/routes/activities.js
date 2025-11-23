const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getIO } = require('../socket');
const { logInteraction } = require('../utils/logger');

// Get all activities
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM activities ORDER BY date ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching activities:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Create activity
router.post('/', async (req, res) => {
    try {
        const { date, title, type, time } = req.body;
        const result = await pool.query(
            `INSERT INTO activities (date, title, type, time, source)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [date, title, type, time || null, 'web']
        );

        const newActivity = result.rows[0];
        console.log('[API] New Activity:', newActivity);

        await logInteraction('activity_created', `Actividad agregada: ${title}`, newActivity, 'web');

        const io = getIO();
        io.emit('new_activity', newActivity);

        res.status(201).json(newActivity);
    } catch (err) {
        console.error('Error creating activity:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Delete activity
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM activities WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Activity not found' });
        }

        const deletedActivity = result.rows[0];
        console.log('[API] Deleted activity:', deletedActivity);

        await logInteraction('activity_deleted', `Actividad eliminada: ${deletedActivity.title}`, deletedActivity, 'web');

        const io = getIO();
        io.emit('delete_activity', deletedActivity.id);

        res.json({ success: true, message: 'Activity deleted' });
    } catch (err) {
        console.error('Error deleting activity:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
