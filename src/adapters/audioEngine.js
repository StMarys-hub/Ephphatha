/**
 * EPHPHATHA ADAPTER LAYER: HTTP 206 BYTE-RANGE EDGE AUDIO ENGINE & YOUTUBE BIBLE AUDIO
 * Streams real MP3/M4A audio from Cloudflare Edge Proxy (`https://ephphatha-edge-proxy.jimmymj.workers.dev/audio/<FILE_ID>`)
 * for Malayalam (Google Drive) and official Ascension 'The Bible in a Year' audio for English (YouTube series with Fr. Mike Schmitz)
 * with unified native playback, scrubber progress bar, lockscreen media controls, and speed controls across all 365 days.
 */

import { YouTubeAudioAdapter } from './youtubeAudioAdapter.js';

export function normalizeGoogleDriveAudioId(raw = '') {
  const str = String(raw || '').trim();
  if (!str) return '';

  // 1. If it was corrupted in localStorage as `httpsephphatha-edge-proxy...audio<ID>`
  const corruptedMatch = str.match(/workersdevaudio([a-zA-Z0-9_-]{20,})$/i);
  if (corruptedMatch) return corruptedMatch[1];

  // 2. If it's a full Cloudflare Worker URL: `https://.../audio/<ID>`
  const workerMatch = str.match(/\/audio\/([a-zA-Z0-9_-]{15,})/i);
  if (workerMatch) return workerMatch[1];

  // 3. If it's a Google Drive Share URL: `https://drive.google.com/file/d/<ID>/view`
  const driveMatch = str.match(/\/d\/([a-zA-Z0-9_-]{15,})/);
  if (driveMatch) return driveMatch[1];

  // 4. If it's a Google Drive `?id=<ID>` link
  const idParamMatch = str.match(/[?&]id=([a-zA-Z0-9_-]{15,})/);
  if (idParamMatch) return idParamMatch[1];

  // 5. Raw File ID
  return str.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function formatSecondsAsTime(sec = 0) {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const remS = s % 60;
  return `${String(m).padStart(2, '0')}:${String(remS).padStart(2, '0')}`;
}

export class EphphathaAudioEngine {
  constructor() {
    this.isPlaying = false;
    this.currentDay = 1;
    this.currentTimeSec = 0;
    this.durationSec = 1345;
    this.playbackRate = 1.0;
    this.ambientPadEnabled = false;
    this.prefetchedNextDay = null;
    this.currentFileId = '';
    this.usingEdgeStream = false;
    this.triedLocalProxyFallback = false;
    this.pendingSavedSeekSec = 0;
    this.edgeProxyBaseUrl = (typeof localStorage !== 'undefined' && localStorage.getItem('ephphatha_edge_proxy_url')) || 'https://ephphatha-edge-proxy.jimmymj.workers.dev';
    this.lastLoadedSchedule = null;

    // Active Audio Language: 'ml' (Google Drive) | 'en' (YouTube Fr. Mike Schmitz)
    this.activeAudioSource = (typeof localStorage !== 'undefined' && localStorage.getItem('ephphatha_audio_lang')) || 'ml';

    // YouTube Audio Adapter for English dataset and metadata
    this.youtubeAdapter = new YouTubeAudioAdapter();

    // Unified HTML5 Audio element for seamless HTTP 206 byte-range streaming for BOTH ML and EN
    this.htmlAudio = typeof Audio !== 'undefined' ? new Audio() : { addEventListener: () => {} };
    if (this.htmlAudio.preload) this.htmlAudio.preload = 'metadata';

    if (typeof this.htmlAudio.addEventListener === 'function') {
      this.htmlAudio.addEventListener('loadedmetadata', () => {
      if (this.htmlAudio.duration && isFinite(this.htmlAudio.duration)) {
        this.durationSec = Math.floor(this.htmlAudio.duration);
      }
      if (this.pendingSavedSeekSec > 0 && this.pendingSavedSeekSec < this.durationSec - 5) {
        try {
          this.htmlAudio.currentTime = this.pendingSavedSeekSec;
          this.currentTimeSec = this.pendingSavedSeekSec;
        } catch (_) { /* ignore */ }
        this.pendingSavedSeekSec = 0;
      }
      this.emit();
    });

    this.htmlAudio.addEventListener('timeupdate', () => {
      if (this.usingEdgeStream) {
        this.currentTimeSec = this.htmlAudio.currentTime;
        this.emit();
      }
    });

    this.htmlAudio.addEventListener('ended', () => {
      this.triggerTrackEnded();
    });

    this.htmlAudio.addEventListener('error', (e) => {
      console.warn('[Ephphatha Audio Stream Error]', e);
      // If direct Edge Worker URL encountered an issue for ML, try local `/audio/<ID>` proxy before falling back
      if (this.activeAudioSource === 'ml' && this.usingEdgeStream && !this.triedLocalProxyFallback && this.currentFileId) {
        this.triedLocalProxyFallback = true;
        this.htmlAudio.src = `/audio/${encodeURIComponent(this.currentFileId)}`;
        if (this.isPlaying) {
          this.htmlAudio.play().catch(() => {
            this.usingEdgeStream = false;
          });
        }
        return;
      }
      this.usingEdgeStream = false;
      this.emit();
    });
    }

    this.audioCtx = null;
    this.gainNode = null;
    this.oscillators = [];
    this.tickInterval = null;
    this.listeners = new Set();
    this.endedListeners = new Set();
  }

  setAudioSource(lang = 'ml') {
    const nextLang = lang === 'en' ? 'en' : 'ml';
    if (this.activeAudioSource === nextLang) return;

    const wasPlaying = this.isPlaying;
    this.pause();
    this.activeAudioSource = nextLang;
    try {
      localStorage.setItem('ephphatha_audio_lang', nextLang);
    } catch (_) { /* ignore */ }

    if (this.lastLoadedSchedule) {
      this.loadDayAudio(this.lastLoadedSchedule, this.currentTimeSec, wasPlaying);
    } else {
      this.emit();
    }
  }

  onEnded(fn) {
    this.endedListeners.add(fn);
    return () => this.endedListeners.delete(fn);
  }

  triggerTrackEnded() {
    const finishedDay = this.currentDay;
    this.pause();
    this.endedListeners.forEach(fn => {
      try { fn(finishedDay); } catch (_) { /* ignore */ }
    });
  }

  onStateChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    const state = this.getState();
    this.listeners.forEach(fn => {
      try { fn(state); } catch (_) { /* ignore */ }
    });
  }

  setEdgeProxyUrl(url) {
    this.edgeProxyBaseUrl = String(url || '').replace(/\/+$/, '');
    try {
      localStorage.setItem('ephphatha_edge_proxy_url', this.edgeProxyBaseUrl);
    } catch (_) { /* ignore */ }
    this.emit();
  }

  getState() {
    const isEn = this.activeAudioSource === 'en';
    const ytData = this.youtubeAdapter ? this.youtubeAdapter.getDayVideoData(this.currentDay) : null;

    return {
      isPlaying: this.isPlaying,
      currentDay: this.currentDay,
      currentTimeSec: this.currentTimeSec,
      durationSec: this.durationSec,
      playbackRate: this.playbackRate,
      ambientPadEnabled: this.ambientPadEnabled,
      prefetchedNextDay: this.prefetchedNextDay,
      usingEdgeStream: this.usingEdgeStream,
      edgeProxyBaseUrl: this.edgeProxyBaseUrl,
      currentFileId: this.currentFileId,
      activeAudioSource: this.activeAudioSource,
      youtubeVideoId: ytData?.video_id || '',
      youtubeTitle: ytData?.title || '',
      youtubeUrl: ytData?.youtube_url || '',
      http206HeaderStatus: isEn
        ? `🔴 EN • Fr. Mike Schmitz (The Bible in a Year)`
        : (this.usingEdgeStream
          ? `🟢 Google Drive HTTP 206 Stream (${this.currentFileId.slice(0, 8)}...)`
          : `HTTP 206 • Day ${this.prefetchedNextDay || 2} Pre-Cached`)
    };
  }

  loadDayAudio(daySchedule, savedTimestampSec = 0, autoPlay = false) {
    const wasPlaying = this.isPlaying || autoPlay;
    if (this.isPlaying && !wasPlaying) this.pause();

    this.lastLoadedSchedule = daySchedule;
    this.currentDay = daySchedule.day_number;
    this.prefetchedNextDay = Math.min(365, this.currentDay + 1);

    if (this.activeAudioSource === 'en') {
      const enData = this.youtubeAdapter.getDayVideoData(this.currentDay);
      this.durationSec = daySchedule.audio_duration_sec || 1345;
      this.currentTimeSec = Math.min(savedTimestampSec || 0, this.durationSec - 5);
      this.pendingSavedSeekSec = this.currentTimeSec;
      this.usingEdgeStream = true;

      const audioUrl = enData.audio_url;
      if (this.htmlAudio.src !== audioUrl) {
        this.htmlAudio.src = audioUrl;
        this.htmlAudio.load();
      }
      this.htmlAudio.playbackRate = this.playbackRate;

      this.setupMediaSession(daySchedule);
      if (wasPlaying) {
        this.play();
      }
      this.emit();
      return;
    }

    // Malayalam Google Drive Loading
    this.durationSec = daySchedule.audio_duration_sec || 1345;
    this.currentTimeSec = Math.min(savedTimestampSec || 0, this.durationSec - 5);
    this.pendingSavedSeekSec = this.currentTimeSec;
    this.currentFileId = normalizeGoogleDriveAudioId(daySchedule.gdrive_audio_file_id || '');
    this.triedLocalProxyFallback = false;

    const isRealDriveId = Boolean(this.currentFileId && !this.currentFileId.startsWith('1Ephphatha_Day_'));
    if (isRealDriveId && this.edgeProxyBaseUrl) {
      this.usingEdgeStream = true;
      const streamUrl = `${this.edgeProxyBaseUrl}/audio/${encodeURIComponent(this.currentFileId)}`;
      if (this.htmlAudio.src !== streamUrl) {
        this.htmlAudio.src = streamUrl;
        this.htmlAudio.load();
      }
      this.htmlAudio.playbackRate = this.playbackRate;
    } else {
      this.usingEdgeStream = false;
    }

    this.setupMediaSession(daySchedule);
    if (wasPlaying) {
      this.play();
    }
    this.emit();
  }

  setupMediaSession(daySchedule) {
    if ('mediaSession' in navigator && window.MediaMetadata) {
      try {
        const isEn = this.activeAudioSource === 'en';
        const ytData = isEn && this.youtubeAdapter ? this.youtubeAdapter.getDayVideoData(this.currentDay) : null;

        navigator.mediaSession.metadata = new MediaMetadata({
          title: isEn
            ? (ytData?.title || `Day ${daySchedule.day_number}: The Bible in a Year`)
            : `Day ${daySchedule.day_number}: ${daySchedule.episode_title}`,
          artist: isEn
            ? 'Fr. Mike Schmitz & Jeff Cavins • Ascension'
            : `Ephphatha • Period ${daySchedule.period?.code || ''} (${daySchedule.period?.name || ''})`,
          album: isEn
            ? 'The Bible in a Year (Ascension)'
            : 'Ephphatha: Bible in a Year (Salvation History)'
        });
        navigator.mediaSession.setActionHandler('play', () => this.play());
        navigator.mediaSession.setActionHandler('pause', () => this.pause());
        navigator.mediaSession.setActionHandler('seekbackward', () => this.skip(-15));
        navigator.mediaSession.setActionHandler('seekforward', () => this.skip(15));
      } catch (_) { /* ignore */ }
    }
  }

  startAmbientSanctuaryPad() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      this.stopAmbientSanctuaryPad();

      const masterGain = this.audioCtx.createGain();
      masterGain.gain.setValueAtTime(0.001, this.audioCtx.currentTime);
      masterGain.gain.exponentialRampToValueAtTime(0.035, this.audioCtx.currentTime + 1.2);
      masterGain.connect(this.audioCtx.destination);
      this.gainNode = masterGain;

      const freqs = [146.83, 220.0, 293.66, 369.99];
      this.oscillators = freqs.map((freq, idx) => {
        const osc = this.audioCtx.createOscillator();
        const oscGain = this.audioCtx.createGain();
        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
        oscGain.gain.setValueAtTime(idx === 0 ? 0.45 : 0.2, this.audioCtx.currentTime);
        osc.connect(oscGain);
        oscGain.connect(masterGain);
        osc.start();
        return osc;
      });
    } catch (_) { /* ignore */ }
  }

  stopAmbientSanctuaryPad() {
    try {
      if (this.gainNode && this.audioCtx) {
        this.gainNode.gain.setValueAtTime(0.0001, this.audioCtx.currentTime);
      }
      this.oscillators.forEach(osc => {
        try { osc.stop(); osc.disconnect(); } catch (_) { /* ignore */ }
      });
      this.oscillators = [];
    } catch (_) { /* ignore */ }
  }

  async play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.stopAmbientSanctuaryPad();

    if (this.usingEdgeStream && this.htmlAudio.src) {
      try {
        await this.htmlAudio.play();
        this.emit();
        return;
      } catch (err) {
        console.warn('[Ephphatha Audio] Play error:', err);
        // Try local `/audio/<ID>` proxy fallback for ML before falling back to synth
        if (this.activeAudioSource === 'ml' && !this.triedLocalProxyFallback && this.currentFileId) {
          this.triedLocalProxyFallback = true;
          try {
            this.htmlAudio.src = `/audio/${encodeURIComponent(this.currentFileId)}`;
            await this.htmlAudio.play();
            this.emit();
            return;
          } catch (_) { /* fallback below */ }
        }
        this.usingEdgeStream = false;
      }
    }

    this.startAmbientSanctuaryPad();
    if (this.tickInterval) clearInterval(this.tickInterval);
    this.tickInterval = setInterval(() => {
      this.currentTimeSec = Math.min(this.durationSec, this.currentTimeSec + (0.5 * this.playbackRate));
      if (this.currentTimeSec >= this.durationSec) {
        this.triggerTrackEnded();
      }
      this.emit();
    }, 500);

    this.emit();
  }

  pause() {
    this.isPlaying = false;
    try { this.htmlAudio.pause(); } catch (_) { /* ignore */ }
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    this.stopAmbientSanctuaryPad();
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    this.emit();
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  skip(deltaSec) {
    this.seekTo(this.currentTimeSec + deltaSec);
  }

  seekTo(targetSec) {
    this.currentTimeSec = Math.max(0, Math.min(this.durationSec, Number(targetSec) || 0));
    try {
      this.htmlAudio.currentTime = this.currentTimeSec;
    } catch (_) { /* ignore */ }
    this.emit();
  }

  cyclePlaybackRate() {
    const rates = [0.85, 1.0, 1.15, 1.25, 1.5];
    const idx = rates.indexOf(this.playbackRate);
    this.playbackRate = rates[(idx + 1) % rates.length];
    try {
      this.htmlAudio.playbackRate = this.playbackRate;
    } catch (_) { /* ignore */ }
    this.emit();
    return this.playbackRate;
  }

  setPlaybackRate(rate) {
    this.playbackRate = Number(rate) || 1.0;
    try {
      this.htmlAudio.playbackRate = this.playbackRate;
    } catch (_) { /* ignore */ }
    this.emit();
  }

  speakVerseAloud(text, lang = 'en-US') {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = this.playbackRate || 1.0;
    window.speechSynthesis.speak(utterance);
  }
}
