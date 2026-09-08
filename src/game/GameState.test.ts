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
});
