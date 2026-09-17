import type { Tile, GameMode } from './types';

export function tileId(a: number, b: number): string {
  return `${Math.min(a, b)}-${Math.max(a, b)}`;
}

export function makeTile(a: number, b: number): Tile {
  return { id: tileId(a, b), a: Math.min(a, b), b: Math.max(a, b) };
}

export function createTileSet(): Tile[] {
  const tiles: Tile[] = [];
  for (let a = 0; a <= 6; a++) {
    for (let b = a; b <= 6; b++) {
      tiles.push(makeTile(a, b));
    }
  }
  return tiles;
}

export function shuffleTiles(tiles: Tile[]): Tile[] {
  const result = [...tiles];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function tileValue(tile: Tile): number {
  return tile.a + tile.b;
}

export function isDouble(tile: Tile): boolean {
  return tile.a === tile.b;
}

export function highestSide(tile: Tile): number {
  return Math.max(tile.a, tile.b);
}

export type DealResult = {
  hands: Record<number, Tile[]>;
  drawPile: Tile[];
};

export function dealTiles(mode: GameMode, tiles: Tile[]): DealResult {
  const shuffled = shuffleTiles(tiles);
  let workingSet = [...shuffled];
  const handsBySeat: Record<number, Tile[]> = {};
  const tilesPerPlayer = 7;

  let numPlayers: number;
  switch (mode) {
    case '2v2':
      numPlayers = 4;
      break;
    case '1v1':
      numPlayers = 2;
      break;
    case 'pintintin':
      numPlayers = 3;
      break;
    case '4individual':
      numPlayers = 4;
      break;
  }

  if (mode === 'pintintin') {
    workingSet = workingSet.filter((t) => t.id !== '0-0');
  }

  for (let i = 0; i < numPlayers; i++) {
    handsBySeat[i] = workingSet.splice(0, tilesPerPlayer);
  }

  return {
    hands: handsBySeat,
    drawPile: workingSet,
  };
}

export function getTileById(tiles: Tile[], id: string): Tile | undefined {
  return tiles.find((t) => t.id === id);
}

export function removeTile(tiles: Tile[], id: string): Tile[] {
  return tiles.filter((t) => t.id !== id);
}
