import { CardDef } from './types';

export type MatchResultType = 'none' | 'single' | 'choice' | 'triple' | 'dadak';

export interface MatchResult {
  type: MatchResultType;
  playedCard: CardDef;
  captured: CardDef[];
  candidates?: CardDef[]; // When type === 'choice'
  drawnCard?: CardDef; // The deck card included in a dadak capture
  remainingOnFloor: CardDef[];
}

export interface SpecialRuleOptions {
  seolsaEnabled: boolean;
  seolsaPiReward: 0 | 1 | 2;
}

export const DEFAULT_SPECIAL_RULE_OPTIONS: SpecialRuleOptions = {
  seolsaEnabled: true,
  seolsaPiReward: 0,
};

export function validateMatchResult(result: MatchResult): void {
  if (result.type === 'none' && result.captured.length !== 0) {
    throw new Error('A non-matching play cannot capture cards');
  }
  if (result.type === 'choice' && result.captured.length !== 0) {
    throw new Error('A pending choice cannot capture cards');
  }
  if (result.type === 'single' && result.captured.length !== 2) {
    throw new Error(`A single match must capture 2 cards, got ${result.captured.length}`);
  }
  if (result.type === 'triple' && result.captured.length !== 4) {
    throw new Error(`A triple match must capture exactly 4 cards, got ${result.captured.length}`);
  }
  if (result.type === 'dadak' && result.captured.length !== 4) {
    throw new Error(`A dadak match must capture exactly 4 cards, got ${result.captured.length}`);
  }
  if (result.type === 'dadak') {
    if (!result.drawnCard || !result.captured.some((card) => card.id === result.drawnCard!.id)) {
      throw new Error('A dadak match must include the drawn card in captured cards');
    }
  }

  if (
    (result.type === 'single' || result.type === 'triple' || result.type === 'dadak') &&
    !result.captured.some((card) => card.id === result.playedCard.id)
  ) {
    throw new Error(`${result.type} match must include the played card in captured cards`);
  }
}

/**
 * 따닥: two cards of a family are already on the floor, and both the hand
 * card and the revealed deck card complete that same family.  The deck card
 * is deliberately included in the result so the caller can remove it from
 * the deck atomically with the four-card capture.
 */
export function evaluateDadakMatch(
  playedCard: CardDef,
  floorCards: CardDef[],
  drawnCard: CardDef,
): MatchResult | null {
  const matches = findFloorMatches(playedCard, floorCards);
  if (matches.length !== 2 || getCardFamily(drawnCard) !== getCardFamily(playedCard)) {
    return null;
  }
  const result: MatchResult = {
    type: 'dadak',
    playedCard,
    drawnCard,
    captured: [playedCard, ...matches, drawnCard],
    remainingOnFloor: floorCards.filter((card) => !matches.some((match) => match.id === card.id)),
  };
  validateMatchResult(result);
  return result;
}

/** The first two digits of the card id are the authoritative month family. */
export function getCardFamily(card: CardDef): number {
  return Number.parseInt(card.id.slice(0, 2), 10);
}

export function isSeolsa(
  handMatch: MatchResult,
  drawnCard: CardDef,
  options: SpecialRuleOptions = DEFAULT_SPECIAL_RULE_OPTIONS,
): boolean {
  return options.seolsaEnabled &&
    handMatch.type === 'single' &&
    getCardFamily(handMatch.playedCard) === getCardFamily(drawnCard);
}

export function findFloorMatches(playedCard: CardDef, floorCards: CardDef[]): CardDef[] {
  const family = getCardFamily(playedCard);
  return floorCards.filter((card) => getCardFamily(card) === family);
}

export function evaluateCardMatch(
  playedCard: CardDef,
  floorCards: CardDef[],
  chosenCandidate?: CardDef
): MatchResult {
  const matches = findFloorMatches(playedCard, floorCards);

  if (matches.length === 0) {
    const result: MatchResult = {
      type: 'none',
      playedCard,
      captured: [],
      remainingOnFloor: [...floorCards, playedCard],
    };
    validateMatchResult(result);
    return result;
  }

  if (matches.length === 1) {
    const matched = matches[0];
    const result: MatchResult = {
      type: 'single',
      playedCard,
      captured: [playedCard, matched],
      remainingOnFloor: floorCards.filter((c) => c.id !== matched.id),
    };
    validateMatchResult(result);
    return result;
  }

  if (matches.length === 2) {
    // If choice was made, capture that chosen card
    if (chosenCandidate && matches.some((card) => card.id === chosenCandidate.id)) {
      const result: MatchResult = {
        type: 'single',
        playedCard,
        captured: [playedCard, chosenCandidate],
        remainingOnFloor: floorCards.filter((c) => c.id !== chosenCandidate.id),
      };
      validateMatchResult(result);
      return result;
    }

    // Otherwise require choice
    const result: MatchResult = {
      type: 'choice',
      playedCard,
      captured: [],
      candidates: matches,
      remainingOnFloor: floorCards,
    };
    validateMatchResult(result);
    return result;
  }

  // 3 matches on floor: capture all 4!
  const result: MatchResult = {
    type: 'triple',
    playedCard,
    captured: [playedCard, ...matches],
    remainingOnFloor: floorCards.filter((c) => !matches.some((m) => m.id === c.id)),
  };
  validateMatchResult(result);
  return result;
}

