import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../game/EventBus';
import { AudioManager } from './AudioManager';

describe('AudioManager event lifecycle', () => {
  it('unbinds all event sounds and respects mute state', () => {
    vi.stubGlobal('Audio', class {
      public paused = true;
      public loop = false;
      public preload = '';
      public volume = 0;
      public muted = false;
      public play(): Promise<void> { this.paused = false; return Promise.resolve(); }
      public pause(): void { this.paused = true; }
    });
    const audio = AudioManager.getInstance();
    const bus = EventBus.getInstance();
    bus.clear();
    const play = vi.spyOn(audio, 'play');
    const unbind = audio.bind(bus);

    audio.setMuted(true);
    expect(audio.isMuted).toBe(true);

    audio.setMuted(false);
    bus.emit('CARD_PLAYED', { playerId: 'player', card: {
      id: '01_01', month: 1, col: 0, row: 0, category: 'gwang', name: '1월 광',
    } });
    expect(play).toHaveBeenCalledWith('card');

    const callsBeforeUnbind = play.mock.calls.length;
    unbind();
    bus.emit('CARD_PLAYED', { playerId: 'player', card: {
      id: '01_01', month: 1, col: 0, row: 0, category: 'gwang', name: '1월 광',
    } });
    expect(play).toHaveBeenCalledTimes(callsBeforeUnbind);
    play.mockRestore();
    audio.setMuted(false);
    bus.clear();
    vi.unstubAllGlobals();
  });
});
