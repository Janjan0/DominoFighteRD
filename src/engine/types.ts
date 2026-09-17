export type GameMode = '2v2' | '1v1' | 'pintintin' | '4individual';

export type Tile = {
  id: string;
  a: number;
  b: number;
};

export type BoardTile = {
  tileId: string;
  left: number;
  right: number;
  playedBy: string;
};

export type Player = {
  id: string;
  nickname: string;
  seat: number;
  isSpectator: boolean;
  isCreator: boolean;
  team: number;
  isConnected: boolean;
};

export type HandResult = {
  type: 'win' | 'tranque';
  winnerId: string;
  points: number;
  bonusPoints: number;
  bonusType: string | null;
  details: string;
};

export type GameState = {
  phase: 'waiting' | 'dealing' | 'playing' | 'hand_end' | 'match_end';
  mode: GameMode;
  targetPoints: number;
  withCarga: boolean;

  seats: (string | null)[];
  hands: Record<string, Tile[]>;
  handSizes: Record<string, number>;

  chain: BoardTile[];
  leftEnd: number | null;
  rightEnd: number | null;

  currentPlayerId: string | null;
  startingPlayerId: string | null;

  drawPile: Tile[];
  drawPileCount: number;

  consecutivePasses: number;
  passHistory: string[];

  handNumber: number;
  scores: Record<string, number>;

  lastHandResult: HandResult | null;

  firstPlayOfHand: boolean;
  firstPlayerId: string | null;
  firstPlayTileId: string | null;
  firstPlayEnd: 'left' | 'right' | null;

  lastPlayPlayerId: string | null;
  vueltaRedondaPlayerId: string | null;
  salidaBonus: { points: number; type: string } | null;

  teams: Record<string, number>;
  rematchRequested: string[];
};

export type RoomConfig = {
  mode: GameMode;
  targetPoints: number;
  withCarga: boolean;
  isPublic: boolean;
  voiceEnabled: boolean;
  spectatorsAllowed: boolean;
  name: string;
};

export type VisibleGameState = {
  phase: GameState['phase'];
  mode: GameMode;
  targetPoints: number;
  withCarga: boolean;
  seats: (string | null)[];
  myHand: Tile[];
  handSizes: Record<string, number>;
  chain: BoardTile[];
  leftEnd: number | null;
  rightEnd: number | null;
  currentPlayerId: string | null;
  startingPlayerId: string | null;
  drawPileCount: number;
  consecutivePasses: number;
  handNumber: number;
  scores: Record<string, number>;
  lastHandResult: HandResult | null;
  teams: Record<string, number>;
  rematchRequested: string[];
  lastPlayPlayerId: string | null;
  vueltaRedondaPlayerId: string | null;
  salidaBonus: { points: number; type: string } | null;
};
