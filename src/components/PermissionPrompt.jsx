import React from 'react';

export default function PermissionPrompt({ visible, onOpenSettings, onDismiss }) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
      <div className="w-full max-w-[340px] rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
        <h2 className="mb-2 flex items-center gap-2.5 text-lg font-bold text-gray-900">
          <span className="text-2xl">📷</span>
          Camera access needed
        </h2>
        <p className="mb-5 text-sm leading-relaxed text-gray-600">
          This app needs camera permission to scan QR codes and take photos. Please open Settings and
          allow Camera for Sewer Agent Ai App.
        </p>
        <div className="mb-5 rounded-xl bg-gray-100 p-3 text-xs leading-relaxed text-gray-600">
          Settings → Apps → Sewer Agent Ai App → Permissions → turn on <strong>Camera</strong>
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          className="mb-2.5 w-full rounded-xl bg-indigo-600 px-4 py-3.5 text-base font-semibold text-white shadow-md hover:bg-indigo-700"
        >
          Open Settings
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="w-full py-3 text-sm text-gray-500 hover:text-gray-700"
        >
          I'll do it later
        </button>
      </div>
    </div>
  );
}
