const express = require('express');
const router = express.Router();
const pool = require('../db');
const openai = require('../openai');
const { uploadAgentAudio } = require('../utils/upload'); // Reuse existing multer config or create new one
const path = require('path');
const fs = require('fs');

// Configure multer for images if not exists, or reuse. 
// Let's reuse uploadAgentAudio but we need image filter. 
// Better to import multer and config here locally or use a generic upload util.
const multer = require('multer');
const uploadPhoto = multer({
    dest: 'uploads/profile/',
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed'));
        }
    }
});

// Get current user profile
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM user_profile LIMIT 1');

        if (result.rows.length === 0) {
            // Create default profile if doesn't exist
            const defaultProfile = await pool.query(`
                INSERT INTO user_profile (nombre, edad, fecha_nacimiento, genero, condiciones_salud, medicamentos_cronicos, preferencias, familia)
                VALUES (NULL, NULL, NULL, NULL, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, '[]'::jsonb)
                RETURNING *
            `);
            return res.json(defaultProfile.rows[0]);
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error getting profile:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Update user profile manually
router.post('/', async (req, res) => {
    try {
        const { nombre, edad, fecha_nacimiento, genero, condiciones_salud, medicamentos_cronicos, preferencias, familia } = req.body;

        console.log('[API] Updating profile with:', req.body);

        // Prepare data types for SQL
        const edadVal = edad ? parseInt(edad) : null;
        const condicionesVal = JSON.stringify(condiciones_salud || []);
        const medicamentosVal = JSON.stringify(medicamentos_cronicos || []);
        const preferenciasVal = JSON.stringify(preferencias || {});
        const familiaVal = JSON.stringify(familia || []);

        const result = await pool.query(`
            UPDATE user_profile 
            SET nombre = COALESCE($1, nombre),
                edad = COALESCE($2, edad),
                fecha_nacimiento = COALESCE($3, fecha_nacimiento),
                genero = COALESCE($4, genero),
                condiciones_salud = COALESCE($5::jsonb, condiciones_salud),
                medicamentos_cronicos = COALESCE($6::jsonb, medicamentos_cronicos),
                preferencias = COALESCE($7::jsonb, preferencias),
                familia = COALESCE($8::jsonb, familia),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = (SELECT id FROM user_profile LIMIT 1)
            RETURNING *
        `, [nombre, edadVal, fecha_nacimiento, genero, condicionesVal, medicamentosVal, preferenciasVal, familiaVal]);

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating profile:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Upload profile photo
router.post('/upload-photo', uploadPhoto.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const photoUrl = `/uploads/profile/${req.file.filename}`;

        const result = await pool.query(`
            UPDATE user_profile 
            SET foto_perfil = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = (SELECT id FROM user_profile LIMIT 1)
            RETURNING *
        `, [photoUrl]);

        res.json({ success: true, profile: result.rows[0] });
    } catch (err) {
        console.error('Error uploading photo:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Extract profile info from text using AI
router.post('/extract', async (req, res) => {
    try {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        const systemMsg = `
Eres un asistente que extrae INFORMACIÓN DE PERFIL de una persona mayor,
a partir de lo que dice en voz alta.

El perfil tiene esta estructura:

{
  "nombre": string o null,
  "edad": number o null,
  "fecha_nacimiento": string (AAAA-MM-DD) o null,
  "genero": string o null,
  "condiciones_salud": [string, ...],
  "medicamentos_cronicos": [string, ...],
  "preferencias": {
    "tratamiento": string o null,        // "tuteo" o "usted" u otra cosa textual
    "temas_favoritos": [string, ...],
    "tono_respuesta": string o null
  },
  "familia": [
    {"nombre": string, "relacion": string}
  ]
}

Tu tarea:

1. Decidir si el texto contiene información relevante para el perfil.
   Ejemplos de información relevante:
   - nombre, edad, fecha de nacimiento
   - "tengo diabetes", "soy hipertenso", "soy alérgica a..."
   - "tomo metformina todos los días"
   - "me gusta que me hablen de usted"
   - "me gusta hablar de mis nietos"
   - "mi hijo Juan vive en tal parte"

2. Si NO hay información de perfil → responde:
   {"contiene_info_perfil": false, "campos": {}}

3. Si SÍ hay información de perfil → responde:
   {
     "contiene_info_perfil": true,
     "campos": {
        ... SOLO los campos que se pueden inferir del texto ...
     }
   }

Reglas importantes:
- NO inventes datos que no estén en el texto.
- Si mencionan varias condiciones de salud, usa una lista en "condiciones_salud".
- Si hay nuevos medicamentos crónicos, ponlos en "medicamentos_cronicos".
- En "familia", solo agrega personas si se menciona claramente la relación (hijo, hija, nieto, etc.).
- Si no estás seguro de un campo, omítelo.
- Devuelve SIEMPRE un JSON válido y NADA más.
`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0,
            messages: [
                { role: "system", content: systemMsg },
                { role: "user", content: text }
            ]
        });

        const raw = completion.choices[0].message.content;
        const data = JSON.parse(raw);

        if (!data.contiene_info_perfil) {
            return res.json({ updated: false, message: 'No profile info detected' });
        }

        // Update profile with extracted fields
        const campos = data.campos || {};
        const profile = await updateProfileWithFields(campos);

        res.json({ updated: true, profile, extracted: campos });
    } catch (err) {
        console.error('Error extracting profile:', err);
        res.status(500).json({ error: 'Processing error', details: err.message });
    }
});

// Helper function to update profile with extracted fields
async function updateProfileWithFields(campos) {
    // Get current profile
    const currentResult = await pool.query('SELECT * FROM user_profile LIMIT 1');
    const current = currentResult.rows[0];

    // Merge simple fields
    const nombre = campos.nombre || current.nombre;
    const edad = campos.edad || current.edad;
    const fecha_nacimiento = campos.fecha_nacimiento || current.fecha_nacimiento;
    const genero = campos.genero || current.genero;

    // Merge arrays (condiciones_salud, medicamentos_cronicos)
    const condiciones_salud = mergeArrays(current.condiciones_salud, campos.condiciones_salud);
    const medicamentos_cronicos = mergeArrays(current.medicamentos_cronicos, campos.medicamentos_cronicos);

    // Merge preferencias
    const preferencias = mergePreferencias(current.preferencias, campos.preferencias);

    // Merge familia
    const familia = mergeFamilia(current.familia, campos.familia);

    // Update database
    const result = await pool.query(`
        UPDATE user_profile 
        SET nombre = $1,
            edad = $2,
            fecha_nacimiento = $3,
            genero = $4,
            condiciones_salud = $5,
            medicamentos_cronicos = $6,
            preferencias = $7,
            familia = $8,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = (SELECT id FROM user_profile LIMIT 1)
        RETURNING *
    `, [nombre, edad, fecha_nacimiento, genero, condiciones_salud, medicamentos_cronicos, preferencias, familia]);

    return result.rows[0];
}

function mergeArrays(current, newItems) {
    const currentSet = new Set(current || []);
    (newItems || []).forEach(item => currentSet.add(item));
    return Array.from(currentSet);
}

function mergePreferencias(current, newPref) {
    const merged = current || { tratamiento: null, temas_favoritos: [], tono_respuesta: null };

    if (newPref) {
        if (newPref.tratamiento) merged.tratamiento = newPref.tratamiento;
        if (newPref.tono_respuesta) merged.tono_respuesta = newPref.tono_respuesta;
        if (newPref.temas_favoritos) {
            const temas = new Set(merged.temas_favoritos || []);
            newPref.temas_favoritos.forEach(t => temas.add(t));
            merged.temas_favoritos = Array.from(temas);
        }
    }

    return merged;
}

function mergeFamilia(current, newFamilia) {
    const currentList = current || [];
    const existingKeys = new Set(currentList.map(m => `${m.nombre}-${m.relacion}`));

    (newFamilia || []).forEach(miembro => {
        const key = `${miembro.nombre}-${miembro.relacion}`;
        if (!existingKeys.has(key)) {
            currentList.push(miembro);
            existingKeys.add(key);
        }
    });

    return currentList;
}

module.exports = router;
