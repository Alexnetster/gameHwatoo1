import { CardDef } from './types';
import { GameState } from './GameState';
import { calculateFinalScore, evaluateCardMatch, evaluateDadakMatch, MatchResult, validateMatchResult, isSeolsa } from './rules';
import { CpuAI } from './cpu';
import { EventBus } from './EventBus';
import { CardMesh } from '../three/CardMesh';
import { SceneManager } from '../three/SceneManager';
import { InteractionManager } from '../three/InteractionManager';
import { CardAnimator } from '../three/CardAnimator';
import { AssetManager } from '../utils/AssetManager';

export class Game {
  private sceneManager: SceneManager;
  private interactionManager: InteractionManager;
  private animator: CardAnimator;
  private eventBus: EventBus;
  private gameState: GameState;

  private cardMeshes: Map<string, CardMesh> = new Map();
  private selectedCardMesh: CardMesh | null = null;
  private isProcessingTurn: boolean = false;

  constructor(container: HTMLElement) {
    this.sceneManager = new SceneManager(container);
    this.interactionManager = new InteractionManager(this.sceneManager, container);
    this.animator = CardAnimator.getInstance();
    this.eventBus = EventBus.getInstance();
    this.gameState = new GameState();

    this.interactionManager.onCardClick(this.handleCardClick.bind(this));
  }

  public async start(): Promise<void> {
    const assets = AssetManager.getInstance();
    await assets.loadAll('/cards/Hwatu_overview.svg');
  }

  public async startNewRound(): Promise<void> {
    this.clearAllCards();
    this.isProcessingTurn = true;
    this.selectedCardMesh = null;

    const { playerHand, cpuHand, floor, deck } = this.gameState.initNewGame();
    this.eventBus.emit('GAME_STARTED', {
      player: this.gameState.player,
      cpu: this.gameState.cpu,
    });
    this.eventBus.emit('STATUS_MESSAGE', '카드를 배분하고 있습니다...');

    // 1. Create all 48 CardMesh objects in deck position initially
    // Keep the deck inside the narrow phone viewport; the table layout is scaled by SceneManager.
    const deckOrigin = { x: -1.55, y: 1.35 };
    const allCards = [...playerHand, ...cpuHand, ...floor, ...deck];

    allCards.forEach((card, idx) => {
      const mesh = new CardMesh(card, false);
      mesh.position.set(deckOrigin.x, deckOrigin.y, 0.01 + idx * 0.003);
      this.sceneManager.cardContainer.add(mesh);
      this.cardMeshes.set(card.id, mesh);
    });

    // 2. Animate Dealing (Floor -> CPU -> Player -> Rest in deck)
    // A. Floor cards
    const floorPromises: Promise<void>[] = [];
    floor.forEach((card, idx) => {
      const mesh = this.cardMeshes.get(card.id)!;
      const targetPos = this.getFloorPosition(idx);
      floorPromises.push(
        this.delay(idx * 40).then(() =>
          this.animator.moveTo(mesh, targetPos, (Math.random() - 0.5) * 0.1, true, 260)
        )
      );
    });
    await Promise.all(floorPromises);

    // B. CPU hand cards (face-down)
    const cpuPromises: Promise<void>[] = [];
    cpuHand.forEach((card, idx) => {
      const mesh = this.cardMeshes.get(card.id)!;
      const targetPos = this.getCpuHandPosition(idx, cpuHand.length);
      cpuPromises.push(
        this.delay(idx * 30).then(() =>
          this.animator.moveTo(mesh, targetPos, 0, false, 240)
        )
      );
    });
    await Promise.all(cpuPromises);

    // C. Player hand cards (face-up)
    const playerPromises: Promise<void>[] = [];
    playerHand.forEach((card, idx) => {
      const mesh = this.cardMeshes.get(card.id)!;
      const targetPos = this.getPlayerHandPosition(idx, playerHand.length);
      playerPromises.push(
        this.delay(idx * 30).then(() =>
          this.animator.moveTo(mesh, targetPos, 0, true, 240)
        )
      );
    });
    await Promise.all(playerPromises);

    this.isProcessingTurn = false;
    this.updateTurnUI();
  }

