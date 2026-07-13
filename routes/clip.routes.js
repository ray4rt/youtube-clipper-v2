const express = require('express');
const router = express.Router();

const { startClip } = require('../controllers/clip.controller');
const { validateClipRequest } = require('../middleware/validator');
const { clipLimiter } = require('../middleware/rateLimiter');

// POST /api/clip
router.post('/', clipLimiter, validateClipRequest, startClip);

module.exports = router;
