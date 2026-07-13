const express = require('express');
const router = express.Router();

const { streamStatus } = require('../controllers/status.controller');
const { validateJobIdParam } = require('../middleware/validator');

// GET /api/status/:id  (SSE stream)
router.get('/:id', validateJobIdParam, streamStatus);

module.exports = router;
