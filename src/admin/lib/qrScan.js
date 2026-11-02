// QR reading for the admin: uses the browser's built-in BarcodeDetector where it exists (Chrome / Edge / Android),
// and falls back to jsQR (loaded once from a CDN) everywhere else (Firefox, Safari, desktop browsers without BarcodeDetector).
// BACKEND: nothing needed here, scanning is fully client side.

const loadJsQR = async () => (await import('jsqr')).default; // bundled (npm), no CDN needed

/** Returns async decode(source) -> string ('' when no QR is visible). source: <video>, <img>, <canvas> or ImageBitmap. */
export async function makeQrDecoder() {
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      const det = new window.BarcodeDetector({ formats: ['qr_code'] });
      return async (src) => { const codes = await det.detect(src); return codes[0]?.rawValue || ''; };
    } catch { /* fall through to jsQR */ }
  }
  const jsQR = await loadJsQR();
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  return async (src) => {
    const w = src.videoWidth || src.naturalWidth || src.width;
    const h = src.videoHeight || src.naturalHeight || src.height;
    if (!w || !h) return '';
    const k = Math.min(1, 900 / Math.max(w, h));
    cv.width = Math.max(1, Math.round(w * k));
    cv.height = Math.max(1, Math.round(h * k));
    ctx.drawImage(src, 0, 0, cv.width, cv.height);
    const img = ctx.getImageData(0, 0, cv.width, cv.height);
    const r = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
    return r?.data || '';
  };
}

/** Read a QR from a picked photo / screenshot. */
export async function decodeQrFile(file) {
  const decode = await makeQrDecoder();
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return await decode(img);
  } finally { URL.revokeObjectURL(url); }
}
