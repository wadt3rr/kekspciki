const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const voteRoutes = require('./routes/votes');
const nominationRoutes = require('./routes/nominations');
const candidateRoutes = require('./routes/candidates');
const userRoutes = require('./routes/users');
const uploadRoutes = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded videos (direct file links like /videos/clip.mp4)
app.use('/videos', express.static(path.join(__dirname, 'uploads', 'videos')));

// Serve uploaded images (direct file links like /images/photo.jpg)
app.use('/images', express.static(path.join(__dirname, 'uploads', 'images')));

// Explicit 404 for missing video files to avoid HTML fallback
app.use('/videos/*', (req, res, next) => {
    const videoPath = path.join(__dirname, 'uploads', 'videos', req.params[0] || '');
    fs.access(videoPath, fs.constants.R_OK, (err) => {
        if (err) {
            return res.status(404).json({ error: { message: 'Video not found', status: 404 } });
        }
        next();
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/votes', voteRoutes);
app.use('/api/nominations', nominationRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Return JSON 404 for unknown API routes so clients don't get HTML
app.all('/api/*', (req, res) => {
    res.status(404).json({ error: { message: 'API route not found', status: 404 } });
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        error: {
            message: err.message || 'Internal Server Error',
            status: err.status || 500
        }
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    console.log(`📊 API available at http://localhost:${PORT}/api`);
});

