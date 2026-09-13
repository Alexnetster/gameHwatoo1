import { describe, expect, it } from 'vitest';
import { HWATU_CARDS } from './deck';
import {
  calculateScoreBreakdown,
  calculateScoreHints,
  calculateFinalScore,
  calculateGoMultiplier,
  evaluateCardMatch,
  evaluateDadakMatch,
  evaluateJjokMatch,
  isSeolsa,
  validateMatchResult,
} from './rules';

const card = (id: string) => HWATU_CARDS.find((candidate) => candidate.id === id)!;

describe('Hwatu match rules', () => {
  it('leaves the played card on the floor when there is no family match', () => {
    const result = evaluateCardMatch(card('01_01'), [card('02_01')]);

    expect(result.type).toBe('none');
    expect(result.captured).toHaveLength(0);
    expect(result.remainingOnFloor.map((item) => item.id)).toEqual(['02_01', '01_01']);
  });

  it('captures the played card and the only matching floor card', () => {
    const result = evaluateCardMatch(card('01_01'), [card('01_02'), card('02_01')]);

    expect(result.type).toBe('single');
    expect(result.captured.map((item) => item.id)).toEqual(['01_01', '01_02']);
    expect(result.remainingOnFloor.map((item) => item.id)).toEqual(['02_01']);
  });

  it('requires a choice when two cards from the same family are on the floor', () => {
    const result = evaluateCardMatch(card('06_01'), [card('06_02'), card('06_03')]);

    expect(result.type).toBe('choice');
    expect(result.captured).toHaveLength(0);
    expect(result.candidates?.map((item) => item.id)).toEqual(['06_02', '06_03']);
  });

  it('captures only the selected candidate after a two-card choice', () => {
    const result = evaluateCardMatch(
      card('06_01'),
      [card('06_02'), card('06_03')],
      card('06_03'),
    );

    expect(result.type).toBe('single');
    expect(result.captured.map((item) => item.id)).toEqual(['06_01', '06_03']);
    expect(result.remainingOnFloor.map((item) => item.id)).toEqual(['06_02']);
  });

  it('recognizes Seolsa when the deck repeats the hand-match family', () => {
    const handMatch = evaluateCardMatch(card('06_01'), [card('06_02')]);

    expect(isSeolsa(handMatch, card('06_03'))).toBe(true);
    expect(isSeolsa(handMatch, card('07_03'))).toBe(false);
    expect(isSeolsa(handMatch, card('06_03'), { seolsaEnabled: false, seolsaPiReward: 0 })).toBe(false);
  });

  it('captures all four family cards when three are on the floor', () => {
    const result = evaluateCardMatch(card('06_01'), [card('06_02'), card('06_03'), card('06_04')]);

    expect(result.type).toBe('triple');
    expect(result.captured.map((item) => item.id)).toEqual(['06_01', '06_02', '06_03', '06_04']);
    expect(result.remainingOnFloor).toHaveLength(0);
  });

  it('captures hand, two floor cards, and deck card as 따닥', () => {
    const result = evaluateDadakMatch(
      card('06_01'),
      [card('06_02'), card('06_03'), card('07_01')],
      card('06_04'),
    );

    expect(result?.type).toBe('dadak');
    expect(result?.captured.map((item) => item.id)).toEqual(['06_01', '06_02', '06_03', '06_04']);
    expect(result?.remainingOnFloor.map((item) => item.id)).toEqual(['07_01']);
  });

  it('does not classify a two-card choice as 따닥 when the deck family differs', () => {
    expect(evaluateDadakMatch(
      card('06_01'),
      [card('06_02'), card('06_03')],
      card('07_04'),
    )).toBeNull();
  });

  it('captures only the hand and deck pair as 쪽 without changing the original floor', () => {
    const floor = [card('07_01')];
    const result = evaluateJjokMatch(card('06_01'), floor, card('06_04'))!;

    expect(result.type).toBe('jjok');
    expect(result.playedCard).toBe(card('06_01'));
    expect(result.drawnCard).toBe(card('06_04'));
    expect(result.captured).toEqual([card('06_01'), card('06_04')]);
    expect(result.remainingOnFloor).toEqual(floor);
    expect(floor).toEqual([card('07_01')]);
    expect(isSeolsa(evaluateCardMatch(card('06_01'), floor), card('06_04'))).toBe(false);
    expect(evaluateDadakMatch(card('06_01'), floor, card('06_04'))).toBeNull();
  });

  it.each([
    ['different deck month', [], '07_04'],
    ['single floor match / seolsa', ['06_02'], '06_04'],
    ['two floor matches / dadak', ['06_02', '06_03'], '06_04'],
    ['three floor matches', ['06_02', '06_03', '06_04'], '07_04'],
  ] as const)('does not report 쪽 for %s', (_label, floor, drawn) => {
    expect(evaluateJjokMatch(card('06_01'), floor.map(card), card(drawn))).toBeNull();
  });

  it('uses the card id family for 쪽, independently of display metadata', () => {
    expect(evaluateJjokMatch(
      { ...card('06_01'), month: 7 },
      [card('07_01')],
      { ...card('06_04'), month: 8 },
    )?.type).toBe('jjok');
  });

  it('validates the exact pair and drawn-card provenance of 쪽', () => {
    const match = evaluateJjokMatch(card('06_01'), [], card('06_04'))!;
    expect(() => validateMatchResult({ ...match, captured: [card('06_01')] })).toThrow('exactly 2');
    expect(() => validateMatchResult({ ...match, drawnCard: undefined })).toThrow('drawn card');
    expect(() => validateMatchResult({ ...match, captured: [card('06_01'), card('06_02')] })).toThrow('drawn card');
    expect(() => validateMatchResult({ ...match, captured: [card('06_02'), card('06_04')] })).toThrow('played card');
    expect(() => validateMatchResult({
      ...match, drawnCard: card('06_01'), captured: [card('06_01'), card('06_01')],
    })).toThrow('distinct');
    expect(() => validateMatchResult({
      ...match, drawnCard: card('07_01'), captured: [card('06_01'), card('07_01')],
    })).toThrow('same family');
  });

  it('rejects malformed triple results instead of allowing odd capture counts', () => {
    expect(() => validateMatchResult({
      type: 'triple',
      playedCard: card('06_01'),
      captured: [card('06_02'), card('06_03'), card('06_04'), card('05_01'), card('05_02')],
      remainingOnFloor: [],
    })).toThrow('exactly 4');
  });
});

