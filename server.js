const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const http = require('http');
const pool = require('./server/db');
const { initSocket } = require('./server/socket');
const { startScheduler } = require('./server/scheduler');
const { startReminderScheduler } = require('./server/services/reminderScheduler');
const { setupSocketEvents } = require('./server/socketEvents');

// Routes
const activitiesRouter = require('./server/routes/activities');
const examsRouter = require('./server/routes/exams');
const medicationsRouter = require('./server/routes/medications');
const appointmentsRouter = require('./server/routes/appointments');
const interactionsRouter = require('./server/routes/interactions');
const agentRouter = require('./server/routes/agent');
const audioRouter = require('./server/routes/audio');
const profileRouter = require('./server/routes/profile');

const app = express();
const server = http.createServer(app);
const io = initSocket(server);

const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount Routes
app.use('/api/activities', activitiesRouter);
app.use('/api/exams', examsRouter);
app.use('/api/medications', medicationsRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/interactions', interactionsRouter);
app.use('/api/agent', agentRouter);
app.use('/api/audio', audioRouter);
app.use('/api/profile', profileRouter);

// Setup Socket Events
setupSocketEvents(io);

// Start Schedulers
startScheduler(); // Existing scheduler (reminders at exact time)
startReminderScheduler(); // New scheduler (reminders 3 hours before, sent to IoT)

// Start Server
server.listen(PORT, () => {
    console.log(`ElderlyCare Server running on port ${PORT}`);
    console.log(`WebSocket server ready`);

    // Ensure 'reminded' column exists
    pool.query(`
        ALTER TABLE activities 
        ADD COLUMN IF NOT EXISTS reminded BOOLEAN DEFAULT false;

        ALTER TABLE user_profile
        ADD COLUMN IF NOT EXISTS foto_perfil TEXT;
    `).catch(err => console.error('Error updating schema:', err));
});
