const express = require('express');
const { body, validationResult } = require('express-validator');
const { dbHelpers } = require('../database/db');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Get all candidates for a nomination
router.get('/', optionalAuth, async (req, res) => {
    try {
        const { nomination_id } = req.query;

        if (!nomination_id) {
            return res.status(400).json({ error: 'nomination_id is required' });
        }

        const candidates = await dbHelpers.all(
            'SELECT * FROM candidates WHERE nomination_id = ? ORDER BY name ASC',
            [nomination_id]
        );
        
        // Always return an array, even if empty
        res.json(candidates || []);
    } catch (error) {
        console.error('Get candidates error:', error);
        // Return empty array instead of error to prevent frontend issues
        res.json([]);
    }
});

// Get single candidate
router.get('/:id', async (req, res) => {
    try {
        const candidate = await dbHelpers.get('SELECT * FROM candidates WHERE id = ?', [req.params.id]);
        if (!candidate) {
            return res.status(404).json({ error: 'Candidate not found' });
        }
        res.json(candidate);
    } catch (error) {
        console.error('Get candidate error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create candidate (admin only, or regular users for specific nominations with file uploads)
router.post('/', authenticateToken, [
    body('nomination_id').isInt().withMessage('Nomination ID must be an integer'),
    body('name').trim().notEmpty().withMessage('Candidate name is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { nomination_id, name, video_url, image_url } = req.body;
        const trimmedName = String(name).trim();
        const trimmedVideoUrl = video_url ? String(video_url).trim() : null;
        const trimmedImageUrl = image_url ? String(image_url).trim() : null;

        // Check if nomination exists
        const nomination = await dbHelpers.get('SELECT * FROM nominations WHERE id = ?', [nomination_id]);
        if (!nomination) {
            return res.status(404).json({ error: 'Nomination not found' });
        }

        // Check if user is admin
        const user = await dbHelpers.get('SELECT is_admin FROM users WHERE id = ?', [req.user.id]);
        const isAdmin = user && user.is_admin === 1;
        
        // Allow regular users to create candidates only for specific nominations with file uploads
        if (!isAdmin) {
            const nominationNameLower = nomination.name.toLowerCase();
            const allowsUserUpload = (nominationNameLower.includes('завоз') && nominationNameLower.includes('год') && trimmedImageUrl) ||
                                    ((nominationNameLower.includes('клип') || nominationNameLower.includes('рейдж')) && nominationNameLower.includes('год') && trimmedVideoUrl);
            
            if (!allowsUserUpload) {
                return res.status(403).json({ error: 'Admin access required for this nomination' });
            }
            
            // Regular users can only create candidates with uploaded files (not external URLs)
            if (trimmedVideoUrl && !trimmedVideoUrl.startsWith('/videos/')) {
                return res.status(403).json({ error: 'Only uploaded videos are allowed for regular users' });
            }
            if (trimmedImageUrl && !trimmedImageUrl.startsWith('/images/')) {
                return res.status(403).json({ error: 'Only uploaded images are allowed for regular users' });
            }
        }

        // Check if candidate already exists for this nomination
        const existing = await dbHelpers.get(
            'SELECT * FROM candidates WHERE nomination_id = ? AND name = ?',
            [nomination_id, trimmedName]
        );
        if (existing) {
            return res.status(400).json({ error: 'Candidate with this name already exists for this nomination' });
        }

        const result = await dbHelpers.run(
            'INSERT INTO candidates (nomination_id, name, video_url, image_url) VALUES (?, ?, ?, ?)',
            [nomination_id, trimmedName, trimmedVideoUrl, trimmedImageUrl]
        );

        const candidate = await dbHelpers.get('SELECT * FROM candidates WHERE id = ?', [result.id]);
        res.status(201).json(candidate);
    } catch (error) {
        console.error('Create candidate error:', error);
        if (error.message && error.message.includes('UNIQUE constraint')) {
            return res.status(400).json({ error: 'Candidate with this name already exists for this nomination' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update candidate (admin only)
router.put('/:id', authenticateToken, [
    body('name').optional().trim().notEmpty(),
    body('video_url').optional().trim(),
    body('image_url').optional().trim()
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

        const { name, video_url, image_url } = req.body;
        const candidateId = req.params.id;

        // Check if candidate exists
        const existing = await dbHelpers.get('SELECT * FROM candidates WHERE id = ?', [candidateId]);
        if (!existing) {
            return res.status(404).json({ error: 'Candidate not found' });
        }

        // Build update query
        const updates = [];
        const params = [];

        if (name !== undefined) {
            updates.push('name = ?');
            params.push(String(name).trim());
        }
        if (video_url !== undefined) {
            updates.push('video_url = ?');
            params.push(video_url ? String(video_url).trim() : null);
        }
        if (image_url !== undefined) {
            updates.push('image_url = ?');
            params.push(image_url ? String(image_url).trim() : null);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        params.push(candidateId);
        await dbHelpers.run(
            `UPDATE candidates SET ${updates.join(', ')} WHERE id = ?`,
            params
        );

        const candidate = await dbHelpers.get('SELECT * FROM candidates WHERE id = ?', [candidateId]);
        res.json(candidate);
    } catch (error) {
        console.error('Update candidate error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete candidate (admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        const user = await dbHelpers.get('SELECT is_admin FROM users WHERE id = ?', [req.user.id]);
        if (!user || user.is_admin !== 1) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const candidateId = req.params.id;

        // Check if candidate exists
        const candidate = await dbHelpers.get('SELECT * FROM candidates WHERE id = ?', [candidateId]);
        if (!candidate) {
            return res.status(404).json({ error: 'Candidate not found' });
        }

        // Check if there are votes for this candidate
        const votes = await dbHelpers.get('SELECT COUNT(*) as count FROM votes WHERE candidate_id = ?', [candidateId]);
        if (votes && votes.count > 0) {
            return res.status(400).json({ error: 'Cannot delete candidate with existing votes' });
        }

        await dbHelpers.run('DELETE FROM candidates WHERE id = ?', [candidateId]);
        res.json({ message: 'Candidate deleted successfully' });
    } catch (error) {
        console.error('Delete candidate error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

