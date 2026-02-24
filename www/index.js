/**
 * Concertina Device App — Enhanced
 * Scan QR (live / photo), manual connect, send device info, upload video.
 */
import { Device } from '@capacitor/device';
import { Camera, CameraSource, CameraResultType } from '@capacitor/camera';

// ─── State ────────────────────────────────────────────────────────────────────
let currentConnection = null; // { deviceId, secret, apiBase }
let scannerStream = null;
let scannerAnimationId = null;
let currentStep = 0;

// ─── DOM helpers ─────────────────────────────────────────────────────────────
function $(id) { return document.getElementById(id); }

function setStatus(id, type, html) {
  const el = $(id);
  if (!el) return;
  el.className = 'status ' + type;
  el.innerHTML = html;
  el.style.display = type === '' ? 'none' : '';
}

function clearStatus(id) {
  const el = $(id);
  if (!el) return;
  el.className = 'status';
  el.style.display = 'none';
  el.innerHTML = '';
}

// ─── Step navigation ──────────────────────────────────────────────────────────
window.setStep = function(step) {
  // Hide all panels
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  // Show target
  const panel = $('step-' + step);
  if (panel) panel.classList.add('active');

  // Update tabs
  document.querySelectorAll('.step-tab').forEach(t => {
    const s = parseInt(t.dataset.step);
    t.classList.remove('active', 'done');
    if (s === step) t.classList.add('active');
    else if (s < step) t.classList.add('done');
  });

  currentStep = step;

  // Load device preview when entering step 1
  if (step === 1) loadDevicePreview();
};

// ─── Advanced settings toggle ─────────────────────────────────────────────────
window.toggleAdvanced = function() {
  const toggle = $('adv-toggle');
  const body = $('adv-body');
  toggle.classList.toggle('open');
  body.classList.toggle('open');
};

// ─── Connection pill update ────────────────────────────────────────────────────
function updateConnectionPill() {
  const pill = $('conn-pill');
  const label = $('conn-pill-label');
  const idEl = $('conn-pill-id');
  if (!currentConnection) {
    pill.classList.remove('connected');
    label.textContent = 'Not connected';
    idEl.textContent = '';
  } else {
    pill.classList.add('connected');
    label.textContent = 'Connected';
    idEl.textContent = currentConnection.deviceId.slice(-8) + '…';
  }
}

// ─── Parse connection URL ─────────────────────────────────────────────────────
function parseConnectionUrl(input) {
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

// ─── Get connection from inputs ───────────────────────────────────────────────
function getConnection() {
  const urlInput = $('url').value.trim();
  if (urlInput) {
    const parsed = parseConnectionUrl(urlInput);
    if (parsed) return parsed;
  }
  const deviceId = $('device-id').value.trim();
  const secret = $('device-secret').value.trim();
  const apiBase = ($('api-base').value || '').trim();
  if (!deviceId || !secret) return null;
  return { deviceId, secret, apiBase: apiBase || 'http://localhost:5000' };
}

// ─── Validate and go to step 1 ────────────────────────────────────────────────
window.validateAndNext = function() {
  const conn = getConnection();
  if (!conn) {
    setStatus('status', 'error', '⚠️ Enter a connection URL or both Device ID and Secret.');
    return;
  }
  currentConnection = conn;
  updateConnectionPill();
  clearStatus('status');
  setStep(1);
};

// ─── Device info helpers ──────────────────────────────────────────────────────
async function getDeviceInfo() {
  const info = { model: '', manufacturer: '', serialNumber: '', platform: '', osVersion: '' };
  try {
    const dev = await Device.getInfo();
    info.model = dev.model || dev.name || '';
    info.manufacturer = dev.manufacturer || '';
    info.serialNumber = dev.serialNumber || dev.identifier || '';
    info.platform = dev.platform || '';
    info.osVersion = dev.osVersion || '';
  } catch (e) {
    console.warn('Device.getInfo failed:', e);
    // Fallback: try userAgent
    const ua = navigator.userAgent || '';
    info.model = ua.match(/\(([^)]+)\)/)?.[1]?.split(';')?.[1]?.trim() || 'Unknown';
    info.manufacturer = 'Unknown';
  }
  return info;
}

