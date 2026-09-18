import { validateAction } from './authority';
import type {
  ActionEnvelope,
  GameEvent,
  GameState,
  PlayerSnapshot,
  ServerAuthorityBoundary,
} from './contracts';

type Listener = (event: GameEvent) => void;

/**
 * Deterministic room authority used by tests and local development.
 * A network adapter can replace this class without moving validation into UI code.
 */
export class InMemoryRoomAuthority implements ServerAuthorityBoundary {
  private state: GameState;
  private readonly listeners = new Set<Listener>();

  constructor(state: GameState) {
    this.state = structuredClone(state);
  }

  public getState(): GameState {
    return structuredClone(this.state);
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public async submit(envelope: ActionEnvelope): Promise<void> {
    const validation = validateAction(this.state, envelope);
    if (!validation.accepted) {
      this.emit({
        type: 'action_rejected',
        sequence: envelope.sequence,
        actorId: envelope.actorId,
        reason: validation.reason,
      });
      return;
    }

    if (envelope.action.type === 'reconnect') {
      this.emit({ type: 'state_snapshot', state: this.getState() });
      return;
    }

    const previousPlayers = this.state.players;
    this.apply(envelope);
    this.state.sequence = envelope.sequence;
    this.emit({
      type: 'action_accepted',
      sequence: this.state.sequence,
      actorId: envelope.actorId,
      action: envelope.action,
    });

    if (envelope.action.type === 'join_room') {
      const player = this.state.players.find((candidate) => candidate.actorId === envelope.actorId)!;
      if (!previousPlayers.some((candidate) => candidate.actorId === player.actorId)) {
        this.emit({ type: 'player_joined', player: { ...player } });
      }
    }
    this.emit({ type: 'state_snapshot', state: this.getState() });
  }

  private apply(envelope: ActionEnvelope): void {
    const { action, actorId } = envelope;
    if (action.type === 'join_room') {
      if (!this.state.players.some((player) => player.actorId === actorId)) {
        const player: PlayerSnapshot = {
          actorId,
          displayName: actorId,
          seat: this.state.players.length,
          connected: true,
          ready: false,
        };
        this.state.players = [...this.state.players, player];
      }
      return;
    }

    if (action.type === 'set_ready') {
      this.state.players = this.state.players.map((player) =>
        player.actorId === actorId ? { ...player, ready: action.ready } : player);
      if (this.state.players.some((player) => player.ready)) this.state.phase = 'ready';
      if (this.state.players.every((player) => !player.ready)) this.state.phase = 'waiting';
      return;
    }

    if (action.type === 'start_game') {
      this.state.phase = 'running';
      this.state.activeActorId = [...this.state.players].sort((a, b) => a.seat - b.seat)[0]?.actorId ?? null;
      return;
    }

    if (action.type === 'play_card' || action.type === 'choose_card' || action.type === 'resolve_go_stop') {
      const ordered = [...this.state.players].sort((a, b) => a.seat - b.seat);
      const activeIndex = ordered.findIndex((player) => player.actorId === actorId);
      this.state.activeActorId = ordered[(activeIndex + 1) % ordered.length]?.actorId ?? null;
    }
  }

  private emit(event: GameEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
