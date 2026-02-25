import React, { useState, useEffect, useCallback } from 'react';
import { Device } from '@capacitor/device';
import { Camera, CameraSource, CameraResultType } from '@capacitor/camera';
import { parseConnectionUrl } from './utils/connection';
import { createApiClient } from './api/client';
import { decodeQRFromImageSource } from './utils/qr';
import logoSewerAi from './assets/logo-sewer-ai.svg';
import LoadingScreen from './components/LoadingScreen';
import PermissionPrompt from './components/PermissionPrompt';
import ScannerOverlay from './components/ScannerOverlay';

const CAMERA_LOG = '[Sewer Agent Ai Device Camera]';
function cameraLog(msg, data) {
  console.log(CAMERA_LOG, msg, data !== undefined ? data : '');
}
function cameraLogError(msg, err) {
  console.error(CAMERA_LOG, msg, err);
}

function isPermissionError(e) {
  if (!e) return false;
  const m = (e.message || e.name || '').toLowerCase();
  return m.includes('permission') || m.includes('denied') || m.includes('not allowed') || m.includes('notallowed');
}

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
    if (c) return c.effectiveType || c.type || (c.downlink != null ? `~${c.downlink}Mbps` : null) || 'unknown';
  } catch (_) {}
  return 'unknown';
}

