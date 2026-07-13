/**
 * middleware/rateLimiter.js
 * Rate limiting per-IP untuk endpoint yang rawan abuse.
 */

const rateLimit = require('express-rate-limit');
const config = require('../config');
const AppError = require('../utils/AppError');

/**
 * Handler seragam saat limit tercapai -> diteruskan ke error handler global.
 */
function limitReachedHandler(req, res, next) {
  next(AppError.tooManyRequests('Terlalu banyak permintaan. Silakan tunggu beberapa saat.'));
}

const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitReachedHandler,
});

// Endpoint /api/clip lebih berat (spawn proses eksternal) -> limit lebih ketat
const clipLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.clipMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitReachedHandler,
});

module.exports = { generalLimiter, clipLimiter };
