import { describe, expect, it, vi } from 'vitest';
import { EventBus } from './EventBus';

describe('EventBus', () => {
  it('removes a listener without affecting other listeners', () => {
    const bus = EventBus.getInstance();
    bus.clear();
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribe = bus.on('STATUS_MESSAGE', first);
    bus.on('STATUS_MESSAGE', second);

    unsubscribe();
    bus.emit('STATUS_MESSAGE', 'ready');

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('ready');
    bus.clear();
  });

  it('keeps event payloads isolated by event name', () => {
    const bus = EventBus.getInstance();
    bus.clear();
    const listener = vi.fn();
    bus.on('GO_STOP_REQUIRED', listener);

    bus.emit('STATUS_MESSAGE', 'not a go-stop event');

    expect(listener).not.toHaveBeenCalled();
    bus.clear();
  });
});
