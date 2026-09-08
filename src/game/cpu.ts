import { CardDef } from './types';
import { findFloorMatches } from './rules';

export class CpuAI {
  /**
   * Evaluates the CPU's hand and chooses the best card to play.
   */
  public static chooseHandCard(hand: CardDef[], floorCards: CardDef[]): CardDef {
    if (hand.length === 1) return hand[0];

    let bestCard = hand[0];
    let bestScore = -9999;

    for (const card of hand) {
      const matches = findFloorMatches(card, floorCards);
      let score = 0;

      if (matches.length > 0) {
        // Can capture! Add value of this card + captured cards
        score += this.getCardValue(card);
        for (const m of matches) {
          score += this.getCardValue(m);
        }
        // Triple capture bonus
        if (matches.length === 3) score += 150;
      } else {
        // No match -> discard penalty (prefer discarding junk, avoid discarding Gwang or Godori)
        score = -this.getCardValue(card);
      }

      if (score > bestScore) {
        bestScore = score;
        bestCard = card;
      }
    }

    return bestCard;
  }

  /**
   * When 2 candidates are on the floor, chooses the more valuable one.
   */
  public static chooseCandidate(candidates: CardDef[]): CardDef {
    if (candidates.length === 0) throw new Error('Candidates array cannot be empty');
    let best = candidates[0];
    let bestVal = this.getCardValue(best);

    for (let i = 1; i < candidates.length; i++) {
      const val = this.getCardValue(candidates[i]);
      if (val > bestVal) {
        best = candidates[i];
        bestVal = val;
      }
    }
    return best;
  }

  private static getCardValue(card: CardDef): number {
    if (card.category === 'gwang') return 100;
    if (card.subType === 'godori') return 80;
    if (card.category === 'animal') return 60;
    if (card.subType === 'hongdan' || card.subType === 'cheongdan' || card.subType === 'chodan') return 50;
    if (card.category === 'ribbon') return 40;
    if (card.subType === 'ssangpi') return 35;
    return 10; // Junk (pi)
  }
}
