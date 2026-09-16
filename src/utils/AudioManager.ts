import { EventBus } from '../game/EventBus';

type SoundName = 'card' | 'flip' | 'capture' | 'special' | 'go' | 'stop' | 'win' | 'lose';

/** Small, asset-optional audio layer. Missing files fall back to Web Audio tones. */
export class AudioManager {
  private static instance: AudioManager;
  private readonly storageKey = 'hwatu-audio-settings';
  private audioContext: AudioContext | null = null;
  private bgm: HTMLAudioElement | null = null;
  private bgmPlaybackFailed = false;
  private fallbackBgm: { oscillators: OscillatorNode[]; gain: GainNode } | null = null;
  private muted = false;
  private volume = 0.7;

  private constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(this.storageKey) ?? '{}') as { muted?: boolean; volume?: number };
      this.muted = saved.muted === true;
      if (typeof saved.volume === 'number' && Number.isFinite(saved.volume)) this.volume = Math.max(0, Math.min(1, saved.volume));
    } catch { /* storage is optional (private browsing/tests) */ }
  }

  public static getInstance(): AudioManager {
    return AudioManager.instance ??= new AudioManager();
  }

  public get isMuted(): boolean { return this.muted; }
  public get currentVolume(): number { return this.volume; }

  public start(): void {
    this.ensureContext();
    if (!this.bgm) {
      this.bgm = new Audio('/audio/bgm-main.mp3');
      this.bgm.loop = true;
      this.bgm.preload = 'auto';
      this.bgm.volume = this.volume;
    }
    if (!this.muted) {
      void this.bgm.play().catch(() => {
        this.bgmPlaybackFailed = true;
        this.startFallbackBgm();
      });
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.bgm) this.bgm.muted = muted;
    if (muted) this.stopFallbackBgm();
    else if (this.audioContext && this.bgmPlaybackFailed) this.startFallbackBgm();
    else if (!muted) this.start();
    this.persist();
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.bgm) this.bgm.volume = this.volume;
    if (this.fallbackBgm) this.fallbackBgm.gain.gain.value = this.volume * 0.018;
    this.persist();
  }

  public play(name: SoundName): void {
    if (this.muted) return;
    const frequencies: Record<SoundName, number> = { card: 220, flip: 330, capture: 520, special: 660, go: 440, stop: 180, win: 780, lose: 120 };
    const context = this.ensureContext();
    if (!context) return;
    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = name === 'stop' || name === 'lose' ? 'triangle' : 'sine';
      oscillator.frequency.value = frequencies[name];
      gain.gain.setValueAtTime(Math.min(0.12, this.volume * 0.12), context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + (name === 'win' ? 0.32 : 0.12));
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.35);
    } catch { /* Web Audio is an enhancement only */ }
  }

  public bind(eventBus: EventBus): () => void {
    const unsubs = [
      eventBus.on('CARD_PLAYED', () => this.play('card')),
      eventBus.on('DECK_FLIPPED', () => this.play('flip')),
      eventBus.on('CARD_CAPTURED', () => this.play('capture')),
      eventBus.on('JJOK', () => this.play('special')),
      eventBus.on('SEOLSA', () => this.play('special')),
      eventBus.on('GO_COUNT_CHANGED', () => this.play('go')),
      eventBus.on('GO_STOP_REQUIRED', () => this.play('go')),
      eventBus.on('GAME_OVER', ({ playerFinalScore, cpuFinalScore, playerScore, cpuScore }: { playerFinalScore?: number; cpuFinalScore?: number; playerScore?: number; cpuScore?: number }) => {
        const player = playerFinalScore ?? playerScore ?? 0;
        const cpu = cpuFinalScore ?? cpuScore ?? 0;
        this.play(player >= cpu ? 'win' : 'lose');
      }),
    ];
    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }

  private ensureContext(): AudioContext | null {
    if (this.audioContext) {
      if (this.audioContext.state === 'suspended') void this.audioContext.resume().catch(() => undefined);
      return this.audioContext;
    }
    if (typeof window === 'undefined') return null;
    const Context = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return null;
    try { this.audioContext = new Context(); return this.audioContext; } catch { return null; }
  }

  private startFallbackBgm(): void {
    if (this.muted || this.fallbackBgm) return;
    const context = this.ensureContext();
    if (!context) return;
    try {
      const gain = context.createGain();
      gain.gain.value = this.volume * 0.018;
      gain.connect(context.destination);
      const oscillators = [110, 165].map((frequency) => {
        const oscillator = context.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        oscillator.connect(gain);
        oscillator.start();
        return oscillator;
      });
      this.fallbackBgm = { oscillators, gain };
    } catch { /* Web Audio is an enhancement only */ }
  }

  private stopFallbackBgm(): void {
    if (!this.fallbackBgm) return;
    for (const oscillator of this.fallbackBgm.oscillators) {
      try { oscillator.stop(); } catch { /* already stopped */ }
      oscillator.disconnect();
    }
    this.fallbackBgm.gain.disconnect();
    this.fallbackBgm = null;
  }

  private persist(): void {
    try { localStorage.setItem(this.storageKey, JSON.stringify({ muted: this.muted, volume: this.volume })); } catch { /* optional */ }
  }
}
