const pool = require('../db');
const openai = require('../openai');

// Helper function to load user profile
async function loadUserProfile() {
    try {
        const result = await pool.query('SELECT * FROM user_profile LIMIT 1');
        if (result.rows.length === 0) {
            return {
                nombre: null,
                edad: null,
                genero: null,
                condiciones_salud: [],
                medicamentos_cronicos: [],
                preferencias: {},
                familia: []
            };
        }
        return result.rows[0];
    } catch (err) {
        console.error('Error loading profile:', err);
        return {};
    }
}

// Build profile context for prompts
function buildProfileContext(profile) {
    const nombre = profile.nombre || 'la persona usuaria';
    const edad = profile.edad;
    const genero = profile.genero;
    const conds = profile.condiciones_salud || [];
    const meds = profile.medicamentos_cronicos || [];
    const pref = profile.preferencias || {};
    const tratamiento = pref.tratamiento;
    const tono = pref.tono_respuesta;
    const temas_fav = pref.temas_favoritos || [];
    const familia = profile.familia || [];

    const lineas = [];

    let desc = `Nombre: ${nombre}.`;
    if (edad) desc += ` Edad: ${edad} años.`;
    if (genero) desc += ` Género: ${genero}.`;
    lineas.push(desc);

    if (conds.length > 0) {
        lineas.push('Condiciones de salud conocidas: ' + conds.join(', ') + '.');
    }
    if (meds.length > 0) {
        lineas.push('Medicamentos crónicos: ' + meds.join(', ') + '.');
    }

    const pref_parts = [];
    if (tratamiento) pref_parts.push(`Prefiere que le hablen de '${tratamiento}'.`);
    if (tono) pref_parts.push(`Prefiere un tono de respuesta '${tono}'.`);
    if (temas_fav.length > 0) pref_parts.push('Le gusta hablar de: ' + temas_fav.join(', ') + '.');
    if (pref_parts.length > 0) {
        lineas.push('Preferencias de interacción: ' + pref_parts.join(' '));
    }

    if (familia.length > 0) {
        const fam_txt = familia
            .filter(m => m.nombre && m.relacion)
            .map(m => `${m.nombre} (${m.relacion})`)
            .join('; ');
        if (fam_txt) {
            lineas.push('Personas importantes en su familia: ' + fam_txt + '.');
        }
    }

    return lineas.join('\n');
}

// Add profile context to system prompt
function buildSystemWithProfile(baseInstructions) {
    return async () => {
        const profile = await loadUserProfile();
        const contexto = buildProfileContext(profile);

        return baseInstructions.trim() +
            '\n\nCONTEXTO DEL USUARIO (importante):\n' +
            contexto +
            '\n\nTen en cuenta este contexto en todas tus decisiones y en el tono de tus respuestas.';
    };
}

module.exports = {
    loadUserProfile,
    buildProfileContext,
    buildSystemWithProfile
};
