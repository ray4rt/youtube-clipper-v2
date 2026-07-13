/**
 * public/js/sse.js
 * Helper tipis untuk membuka koneksi Server-Sent Events ke /api/status/:id
 * dan meneruskan setiap update progress ke callback yang diberikan.
 */

/**
 * @param {string} jobId
 * @param {(data: object) => void} onUpdate
 * @param {(err: Event) => void} [onError]
 * @returns {EventSource}
 */
function connectJobStatus(jobId, onUpdate, onError) {
  const source = new EventSource(`/api/status/${jobId}`);

  source.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onUpdate(data);
      if (data.status === 'done' || data.status === 'error') {
        source.close();
      }
    } catch (err) {
      console.error('Gagal parse SSE payload:', err);
    }
  };

  source.onerror = (event) => {
    if (onError) onError(event);
    source.close();
  };

  return source;
}
