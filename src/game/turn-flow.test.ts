import { describe, expect, it } from 'vitest';
import { GameState } from './GameState';
import { HWATU_CARDS } from './deck';
import { evaluateCardMatch, evaluateDadakMatch } from './rules';
import type { CardDef } from './types';

const card = (id: string): CardDef => HWATU_CARDS.find((item) => item.id === id)!;

function stateWith(
  playerHand: string[],
  cpuHand: string[],
  floor: string[],
  deck: string[],
): GameState {
  const state = new GameState();
  const used = new Set([...playerHand, ...cpuHand, ...floor, ...deck]);
  const remainder = HWATU_CARDS.filter((item) => !used.has(item.id)).map((item) => item.id);
  state.player.hand = playerHand.map(card);
  state.cpu.hand = cpuHand.map(card);
  state.floorCards = floor.map(card);
  // GameState draws from the end of the deck, so make the requested cards topmost.
  state.deck = [...remainder, ...deck].map(card);
  state.phase = 'PLAYER_SELECT';
  state.currentTurn = 'player';
  state.validateInvariants();
  return state;
}

async function playPlayerTurn(state: GameState, handId: string, chosenHandId?: string, chosenDrawId?: string) {
  const handCard = state.removeCardFromHand('player', handId)!;
  let handMatch = evaluateCardMatch(handCard, state.floorCards, chosenHandId ? card(chosenHandId) : undefined);
  if (handMatch.type === 'choice') {
    expect(chosenHandId).toBeDefined();
    handMatch = evaluateCardMatch(handCard, state.floorCards, card(chosenHandId!));
  }
  state.floorCards = handMatch.remainingOnFloor;
  if (handMatch.captured.length) state.addCaptured('player', handMatch.captured);

  state.phase = 'PLAYER_DRAW';
  const drawn = state.peekDeckCard()!;
  state.drawCardFromDeck();
  let drawMatch = evaluateCardMatch(drawn, state.floorCards, chosenDrawId ? card(chosenDrawId) : undefined);
  if (drawMatch.type === 'choice') {
    expect(chosenDrawId).toBeDefined();
    drawMatch = evaluateCardMatch(drawn, state.floorCards, card(chosenDrawId!));
  }
  state.floorCards = drawMatch.remainingOnFloor;
  if (drawMatch.captured.length) state.addCaptured('player', drawMatch.captured);
  state.validateInvariants();
  state.switchTurn();
}

describe('player turn state flow', () => {
  it('captures a hand match and then a different draw match, then changes turn', async () => {
    const state = stateWith(['01_01'], ['12_01'], ['01_02', '02_02'], ['02_01']);

    await playPlayerTurn(state, '01_01');

    expect(state.player.captured.map((item) => item.id)).toEqual(['01_01', '01_02', '02_01', '02_02']);
    expect(state.floorCards.some((item) => item.id === '02_02')).toBe(false);
    expect(state.currentTurn).toBe('cpu');
    expect(state.phase).toBe('CPU_TURN');
  });

  it('applies the same capture and score state updates to the CPU', () => {
    const state = stateWith(['01_01'], ['02_01'], ['02_02'], ['03_01']);
    const cpuCard = state.removeCardFromHand('cpu', '02_01')!;
    const match = evaluateCardMatch(cpuCard, state.floorCards);

    state.floorCards = match.remainingOnFloor;
    state.addCaptured('cpu', match.captured);

    expect(state.cpu.captured.map((item) => item.id)).toEqual(['02_01', '02_02']);
    expect(state.cpu.score).toBe(0);
    state.validateInvariants();
  });

  it('keeps both cards on the floor when hand and draw have no matches', async () => {
    const state = stateWith(['01_01'], ['12_01'], ['03_02'], ['04_01']);

    await playPlayerTurn(state, '01_01');

    expect(state.player.captured).toHaveLength(0);
    expect(state.floorCards.map((item) => item.id)).toEqual(['03_02', '01_01', '04_01']);
    expect(state.currentTurn).toBe('cpu');
    expect(state.phase).toBe('CPU_TURN');
  });

  it('resolves two-card hand and draw choices and does not remain in a choice phase', async () => {
    const state = stateWith(['06_01'], ['12_01'], ['06_02', '06_03'], ['07_01']);

    await playPlayerTurn(state, '06_01', '06_03');

    expect(state.player.captured.map((item) => item.id)).toEqual(['06_01', '06_03']);
    expect(state.phase).toBe('CPU_TURN');
    expect(state.currentTurn).toBe('cpu');
  });

  it('preserves all 48 unique cards across a capture and a no-match turn', async () => {
    const state = stateWith(['01_01'], ['12_01'], ['01_02'], ['04_01']);
    await playPlayerTurn(state, '01_01');
    state.validateInvariants();

    const zones = [...state.player.hand, ...state.cpu.hand, ...state.floorCards, ...state.deck,
      ...state.player.captured, ...state.cpu.captured];
    expect(zones).toHaveLength(48);
    expect(new Set(zones.map((item) => item.id)).size).toBe(48);
  });

  it('captures all four cards for a player 따닥 and advances to CPU', async () => {
    const state = stateWith(['06_01'], ['12_01'], ['06_02', '06_03'], ['06_04']);
    const handCard = state.removeCardFromHand('player', '06_01')!;
    const deckCard = state.peekDeckCard()!;
    const dadak = evaluateDadakMatch(handCard, state.floorCards, deckCard)!;

    state.drawCardFromDeck();
    state.floorCards = dadak.remainingOnFloor;
    state.addCaptured('player', dadak.captured);
    state.switchTurn();

    expect(state.player.captured.map((item) => item.id)).toEqual(['06_01', '06_02', '06_03', '06_04']);
    expect(state.floorCards).toHaveLength(0);
    expect(state.phase).toBe('CPU_TURN');
    expect(state.currentTurn).toBe('cpu');
    state.validateInvariants();
  });

  it('supports the same 따닥 capture for CPU', () => {
    const state = stateWith(['12_01'], ['06_01'], ['06_02', '06_03'], ['06_04']);
    const handCard = state.removeCardFromHand('cpu', '06_01')!;
    const deckCard = state.peekDeckCard()!;
    const dadak = evaluateDadakMatch(handCard, state.floorCards, deckCard)!;

    state.drawCardFromDeck();
    state.floorCards = dadak.remainingOnFloor;
    state.addCaptured('cpu', dadak.captured);

    expect(state.cpu.captured.map((item) => item.id)).toEqual(['06_01', '06_02', '06_03', '06_04']);
    state.validateInvariants();
  });
});
