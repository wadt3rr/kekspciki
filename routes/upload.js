const express = require('express');
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const { uploadImage, uploadVideo } = require('../middleware/upload');

const router = express.Router();

// Upload image
router.post('/image', authenticateToken, (req, res, next) => {
    uploadImage(req, res, (err) => {
        if (err) {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ error: 'Файл слишком большой. Максимальный размер: 10 МБ' });
                }
                return res.status(400).json({ error: err.message });
            }
            return res.status(400).json({ error: err.message });
        }
        
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        // Return the URL path for the uploaded image
        const imageUrl = `/images/${req.file.filename}`;
        res.json({
            success: true,
            url: imageUrl,
            filename: req.file.filename,
            originalname: req.file.originalname,
            size: req.file.size
        });
    });
});

// Upload video
router.post('/video', authenticateToken, (req, res, next) => {
    uploadVideo(req, res, (err) => {
        if (err) {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ error: 'Файл слишком большой. Максимальный размер: 100 МБ' });
                }
                return res.status(400).json({ error: err.message });
            }
            return res.status(400).json({ error: err.message });
        }
        
        if (!req.file) {
            return res.status(400).json({ error: 'No video file provided' });
        }

        // Return the URL path for the uploaded video
        const videoUrl = `/videos/${req.file.filename}`;
        res.json({
            success: true,
            url: videoUrl,
            filename: req.file.filename,
            originalname: req.file.originalname,
            size: req.file.size
        });
    });
});

module.exports = router;

