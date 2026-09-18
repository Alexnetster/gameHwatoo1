import { afterEach, describe, expect, it, vi } from 'vitest';
import { Game } from './Game';
import { GameState } from './GameState';
import { HWATU_CARDS } from './deck';

vi.mock('../three/SceneManager', () => ({
  SceneManager: class {
    layoutScale = 1;
  },
}));
vi.mock('../three/InteractionManager', () => ({
  InteractionManager: class {
    onCardClick() {}
  },
}));
vi.mock('../three/CardAnimator', () => ({
  CardAnimator: { getInstance: () => ({ moveTo: vi.fn().mockResolvedValue(undefined) }) },
}));

function createGame(): Game {
  return new Game({} as HTMLElement);
}

function expectFinitePosition(position: { x: number; y: number; z: number }): void {
  expect(Object.values(position).every(Number.isFinite)).toBe(true);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Game responsive card layout', () => {
  it('keeps a ten-card hand inside the 4.2 unit layout width at every scale tier', () => {
    const game = createGame();
    const getPosition = game['getPlayerHandPosition'].bind(game) as (index: number, total: number) => { x: number; y: number; z: number };
    const setScale = (scale: number) => { game['sceneManager']['layoutScale'] = scale; };

    for (const scale of [1, 0.8, 0.68]) {
      setScale(scale);
      const positions = Array.from({ length: 10 }, (_, index) => getPosition(index, 10));
      positions.forEach(expectFinitePosition);
      expect(positions[0].x).toBeCloseTo(-positions.at(-1)!.x);
      expect(positions.at(-1)!.x - positions[0].x).toBeLessThanOrEqual(4.2);
    }
  });

  it('keeps floor positions finite and within the four-column table grid', () => {
    const game = createGame();
    const state = new GameState();
    state.floorCards = HWATU_CARDS.slice(0, 16);
    game['gameState'] = state;
    const getPosition = game['getFloorPosition'].bind(game) as (index: number) => { x: number; y: number; z: number };

    const positions = state.floorCards.map((_, index) => getPosition(index));
    positions.forEach(expectFinitePosition);
    expect(Math.max(...positions.map(({ x }) => x))).toBeLessThanOrEqual(1.275);
    expect(Math.min(...positions.map(({ x }) => x))).toBeGreaterThanOrEqual(-1.275);
    expect(new Set(positions.map(({ x, y }) => `${x}:${y}`)).size).toBe(positions.length);
  });

  it('separates captured cards by category and gives every card a stable slot', () => {
    const game = createGame();
    const state = new GameState();
    state.player.captured = HWATU_CARDS.slice(0, 20);
    game['gameState'] = state;
    const getPosition = game['getCapturedPosition'].bind(game) as (playerId: 'player' | 'cpu', card: typeof HWATU_CARDS[number], offset: number) => { x: number; y: number; z: number };

    const positions = state.player.captured.map((item, index) => getPosition('player', item, index));
    positions.forEach(expectFinitePosition);
    expect(new Set(positions.map(({ x, y }) => `${x}:${y}`)).size).toBe(positions.length);

    const categoryCenters = new Map<string, number>();
    for (const item of state.player.captured) categoryCenters.set(item.category, getPosition('player', item, 0).x);
    expect(categoryCenters.size).toBeGreaterThan(1);
    expect(new Set(categoryCenters.values()).size).toBe(categoryCenters.size);
  });
});
