const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directories
const uploadsExamsDir = path.join(__dirname, '../../uploads', 'exams');
const uploadsAudioDir = path.join(__dirname, '../../uploads', 'audio');

[uploadsExamsDir, uploadsAudioDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Configure multer for PDF uploads
const pdfStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsExamsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const uploadPDF = multer({
    storage: pdfStorage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'));
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Configure multer for Audio uploads
const uploadAgentAudio = multer({
    dest: uploadsAudioDir,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

module.exports = { uploadPDF, uploadAgentAudio, uploadsAudioDir, uploadsExamsDir };
