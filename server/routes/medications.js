const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getIO } = require('../socket');
const { logInteraction } = require('../utils/logger');

// Get all medications
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM medications ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching medications:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Create medication
router.post('/', async (req, res) => {
    try {
        const { name, dosage, frequency } = req.body;
        const result = await pool.query(
            `INSERT INTO medications (name, dosage, frequency, active, source)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [name, dosage, frequency, true, 'web']
        );

        const newMedication = result.rows[0];
        console.log('[API] New Medication:', newMedication);

        await logInteraction('medication_created', `Medicamento agregado: ${name}`, newMedication, 'web');

        const io = getIO();
        io.emit('new_medication', newMedication);

        res.status(201).json(newMedication);
    } catch (err) {
        console.error('Error creating medication:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Delete medication
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM medications WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Medication not found' });
        }

        const deletedMedication = result.rows[0];
        console.log('[API] Deleted medication:', deletedMedication);

        await logInteraction('medication_deleted', `Medicamento eliminado: ${deletedMedication.name}`, deletedMedication, 'web');

        const io = getIO();
        io.emit('delete_medication', deletedMedication.id);

        res.json({ success: true, message: 'Medication deleted' });
    } catch (err) {
        console.error('Error deleting medication:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Log medication taken
router.post('/log', async (req, res) => {
    try {
        const { medicationId, timestamp } = req.body;
        const result = await pool.query(
            `INSERT INTO medication_logs (medication_id, timestamp)
             VALUES ($1, $2) RETURNING *`,
            [medicationId, timestamp || new Date()]
        );

        const log = result.rows[0];
        console.log('[API] Medication Log:', log);

        const medResult = await pool.query('SELECT * FROM medications WHERE id = $1', [medicationId]);
        const medication = medResult.rows[0];

        await logInteraction('medication_taken', `Medicamento tomado: ${medication?.name || 'Desconocido'}`, log, 'agent');

        res.status(201).json(log);
    } catch (err) {
        console.error('Error logging medication:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
