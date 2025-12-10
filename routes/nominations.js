const express = require('express');
const { body, validationResult } = require('express-validator');
const { dbHelpers } = require('../database/db');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Get all nominations
router.get('/', optionalAuth, async (req, res) => {
    try {
        const nominations = await dbHelpers.all(
            'SELECT * FROM nominations WHERE is_active = 1 ORDER BY created_at DESC'
        );
        res.json(nominations);
    } catch (error) {
        console.error('Get nominations error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single nomination
router.get('/:id', async (req, res) => {
    try {
        const nomination = await dbHelpers.get('SELECT * FROM nominations WHERE id = ?', [req.params.id]);
        if (!nomination) {
            return res.status(404).json({ error: 'Nomination not found' });
        }
        res.json(nomination);
    } catch (error) {
        console.error('Get nomination error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create nomination (admin only)
router.post('/', authenticateToken, [
    body('name').trim().notEmpty().withMessage('Nomination name is required'),
    body('description').optional().trim()
], async (req, res) => {
    try {
        // Check if user is admin
        const user = await dbHelpers.get('SELECT is_admin FROM users WHERE id = ?', [req.user.id]);
        if (!user || user.is_admin !== 1) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, description } = req.body;
        const result = await dbHelpers.run(
            'INSERT INTO nominations (name, description) VALUES (?, ?)',
            [name, description || null]
        );

        const nomination = await dbHelpers.get('SELECT * FROM nominations WHERE id = ?', [result.id]);
        res.status(201).json(nomination);
    } catch (error) {
        console.error('Create nomination error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update nomination (admin only)
router.put('/:id', authenticateToken, [
    body('name').optional().trim().notEmpty(),
    body('description').optional().trim(),
    body('is_active').optional().isBoolean()
], async (req, res) => {
    try {
        // Check if user is admin
        const user = await dbHelpers.get('SELECT is_admin FROM users WHERE id = ?', [req.user.id]);
        if (!user || user.is_admin !== 1) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, description, is_active } = req.body;
        const nominationId = req.params.id;

        // Check if nomination exists
        const existing = await dbHelpers.get('SELECT * FROM nominations WHERE id = ?', [nominationId]);
        if (!existing) {
            return res.status(404).json({ error: 'Nomination not found' });
        }

        // Build update query
        const updates = [];
        const params = [];

        if (name !== undefined) {
            updates.push('name = ?');
            params.push(name);
        }
        if (description !== undefined) {
            updates.push('description = ?');
            params.push(description);
        }
        if (is_active !== undefined) {
            updates.push('is_active = ?');
            params.push(is_active ? 1 : 0);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        params.push(nominationId);
        await dbHelpers.run(
            `UPDATE nominations SET ${updates.join(', ')} WHERE id = ?`,
            params
        );

        const nomination = await dbHelpers.get('SELECT * FROM nominations WHERE id = ?', [nominationId]);
        res.json(nomination);
    } catch (error) {
        console.error('Update nomination error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete nomination (admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        const user = await dbHelpers.get('SELECT is_admin FROM users WHERE id = ?', [req.user.id]);
        if (!user || user.is_admin !== 1) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const nominationId = req.params.id;

        // Check if nomination exists
        const nomination = await dbHelpers.get('SELECT * FROM nominations WHERE id = ?', [nominationId]);
        if (!nomination) {
            return res.status(404).json({ error: 'Nomination not found' });
        }

        // Soft delete (set is_active to 0)
        await dbHelpers.run('UPDATE nominations SET is_active = 0 WHERE id = ?', [nominationId]);
        res.json({ message: 'Nomination deleted successfully' });
    } catch (error) {
        console.error('Delete nomination error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