  // Handle user clicks on cards
  private async handleCardClick(clickedMesh: CardMesh): Promise<void> {
    if (this.isProcessingTurn) return;

    try {

    // 1. Choice dialog active: clicked candidate on floor?
    if (this.gameState.phase === 'PLAYER_CHOICE' || this.gameState.phase === 'PLAYER_DRAW_CHOICE') {
      const isCandidate = this.gameState.pendingChoiceCandidates.some(
        (c) => c.id === clickedMesh.cardDef.id
      );
      if (isCandidate) {
        await this.resolveUserChoice(clickedMesh.cardDef);
      }
      return;
    }

    // 2. Normal hand card selection (Only during PLAYER_SELECT)
    if (this.gameState.phase !== 'PLAYER_SELECT' || this.gameState.currentTurn !== 'player') {
      return;
    }

    const isPlayerCard = this.gameState.player.hand.some(
      (c) => c.id === clickedMesh.cardDef.id
    );
    if (!isPlayerCard) return;

    // A hand-card click is the play action. Requiring a second click here made
    // the turn appear stuck and prevented the draw/capture pipeline from ever
    // running for users who clicked once.
    this.clearSelection();
    await this.executeTurn('player', clickedMesh.cardDef);
    } catch (err) {
      console.error('Error while processing card click:', err);
      this.isProcessingTurn = false;
      this.selectedCardMesh = null;
      if (this.gameState.phase !== 'ROUND_OVER') {
        this.gameState.phase = 'PLAYER_SELECT';
        this.eventBus.emit('STATUS_MESSAGE', '카드 처리 중 오류가 발생했습니다. 다시 시도하세요.');
        this.updateTurnUI();
      }
    }
  }

  public clearSelection(): void {
    if (this.selectedCardMesh) {
      const playerHandIdx = this.gameState.player.hand.findIndex(
        (c) => c.id === this.selectedCardMesh!.cardDef.id
      );
      const baseY = this.getPlayerHandPosition(
        playerHandIdx !== -1 ? playerHandIdx : 0,
        this.gameState.player.hand.length
      ).y;
      this.selectedCardMesh.setSelectState(false, baseY);
      this.selectedCardMesh = null;
    }

    // Clear floor highlights
    this.gameState.floorCards.forEach((c) => {
      this.cardMeshes.get(c.id)?.setMatchHighlight(false);
    });
  }

  // Turn execution: Hand card play -> Match -> Deck draw -> Match -> Check end -> Next turn
  private async executeTurn(playerId: 'player' | 'cpu', handCard: CardDef): Promise<void> {
    this.isProcessingTurn = true;

    this.gameState.removeCardFromHand(playerId, handCard.id);
    this.repositionHand(playerId);

    const handMesh = this.cardMeshes.get(handCard.id)!;
    const playerName = playerId === 'player' ? '플레이어' : '상대방';
    this.eventBus.emit('STATUS_MESSAGE', `${playerName}가 [${handCard.name}]을 냈습니다.`);

    // 1. Move hand card to center/floor
    await this.animator.moveTo(handMesh, { x: 0, y: -0.2, z: 0.1 }, 0, true, 220);

    // 2. Evaluate match for hand card
    let handMatch = evaluateCardMatch(handCard, this.gameState.floorCards);

    if (handMatch.type === 'choice') {
      // A two-card floor match can become 따닥 only after the deck card is
      // revealed. Peek without removing it so the normal choice path remains
      // unchanged when the deck family differs.
      const peekedDeckCard = this.gameState.peekDeckCard();
      if (peekedDeckCard && evaluateDadakMatch(handCard, this.gameState.floorCards, peekedDeckCard)) {
        await this.executeDeckDraw(playerId, handMatch);
        return;
      }
      if (playerId === 'player') {
        this.gameState.phase = 'PLAYER_CHOICE';
        this.gameState.pendingHandCard = handCard;
        this.gameState.pendingChoiceCandidates = handMatch.candidates!;
        this.eventBus.emit('CHOICE_REQUIRED', {
          card: handCard,
          candidates: handMatch.candidates!,
        });
        this.eventBus.emit('STATUS_MESSAGE', '먹을 바닥패를 선택하세요!');
        this.isProcessingTurn = false;
        return; // Pause until user chooses
      } else {
        // CPU makes choice
        const choice = CpuAI.chooseCandidate(handMatch.candidates!);
        handMatch = evaluateCardMatch(handCard, this.gameState.floorCards, choice);
      }
    }

    // Defer a single hand match until the deck card is revealed so Seolsa can be detected.
    await this.executeDeckDraw(playerId, handMatch);
  }

