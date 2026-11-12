/**
 * EPHPHATHA ADAPTER LAYER: YOUTUBE AUDIO ADAPTER (THE BIBLE IN A YEAR - FR. MIKE SCHMITZ)
 * Zero-latency synchronous 365-day dataset mapping Ascension's official 'The Bible in a Year'
 * series with Fr. Mike Schmitz and Jeff Cavins. Provides episode titles, video IDs, YouTube URLs,
 * and official high-fidelity direct audio streams.
 */

import { YOUTUBE_365_MAP } from '../domain/youtubeBibleMap.js';

export class YouTubeAudioAdapter {
  constructor() {
    this.currentDay = 1;
    this.currentVideoId = '';
    this.currentTitle = '';
    this.currentYoutubeUrl = '';
    this.currentAudioUrl = '';

    // Zero-latency synchronous 365-day map
    this.daysMap = YOUTUBE_365_MAP || {};

    this.listeners = new Set();
    this.endedListeners = new Set();

    // Pre-cue Day 1 metadata
    this.syncDayMetadata(1);
  }

  syncDayMetadata(dayNum = 1) {
    const day = Number(dayNum) || 1;
    const vData = this.getDayVideoData(day);
    this.currentDay = day;
    this.currentVideoId = vData.video_id;
    this.currentTitle = vData.title;
    this.currentYoutubeUrl = vData.youtube_url;
    this.currentAudioUrl = vData.audio_url || '';
  }

  getDayVideoData(dayNum = 1) {
    const day = Number(dayNum) || 1;
    const key = String(day);
    if (this.daysMap && this.daysMap[key]) {
      return this.daysMap[key];
    }
    return {
      day,
      title: `Day ${day}: The Bible in a Year (with Fr. Mike Schmitz)`,
      episode_title: `Day ${day}`,
      video_id: 'BW0gXbEVYgA',
      youtube_url: `https://www.youtube.com/watch?v=BW0gXbEVYgA`,
      audio_url: 'https://dts.podtrac.com/redirect.mp3/aphid.fireside.fm/d/1437767933/c6354d0d-bd10-4eed-b811-1bb569d46efd/409047aa-838d-4dbd-8cba-4a8fe412e7c5.mp3'
    };
  }

  updateHostVisibility() {
    // No-op: Native HTML5 Audio handles playback smoothly without iframe blocking
    if (typeof document !== 'undefined') {
      const host = document.getElementById('ephphatha-yt-audio-host');
      if (host) host.style.display = 'none';
    }
  }

  onEnded(fn) {
    this.endedListeners.add(fn);
    return () => this.endedListeners.delete(fn);
  }

  onStateChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    const s = this.getState();
    this.listeners.forEach(fn => {
      try { fn(s); } catch (_) { /* ignore */ }
    });
  }

  getState() {
    return {
      currentDay: this.currentDay,
      currentVideoId: this.currentVideoId,
      currentTitle: this.currentTitle,
      currentYoutubeUrl: this.currentYoutubeUrl,
      currentAudioUrl: this.currentAudioUrl
    };
  }

  cueDay(dayNum = 1) {
    this.syncDayMetadata(dayNum);
    this.emit();
  }

  loadAndPlayDay(dayNum = 1) {
    this.syncDayMetadata(dayNum);
    this.emit();
  }
}
