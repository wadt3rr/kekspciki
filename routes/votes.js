const express = require('express');
const { body, validationResult } = require('express-validator');
const { dbHelpers } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Create vote (requires authentication)
router.post('/', authenticateToken, [
    body('nomination_id').isInt().withMessage('Nomination ID must be an integer'),
    body('candidate_id').isInt().withMessage('Candidate ID must be an integer')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        let { nomination_id, candidate_id } = req.body;
        const user_id = req.user.id;
        
        // Ensure nomination_id is an integer
        nomination_id = parseInt(nomination_id);
        if (isNaN(nomination_id)) {
            return res.status(400).json({ error: 'Nomination ID must be a valid integer' });
        }
        
        // Ensure candidate_id is an integer
        candidate_id = parseInt(candidate_id);
        if (isNaN(candidate_id)) {
            return res.status(400).json({ error: 'Candidate ID must be a valid integer' });
        }

        // Check if nomination exists
        const nomination = await dbHelpers.get('SELECT * FROM nominations WHERE id = ? AND is_active = 1', [nomination_id]);
        if (!nomination) {
            return res.status(404).json({ error: 'Nomination not found or inactive' });
        }

        // Check if candidate exists and belongs to this nomination
        const candidate = await dbHelpers.get('SELECT * FROM candidates WHERE id = ? AND nomination_id = ?', [candidate_id, nomination_id]);
        if (!candidate) {
            return res.status(404).json({ error: 'Candidate not found or does not belong to this nomination' });
        }

        // Check if user already voted in this nomination
        const existingVote = await dbHelpers.get(
            'SELECT * FROM votes WHERE user_id = ? AND nomination_id = ?',
            [user_id, nomination_id]
        );

        if (existingVote) {
            // Update existing vote
            await dbHelpers.run(
                'UPDATE votes SET candidate_id = ? WHERE user_id = ? AND nomination_id = ?',
                [candidate_id, user_id, nomination_id]
            );
            return res.json({
                message: 'Vote updated successfully',
                vote: {
                    id: existingVote.id,
                    nomination_id,
                    candidate_id
                }
            });
        }

        // Create new vote
        const result = await dbHelpers.run(
            'INSERT INTO votes (user_id, nomination_id, candidate_id) VALUES (?, ?, ?)',
            [user_id, nomination_id, candidate_id]
        );

        res.status(201).json({
            message: 'Vote submitted successfully',
            vote: {
                id: result.id,
                nomination_id,
                candidate_id
            }
        });
    } catch (error) {
        console.error('Vote creation error:', error);
        if (error.message.includes('UNIQUE constraint')) {
            return res.status(400).json({ error: 'You have already voted in this nomination' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user's votes
router.get('/my', authenticateToken, async (req, res) => {
    try {
        const votes = await dbHelpers.all(
            `SELECT v.*, n.name as nomination_name, n.description as nomination_description,
                    c.name as candidate_name
             FROM votes v 
             JOIN nominations n ON v.nomination_id = n.id 
             JOIN candidates c ON v.candidate_id = c.id
             WHERE v.user_id = ? 
             ORDER BY v.created_at DESC`,
            [req.user.id]
        );
        res.json(votes);
    } catch (error) {
        console.error('Get votes error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get vote results (public, but can be filtered by nomination)
router.get('/results', async (req, res) => {
    try {
        const { nomination_id } = req.query;

        // Check if there are any votes at all
        const voteCount = await dbHelpers.get('SELECT COUNT(*) as count FROM votes');
        
        if (!voteCount || voteCount.count === 0) {
            return res.json([]);
        }

        let query = `
            SELECT 
                v.nomination_id,
                n.name as nomination_name,
                c.id as candidate_id,
                c.name as candidate_name,
                COUNT(*) as vote_count
            FROM votes v
            JOIN nominations n ON v.nomination_id = n.id
            JOIN candidates c ON v.candidate_id = c.id
        `;

        const params = [];

        if (nomination_id) {
            query += ' WHERE v.nomination_id = ?';
            params.push(nomination_id);
        }

        query += ' GROUP BY v.nomination_id, c.id, c.name ORDER BY vote_count DESC, c.name';

        const results = await dbHelpers.all(query, params);
        res.json(results || []);
    } catch (error) {
        console.error('Get results error:', error);
        // Return empty array instead of error if there's a problem
        // This prevents HTML error pages from being returned
        res.json([]);
    }
});

// Get all votes (admin only)
router.get('/all', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        const user = await dbHelpers.get('SELECT is_admin FROM users WHERE id = ?', [req.user.id]);
        if (!user || user.is_admin !== 1) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const votes = await dbHelpers.all(
            `SELECT 
                v.*,
                u.username,
                u.display_name,
                n.name as nomination_name,
                c.name as candidate_name
             FROM votes v
             JOIN users u ON v.user_id = u.id
             JOIN nominations n ON v.nomination_id = n.id
             JOIN candidates c ON v.candidate_id = c.id
             ORDER BY v.created_at DESC`
        );
        res.json(votes);
    } catch (error) {
        console.error('Get all votes error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete vote
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const voteId = req.params.id;

        // Check if vote exists and belongs to user
        const vote = await dbHelpers.get('SELECT * FROM votes WHERE id = ?', [voteId]);
        if (!vote) {
            return res.status(404).json({ error: 'Vote not found' });
        }

        // Check if user owns the vote or is admin
        const user = await dbHelpers.get('SELECT is_admin FROM users WHERE id = ?', [req.user.id]);
        if (vote.user_id !== req.user.id && (!user || user.is_admin !== 1)) {
            return res.status(403).json({ error: 'Not authorized to delete this vote' });
        }

        await dbHelpers.run('DELETE FROM votes WHERE id = ?', [voteId]);
        res.json({ message: 'Vote deleted successfully' });
    } catch (error) {
        console.error('Delete vote error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

