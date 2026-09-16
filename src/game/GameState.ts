import { CardDef, PlayerState } from './types';
import { createShuffledDeck } from './deck';
import { calculateScore, getCardFamily, RuleOptions, DEFAULT_SPECIAL_RULE_OPTIONS } from './rules';

export type CardZones = {
  playerHand: CardDef[];
  cpuHand: CardDef[];
  floorCards: CardDef[];
  deck: CardDef[];
  playerCaptured: CardDef[];
  cpuCaptured: CardDef[];
  /** Cards temporarily removed from an owner's zone while awaiting a choice. */
  pendingHandCard?: CardDef | null;
  pendingDrawCard?: CardDef | null;
};

/** Throws when the full 48-card deck is not conserved across game zones. */
export function validateCardZoneInvariants(zones: CardZones): void {
  const cards = [
    ...zones.playerHand,
    ...zones.cpuHand,
    ...zones.floorCards,
    ...zones.deck,
    ...zones.playerCaptured,
    ...zones.cpuCaptured,
    ...(zones.pendingHandCard ? [zones.pendingHandCard] : []),
    ...(zones.pendingDrawCard ? [zones.pendingDrawCard] : []),
  ];
  const ids = new Set(cards.map((card) => card.id));
  const familyCounts = new Map<number, number>();
  for (const card of cards) {
    const family = getCardFamily(card);
    familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1);
    if (card.month !== family) {
      throw new Error(`Card metadata mismatch: ${card.id} says month ${card.month}`);
    }
  }
  if (
    cards.length !== 48 ||
    ids.size !== 48 ||
    familyCounts.size !== 12 ||
    [...familyCounts.values()].some((count) => count !== 4)
  ) {
    throw new Error(`Invalid card state: ${cards.length} cards in ${ids.size} unique ids`);
  }
}

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
    scoreAtLastGo: 0,
  };

  public cpu: PlayerState = {
    id: 'cpu',
    name: 'CPU',
    hand: [],
    captured: [],
    score: 0,
    goCount: 0,
    scoreAtLastGo: 0,
  };

  public floorCards: CardDef[] = [];
  public deck: CardDef[] = [];

  // Card temporarily in play during current turn
  public pendingHandCard: CardDef | null = null;
  public pendingDrawCard: CardDef | null = null;
  public pendingChoiceCandidates: CardDef[] = [];
  public turnCapturedCards: CardDef[] = []; // Cards captured in the current turn
  public specialRuleOptions: RuleOptions;
  public targetScore: 3 | 5 | 7;

  constructor(ruleOptions: Partial<RuleOptions> = {}) {
    const { targetScore = 3, ...specialRules } = ruleOptions;
    this.targetScore = targetScore;
    this.specialRuleOptions = { ...DEFAULT_SPECIAL_RULE_OPTIONS, ...specialRules };
  }

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
    this.player.scoreAtLastGo = 0;

    this.cpu.hand = [...cpuHand];
    this.cpu.captured = [];
    this.cpu.score = 0;
    this.cpu.goCount = 0;
    this.cpu.scoreAtLastGo = 0;

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
    validateCardZoneInvariants({
      playerHand: this.player.hand,
      cpuHand: this.cpu.hand,
      floorCards: this.floorCards,
      deck: this.deck,
      playerCaptured: this.player.captured,
      cpuCaptured: this.cpu.captured,
      pendingHandCard: this.pendingHandCard,
      pendingDrawCard: this.pendingDrawCard,
    });
  }

  public drawCardFromDeck(): CardDef | null {
    if (this.deck.length === 0) return null;
    return this.deck.pop() || null;
  }

  public peekDeckCard(): CardDef | null {
    return this.deck.length > 0 ? this.deck[this.deck.length - 1] : null;
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

  public transferPi(fromPlayerId: 'player' | 'cpu', toPlayerId: 'player' | 'cpu', count: number): CardDef[] {
    const source = fromPlayerId === 'player' ? this.player : this.cpu;
    const target = toPlayerId === 'player' ? this.player : this.cpu;
    const piCards = source.captured.filter((card) => card.subType === 'ssangpi' || card.category === 'junk');
    const transferred = piCards.slice(0, Math.max(0, count));
    for (const card of transferred) {
      source.captured = source.captured.filter((candidate) => candidate.id !== card.id);
      target.captured.push(card);
    }
    source.score = calculateScore(source.captured);
    target.score = calculateScore(target.captured);
    this.validateInvariants();
    return transferred;
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