describe('Hwatu scoring breakdown', () => {
  it('reports the basic three-gwang score and reason', () => {
    const breakdown = calculateScoreBreakdown([card('01_01'), card('03_01'), card('08_01')]);

    expect(breakdown.total).toBe(3);
    expect(breakdown.reasons).toContain('3광 = 3점');
  });

  it('counts ssangpi as two junk cards', () => {
    const breakdown = calculateScoreBreakdown([
      card('11_02'), card('12_04'),
      card('01_03'), card('02_03'), card('03_03'), card('04_03'),
      card('05_03'), card('06_03'), card('07_03'), card('08_03'),
    ]);

    expect(breakdown.total).toBe(1);
    expect(breakdown.reasons).toContain('피 10장 단위 = 1점');
  });
});

describe('Hwatu scoring hints', () => {
  it('warns about milestones that are one or two cards away', () => {
    const hints = calculateScoreHints([
      card('01_01'), card('03_01'),
      card('02_01'), card('04_01'),
      card('01_02'), card('02_02'),
      card('01_03'), card('02_03'), card('03_03'), card('04_03'),
      card('05_03'), card('06_03'), card('07_03'), card('08_03'),
    ]);

    expect(hints).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: '광', current: 2, target: 3, remaining: 1 }),
      expect.objectContaining({ label: '고도리', current: 2, target: 3, remaining: 1 }),
      expect.objectContaining({ label: '홍단', current: 2, target: 3, remaining: 1 }),
      expect.objectContaining({ label: '피', current: 8, target: 10, remaining: 2 }),
    ]));
  });
});

describe('Go multiplier', () => {
  it('uses 2x, 4x, and 8x for 1, 2, and 3 go', () => {
    expect(calculateGoMultiplier(0)).toBe(1);
    expect(calculateGoMultiplier(1)).toBe(2);
    expect(calculateGoMultiplier(2)).toBe(4);
    expect(calculateGoMultiplier(3)).toBe(8);
    expect(calculateFinalScore(3, 3)).toBe(24);
  });
});
