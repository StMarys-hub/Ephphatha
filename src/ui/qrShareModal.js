/**
 * EPHPHATHA QR CODE & APP SHARE MODAL CONTROLLER
 * Generates instant client-side QR codes for app installation and sharing.
 * Works 100% offline with zero external network requests.
 */

import qrcode from '../utils/qrCode.js';

let activeShareUrl = '';

export function getAppInstallUrl() {
  if (typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin || '';
    const pathname = window.location.pathname || '/';
    if (origin.startsWith('http')) {
      return `${origin}${pathname}`;
    }
  }
  return 'https://stmarys-hub.github.io/Ephphatha/';
}

/**
 * Generates an SVG string of the QR Code with an embedded central Ephphatha emblem.
 */
export function generateQrSvg(url, options = {}) {
  const ecLevel = options.ecLevel || 'Q'; // Level Q = 25% error correction
  const qr = qrcode(0, ecLevel);
  qr.addData(url);
  qr.make();

  const count = qr.getModuleCount();
  const cellSize = options.cellSize || 9;
  const margin = options.margin !== undefined ? options.margin : 4;
  const totalSize = (count + margin * 2) * cellSize;
  const centerSize = Math.floor(count * 0.24); // center 24% for emblem
  const centerStart = Math.floor((count - centerSize) / 2);
  const centerEnd = centerStart + centerSize;

  let rects = '';
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) {
        // Skip modules under the center emblem so the emblem is completely crisp
        if (r >= centerStart && r < centerEnd && c >= centerStart && c < centerEnd) {
          continue;
        }
        const x = (c + margin) * cellSize;
        const y = (r + margin) * cellSize;
        rects += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="#0F172A" rx="1.5" />`;
      }
    }
  }

  const emblemX = (centerStart + margin) * cellSize;
  const emblemY = (centerStart + margin) * cellSize;
  const emblemDim = centerSize * cellSize;
  const emblemCenter = emblemX + emblemDim / 2;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="100%" height="100%" shape-rendering="geometricPrecision">
      <!-- Clean High-Contrast White Background for 100% Instant Camera Scanning -->
      <rect width="${totalSize}" height="${totalSize}" fill="#FFFFFF" rx="12" />
      <!-- QR Dark Modules -->
      ${rects}
      <!-- Center Ephphatha Alpha & Omega Emblem [ΑΩ] -->
      <g>
        <circle cx="${emblemCenter}" cy="${emblemCenter}" r="${emblemDim * 0.46}" fill="#0F172A" stroke="#F59E0B" stroke-width="2.5" />
        <circle cx="${emblemCenter}" cy="${emblemCenter}" r="${emblemDim * 0.38}" fill="#1E293B" />
        <text x="${emblemCenter}" y="${emblemCenter + emblemDim * 0.15}" font-family="'Crimson Pro', serif" font-size="${emblemDim * 0.38}" font-weight="800" letter-spacing="-0.5" fill="#F59E0B" text-anchor="middle">ΑΩ</text>
      </g>
    </svg>
  `;

  return { svg, count, totalSize };
}

/**
 * Opens the QR Code & Install Share modal sheet.
 */
export function openQrShareModal(targetUrl = '') {
  activeShareUrl = targetUrl || getAppInstallUrl();

  const modal = document.getElementById('qr-share-modal-backdrop');
  const svgWrap = document.getElementById('qr-code-svg-container');
  const inputEl = document.getElementById('input-qr-share-url');

  if (inputEl) {
    inputEl.value = activeShareUrl;
  }

  if (svgWrap) {
    const { svg } = generateQrSvg(activeShareUrl, { cellSize: 9, margin: 4 });
    svgWrap.innerHTML = svg;
  }

  if (modal) {
    modal.classList.remove('hidden');
  }
}

/**
 * Closes the QR Code & Install Share modal sheet.
 */
export function closeQrShareModal() {
  const modal = document.getElementById('qr-share-modal-backdrop');
  if (modal) {
    modal.classList.add('hidden');
  }
}

/**
 * Generates and triggers download of a high-resolution 640x760 printable QR Card PNG.
 */
