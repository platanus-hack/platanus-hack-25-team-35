const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getIO } = require('../socket');
const { logInteraction } = require('../utils/logger');

// Get all appointments
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM appointments ORDER BY date ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching appointments:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Create appointment
router.post('/', async (req, res) => {
    try {
        const { doctor, type, date, time, reminderDays = [1, 3, 7] } = req.body;

        const reminders = reminderDays.map(days => ({
            daysBefore: days,
            sent: false,
            sentAt: null
        }));

        const result = await pool.query(
            `INSERT INTO appointments (doctor, type, date, time, status, reminders)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [doctor, type || 'Consulta', date, time, 'scheduled', JSON.stringify(reminders)]
        );

        const newAppointment = result.rows[0];
        console.log('[API] New Appointment:', newAppointment);

        await logInteraction('appointment_created', `Cita agendada: ${doctor} el ${date}`, newAppointment, 'web');

        const io = getIO();
        io.emit('new_appointment', newAppointment);

        res.status(201).json(newAppointment);
    } catch (err) {
        console.error('Error creating appointment:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Delete appointment
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM appointments WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        const deletedAppointment = result.rows[0];
        console.log('[API] Deleted appointment:', deletedAppointment);

        await logInteraction('appointment_deleted', `Cita eliminada: ${deletedAppointment.doctor}`, deletedAppointment, 'web');

        const io = getIO();
        io.emit('delete_appointment', deletedAppointment.id);

        res.json({ success: true, message: 'Appointment deleted' });
    } catch (err) {
        console.error('Error deleting appointment:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Send reminder (manual trigger)
router.post('/:id/reminder', async (req, res) => {
    try {
        const appointmentId = parseInt(req.params.id);
        const result = await pool.query('SELECT * FROM appointments WHERE id = $1', [appointmentId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        const appointment = result.rows[0];
        await logInteraction('reminder_sent', `Recordatorio enviado: ${appointment.doctor}`, appointment, 'system');

        res.json({ success: true, message: 'Reminder sent' });
    } catch (err) {
        console.error('Error sending reminder:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
