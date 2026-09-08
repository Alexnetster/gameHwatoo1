import { CardDef } from './types';

// Standard 48 Hwatu cards mapped to 12 columns (months 1-12) and 4 rows (0-3)
export const HWATU_CARDS: CardDef[] = [
  // 1월 (송학 - Pine)
  { id: '01_01', month: 1, col: 0, row: 0, category: 'gwang', name: '1월 광' },
  { id: '01_02', month: 1, col: 0, row: 1, category: 'ribbon', subType: 'hongdan', name: '1월 홍단' },
  { id: '01_03', month: 1, col: 0, row: 2, category: 'junk', name: '1월 피1' },
  { id: '01_04', month: 1, col: 0, row: 3, category: 'junk', name: '1월 피2' },

  // 2월 (매조 - Plum blossom)
  { id: '02_01', month: 2, col: 1, row: 0, category: 'animal', subType: 'godori', name: '2월 고도리' },
  { id: '02_02', month: 2, col: 1, row: 1, category: 'ribbon', subType: 'hongdan', name: '2월 홍단' },
  { id: '02_03', month: 2, col: 1, row: 2, category: 'junk', name: '2월 피1' },
  { id: '02_04', month: 2, col: 1, row: 3, category: 'junk', name: '2월 피2' },

  // 3월 (벚꽃 - Cherry blossom)
  { id: '03_01', month: 3, col: 2, row: 0, category: 'gwang', name: '3월 광' },
  { id: '03_02', month: 3, col: 2, row: 1, category: 'ribbon', subType: 'hongdan', name: '3월 홍단' },
  { id: '03_03', month: 3, col: 2, row: 2, category: 'junk', name: '3월 피1' },
  { id: '03_04', month: 3, col: 2, row: 3, category: 'junk', name: '3월 피2' },

  // 4월 (흑싸리 - Wisteria)
  { id: '04_01', month: 4, col: 3, row: 0, category: 'animal', subType: 'godori', name: '4월 고도리' },
  { id: '04_02', month: 4, col: 3, row: 1, category: 'ribbon', subType: 'chodan', name: '4월 초단' },
  { id: '04_03', month: 4, col: 3, row: 2, category: 'junk', name: '4월 피1' },
  { id: '04_04', month: 4, col: 3, row: 3, category: 'junk', name: '4월 피2' },

  // 5월 (난초 - Iris)
  { id: '05_01', month: 5, col: 4, row: 0, category: 'animal', name: '5월 열끗' },
  { id: '05_02', month: 5, col: 4, row: 1, category: 'ribbon', subType: 'chodan', name: '5월 초단' },
  { id: '05_03', month: 5, col: 4, row: 2, category: 'junk', name: '5월 피1' },
  { id: '05_04', month: 5, col: 4, row: 3, category: 'junk', name: '5월 피2' },

  // 6월 (모란 - Peony)
  { id: '06_01', month: 6, col: 5, row: 0, category: 'animal', name: '6월 열끗' },
  { id: '06_02', month: 6, col: 5, row: 1, category: 'ribbon', subType: 'cheongdan', name: '6월 청단' },
  { id: '06_03', month: 6, col: 5, row: 2, category: 'junk', name: '6월 피1' },
  { id: '06_04', month: 6, col: 5, row: 3, category: 'junk', name: '6월 피2' },

  // 7월 (홍싸리 - Clover)
  { id: '07_01', month: 7, col: 6, row: 0, category: 'animal', name: '7월 열끗' },
  { id: '07_02', month: 7, col: 6, row: 1, category: 'ribbon', subType: 'chodan', name: '7월 초단' },
  { id: '07_03', month: 7, col: 6, row: 2, category: 'junk', name: '7월 피1' },
  { id: '07_04', month: 7, col: 6, row: 3, category: 'junk', name: '7월 피2' },

  // 8월 (공산 - Pampas grass)
  { id: '08_01', month: 8, col: 7, row: 0, category: 'gwang', name: '8월 광' },
  { id: '08_02', month: 8, col: 7, row: 1, category: 'animal', subType: 'godori', name: '8월 고도리' },
  { id: '08_03', month: 8, col: 7, row: 2, category: 'junk', name: '8월 피1' },
  { id: '08_04', month: 8, col: 7, row: 3, category: 'junk', name: '8월 피2' },

  // 9월 (국진 - Chrysanthemum)
  { id: '09_01', month: 9, col: 8, row: 0, category: 'animal', name: '9월 쌍피/열끗' },
  { id: '09_02', month: 9, col: 8, row: 1, category: 'ribbon', subType: 'cheongdan', name: '9월 청단' },
  { id: '09_03', month: 9, col: 8, row: 2, category: 'junk', name: '9월 피1' },
  { id: '09_04', month: 9, col: 8, row: 3, category: 'junk', name: '9월 피2' },

  // 10월 (단풍 - Maple)
  { id: '10_01', month: 10, col: 9, row: 0, category: 'animal', name: '10월 열끗' },
  { id: '10_02', month: 10, col: 9, row: 1, category: 'ribbon', subType: 'cheongdan', name: '10월 청단' },
  { id: '10_03', month: 10, col: 9, row: 2, category: 'junk', name: '10월 피1' },
  { id: '10_04', month: 10, col: 9, row: 3, category: 'junk', name: '10월 피2' },

  // 11월 (오동 - Paulownia)
  { id: '11_01', month: 11, col: 10, row: 0, category: 'gwang', name: '11월 똥광' },
  { id: '11_02', month: 11, col: 10, row: 1, category: 'junk', subType: 'ssangpi', name: '11월 쌍피' },
  { id: '11_03', month: 11, col: 10, row: 2, category: 'junk', name: '11월 피1' },
  { id: '11_04', month: 11, col: 10, row: 3, category: 'junk', name: '11월 피2' },

  // 12월 (비 - Willow)
  { id: '12_01', month: 12, col: 11, row: 0, category: 'gwang', subType: 'rain-gwang', name: '12월 비광' },
  { id: '12_02', month: 12, col: 11, row: 1, category: 'animal', name: '12월 열끗' },
  { id: '12_03', month: 12, col: 11, row: 2, category: 'ribbon', name: '12월 띠' },
  { id: '12_04', month: 12, col: 11, row: 3, category: 'junk', subType: 'ssangpi', name: '12월 쌍피' },
];

export function createShuffledDeck(random: () => number = Math.random): CardDef[] {
  const deck = [...HWATU_CARDS];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
