import { afterEach, describe, expect, it, vi } from 'vitest';
import { Game } from './Game';
import { GameState } from './GameState';
import { EventBus } from './EventBus';
import { HWATU_CARDS } from './deck';
import { calculateScore, type RuleOptions } from './rules';
import type { CardDef, PlayerId } from './types';
import type { CardMesh } from '../three/CardMesh';

// Mock only rendering and input boundaries. The production Game resolves
// matching, choices, rewards, scoring, and turn transitions in these tests.
vi.mock('../three/SceneManager', () => ({ SceneManager: class { layoutScale = 1; } }));
vi.mock('../three/InteractionManager', () => ({ InteractionManager: class { onCardClick() {} } }));
vi.mock('../three/CardAnimator', () => ({
  CardAnimator: { getInstance: () => ({ moveTo: vi.fn().mockResolvedValue(undefined) }) },
}));

const card = (id: string): CardDef => HWATU_CARDS.find((item) => item.id === id)!;
const ids = (cards: CardDef[]): string[] => cards.map((item) => item.id);

function stateWith(
  playerHand: string[], cpuHand: string[], floor: string[], deck: string[],
  captured: Partial<Record<PlayerId, string[]>> = {}, options: Partial<RuleOptions> = {},
): GameState {
  const state = new GameState(options);
  const used = new Set([...playerHand, ...cpuHand, ...floor, ...deck,
    ...(captured.player ?? []), ...(captured.cpu ?? [])]);
  state.player.hand = playerHand.map(card);
  state.cpu.hand = cpuHand.map(card);
  for (const actor of ['player', 'cpu'] as const) {
    state[actor].captured = (captured[actor] ?? []).map(card);
    state[actor].score = calculateScore(state[actor].captured);
  }
  state.floorCards = floor.map(card);
  // Draws pop from the end, so requested cards are topmost.
  state.deck = [...HWATU_CARDS.filter((item) => !used.has(item.id)), ...deck.map(card)];
  state.phase = 'PLAYER_SELECT';
  state.validateInvariants();
  return state;
}

function gameWith(state: GameState) {
  const game = new Game({} as HTMLElement, state.specialRuleOptions);
  game['gameState'] = state;
  for (const cardDef of HWATU_CARDS) {
    game['cardMeshes'].set(cardDef.id, {
      cardDef, rotation: { z: 0 }, setDisplayScale: vi.fn(), setMatchHighlight: vi.fn(),
    } as unknown as CardMesh);
  }
  game['delay'] = vi.fn().mockResolvedValue(undefined);
  const runCpu = game['executeCpuTurn'].bind(game);
  // Stop after one turn; CPU tests explicitly invoke its real entry point.
  game['executeCpuTurn'] = vi.fn().mockResolvedValue(undefined);
  const emit = vi.spyOn(EventBus.getInstance(), 'emit');
  return {
    game, emit,
    playPlayer: (id: string) => game['handleCardClick'](game['cardMeshes'].get(id)!),
    playCpu: async () => {
      state.currentTurn = 'cpu';
      state.phase = 'CPU_TURN';
      await runCpu();
    },
  };
}

function expectConserved(state: GameState): void {
  state.validateInvariants();
  const zones = [...state.player.hand, ...state.cpu.hand, ...state.floorCards,
    ...state.deck, ...state.player.captured, ...state.cpu.captured];
  expect(zones).toHaveLength(48);
  expect(new Set(ids(zones)).size).toBe(48);
}

afterEach(() => {
  vi.restoreAllMocks();
  EventBus.getInstance().clear();
});

