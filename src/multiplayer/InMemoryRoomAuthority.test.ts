import { describe, expect, it } from 'vitest';
import { InMemoryRoomAuthority } from './InMemoryRoomAuthority';
import type { GameEvent, GameState } from './contracts';

function createRoom(): GameState {
  return {
    roomId: 'room-1',
    gameId: 'hwatu',
    roundId: 'round-1',
    sequence: 0,
    phase: 'waiting',
    activeActorId: null,
    players: [],
  };
}

const action = (sequence: number, actorId: string, value: GameEvent extends never ? never : Parameters<InMemoryRoomAuthority['submit']>[0]['action']) => ({
  roomId: 'room-1', gameId: 'hwatu', roundId: 'round-1', sequence, actorId, action: value,
});

describe('InMemoryRoomAuthority', () => {
  it('runs join, ready, start, and alternating turns through one event stream', async () => {
    const authority = new InMemoryRoomAuthority(createRoom());
    const events: GameEvent[] = [];
    authority.subscribe((event) => events.push(event));

    await authority.submit(action(1, 'actor-a', { type: 'join_room', roomId: 'room-1', actorId: 'actor-a' }));
    await authority.submit(action(2, 'actor-b', { type: 'join_room', roomId: 'room-1', actorId: 'actor-b' }));
    await authority.submit(action(3, 'actor-a', { type: 'set_ready', ready: true }));
    await authority.submit(action(4, 'actor-b', { type: 'set_ready', ready: true }));
    await authority.submit(action(5, 'actor-a', { type: 'start_game' }));
    await authority.submit(action(6, 'actor-a', { type: 'play_card', cardId: '01_01' }));

    expect(authority.getState()).toMatchObject({ sequence: 6, phase: 'running', activeActorId: 'actor-b' });
    expect(events.filter((event) => event.type === 'player_joined')).toHaveLength(2);
    expect(events.filter((event) => event.type === 'action_accepted')).toHaveLength(6);
  });

  it('rejects stale actions without mutating state', async () => {
    const authority = new InMemoryRoomAuthority(createRoom());
    const events: GameEvent[] = [];
    authority.subscribe((event) => events.push(event));
    await authority.submit(action(1, 'actor-a', { type: 'join_room', roomId: 'room-1', actorId: 'actor-a' }));
    const before = authority.getState();

    await authority.submit(action(1, 'actor-a', { type: 'set_ready', ready: true }));

    expect(authority.getState()).toEqual(before);
    expect(events.at(-1)).toMatchObject({ type: 'action_rejected', reason: 'invalid_sequence' });
  });

  it('returns the latest snapshot on reconnect and removes the listener cleanly', async () => {
    const authority = new InMemoryRoomAuthority(createRoom());
    const events: GameEvent[] = [];
    const unsubscribe = authority.subscribe((event) => events.push(event));
    await authority.submit(action(1, 'actor-a', { type: 'join_room', roomId: 'room-1', actorId: 'actor-a' }));
    events.length = 0;

    await authority.submit(action(2, 'actor-a', { type: 'reconnect', lastSequence: 1 }));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'state_snapshot', state: { sequence: 1 } });

    unsubscribe();
    await authority.submit(action(2, 'actor-a', { type: 'reconnect', lastSequence: 1 }));
    expect(events).toHaveLength(1);
  });
});
