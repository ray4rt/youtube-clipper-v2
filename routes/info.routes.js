const express = require('express');
const router = express.Router();

const { getVideoInfo } = require('../controllers/info.controller');
const { validateInfoRequest } = require('../middleware/validator');
const { generalLimiter } = require('../middleware/rateLimiter');

// POST /api/info
router.post('/', generalLimiter, validateInfoRequest, getVideoInfo);

module.exports = router;