describe('Game turn flow', () => {
  it('captures a hand match and a different draw match, then advances to CPU', async () => {
    const state = stateWith(['01_01'], ['12_01'], ['01_02', '02_02'], ['02_01']);
    const { game, playPlayer, emit } = gameWith(state);
    await playPlayer('01_01');
    expect(ids(state.player.captured)).toEqual(['01_01', '01_02', '02_01', '02_02']);
    expect(state.floorCards).toHaveLength(0);
    expect(state.phase).toBe('CPU_TURN');
    expect(state.currentTurn).toBe('cpu');
    expect(game['isProcessingTurn']).toBe(false);
    expect(emit).not.toHaveBeenCalledWith('JJOK', expect.anything());
    expectConserved(state);
  });

  it('applies the full hand and deck flow to CPU', async () => {
    const state = stateWith(['01_01'], ['02_01'], ['02_02'], ['03_01']);
    await gameWith(state).playCpu();
    expect(ids(state.cpu.captured)).toEqual(['02_01', '02_02']);
    expect(ids(state.floorCards)).toEqual(['03_01']);
    expect(state.cpu.score).toBe(0);
    expect(state.phase).toBe('PLAYER_SELECT');
    expectConserved(state);
  });

  it('leaves unrelated hand and deck cards on the floor', async () => {
    const state = stateWith(['01_01'], ['12_01'], ['03_02'], ['04_01']);
    const { playPlayer, emit } = gameWith(state);
    await playPlayer('01_01');
    expect(state.player.captured).toHaveLength(0);
    expect(ids(state.floorCards)).toEqual(['03_02', '01_01', '04_01']);
    expect(state.phase).toBe('CPU_TURN');
    expect(emit).not.toHaveBeenCalledWith('JJOK', expect.anything());
    expectConserved(state);
  });

  it('pauses for actual hand and draw choices and captures only the selected pairs', async () => {
    const state = stateWith(['06_01'], ['12_01'], ['06_02', '06_03', '07_02', '07_03'], ['07_01']);
    const { game, playPlayer, emit } = gameWith(state);
    await playPlayer('06_01');
    expect(state.phase).toBe('PLAYER_CHOICE');
    expect(ids(state.pendingChoiceCandidates)).toEqual(['06_02', '06_03']);
    expect(game['isProcessingTurn']).toBe(false);
    await game.resolveUserChoice(card('06_03'));
    expect(state.phase).toBe('PLAYER_DRAW_CHOICE');
    expect(ids(state.pendingChoiceCandidates)).toEqual(['07_02', '07_03']);
    await game.resolveUserChoice(card('07_02'));
    expect(ids(state.player.captured)).toEqual(['06_01', '06_03', '07_01', '07_02']);
    expect(ids(state.floorCards)).toEqual(['06_02', '07_03']);
    expect(state.phase).toBe('CPU_TURN');
    expect(state.pendingChoiceCandidates).toEqual([]);
    expect(state.pendingHandCard).toBeNull();
    expect(state.pendingDrawCard).toBeNull();
    expect(emit).not.toHaveBeenCalledWith('JJOK', expect.anything());
    expectConserved(state);
  });

  it.each(['player', 'cpu'] as const)('preserves 따닥 for %s with 쪽 rewards enabled', async (actor) => {
    const opponent = actor === 'player' ? 'cpu' : 'player';
    const state = stateWith(
      actor === 'player' ? ['06_01'] : ['12_01'], actor === 'cpu' ? ['06_01'] : ['12_01'],
      ['06_02', '06_03'], ['06_04'], { [opponent]: ['01_03'] }, { jjokPiReward: 2 },
    );
    const { playPlayer, playCpu, emit } = gameWith(state);
    await (actor === 'player' ? playPlayer('06_01') : playCpu());
    expect(ids(state[actor].captured)).toEqual(['06_01', '06_02', '06_03', '06_04']);
    expect(ids(state[opponent].captured)).toEqual(['01_03']);
    expect(state.floorCards).toHaveLength(0);
    expect(state.currentTurn).toBe(opponent);
    expect(emit).not.toHaveBeenCalledWith('CHOICE_REQUIRED', expect.anything());
    expect(emit).not.toHaveBeenCalledWith('JJOK', expect.anything());
    expectConserved(state);
  });

  it.each(['player', 'cpu'] as const)('preserves 설사 and its separate pi reward for %s', async (actor) => {
    const opponent = actor === 'player' ? 'cpu' : 'player';
    const state = stateWith(
      actor === 'player' ? ['06_01'] : ['12_01'], actor === 'cpu' ? ['06_01'] : ['12_01'],
      ['06_02'], ['06_03'], { [opponent]: ['01_03', '02_03'] }, { seolsaPiReward: 1, jjokPiReward: 2 },
    );
    const { playPlayer, playCpu, emit } = gameWith(state);
    await (actor === 'player' ? playPlayer('06_01') : playCpu());
    expect(ids(state.floorCards)).toEqual(['06_02', '06_01', '06_03']);
    expect(ids(state[actor].captured)).toEqual(['01_03']);
    expect(ids(state[opponent].captured)).toEqual(['02_03']);
    expect(emit).toHaveBeenCalledWith('STATUS_MESSAGE', expect.stringContaining('설사!'));
    expect(emit).not.toHaveBeenCalledWith('JJOK', expect.anything());
    expectConserved(state);
  });

  it('keeps ordinary matching when 설사 is disabled without awarding 쪽', async () => {
    const state = stateWith(['06_01'], ['12_01'], ['06_02'], ['06_03'],
      { cpu: ['01_03'] }, { seolsaEnabled: false, jjokPiReward: 2 });
    const { playPlayer, emit } = gameWith(state);
    await playPlayer('06_01');
    expect(ids(state.player.captured)).toEqual(['06_01', '06_02']);
    expect(ids(state.floorCards)).toEqual(['06_03']);
    expect(ids(state.cpu.captured)).toEqual(['01_03']);
    expect(emit).not.toHaveBeenCalledWith('JJOK', expect.anything());
    expectConserved(state);
  });

  it('preserves a three-card floor capture without awarding 쪽', async () => {
    const state = stateWith(['06_01'], ['12_01'], ['06_02', '06_03', '06_04'], ['07_01'],
      { cpu: ['01_03'] }, { jjokPiReward: 2 });
    const { playPlayer, emit } = gameWith(state);
    await playPlayer('06_01');
    expect(ids(state.player.captured)).toEqual(['06_01', '06_02', '06_03', '06_04']);
    expect(ids(state.floorCards)).toEqual(['07_01']);
    expect(ids(state.cpu.captured)).toEqual(['01_03']);
    expect(emit).not.toHaveBeenCalledWith('JJOK', expect.anything());
    expectConserved(state);
  });

  it('resolves the hand alone when the deck is empty', async () => {
    const state = stateWith(['06_01'], ['12_01'], ['06_02'], [], {}, { jjokPiReward: 2 });
    const capturedBefore = [...state.deck];
    state.cpu.captured = capturedBefore;
    state.cpu.score = calculateScore(state.cpu.captured);
    state.deck = [];
    const { playPlayer, emit } = gameWith(state);
    await playPlayer('06_01');
    expect(ids(state.player.captured)).toEqual(['06_01', '06_02']);
    expect(state.cpu.captured).toEqual(capturedBefore);
    expect(emit).not.toHaveBeenCalledWith('JJOK', expect.anything());
    expectConserved(state);
  });
});

