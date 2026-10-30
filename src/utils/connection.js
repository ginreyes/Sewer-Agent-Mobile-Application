export function parseConnectionUrl(input) {
  const s = (input || '').trim();
  if (!s) return null;
  try {
    const url = s.startsWith('http')
      ? new URL(s)
      : new URL('https://dummy?' + s.replace(/^[?&]/, '?'));
    const deviceId = url.searchParams.get('deviceId');
    const secret = url.searchParams.get('secret');
    const apiBase = url.searchParams.get('apiBase') || (s.startsWith('http') ? url.origin : '');
    if (!deviceId || !secret) return null;
    return { deviceId, secret, apiBase: apiBase || 'http://localhost:5000' };
  } catch (_) {
    return null;
  }
}

const STORAGE_KEY = 'concertina.connection';

// Remembered so the QR code is scanned once per device, not on every launch.
export function loadSavedConnection() {
  try {
    const c = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return c?.deviceId && c?.secret && c?.apiBase ? c : null;
  } catch {
    return null;
  }
}

export function saveConnection({ deviceId, secret, apiBase }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ deviceId, secret, apiBase }));
  } catch {
    /* storage unavailable — the app still works for this session */
  }
}

export function clearSavedConnection() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}