  private async executeDeckDraw(playerId: 'player' | 'cpu', handMatch: MatchResult, chosenCandidate?: CardDef): Promise<void> {
    this.gameState.phase = playerId === 'player' ? 'PLAYER_DRAW' : 'CPU_TURN';
    // Keep the top card in the deck while resolving the hand card. This keeps
    // the 48-card invariant valid until the drawn card is itself resolved.
    const deckCard = this.gameState.peekDeckCard();
    if (!deckCard) {
      await this.applyMatchResult(playerId, handMatch);
      await this.finishTurn();
      return;
    }

    const deckMesh = this.cardMeshes.get(deckCard.id)!;
    const playerName = playerId === 'player' ? '플레이어' : '상대방';
    this.eventBus.emit('STATUS_MESSAGE', `${playerName}가 더미에서 [${deckCard.name}] 뒤집음!`);

    // Move to center and flip face up
    await this.animator.moveTo(deckMesh, { x: 0.8, y: 0, z: 0.15 }, 0, true, 300);
    this.eventBus.emit('STATUS_MESSAGE', `더미에서 [${deckCard.name}] 카드를 뒤집었습니다.`);
    // Keep the revealed card visible long enough for the player to read it.
    await this.delay(650);

    // Resolve 따닥 before applying the deferred hand result. This captures
    // hand + both matching floor cards + deck card as one atomic result.
    const dadakMatch = evaluateDadakMatch(handMatch.playedCard, this.gameState.floorCards, deckCard);
    if (dadakMatch) {
      this.gameState.drawCardFromDeck();
      await this.applyMatchResult(playerId, dadakMatch);
      await this.finishTurn();
      return;
    }

    if (isSeolsa(handMatch, deckCard, this.gameState.specialRuleOptions)) {
      this.gameState.drawCardFromDeck();
      await this.applySeolsa(playerId, handMatch.playedCard, deckCard);
      await this.finishTurn();
      return;
    }

    await this.applyMatchResult(playerId, handMatch);
    this.gameState.drawCardFromDeck();

    let deckMatch = evaluateCardMatch(deckCard, this.gameState.floorCards, chosenCandidate);

    if (deckMatch.type === 'choice' && !chosenCandidate) {
      if (playerId === 'player') {
        this.gameState.phase = 'PLAYER_DRAW_CHOICE';
        this.gameState.pendingDrawCard = deckCard;
        this.gameState.pendingChoiceCandidates = deckMatch.candidates!;
        this.eventBus.emit('CHOICE_REQUIRED', {
          card: deckCard,
          candidates: deckMatch.candidates!,
        });
        this.eventBus.emit('STATUS_MESSAGE', '더미 카드와 매칭할 바닥패를 선택하세요!');
        this.isProcessingTurn = false;
        return; // Pause until user chooses
      } else {
        const choice = CpuAI.chooseCandidate(deckMatch.candidates!);
        deckMatch = evaluateCardMatch(deckCard, this.gameState.floorCards, choice);
      }
    }

    await this.applyMatchResult(playerId, deckMatch);
    await this.finishTurn();
  }

  // When user makes a choice from the UI modal or floor click
  public async resolveUserChoice(chosenCandidate: CardDef): Promise<void> {
    this.eventBus.emit('CHOICE_RESOLVED');
    this.isProcessingTurn = true;

    if (this.gameState.phase === 'PLAYER_CHOICE') {
      const handCard = this.gameState.pendingHandCard!;
      this.gameState.pendingHandCard = null;
      this.gameState.pendingChoiceCandidates = [];

      const handMatch = evaluateCardMatch(handCard, this.gameState.floorCards, chosenCandidate);

      // Continue to deck draw
      await this.executeDeckDraw('player', handMatch);
    } else if (this.gameState.phase === 'PLAYER_DRAW_CHOICE') {
      const deckCard = this.gameState.pendingDrawCard!;
      this.gameState.pendingDrawCard = null;
      this.gameState.pendingChoiceCandidates = [];

      const deckMatch = evaluateCardMatch(deckCard, this.gameState.floorCards, chosenCandidate);
      await this.applyMatchResult('player', deckMatch);

      await this.finishTurn();
    }
  }