describe('Game 쪽 event and pi recovery', () => {
  for (const actor of ['player', 'cpu'] as const) {
    const opponent = actor === 'player' ? 'cpu' : 'player';
    it.each([0, 1, 2] as const)(`${actor} captures 쪽 and takes %i pi cards exactly once`, async (reward) => {
      const state = stateWith(
        actor === 'player' ? ['06_01'] : ['12_01'], actor === 'cpu' ? ['06_01'] : ['12_01'],
        ['07_01'], ['06_04'], { [opponent]: ['01_01', '01_03', '02_03'] }, { jjokPiReward: reward },
      );
      const { game, playPlayer, playCpu, emit } = gameWith(state);
      const draw = vi.spyOn(state, 'drawCardFromDeck');
      const transfer = vi.spyOn(state, 'transferPi');
      await (actor === 'player' ? playPlayer('06_01') : playCpu());
      const taken = ['01_03', '02_03'].slice(0, reward);
      expect(ids(state[actor].captured)).toEqual(['06_01', '06_04', ...taken]);
      expect(ids(state[opponent].captured)).toEqual(['01_01', ...['01_03', '02_03'].slice(reward)]);
      expect(ids(state.floorCards)).toEqual(['07_01']);
      expect(draw).toHaveBeenCalledTimes(1);
      expect(transfer).toHaveBeenCalledExactlyOnceWith(opponent, actor, reward);
      expect(emit.mock.calls.filter(([event]) => event === 'JJOK')).toEqual([['JJOK', {
        playerId: actor, captured: [card('06_01'), card('06_04')], transferredPi: taken.map(card),
      }]]);
      expect(emit).toHaveBeenCalledWith('CARD_CAPTURED', {
        playerId: actor, captured: state[actor].captured, total: state[actor].captured,
      });
      if (reward > 0) {
        expect(emit).toHaveBeenCalledWith('CAPTURE_UPDATED', {
          playerId: opponent, total: state[opponent].captured,
        });
        expect(emit).toHaveBeenCalledWith('STATUS_MESSAGE', expect.stringContaining(`피 ${reward}장 회수`));
        for (const id of taken) {
          expect(game['animator'].moveTo).toHaveBeenCalledWith(
            game['cardMeshes'].get(id), game['getCapturedPosition'](actor, card(id), 0), 0, true, 260,
          );
        }
      } else {
        expect(emit).not.toHaveBeenCalledWith('CAPTURE_UPDATED', expect.anything());
      }
      expect(emit).not.toHaveBeenCalledWith('CHOICE_REQUIRED', expect.anything());
      expect(state.currentTurn).toBe(opponent);
      expect(state.phase).toBe(actor === 'player' ? 'CPU_TURN' : 'PLAYER_SELECT');
      expect(state.turnNumber).toBe(2);
      expect(game['isProcessingTurn']).toBe(false);
      expectConserved(state);
    });
  }

  it.each([
    ['no captured cards', [], []],
    ['no pi', ['01_01', '02_01'], []],
    ['only one pi', ['01_01', '01_03'], ['01_03']],
    ['ssangpi as one physical card', ['11_02', '01_03', '02_03'], ['11_02', '01_03']],
  ] as const)('handles %s without losing or inventing cards', async (_label, source, taken) => {
    const state = stateWith(['06_01'], ['12_01'], [], ['06_04'],
      { cpu: [...source] }, { jjokPiReward: 2 });
    await gameWith(state).playPlayer('06_01');
    expect(ids(state.player.captured)).toEqual(['06_01', '06_04', ...taken]);
    expect(ids(state.cpu.captured)).toEqual(source.filter((id) => !(taken as readonly string[]).includes(id)));
    expectConserved(state);
  });

  it.each(['player', 'cpu'] as const)('updates both scores before %s GO/STOP after pi recovery', async (actor) => {
    const opponent = actor === 'player' ? 'cpu' : 'player';
    const state = stateWith(
      actor === 'player' ? ['06_03'] : ['12_02'], actor === 'cpu' ? ['06_03'] : ['12_02'], [], ['06_04'], {
      [actor]: ['01_01', '03_01', '12_01', '07_03', '07_04', '08_03', '08_04', '09_03', '09_04', '10_03'],
      [opponent]: ['01_03', '01_04', '02_03', '02_04', '03_03', '03_04', '04_03', '04_04', '05_03', '05_04'],
    }, { jjokPiReward: 1 });
    const { game, playPlayer, playCpu, emit } = gameWith(state);
    expect(state[actor].score).toBe(2);
    expect(state[opponent].score).toBe(1);
    await (actor === 'player' ? playPlayer('06_03') : playCpu());
    expect(state[actor].score).toBe(3);
    expect(state[opponent].score).toBe(0);
    expect(emit).toHaveBeenCalledWith('CAPTURE_UPDATED', { playerId: opponent, total: state[opponent].captured });
    expect(state.phase).toBe(actor === 'player' ? 'GO_STOP' : 'ROUND_OVER');
    if (actor === 'player') {
      expect(emit).toHaveBeenCalledWith('GO_STOP_REQUIRED', { score: 3, goCount: 0 });
    } else {
      expect(emit).toHaveBeenCalledWith('GAME_OVER', expect.objectContaining({ cpuScore: 3, playerScore: 0 }));
    }
    expect(game['isProcessingTurn']).toBe(false);
    expectConserved(state);
  });

  it('finishes the round after 쪽 on the last hand and deck cards', async () => {
    const state = stateWith(['06_01'], [], [], ['06_04']);
    state.cpu.captured = state.deck.slice(0, -1);
    state.cpu.score = calculateScore(state.cpu.captured);
    state.deck = [card('06_04')];
    const { playPlayer, emit } = gameWith(state);
    await playPlayer('06_01');
    expect(state.phase).toBe('ROUND_OVER');
    expect(state.deck).toEqual([]);
    expect(ids(state.player.captured)).toEqual(['06_01', '06_04']);
    expect(emit).toHaveBeenCalledWith('GAME_OVER', expect.anything());
    expectConserved(state);
  });
});
