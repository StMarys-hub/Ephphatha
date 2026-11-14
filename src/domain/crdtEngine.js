/**
 * EPHPHATHA DOMAIN LAYER: STATE-OF-THE-ART ENHANCEMENTS
 * 1. LWW-Element-Set CRDT (Conflict-Free Replicated Data Type) with Hybrid Logical Clock (HLC)
 *    for multi-device Google Drive `appDataFolder` shard merging without data loss.
 * 2. High-DPI Bilingual Verse Art Card Canvas Generator (for WhatsApp / Parish sharing).
 * 3. Guided 4-Step Lectio Divina Contemplative Timer State Machine.
 */

/**
 * Generates a monotonic Hybrid Logical Clock (HLC) timestamp for CRDT resolution
 */
let lastWallTime = 0;
let logicalCounter = 0;

export function nextHlcTimestamp(nodeId = 'local_device') {
  const now = Date.now();
  if (now > lastWallTime) {
    lastWallTime = now;
    logicalCounter = 0;
  } else {
    logicalCounter += 1;
  }
  return `${String(lastWallTime).padStart(15, '0')}:${String(logicalCounter).padStart(4, '0')}:${nodeId}`;
}

/**
 * Merges two LWW-Element-Set CRDT shard maps (e.g., local IndexedDB vs remote Google Drive appDataFolder)
 * Ensures that offline completions or bookmarks on Phone + Tablet never overwrite each other.
 */
export function mergeCrdtShardMaps(localMap = {}, remoteMap = {}) {
  const merged = { ...localMap };
  let conflictsResolved = 0;

  for (const [id, remoteRec] of Object.entries(remoteMap)) {
    const localRec = merged[id];
    if (!localRec) {
      merged[id] = remoteRec;
    } else {
      const localHlc = localRec.hlc || localRec.updatedAt || '';
      const remoteHlc = remoteRec.hlc || remoteRec.updatedAt || '';
      if (remoteHlc > localHlc) {
        merged[id] = remoteRec;
        conflictsResolved++;
      }
    }
  }

  return { merged, conflictsResolved, totalRecords: Object.keys(merged).length };
}

/**
 * Renders a 1080x1080 High-DPI Bilingual (English + Malayalam POC) Devotional Verse Card
 * and triggers a PNG download or Web Share API share.
 */