  private async applySeolsa(playerId: 'player' | 'cpu', handCard: CardDef, deckCard: CardDef): Promise<void> {
    this.gameState.floorCards = [...this.gameState.floorCards, handCard, deckCard];
    const opponentId = playerId === 'player' ? 'cpu' : 'player';
    const transferred = this.gameState.transferPi(
      opponentId,
      playerId,
      this.gameState.specialRuleOptions.seolsaPiReward,
    );
    const playerName = playerId === 'player' ? '플레이어' : '상대방';
    const reward = transferred.length > 0 ? ` 피 ${transferred.length}장 회수` : '';
    this.eventBus.emit('STATUS_MESSAGE', `${playerName} 설사! 같은 월 더미패가 나와 패를 가져오지 못했습니다.${reward}`);

    const handMesh = this.cardMeshes.get(handCard.id);
    const deckMesh = this.cardMeshes.get(deckCard.id);
    if (handMesh) await this.animator.moveTo(handMesh, this.getFloorPosition(this.gameState.floorCards.length - 2), 0, true, 220);
    if (deckMesh) await this.animator.moveTo(deckMesh, this.getFloorPosition(this.gameState.floorCards.length - 1), 0, true, 220);
    this.repositionFloor();
  }

  private async applyMatchResult(
    playerId: 'player' | 'cpu',
    match: MatchResult
  ): Promise<void> {
    validateMatchResult(match);
    this.gameState.floorCards = match.remainingOnFloor;

    if (match.captured.length > 0) {
      // Capture cards!
      this.gameState.addCaptured(playerId, match.captured);

      // Animate captured cards flying to player's captured tray
      const captured = (playerId === 'player' ? this.gameState.player : this.gameState.cpu).captured;
      const capturePromises = captured.map((card) => {
        const mesh = this.cardMeshes.get(card.id)!;
        // Captured cards are thumbnails in a dedicated tray so a captured pair stays visible.
        mesh.setDisplayScale(0.55);
        const targetPos = this.getCapturedPosition(playerId, card, 0);
        return this.animator.moveTo(mesh, targetPos, 0, true, 260);
      });
      await Promise.all(capturePromises);
      this.eventBus.emit('CARD_CAPTURED', {
        playerId,
        captured: match.captured,
        total: (playerId === 'player' ? this.gameState.player : this.gameState.cpu).captured,
      });
    } else {
      // No match: played card is left on the floor
      const mesh = this.cardMeshes.get(match.playedCard.id)!;
      const floorIdx = this.gameState.floorCards.findIndex((c) => c.id === match.playedCard.id);
      const targetPos = this.getFloorPosition(floorIdx !== -1 ? floorIdx : this.gameState.floorCards.length - 1);
      await this.animator.moveTo(mesh, targetPos, (Math.random() - 0.5) * 0.15, true, 220);
    }

    // Rearrange floor cards neatly
    this.repositionFloor();
    this.gameState.validateInvariants();
  }

