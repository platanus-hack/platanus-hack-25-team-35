/**
 * Test script for Phase 2 enhanced memory processing functions
 * 
 * Run with: node test-enhanced-memory.js
 */

require('dotenv').config();
const {
    processMemoryWithChatGPT,
    classifyInteraction,
    answerQueryFromMemory
} = require('./server/utils/audioHelpers');
const { loadUserProfile } = require('./server/utils/profileHelpers');
const pool = require('./server/db');

async function testProfileLoading() {
    console.log('\n========== TEST 1: Profile Loading ==========');
    const profile = await loadUserProfile();
    console.log('Profile loaded:', JSON.stringify(profile, null, 2));
}

async function testMemoryProcessing() {
    console.log('\n========== TEST 2: Memory Processing (Enhanced) ==========');

    const testTexts = [
        "El lunes 24 es el cumpleaños de mi hija Antonia. También necesito comprar limones.",
        "Tengo que llamar a Juanito Pérez porque hace mucho que no sé de él.",
        "El martes tengo hora con el neurólogo a las 15:00."
    ];

    for (const text of testTexts) {
        console.log(`\n--- Processing: "${text}" ---`);
        const items = await processMemoryWithChatGPT(text);
        console.log('Extracted items:', JSON.stringify(items, null, 2));
    }
}

async function testInteractionClassification() {
    console.log('\n========== TEST 3: Interaction Classification ==========');

    const testTexts = [
        "Recuérdame todo lo que tengo para esta semana",
        "Mañana tengo que ir al médico a las 10",
        "¿Qué cosas tenía pendientes con mi hija?"
    ];

    for (const text of testTexts) {
        console.log(`\n--- Classifying: "${text}" ---`);
        const classification = await classifyInteraction(text);
        console.log('Classification:', JSON.stringify(classification, null, 2));
    }
}

async function testMemoryQuery() {
    console.log('\n========== TEST 4: Memory Query ==========');

    // First, insert some test data
    console.log('\n--- Inserting test memories ---');
    const testMemories = [
        {
            texto_original: "El lunes 24 es el cumpleaños de mi hija",
            tipo: "Evento",
            fecha: "lunes 24",
            descripcion: "Cumpleaños de mi hija",
            personas: JSON.stringify(["mi hija"])
        },
        {
            texto_original: "Tengo que comprar limones",
            tipo: "Recuerdo",
            descripcion: "Comprar limones",
            clasificacion: "compra",
            responsable_requerido: "Si"
        }
    ];

    for (const mem of testMemories) {
        await pool.query(
            `INSERT INTO agent_memory 
            (texto_original, tipo, fecha, hora, descripcion, clasificacion, responsable_requerido, personas, lugar)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
                mem.texto_original,
                mem.tipo,
                mem.fecha || null,
                null,
                mem.descripcion,
                mem.clasificacion || null,
                mem.responsable_requerido || null,
                mem.personas || '[]',
                null
            ]
        );
    }
    console.log('Test memories inserted');

    // Now query
    const testQueries = [
        "¿Qué tengo que hacer esta semana?",
        "¿Qué cosas tengo pendientes?",
        "Recuérdame los cumpleaños"
    ];

    for (const query of testQueries) {
        console.log(`\n--- Query: "${query}" ---`);
        const answer = await answerQueryFromMemory(query);
        console.log('Answer:', answer);
    }
}

async function testProfileExtraction() {
    console.log('\n========== TEST 5: Profile Extraction ==========');

    const testTexts = [
        "Me llamo María, tengo 75 años y soy diabética",
        "Me gusta que me hablen de tú",
        "Mi nieta Francisca vive en Santiago"
    ];

    for (const text of testTexts) {
        console.log(`\n--- Extracting from: "${text}" ---`);

        // Call profile extraction endpoint
        const response = await fetch('http://localhost:8080/api/profile/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });

        const result = await response.json();
        console.log('Extraction result:', JSON.stringify(result, null, 2));
    }
}

async function runAllTests() {
    try {
        console.log('🧪 Starting Enhanced Memory Processing Tests...\n');

        await testProfileLoading();
        await testMemoryProcessing();
        await testInteractionClassification();
        await testMemoryQuery();

        console.log('\n\n✅ All tests completed!');
        console.log('\n📝 Note: Profile extraction test requires server to be running.');
        console.log('   Run it separately with: node test-enhanced-memory.js profile\n');

    } catch (err) {
        console.error('\n❌ Test failed:', err);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

// Check if specific test requested
const args = process.argv.slice(2);
if (args.includes('profile')) {
    testProfileExtraction()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('Error:', err);
            process.exit(1);
        });
} else {
    runAllTests();
}