async function getBattery() {
  try {
    if (navigator.getBattery) {
      const b = await navigator.getBattery();
      return Math.round((b.level ?? 0) * 100);
    }
  } catch (_) {}
  return undefined;
}

function getSignal() {
  try {
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (c) {
      return c.effectiveType || c.type
        || (c.downlink != null ? `~${c.downlink}Mbps` : null)
        || 'unknown';
    }
  } catch (_) {}
  return 'unknown';
}

// ─── Load device preview ──────────────────────────────────────────────────────
async function loadDevicePreview() {
  $('prev-model').textContent = '…';
  $('prev-mfr').textContent = '…';
  $('prev-battery').textContent = '…';
  $('prev-signal').textContent = '…';
  $('prev-serial').textContent = '…';

  const [info, battery] = await Promise.all([getDeviceInfo(), getBattery()]);
  const signal = getSignal();

  $('prev-model').textContent = info.model || 'Unknown';
  $('prev-mfr').textContent = info.manufacturer || 'Unknown';
  $('prev-battery').textContent = battery != null ? battery + '%' : 'N/A';
  $('prev-signal').textContent = signal || 'Unknown';
  $('prev-serial').textContent = info.serialNumber || 'N/A';
}

// ─── Send device info ─────────────────────────────────────────────────────────
window.sendDeviceInfo = async function() {
  const conn = currentConnection || getConnection();
  if (!conn) {
    setStatus('send-status', 'error', '⚠️ Not connected. Go back and connect first.');
    return;
  }

  const btn = $('send');
  btn.disabled = true;
  setStatus('send-status', 'loading', '<span class="spinner"></span> Reading device info and sending…');

  try {
    const [deviceInfo, battery] = await Promise.all([getDeviceInfo(), getBattery()]);
    const signal = getSignal();

    const body = {
      deviceSecret: conn.secret,
      battery: battery ?? undefined,
      signal: signal || undefined,
      status: 'active',
      serialNumber: deviceInfo.serialNumber || undefined,
      model: deviceInfo.model || undefined,
      manufacturer: deviceInfo.manufacturer || undefined,
      platform: deviceInfo.platform || undefined,
      osVersion: deviceInfo.osVersion || undefined,
    };

    const url = `${conn.apiBase.replace(/\/$/, '')}/api/devices/${encodeURIComponent(conn.deviceId)}/ingest`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success) {
      setStatus('send-status', 'success', '✅ Device info sent successfully! You can now upload a video in the next step.');
      // Auto-advance to upload step after short delay
      setTimeout(() => setStep(2), 1800);
    } else {
      setStatus('send-status', 'error', '❌ ' + (data.message || data.error || 'Request failed. Check URL and network.'));
    }
  } catch (e) {
    setStatus('send-status', 'error', '❌ Network error: ' + (e.message || 'Ensure the device can reach Concertina.'));
  } finally {
    btn.disabled = false;
  }
};

// ─── QR code decoding ─────────────────────────────────────────────────────────
const canvas = $('qr-canvas');
const ctx = canvas && canvas.getContext('2d');

function decodeQRFromImageData(imageData, width, height) {
  if (typeof window.jsQR !== 'function') return null;
  return window.jsQR(imageData, width, height, { inversionAttempts: 'dontInvert' });
}

