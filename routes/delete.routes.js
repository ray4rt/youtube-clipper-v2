const express = require('express');
const router = express.Router();

const { deleteClip } = require('../controllers/delete.controller');
const { validateJobIdParam } = require('../middleware/validator');
const { generalLimiter } = require('../middleware/rateLimiter');

// DELETE /api/delete/:id
router.delete('/:id', generalLimiter, validateJobIdParam, deleteClip);

module.exports = router;
