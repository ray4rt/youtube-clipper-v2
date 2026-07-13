/**
 * middleware/errorHandler.js
 * Global error handler Express. Ini adalah baris pertahanan terakhir
 * agar aplikasi TIDAK PERNAH crash akibat error tak tertangani.
 */

const logger = require('../utils/logger');
const AppError = require('../utils/AppError');
const { ERROR_CODES } = require('../config/constants');
const config = require('../config');

/**
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const isAppError = err instanceof AppError;

  const statusCode = isAppError ? err.statusCode : 500;
  const errorCode = isAppError ? err.errorCode : ERROR_CODES.INTERNAL_ERROR;
  const message = err.message || 'Terjadi kesalahan yang tidak terduga.';

  logger.error(message, {
    errorCode,
    statusCode,
    path: req.originalUrl,
    method: req.method,
    stack: config.server.isProduction ? undefined : err.stack,
  });

  // Jika response berupa SSE stream yang sudah mulai, kirim event error lalu tutup
  if (res.headersSent) {
    try {
      res.write(`event: error\ndata: ${JSON.stringify({ message, errorCode })}\n\n`);
      res.end();
    } catch (_) {
      // stream sudah tertutup, abaikan
    }
    return;
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message,
      ...(config.server.isProduction ? {} : { stack: err.stack }),
    },
  });
}

module.exports = errorHandler;