function decodeQRFromImageSource(src) {
  return new Promise((resolve) => {
    if (!canvas || !ctx) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const idata = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = decodeQRFromImageData(idata.data, idata.width, idata.height);
      resolve(code ? code.data : null);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function onQrResult(urlString) {
  $('url').value = urlString;
  const parsed = parseConnectionUrl(urlString);
  if (parsed) {
    currentConnection = parsed;
    updateConnectionPill();
    clearStatus('status');
    setStep(1);
  } else {
    setStatus('status', 'error', '⚠️ QR code did not contain a valid Concertina connection URL. Try manually entering the details.');
  }
}

// ─── Camera logs (console + optional on-screen) ───────────────────────────────
const CAMERA_LOG_PREFIX = '[Concertina Device Camera]';
let lastCameraError = null;

function cameraLog(msg, data) {
  const line = data !== undefined ? `${CAMERA_LOG_PREFIX} ${msg}` : CAMERA_LOG_PREFIX + ' ' + msg;
  console.log(line, data !== undefined ? data : '');
}

function cameraLogError(msg, err) {
  lastCameraError = { msg, err: err ? { name: err.name, message: err.message, stack: err && err.stack } : null };
  console.error(CAMERA_LOG_PREFIX, msg, err);
  if (err) {
    console.error(CAMERA_LOG_PREFIX + ' Error name:', err.name);
    console.error(CAMERA_LOG_PREFIX + ' Error message:', err.message);
    if (err.stack) console.error(CAMERA_LOG_PREFIX + ' Stack:', err.stack);
  }
  const el = document.getElementById('camera-debug');
  if (el) {
    const part = err ? `${err.name}: ${err.message}` : msg;
    el.textContent = `Last camera error: ${msg} — ${part}`;
    el.classList.remove('hidden');
  }
}

// ─── In-app live QR scanner ───────────────────────────────────────────────────
window.stopInAppScanner = function() {
  cameraLog('In-app scanner: stopping');
  if (scannerAnimationId) {
    cancelAnimationFrame(scannerAnimationId);
    scannerAnimationId = null;
  }
  if (scannerStream) {
    scannerStream.getTracks().forEach(t => t.stop());
    scannerStream = null;
  }
  $('scanner-overlay').classList.add('hidden');
};

window.startInAppScanner = async function() {
  cameraLog('In-app scanner: start requested');
  lastCameraError = null;
  const debugEl = document.getElementById('camera-debug');
  if (debugEl) { debugEl.textContent = ''; debugEl.classList.add('hidden'); }

  if (typeof window.jsQR !== 'function') {
    cameraLogError('jsQR not loaded');
    setStatus('status', 'error', '⚠️ Scanner library not loaded. Check your internet connection.');
    return;
  }
  cameraLog('jsQR loaded');

  const overlay = $('scanner-overlay');
  const video = $('scanner-video');
  if (!overlay || !video || !canvas || !ctx) {
    cameraLogError('Missing DOM elements', { overlay: !!overlay, video: !!video, canvas: !!canvas, ctx: !!ctx });
    return;
  }
  cameraLog('DOM elements OK');

  overlay.classList.remove('hidden');
  setStatus('status', 'loading', '<span class="spinner"></span> Starting camera…');

  try {
    if (typeof Camera !== 'undefined' && typeof Camera.requestPermissions === 'function') {
      cameraLog('Requesting camera permission via Capacitor…');
      const perm = await Camera.requestPermissions({ permissions: ['camera'] });
      cameraLog('Permission result', perm);
    } else {
      cameraLog('Camera.requestPermissions not available (not in Capacitor or no method)');
    }
  } catch (permErr) {
    cameraLogError('Permission request failed', permErr);
  }

  const constraints = { video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } };
  cameraLog('Calling getUserMedia with constraints', constraints);

  try {
    scannerStream = await navigator.mediaDevices.getUserMedia(constraints);
    cameraLog('getUserMedia success', {
      streamId: scannerStream.id,
      tracks: scannerStream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })),
    });

    video.srcObject = scannerStream;
    video.setAttribute('playsinline', 'true');
    cameraLog('Video srcObject set, calling play()…');
    await video.play();
    cameraLog('Video play() resolved', { videoWidth: video.videoWidth, videoHeight: video.videoHeight });
    clearStatus('status');

    let firstFrameLogged = false;
    function tick() {
      if (!scannerStream || !video.videoWidth) {
        if (!firstFrameLogged && video.readyState >= 2) {
          firstFrameLogged = true;
          cameraLog('Waiting for video dimensions', { videoWidth: video.videoWidth, videoHeight: video.videoHeight, readyState: video.readyState });
        }
        scannerAnimationId = requestAnimationFrame(tick);
        return;
      }
      if (!firstFrameLogged) {
        firstFrameLogged = true;
        cameraLog('First frame with dimensions', { videoWidth: video.videoWidth, videoHeight: video.videoHeight });
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -video.videoWidth, 0, video.videoWidth, video.videoHeight);
      ctx.restore();
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = decodeQRFromImageData(imageData.data, imageData.width, imageData.height);
      if (code && code.data) {
        const text = (code.data || '').trim();
        if (text && (text.includes('deviceId=') || text.includes('device-connect'))) {
          cameraLog('QR detected, connection URL found');
          stopInAppScanner();
          onQrResult(text);
          return;
        }
      }
      scannerAnimationId = requestAnimationFrame(tick);
    }
    tick();
  } catch (e) {
    cameraLogError('In-app scanner failed', e);
    stopInAppScanner();
    const errMsg = e.message || e.name || 'Permission denied';
    setStatus('status', 'error', '❌ Camera error: ' + errMsg + '. Try "Take Photo of QR" instead.');
    if (isPermissionError(e)) showPermissionPrompt();
  }
};

