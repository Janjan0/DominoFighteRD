import type { Tile, GameMode, GameState } from './types';
import { isDouble, tileValue, highestSide } from './tiles';

export type LegalMove = {
  tileId: string;
  end: 'left' | 'right' | 'both';
};

export function getLegalMoves(hand: Tile[], leftEnd: number | null, rightEnd: number | null): LegalMove[] {
  if (leftEnd === null && rightEnd === null) {
    return hand.map((t) => ({ tileId: t.id, end: 'both' }));
  }

  const moves: LegalMove[] = [];
  for (const tile of hand) {
    const canLeft = tile.a === leftEnd || tile.b === leftEnd;
    const canRight = tile.a === rightEnd || tile.b === rightEnd;

    if (canLeft && canRight) {
      moves.push({ tileId: tile.id, end: 'both' });
    } else if (canLeft) {
      moves.push({ tileId: tile.id, end: 'left' });
    } else if (canRight) {
      moves.push({ tileId: tile.id, end: 'right' });
    }
  }
  return moves;
}

export function hasLegalMove(hand: Tile[], leftEnd: number | null, rightEnd: number | null): boolean {
  return getLegalMoves(hand, leftEnd, rightEnd).length > 0;
}

export function canPlayOnEnd(tile: Tile, end: number): boolean {
  return tile.a === end || tile.b === end;
}

export type StartingPlayerResult = {
  playerId: string;
  tileId: string;
  reason: string;
};

export function determineStartingPlayer(
  mode: GameMode,
  hands: Record<string, Tile[]>,
  seatOrder: string[],
  previousWinnerId?: string,
): StartingPlayerResult {
  if (previousWinnerId) {
    const winnerHand = hands[previousWinnerId];
    if (winnerHand && winnerHand.length > 0) {
      return {
        playerId: previousWinnerId,
        tileId: winnerHand[0].id,
        reason: 'Ganador de la mano anterior',
      };
    }
  }

  const doubleOrder = [6, 5, 4, 3, 2, 1, 0];

  for (const seat of seatOrder) {
    const hand = hands[seat];
    if (!hand) continue;
    const sixSix = hand.find((t) => t.id === '6-6');
    if (sixSix) {
      return { playerId: seat, tileId: '6-6', reason: 'Tiene 6-6' };
    }
  }

  for (const d of doubleOrder) {
    for (const seat of seatOrder) {
      const hand = hands[seat];
      if (!hand) continue;
      const dbl = hand.find((t) => t.a === d && t.b === d);
      if (dbl) {
        return { playerId: seat, tileId: dbl.id, reason: `Doble ${d}-${d} (doble más alto)` };
      }
    }
  }

  let bestTile: Tile | null = null;
  let bestPlayer: string | null = null;
  for (const seat of seatOrder) {
    const hand = hands[seat];
    if (!hand) continue;
    for (const tile of hand) {
      if (bestTile === null) {
        bestTile = tile;
        bestPlayer = seat;
      } else {
        const bestVal = tileValue(bestTile);
        const curVal = tileValue(tile);
        if (curVal > bestVal || (curVal === bestVal && highestSide(tile) > highestSide(bestTile))) {
          bestTile = tile;
          bestPlayer = seat;
        }
      }
    }
  }

  if (bestTile && bestPlayer) {
    return {
      playerId: bestPlayer,
      tileId: bestTile.id,
      reason: `Ficha de mayor valor (${bestTile.a}-${bestTile.b} = ${tileValue(bestTile)})`,
    };
  }

  return { playerId: seatOrder[0], tileId: hands[seatOrder[0]][0].id, reason: 'Por defecto' };
}

export function getNextPlayer(state: GameState): string | null {
  const activeSeats = state.seats.filter((s): s is string => s !== null);
  if (activeSeats.length === 0) return null;
  const currentIdx = activeSeats.indexOf(state.currentPlayerId!);
  if (currentIdx === -1) return activeSeats[0];
  return activeSeats[(currentIdx + 1) % activeSeats.length];
}

export function isTranque(state: GameState): boolean {
  const activeSeats = state.seats.filter((s): s is string => s !== null);
  for (const pid of activeSeats) {
    const hand = state.hands[pid];
    if (hand && hasLegalMove(hand, state.leftEnd, state.rightEnd)) {
      return false;
    }
  }
  return true;
}

export function isVueltaRedonda(state: GameState, lastPlayerId: string): boolean {
  const activeSeats = state.seats.filter((s): s is string => s !== null);
  if (activeSeats.length < 4) return false;

  const lastIdx = activeSeats.indexOf(lastPlayerId);
  if (lastIdx === -1) return false;

  const others: string[] = [];
  for (let i = 1; i < activeSeats.length; i++) {
    others.push(activeSeats[(lastIdx + i) % activeSeats.length]);
  }

  for (const pid of others) {
    const hand = state.hands[pid];
    if (hand && hasLegalMove(hand, state.leftEnd, state.rightEnd)) {
      return false;
    }
  }
  return true;
}
