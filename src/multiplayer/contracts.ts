/** Shared wire contracts for a server-authoritative multiplayer game. */

export type GamePhase = 'waiting' | 'ready' | 'running' | 'finished' | 'aborted';

export interface PlayerSnapshot {
  actorId: string;
  displayName: string;
  seat: number;
  connected: boolean;
  ready: boolean;
}

export interface GameState {
  roomId: string;
  gameId: string;
  roundId: string;
  sequence: number;
  phase: GamePhase;
  activeActorId: string | null;
  players: PlayerSnapshot[];
}

export type GameAction =
  | { type: 'join_room'; roomId: string; actorId: string }
  | { type: 'set_ready'; ready: boolean }
  | { type: 'start_game' }
  | { type: 'play_card'; cardId: string }
  | { type: 'choose_card'; cardId: string }
  | { type: 'resolve_go_stop'; decision: 'go' | 'stop' }
  | { type: 'reconnect'; lastSequence: number };

export interface ActionEnvelope {
  roomId: string;
  gameId: string;
  roundId: string;
  sequence: number;
  actorId: string;
  action: GameAction;
}

export type GameEvent =
  | { type: 'state_snapshot'; state: GameState }
  | { type: 'action_accepted'; sequence: number; actorId: string; action: GameAction }
  | { type: 'action_rejected'; sequence: number; actorId: string; reason: string }
  | { type: 'player_joined'; player: PlayerSnapshot }
  | { type: 'player_left'; actorId: string; reason: 'disconnect' | 'leave' | 'timeout' }
  | { type: 'game_result'; result: GameResult };

export interface GameResult {
  roundId: string;
  winnerActorId: string | null;
  scores: Record<string, number>;
  reason: 'target_score' | 'deck_exhausted' | 'player_left' | 'timeout';
}

/** Clients may request actions, but only the server emits accepted state changes. */
export interface ServerAuthorityBoundary {
  submit(action: ActionEnvelope): Promise<void>;
  subscribe(listener: (event: GameEvent) => void): () => void;
}

export function isFreshSequence(sequence: number, lastAppliedSequence: number): boolean {
  return Number.isSafeInteger(sequence) && sequence > lastAppliedSequence;
}
