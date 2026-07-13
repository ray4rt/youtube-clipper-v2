/**
 * controllers/social.controller.js
 * GET  /api/social/accounts
 * POST /api/social/post/:jobId
 */

const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const jobService = require('../services/job.service');
const replizService = require('../services/repliz.service');
const { JOB_STATUS, ERROR_CODES } = require('../config/constants');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Mengambil daftar akun sosial media yang terhubung di Repliz,
 * dipakai frontend untuk menampilkan dropdown pilihan tujuan posting.
 */
const getConnectedAccounts = asyncHandler(async (req, res) => {
  const accounts = await replizService.listAccounts({
    page: req.query.page || 1,
    limit: req.query.limit || 20,
  });

  res.json({ success: true, data: accounts });
});

/**
 * Memposting hasil clip (job yang sudah selesai) ke akun sosial media terpilih.
 * Video diambil dari URL publik endpoint /api/download/:jobId milik aplikasi ini sendiri,
 * sehingga Repliz bisa fetch file tanpa perlu upload manual.
 */
const postClipToSocial = asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const { accountId, caption, scheduleAt } = req.body;

  const job = jobService.getJob(jobId);
  if (!job) {
    throw AppError.notFound('Job tidak ditemukan.', ERROR_CODES.JOB_NOT_FOUND);
  }
  if (job.status !== JOB_STATUS.DONE) {
    throw AppError.badRequest('Clip belum selesai diproses, tidak bisa diposting.');
  }

  // URL publik yang bisa diakses server Repliz untuk mengambil file video
  const videoUrl = `${config.server.baseUrl}/api/download/${jobId}`;

  const result = await replizService.createPost({
    accountId,
    caption,
    videoUrl,
    scheduleAt,
  });

  logger.info('Clip diposting ke sosial media via Repliz', { jobId, accountId, scheduleId: result?._id });

  res.status(202).json({
    success: true,
    message: scheduleAt
      ? 'Post berhasil dijadwalkan.'
      : 'Post berhasil diantrekan untuk diterbitkan.',
    data: result,
  });
});

module.exports = { getConnectedAccounts, postClipToSocial };