/** Basic Go-Stop scoring for the cards captured in a round. */
export function calculateScore(captured: CardDef[]): number {
  return calculateScoreBreakdown(captured).total;
}

export function calculateGoMultiplier(goCount: number): number {
  return 2 ** Math.max(0, goCount);
}

export function calculateFinalScore(score: number, goCount: number): number {
  return score * calculateGoMultiplier(goCount);
}

export interface ScoreBreakdown {
  total: number;
  reasons: string[];
}

export interface ScoreHint {
  label: string;
  current: number;
  target: number;
  remaining: number;
}

/** Reports scoring milestones that are close but not complete yet. */
export function calculateScoreHints(captured: CardDef[]): ScoreHint[] {
  const hints: ScoreHint[] = [];
  const addHint = (label: string, current: number, target: number): void => {
    if (current < target && target - current <= 2) {
      hints.push({ label, current, target, remaining: target - current });
    }
  };

  addHint('목표 점수', calculateScore(captured), 3);
  const gwang = captured.filter((card) => card.category === 'gwang').length;
  addHint('광', gwang, 3);

  const animals = captured.filter((card) => card.category === 'animal');
  addHint('열끗', animals.length, 5);
  addHint('고도리', animals.filter((card) => card.subType === 'godori').length, 3);

  const ribbons = captured.filter((card) => card.category === 'ribbon');
  addHint('띠', ribbons.length, 5);
  for (const [label, subType] of [['홍단', 'hongdan'], ['청단', 'cheongdan'], ['초단', 'chodan']] as const) {
    addHint(label, ribbons.filter((card) => card.subType === subType).length, 3);
  }

  const piValue = captured
    .filter((card) => card.category === 'junk')
    .reduce((total, card) => total + (card.subType === 'ssangpi' ? 2 : 1), 0);
  addHint('피', piValue, 10);

  return hints.sort((a, b) => a.remaining - b.remaining);
}

export function calculateScoreBreakdown(captured: CardDef[]): ScoreBreakdown {
  const gwang = captured.filter((card) => card.category === 'gwang');
  const animals = captured.filter((card) => card.category === 'animal');
  const ribbons = captured.filter((card) => card.category === 'ribbon');
  const junk = captured.filter((card) => card.category === 'junk');

  const reasons: string[] = [];
  const hasRainGwang = gwang.some((card) => card.subType === 'rain-gwang');
  const gwangScore = gwang.length >= 5 ? 15 : gwang.length >= 4 ? 4 : gwang.length >= 3 ? (hasRainGwang ? 2 : 3) : 0;
  if (gwangScore > 0) reasons.push(`${gwang.length}광 = ${gwangScore}점`);

  const animalScore = Math.max(0, animals.length - 4);
  if (animalScore > 0) reasons.push(`열끗 ${animals.length}장 = ${animalScore}점`);
  const godoriScore = animals.filter((card) => card.subType === 'godori').length === 3 ? 5 : 0;
  if (godoriScore > 0) reasons.push('고도리 = 5점');

  const ribbonScore = Math.max(0, ribbons.length - 4);
  if (ribbonScore > 0) reasons.push(`띠 ${ribbons.length}장 = ${ribbonScore}점`);
  let score = gwangScore + animalScore + godoriScore + ribbonScore;
  if (['hongdan', 'cheongdan', 'chodan'].every((type) => ribbons.some((card) => card.subType === type))) {
    score += 3;
    reasons.push('홍단·청단·초단 = 3점');
  }
  const junkScore = Math.floor(junk.reduce((total, card) => total + (card.subType === 'ssangpi' ? 2 : 1), 0) / 10);
  if (junkScore > 0) reasons.push(`피 10장 단위 = ${junkScore}점`);
  score += junkScore;
  return { total: score, reasons };
}
