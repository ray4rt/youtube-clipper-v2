const express = require('express');
const router = express.Router();

const { getConnectedAccounts, postClipToSocial } = require('../controllers/social.controller');
const { validateSocialPostRequest } = require('../middleware/validator');
const { generalLimiter } = require('../middleware/rateLimiter');

// GET /api/social/accounts
router.get('/accounts', generalLimiter, getConnectedAccounts);

// POST /api/social/post/:jobId
router.post('/post/:jobId', generalLimiter, validateSocialPostRequest, postClipToSocial);

module.exports = router;
