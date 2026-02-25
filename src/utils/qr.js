export function decodeQRFromImageData(imageData, width, height) {
  if (typeof window.jsQR !== 'function') return null;
  return window.jsQR(imageData, width, height, { inversionAttempts: 'dontInvert' });
}

export function decodeQRFromImageSource(src, canvasRef) {
  return new Promise((resolve) => {
    const canvas = canvasRef?.current;
    if (!canvas) {
      resolve(null);
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve(null);
      return;
    }
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
