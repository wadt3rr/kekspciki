const express = require('express');
const { dbHelpers } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all users (admin only)
router.get('/', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        const user = await dbHelpers.get('SELECT is_admin FROM users WHERE id = ?', [req.user.id]);
        if (!user || user.is_admin !== 1) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const users = await dbHelpers.all(
            'SELECT id, username, email, display_name, is_admin, created_at FROM users ORDER BY created_at DESC'
        );
        res.json(users.map(u => ({ ...u, is_admin: u.is_admin === 1 })));
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user by ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.params.id;

        // Users can only see their own profile unless they're admin
        if (parseInt(userId) !== req.user.id) {
            const user = await dbHelpers.get('SELECT is_admin FROM users WHERE id = ?', [req.user.id]);
            if (!user || user.is_admin !== 1) {
                return res.status(403).json({ error: 'Not authorized' });
            }
        }

        const user = await dbHelpers.get(
            'SELECT id, username, email, display_name, is_admin, created_at FROM users WHERE id = ?',
            [userId]
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ ...user, is_admin: user.is_admin === 1 });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

