/**
 * EPHPHATHA ADAPTER LAYER: YOUTUBE AUDIO ADAPTER (THE BIBLE IN A YEAR - FR. MIKE SCHMITZ)
 * Bridges YouTube IFrame Player API for all 365 daily episodes from Ascension's
 * 'The Bible in a Year & More: Fr. Mike & Jeff Cavins' official series into Ephphatha's
 * unified compact audio player.
 */

export class YouTubeAudioAdapter {
  constructor() {
    this.player = null;
    this.isApiLoaded = false;
    this.isPlayerReady = false;
    this.isPlaying = false;
    this.currentDay = 1;
    this.currentVideoId = '';
    this.currentTitle = '';
    this.currentYoutubeUrl = '';
    this.currentTimeSec = 0;
    this.durationSec = 1345;
    this.playbackRate = 1.0;
    this.daysMap = {};
    this.isDataLoaded = false;

    this.listeners = new Set();
    this.endedListeners = new Set();
    this.ticker = null;

    this.initDataset();
    this.initYouTubeApi();
  }

  async initDataset() {
    try {
      const res = await fetch('./data/youtube_bible_in_a_year_365.json');
      if (res.ok) {
        const data = await res.json();
        this.daysMap = data.days || {};
        this.isDataLoaded = true;
      }
    } catch (e) {
      console.warn('[Ephphatha YouTube] Could not load offline JSON manifest, falling back to algorithm', e);
    }
  }

  getDayVideoData(dayNum = 1) {
    const day = Number(dayNum) || 1;
    if (this.daysMap && this.daysMap[day]) {
      return this.daysMap[day];
    }
    // Fallback if data is still loading
    return {
      day,
      title: `Day ${day}: The Bible in a Year (with Fr. Mike Schmitz)`,
      episode_title: `Day ${day}`,
      video_id: 'BW0gXbEVYgA', // Day 1 fallback
      youtube_url: `https://www.youtube.com/results?search_query=Day+${day}+The+Bible+in+a+Year+Fr+Mike+Schmitz`
    };
  }

  initYouTubeApi() {
    if (typeof window === 'undefined') return;

    // Ensure host container exists
    let host = document.getElementById('ephphatha-yt-audio-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'ephphatha-yt-audio-host';
      host.style.position = 'fixed';
      host.style.width = '1px';
      host.style.height = '1px';
      host.style.left = '-9999px';
      host.style.bottom = '0';
      host.style.opacity = '0.001';
      host.style.pointerEvents = 'none';
      host.style.overflow = 'hidden';
      host.style.zIndex = '-1';
      document.body.appendChild(host);
    }

    const onApiReady = () => {
      this.isApiLoaded = true;
      try {
        this.player = new window.YT.Player('ephphatha-yt-audio-host', {
          height: '1',
          width: '1',
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            playsinline: 1,
            rel: 0,
            modestbranding: 1
          },
          events: {
            onReady: () => {
              this.isPlayerReady = true;
              if (this.currentVideoId) {
                this.cueDay(this.currentDay, false);
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
        this.isPlaying = true;
        this.startTicker();
        break;
      case window.YT.PlayerState.PAUSED:
        this.isPlaying = false;
        this.stopTicker();
        break;
      case window.YT.PlayerState.ENDED:
        this.isPlaying = false;
        this.stopTicker();
        this.triggerEnded();
        break;
      case window.YT.PlayerState.BUFFERING:
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
        const cur = this.player.getCurrentTime();
        const dur = this.player.getDuration();
        if (typeof cur === 'number' && !isNaN(cur)) {
          this.currentTimeSec = cur;
        }
        if (typeof dur === 'number' && !isNaN(dur) && dur > 0) {
          this.durationSec = dur;
        }
        this.emit();
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

  cueDay(dayNum = 1, autoPlay = false) {
    this.currentDay = Number(dayNum) || 1;
    const vData = this.getDayVideoData(this.currentDay);
    this.currentVideoId = vData.video_id;
    this.currentTitle = vData.title;
    this.currentYoutubeUrl = vData.youtube_url;
    this.currentTimeSec = 0;

    if (this.isPlayerReady && this.player) {
      try {
        if (autoPlay) {
          this.player.loadVideoById(this.currentVideoId, 0);
          this.isPlaying = true;
          this.startTicker();
        } else {
          this.player.cueVideoById(this.currentVideoId, 0);
          this.isPlaying = false;
          this.stopTicker();
        }
      } catch (e) {
        console.warn('[Ephphatha YouTube] cueDay error', e);
      }
    }
    this.emit();
  }

  async play() {
    if (!this.currentVideoId) {
      this.cueDay(this.currentDay, true);
      return;
    }
    if (this.isPlayerReady && this.player && typeof this.player.playVideo === 'function') {
      try {
        this.player.playVideo();
        this.isPlaying = true;
        this.startTicker();
        this.emit();
      } catch (e) {
        console.warn('[Ephphatha YouTube] play error', e);
      }
    }
  }

  pause() {
    this.isPlaying = false;
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
