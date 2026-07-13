/**
 * services/gpu.service.js
 * Deteksi ketersediaan hardware encoder (NVIDIA NVENC, Intel QSV, AMD AMF,
 * Apple VideoToolbox) pada binary FFmpeg yang terpasang, dan menyediakan
 * konfigurasi codec/opsi yang sesuai untuk dipakai fluent-ffmpeg.
 *
 * Prinsip: GPU acceleration bersifat OPSIONAL dan SELALU punya fallback ke
 * CPU (libx264) — baik karena tidak terdeteksi maupun karena gagal saat runtime.
 */

const { spawnSync } = require('child_process');
const ffmpegStaticPath = require('ffmpeg-static');
const config = require('../config');
const logger = require('../utils/logger');

const FFMPEG_PATH = config.binaries.ffmpeg || ffmpegStaticPath;

/**
 * Definisi encoder GPU yang didukung, diurutkan berdasar prioritas deteksi 'auto'.
 * `probeName` adalah string yang harus muncul di output `ffmpeg -encoders`.
 */
const GPU_ENCODERS = {
  nvidia: {
    probeName: 'h264_nvenc',
    videoCodec: 'h264_nvenc',
    // NVENC: preset p1 (tercepat) - p7 (terbaik), gunakan cq bukan crf
    buildOutputOptions: (crf) => ['-preset p4', '-rc vbr', `-cq ${crf || 23}`, '-movflags +faststart'],
    hwaccelInput: ['-hwaccel', 'cuda'],
  },
  intel: {
    probeName: 'h264_qsv',
    videoCodec: 'h264_qsv',
    buildOutputOptions: (crf) => ['-preset veryfast', `-global_quality ${crf || 23}`, '-movflags +faststart'],
    hwaccelInput: ['-hwaccel', 'qsv'],
  },
  amd: {
    probeName: 'h264_amf',
    videoCodec: 'h264_amf',
    buildOutputOptions: (crf) => ['-quality speed', `-qp_i ${crf || 23}`, '-movflags +faststart'],
    hwaccelInput: [],
  },
  mac: {
    probeName: 'h264_videotoolbox',
    videoCodec: 'h264_videotoolbox',
    buildOutputOptions: () => ['-movflags +faststart'],
    hwaccelInput: ['-hwaccel', 'videotoolbox'],
  },
};

const AUTO_PROBE_ORDER = ['nvidia', 'intel', 'amd', 'mac'];

/** Cache hasil deteksi agar ffmpeg -encoders tidak dipanggil berulang tiap request. */
let cacheChecked = false;
let cachedResult = null;

/**
 * Menjalankan `ffmpeg -hide_banner -encoders` dan mengembalikan raw output.
 * @returns {string}
 */
function listEncoders() {
  const result = spawnSync(FFMPEG_PATH, ['-hide_banner', '-encoders'], {
    encoding: 'utf-8',
    timeout: 5000,
  });
  if (result.error || result.status !== 0) return '';
  return result.stdout || '';
}

/**
 * `ffmpeg -encoders` hanya menunjukkan encoder yang di-COMPILE ke dalam binary,
 * BUKAN yang benar-benar bisa jalan (butuh hardware GPU + driver yang aktif).
 * Fungsi ini melakukan test-encode singkat (1 frame, resolusi kecil) untuk
 * memvalidasi encoder benar-benar bisa diinisialisasi di mesin ini.
 *
 * @param {string} codecName - mis. 'h264_nvenc'
 * @returns {boolean}
 */
function testEncoderWorks(codecName) {
  const result = spawnSync(
    FFMPEG_PATH,
    [
      '-hide_banner', '-loglevel', 'error',
      '-f', 'lavfi', '-i', 'color=black:s=64x64:d=1',
      '-frames:v', '1',
      '-c:v', codecName,
      '-f', 'null', '-',
    ],
    { encoding: 'utf-8', timeout: 8000 }
  );
  return !result.error && result.status === 0;
}

/**
 * Mendeteksi encoder GPU yang aktif dipakai, sesuai config.gpu.mode:
 * - 'none'  -> selalu null (paksa CPU)
 * - 'auto'  -> coba nvidia -> intel -> amd -> mac, pakai yang pertama ditemukan
 * - 'nvidia'|'intel'|'amd'|'mac' -> coba encoder spesifik, fallback ke null jika tidak ada
 *
 * @returns {{ vendor: string, config: object } | null}
 */
function detectGpuEncoder() {
  if (cacheChecked) return cachedResult;

  const mode = (config.gpu.mode || 'none').toLowerCase();

  if (mode === 'none') {
    cacheChecked = true;
    cachedResult = null;
    return null;
  }

  const encoderList = listEncoders();
  const candidates = mode === 'auto' ? AUTO_PROBE_ORDER : [mode];

  for (const vendor of candidates) {
    const def = GPU_ENCODERS[vendor];
    if (!def || !encoderList.includes(def.probeName)) continue;

    // Encoder ada di daftar compile-time -> validasi nyata dengan test-encode
    if (!testEncoderWorks(def.videoCodec)) {
      logger.debug(`Encoder ${def.videoCodec} terdaftar tapi gagal saat test-encode (kemungkinan tidak ada hardware/driver).`);
      continue;
    }

    cachedResult = { vendor, config: def };
    cacheChecked = true;
    logger.info(`GPU acceleration aktif: ${vendor} (${def.videoCodec})`);
    return cachedResult;
  }

  logger.warn(
    `GPU acceleration diminta (mode="${mode}") tapi encoder tidak ditemukan pada FFmpeg ini. Fallback ke CPU (libx264).`
  );
  cacheChecked = true;
  cachedResult = null;
  return null;
}

/**
 * Reset cache deteksi (berguna untuk testing atau setelah ganti driver GPU tanpa restart).
 */
function resetCache() {
  cacheChecked = false;
  cachedResult = null;
}

/**
 * @returns {boolean}
 */
function isGpuAvailable() {
  return detectGpuEncoder() !== null;
}

module.exports = { detectGpuEncoder, isGpuAvailable, resetCache, GPU_ENCODERS };
