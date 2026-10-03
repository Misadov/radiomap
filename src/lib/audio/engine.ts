'use client';

// Plays live radio streams and (where the browser allows it) exposes a spectrum
// analyser for the visualiser.
//
// Real-time analysis needs CORS: a cross-origin stream played without CORS is
// "tainted" and the analyser only sees silence. So on desktop we first try with
// crossOrigin="anonymous" and, if the server refuses, retry as a plain <audio>
// element (still plays fine, the visualiser falls back to an ambient animation).
// On touch devices we never route audio through Web Audio: iOS suspends audio
// contexts in the background, which would cut the radio when the screen locks.

import type Hls from 'hls.js';

export type EngineStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';
export type EngineError = 'unavailable' | 'insecure' | 'unsupported';

export interface PlayRequest {
  url: string;
  hls: boolean;
}

type Events = {
  status: EngineStatus;
  error: EngineError;
  analysis: boolean;
};

type Listener<K extends keyof Events> = (value: Events[K]) => void;
type AnyListener = (value: never) => void;

const START_TIMEOUT_MS = 20_000;
const RESUME_RECONNECT_MS = 30_000;

class AttemptError extends Error {
  constructor(
    public readonly kind: 'blocked' | 'failed' | 'unsupported' | 'superseded',
    message?: string,
  ) {
    super(message ?? kind);
  }
}

