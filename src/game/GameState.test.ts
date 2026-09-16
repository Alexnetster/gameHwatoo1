import { describe, expect, it } from 'vitest';
import { GameState, validateCardZoneInvariants } from './GameState';
import { createSeededRandom } from './deck';

describe('GameState initial deal', () => {
  it('deals 10/10/8/20 and preserves all 48 unique cards', () => {
    const state = new GameState();
    const deal = state.initNewGame(() => 0.5);
    const allCards = [...deal.playerHand, ...deal.cpuHand, ...deal.floor, ...deal.deck];

    expect(deal.playerHand).toHaveLength(10);
    expect(deal.cpuHand).toHaveLength(10);
    expect(deal.floor).toHaveLength(8);
    expect(deal.deck).toHaveLength(20);
    expect(new Set(allCards.map((card) => card.id)).size).toBe(48);
    expect(state.phase).toBe('PLAYER_SELECT');
  });

  it('repeats a seeded deal and exposes zone invariants for scenario fixtures', () => {
    const first = new GameState().initNewGame(createSeededRandom('jjok-fixture'));
    const second = new GameState().initNewGame(createSeededRandom('jjok-fixture'));

    expect(first.playerHand.map((card) => card.id)).toEqual(second.playerHand.map((card) => card.id));
    expect(first.cpuHand.map((card) => card.id)).toEqual(second.cpuHand.map((card) => card.id));
    expect(first.floor.map((card) => card.id)).toEqual(second.floor.map((card) => card.id));
    expect(first.deck.map((card) => card.id)).toEqual(second.deck.map((card) => card.id));
    expect(() => validateCardZoneInvariants({
      playerHand: first.playerHand,
      cpuHand: first.cpuHand,
      floorCards: first.floor,
      deck: first.deck,
      playerCaptured: [],
      cpuCaptured: [],
    })).not.toThrow();
  });

  it('rejects duplicate cards and invalid month-family metadata', () => {
    const deal = new GameState().initNewGame(createSeededRandom(7));
    expect(() => validateCardZoneInvariants({
      playerHand: [...deal.playerHand, deal.cpuHand[0]],
      cpuHand: deal.cpuHand,
      floorCards: deal.floor,
      deck: deal.deck.slice(1),
      playerCaptured: [],
      cpuCaptured: [],
    })).toThrow('Invalid card state');

    const malformed = { ...deal.playerHand[0], month: deal.playerHand[0].month + 1 };
    expect(() => validateCardZoneInvariants({
      playerHand: [malformed, ...deal.playerHand.slice(1)],
      cpuHand: deal.cpuHand,
      floorCards: deal.floor,
      deck: deal.deck,
      playerCaptured: [],
      cpuCaptured: [],
    })).toThrow('metadata mismatch');
  });

  it('counts pending hand and drawn cards as owned zones without counting choice references', () => {
    const state = new GameState();
    state.initNewGame(createSeededRandom('pending-fixture'));
    const pendingHandCard = state.player.hand.pop()!;
    const pendingDrawCard = state.deck.pop()!;

    expect(() => validateCardZoneInvariants({
      playerHand: state.player.hand,
      cpuHand: state.cpu.hand,
      floorCards: state.floorCards,
      deck: state.deck,
      playerCaptured: state.player.captured,
      cpuCaptured: state.cpu.captured,
      pendingHandCard,
      pendingDrawCard,
      // Candidate arrays are references and intentionally not part of zones.
    })).not.toThrow();

    expect(() => validateCardZoneInvariants({
      playerHand: state.player.hand,
      cpuHand: state.cpu.hand,
      floorCards: state.floorCards,
      deck: state.deck,
      playerCaptured: state.player.captured,
      cpuCaptured: state.cpu.captured,
      pendingHandCard,
    })).toThrow('Invalid card state');
  });

  it('defaults 쪽 pi recovery to zero and retains configured options between rounds', () => {
    const defaults = new GameState();
    const configured = new GameState({ jjokPiReward: 2 });

    expect(defaults.specialRuleOptions.jjokPiReward).toBe(0);
    expect(configured.specialRuleOptions).toEqual({
      seolsaEnabled: true, seolsaPiReward: 0, jjokPiReward: 2,
    });
    configured.initNewGame(() => 0.5);
    configured.initNewGame(() => 0.25);
    expect(configured.specialRuleOptions.jjokPiReward).toBe(2);
    expect(defaults.specialRuleOptions.jjokPiReward).toBe(0);
  });
});
