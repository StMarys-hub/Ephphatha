/**
 * EPHPHATHA ADAPTER LAYER: YOUTUBE AUDIO ADAPTER (THE BIBLE IN A YEAR - FR. MIKE SCHMITZ)
 * Zero-latency in-memory mapping for all 365 daily episodes with seamless continuous playback,
 * visible in-viewport mini-dock player for full browser autoplay compliance, and instant day transitions.
 */

import { YOUTUBE_365_MAP } from '../domain/youtubeBibleMap.js';

export class YouTubeAudioAdapter {
  constructor() {
    this.player = null;
    this.isApiLoaded = false;
    this.isPlayerReady = false;
    this.isPlaying = false;
    this.isTransitioning = false;
    this.transitionTimer = null;

    this.currentDay = 1;
    this.currentVideoId = '';
    this.loadedVideoId = '';
    this.currentTitle = '';
    this.currentYoutubeUrl = '';
    this.currentTimeSec = 0;
    this.durationSec = 1345;
    this.playbackRate = 1.0;
    this.pendingAutoPlay = false;

    // Zero-latency synchronous 365-day map
    this.daysMap = YOUTUBE_365_MAP || {};

    this.listeners = new Set();
    this.endedListeners = new Set();
    this.ticker = null;

    // Pre-cue Day 1 metadata
    this.syncDayMetadata(1);

    this.initYouTubeApi();
  }

