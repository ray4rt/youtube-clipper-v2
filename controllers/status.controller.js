/**
 * controllers/status.controller.js
 * GET /api/status/:id  (Server-Sent Events)
 */

const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const jobService = require('../services/job.service');
const { JOB_STATUS } = require('../config/constants');
const logger = require('../utils/logger');

/**
 * Format job menjadi payload ringkas untuk dikirim ke client (hindari expose path filesystem).
 * @param {object} job
 */
function toClientPayload(job) {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    stage: job.stage,
    outputFile: job.outputFile,
    error: job.error,
    updatedAt: job.updatedAt,
  };
}

/**
 * Streaming status job secara real-time via SSE.
 * Koneksi otomatis ditutup saat job mencapai status DONE atau ERROR.
 */
const streamStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const job = jobService.getJob(id);

  if (!job) {
    throw AppError.notFound('Job tidak ditemukan. Mungkin sudah selesai dan dibersihkan.', 'JOB_NOT_FOUND');
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // disable buffering di reverse proxy (nginx)
  });

  const send = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  // Kirim state saat ini segera setelah koneksi terbuka
  send(toClientPayload(job));

  const listener = (updatedJob) => {
    send(toClientPayload(updatedJob));
    if (updatedJob.status === JOB_STATUS.DONE || updatedJob.status === JOB_STATUS.ERROR) {
      cleanup();
    }
  };

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n'); // comment line SSE, menjaga koneksi tetap hidup
  }, 15000);

  function cleanup() {
    clearInterval(heartbeat);
    jobService.offJobUpdate(id, listener);
    res.end();
  }

  jobService.onJobUpdate(id, listener);

  req.on('close', () => {
    logger.debug('Client memutus koneksi SSE', { jobId: id });
    cleanup();
  });
});

module.exports = { streamStatus };
