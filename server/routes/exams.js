const express = require('express');
const router = express.Router();
const path = require('path');
const pool = require('../db');
const { logInteraction } = require('../utils/logger');
const { uploadPDF } = require('../utils/upload');
const { extractTextFromPDF, analyzeMedicalDocument } = require('../utils/documentHelpers');
const { getIO } = require('../socket');

// Get all exams with analysis
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT e.*, 
                   ad.tipo_documento, ad.resultado, ad.es_normal, ad.medicamentos as analysis_medicamentos
            FROM exams e
            LEFT JOIN agent_documents ad ON e.pdf_path = ad.ruta_archivo
            ORDER BY e.date DESC
        `);

        // Format response to include analysis object if present
        const exams = result.rows.map(row => {
            const { tipo_documento, resultado, es_normal, analysis_medicamentos, ...examData } = row;
            let analysis = null;

            if (tipo_documento) {
                analysis = {
                    tipo_documento,
                    resultado,
                    es_normal,
                    medicamentos: analysis_medicamentos
                };
            }

            return { ...examData, analysis };
        });

        res.json(exams);
    } catch (err) {
        console.error('Error fetching exams:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Delete exam
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM exams WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Exam not found' });
        }

        const deletedExam = result.rows[0];
        const io = getIO();
        io.emit('delete_exam', id);

        res.json({ success: true, message: 'Exam deleted' });
    } catch (err) {
        console.error('Error deleting exam:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Create exam (metadata only)
router.post('/', async (req, res) => {
    try {
        const { name, date, type } = req.body;
        const result = await pool.query(
            `INSERT INTO exams (name, date, type)
             VALUES ($1, $2, $3) RETURNING *`,
            [name, date, type]
        );

        const newExam = result.rows[0];
        console.log('[API] New Exam:', newExam);

        await logInteraction('exam_created', `Examen agregado: ${name}`, newExam, 'web');

        res.status(201).json(newExam);
    } catch (err) {
        console.error('Error creating exam:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Upload PDF for exam
router.post('/upload', uploadPDF.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { name, date, type } = req.body;
        const pdfPath = req.file.path;
        const pdfUrl = `/uploads/exams/${req.file.filename}`;

        const result = await pool.query(
            `INSERT INTO exams (name, date, type, pdf_path, pdf_url)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [
                name || req.file.originalname,
                date || new Date().toISOString().split('T')[0],
                type || 'General',
                pdfPath,
                pdfUrl
            ]
        );

        const newExam = result.rows[0];
        console.log('[API] Exam PDF uploaded:', newExam);

        // Analyze PDF content
        let analysis = null;
        try {
            console.log('[API] Analyzing PDF content...');
            const text = await extractTextFromPDF(pdfPath);
            analysis = await analyzeMedicalDocument(text);
            console.log('[API] Analysis result:', analysis);

            // Save to agent_documents
            await pool.query(
                `INSERT INTO agent_documents 
                (origen, ruta_archivo, tipo_documento, fecha_examen, tipo_examen, resultado, es_normal, fecha_receta, medicamentos)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                    'documento_medico',
                    pdfPath,
                    analysis.tipo_documento || 'ninguno',
                    analysis.fecha_examen || null,
                    analysis.tipo_examen || null,
                    analysis.resultado || analysis.resumen || null,
                    analysis.es_normal,
                    analysis.fecha_receta || null,
                    JSON.stringify(analysis.medicamentos || [])
                ]
            );

            // If it's a prescription, auto-create medications
            if (analysis.tipo_documento === 'receta' && analysis.medicamentos && analysis.medicamentos.length > 0) {
                console.log('[API] Auto-creating medications from prescription...');
                const io = getIO();

                for (const med of analysis.medicamentos) {
                    try {
                        const medResult = await pool.query(
                            `INSERT INTO medications (name, dosage, frequency, active, source, received_at)
                             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                            [
                                med.nombre,
                                med.dosis || 'No especificada',
                                med.frecuencia || 'Según indicación',
                                true,
                                'documento_medico',
                                new Date()
                            ]
                        );
                        const newMed = medResult.rows[0];
                        console.log('[API] Created medication:', newMed.name);

                        // Notify clients
                        if (io) io.emit('new_medication', newMed);

                        // Log interaction
                        await logInteraction('medication_created', `Medicamento desde receta: ${newMed.name}`, newMed, 'web');
                    } catch (medErr) {
                        console.error('[API] Error creating medication from PDF:', medErr);
                    }
                }
            }
        } catch (err) {
            console.error('[API] Error analyzing PDF:', err);
            // Don't fail the upload if analysis fails
        }

        await logInteraction('exam_uploaded', `PDF subido: ${newExam.name}`, { ...newExam, analysis }, 'web');

        res.status(201).json({ ...newExam, analysis });
    } catch (error) {
        console.error('[API] Error uploading PDF:', error);
        res.status(500).json({ error: 'Failed to upload PDF' });
    }
});

// Get PDF for specific exam
router.get('/:id/pdf', async (req, res) => {
    try {
        const examId = parseInt(req.params.id);
        const result = await pool.query('SELECT * FROM exams WHERE id = $1', [examId]);

        if (result.rows.length === 0 || !result.rows[0].pdf_path) {
            return res.status(404).json({ error: 'PDF not found' });
        }

        res.sendFile(path.resolve(result.rows[0].pdf_path));
    } catch (err) {
        console.error('Error fetching PDF:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