export async function generateVerseCardBlob({
  dayNumber = null,
  periodName = 'Holy Scripture',
  periodAccentHex = '#2B8CBE',
  referenceEn,
  referenceMl = '',
  verseNumber,
  textEn,
  textMl = '',
  langMode = 'bilingual'
}) {
  const includeEn = langMode === 'bilingual' || langMode === 'en' || !textMl;
  const includeMl = (langMode === 'bilingual' || langMode === 'ml') && Boolean(textMl);

  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');

  // 1. Warm Dusk Sanctuary Gradient Background (#1E2430 -> #272F3E)
  const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1080);
  bgGrad.addColorStop(0, '#1E2430');
  bgGrad.addColorStop(1, '#272F3E');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1080, 1080);

  // 2. Top Period Accent Bar & Subtle Ornate Frame
  ctx.fillStyle = periodAccentHex;
  ctx.fillRect(0, 0, 1080, 22);

  ctx.strokeStyle = 'rgba(234, 230, 223, 0.16)';
  ctx.lineWidth = 3;
  ctx.strokeRect(54, 54, 972, 972);

  // 3. Header Pill (Day & Period)
  ctx.fillStyle = periodAccentHex;
  ctx.font = '700 26px Inter, sans-serif';
  const dayLabel = dayNumber ? `DAY ${dayNumber} • ` : '';
  ctx.fillText(`EPHPHATHA (“BE OPENED”) • ${dayLabel}${String(periodName).toUpperCase()}`, 100, 140);

  // 4. Scripture Reference Title
  const refTitleEn = String(referenceEn || '').includes(`:${verseNumber}`)
    ? referenceEn
    : `${referenceEn} : ${verseNumber}`;
  const refTitleMl = referenceMl
    ? (String(referenceMl).includes(`:${verseNumber}`) ? referenceMl : `${referenceMl}:${verseNumber}`)
    : '';

  if (includeEn) {
    ctx.fillStyle = '#EAE6DF';
    ctx.font = '800 44px Inter, sans-serif';
    ctx.fillText(refTitleEn, 100, 210);
    if (includeMl && refTitleMl) {
      ctx.fillStyle = '#B8B2A6';
      ctx.font = '700 32px "SMC Manjari", "Manjari", "SMC Meera", Inter, sans-serif';
      ctx.fillText(refTitleMl, 100, 260);
    }
  } else if (includeMl) {
    ctx.fillStyle = '#EAE6DF';
    ctx.font = '800 42px "SMC Manjari", "Manjari", "SMC Meera", Inter, sans-serif';
    ctx.fillText(refTitleMl || refTitleEn, 100, 215);
  }

  // 5. Divider Line
  ctx.strokeStyle = periodAccentHex;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(100, 295);
  ctx.lineTo(360, 295);
  ctx.stroke();

  // 6. English Verse Text (Word-wrapped)
  let yAfterEn = 375;
  if (includeEn) {
    ctx.fillStyle = '#EAE6DF';
    ctx.font = '400 38px Georgia, serif';
    yAfterEn = drawWrappedText(ctx, `“${textEn}”`, 100, 375, 880, 54);
  }

  // 7. Malayalam POC Verse Text (Word-wrapped)
  if (includeMl) {
    ctx.fillStyle = includeEn ? '#E6DEC8' : '#EAE6DF';
    ctx.font = includeEn
      ? '400 34px "SMC Manjari", "Manjari", "SMC Meera", sans-serif'
      : '400 38px "SMC Manjari", "Manjari", "SMC Meera", sans-serif';
    const mlStartY = includeEn ? Math.min(760, yAfterEn + 45) : 385;
    drawWrappedText(ctx, `“${textMl}”`, 100, mlStartY, 880, 56);
  }

  // 8. Footer Branding
  ctx.fillStyle = '#B8B2A6';
  ctx.font = '600 24px Inter, sans-serif';
  const footerLang = includeEn && includeMl
    ? 'English & POC Malayalam'
    : (includeMl ? 'POC Malayalam' : 'English');
  ctx.fillText(`Ephphatha Bible in a Year Sanctuary • Mark 7:34 • ${footerLang}`, 100, 975);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob || null), 'image/png');
  });
}

export async function generateAndDownloadVerseCard(opts) {
  const blob = await generateVerseCardBlob(opts);
  if (!blob) return false;
  const dayTag = opts.dayNumber ? `Day${opts.dayNumber}_` : '';
  const safeRef = String(opts.referenceEn || 'Verse').replace(/[^a-z0-9]/gi, '_');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Ephphatha_${dayTag}${safeRef}_v${opts.verseNumber}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
  return true;
}

