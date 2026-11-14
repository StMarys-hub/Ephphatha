/**
 * EPHPHATHA DOMAIN LAYER: 12 SALVATION HISTORY ERA MILESTONE RECAPS
 * Generates dignified 1080x1080 commemorative summary cards for each completed Era.
 */

export const PERIOD_MILESTONE_ANCHORS = {
  1: {
    verseRefEn: 'Genesis 1:1',
    verseRefMl: 'ഉൽപത്തി 1:1',
    verseEn: 'In the beginning, God created the heavens and the earth.',
    verseMl: 'ആദിയിൽ ദൈവം ആകാശവും ഭൂമിയും സൃഷ്ടിച്ചു.',
    takeawayEn: 'Out of love God speaks light into chaos, and even after the Fall promises a Redeemer.',
    takeawayMl: 'അന്ധകാരത്തിൽ പ്രകാശം സൃഷ്ടിച്ച ദൈവം പതനത്തിനപ്പുറവും രക്ഷയുടെ വാഗ്ദാനം നൽകുന്നു.'
  },
  2: {
    verseRefEn: 'Genesis 12:2–3',
    verseRefMl: 'ഉൽപത്തി 12:2–3',
    verseEn: 'I will bless you and make your name great, so that you will be a blessing to all families of the earth.',
    verseMl: 'നിന്നെ ഞാൻ അനുഗ്രഹിക്കും; ഭൂമിയിലെ സകല വംശങ്ങളും നിന്നിലൂടെ അനുഗ്രഹിക്കപ്പെടും.',
    takeawayEn: 'Through Abraham, Isaac, Jacob, and Joseph, God weaves one covenant family by faith.',
    takeawayMl: 'അബ്രാഹം, ഇസഹാക്ക്, യാക്കോബ്, ജോസഫ് എന്നിവരിലൂടെ വിശ്വാസത്തിന്റെ ഉടമ്പടി രൂപപ്പെടുന്നു.'
  },
  3: {
    verseRefEn: 'Exodus 19:5–6',
    verseRefMl: 'പുറപ്പാട് 19:5–6',
    verseEn: 'You shall be my treasured possession among all peoples, a kingdom of priests and a holy nation.',
    verseMl: 'നിങ്ങൾ എനിക്ക് പുരോഹിതരാജ്യവും വിശുദ്ധജനവുമായിരിക്കും.',
    takeawayEn: 'Delivered through the Passover Lamb and Red Sea, Israel receives the Law at Sinai.',
    takeawayMl: 'പെസഹാ കുഞ്ഞാടിലൂടെ മോചിതരായ ഇസ്രായേലിന് സീനായിൽ പ്രമാണങ്ങൾ ലഭിക്കുന്നു.'
  },
  4: {
    verseRefEn: 'Numbers 6:24–26',
    verseRefMl: 'സംഖ്യ 6:24–26',
    verseEn: 'The Lord bless you and keep you; the Lord make his face shine upon you and give you peace.',
    verseMl: 'കർത്താവ് നിന്നെ അനുഗ്രഹിക്കുകയും സംരക്ഷിക്കുകയും അവിടുത്തെ പ്രസാദം നിന്നിൽ പ്രകാശിപ്പിക്കുകയും ചെയ്യട്ടെ.',
    takeawayEn: 'Forty years in the wilderness teach humble trust in God’s daily manna and presence.',
    takeawayMl: 'മരുഭൂമിയിലെ നാൽപതു വർഷങ്ങൾ ദൈവത്തിന്റെ പരിപാലനത്തിൽ ആശ്രയിക്കാൻ പഠിപ്പിക്കുന്നു.'
  },
  5: {
    verseRefEn: 'Joshua 24:15',
    verseRefMl: 'ജോഷ്വ 24:15',
    verseEn: 'As for me and my household, we will serve the Lord.',
    verseMl: 'ഞാനും എന്റെ കുടുംബവും കർത്താവിനെ സേവിക്കും.',
    takeawayEn: 'Crossing the Jordan, God proves faithful to every promise made to the Fathers.',
    takeawayMl: 'ജോർദാൻ കടന്ന് വാഗ്ദത്ത ഭൂമിയിൽ പ്രവേശിക്കുമ്പോൾ ദൈവത്തിന്റെ വിശ്വസ്തത വെളിപ്പെടുന്നു.'
  },
  6: {
    verseRefEn: '2 Samuel 7:16',
    verseRefMl: '2 സാമുവൽ 7:16',
    verseEn: 'Your house and your kingdom shall be made sure forever before me; your throne shall stand forever.',
    verseMl: 'നിന്റെ ഭവനവും രാജ്യവും എന്റെ മുമ്പിൽ എന്നേക്കും ഉറപ്പായി നിലനിൽക്കും.',
    takeawayEn: 'Jerusalem becomes the city of the Temple and the everlasting Davidic covenant.',
    takeawayMl: 'ജെറുസലേമും ദാവീദിന്റെ സിംഹാസനവും മിശിഹായുടെ നിത്യരാജ്യത്തിന് നിഴലാകുന്നു.'
  },
  7: {
    verseRefEn: '1 Kings 18:39',
    verseRefMl: '1 രാജാക്കന്മാർ 18:39',
    verseEn: 'The Lord, he is God; the Lord, he is God.',
    verseMl: 'കർത്താവാണ് ദൈവം; കർത്താവുതന്നെയാണ് ദൈവം.',
    takeawayEn: 'Even when the kingdom divides, God raises fearless prophets to call hearts back to Him.',
    takeawayMl: 'രാജ്യം വിഭജിക്കപ്പെട്ടപ്പോഴും പ്രവാചകന്മാരിലൂടെ ദൈവം ജനത്തെ തന്നിലേക്കു വിളിക്കുന്നു.'
  },
  8: {
    verseRefEn: 'Jeremiah 29:11',
    verseRefMl: 'ജെറമിയ 29:11',
    verseEn: 'For I know the plans I have for you, says the Lord, plans for welfare and a future full of hope.',
    verseMl: 'നിങ്ങളെക്കുറിച്ചുള്ള എന്റെ പദ്ധതികൾ ഞാൻ അറിയുന്നു; അവ നിങ്ങൾക്ക് പ്രത്യാശയും ഭാവിയും നൽകാനാണ്.',
    takeawayEn: 'In exile by the rivers of Babylon, suffering purifies worship and deepens hope in God.',
    takeawayMl: 'പ്രവാസത്തിന്റെ കണ്ണീരിലും വിശ്വാസവും പ്രത്യാശയും ശുദ്ധീകരിക്കപ്പെടുന്നു.'
  },
  9: {
    verseRefEn: 'Nehemiah 8:10',
    verseRefMl: 'നെഹെമിയ 8:10',
    verseEn: 'Do not be grieved, for the joy of the Lord is your strength.',
    verseMl: 'ദുഃഖിക്കേണ്ടാ; കർത്താവിൽ ആനന്ദിക്കുക, അതാണ് നിങ്ങളുടെ ശക്തി.',
    takeawayEn: 'A faithful remnant returns to rebuild the altar, walls, and communal reading of Scripture.',
    takeawayMl: 'ബലിപീഠവും നഗരവും വചനപാരായണവും പുനഃസ്ഥാപിച്ച് ദൈവജനം മടങ്ങിവരുന്നു.'
  },
  10: {
    verseRefEn: '1 Maccabees 2:50',
    verseRefMl: '1 മക്കബായർ 2:50',
    verseEn: 'Be zealous for the law, and give your lives for the covenant of our fathers.',
    verseMl: 'നിയമത്തിനുവേണ്ടി തീക്ഷ്ണതയുള്ളവരായിരിക്കുവിൻ; നമ്മുടെ പിതാക്കന്മാരുടെ ഉടമ്പടിക്കായി ജീവൻ അർപ്പിക്കുവിൻ.',
    takeawayEn: 'Against fierce persecution, steadfast fidelity preserves worship and renews the Temple.',
    takeawayMl: 'പീഡനങ്ങൾക്കു നടുവിലും ധീരമായ വിശ്വസ്തതയാൽ ദൈവാലയം പുനർപ്രതിഷ്ഠിക്കപ്പെടുന്നു.'
  },
  11: {
    verseRefEn: 'Mark 7:34',
    verseRefMl: 'മർക്കോസ് 7:34',
    verseEn: 'Looking up to heaven, he sighed and said to him, “Ephphatha,” that is, “Be opened.”',
    verseMl: 'സ്വർഗ്ഗത്തിലേക്കു നോക്കി നെടുവീർപ്പിട്ടുകൊണ്ട് അവൻ അവനോടു പറഞ്ഞു: “എഫ്ഫാത്താ” — തുറക്കപ്പെടുക.',
    takeawayEn: 'All promises find their “Yes” in Jesus Christ—Incarnate Word, Redeemer, and risen Lord.',
    takeawayMl: 'എല്ലാ വാഗ്ദാനങ്ങളും യേശുക്രിസ്തുവിൽ സമ്പൂർണ്ണമാകുന്നു — എഫ്ഫാത്താ!'
  },
  12: {
    verseRefEn: 'Acts 1:8',
    verseRefMl: 'അപ്പ. പ്രവർത്തനങ്ങൾ 1:8',
    verseEn: 'You will receive power when the Holy Spirit has come upon you, and you will be my witnesses to the ends of the earth.',
    verseMl: 'പരിശുദ്ധാത്മാവ് നിങ്ങളുടെമേൽ വരുമ്പോൾ നിങ്ങൾ ശക്തി പ്രാപിക്കുകയും ഭൂമിയുടെ അതിർത്തികൾ വരെ എനിക്ക് സാക്ഷികളാകുകയും ചെയ്യും.',
    takeawayEn: 'Filled with the Spirit, the Apostles bear the Gospel into the world until the New Jerusalem.',
    takeawayMl: 'പരിശുദ്ധാത്മാവിന്റെ ശക്തിയാൽ സഭ ലോകത്തിന്റെ അതിർത്തികൾ വരെ സുവിശേഷം പ്രഘോഷിക്കുന്നു.'
  }
};

