/**
 * controllers/delete.controller.js
 * DELETE /api/delete/:id
 */

const path = require('path');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const jobService = require('../services/job.service');
const { safeDelete, safeJoin, fileExists } = require('../utils/fileHelper');
const { ERROR_CODES } = require('../config/constants');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Menghapus file hasil clip beserta entry job-nya dari memory.
 */
const deleteClip = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const job = jobService.getJob(id);

  if (!job) {
    throw AppError.notFound('Job tidak ditemukan.', ERROR_CODES.JOB_NOT_FOUND);
  }

  if (job.outputPath) {
    const safePath = safeJoin(config.folders.output, path.basename(job.outputPath));
    if (fileExists(safePath)) {
      safeDelete(safePath);
    }
  }

  jobService.removeJob(id);

  logger.info('File hasil clip dihapus manual oleh user', { jobId: id });

  res.json({ success: true, message: 'File dan job berhasil dihapus.' });
});

module.exports = { deleteClip };
