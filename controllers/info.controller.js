/**
 * controllers/info.controller.js
 * POST /api/info
 */

const asyncHandler = require('../utils/asyncHandler');
const ytdlpService = require('../services/ytdlp.service');
const cacheService = require('../services/cache.service');
const { extractVideoId, normalizeUrl } = require('../utils/urlValidator');
const { formatBytes } = require('../utils/fileHelper');
const logger = require('../utils/logger');

/**
 * Mengambil metadata video YouTube, memanfaatkan cache jika tersedia.
 */
const getVideoInfo = asyncHandler(async (req, res) => {
  const { url } = req.body;
  const videoId = extractVideoId(url);
  const normalized = normalizeUrl(url);

  const cached = cacheService.getMetadata(videoId);
  if (cached) {
    logger.debug('Metadata diambil dari cache', { videoId });
    return res.json({ success: true, cached: true, data: cached });
  }

  const metadata = await ytdlpService.getVideoInfo(normalized);
  metadata.estimatedSizeLabel = metadata.estimatedSizeBytes
    ? formatBytes(metadata.estimatedSizeBytes)
    : 'Tidak diketahui';

  cacheService.setMetadata(videoId, metadata);

  logger.info('Metadata video berhasil diambil', { videoId, title: metadata.title });

  res.json({ success: true, cached: false, data: metadata });
});

module.exports = { getVideoInfo };
