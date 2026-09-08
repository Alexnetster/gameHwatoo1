import { CardDef, PlayerState } from './types';
import { createShuffledDeck } from './deck';
import { calculateScore, getCardFamily } from './rules';

export type GamePhase =
  | 'IDLE'
  | 'DEALING'
  | 'PLAYER_SELECT'        // Waiting for player to select hand card
  | 'PLAYER_CHOICE'        // Waiting for player to choose between 2 floor cards
  | 'PLAYER_DRAW'          // Drawing from deck for player
  | 'PLAYER_DRAW_CHOICE'   // Waiting for player to choose between 2 floor cards for deck draw
  | 'CPU_TURN'             // CPU thinking & playing
  | 'GO_STOP'              // Player must choose whether to continue or stop
  | 'ROUND_OVER';

export class GameState {
  public phase: GamePhase = 'IDLE';
  public currentTurn: 'player' | 'cpu' = 'player';
  public turnNumber: number = 1;

  public player: PlayerState = {
    id: 'player',
    name: '나 (Player)',
    hand: [],
    captured: [],
    score: 0,
    goCount: 0,
  };

  public cpu: PlayerState = {
    id: 'cpu',
    name: 'CPU',
    hand: [],
    captured: [],
    score: 0,
    goCount: 0,
  };

  public floorCards: CardDef[] = [];
  public deck: CardDef[] = [];

  // Card temporarily in play during current turn
  public pendingHandCard: CardDef | null = null;
  public pendingDrawCard: CardDef | null = null;
  public pendingChoiceCandidates: CardDef[] = [];
  public turnCapturedCards: CardDef[] = []; // Cards captured in the current turn

  public initNewGame(random: () => number = Math.random): {
    playerHand: CardDef[];
    cpuHand: CardDef[];
    floor: CardDef[];
    deck: CardDef[];
  } {
    const fullDeck = createShuffledDeck(random);

    // Matgo standard deal:
    // Player: 10 cards
    // CPU: 10 cards
    // Floor: 8 cards
    // Deck: 20 cards
    const playerHand = fullDeck.slice(0, 10);
    const cpuHand = fullDeck.slice(10, 20);
    const floor = fullDeck.slice(20, 28);
    const remainingDeck = fullDeck.slice(28);

    this.player.hand = [...playerHand];
    this.player.captured = [];
    this.player.score = 0;
    this.player.goCount = 0;

    this.cpu.hand = [...cpuHand];
    this.cpu.captured = [];
    this.cpu.score = 0;
    this.cpu.goCount = 0;

    this.floorCards = [...floor];
    this.deck = [...remainingDeck];

    this.currentTurn = 'player';
    this.turnNumber = 1;
    this.phase = 'PLAYER_SELECT';
    this.turnCapturedCards = [];
    this.validateInvariants();

    return {
      playerHand,
      cpuHand,
      floor,
      deck: remainingDeck,
    };
  }

  /** Throws when a card is duplicated or lost between game zones. */
  public validateInvariants(): void {
    const zones = [
      ...this.player.hand,
      ...this.cpu.hand,
      ...this.floorCards,
      ...this.deck,
      ...this.player.captured,
      ...this.cpu.captured,
    ];
    const ids = new Set(zones.map((card) => card.id));
    const familyCounts = new Map<number, number>();
    for (const card of zones) {
      const family = getCardFamily(card);
      familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1);
      if (card.month !== family) {
        throw new Error(`Card metadata mismatch: ${card.id} says month ${card.month}`);
      }
    }
    if (
      zones.length !== 48 ||
      ids.size !== 48 ||
      familyCounts.size !== 12 ||
      [...familyCounts.values()].some((count) => count !== 4)
    ) {
      throw new Error(`Invalid card state: ${zones.length} cards in ${ids.size} unique ids`);
    }
  }

  public drawCardFromDeck(): CardDef | null {
    if (this.deck.length === 0) return null;
    return this.deck.pop() || null;
  }

  public removeCardFromHand(playerId: 'player' | 'cpu', cardId: string): CardDef | undefined {
    const p = playerId === 'player' ? this.player : this.cpu;
    const idx = p.hand.findIndex((c) => c.id === cardId);
    if (idx !== -1) {
      return p.hand.splice(idx, 1)[0];
    }
    return undefined;
  }

  public addCaptured(playerId: 'player' | 'cpu', cards: CardDef[]): void {
    const p = playerId === 'player' ? this.player : this.cpu;
    p.captured.push(...cards);
    this.turnCapturedCards.push(...cards);
    p.score = calculateScore(p.captured);
    this.validateInvariants();
  }

  public switchTurn(): 'player' | 'cpu' {
    this.currentTurn = this.currentTurn === 'player' ? 'cpu' : 'player';
    this.turnNumber++;
    this.turnCapturedCards = [];
    this.pendingHandCard = null;
    this.pendingDrawCard = null;
    this.pendingChoiceCandidates = [];
    this.phase = this.currentTurn === 'player' ? 'PLAYER_SELECT' : 'CPU_TURN';
    return this.currentTurn;
  }

  public isGameOver(): boolean {
    return this.player.hand.length === 0 && this.cpu.hand.length === 0;
  }
}
