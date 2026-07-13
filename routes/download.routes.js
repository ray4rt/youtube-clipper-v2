const express = require('express');
const router = express.Router();

const { downloadClip } = require('../controllers/download.controller');
const { validateJobIdParam } = require('../middleware/validator');
const { generalLimiter } = require('../middleware/rateLimiter');

// GET /api/download/:id
router.get('/:id', generalLimiter, validateJobIdParam, downloadClip);

module.exports = router;
