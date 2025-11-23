CREATE TABLE IF NOT EXISTS activities (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    time VARCHAR(20),
    source VARCHAR(50) DEFAULT 'web',
    agent_id VARCHAR(100),
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    type VARCHAR(100),
    pdf_path TEXT,
    pdf_url TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS medications (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100),
    frequency VARCHAR(100),
    active BOOLEAN DEFAULT true,
    end_date DATE,
    source VARCHAR(50) DEFAULT 'web',
    agent_id VARCHAR(100),
    received_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS medication_logs (
    id SERIAL PRIMARY KEY,
    medication_id INTEGER REFERENCES medications(id) ON DELETE CASCADE,
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    doctor VARCHAR(255) NOT NULL,
    type VARCHAR(100) DEFAULT 'Consulta',
    date DATE NOT NULL,
    time VARCHAR(20) NOT NULL,
    status VARCHAR(50) DEFAULT 'scheduled',
    reminders JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS interactions (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL,
    type VARCHAR(100) NOT NULL,
    description TEXT,
    data JSONB,
    source VARCHAR(50) DEFAULT 'web',
    category VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agent Memory Table (voice agent interactions)
CREATE TABLE IF NOT EXISTS agent_memory (
    id SERIAL PRIMARY KEY,
    timestamp_guardado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    texto_original TEXT NOT NULL,
    
    -- Item fields
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('Evento', 'Recuerdo', 'Ninguno')),
    fecha VARCHAR(100),
    hora VARCHAR(20),
    descripcion TEXT,
    clasificacion VARCHAR(50) CHECK (clasificacion IN ('tarea', 'compra', 'pensamiento', 'otro', 'familiar')),
    responsable_requerido VARCHAR(10) CHECK (responsable_requerido IN ('Si', 'No')),
    personas JSONB DEFAULT '[]'::jsonb,
    lugar VARCHAR(255),
    
    -- New fields for enhanced features
    origen VARCHAR(50) DEFAULT 'audio',
    ruta_archivo TEXT,
    
    -- Metadata
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    audio_file_path TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Profile Table (single global profile)
CREATE TABLE IF NOT EXISTS user_profile (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255),
    edad INTEGER,
    fecha_nacimiento DATE,
    genero VARCHAR(50),
    condiciones_salud JSONB DEFAULT '[]'::jsonb,
    medicamentos_cronicos JSONB DEFAULT '[]'::jsonb,
    preferencias JSONB DEFAULT '{}'::jsonb,
    familia JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default empty profile
INSERT INTO user_profile (nombre, edad, fecha_nacimiento, genero, condiciones_salud, medicamentos_cronicos, preferencias, familia)
VALUES (NULL, NULL, NULL, NULL, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, '[]'::jsonb)
ON CONFLICT DO NOTHING;

-- Agent Documents (from PDFs - exams and prescriptions)
CREATE TABLE IF NOT EXISTS agent_documents (
    id SERIAL PRIMARY KEY,
    timestamp_guardado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    origen VARCHAR(50) DEFAULT 'documento_medico',
    ruta_archivo TEXT,
    tipo_documento VARCHAR(50) CHECK (tipo_documento IN ('receta', 'examen', 'ninguno')),
    
    -- Exam fields (if tipo = 'examen')
    fecha_examen DATE,
    tipo_examen VARCHAR(255),
    resultado TEXT,
    es_normal BOOLEAN,
    
    -- Prescription fields (if tipo = 'receta')
    fecha_receta DATE,
    medicamentos JSONB,  -- Array of medications with doses
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audio_messages (
    id SERIAL PRIMARY KEY,
    from_source VARCHAR(50) NOT NULL,
    file_path TEXT NOT NULL,
    file_url TEXT NOT NULL,
    duration INTEGER DEFAULT 0,
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better query performance
CREATE INDEX idx_activities_date ON activities(date);
CREATE INDEX idx_exams_date ON exams(date);
CREATE INDEX idx_appointments_date ON appointments(date);
CREATE INDEX idx_interactions_timestamp ON interactions(timestamp);
CREATE INDEX idx_agent_memory_tipo ON agent_memory(tipo);
CREATE INDEX idx_agent_memory_fecha ON agent_memory(fecha);
CREATE INDEX idx_agent_memory_timestamp ON agent_memory(timestamp_guardado);
CREATE INDEX idx_agent_documents_tipo ON agent_documents(tipo_documento);
CREATE INDEX idx_audio_messages_timestamp ON audio_messages(timestamp);

-- Table to track sent reminders to avoid duplicates
CREATE TABLE IF NOT EXISTS sent_reminders (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('activity', 'medication', 'appointment')),
    event_id INTEGER NOT NULL,
    event_datetime TIMESTAMP NOT NULL,
    reminder_timing VARCHAR(50) NOT NULL CHECK (reminder_timing IN ('1_hour_before', '15_min_before', 'at_time', 'post_event_5min')),
    reminder_sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    audio_file_path TEXT,
    status VARCHAR(50) DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
    error_message TEXT,
    -- Medication confirmation fields
    requires_confirmation BOOLEAN DEFAULT false,
    confirmed BOOLEAN DEFAULT false,
    confirmed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_type, event_id, event_datetime, reminder_timing)
);

CREATE INDEX idx_sent_reminders_event ON sent_reminders(event_type, event_id);
CREATE INDEX idx_sent_reminders_datetime ON sent_reminders(event_datetime);
CREATE INDEX idx_sent_reminders_confirmation ON sent_reminders(event_type, confirmed) WHERE requires_confirmation = true;

-- Sample data
INSERT INTO activities (date, title, type, time) VALUES
    ('2025-02-12', 'Consulta Cardiólogo', 'medical', '10:00 AM'),
    ('2025-02-15', 'Kinesiólogo', 'medical', '15:30 PM'),
    ('2025-02-20', 'Caminata Parque', 'activity', '09:00 AM');

INSERT INTO exams (name, date, type) VALUES
    ('Glucemia', '2025-02-12', 'Sangre'),
    ('Orina Completa', '2025-02-12', 'Orina'),
    ('Resonancia Magnética', '2025-01-10', 'Imagen');

INSERT INTO medications (name, dosage, frequency, active, end_date) VALUES
    ('Losartán', '50mg', '12 hrs', true, NULL),
    ('Paracetamol', '500mg', '8 hrs', false, '2025-02-10');

INSERT INTO appointments (doctor, type, date, time, status, reminders) VALUES
    ('Cardiólogo', 'Consulta', '2025-02-12', '10:00 AM', 'scheduled', 
     '[{"daysBefore": 1, "sent": false, "sentAt": null}]'::jsonb);