// ─── Take photo QR scan ───────────────────────────────────────────────────────
window.takePhotoQR = async function() {
  const btn = $('scan-qr');
  btn.disabled = true;
  lastCameraError = null;
  const debugEl = document.getElementById('camera-debug');
  if (debugEl) { debugEl.textContent = ''; debugEl.classList.add('hidden'); }
  setStatus('status', 'loading', '<span class="spinner"></span> Opening camera…');

  cameraLog('Take photo: opening Camera.getPhoto (system camera)…');

  try {
    const photo = await Camera.getPhoto({
      source: CameraSource.CAMERA,
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
    });

    cameraLog('Take photo: got photo', {
      hasDataUrl: !!photo.dataUrl,
      hasBase64String: !!photo.base64String,
      hasWebPath: !!photo.webPath,
      hasPath: !!photo.path,
    });

    setStatus('status', 'loading', '<span class="spinner"></span> Reading QR code…');

    const dataUrl = photo.dataUrl
      || (photo.base64String ? 'data:image/jpeg;base64,' + photo.base64String : null)
      || photo.webPath
      || photo.path;

    if (!dataUrl) {
      cameraLogError('Take photo: no image data in result', null);
      setStatus('status', 'error', '❌ Could not get photo. Please try again.');
      return;
    }

    const qrText = await decodeQRFromImageSource(dataUrl);
    cameraLog('Take photo: decode result', { found: !!qrText, length: qrText ? qrText.length : 0 });
    if (qrText && (qrText.includes('deviceId=') || qrText.includes('device-connect'))) {
      await onQrResult(qrText.trim());
    } else {
      setStatus('status', 'error', '❌ No Concertina QR found in the photo. Make sure you are scanning the QR from Admin → Device data.');
    }
  } catch (e) {
    cameraLogError('Take photo: Camera.getPhoto failed', e);
    const msg = e.message || String(e);
    if (msg.toLowerCase().includes('cancel')) {
      cameraLog('Take photo: user cancelled');
      clearStatus('status');
    } else {
      setStatus('status', 'error', '❌ Camera error: ' + (msg || 'Allow camera access in settings and try again.'));
      if (isPermissionError(e)) showPermissionPrompt();
    }
  } finally {
    btn.disabled = false;
  }
};

