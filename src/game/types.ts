export type CardCategory = 'gwang' | 'animal' | 'ribbon' | 'junk';

export type SubType = 'hongdan' | 'cheongdan' | 'chodan' | 'godori' | 'ssangpi' | 'rain-gwang';

export interface CardDef {
  id: string;
  month: number; // 1 ~ 12
  col: number;   // 0 ~ 11
  row: number;   // 0 ~ 3
  category: CardCategory;
  subType?: SubType;
  name: string;
  points?: number;
}

export type PlayerId = 'player' | 'cpu';

export interface PlayerState {
  id: PlayerId;
  name: string;
  hand: CardDef[];
  captured: CardDef[];
  score: number;
  goCount: number;
}
