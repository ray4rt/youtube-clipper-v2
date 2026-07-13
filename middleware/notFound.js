/**
 * middleware/notFound.js
 * Menangani request ke endpoint yang tidak terdaftar.
 */

const AppError = require('../utils/AppError');

function notFound(req, res, next) {
  next(AppError.notFound(`Endpoint tidak ditemukan: ${req.method} ${req.originalUrl}`));
}

module.exports = notFound;
