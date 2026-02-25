import React from 'react';
import logoSewerAi from '../assets/logo-sewer-ai.svg';

export default function LoadingScreen({ visible }) {
  if (!visible) return null;
  return (
    <div
      className="fixed inset-0 z-[10000] flex flex-col items-center justify-center gap-6 bg-white p-10 transition-opacity duration-400"
      aria-live="polite"
      aria-label="Loading"
    >
      <img
        src={logoSewerAi}
        alt="Sewer AI"
        className="h-12 w-40 object-contain"
        width={180}
        height={48}
      />
      <div
        className="h-10 w-10 rounded-full border-2 border-indigo-200 border-t-indigo-500 animate-spin"
        aria-hidden
      />
      <p className="text-sm font-medium text-gray-500">Opening…</p>
    </div>
  );
}