/**
 * Computes completion progress metrics for a single Salvation History Period.
 */
export function getPeriodCompletionStats(period, progressMap = {}) {
  if (!period) {
    return {
      periodId: 0,
      dayStart: 1,
      dayEnd: 1,
      totalDays: 0,
      completedDays: 0,
      percent: 0,
      isCompleted: false
    };
  }
  const dayStart = Number(period.day_start) || 1;
  const dayEnd = Number(period.day_end) || dayStart;
  const totalDays = Math.max(1, dayEnd - dayStart + 1);
  let completedDays = 0;
  for (let d = dayStart; d <= dayEnd; d++) {
    if (progressMap[String(d)]?.completed) {
      completedDays++;
    }
  }
  const percent = Math.round((completedDays / totalDays) * 100);
  return {
    periodId: Number(period.id) || 1,
    dayStart,
    dayEnd,
    totalDays,
    completedDays,
    percent,
    isCompleted: completedDays >= totalDays
  };
}

/**
 * Computes summary counts of completed periods across all 12 Eras.
 */
export function getCompletedPeriodsSummary(periods = [], progressMap = {}) {
  const completedIds = [];
  const statsByPeriodId = {};
  for (const period of periods) {
    const st = getPeriodCompletionStats(period, progressMap);
    statsByPeriodId[period.id] = st;
    if (st.isCompleted) {
      completedIds.push(period.id);
    }
  }
  return {
    completedIds,
    completedCount: completedIds.length,
    totalCount: periods.length || 12,
    statsByPeriodId
  };
}

