import React, { useRef, useEffect, useState } from 'react';
import { Camera } from '@capacitor/camera';
import { decodeQRFromImageData } from '../utils/qr';

const CAMERA_LOG = '[Sewer Agent Ai Device Camera]';

function isPermissionError(e) {
  if (!e) return false;
  const msg = (e.message || e.name || '').toLowerCase();
  return (
    msg.includes('permission') ||
    msg.includes('denied') ||
    msg.includes('not allowed') ||
    msg.includes('notallowed')
  );
}

export default function ScannerOverlay({ open, onClose, onScanSuccess, onPermissionDenied }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [status, setStatus] = useState('');
  const streamRef = useRef(null);
  const animRef = useRef(null);
  const [scanLineY, setScanLineY] = useState(0);

  // Animated scan line
  useEffect(() => {
    if (!open) return;
    let frame;
    let y = 0;
    let direction = 1;
    const speed = 1.2;

    const animate = () => {
      y += speed * direction;
      if (y >= 100) direction = -1;
      if (y <= 0) direction = 1;
      setScanLineY(y);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const run = async () => {
      try {
        if (typeof Camera?.requestPermissions === 'function') {
          setStatus('Requesting camera permission…');
          await Camera.requestPermissions({ permissions: ['camera'] });
        }
      } catch (e) {
        if (isPermissionError(e)) onPermissionDenied?.();
      }

      setStatus('Starting camera…');
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        if (isPermissionError(e)) onPermissionDenied?.();
        setStatus('');
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      await video.play();
      setStatus('');

      function tick() {
        if (cancelled || !streamRef.current || !video.videoWidth) {
          animRef.current = requestAnimationFrame(tick);
          return;
        }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(video, -video.videoWidth, 0, video.videoWidth, video.videoHeight);
        ctx.restore();
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = decodeQRFromImageData(imageData.data, imageData.width, imageData.height);
        if (code?.data) {
          const text = (code.data || '').trim();
          if (text && (text.includes('deviceId=') || text.includes('device-connect'))) {
            stream.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
            onScanSuccess?.(text);
            return;
          }
        }
        animRef.current = requestAnimationFrame(tick);
      }
      tick();
    };

    run();
    return () => {
      cancelled = true;
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [open, onScanSuccess, onPermissionDenied]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        background: '#000',
        fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* Camera Feed */}
      <video
        ref={videoRef}
        style={{
          flex: 1,
          width: '100%',
          objectFit: 'cover',
          transform: 'scaleX(-1)',
        }}
        playsInline
        muted
        autoPlay
      />

      {/* Overlay Layer */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
        }}
      >
        {/* Top Bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1.25rem 1.5rem',
            paddingTop: 'calc(1.25rem + env(safe-area-inset-top))',
            background: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 70%, transparent 100%)',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            {/* QR Icon */}
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 20px rgba(99,102,241,0.4)',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="3" height="3" />
                <line x1="21" y1="14" x2="21" y2="14.01" />
                <line x1="21" y1="21" x2="21" y2="21.01" />
                <line x1="17" y1="21" x2="17" y2="21.01" />
              </svg>
            </div>
            <div>
              <div
                style={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: '#fff',
                  letterSpacing: '-0.01em',
                  lineHeight: 1.2,
                }}
              >
                Scan QR Code
              </div>
              <div
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.5)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginTop: 1,
                }}
              >
                Sewer AI Connection
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              border: '1.5px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.08)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              color: '#fff',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Viewfinder */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 260,
            height: 260,
          }}
        >
          {/* Dark overlay around viewfinder */}
          <div
            style={{
              position: 'absolute',
              inset: -9999,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
              borderRadius: 24,
              width: 260,
              height: 260,
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              position: 'relative',
            }}
          />

          {/* Corner brackets */}
          {[
            { top: -2, left: -2, borderTop: '3px solid #818cf8', borderLeft: '3px solid #818cf8', borderRadius: '12px 0 0 0' },
            { top: -2, right: -2, borderTop: '3px solid #818cf8', borderRight: '3px solid #818cf8', borderRadius: '0 12px 0 0' },
            { bottom: -2, left: -2, borderBottom: '3px solid #818cf8', borderLeft: '3px solid #818cf8', borderRadius: '0 0 0 12px' },
            { bottom: -2, right: -2, borderBottom: '3px solid #818cf8', borderRight: '3px solid #818cf8', borderRadius: '0 0 12px 0' },
          ].map((cornerStyle, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: 40,
                height: 40,
                ...cornerStyle,
              }}
            />
          ))}

          {/* Animated scan line */}
          <div
            style={{
              position: 'absolute',
              left: 8,
              right: 8,
              top: `${scanLineY}%`,
              height: 2,
              background: 'linear-gradient(90deg, transparent 0%, #818cf8 20%, #a78bfa 50%, #818cf8 80%, transparent 100%)',
              boxShadow: '0 0 12px 2px rgba(129,140,248,0.5)',
              borderRadius: 2,
              transition: 'none',
            }}
          />

          {/* Subtle glow border */}
          <div
            style={{
              position: 'absolute',
              inset: -1,
              borderRadius: 24,
              border: '1px solid rgba(129,140,248,0.15)',
              boxShadow: 'inset 0 0 30px rgba(129,140,248,0.05)',
            }}
          />
        </div>

        {/* Bottom instruction */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom))',
            textAlign: 'center',
            background: 'linear-gradient(0deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.625rem 1.25rem',
              borderRadius: 100,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#818cf8',
                boxShadow: '0 0 8px rgba(129,140,248,0.6)',
                animation: 'pulse-dot 2s ease-in-out infinite',
              }}
            />
            <span
              style={{
                fontSize: '0.8125rem',
                fontWeight: 500,
                color: 'rgba(255,255,255,0.75)',
                letterSpacing: '0.01em',
              }}
            >
              Point at the Sewer AI connection QR code
            </span>
          </div>
        </div>
      </div>

      {/* Status Toast */}
      {status && (
        <div
          style={{
            position: 'absolute',
            bottom: 120,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            animation: 'fadeSlideUp 0.3s ease-out',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.625rem 1.25rem',
              borderRadius: 14,
              background: 'linear-gradient(135deg, rgba(99,102,241,0.9) 0%, rgba(139,92,246,0.9) 100%)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 8px 32px rgba(99,102,241,0.3)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            {/* Spinner */}
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <span
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: '#fff',
                letterSpacing: '0.01em',
              }}
            >
              {status}
            </span>
          </div>
        </div>
      )}

      {/* Hidden canvas */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Keyframe animations */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}