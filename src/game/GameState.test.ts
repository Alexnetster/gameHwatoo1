import { describe, expect, it } from 'vitest';
import { GameState } from './GameState';

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
