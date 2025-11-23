# Tata: Task and time assistant 🏥👴👵


A comprehensive elderly care management system built with React and Node.js, featuring real-time communication, voice interactions, and AI-powered assistance.

## 🚀 Features

- **📅 Calendar Dashboard**: Visual calendar with activities, appointments, and medications
- **💬 Walkie-Talkie**: Real-time audio communication between family and elderly
- **🤖 AI-Powered Voice Processing**: Automatic transcription and entity extraction using OpenAI Whisper
- **💊 Medication Management**: Track medications, dosages, and schedules
- **🏥 Medical Appointments**: Schedule and manage doctor appointments with reminders
- **📄 Medical Exams**: Upload and view PDF medical reports
- **📊 Interaction Log**: Complete history of all system interactions
- **🔔 Smart Reminders**: Automatic voice reminders for scheduled activities

## 🏗️ Architecture

### Client (React + Vite)
```
client/src/
  ├── components/
  │   ├── Dashboard.jsx           # Main calendar view
  │   ├── Activities.jsx          # Activities management
  │   ├── Medications.jsx         # Medications tracking
  │   ├── MedicalAppointments.jsx # Appointments management
  │   ├── Exams.jsx              # Medical exams (PDF upload)
  │   ├── Interactions.jsx       # Interaction history
  │   ├── WalkieTalkie.jsx       # Audio communication
  │   └── modals/                # Modal components
  ├── socket.js                  # Socket.io connection
  └── App.jsx                    # Main app container
```

### Server (Node.js + Express)
```
server/
  ├── routes/
  │   ├── activities.js          # Activities API
  │   ├── appointments.js        # Appointments API
  │   ├── medications.js         # Medications API
  │   ├── exams.js              # Exams API
  │   ├── interactions.js       # Interactions API
  │   ├── audio.js              # Audio messages API
  │   └── agent.js              # Agent integration API
  ├── utils/
  │   ├── audioHelpers.js       # Audio processing
  │   ├── logger.js             # Interaction logging
  │   └── upload.js             # Multer configuration
  ├── db.js                     # PostgreSQL connection
  ├── openai.js                 # OpenAI client
  ├── socket.js                 # Socket.io setup
  ├── socketEvents.js           # WebSocket handlers
  └── scheduler.js              # Cron job for reminders
```

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, Lucide Icons, Socket.io Client
- **Backend**: Node.js, Express, Socket.io, PostgreSQL
- **AI**: OpenAI API (Whisper for speech-to-text, GPT-4 for entity extraction, TTS for voice responses)
- **File Storage**: Multer (PDF uploads, audio recordings)
- **Scheduling**: node-cron
- **Containerization**: Docker, Docker Compose

## 📋 Prerequisites

- **Docker Desktop** (recommended): [Download](https://www.docker.com/products/docker-desktop)
- **Node.js 18+** (if running locally without Docker): [Download](https://nodejs.org/)
- **PostgreSQL 15** (if running locally without Docker)
- **OpenAI API Key**: [Get one here](https://platform.openai.com/api-keys)

## 🚀 Quick Start with Docker

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Joacaldog/Team35.git
   cd Team35
   ```

2. **Set environment variables**:
   Create a `.env` file or update `docker-compose.yml` with your OpenAI API key:
   ```
   OPENAI_API_KEY=your-key-here
   ```

3. **Run with Docker Compose**:
   ```bash
   docker-compose up --build
   ```

4. **Access the application**:
   - Web App: `http://localhost:8080`
   - Database: `localhost:5432`

## 💻 Local Development (Without Docker)

### Backend Setup
```bash
# Install dependencies
npm install

# Start PostgreSQL (ensure it's running on localhost:5432)
# Create database 'elderlycare'

# Initialize database with init.sql

# Start server
npm start
```

### Frontend Setup
```bash
cd client
npm install
npm run dev
```

## 🌍 Deployment to DigitalOcean

See [deploy.md](deploy.md) for detailed deployment instructions to DigitalOcean App Platform or Droplet.

## 🔐 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `8080` |
| `NODE_ENV` | Environment | `production` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | `elderlycare` |
| `DB_USER` | Database user | `postgres` |
| `DB_PASSWORD` | Database password | `postgres123` |
| `OPENAI_API_KEY` | OpenAI API key | Required for AI features |

## 📁 Database Schema

The application uses the following main tables:
- `activities`: Calendar events and reminders
- `medications`: Medication tracking
- `appointments`: Medical appointments
- `exams`: Medical exam records (with PDF storage)
- `interactions`: Complete interaction log
- `audio_messages`: Audio message storage
- `agent_memory`: Agent conversation memory

See `init.sql` for complete schema.

## 🎯 Key Features Explained

### Voice-to-Task Automation
When a user sends an audio message:
1. Audio is transcribed using Whisper
2. GPT-4 extracts structured data (activities, medications, appointments)
3. Entities are automatically created in the database
4. Real-time updates via WebSocket

### Smart Reminders
- Cron job checks every minute for due activities
- Generates voice reminders using OpenAI TTS
- Broadcasts to all connected devices via WebSocket

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is part of Team35's elderly care initiative.

## 👥 Team

Team35 - Building technology for better elderly care

---

For questions or support, please open an issue on GitHub.
