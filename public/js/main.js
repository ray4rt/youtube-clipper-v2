/**
 * public/js/main.js
 * Logic utama frontend Clipreel: load metadata, drag & drop URL,
 * submit clip job, render progress real-time via SSE, dan hasil akhir.
 */

(function () {
  'use strict';

  // ===== Elemen =====
  const urlForm = document.getElementById('urlForm');
  const urlInput = document.getElementById('urlInput');
  const urlError = document.getElementById('urlError');
  const dropzone = document.getElementById('dropzone');
  const loadBtn = document.getElementById('loadBtn');

  const previewSection = document.getElementById('previewSection');
  const thumbImg = document.getElementById('thumbImg');
  const durationBadge = document.getElementById('durationBadge');
  const videoTitle = document.getElementById('videoTitle');
  const videoChannel = document.getElementById('videoChannel');
  const metaDuration = document.getElementById('metaDuration');
  const metaSize = document.getElementById('metaSize');
  const metaSubtitle = document.getElementById('metaSubtitle');
  const metaResolutions = document.getElementById('metaResolutions');
  const rulerSelection = document.getElementById('rulerSelection');

  const clipForm = document.getElementById('clipForm');
  const startInput = document.getElementById('startInput');
  const endInput = document.getElementById('endInput');
  const resolutionSelect = document.getElementById('resolutionSelect');
  const clipError = document.getElementById('clipError');
  const clipBtn = document.getElementById('clipBtn');

  const progressSection = document.getElementById('progressSection');
  const progressStage = document.getElementById('progressStage');
  const progressPercent = document.getElementById('progressPercent');
  const progressBar = document.getElementById('progressBar');
  const vuMeter = document.getElementById('vuMeter');

  const resultSection = document.getElementById('resultSection');
  const resultFilename = document.getElementById('resultFilename');
  const downloadBtn = document.getElementById('downloadBtn');
  const deleteBtn = document.getElementById('deleteBtn');

  const socialSection = document.getElementById('socialSection');
  const socialForm = document.getElementById('socialForm');
  const accountSelect = document.getElementById('accountSelect');
  const captionInput = document.getElementById('captionInput');
  const scheduleToggle = document.getElementById('scheduleToggle');
  const scheduleAtWrap = document.getElementById('scheduleAtWrap');
  const scheduleAtInput = document.getElementById('scheduleAtInput');
  const socialError = document.getElementById('socialError');
  const socialBtn = document.getElementById('socialBtn');

  const themeToggle = document.getElementById('themeToggle');
  const toastContainer = document.getElementById('toastContainer');

  let currentVideoDuration = 0;
  let currentJobId = null;

  // ===== VU Meter bars (dekoratif) =====
  for (let i = 0; i < 24; i++) {
    const bar = document.createElement('span');
    bar.style.animationDelay = `${(i * 0.05).toFixed(2)}s`;
    vuMeter.appendChild(bar);
  }

  // ===== Theme Toggle =====
  const savedTheme = localStorage.getItem('clipreel-theme');
  if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);

  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const next = current === 'light' ? 'dark' : 'light';
    if (next === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('clipreel-theme', next);
  });

  // ===== Toast Notification =====
  function showToast(message, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast${type === 'error' ? ' error' : ''}`;
    el.textContent = message;
    toastContainer.appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }

  // ===== Drag & Drop URL =====
  ['dragenter', 'dragover'].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    })
  );
  ['dragleave', 'drop'].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    })
  );
  dropzone.addEventListener('drop', (e) => {
    const text = e.dataTransfer.getData('text/plain');
    if (text) {
      urlInput.value = text.trim();
      urlForm.requestSubmit();
    }
  });

  // ===== Helper: fetch wrapper dengan error handling seragam =====
  async function apiRequest(url, options = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const json = await res.json();
    if (!res.ok || json.success === false) {
      const message = json?.error?.message || 'Terjadi kesalahan.';
      throw new Error(message);
    }
    return json;
  }

  function setButtonLoading(btn, loading, loadingText = 'Memproses…') {
    btn.disabled = loading;
    const label = btn.querySelector('.btn-label');
    if (!btn.dataset.originalLabel) btn.dataset.originalLabel = label.textContent;
    label.textContent = loading ? loadingText : btn.dataset.originalLabel;
  }

  // ===== Format helper =====
  function secondsToTime(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
  }

  function timeToSeconds(value) {
    const parts = value.split(':').map(Number);
    if (parts.some(isNaN)) return NaN;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return NaN;
  }

  // ===== Update ruler selection visual =====
  function updateRuler() {
    if (!currentVideoDuration) return;
    const start = timeToSeconds(startInput.value);
    const end = timeToSeconds(endInput.value);
    if (isNaN(start) || isNaN(end)) return;

    const leftPct = Math.max(0, (start / currentVideoDuration) * 100);
    const rightPct = Math.max(0, 100 - (end / currentVideoDuration) * 100);
    rulerSelection.style.left = `${leftPct}%`;
    rulerSelection.style.right = `${rightPct}%`;
  }
  startInput.addEventListener('input', updateRuler);
  endInput.addEventListener('input', updateRuler);

  // ===== STEP 1: Load Video Info =====
  urlForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    urlError.hidden = true;
    resultSection.hidden = true;
    progressSection.hidden = true;
    socialSection.hidden = true;

    setButtonLoading(loadBtn, true, 'Memuat…');

    try {
      const { data } = await apiRequest('/api/info', {
        method: 'POST',
        body: JSON.stringify({ url: urlInput.value.trim() }),
      });

      currentVideoDuration = data.duration || 0;

      thumbImg.src = data.thumbnail;
      durationBadge.textContent = data.durationLabel;
      videoTitle.textContent = data.title;
      videoChannel.textContent = data.channel || '—';
      metaDuration.textContent = data.durationLabel;
      metaSize.textContent = data.estimatedSizeLabel || 'Tidak diketahui';
      metaSubtitle.textContent = data.hasSubtitles
        ? `Tersedia (${data.subtitleLanguages.slice(0, 3).join(', ')})`
        : 'Tidak tersedia';
      metaResolutions.textContent = data.availableResolutions?.length
        ? data.availableResolutions.slice(0, 5).join(', ')
        : '—';

      endInput.value = secondsToTime(Math.min(currentVideoDuration, 60));
      startInput.value = '00:00:00';
      updateRuler();

      previewSection.hidden = false;
      previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      showToast('Metadata video berhasil dimuat.');
    } catch (err) {
      urlError.textContent = err.message;
      urlError.hidden = false;
      showToast(err.message, 'error');
    } finally {
      setButtonLoading(loadBtn, false);
    }
  });

  // ===== STEP 2: Submit Clip Job =====
  clipForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clipError.hidden = true;

    const start = startInput.value.trim();
    const end = endInput.value.trim();
    const startSec = timeToSeconds(start);
    const endSec = timeToSeconds(end);

    if (isNaN(startSec) || isNaN(endSec)) {
      clipError.textContent = 'Format waktu tidak valid. Gunakan HH:MM:SS.';
      clipError.hidden = false;
      return;
    }
    if (startSec >= endSec) {
      clipError.textContent = 'Waktu mulai harus lebih kecil dari waktu selesai.';
      clipError.hidden = false;
      return;
    }

    setButtonLoading(clipBtn, true, 'Mendaftarkan job…');
    resultSection.hidden = true;
    socialSection.hidden = true;

    try {
      const { data } = await apiRequest('/api/clip', {
        method: 'POST',
        body: JSON.stringify({
          url: urlInput.value.trim(),
          start,
          end,
          resolution: resolutionSelect.value,
        }),
      });

      currentJobId = data.jobId;
      progressSection.hidden = false;
      progressSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      listenToProgress(currentJobId);
    } catch (err) {
      clipError.textContent = err.message;
      clipError.hidden = false;
      showToast(err.message, 'error');
      setButtonLoading(clipBtn, false);
    }
  });

  // ===== STEP 3: Listen Progress via SSE =====
  function listenToProgress(jobId) {
    connectJobStatus(
      jobId,
      (data) => {
        progressBar.style.width = `${data.progress}%`;
        progressPercent.textContent = `${data.progress}%`;
        progressStage.textContent = data.stage;

        if (data.status === 'done') {
          onClipDone(data);
        } else if (data.status === 'error') {
          onClipError(data);
        }
      },
      () => {
        showToast('Koneksi progress terputus.', 'error');
        setButtonLoading(clipBtn, false);
      }
    );
  }

  function onClipDone(data) {
    setButtonLoading(clipBtn, false);
    resultFilename.textContent = data.outputFile;
    downloadBtn.href = `/api/download/${data.id}`;
    resultSection.hidden = false;
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast('Clip berhasil dibuat! Siap diunduh.');

    socialSection.hidden = false;
    loadConnectedAccounts();
  }

  // ===== Auto-Post ke Sosial Media (Repliz) =====
  async function loadConnectedAccounts() {
    accountSelect.innerHTML = '<option value="">Memuat akun terhubung…</option>';
    try {
      const { data } = await apiRequest('/api/social/accounts');
      const accounts = Array.isArray(data) ? data : data?.data || [];

      if (!accounts.length) {
        accountSelect.innerHTML = '<option value="">Tidak ada akun terhubung di Repliz</option>';
        return;
      }

      accountSelect.innerHTML = accounts
        .map((acc) => `<option value="${acc._id}">${acc.name || acc.username} (${acc.type})</option>`)
        .join('');
    } catch (err) {
      accountSelect.innerHTML = '<option value="">Gagal memuat akun</option>';
      showToast(err.message, 'error');
    }
  }

  scheduleToggle.addEventListener('change', () => {
    scheduleAtWrap.hidden = !scheduleToggle.checked;
  });

  socialForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    socialError.hidden = true;

    if (!currentJobId) return;

    const accountId = accountSelect.value;
    if (!accountId) {
      socialError.textContent = 'Pilih akun tujuan posting terlebih dahulu.';
      socialError.hidden = false;
      return;
    }

    const payload = { accountId, caption: captionInput.value.trim() };
    if (scheduleToggle.checked && scheduleAtInput.value) {
      payload.scheduleAt = new Date(scheduleAtInput.value).toISOString();
    }

    setButtonLoading(socialBtn, true, 'Mengirim…');

    try {
      await apiRequest(`/api/social/post/${currentJobId}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showToast(
        payload.scheduleAt ? 'Post berhasil dijadwalkan.' : 'Post berhasil diantrekan untuk diterbitkan.'
      );
    } catch (err) {
      socialError.textContent = err.message;
      socialError.hidden = false;
      showToast(err.message, 'error');
    } finally {
      setButtonLoading(socialBtn, false);
    }
  });

  function onClipError(data) {
    setButtonLoading(clipBtn, false);
    const message = data.error?.message || 'Proses clipping gagal.';
    clipError.textContent = message;
    clipError.hidden = false;
    showToast(message, 'error');
  }

  // ===== STEP 4: Delete Result =====
  deleteBtn.addEventListener('click', async () => {
    if (!currentJobId) return;
    try {
      await apiRequest(`/api/delete/${currentJobId}`, { method: 'DELETE' });
      resultSection.hidden = true;
      progressSection.hidden = true;
      socialSection.hidden = true;
      showToast('File berhasil dihapus.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
})();
