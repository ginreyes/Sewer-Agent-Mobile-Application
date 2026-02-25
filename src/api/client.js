/**
 * Concertina Device app – API client for the Node.js web app backend.
 * Uses the same API base (apiBase) as the web app so the mobile app can call
 * ingest, upload-video, and any other device-scoped or public endpoints.
 *
 * The app requires INTERNET permission (Android: already in AndroidManifest.xml)
 * so it can reach the backend.
 *
 * @param {{ apiBase: string, deviceId: string, secret: string }} connection – from connection URL or manual entry
 */

function ensureNoTrailingSlash(base) {
  return (base || '').replace(/\/$/, '');
}

/**
 * @param {{ apiBase: string, deviceId: string, secret: string }} connection
 * @returns {{ request, ingest, uploadVideo, getDevice }}
 */
export function createApiClient(connection) {
  if (!connection?.apiBase || !connection?.deviceId || !connection?.secret) {
    throw new Error('API client requires connection with apiBase, deviceId, and secret.');
  }

  const base = ensureNoTrailingSlash(connection.apiBase);
  const { deviceId, secret } = connection;

  /**
   * Generic request to the Concertina backend (same API as the web app).
   * Use for any endpoint; for device-scoped endpoints that need the secret, pass it in body or headers as required.
   *
   * @param {'GET'|'POST'|'PUT'|'PATCH'|'DELETE'} method
   * @param {string} path – e.g. '/api/devices/123' (no leading slash on base; path can start with /)
   * @param {{ body?: object | FormData, headers?: Record<string, string> }} [options]
   */
  async function request(method, path, options = {}) {
    const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : '/' + path}`;
    const headers = { ...options.headers };
    let body = options.body;
    if (body && typeof body === 'object' && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }
    const res = await fetch(url, { method, headers, body });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { message: text };
    }
    if (!res.ok) {
      const err = new Error(data.message || data.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  /**
   * POST /api/devices/:id/ingest – send device info (battery, signal, status, serial, model, etc.).
   * Same endpoint the web app backend exposes; keeps device status online and stores reported data.
   */
  async function ingest(payload = {}) {
    return request('POST', `/api/devices/${encodeURIComponent(deviceId)}/ingest`, {
      body: { deviceSecret: secret, ...payload },
    });
  }

  /**
   * POST /api/devices/:id/upload-video – upload a video file (FormData with 'video' and deviceSecret).
   * Same endpoint as the web app; optional projectId in form.
   * @param {File} file
   * @param {string|null} [projectId]
   * @param {{ onProgress?: (percent: number) => void }} [options]
   */
  async function uploadVideo(file, projectId = null, options = {}) {
    const form = new FormData();
    form.append('video', file);
    form.append('deviceSecret', secret);
    if (projectId) form.append('projectId', projectId);
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = `${base}/api/devices/${encodeURIComponent(deviceId)}/upload-video`;
      xhr.open('POST', url);
      if (options.onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) options.onProgress(Math.round((e.loaded / e.total) * 100));
        };
      }
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText || '{}');
          if (xhr.status >= 200 && xhr.status < 300) resolve(data);
          else reject(new Error(data.message || data.error || `HTTP ${xhr.status}`));
        } catch {
          reject(new Error('Invalid server response'));
        }
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.ontimeout = () => reject(new Error('Upload timed out'));
      xhr.timeout = 5 * 60 * 1000;
      xhr.send(form);
    });
  }

  /**
   * GET /api/devices/:id – fetch current device (if backend allows; may require auth).
   * Use this to check device details from the same API the web app uses.
   */
  async function getDevice() {
    return request('GET', `/api/devices/${encodeURIComponent(deviceId)}`);
  }

  return { request, ingest, uploadVideo, getDevice };
}
