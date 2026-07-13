/**
 * scripts/clean.js
 *
 * Membersihkan seluruh isi folder temp/, output/, dan downloads/ secara manual.
 * Berguna untuk maintenance atau reset environment development.
 *
 * Jalankan via: npm run clean
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TARGET_DIRS = ['temp', 'output', 'downloads'];

/**
 * Menghapus seluruh isi folder kecuali file .gitkeep
 * @param {string} dirPath - Path absolut folder yang akan dibersihkan
 * @returns {number} jumlah file yang dihapus
 */
function cleanDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;

  let count = 0;
  const entries = fs.readdirSync(dirPath);

  for (const entry of entries) {
    if (entry === '.gitkeep') continue;

    const fullPath = path.join(dirPath, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(fullPath);
    }
    count++;
  }

  return count;
}

function main() {
  console.log('\n🧹 Membersihkan folder sementara...\n');

  let total = 0;
  for (const dir of TARGET_DIRS) {
    const fullPath = path.join(ROOT, dir);
    const removed = cleanDirectory(fullPath);
    total += removed;
    console.log(` - ${dir}/  → ${removed} item dihapus`);
  }

  console.log(`\n✔ Selesai. Total ${total} item dihapus.\n`);
}

main();
