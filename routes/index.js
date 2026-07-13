/**
 * routes/index.js
 * Menggabungkan seluruh sub-router menjadi satu entry point API.
 */

const express = require('express');
const router = express.Router();

router.use('/info', require('./info.routes'));
router.use('/clip', require('./clip.routes'));
router.use('/status', require('./status.routes'));
router.use('/download', require('./download.routes'));
router.use('/delete', require('./delete.routes'));
router.use('/social', require('./social.routes'));

module.exports = router;