export async function downloadQrCardPng() {
  const url = activeShareUrl || getAppInstallUrl();
  const width = 640;
  const height = 760;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 1. Deep Sapphire / Midnight Background
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#0F172A');
  grad.addColorStop(0.5, '#1E293B');
  grad.addColorStop(1, '#0B1120');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // 2. Golden Rim Frame
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 3;
  ctx.strokeRect(16, 16, width - 32, height - 32);

  // 3. Header Titles
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 32px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Ephphatha — എഫ്ഫാത്താ', width / 2, 68);

  ctx.fillStyle = '#38BDF8';
  ctx.font = '600 18px -apple-system, system-ui, sans-serif';
  ctx.fillText('Bible in a Year • English & Malayalam Bible', width / 2, 98);

  // 4. White Rounded Card for QR Code
  const qrCardSize = 420;
  const qrCardX = (width - qrCardSize) / 2;
  const qrCardY = 125;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(qrCardX, qrCardY, qrCardSize, qrCardSize, 20);
  ctx.fill();

  // 5. Draw QR Code into Canvas Image
  const { svg } = generateQrSvg(url, { cellSize: 10, margin: 4 });
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const imgUrl = URL.createObjectURL(blob);
  const img = new Image();

  await new Promise((resolve) => {
    img.onload = () => {
      ctx.drawImage(img, qrCardX + 15, qrCardY + 15, qrCardSize - 30, qrCardSize - 30);
      URL.revokeObjectURL(imgUrl);
      resolve();
    };
    img.onerror = () => {
      URL.revokeObjectURL(imgUrl);
      resolve();
    };
    img.src = imgUrl;
  });

  // 6. Action Callouts & Instructions Below QR Code
  ctx.fillStyle = '#FBBF24';
  ctx.font = 'bold 22px -apple-system, system-ui, sans-serif';
  ctx.fillText('📲 Scan with Camera to Install App', width / 2, 580);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '15px -apple-system, system-ui, sans-serif';
  ctx.fillText('1-Tap Home Screen Launch • Full-Screen Reading • Offline Ready', width / 2, 610);

  ctx.fillStyle = '#CBD5E1';
  ctx.font = '14px monospace';
  ctx.fillText(url, width / 2, 642);

  ctx.fillStyle = '#64748B';
  ctx.font = 'italic 13px -apple-system, system-ui, sans-serif';
  ctx.fillText('“Effetha — Be Opened” (Mark 7:34)', width / 2, 695);

  // 7. Trigger Direct Download
  const link = document.createElement('a');
  link.download = 'Ephphatha-Bible-Install-QR.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

/**
 * Initializes all QR Share Modal event listeners.
 */
export function initQrShareModal() {
  document.getElementById('btn-close-qr-modal')?.addEventListener('click', closeQrShareModal);

  document.getElementById('qr-share-modal-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'qr-share-modal-backdrop') {
      closeQrShareModal();
    }
  });

  // 1-Tap Copy Link Button
  const copyBtn = document.getElementById('btn-copy-share-url');
  copyBtn?.addEventListener('click', async () => {
    const url = activeShareUrl || getAppInstallUrl();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const input = document.getElementById('input-qr-share-url');
        if (input) {
          input.select();
          document.execCommand('copy');
        }
      }
      copyBtn.textContent = '✅ Copied!';
      setTimeout(() => {
        copyBtn.textContent = '📋 Copy Link';
      }, 2000);
    } catch (_) {
      copyBtn.textContent = '✅ Copied!';
      setTimeout(() => {
        copyBtn.textContent = '📋 Copy Link';
      }, 2000);
    }
  });

  // Native Web Share or WhatsApp Fallback
  document.getElementById('btn-native-share-app')?.addEventListener('click', async () => {
    const url = activeShareUrl || getAppInstallUrl();
    const shareData = {
      title: 'Ephphatha — Bible in a Year',
      text: 'Read & listen to the Bible in a Year in English & Malayalam Bible. Install Ephphatha directly on your phone:',
      url: url
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (_) {}
    } else {
      // Fallback: Open WhatsApp with pre-filled message
      const msg = encodeURIComponent(`${shareData.text}\n${url}`);
      window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
    }
  });

  // Download QR Code Card as PNG Image
  document.getElementById('btn-download-qr-image')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-download-qr-image');
    if (btn) btn.textContent = '⏳ Rendering...';
    try {
      await downloadQrCardPng();
    } finally {
      if (btn) btn.textContent = '⬇️ Download QR Card';
    }
  });
}
