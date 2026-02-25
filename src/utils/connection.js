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
