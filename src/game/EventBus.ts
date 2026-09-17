import { CardDef, PlayerState } from './types';

export interface GameEventPayloads {
  STATUS_MESSAGE: string;
  GAME_STARTED: { player: PlayerState; cpu: PlayerState };
  CARD_PLAYED: { playerId: 'player' | 'cpu'; card: CardDef };
  DECK_FLIPPED: { playerId: 'player' | 'cpu'; card: CardDef };
  CARD_CAPTURED: { playerId: 'player' | 'cpu'; captured: CardDef[]; total: CardDef[] };
  CAPTURE_UPDATED: { playerId: 'player' | 'cpu'; total: CardDef[] };
  CHOICE_REQUIRED: { card: CardDef; candidates: CardDef[] };
  CHOICE_RESOLVED: undefined;
  GO_COUNT_CHANGED: { playerId: 'player' | 'cpu'; goCount: number; multiplier: number };
  TURN_CHANGED: { currentTurn: 'player' | 'cpu'; turnNumber: number; message: string };
  GO_STOP_REQUIRED: { score: number; goCount: number };
  GAME_OVER: {
    playerCaptured: number;
    cpuCaptured: number;
    playerScore: number;
    cpuScore: number;
    playerFinalScore: number;
    cpuFinalScore: number;
    message?: string;
  };
  JJOK: { playerId: 'player' | 'cpu'; captured: CardDef[]; transferredPi: CardDef[] };
  SEOLSA: { playerId: 'player' | 'cpu'; card: CardDef };
}

export type EventCallback<T> = (data: T) => void;

export class EventBus {
  private static instance: EventBus;
  private listeners: Map<keyof GameEventPayloads, Set<EventCallback<unknown>>> = new Map();

  private constructor() {}

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public on<K extends keyof GameEventPayloads>(event: K, callback: EventCallback<GameEventPayloads[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback<unknown>);

    // Unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback as EventCallback<unknown>);
    };
  }

  public emit<K extends keyof GameEventPayloads>(event: K, data?: GameEventPayloads[K]): void {
    const set = this.listeners.get(event);
    if (set) {
      set.forEach((cb) => {
        try {
          cb(data as unknown);
        } catch (e) {
          console.error(`Error in event listener for "${event}":`, e);
        }
      });
    }
  }

  public clear(): void {
    this.listeners.clear();
  }
}
