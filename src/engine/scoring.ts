import type { Tile, GameMode, GameState, HandResult } from './types';
import { tileValue, isDouble } from './tiles';

export function handTotal(tiles: Tile[]): number {
  return tiles.reduce((sum, t) => sum + tileValue(t), 0);
}

export function getTeamForPlayer(state: GameState, playerId: string): number {
  return state.teams[playerId] ?? 0;
}

export function getTeammate(state: GameState, playerId: string): string | null {
  const myTeam = getTeamForPlayer(state, playerId);
  for (const pid of Object.keys(state.teams)) {
    if (pid !== playerId && state.teams[pid] === myTeam) {
      return pid;
    }
  }
  return null;
}

export function getActivePlayers(state: GameState): string[] {
  return state.seats.filter((s): s is string => s !== null);
}

export function isCapicua(
  lastTile: Tile,
  leftEnd: number,
  rightEnd: number,
): boolean {
  if (isDouble(lastTile)) return false;
  return (lastTile.a === leftEnd || lastTile.b === leftEnd) &&
         (lastTile.a === rightEnd || lastTile.b === rightEnd) &&
         leftEnd !== rightEnd;
}

export function bonusForTarget(base: number, target: number): number {
  return target === 100 ? Math.floor(base / 2) : base;
}

export function withinThreshold(score: number, target: number): boolean {
  const threshold = target === 100 ? 85 : 170;
  return score <= threshold;
}

export function canApplyBonus(score: number, target: number): boolean {
  return withinThreshold(score, target);
}

export function scoreNormalWin(
  state: GameState,
  winnerId: string,
): { points: number; details: string } {
  const active = getActivePlayers(state);
  const mode = state.mode;

  if (mode === '2v2') {
    const winnerTeam = getTeamForPlayer(state, winnerId);
    let total = 0;
    for (const pid of active) {
      if (getTeamForPlayer(state, pid) !== winnerTeam) {
        total += handTotal(state.hands[pid]);
      }
    }
    const teammate = getTeammate(state, winnerId);
    if (teammate && state.hands[teammate]) {
      total += handTotal(state.hands[teammate]);
    }
    return { points: total, details: `Puntos de los oponentes + compañero` };
  }

  let total = 0;
  for (const pid of active) {
    if (pid !== winnerId) {
      total += handTotal(state.hands[pid]);
    }
  }
  return { points: total, details: `Puntos de los oponentes` };
}

export function scoreTranque(
  state: GameState,
  tranquerId: string,
): { points: number; winnerId: string; details: string } {
  const active = getActivePlayers(state);
  const mode = state.mode;
  const tranquerPoints = handTotal(state.hands[tranquerId]);

  if (mode === '2v2') {
    const nextPlayer = getNextPlayerTranque(state, tranquerId);
    const nextPoints = handTotal(state.hands[nextPlayer]);

    let winnerId: string;
    if (tranquerPoints < nextPoints) {
      winnerId = tranquerId;
    } else if (nextPoints < tranquerPoints) {
      winnerId = nextPlayer;
    } else {
      winnerId = tranquerId;
    }

    const winnerTeam = getTeamForPlayer(state, winnerId);
    let total = 0;
    for (const pid of active) {
      total += handTotal(state.hands[pid]);
    }
    return { points: total, winnerId, details: `Tranque: ${winnerId === tranquerId ? 'tranqueador' : 'siguiente'} gana con menor puntaje` };
  }

  let winnerId = tranquerId;
  let minPoints = tranquerPoints;
  for (const pid of active) {
    if (pid === tranquerId) continue;
    const pts = handTotal(state.hands[pid]);
    if (pts < minPoints) {
      minPoints = pts;
      winnerId = pid;
    }
  }

  let total = 0;
  for (const pid of active) {
    if (pid !== winnerId) {
      total += handTotal(state.hands[pid]);
    }
  }
  return { points: total, winnerId, details: `Tranque individual: ganador con menor puntaje` };
}

function getNextPlayerTranque(state: GameState, currentId: string): string {
  const active = getActivePlayers(state);
  const idx = active.indexOf(currentId);
  return active[(idx + 1) % active.length];
}

export function checkSalidaBonus(
  state: GameState,
  firstPlayerId: string,
  firstTile: Tile,
  mode: GameMode,
  target: number,
): { points: number; type: string } | null {
  if (mode !== '2v2' && mode !== '4individual') return null;

  const active = getActivePlayers(state);
  const firstIdx = active.indexOf(firstPlayerId);
  if (firstIdx === -1) return null;

  const nextPlayer = active[(firstIdx + 1) % active.length];
  const nextHand = state.hands[nextPlayer];
  if (!nextHand) return null;

  const nextCanPlay = nextHand.some(
    (t) => t.a === firstTile.a || t.b === firstTile.a || t.a === firstTile.b || t.b === firstTile.b
  );

  if (nextCanPlay) return null;

  if (mode === '2v2') {
    const teammate = getTeammate(state, firstPlayerId);
    if (teammate && state.hands[teammate]) {
      const teammateCanPlay = state.hands[teammate].some(
        (t) => t.a === firstTile.a || t.b === firstTile.a || t.a === firstTile.b || t.b === firstTile.b
      );
      if (!teammateCanPlay) return null;
    }
  }

  if (mode === '4individual') {
    const thirdPlayer = active[(firstIdx + 2) % active.length];
    if (state.hands[thirdPlayer]) {
      const thirdCanPlay = state.hands[thirdPlayer].some(
        (t) => t.a === firstTile.a || t.b === firstTile.a || t.a === firstTile.b || t.b === firstTile.b
      );
      if (!thirdCanPlay) return null;
    }
  }

  if (isDouble(firstTile)) {
    const base = 30;
    return { points: bonusForTarget(base, target), type: 'bono_salida_doble' };
  } else {
    const base = 60;
    return { points: bonusForTarget(base, target), type: 'bono_salida_mixta' };
  }
}