  private async finishTurn(): Promise<void> {
    this.repositionFloor();

    // Check game over
    if (this.gameState.isGameOver()) {
      this.eventBus.emit('GAME_OVER', {
        playerCaptured: this.gameState.player.captured.length,
        cpuCaptured: this.gameState.cpu.captured.length,
        playerScore: this.gameState.player.score,
        cpuScore: this.gameState.cpu.score,
        playerFinalScore: calculateFinalScore(this.gameState.player.score, this.gameState.player.goCount),
        cpuFinalScore: calculateFinalScore(this.gameState.cpu.score, this.gameState.cpu.goCount),
        message: '패가 모두 소진되어 게임이 종료되었습니다.',
      });
      this.gameState.phase = 'ROUND_OVER';
      this.eventBus.emit('STATUS_MESSAGE', '게임 종료! (한 판 플레이 완료)');
      this.isProcessingTurn = false;
      return;
    }

    const activePlayer = this.gameState.currentTurn === 'player'
      ? this.gameState.player
      : this.gameState.cpu;
    const canOfferGoStop = activePlayer.score >= 3 && (
      activePlayer.goCount === 0 || activePlayer.score > activePlayer.scoreAtLastGo
    );
    if (canOfferGoStop) {
      if (this.gameState.currentTurn === 'player') {
        this.gameState.phase = 'GO_STOP';
        this.eventBus.emit('GO_STOP_REQUIRED', {
          score: activePlayer.score,
          goCount: activePlayer.goCount,
        });
        this.eventBus.emit('STATUS_MESSAGE', `현재 점수 ${activePlayer.score}점입니다. 계속할지 선택하세요.`);
        this.isProcessingTurn = false;
        return;
      }
      this.finishRound(`CPU가 ${activePlayer.score}점에서 STOP했습니다.`);
      this.isProcessingTurn = false;
      return;
    }

    // Switch turn
    const nextTurn = this.gameState.switchTurn();
    this.updateTurnUI();
    this.isProcessingTurn = false;

    // If next turn is CPU, trigger AI after natural delay
    if (nextTurn === 'cpu') {
      await this.delay(650);
      await this.executeCpuTurn();
    }
  }

  public async resolveGoStop(choice: 'go' | 'stop'): Promise<void> {
    if (this.gameState.phase !== 'GO_STOP') return;
    this.isProcessingTurn = true;
    if (choice === 'stop') {
      this.finishRound(`플레이어가 ${this.gameState.player.score}점에서 STOP했습니다.`);
      this.isProcessingTurn = false;
      return;
    }
    this.gameState.player.goCount++;
    this.gameState.player.scoreAtLastGo = this.gameState.player.score;
    this.eventBus.emit('GO_COUNT_CHANGED', {
      playerId: 'player',
      goCount: this.gameState.player.goCount,
      multiplier: calculateFinalScore(1, this.gameState.player.goCount),
    });
    this.eventBus.emit('STATUS_MESSAGE', `${this.gameState.player.goCount} GO! 게임을 계속합니다.`);
    const nextTurn = this.gameState.switchTurn();
    this.updateTurnUI();
    this.isProcessingTurn = false;
    if (nextTurn === 'cpu') {
      await this.delay(650);
      await this.executeCpuTurn();
    }
  }

  private finishRound(message: string): void {
    this.gameState.phase = 'ROUND_OVER';
    this.eventBus.emit('GAME_OVER', {
      playerCaptured: this.gameState.player.captured.length,
      cpuCaptured: this.gameState.cpu.captured.length,
      playerScore: this.gameState.player.score,
      cpuScore: this.gameState.cpu.score,
      playerFinalScore: calculateFinalScore(this.gameState.player.score, this.gameState.player.goCount),
      cpuFinalScore: calculateFinalScore(this.gameState.cpu.score, this.gameState.cpu.goCount),
      message,
    });
    this.eventBus.emit('STATUS_MESSAGE', message);
  }

  private async executeCpuTurn(): Promise<void> {
    if (this.gameState.cpu.hand.length === 0) return;

    this.eventBus.emit('STATUS_MESSAGE', '상대방이 생각 중입니다...');
    await this.delay(400);

    const chosenCard = CpuAI.chooseHandCard(this.gameState.cpu.hand, this.gameState.floorCards);
    await this.executeTurn('cpu', chosenCard);
  }

  private updateTurnUI(): void {
    const isPlayer = this.gameState.currentTurn === 'player';
    this.eventBus.emit('TURN_CHANGED', {
      currentTurn: this.gameState.currentTurn,
      turnNumber: this.gameState.turnNumber,
      message: isPlayer ? '내 차례입니다. 낼 카드를 선택하세요.' : '상대방 차례입니다.',
    });
  }

  // --- Layout Helper Positions ---

  private getPlayerHandPosition(idx: number, total: number): { x: number; y: number; z: number } {
    const spacing = this.getHandSpacing(total);
    const startX = -((total - 1) * spacing) / 2;
    return {
      x: startX + idx * spacing,
      y: -2.2,   // was -2.7; moved up to not be under bottom UI bar
      z: 0.02 + idx * 0.003,
    };
  }

