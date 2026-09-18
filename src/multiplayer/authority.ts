import {
  isFreshSequence,
  type ActionEnvelope,
  type GameAction,
  type GameState,
} from './contracts';

export type ActionRejectionReason =
  | 'invalid_sequence'
  | 'wrong_room'
  | 'unknown_actor'
  | 'invalid_phase'
  | 'not_active_actor'
  | 'players_not_ready'
  | 'invalid_reconnect_sequence';

export type ActionValidation =
  | { accepted: true }
  | { accepted: false; reason: ActionRejectionReason };

function hasActor(state: GameState, actorId: string): boolean {
  return state.players.some((player) => player.actorId === actorId);
}

function isTurnAction(action: GameAction): boolean {
  return action.type === 'play_card'
    || action.type === 'choose_card'
    || action.type === 'resolve_go_stop';
}

/**
 * Validate a client request without mutating state.
 * The authoritative reducer/backend should call this before applying an action.
 */
export function validateAction(state: GameState, envelope: ActionEnvelope): ActionValidation {
  if (!isFreshSequence(envelope.sequence, state.sequence)) {
    return { accepted: false, reason: 'invalid_sequence' };
  }

  if (envelope.roomId !== state.roomId
    || envelope.gameId !== state.gameId
    || envelope.roundId !== state.roundId) {
    return { accepted: false, reason: 'wrong_room' };
  }

  const { action } = envelope;
  const isJoin = action.type === 'join_room';
  if (!isJoin && !hasActor(state, envelope.actorId)) {
    return { accepted: false, reason: 'unknown_actor' };
  }

  if (isJoin) {
    return action.actorId === envelope.actorId && action.roomId === state.roomId
      ? { accepted: true }
      : { accepted: false, reason: 'unknown_actor' };
  }

  if (action.type === 'reconnect') {
    return Number.isSafeInteger(action.lastSequence)
      && action.lastSequence >= 0
      && action.lastSequence <= state.sequence
      ? { accepted: true }
      : { accepted: false, reason: 'invalid_reconnect_sequence' };
  }

  if (action.type === 'set_ready') {
    return state.phase === 'waiting' || state.phase === 'ready'
      ? { accepted: true }
      : { accepted: false, reason: 'invalid_phase' };
  }

  if (action.type === 'start_game') {
    if (state.phase !== 'ready') return { accepted: false, reason: 'invalid_phase' };
    return state.players.length > 0 && state.players.every((player) => player.ready)
      ? { accepted: true }
      : { accepted: false, reason: 'players_not_ready' };
  }

  if (isTurnAction(action)) {
    if (state.phase !== 'running') return { accepted: false, reason: 'invalid_phase' };
    return state.activeActorId === envelope.actorId
      ? { accepted: true }
      : { accepted: false, reason: 'not_active_actor' };
  }

  return { accepted: false, reason: 'invalid_phase' };
}
