import { describe, expect, it } from 'vitest';
import { validateAction } from './authority';
import type { ActionEnvelope, GameState } from './contracts';

const state: GameState = {
  roomId: 'room-1',
  gameId: 'hwatu',
  roundId: 'round-1',
  sequence: 10,
  phase: 'running',
  activeActorId: 'actor-a',
  players: [
    { actorId: 'actor-a', displayName: 'A', seat: 0, connected: true, ready: true },
    { actorId: 'actor-b', displayName: 'B', seat: 1, connected: true, ready: true },
  ],
};

function envelope(overrides: Partial<ActionEnvelope> = {}): ActionEnvelope {
  return {
    roomId: state.roomId,
    gameId: state.gameId,
    roundId: state.roundId,
    sequence: 11,
    actorId: 'actor-a',
    action: { type: 'play_card', cardId: '01_01' },
    ...overrides,
  };
}

describe('server authority action validation', () => {
  it('accepts a fresh action from the active actor', () => {
    expect(validateAction(state, envelope())).toEqual({ accepted: true });
  });

  it('rejects stale and cross-room requests before game rules run', () => {
    expect(validateAction(state, envelope({ sequence: 10 }))).toEqual({ accepted: false, reason: 'invalid_sequence' });
    expect(validateAction(state, envelope({ roomId: 'other-room' }))).toEqual({ accepted: false, reason: 'wrong_room' });
  });

  it('rejects unknown actors and actions from the wrong turn', () => {
    expect(validateAction(state, envelope({ actorId: 'actor-x' }))).toEqual({ accepted: false, reason: 'unknown_actor' });
    expect(validateAction(state, envelope({ actorId: 'actor-b' }))).toEqual({ accepted: false, reason: 'not_active_actor' });
  });

  it('requires every player to be ready before starting', () => {
    const readyState = { ...state, phase: 'ready' as const, players: state.players.map((player, index) => ({ ...player, ready: index === 0 })) };
    expect(validateAction(readyState, envelope({ action: { type: 'start_game' } }))).toEqual({ accepted: false, reason: 'players_not_ready' });
    const allReadyState = { ...readyState, players: readyState.players.map((player) => ({ ...player, ready: true })) };
    expect(validateAction(allReadyState, envelope({ action: { type: 'start_game' } }))).toEqual({ accepted: true });
  });

  it('allows reconnect only from an already known snapshot range', () => {
    expect(validateAction(state, envelope({ action: { type: 'reconnect', lastSequence: 8 } }))).toEqual({ accepted: true });
    expect(validateAction(state, envelope({ action: { type: 'reconnect', lastSequence: 11 } }))).toEqual({ accepted: false, reason: 'invalid_reconnect_sequence' });
  });
});