// ─── Upload video ─────────────────────────────────────────────────────────────
window.uploadVideo = async function() {
  const conn = currentConnection || getConnection();
  if (!conn) {
    setStatus('upload-status', 'error', '⚠️ Connect the device first (Step 1).');
    return;
  }
  const fileInput = $('video-file');
  const file = fileInput?.files?.[0];
  if (!file) {
    setStatus('upload-status', 'error', '⚠️ Please choose a video file first.');
    return;
  }

  const projectId = ($('project-id').value || '').trim();
  const btn = $('upload-video');
  const progressWrap = $('progress-wrap');
  const progressBar = $('progress-bar');

  btn.disabled = true;
  progressWrap.classList.add('active');
  progressBar.style.width = '0%';
  setStatus('upload-status', 'loading', '<span class="spinner"></span> Uploading video…');

  try {
    // Use XHR for upload progress
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = `${conn.apiBase.replace(/\/$/, '')}/api/devices/${encodeURIComponent(conn.deviceId)}/upload-video`;

      xhr.open('POST', url);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          progressBar.style.width = pct + '%';
          setStatus('upload-status', 'loading', `<span class="spinner"></span> Uploading… ${pct}%`);
        }
      };

      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && data.success) {
            progressBar.style.width = '100%';
            setStatus('upload-status', 'success', '✅ Video uploaded successfully!');
            fileInput.value = '';
            resolve();
          } else {
            reject(new Error(data.message || data.error || 'Upload failed.'));
          }
        } catch {
          reject(new Error('Invalid server response.'));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload.'));
      xhr.ontimeout = () => reject(new Error('Upload timed out.'));
      xhr.timeout = 5 * 60 * 1000; // 5 min timeout for large files

      const form = new FormData();
      form.append('video', file);
      form.append('deviceSecret', conn.secret);
      if (projectId) form.append('projectId', projectId);
      xhr.send(form);
    });
  } catch (e) {
    setStatus('upload-status', 'error', '❌ ' + (e.message || 'Upload failed. Check network.'));
    progressWrap.classList.remove('active');
  } finally {
    btn.disabled = false;
  }
};

// ─── Pre-fill from launch URL (deep link / QR) ────────────────────────────────
try {
  if (window.Capacitor?.Plugins?.App?.getLaunchUrl) {
    window.Capacitor.Plugins.App.getLaunchUrl().then((r) => {
      if (r?.value) {
        $('url').value = r.value;
        // Auto-parse and connect if valid
        const parsed = parseConnectionUrl(r.value);
        if (parsed) {
          currentConnection = parsed;
          updateConnectionPill();
          setStep(1);
        }
      }
    }).catch(() => {});
  }
} catch (_) {}

// ─── Handle Android back button ───────────────────────────────────────────────
try {
  if (window.Capacitor?.Plugins?.App) {
    window.Capacitor.Plugins.App.addListener('backButton', () => {
      // If scanner is open, close it
      if (!$('scanner-overlay').classList.contains('hidden')) {
        stopInAppScanner();
        return;
      }
      // If not on step 0, go back a step
      if (currentStep > 0) {
        setStep(currentStep - 1);
        return;
      }
      // Otherwise let Android handle it (exit)
      window.Capacitor.Plugins.App.exitApp();
    });
  }
} catch (_) {}

// ─── Permission prompt (open Settings when camera denied) ──────────────────────
function isPermissionError(e) {
  if (!e) return false;
  const msg = (e.message || e.name || '').toLowerCase();
  return msg.includes('permission') || msg.includes('denied') || msg.includes('not allowed') || msg.includes('notallowed');
}

function showPermissionPrompt() {
  const el = document.getElementById('permission-prompt');
  if (el) el.classList.add('visible');
}

function hidePermissionPrompt() {
  const el = document.getElementById('permission-prompt');
  if (el) el.classList.remove('visible');
}

function openAppSettings() {
  // Try Android app details settings intent (works when opened from native context)
  const pkg = 'ai.concertina.device';
  const intentUrl = 'intent:#Intent;action=android.settings.APPLICATION_DETAILS_SETTINGS;package=' + pkg + ';end';
  try {
    if (window.Capacitor?.Plugins?.App?.openUrl) {
      window.Capacitor.Plugins.App.openUrl({ url: intentUrl }).catch(() => {});
    }
  } catch (_) {}
  hidePermissionPrompt();
}

document.getElementById('permission-btn-open-settings')?.addEventListener('click', openAppSettings);
document.getElementById('permission-btn-dismiss')?.addEventListener('click', hidePermissionPrompt);

// ─── Loading screen: hide when app is ready ────────────────────────────────────
function hideAppLoading() {
  const el = document.getElementById('app-loading');
  if (el) el.classList.add('hidden');
}
// Show loading for a moment so the Server AI logo + animation are visible
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { setTimeout(hideAppLoading, 600); });
} else {
  setTimeout(hideAppLoading, 600);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
updateConnectionPill();