function canAnalyse() {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return false;
  return window.matchMedia('(pointer: fine)').matches && !/iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isHlsUrl(url: string) {
  return /\.m3u8($|\?)/i.test(url);
}

export class AudioEngine {
  private el: HTMLAudioElement | null = null;
  private hls: Hls | null = null;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gain: GainNode | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private token = 0;
  private volume = 0.8;
  private muted = false;
  private request: PlayRequest | null = null;
  private pausedAt = 0;
  private reconnects = 0;
  private lastDrop = 0;
  private listeners = new Map<keyof Events, Set<AnyListener>>();
  private freq: Uint8Array<ArrayBuffer> = new Uint8Array(1024);
  private wave: Uint8Array<ArrayBuffer> = new Uint8Array(2048);

  on<K extends keyof Events>(event: K, fn: Listener<K>) {
    let set = this.listeners.get(event);
    if (!set) this.listeners.set(event, (set = new Set()));
    set.add(fn as AnyListener);
    return () => set.delete(fn as AnyListener);
  }

  private emit<K extends keyof Events>(event: K, value: Events[K]) {
    this.listeners.get(event)?.forEach((fn) => (fn as Listener<K>)(value));
  }

  /** True when real spectrum data is available. */
  get analysing() {
    return !!this.analyser && !!this.source;
  }

  /** Call from the first user gesture so the audio context starts unsuspended. */
  unlock() {
    if (canAnalyse()) this.ensureContext();
  }

  async play(request: PlayRequest, opts: { reconnect?: boolean } = {}): Promise<void> {
    const token = ++this.token;
    this.request = request;
    if (!opts.reconnect) this.reconnects = 0;
    const analyse = canAnalyse();
    if (analyse) this.ensureContext();

    this.teardown();
    this.emit('status', 'loading');
    this.emit('analysis', false);

    const hls = request.hls || isHlsUrl(request.url);
    const native = hls && document.createElement('audio').canPlayType('application/vnd.apple.mpegurl') !== '';
    // hls.js fetches segments itself (CORS is required either way), so one attempt is enough.
    const corsModes = hls && !native ? [true] : analyse ? [true, false] : [false];

    let unsupported = false;
    for (const cors of corsModes) {
      try {
        await this.attempt(request, { cors, hls: hls && !native, analyse }, token);
        if (token !== this.token || !this.el) return;
        // Only now: a failed attempt fires 'pause'/'error' events we must not report.
        this.bindLifecycle(this.el, token);
        this.emit('analysis', this.analysing);
        this.emit('status', 'playing');
        return;
      } catch (err) {
        if (token !== this.token) return;
        if (err instanceof AttemptError && err.kind === 'blocked') {
          // Autoplay without a gesture (deep link): stay ready, user presses play.
          this.emit('status', 'paused');
          return;
        }
        if (err instanceof AttemptError && err.kind === 'unsupported') unsupported = true;
        this.teardown();
      }
    }

    const insecure = location.protocol === 'https:' && /^http:/i.test(request.url);
    this.emit('error', insecure ? 'insecure' : unsupported ? 'unsupported' : 'unavailable');
    this.emit('status', 'error');
  }

  private attempt(
    request: PlayRequest,
    mode: { cors: boolean; hls: boolean; analyse: boolean },
    token: number,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const el = new Audio();
      el.preload = 'auto';
      if (mode.cors) el.crossOrigin = 'anonymous';
      this.el = el;
      let settled = false;

      const done = (err?: AttemptError) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (err) reject(err);
        else resolve();
      };
      const timer = setTimeout(() => done(new AttemptError('failed', 'timeout')), START_TIMEOUT_MS);

      el.addEventListener('playing', () => done(), { once: true });
      el.addEventListener('error', () => done(new AttemptError('failed', el.error?.message)));

      const start = () => {
        if (token !== this.token) return done(new AttemptError('superseded'));
        // Route through Web Audio only when the stream can be analysed.
        if (mode.analyse && (mode.cors || mode.hls)) this.connect(el);
        this.applyVolume();
        el.play().then(
          () => done(),
          (err: DOMException) => done(new AttemptError(err?.name === 'NotAllowedError' ? 'blocked' : 'failed', err?.message)),
        );
      };

      if (mode.hls) {
        import('hls.js')
          .then(({ default: HlsLib }) => {
            if (token !== this.token) return done(new AttemptError('superseded'));
            if (!HlsLib.isSupported()) return done(new AttemptError('failed', 'hls unsupported'));
            const hls = new HlsLib({ lowLatencyMode: false, backBufferLength: 30, maxBufferLength: 20 });
            this.hls = hls;
            hls.on(HlsLib.Events.ERROR, (_e, data) => {
              if (!data.fatal) return;
              const codec = /codec|incompatible/i.test(String(data.details));
              if (!settled) done(new AttemptError(codec ? 'unsupported' : 'failed', data.details));
              else this.handleDrop(token);
            });
            hls.loadSource(request.url);
            hls.attachMedia(el);
            start();
          })
          .catch(() => done(new AttemptError('failed', 'hls.js failed to load')));
      } else {
        el.src = request.url;
        start();
      }
    });
  }

  /** Status updates once a stream is running: buffering, drops, external pauses. */
  private bindLifecycle(el: HTMLAudioElement, token: number) {
    const live = () => token === this.token && this.el === el;
    el.addEventListener('waiting', () => live() && this.emit('status', 'loading'));
    el.addEventListener('playing', () => live() && this.emit('status', 'playing'));
    el.addEventListener('pause', () => {
      if (!live() || el.ended) return;
      this.pausedAt = Date.now();
      this.emit('status', 'paused');
    });
    el.addEventListener('ended', () => live() && this.handleDrop(token));
    el.addEventListener('error', () => live() && el.currentTime > 0 && this.handleDrop(token));
  }

  /** The stream died mid-play: reconnect a couple of times before giving up. */
  private handleDrop(token: number) {
    if (token !== this.token || !this.request) return;
    // Occasional drops over a long session are normal; only give up on repeated ones.
    if (Date.now() - this.lastDrop > 120_000) this.reconnects = 0;
    this.lastDrop = Date.now();
    if (this.reconnects >= 3) {
      this.emit('error', 'unavailable');
      this.emit('status', 'error');
      return;
    }
    this.reconnects++;
    const request = this.request;
    setTimeout(() => {
      if (token === this.token) void this.play(request, { reconnect: true });
    }, 700 * this.reconnects);
  }

  private ensureContext() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx({ latencyHint: 'playback' });
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.78;
      this.gain = this.ctx.createGain();
      this.analyser.connect(this.gain);
      this.gain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private connect(el: HTMLAudioElement) {
    // A suspended context would swallow the sound: play unanalysed instead.
    if (!this.ctx || !this.analyser || this.ctx.state !== 'running') return;
    try {
      this.source = this.ctx.createMediaElementSource(el);
      this.source.connect(this.analyser);
    } catch {
      this.source = null;
    }
  }

  private teardown() {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    if (this.source) {
      try {
        this.source.disconnect();
      } catch {
        /* already disconnected */
      }
      this.source = null;
    }
    if (this.el) {
      const el = this.el;
      this.el = null;
      el.pause();
      el.removeAttribute('src');
      el.load();
    }
  }

  pause() {
    if (!this.el) return;
    this.pausedAt = Date.now();
    this.el.pause();
  }

  resume() {
    if (!this.request) return;
    // Live radio: after a long pause the buffer is stale — reconnect to the live edge.
    if (!this.el || this.el.error || Date.now() - this.pausedAt > RESUME_RECONNECT_MS) {
      void this.play(this.request);
      return;
    }
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
    this.el.play().catch(() => this.request && this.play(this.request));
  }

  stop() {
    this.token++;
    this.request = null;
    this.teardown();
    this.emit('analysis', false);
    this.emit('status', 'idle');
  }

  setVolume(volume: number, muted: boolean) {
    this.volume = volume;
    this.muted = muted;
    this.applyVolume();
  }

  private applyVolume() {
    const v = this.muted ? 0 : this.volume ** 1.6; // perceptual curve
    if (this.source && this.gain && this.ctx) {
      if (this.el) this.el.volume = 1;
      this.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.03);
    } else if (this.el) {
      this.el.volume = v;
    }
  }

  /** Fills `out` with spectrum magnitudes (0..255). Returns false without real data. */
  frequencies(): Uint8Array | null {
    if (!this.analysing || !this.analyser) return null;
    if (this.freq.length !== this.analyser.frequencyBinCount) this.freq = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(this.freq);
    return this.freq;
  }

  /** Loudness 0..1 of the current audio frame, or -1 without real data. */
  level(): number {
    if (!this.analysing || !this.analyser) return -1;
    this.analyser.getByteTimeDomainData(this.wave);
    let sum = 0;
    for (let i = 0; i < this.wave.length; i += 4) {
      const v = (this.wave[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / (this.wave.length / 4)) * 2.2);
  }
}

export const engine = new AudioEngine();
