/**
 * controllers/clip.controller.js
 * POST /api/clip
 */

const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const jobService = require('../services/job.service');
const cacheService = require('../services/cache.service');
const ytdlpService = require('../services/ytdlp.service');
const clipQueue = require('../services/queue.service');
const { processClipJob } = require('../services/clipProcessor.service');
const { extractVideoId, normalizeUrl } = require('../utils/urlValidator');
const { timeToSeconds, validateClipRange } = require('../utils/timeParser');
const { RESOLUTIONS } = require('../config/constants');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Memulai job clipping: validasi range waktu terhadap durasi video (dari cache/yt-dlp),
 * lalu mendaftarkan job ke queue dan langsung mengembalikan jobId ke client.
 */
const startClip = asyncHandler(async (req, res) => {
  const { url, start, end, resolution = RESOLUTIONS.ORIGINAL } = req.body;

  const videoId = extractVideoId(url);
  const normalized = normalizeUrl(url);

  const startSeconds = timeToSeconds(start);
  const endSeconds = timeToSeconds(end);

  // Pastikan kita punya durasi video untuk validasi range (pakai cache dulu, fallback fetch)
  let metadata = cacheService.getMetadata(videoId);
  if (!metadata) {
    metadata = await ytdlpService.getVideoInfo(normalized);
    cacheService.setMetadata(videoId, metadata);
  }

  const rangeCheck = validateClipRange(
    startSeconds,
    endSeconds,
    metadata.duration,
    config.job.maxClipDurationSeconds
  );

  if (!rangeCheck.valid) {
    throw AppError.badRequest(rangeCheck.message);
  }

  const job = jobService.createJob({
    url: normalized,
    videoId,
    title: metadata.title,
    startSeconds,
    endSeconds,
    resolution,
  });

  logger.info('Job clip baru didaftarkan', {
    jobId: job.id,
    videoId,
    startSeconds,
    endSeconds,
    resolution,
  });

  // Daftarkan ke queue, dieksekusi worker sesuai concurrency limit
  clipQueue.add(() => processClipJob(job.id), `clip:${job.id}`);

  res.status(202).json({
    success: true,
    message: 'Job clip berhasil didaftarkan.',
    data: { jobId: job.id, statusUrl: `/api/status/${job.id}` },
  });
});

module.exports = { startClip };