/**
 * Builds respectful plain-text share copy for WhatsApp, clipboard, or system share sheet.
 */
export function buildPeriodRecapShareText({
  period,
  stats = {},
  overallCompletedDays = 0,
  streakDays = 0,
  userName = '',
  langMode = 'bilingual'
}) {
  if (!period) return '';
  const anchor = PERIOD_MILESTONE_ANCHORS[period.id] || PERIOD_MILESTONE_ANCHORS[1];
  const includeEn = langMode === 'bilingual' || langMode === 'en';
  const includeMl = langMode === 'bilingual' || langMode === 'ml';

  const lines = [];
  if (includeEn && includeMl) {
    lines.push(`✦ Ephphatha Bible in a Year — Era ${period.code} of 12 Completed`);
    lines.push(`${period.name} (${period.name_ml})`);
    lines.push(`${period.span} • Days ${period.day_start}–${period.day_end} (${stats.completedDays || stats.totalDays}/${stats.totalDays} Days Complete)`);
    lines.push('');
    lines.push(`"${anchor.verseEn}" — ${anchor.verseRefEn}`);
    lines.push(`"${anchor.verseMl}" — ${anchor.verseRefMl}`);
  } else if (includeMl) {
    lines.push(`✦ എഫ്ഫാത്താ 365 ദിന ബൈബിൾ യാത്ര — ഘട്ടം ${period.code} / 12 പൂർത്തിയായി`);
    lines.push(`${period.name_ml} (${period.span_ml || period.span})`);
    lines.push(`ദിവസം ${period.day_start}–${period.day_end} (${stats.completedDays || stats.totalDays}/${stats.totalDays} ദിവസങ്ങൾ പൂർത്തിയായി)`);
    lines.push('');
    lines.push(`"${anchor.verseMl}" — ${anchor.verseRefMl}`);
  } else {
    lines.push(`✦ Ephphatha Bible in a Year — Era ${period.code} of 12 Completed`);
    lines.push(`${period.name} — ${period.span}`);
    lines.push(`Days ${period.day_start}–${period.day_end} (${stats.completedDays || stats.totalDays}/${stats.totalDays} Days Complete)`);
    lines.push('');
    lines.push(`"${anchor.verseEn}" — ${anchor.verseRefEn}`);
  }

  const totalPct = Math.round(((Number(overallCompletedDays) || 0) / 365) * 100);
  lines.push('');
  lines.push(`Overall Progress: ${overallCompletedDays}/365 Days (${totalPct}%) • ${streakDays}d Grace Streak`);
  if (userName) {
    lines.push(`Completed by ${userName}`);
  }
  lines.push('Ephphatha (“Be Opened” — Mark 7:34)');
  return lines.join('\n');
}

