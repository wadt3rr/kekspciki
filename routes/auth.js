const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { dbHelpers } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Register
router.post('/register', [
    body('username').trim().isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('email').optional().isEmail().withMessage('Invalid email format'),
    body('display_name').optional().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, password, email, display_name } = req.body;

        // Check if user exists
        const existingUser = await dbHelpers.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
        if (existingUser) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }

        // Hash password
        const password_hash = await bcrypt.hash(password, 10);

        // Create user
        const result = await dbHelpers.run(
            'INSERT INTO users (username, email, password_hash, display_name) VALUES (?, ?, ?, ?)',
            [username, email || null, password_hash, display_name || username]
        );

        // Generate token
        const token = jwt.sign(
            { id: result.id, username },
            process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: result.id,
                username,
                display_name: display_name || username
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login
router.post('/login', [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, password } = req.body;

        // Find user
        const user = await dbHelpers.get('SELECT * FROM users WHERE username = ?', [username]);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate token
        const token = jwt.sign(
            { id: user.id, username: user.username },
            process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                display_name: user.display_name || user.username,
                is_admin: user.is_admin === 1
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await dbHelpers.get('SELECT id, username, email, display_name, is_admin, created_at FROM users WHERE id = ?', [req.user.id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            ...user,
            is_admin: user.is_admin === 1
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Verify token
router.get('/verify', authenticateToken, (req, res) => {
    res.json({ valid: true, user: req.user });
});

module.exports = router;