  private getCpuHandPosition(idx: number, total: number): { x: number; y: number; z: number } {
    const spacing = this.getHandSpacing(total) * 0.94;
    const startX = -((total - 1) * spacing) / 2;
    return {
      x: startX + idx * spacing,
      y: 2.8,
      z: 0.02 + idx * 0.003,
    };
  }

  private getHandSpacing(total: number): number {
    const responsiveSpacing = this.sceneManager.layoutScale >= 0.98
      ? 0.55
      : this.sceneManager.layoutScale >= 0.8
        ? 0.48
        : 0.40;
    return Math.min(responsiveSpacing, 4.2 / Math.max(total, 1));
  }

  private getFloorPosition(idx: number): { x: number; y: number; z: number } {
    // 2 rows of up to 4 columns

    const cols = 4;
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    const spacingX = 0.85;
    const spacingY = 1.05;
    const startX = -((cols - 1) * spacingX) / 2;
    const startY = 0.2;

    return {
      x: startX + col * spacingX,
      y: startY - row * spacingY,
      z: 0.01 + idx * 0.001,
    };
  }

  private getCapturedPosition(playerId: 'player' | 'cpu', card: CardDef, offset: number): { x: number; y: number; z: number } {
    const isPlayer = playerId === 'player';
    const baseY = isPlayer ? -1.52 : 1.52;
    const captured = (isPlayer ? this.gameState.player : this.gameState.cpu).captured;
    const categoryCards = captured.filter((capturedCard) => capturedCard.category === card.category);
    const categoryIndex = categoryCards.findIndex((capturedCard) => capturedCard.id === card.id);

    // Four fixed trays: gwang, animal/yeolkkeut, ribbon, junk/pi.
    // Keep both horizontal and vertical separation so one tray cannot cover
    // another on narrow portrait screens.
    let colX = 0;
    let lane = 0;
    if (card.category === 'gwang') {
      colX = -1.85;
      lane = 0;
    } else if (card.category === 'animal') {
      colX = -0.62;
      lane = 1;
    } else if (card.category === 'ribbon') {
      colX = 0.62;
      lane = 2;
    } else {
      colX = 1.85;
      lane = 3;
    }

    // Five compact slots per row keep the cards distinguishable while leaving
    // room for the representative 10-card group and larger pi group.
    const slotsPerRow = 5;
    const slot = Math.max(0, categoryIndex);
    const row = Math.floor(slot / slotsPerRow);
    const column = slot % slotsPerRow;
    const rowCount = Math.min(slotsPerRow, Math.max(1, categoryCards.length - row * slotsPerRow));
    const slotSpacing = 0.18;
    const rowDirection = isPlayer ? 1 : -1;
    const laneDirection = isPlayer ? 1 : -1;
    const laneGap = 0.16;

    return {
      x: colX - ((rowCount - 1) * slotSpacing) / 2 + column * slotSpacing,
      y: baseY + lane * laneGap * laneDirection + row * 0.24 * rowDirection,
      z: 0.04 + (slot * 0.003) + offset * 0.001,
    };
  }

  private repositionHand(playerId: 'player' | 'cpu'): void {
    const hand = playerId === 'player' ? this.gameState.player.hand : this.gameState.cpu.hand;
    hand.forEach((card, idx) => {
      const mesh = this.cardMeshes.get(card.id);
      if (mesh && mesh !== this.selectedCardMesh) {
        const target = playerId === 'player'
          ? this.getPlayerHandPosition(idx, hand.length)
          : this.getCpuHandPosition(idx, hand.length);
        this.animator.moveTo(mesh, target, 0, playerId === 'player', 180);
      }
    });
  }

  private repositionFloor(): void {
    this.gameState.floorCards.forEach((card, idx) => {
      const mesh = this.cardMeshes.get(card.id);
      if (mesh) {
        const target = this.getFloorPosition(idx);
        this.animator.moveTo(mesh, target, mesh.rotation.z, true, 180);
      }
    });
  }

  private clearAllCards(): void {
    this.cardMeshes.forEach((mesh) => {
      this.sceneManager.cardContainer.remove(mesh);
    });
    this.cardMeshes.clear();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
