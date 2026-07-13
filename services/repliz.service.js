/**
 * services/repliz.service.js
 * Integrasi dengan Repliz API (https://repliz.com) untuk auto-posting hasil clip
 * ke akun sosial media yang terhubung (Instagram, TikTok, Facebook, Threads, LinkedIn, dll).
 *
 * Autentikasi: Basic Auth (username = Access Key, password = Secret Key).
 * Dokumentasi endpoint: GET/POST /public/account, /public/schedule.
 */

const axios = require('axios');
const config = require('../config');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

const REQUEST_TIMEOUT_MS = 15000;

/**
 * Membuat axios instance dengan Basic Auth Repliz.
 * Dibuat lazy (bukan di top-level) agar error "belum dikonfigurasi" jelas saat dipanggil,
 * bukan saat module di-require.
 * @returns {import('axios').AxiosInstance}
 */
function getClient() {
  if (!config.repliz.enabled) {
    throw AppError.badRequest(
      'Integrasi Repliz belum dikonfigurasi. Set REPLIZ_ACCESS_KEY dan REPLIZ_SECRET_KEY di file .env.',
      'REPLIZ_NOT_CONFIGURED'
    );
  }

  return axios.create({
    baseURL: config.repliz.baseUrl,
    timeout: REQUEST_TIMEOUT_MS,
    auth: {
      username: config.repliz.accessKey,
      password: config.repliz.secretKey,
    },
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Menerjemahkan error axios/Repliz menjadi AppError yang jelas.
 * @param {import('axios').AxiosError} err
 * @returns {AppError}
 */
function mapReplizError(err) {
  if (err instanceof AppError) return err;

  const status = err.response?.status;
  const body = err.response?.data;
  const message = body?.message || body?.error || err.message;

  if (status === 401) {
    return new AppError('Access Key / Secret Key Repliz tidak valid.', 401, 'REPLIZ_UNAUTHORIZED');
  }
  if (status === 404) {
    return new AppError('Akun atau resource Repliz tidak ditemukan.', 404, 'REPLIZ_NOT_FOUND');
  }
  if (err.code === 'ECONNABORTED') {
    return new AppError('Permintaan ke Repliz API timeout.', 504, 'REPLIZ_TIMEOUT');
  }

  return new AppError(`Repliz API error: ${message}`, status || 502, 'REPLIZ_API_ERROR');
}

/**
 * Mengambil daftar akun sosial media yang terhubung di Repliz.
 * @param {{ page?: number, limit?: number, search?: string }} [params]
 * @returns {Promise<object[]>}
 */
async function listAccounts(params = {}) {
  try {
    const client = getClient();
    const { data } = await client.get('/public/account', { params });
    return data;
  } catch (err) {
    logger.error('Gagal mengambil daftar akun Repliz', { error: err.message });
    throw mapReplizError(err);
  }
}

/**
 * Mengambil detail satu akun (termasuk token.access) berdasarkan _id.
 * @param {string} accountId
 * @returns {Promise<object>}
 */
async function getAccount(accountId) {
  try {
    const client = getClient();
    const { data } = await client.get(`/public/account/${accountId}`);
    return data;
  } catch (err) {
    logger.error('Gagal mengambil detail akun Repliz', { accountId, error: err.message });
    throw mapReplizError(err);
  }
}

/**
 * Membuat scheduled post baru di Repliz (dipakai untuk auto-posting hasil clip).
 * Untuk "posting sekarang", kirim scheduleAt beberapa detik ke depan (Repliz tidak
 * punya endpoint "publish instan" terpisah — scheduler-nya yang mengeksekusi).
 *
 * @param {object} params
 * @param {string} params.accountId - _id akun tujuan (dari listAccounts)
 * @param {string} params.caption - Teks/caption post
 * @param {string} [params.videoUrl] - URL publik video (untuk post berjenis video)
 * @param {string} [params.thumbnailUrl] - URL thumbnail (opsional, untuk preview)
 * @param {string} [params.scheduleAt] - ISO 8601 datetime; default: 10 detik dari sekarang
 * @returns {Promise<object>} response Repliz (berisi _id schedule)
 */
async function createPost({ accountId, caption, videoUrl, thumbnailUrl, scheduleAt }) {
  if (!accountId) throw AppError.badRequest('accountId wajib diisi.');
  if (!videoUrl) throw AppError.badRequest('URL video publik wajib diisi untuk posting.');

  const payload = {
    title: '',
    description: caption || '',
    type: 'video',
    medias: [
      {
        type: 'video',
        url: videoUrl,
        thumbnail: thumbnailUrl || '',
      },
    ],
    scheduleAt: scheduleAt || new Date(Date.now() + 10_000).toISOString(),
    accountId,
  };

  try {
    const client = getClient();
    const { data } = await client.post('/public/schedule', payload);
    logger.info('Post berhasil dijadwalkan ke Repliz', { accountId, scheduleId: data?._id });
    return data;
  } catch (err) {
    logger.error('Gagal membuat scheduled post di Repliz', { accountId, error: err.message });
    throw mapReplizError(err);
  }
}

/**
 * Membatalkan scheduled post.
 * @param {string} scheduleId
 * @returns {Promise<object>}
 */
async function deleteScheduledPost(scheduleId) {
  try {
    const client = getClient();
    const { data } = await client.delete(`/public/schedule/${scheduleId}`);
    return data;
  } catch (err) {
    logger.error('Gagal membatalkan scheduled post Repliz', { scheduleId, error: err.message });
    throw mapReplizError(err);
  }
}

module.exports = { listAccounts, getAccount, createPost, deleteScheduledPost };
