const fs = require('fs');
const pdf = require('pdf-parse');
const openai = require('../openai');

/**
 * Extract text from a PDF file
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<string>} - Extracted text
 */
async function extractTextFromPDF(filePath) {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdf(dataBuffer);
        return data.text;
    } catch (error) {
        console.error('Error extracting text from PDF:', error);
        throw new Error('Failed to extract text from PDF');
    }
}

/**
 * Analyze medical document text using OpenAI
 * @param {string} text - Extracted text from the document
 * @returns {Promise<Object>} - Structured analysis result
 */
async function analyzeMedicalDocument(text) {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `Eres un asistente médico experto en analizar documentos clínicos.
                    Tu tarea es leer el texto extraído de un PDF y clasificarlo en una de dos categorías:
                    1. "receta": Una receta médica con medicamentos prescritos.
                    2. "examen": Un resultado de examen médico o laboratorio.
                    3. "ninguno": Si no es ninguno de los anteriores.

                    Devuelve un objeto JSON con la siguiente estructura:
                    {
                        "tipo_documento": "receta" | "examen" | "ninguno",
                        "confianza": 0-1,
                        "resumen": "Breve resumen del documento",
                        
                        // Si es examen:
                        "fecha_examen": "YYYY-MM-DD" (o null),
                        "tipo_examen": "Nombre del examen (ej: Hemograma, Resonancia)",
                        "resultado": "Conclusión principal o hallazgos",
                        "es_normal": true/false (basado en los resultados),

                        // Si es receta:
                        "fecha_receta": "YYYY-MM-DD" (o null),
                        "medicamentos": [
                            {
                                "nombre": "Nombre del medicamento",
                                "dosis": "Dosis (ej: 500mg)",
                                "frecuencia": "Frecuencia (ej: cada 8 horas)",
                                "duracion": "Duración (ej: por 7 días)"
                            }
                        ]
                    }
                    
                    Responde SOLO con el JSON válido.`
                },
                {
                    role: "user",
                    content: `Analiza el siguiente texto extraído de un documento PDF:\n\n${text.substring(0, 4000)}`
                }
            ],
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(completion.choices[0].message.content);
        return result;
    } catch (error) {
        console.error('Error analyzing medical document:', error);
        return {
            tipo_documento: 'ninguno',
            resumen: 'Error al analizar el documento',
            medicamentos: []
        };
    }
}

module.exports = {
    extractTextFromPDF,
    analyzeMedicalDocument
};