export default function App() {
  const [loadingVisible, setLoadingVisible] = useState(true);
  const [permissionVisible, setPermissionVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [connection, setConnection] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const [urlInput, setUrlInput] = useState('');
  const [deviceIdInput, setDeviceIdInput] = useState('');
  const [secretInput, setSecretInput] = useState('');
  const [apiBaseInput, setApiBaseInput] = useState(import.meta.env.VITE_DEFAULT_API_BASE || '');
  const [advOpen, setAdvOpen] = useState(false);

  const [connectStatus, setConnectStatus] = useState({ type: '', message: '' });
  const [devicePreview, setDevicePreview] = useState({ model: '…', mfr: '…', battery: '…', signal: '…', serial: '…' });
  const [sendStatus, setSendStatus] = useState({ type: '', message: '' });
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState({ type: '', message: '' });
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [projectIdInput, setProjectIdInput] = useState('');
  const videoFileRef = React.useRef(null);
  const canvasRef = React.useRef(null);

  const getConnectionFromInputs = useCallback(() => {
    if (urlInput.trim()) {
      const p = parseConnectionUrl(urlInput.trim());
      if (p) return p;
    }
    if (deviceIdInput.trim() && secretInput.trim()) {
      return {
        deviceId: deviceIdInput.trim(),
        secret: secretInput.trim(),
        apiBase: apiBaseInput.trim() || import.meta.env.VITE_DEFAULT_API_BASE || 'http://http://192.168.50.11:5000',
      };
    }
    return null;
  }, [urlInput, deviceIdInput, secretInput, apiBaseInput]);

  const conn = connection || getConnectionFromInputs();

  useEffect(() => {
    const t = setTimeout(() => setLoadingVisible(false), 600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (window.Capacitor?.Plugins?.App?.getLaunchUrl) {
      window.Capacitor.Plugins.App.getLaunchUrl()
        .then((r) => {
          if (r?.value) {
            setUrlInput(r.value);
            const p = parseConnectionUrl(r.value);
            if (p) {
              setConnection(p);
              setCurrentStep(1);
            }
          }
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!window.Capacitor?.Plugins?.App) return;
    const listener = () => {
      if (scannerOpen) {
        setScannerOpen(false);
        return;
      }
      if (currentStep > 0) setCurrentStep((s) => s - 1);
      else window.Capacitor.Plugins.App.exitApp();
    };
    window.Capacitor.Plugins.App.addListener('backButton', listener);
    return () => listener.remove?.();
  }, [scannerOpen, currentStep]);

  const handleScanSuccess = useCallback(
    (urlString) => {
      setUrlInput(urlString);
      const p = parseConnectionUrl(urlString);
      if (p) {
        setConnection(p);
        setConnectStatus({ type: '', message: '' });
        setCurrentStep(1);
      } else {
        setConnectStatus({ type: 'error', message: 'QR did not contain a valid Sewer AI connection URL.' });
      }
      setScannerOpen(false);
    },
    []
  );

  const handleValidateAndNext = () => {
    const c = getConnectionFromInputs();
    if (!c) {
      setConnectStatus({ type: 'error', message: 'Enter a connection URL or both Device ID and Secret.' });
      return;
    }
    setConnection(c);
    setConnectStatus({ type: '', message: '' });
    setCurrentStep(1);
  };

  const loadDevicePreview = useCallback(async () => {
    setDevicePreview({ model: '…', mfr: '…', battery: '…', signal: '…', serial: '…' });
    const [info, battery] = await Promise.all([getDeviceInfo(), getBattery()]);
    const signal = getSignal();
    setDevicePreview({
      model: info.model || 'Unknown',
      mfr: info.manufacturer || 'Unknown',
      battery: battery != null ? `${battery}%` : 'N/A',
      signal: signal || 'Unknown',
      serial: info.serialNumber || 'N/A',
    });
  }, []);

  useEffect(() => {
    if (currentStep === 1) loadDevicePreview();
  }, [currentStep, loadDevicePreview]);

  const handleSendDeviceInfo = async () => {
    if (!conn) {
      setSendStatus({ type: 'error', message: 'Not connected. Go back and connect first.' });
      return;
    }
    setSending(true);
    setSendStatus({ type: 'loading', message: 'Reading device info and sending…' });
    try {
      const [deviceInfo, battery] = await Promise.all([getDeviceInfo(), getBattery()]);
      const signal = getSignal();
      const api = createApiClient(conn);
      const data = await api.ingest({
        battery: battery ?? undefined,
        signal: signal || undefined,
        status: 'active',
        serialNumber: deviceInfo.serialNumber || undefined,
        model: deviceInfo.model || undefined,
        manufacturer: deviceInfo.manufacturer || undefined,
        platform: deviceInfo.platform || undefined,
        osVersion: deviceInfo.osVersion || undefined,
      });
      if (data.success) {
        setSendStatus({ type: 'success', message: 'Device info sent! You can upload a video in the next step.' });
        setTimeout(() => setCurrentStep(2), 1800);
      } else {
        setSendStatus({ type: 'error', message: data.message || data.error || 'Request failed.' });
      }
    } catch (e) {
      setSendStatus({ type: 'error', message: 'Network error: ' + (e.message || 'Ensure device can reach Sewer AI.') });
    } finally {
      setSending(false);
    }
  };

  const handleTakePhotoQR = async () => {
    setConnectStatus({ type: 'loading', message: 'Opening camera…' });
    try {
      const photo = await Camera.getPhoto({
        source: CameraSource.CAMERA,
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
      });
      const dataUrl = photo.dataUrl || (photo.base64String ? 'data:image/jpeg;base64,' + photo.base64String : null) || photo.webPath || photo.path;
      if (!dataUrl) {
        setConnectStatus({ type: 'error', message: 'Could not get photo. Try again.' });
        return;
      }
      setConnectStatus({ type: 'loading', message: 'Reading QR code…' });
      const qrText = await decodeQRFromImageSource(dataUrl, canvasRef);
      if (qrText && (qrText.includes('deviceId=') || qrText.includes('device-connect'))) {
        handleScanSuccess(qrText.trim());
      } else {
        setConnectStatus({ type: 'error', message: 'No Sewer AI QR found in the photo.' });
      }
    } catch (e) {
      if ((e.message || '').toLowerCase().includes('cancel')) {
        setConnectStatus({ type: '', message: '' });
      } else {
        setConnectStatus({ type: 'error', message: 'Camera error: ' + (e.message || 'Allow camera in settings.') });
        if (isPermissionError(e)) setPermissionVisible(true);
      }
    }
  };

  const handleUploadVideo = async () => {
    if (!conn) {
      setUploadStatus({ type: 'error', message: 'Connect the device first (Step 1).' });
      return;
    }
    const file = videoFileRef.current?.files?.[0];
    if (!file) {
      setUploadStatus({ type: 'error', message: 'Please choose a video file first.' });
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    setUploadStatus({ type: 'loading', message: 'Uploading video…' });
    try {
      const api = createApiClient(conn);
      await api.uploadVideo(file, projectIdInput.trim() || null, {
        onProgress: (percent) => setUploadProgress(percent),
      });
      setUploadProgress(100);
      setUploadStatus({ type: 'success', message: 'Video uploaded successfully!' });
      if (videoFileRef.current) videoFileRef.current.value = '';
    } catch (e) {
      setUploadStatus({ type: 'error', message: (e.message || 'Upload failed.') });
    } finally {
      setUploading(false);
    }
  };

  const openAppSettings = () => {
    try {
      const pkg = 'ai.concertina.device';
      const intentUrl = 'intent:#Intent;action=android.settings.APPLICATION_DETAILS_SETTINGS;package=' + pkg + ';end';
      if (window.Capacitor?.Plugins?.App?.openUrl) {
        window.Capacitor.Plugins.App.openUrl({ url: intentUrl }).catch(() => {});
      }
    } catch (_) {}
    setPermissionVisible(false);
  };

  return (
    <>
      <LoadingScreen visible={loadingVisible} />
      <PermissionPrompt
        visible={permissionVisible}
        onOpenSettings={openAppSettings}
        onDismiss={() => setPermissionVisible(false)}
      />
      <ScannerOverlay
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
        onPermissionDenied={() => setPermissionVisible(true)}
      />

      <div className="min-h-screen bg-white pb-10 max-w-[480px] mx-auto">
        <header className="flex items-center gap-3 px-5 pt-5 pb-6 pt-[calc(1.25rem+env(safe-area-inset-top))]">
          <img src={logoSewerAi} alt="Sewer AI" className="h-9 w-auto max-w-[140px] object-contain" />
          <div>
            <h1 className="text-lg font-bold text-gray-900">{import.meta.env.VITE_APP_TITLE || 'Sewer Agent Ai App Device Registration'}</h1>
            <p className="text-xs text-gray-500">Connect & sync your inspection device</p>
          </div>
        </header>

        <div className="mx-5 mb-5 flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-600">
          <span className={`h-2 w-2 rounded-full ${conn ? 'bg-green-500' : 'bg-gray-400'}`} />
          {conn ? 'Connected' : 'Not connected'}
          {conn && <span className="ml-auto truncate text-xs text-gray-500">{conn.deviceId.slice(-8)}…</span>}
        </div>

        <div className="mx-5 mb-5 flex rounded-xl bg-gray-100 p-1">
          {[0, 1, 2].map((step) => (
            <button
              key={step}
              type="button"
              onClick={() => setCurrentStep(step)}
              className={`flex-1 rounded-lg py-2 text-center text-xs font-semibold ${
                currentStep === step
                  ? 'bg-indigo-600 text-white'
                  : step < currentStep
                  ? 'text-green-600'
                  : 'text-gray-500'
              }`}
            >
              {step + 1}. {step === 0 ? 'Connect' : step === 1 ? 'Send Info' : 'Upload'}
            </button>
          ))}
        </div>

        <main className="px-5 space-y-4">
          {currentStep === 0 && (
            <>
              <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <h2 className="mb-3 flex items-center gap-2 font-bold text-gray-900">
                  <span className="rounded-lg bg-indigo-100 p-2 text-base">📷</span>
                  Scan Connection QR
                </h2>
                <p className="mb-4 text-xs text-gray-500">Fastest way — scan the QR from Sewer AI Admin</p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setScannerOpen(true)}
                    className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-4 font-semibold text-white shadow-md hover:bg-indigo-700"
                  >
                    🔍 Open Live Scanner
                  </button>
                  <button
                    type="button"
                    onClick={handleTakePhotoQR}
                    className="flex items-center justify-center gap-2 rounded-xl border-2 border-indigo-500 py-3 font-semibold text-indigo-600 hover:bg-indigo-50"
                  >
                    📸 Take Photo of QR
                  </button>
                </div>
              </section>
              <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <h2 className="mb-3 flex items-center gap-2 font-bold text-gray-900">
                  <span className="rounded-lg bg-blue-100 p-2 text-base">🔗</span>
                  Manual Connection
                </h2>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Connection URL</label>
                    <input
                      type="text"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://…/device-connect?deviceId=…&secret=…"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="h-px flex-1 bg-gray-200" />
                    or enter manually
                    <span className="h-px flex-1 bg-gray-200" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Device ID</label>
                    <input
                      type="text"
                      value={deviceIdInput}
                      onChange={(e) => setDeviceIdInput(e.target.value)}
                      placeholder="Device ID from Sewer AI Admin"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Device Secret</label>
                    <input
                      type="text"
                      value={secretInput}
                      onChange={(e) => setSecretInput(e.target.value)}
                      placeholder="Secret key"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400"
                    />
                  </div>
                  <button type="button" onClick={() => setAdvOpen((o) => !o)} className="text-xs font-semibold text-gray-500">
                    ⚙️ Advanced settings {advOpen ? '▲' : '▼'}
                  </button>
                  {advOpen && (
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">API Base URL (optional)</label>
                      <input
                        type="text"
                        value={apiBaseInput}
                        onChange={(e) => setApiBaseInput(e.target.value)}
                        placeholder="http://192.168.1.1:5000"
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-3 text-sm"
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleValidateAndNext}
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-100 py-3 font-semibold text-gray-800 hover:bg-gray-200"
                  >
                    Continue →
                  </button>
                </div>
                {connectStatus.message && (
                  <div
                    className={`mt-3 rounded-xl border p-3 text-sm ${
                      connectStatus.type === 'error'
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : connectStatus.type === 'loading'
                        ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                        : 'border-green-200 bg-green-50 text-green-700'
                    }`}
                  >
                    {connectStatus.type === 'loading' && <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />}
                    {connectStatus.message}
                  </div>
                )}
              </section>
            </>
          )}

          {currentStep === 1 && (
            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 font-bold text-gray-900">
                <span className="rounded-lg bg-indigo-100 p-2 text-base">📱</span>
                Device Information
              </h2>
              <div className="mb-4 grid grid-cols-2 gap-2">
                {['model', 'mfr', 'battery', 'signal'].map((k) => (
                  <div key={k} className="rounded-xl border border-gray-200 bg-gray-50 p-2.5">
                    <div className="text-[10px] font-semibold uppercase text-gray-500">{k === 'mfr' ? 'Manufacturer' : k}</div>
                    <div className="truncate font-semibold text-gray-900">{devicePreview[k]}</div>
                  </div>
                ))}
                <div className="col-span-2 rounded-xl border border-gray-200 bg-gray-50 p-2.5">
                  <div className="text-[10px] font-semibold uppercase text-gray-500">Serial / ID</div>
                  <div className="truncate font-semibold text-gray-900">{devicePreview.serial}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSendDeviceInfo}
                disabled={sending}
                className="w-full rounded-xl bg-green-600 py-4 font-semibold text-white shadow-md hover:bg-green-700 disabled:opacity-50"
              >
                {sending ? <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : '📤 '}
                Send to Sewer AI
              </button>
              <button type="button" onClick={() => setCurrentStep(0)} className="mt-2 w-full rounded-xl border border-gray-200 py-3 font-semibold text-gray-700">
                ← Back
              </button>
              {sendStatus.message && (
                <div
                  className={`mt-3 rounded-xl border p-3 text-sm ${
                    sendStatus.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : sendStatus.type === 'loading' ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-green-200 bg-green-50 text-green-700'
                  }`}
                >
                  {sendStatus.type === 'loading' && <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />}
                  {sendStatus.message}
                </div>
              )}
            </section>
          )}

          {currentStep === 2 && (
            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 font-bold text-gray-900">
                <span className="rounded-lg bg-green-100 p-2 text-base">🎥</span>
                Upload Inspection Video
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Video File</label>
                  <input
                    ref={videoFileRef}
                    type="file"
                    accept="video/*"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:font-semibold file:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Project ID (optional)</label>
                  <input
                    type="text"
                    value={projectIdInput}
                    onChange={(e) => setProjectIdInput(e.target.value)}
                    placeholder="Project ID to link video"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-3 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleUploadVideo}
                  disabled={uploading}
                  className="w-full rounded-xl bg-indigo-600 py-4 font-semibold text-white shadow-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {uploading ? <span className="mr-2 inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : '⬆️ '}
                  Upload Video
                </button>
                {uploadProgress > 0 && uploading && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                    <div className="h-full bg-indigo-600 transition-[width]" style={{ width: `${uploadProgress}%` }} />
                  </div>
                )}
                <button type="button" onClick={() => setCurrentStep(1)} className="w-full rounded-xl border border-gray-200 py-3 font-semibold text-gray-700">
                  ← Back
                </button>
                {uploadStatus.message && (
                  <div
                    className={`rounded-xl border p-3 text-sm ${
                      uploadStatus.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'
                    }`}
                  >
                    {uploadStatus.message}
                  </div>
                )}
              </div>
            </section>
          )}
        </main>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </>
  );
}
