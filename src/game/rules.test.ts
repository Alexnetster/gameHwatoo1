import { describe, expect, it } from 'vitest';
import { HWATU_CARDS } from './deck';
import {
  calculateScoreBreakdown,
  evaluateCardMatch,
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