  syncDayMetadata(dayNum = 1) {
    const day = Number(dayNum) || 1;
    const vData = this.getDayVideoData(day);
    this.currentDay = day;
    this.currentVideoId = vData.video_id;
    this.currentTitle = vData.title;
    this.currentYoutubeUrl = vData.youtube_url;
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
      youtube_url: `https://www.youtube.com/watch?v=BW0gXbEVYgA`
    };
  }

  updateHostVisibility(activeSource = 'ml') {
    if (typeof document === 'undefined') return;
    const host = document.getElementById('ephphatha-yt-audio-host');
    if (!host) return;
    const isEn = activeSource === 'en';
    host.style.display = isEn ? 'block' : 'none';
  }

  initYouTubeApi() {
    if (typeof window === 'undefined') return;

    let host = document.getElementById('ephphatha-yt-audio-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'ephphatha-yt-audio-host';
      host.setAttribute('aria-hidden', 'true');
      host.style.position = 'fixed';
      host.style.bottom = '84px';
      host.style.right = '12px';
      host.style.width = '200px';
      host.style.height = '112px';
      host.style.borderRadius = '8px';
      host.style.boxShadow = '0 4px 16px rgba(0,0,0,0.5)';
      host.style.zIndex = '95';
      host.style.background = '#000';
      host.style.overflow = 'hidden';
      host.style.display = 'none';
      document.body.appendChild(host);
    }

    const onApiReady = () => {
      this.isApiLoaded = true;
      try {
        this.player = new window.YT.Player('ephphatha-yt-audio-host', {
          height: '112',
          width: '200',
          videoId: this.currentVideoId || 'BW0gXbEVYgA',
          playerVars: {
            autoplay: 0,
            controls: 1,
            disablekb: 0,
            fs: 1,
            playsinline: 1,
            rel: 0,
            modestbranding: 1
          },
          events: {
            onReady: () => {
              this.isPlayerReady = true;
              this.loadedVideoId = this.currentVideoId;
              try { this.player.unMute(); this.player.setVolume(100); } catch (_) {}
              if (this.playbackRate !== 1.0) {
                try { this.player.setPlaybackRate(this.playbackRate); } catch (_) {}
              }
              if (this.pendingAutoPlay && this.currentVideoId) {
                this.pendingAutoPlay = false;
                this.loadAndPlayDay(this.currentDay, 0);
              }
              this.emit();
            },
            onStateChange: (event) => {
              this.handleStateChange(event.data);
            },
            onError: (err) => {
              console.warn('[Ephphatha YouTube Player Error]', err);
              this.emit();
            }
          }
        });
      } catch (e) {
        console.warn('[Ephphatha YouTube] Failed to initialize YT.Player', e);
      }
    };

    if (window.YT && window.YT.Player) {
      onApiReady();
    } else {
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof prevCallback === 'function') prevCallback();
        onApiReady();
      };

      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScript = document.getElementsByTagName('script')[0];
        if (firstScript && firstScript.parentNode) {
          firstScript.parentNode.insertBefore(tag, firstScript);
        } else {
          document.head.appendChild(tag);
        }
      }
    }
  }

  handleStateChange(state) {
    if (!window.YT) return;

    switch (state) {
      case window.YT.PlayerState.PLAYING:
        this.isTransitioning = false;
        if (this.transitionTimer) {
          clearTimeout(this.transitionTimer);
          this.transitionTimer = null;
        }
        this.isPlaying = true;
        if (this.player && typeof this.player.getDuration === 'function') {
          const d = this.player.getDuration();
          if (typeof d === 'number' && !isNaN(d) && d > 0) {
            this.durationSec = Math.floor(d);
          }
        }
        this.startTicker();
        break;

      case window.YT.PlayerState.PAUSED:
        // Ignore transient unload PAUSED state during video transition
        if (this.isTransitioning) {
          return;
        }
        this.isPlaying = false;
        this.stopTicker();
        break;

      case window.YT.PlayerState.ENDED:
        this.isTransitioning = false;
        this.isPlaying = false;
        this.stopTicker();
        this.triggerEnded();
        break;

      case window.YT.PlayerState.BUFFERING:
        // Keep ticker / active status while buffering
        break;

      default:
        break;
    }
    this.emit();
  }

  startTicker() {
    this.stopTicker();
    this.ticker = setInterval(() => {
      if (this.player && typeof this.player.getCurrentTime === 'function') {
        try {
          const cur = this.player.getCurrentTime();
          const dur = this.player.getDuration();
          if (typeof cur === 'number' && !isNaN(cur)) {
            this.currentTimeSec = cur;
          }
          if (typeof dur === 'number' && !isNaN(dur) && dur > 0) {
            this.durationSec = Math.floor(dur);
          }
          this.emit();
        } catch (_) {}
      }
    }, 350);
  }

  stopTicker() {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }

  triggerEnded() {
    const finishedDay = this.currentDay;
    this.endedListeners.forEach(fn => {
      try { fn(finishedDay); } catch (_) { /* ignore */ }
    });
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
      isPlaying: this.isPlaying,
      currentDay: this.currentDay,
      currentTimeSec: this.currentTimeSec,
      durationSec: this.durationSec,
      playbackRate: this.playbackRate,
      currentVideoId: this.currentVideoId,
      currentTitle: this.currentTitle,
      currentYoutubeUrl: this.currentYoutubeUrl,
      isPlayerReady: this.isPlayerReady
    };
  }

  cueDay(dayNum = 1) {
    this.syncDayMetadata(dayNum);
    this.currentTimeSec = 0;
    this.isPlaying = false;
    this.isTransitioning = false;
    this.stopTicker();

    if (this.isPlayerReady && this.player) {
      try {
        if (this.loadedVideoId !== this.currentVideoId) {
          this.player.cueVideoById({
            videoId: this.currentVideoId,
            startSeconds: 0
          });
          this.loadedVideoId = this.currentVideoId;
        }
      } catch (e) {
        console.warn('[Ephphatha YouTube] cueDay error', e);
      }
    }
    this.emit();
  }

  loadAndPlayDay(dayNum = 1, startSec = 0) {
    this.syncDayMetadata(dayNum);
    this.currentTimeSec = startSec;
    this.isPlaying = true;
    this.isTransitioning = true;
    this.loadedVideoId = this.currentVideoId;

    if (this.transitionTimer) clearTimeout(this.transitionTimer);
    this.transitionTimer = setTimeout(() => {
      this.isTransitioning = false;
    }, 4000);

    if (!this.isPlayerReady || !this.player || typeof this.player.loadVideoById !== 'function') {
      this.pendingAutoPlay = true;
      this.emit();
      return;
    }

    try {
      this.player.loadVideoById({
        videoId: this.currentVideoId,
        startSeconds: startSec || 0
      });
      try { this.player.unMute(); this.player.setVolume(100); } catch (_) {}
      if (this.playbackRate !== 1.0) {
        try { this.player.setPlaybackRate(this.playbackRate); } catch (_) {}
      }
      this.startTicker();
      this.emit();
    } catch (e) {
      console.warn('[Ephphatha YouTube] loadAndPlayDay error', e);
    }
  }

  async play() {
    this.syncDayMetadata(this.currentDay);

    if (!this.isPlayerReady || !this.player) {
      this.pendingAutoPlay = true;
      this.isPlaying = true;
      this.emit();
      return;
    }

    try {
      try { this.player.unMute(); this.player.setVolume(100); } catch (_) {}

      if (this.loadedVideoId !== this.currentVideoId || typeof this.player.playVideo !== 'function') {
        this.loadedVideoId = this.currentVideoId;
        this.player.loadVideoById({
          videoId: this.currentVideoId,
          startSeconds: this.currentTimeSec || 0
        });
      } else {
        this.player.playVideo();
      }
      this.isPlaying = true;
      if (this.playbackRate !== 1.0) {
        try { this.player.setPlaybackRate(this.playbackRate); } catch (_) {}
      }
      this.startTicker();
      this.emit();
    } catch (e) {
      console.warn('[Ephphatha YouTube] play error', e);
    }
  }

  pause() {
    this.isPlaying = false;
    this.isTransitioning = false;
    this.pendingAutoPlay = false;
    if (this.transitionTimer) clearTimeout(this.transitionTimer);
    this.stopTicker();

    if (this.isPlayerReady && this.player && typeof this.player.pauseVideo === 'function') {
      try {
        this.player.pauseVideo();
      } catch (e) {
        console.warn('[Ephphatha YouTube] pause error', e);
      }
    }
    this.emit();
  }

  seekTo(sec = 0) {
    this.currentTimeSec = Math.max(0, Math.min(this.durationSec, Number(sec) || 0));
    if (this.isPlayerReady && this.player && typeof this.player.seekTo === 'function') {
      try {
        this.player.seekTo(this.currentTimeSec, true);
      } catch (e) {
        console.warn('[Ephphatha YouTube] seekTo error', e);
      }
    }
    this.emit();
  }

  skip(deltaSec = 0) {
    this.seekTo(this.currentTimeSec + deltaSec);
  }

  setPlaybackRate(rate = 1.0) {
    this.playbackRate = rate;
    if (this.isPlayerReady && this.player && typeof this.player.setPlaybackRate === 'function') {
      try {
        this.player.setPlaybackRate(rate);
      } catch (e) {
        console.warn('[Ephphatha YouTube] setPlaybackRate error', e);
      }
    }
    this.emit();
  }
}