function wrapCanvasLines(ctx, text, maxWidth) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const candidate = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = words[i];
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawRoundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Generates a dignified 1080x1080 PNG commemorative Era Milestone card Blob.
 */
export async function generatePeriodRecapCardBlob({
  period,
  stats = {},
  overallCompletedDays = 0,
  streakDays = 0,
  userName = '',
  langMode = 'bilingual'
}) {
  if (!period) return null;

  const anchor = PERIOD_MILESTONE_ANCHORS[period.id] || PERIOD_MILESTONE_ANCHORS[1];
  const accentHex = period.accent_hex || '#5B8CAE';
  const includeEn = langMode === 'bilingual' || langMode === 'en';
  const includeMl = langMode === 'bilingual' || langMode === 'ml';

  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // 1. Warm Dusk Sanctuary Gradient Background
  const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1080);
  bgGrad.addColorStop(0, '#191F2A');
  bgGrad.addColorStop(0.55, '#202735');
  bgGrad.addColorStop(1, '#262F3F');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1080, 1080);

  // Soft Period Aura Glow at upper center
  const glow = ctx.createRadialGradient(540, 230, 30, 540, 230, 520);
  glow.addColorStop(0, `${accentHex}38`);
  glow.addColorStop(1, 'rgba(25, 31, 42, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1080, 1080);

  // 2. Top Accent Ribbon & Dignified Double Border
  ctx.fillStyle = accentHex;
  ctx.fillRect(0, 0, 1080, 18);

  ctx.strokeStyle = 'rgba(234, 230, 223, 0.18)';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(46, 46, 988, 988);

  ctx.strokeStyle = 'rgba(234, 230, 223, 0.08)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(58, 58, 964, 964);

  // Subtle corner accent ticks
  const corners = [
    [46, 46, 1, 1],
    [1034, 46, -1, 1],
    [46, 1034, 1, -1],
    [1034, 1034, -1, -1]
  ];
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 4;
  for (const [cx, cy, dx, dy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + dy * 36);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + dx * 36, cy);
    ctx.stroke();
  }

  // 3. Eyebrow & Era Milestone Seal Pill
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = '#B8B2A6';
  ctx.font = '700 21px Inter, sans-serif';
  ctx.fillText('EPHPHATHA BIBLE IN A YEAR  •  SALVATION HISTORY MILESTONE', 540, 110);

  const sealText = `ERA ${period.code} OF 12  •  ${stats.isCompleted ? 'COMPLETED' : 'PROGRESS SUMMARY'}`;
  ctx.font = '800 22px Inter, sans-serif';
  const sealWidth = Math.max(360, ctx.measureText(sealText).width + 64);
  const sealX = 540 - sealWidth / 2;
  drawRoundedRectPath(ctx, sealX, 134, sealWidth, 46, 23);
  ctx.fillStyle = `${accentHex}29`;
  ctx.fill();
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#EAE6DF';
  ctx.fillText(sealText, 540, 165);

  // 4. Era Title (English & Malayalam) + Historical Span
  let cursorY = 236;
  if (includeEn) {
    ctx.fillStyle = '#F3EFE7';
    ctx.font = '800 50px Georgia, serif';
    const enTitleLines = wrapCanvasLines(ctx, period.name, 880).slice(0, 2);
    for (const line of enTitleLines) {
      ctx.fillText(line, 540, cursorY);
      cursorY += 56;
    }
    if (includeMl && period.name_ml) {
      ctx.fillStyle = '#E6DEC8';
      ctx.font = '700 32px "SMC Manjari", "Manjari", "SMC Meera", sans-serif';
      const mlTitleLines = wrapCanvasLines(ctx, period.name_ml, 880).slice(0, 1);
      for (const line of mlTitleLines) {
        ctx.fillText(line, 540, cursorY);
        cursorY += 42;
      }
    }
  } else if (includeMl) {
    ctx.fillStyle = '#F3EFE7';
    ctx.font = '800 42px "SMC Manjari", "Manjari", "SMC Meera", sans-serif';
    const mlTitleLines = wrapCanvasLines(ctx, period.name_ml || period.name, 880).slice(0, 2);
    for (const line of mlTitleLines) {
      ctx.fillText(line, 540, cursorY);
      cursorY += 52;
    }
  }

  const spanText = includeMl && !includeEn
    ? `${period.span_ml || period.span}  •  ദിവസം ${period.day_start}–${period.day_end}`
    : `${period.span}  •  Days ${period.day_start}–${period.day_end}  •  ${period.era_date}`;
  ctx.fillStyle = '#B8B2A6';
  ctx.font = includeMl && !includeEn
    ? '600 24px "SMC Manjari", "Manjari", "SMC Meera", sans-serif'
    : '600 23px Inter, sans-serif';
  const spanLines = wrapCanvasLines(ctx, spanText, 880).slice(0, 1);
  if (spanLines[0]) {
    ctx.fillText(spanLines[0], 540, cursorY + 4);
  }

  // 5. Dignified 3-Column Metrics Panel
  const panelY = Math.max(352, cursorY + 26);
  const panelH = 112;
  drawRoundedRectPath(ctx, 96, panelY, 888, panelH, 16);
  ctx.fillStyle = 'rgba(15, 20, 28, 0.46)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(234, 230, 223, 0.14)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const totalPct = Math.round(((Number(overallCompletedDays) || 0) / 365) * 100);
  const metrics = [
    {
      label: includeMl && !includeEn ? 'ഈ ഘട്ടത്തിലെ ദിവസങ്ങൾ' : 'ERA DAYS READ',
      value: `${stats.completedDays ?? stats.totalDays ?? 0} / ${stats.totalDays ?? 0}`
    },
    {
      label: includeMl && !includeEn ? 'വാർഷിക പുരോഗതി' : '365-DAY JOURNEY',
      value: `${overallCompletedDays} / 365 (${totalPct}%)`
    },
    {
      label: includeMl && !includeEn ? 'നിരന്തര ദിനങ്ങൾ' : 'GRACE STREAK',
      value: `${streakDays || 0} ${streakDays === 1 ? 'Day' : 'Days'}`
    }
  ];

  const colWidth = 888 / 3;
  metrics.forEach((m, idx) => {
    const cx = 96 + colWidth * idx + colWidth / 2;
    if (idx > 0) {
      ctx.strokeStyle = 'rgba(234, 230, 223, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(96 + colWidth * idx, panelY + 22);
      ctx.lineTo(96 + colWidth * idx, panelY + panelH - 22);
      ctx.stroke();
    }
    ctx.fillStyle = '#B8B2A6';
    ctx.font = includeMl && !includeEn
      ? '600 18px "SMC Manjari", "Manjari", sans-serif'
      : '700 18px Inter, sans-serif';
    ctx.fillText(m.label, cx, panelY + 40);

    ctx.fillStyle = '#F3EFE7';
    ctx.font = '800 30px Inter, sans-serif';
    ctx.fillText(m.value, cx, panelY + 84);
  });

  // 6. Decorative Cross Divider
  const dividerY = panelY + panelH + 38;
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(220, dividerY);
  ctx.lineTo(500, dividerY);
  ctx.moveTo(580, dividerY);
  ctx.lineTo(860, dividerY);
  ctx.stroke();

  // Small subtle Cross mark in center
  ctx.beginPath();
  ctx.moveTo(540, dividerY - 12);
  ctx.lineTo(540, dividerY + 12);
  ctx.moveTo(528, dividerY);
  ctx.lineTo(552, dividerY);
  ctx.stroke();

  // 7. Anchor Scripture & Salvation Key Recap
  let verseY = dividerY + 48;
  if (includeEn) {
    ctx.fillStyle = '#EAE6DF';
    ctx.font = 'italic 400 32px Georgia, serif';
    const enVerseLines = wrapCanvasLines(ctx, `“${anchor.verseEn}”`, 860).slice(0, 3);
    for (const line of enVerseLines) {
      ctx.fillText(line, 540, verseY);
      verseY += 44;
    }
    ctx.fillStyle = accentHex;
    ctx.font = '700 22px Inter, sans-serif';
    ctx.fillText(`— ${anchor.verseRefEn}`, 540, verseY + 2);
    verseY += 44;
  }

  if (includeMl) {
    ctx.fillStyle = includeEn ? '#E6DEC8' : '#EAE6DF';
    ctx.font = includeEn
      ? '400 28px "SMC Manjari", "Manjari", "SMC Meera", sans-serif'
      : '400 34px "SMC Manjari", "Manjari", "SMC Meera", sans-serif';
    const mlVerseLines = wrapCanvasLines(ctx, `“${anchor.verseMl}”`, 860).slice(0, includeEn ? 2 : 4);
    for (const line of mlVerseLines) {
      ctx.fillText(line, 540, verseY);
      verseY += includeEn ? 40 : 48;
    }
    ctx.fillStyle = accentHex;
    ctx.font = '700 22px "SMC Manjari", "Manjari", "SMC Meera", sans-serif';
    ctx.fillText(`— ${anchor.verseRefMl}`, 540, verseY + 2);
    verseY += 42;
  }

  // Brief Theme / Covenant Lineage summary anchored cleanly above footer
  const takeawayText = includeMl && !includeEn
    ? anchor.takeawayMl
    : `${period.theme}: ${anchor.takeawayEn}`;
  ctx.fillStyle = '#B8B2A6';
  ctx.font = includeMl && !includeEn
    ? '400 22px "SMC Manjari", "Manjari", sans-serif'
    : '400 22px Inter, sans-serif';
  const takeawayLines = wrapCanvasLines(ctx, takeawayText, 840).slice(0, 2);
  let takeawayY = Math.min(868, Math.max(verseY + 12, 818));
  for (const line of takeawayLines) {
    ctx.fillText(line, 540, takeawayY);
    takeawayY += 30;
  }

  // 8. Optional User Dedication & Dignified Footer
  if (userName) {
    ctx.fillStyle = '#E6DEC8';
    ctx.font = '600 22px Inter, sans-serif';
    ctx.fillText(`Completed with faithfulness by ${String(userName).slice(0, 42)}`, 540, 938);
  }

  ctx.fillStyle = '#9C968B';
  ctx.font = '600 21px Inter, sans-serif';
  ctx.fillText('Ephphatha Bible in a Year Sanctuary  •  “Be Opened” (Mark 7:34)', 540, 982);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob || null), 'image/png');
  });
}

/**
 * Triggers a PNG file download of the completed Era Milestone card.
 */
export async function downloadPeriodRecapCard(opts) {
  const blob = await generatePeriodRecapCardBlob(opts);
  if (!blob) return false;
  const safeName = String(opts?.period?.name || 'Era').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
  const code = opts?.period?.code || '01';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Ephphatha_Era_${code}_${safeName}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
  return true;
}
