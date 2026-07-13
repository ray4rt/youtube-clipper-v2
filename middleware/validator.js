/**
 * middleware/validator.js
 * Validasi & sanitasi input request secara deklaratif menggunakan express-validator.
 */

const { body, param, validationResult } = require('express-validator');
const AppError = require('../utils/AppError');
const { ERROR_CODES, RESOLUTIONS } = require('../config/constants');
const { isValidYoutubeUrl } = require('../utils/urlValidator');
const { isValidTimeFormat } = require('../utils/timeParser');

/**
 * Middleware untuk mengecek hasil validasi dari chain express-validator.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const firstError = errors.array()[0];
    return next(
      AppError.badRequest(firstError.msg, ERROR_CODES.VALIDATION_ERROR, errors.array())
    );
  }
  next();
}

const validateInfoRequest = [
  body('url')
    .trim()
    .notEmpty()
    .withMessage('URL wajib diisi.')
    .custom((value) => isValidYoutubeUrl(value))
    .withMessage('URL YouTube tidak valid.'),
  validate,
];

const validateClipRequest = [
  body('url')
    .trim()
    .notEmpty()
    .withMessage('URL wajib diisi.')
    .custom((value) => isValidYoutubeUrl(value))
    .withMessage('URL YouTube tidak valid.'),
  body('start')
    .trim()
    .notEmpty()
    .withMessage('Waktu mulai (start) wajib diisi.')
    .custom((value) => isValidTimeFormat(value))
    .withMessage('Format waktu mulai tidak valid. Gunakan HH:MM:SS.'),
  body('end')
    .trim()
    .notEmpty()
    .withMessage('Waktu selesai (end) wajib diisi.')
    .custom((value) => isValidTimeFormat(value))
    .withMessage('Format waktu selesai tidak valid. Gunakan HH:MM:SS.'),
  body('resolution')
    .optional()
    .trim()
    .isIn(Object.values(RESOLUTIONS))
    .withMessage(`Resolusi harus salah satu dari: ${Object.values(RESOLUTIONS).join(', ')}`),
  validate,
];

const validateJobIdParam = [
  param('id')
    .trim()
    .isUUID()
    .withMessage('Job ID tidak valid.'),
  validate,
];

const validateSocialPostRequest = [
  param('jobId')
    .trim()
    .isUUID()
    .withMessage('Job ID tidak valid.'),
  body('accountId')
    .trim()
    .notEmpty()
    .withMessage('accountId wajib diisi (pilih akun tujuan posting).'),
  body('caption')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 2200 })
    .withMessage('Caption maksimal 2200 karakter.'),
  body('scheduleAt')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('scheduleAt harus format ISO 8601 (mis. 2026-02-14T10:35:09.658Z).'),
  validate,
];

module.exports = {
  validate,
  validateInfoRequest,
  validateClipRequest,
  validateJobIdParam,
  validateSocialPostRequest,
};
