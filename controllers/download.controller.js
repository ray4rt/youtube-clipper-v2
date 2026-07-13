/**
 * controllers/download.controller.js
 * GET /api/download/:id
 */

const path = require('path');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const jobService = require('../services/job.service');
const { fileExists, safeJoin } = require('../utils/fileHelper');
const { JOB_STATUS, ERROR_CODES } = require('../config/constants');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Mengunduh file hasil clip. Memvalidasi bahwa job sudah selesai dan
 * file benar-benar berada di dalam folder output/ (anti path traversal).
 */
const downloadClip = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const job = jobService.getJob(id);

  if (!job) {
    throw AppError.notFound('Job tidak ditemukan.', ERROR_CODES.JOB_NOT_FOUND);
  }

  if (job.status !== JOB_STATUS.DONE) {
    throw AppError.badRequest('File belum siap. Proses masih berjalan atau gagal.', ERROR_CODES.FILE_NOT_FOUND);
  }

  const safePath = safeJoin(config.folders.output, path.basename(job.outputPath));

  if (!fileExists(safePath)) {
    throw AppError.notFound('File hasil sudah tidak tersedia (mungkin sudah dibersihkan otomatis).', ERROR_CODES.FILE_NOT_FOUND);
  }

  logger.info('File hasil clip diunduh', { jobId: id, file: job.outputFile });

  res.download(safePath, job.outputFile, (err) => {
    if (err) {
      logger.error('Gagal mengirim file download', { jobId: id, error: err.message });
    }
  });
});

module.exports = { downloadClip };
