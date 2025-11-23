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