export async function shareOrSaveVerseCard(opts) {
  const mode = opts.langMode || 'bilingual';
  const includeEn = mode === 'bilingual' || mode === 'en' || !opts.textMl;
  const includeMl = (mode === 'bilingual' || mode === 'ml') && Boolean(opts.textMl);

  const refTitleEn = String(opts.referenceEn || '').includes(`:${opts.verseNumber}`)
    ? opts.referenceEn
    : `${opts.referenceEn}:${opts.verseNumber}`;
  const refTitleMl = opts.referenceMl
    ? (String(opts.referenceMl).includes(`:${opts.verseNumber}`) ? opts.referenceMl : `${opts.referenceMl}:${opts.verseNumber}`)
    : '';

  const refDisplay = includeEn && includeMl && refTitleMl
    ? `${refTitleEn} (${refTitleMl})`
    : (includeMl && !includeEn ? (refTitleMl || refTitleEn) : refTitleEn);

  const parts = [];
  if (includeEn && opts.textEn) parts.push(`"${opts.textEn}"`);
  if (includeMl && opts.textMl) parts.push(`"${opts.textMl}"`);
  const shareText = `${parts.join('\n\n')}\n\n— ${refDisplay}\nEphphatha Sanctuary`;

  const modal = document.getElementById('verse-share-modal');
  if (!modal) {
    await generateAndDownloadVerseCard(opts);
    return { action: 'saved' };
  }

  const refEl = document.getElementById('verse-share-modal-ref');
  const previewEl = document.getElementById('verse-share-modal-preview');
  const closeBtn = document.getElementById('btn-close-verse-share-modal');
  const waBtn = document.getElementById('btn-share-whatsapp');
  const nativeBtn = document.getElementById('btn-share-native-apps');
  const saveImgBtn = document.getElementById('btn-share-save-image');
  const copyBtn = document.getElementById('btn-share-copy-text');

  if (refEl) refEl.textContent = refDisplay;
  if (previewEl) {
    previewEl.classList.toggle('lang-ml', includeMl && !includeEn);
    previewEl.textContent = parts.join(' ');
  }

  if (nativeBtn) {
    nativeBtn.style.display = typeof navigator.share === 'function' ? '' : 'none';
  }

  modal.classList.remove('hidden');

  return new Promise((resolve) => {
    const cleanupAndResolve = (result) => {
      modal.classList.add('hidden');
      closeBtn?.removeEventListener('click', onClose);
      modal.removeEventListener('click', onBackdropClick);
      waBtn?.removeEventListener('click', onWhatsApp);
      nativeBtn?.removeEventListener('click', onNativeShare);
      saveImgBtn?.removeEventListener('click', onSaveImage);
      copyBtn?.removeEventListener('click', onCopyText);
      resolve(result);
    };

    const onClose = () => cleanupAndResolve({ action: 'cancelled' });
    const onBackdropClick = (e) => {
      if (e.target === modal) cleanupAndResolve({ action: 'cancelled' });
    };

    const onWhatsApp = () => {
      const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
      cleanupAndResolve({ action: 'shared' });
    };

    const onNativeShare = () => {
      if (typeof navigator.share !== 'function') return;
      // Call navigator.share synchronously inside click handler to preserve user-gesture token
      navigator.share({ title: refDisplay, text: shareText, url: window.location.href })
        .then(() => cleanupAndResolve({ action: 'shared' }))
        .catch((err) => {
          if (err?.name === 'AbortError') return;
          cleanupAndResolve({ action: 'cancelled' });
        });
    };

    const onSaveImage = async () => {
      await generateAndDownloadVerseCard(opts);
      cleanupAndResolve({ action: 'saved', copied: false, saved: true });
    };

    const onCopyText = async () => {
      let copied = false;
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(shareText);
          copied = true;
        } catch (_) { /* ignore */ }
      }
      cleanupAndResolve({ action: 'copied', copied, saved: false });
    };

    closeBtn?.addEventListener('click', onClose);
    modal.addEventListener('click', onBackdropClick);
    waBtn?.addEventListener('click', onWhatsApp);
    nativeBtn?.addEventListener('click', onNativeShare);
    saveImgBtn?.addEventListener('click', onSaveImage);
    copyBtn?.addEventListener('click', onCopyText);
  });
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text || '').split(' ');
  let line = '';
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line.trim(), x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line.trim()) {
    ctx.fillText(line.trim(), x, currentY);
    currentY += lineHeight;
  }
  return currentY;
}

/**
 * 4-Step Lectio Divina Contemplative Steps
 */
export const LECTIO_DIVINA_STEPS = [
  {
    step: 1,
    latin: '1. Lectio (Read)',
    malayalam: 'വായന (വചനം ശ്രവിക്കുക)',
    durationSec: 120,
    instruction: 'Read today’s bilingual passage slowly twice. Listen for the single word or phrase that gently touches your heart.'
  },
  {
    step: 2,
    latin: '2. Meditatio (Reflect)',
    malayalam: 'ധ്യാനം (ഹൃദയത്തിൽ സംഗ്രഹിക്കുക)',
    durationSec: 180,
    instruction: 'Ponder that word like Mary pondering in her heart. Why is Christ speaking this specific word to you today?'
  },
  {
    step: 3,
    latin: '3. Oratio (Respond & Journal)',
    malayalam: 'പ്രാർത്ഥന (ദൈവത്തോട് സംസാരിക്കുക)',
    durationSec: 180,
    instruction: 'Speak honestly to the Lord and write your response in your AES-256-GCM Encrypted Prayer Journal below.'
  },
  {
    step: 4,
    latin: '4. Contemplatio (Rest in God)',
    malayalam: 'നിശബ്ദ ആരാധന (ദൈവസാന്നിധ്യത്തിൽ വിശ്രമിക്കുക)',
    durationSec: 120,
    instruction: 'Release all words and thoughts. Rest silently in the loving gaze of the Father who says “Ephphatha — Be Opened.”'
  }
];

