import { CardDef } from './types';

export type MatchResultType = 'none' | 'single' | 'choice' | 'triple';

export interface MatchResult {
  type: MatchResultType;
  playedCard: CardDef;
  captured: CardDef[];
  candidates?: CardDef[]; // When type === 'choice'
  remainingOnFloor: CardDef[];
}

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

  if (
    (result.type === 'single' || result.type === 'triple') &&
    !result.captured.some((card) => card.id === result.playedCard.id)
  ) {
    throw new Error(`${result.type} match must include the played card in captured cards`);
  }
}

/** The first two digits of the card id are the authoritative month family. */
export function getCardFamily(card: CardDef): number {
  return Number.parseInt(card.id.slice(0, 2), 10);
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

export interface ScoreBreakdown {
  total: number;
  reasons: string[];
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
