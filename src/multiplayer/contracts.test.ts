import { describe, expect, it } from 'vitest';
import { isFreshSequence, type ActionEnvelope, type GameEvent, type GameState } from './contracts';

describe('multiplayer wire contracts', () => {
  it('models a server-authoritative action envelope', () => {
    const action: ActionEnvelope = {
      roomId: 'room-1234',
      gameId: 'hwatu',
      roundId: 'round-1',
      sequence: 4,
      actorId: 'actor-a',
      action: { type: 'play_card', cardId: '01_01' },
    };

    expect(action.action.type).toBe('play_card');
    if (action.action.type === 'play_card') {
      expect(action.action.cardId).toBe('01_01');
    }
  });

  it('accepts state snapshots and results as distinct events', () => {
    const state: GameState = {
      roomId: 'room-1234',
      gameId: 'hwatu',
      roundId: 'round-1',
      sequence: 9,
      phase: 'running',
      activeActorId: 'actor-a',
      players: [],
    };
    const event: GameEvent = { type: 'state_snapshot', state };

    expect(event.type).toBe('state_snapshot');
    expect(event.state.sequence).toBe(9);
  });

  it('rejects duplicate and non-integer sequence numbers', () => {
    expect(isFreshSequence(10, 9)).toBe(true);
    expect(isFreshSequence(9, 9)).toBe(false);
    expect(isFreshSequence(9.5, 9)).toBe(false);
    expect(isFreshSequence(Number.MAX_SAFE_INTEGER + 1, 9)).toBe(false);
  });
});
