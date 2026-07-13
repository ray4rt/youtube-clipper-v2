/**
 * scripts/checkDependencies.js
 *
 * Memverifikasi bahwa binary eksternal yang dibutuhkan (yt-dlp, ffmpeg)
 * tersedia di PATH sistem sebelum aplikasi dijalankan.
 *
 * Dipanggil secara otomatis saat startup (app.js) dan juga bisa
 * dijalankan manual via: npm run check:deps
 */

const { spawnSync } = require('child_process');

/**
 * Menjalankan command versi untuk mengecek ketersediaan binary.
 * @param {string} command - Nama binary (mis. 'yt-dlp', 'ffmpeg')
 * @param {string[]} args - Argumen untuk cek versi
 * @returns {{ available: boolean, version: string|null }}
 */
function checkBinary(command, args) {
  try {
    const result = spawnSync(command, args, { encoding: 'utf-8', timeout: 5000 });

    if (result.error || result.status !== 0) {
      return { available: false, version: null };
    }

    const output = (result.stdout || result.stderr || '').trim().split('\n')[0];
    return { available: true, version: output };
  } catch (err) {
    return { available: false, version: null };
  }
}

/**
 * Menjalankan seluruh pengecekan dependency eksternal.
 * @returns {{ ok: boolean, results: object }}
 */
function checkAllDependencies() {
  const ytdlp = checkBinary('yt-dlp', ['--version']);
  const ffmpeg = checkBinary('ffmpeg', ['-version']);
  const ffprobe = checkBinary('ffprobe', ['-version']);

  const results = { ytdlp, ffmpeg, ffprobe };
  const ok = ytdlp.available && ffmpeg.available && ffprobe.available;

  return { ok, results };
}

/**
 * Mencetak hasil pengecekan dengan format yang mudah dibaca di terminal.
 */
function printReport() {
  const { ok, results } = checkAllDependencies();

  console.log('\n========================================');
  console.log(' YouTube Clipper - Dependency Check');
  console.log('========================================');

  Object.entries(results).forEach(([name, info]) => {
    const status = info.available ? '✔ OK' : '✘ MISSING';
    const version = info.available ? info.version : 'tidak ditemukan di PATH';
    console.log(` ${name.padEnd(10)} : ${status.padEnd(10)} (${version})`);
  });

  console.log('----------------------------------------');

  // GPU acceleration status (opsional, tidak memengaruhi `ok`)
  try {
    const gpuService = require('../services/gpu.service');
    const gpu = gpuService.detectGpuEncoder();
    const gpuLine = gpu
      ? `✔ ${gpu.vendor} (${gpu.config.videoCodec})`
      : '— tidak aktif (CPU/libx264)';
    console.log(` gpu        : ${gpuLine}`);
  } catch (err) {
    console.log(' gpu        : gagal mendeteksi (lihat log)');
  }

  console.log('========================================');

  if (!ok) {
    console.log('\n⚠ Beberapa dependency eksternal belum terpasang.');
    console.log('  Silakan cek README.md bagian "Instalasi FFmpeg & yt-dlp".\n');
  } else {
    console.log('\n✔ Semua dependency eksternal siap digunakan.\n');
  }

  return ok;
}

// Jika dijalankan langsung via `node scripts/checkDependencies.js`
if (require.main === module) {
  const ok = printReport();
  process.exit(ok ? 0 : 1);
}

module.exports = { checkAllDependencies, printReport, checkBinary };
