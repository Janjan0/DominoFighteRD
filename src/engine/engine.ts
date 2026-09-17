import type { Tile, GameMode, GameState, HandResult, RoomConfig } from './types';
import {
  createTileSet,
  dealTiles,
  getTileById,
  removeTile,
  tileValue,
} from './tiles';
import {
  getLegalMoves,
  hasLegalMove,
  determineStartingPlayer,
  getNextPlayer,
  isTranque,
  isVueltaRedonda,
  canPlayOnEnd,
  type LegalMove,
} from './rules';
import {
  handTotal,
  scoreNormalWin,
  scoreTranque,
  isCapicua,
  bonusForTarget,
  canApplyBonus,
  checkSalidaBonus,
  getTeamForPlayer,
  getActivePlayers,
} from './scoring';

export function createInitialState(
  config: RoomConfig,
  players: { id: string; nickname: string; seat: number; isSpectator: boolean; isCreator: boolean }[],
): GameState {
  const seats: (string | null)[] = [null, null, null, null];
  const teams: Record<string, number> = {};
  const scores: Record<string, number> = {};

  for (const p of players) {
    if (p.isSpectator) continue;
    seats[p.seat] = p.id;
    scores[p.id] = 0;

    if (config.mode === '2v2') {
      teams[p.id] = p.seat % 2;
    } else {
      teams[p.id] = p.seat;
    }
  }

  return {
    phase: 'waiting',
    mode: config.mode,
    targetPoints: config.targetPoints,
    withCarga: config.withCarga,
    seats,
    hands: {},
    handSizes: {},
    chain: [],
    leftEnd: null,
    rightEnd: null,
    currentPlayerId: null,
    startingPlayerId: null,
    drawPile: [],
    drawPileCount: 0,
    consecutivePasses: 0,
    passHistory: [],
    handNumber: 0,
    scores,
    lastHandResult: null,
    firstPlayOfHand: false,
    firstPlayerId: null,
    firstPlayTileId: null,
    firstPlayEnd: null,
    lastPlayPlayerId: null,
    vueltaRedondaPlayerId: null,
    salidaBonus: null,
    teams,
    rematchRequested: [],
  };
}

export function dealNewHand(
  state: GameState,
  previousWinnerId?: string,
): GameState {
  const tiles = createTileSet();
  const { hands: handsBySeat, drawPile } = dealTiles(state.mode, tiles);

  const seatOrder: string[] = [];
  for (let i = 0; i < state.seats.length; i++) {
    if (state.seats[i]) seatOrder.push(state.seats[i]!);
  }

  const hands: Record<string, Tile[]> = {};
  const handSizes: Record<string, number> = {};
  let seatIdx = 0;
  for (const pid of seatOrder) {
    hands[pid] = handsBySeat[seatIdx] || [];
    handSizes[pid] = hands[pid].length;
    seatIdx++;
  }

  const starting = determineStartingPlayer(
    state.mode,
    hands,
    seatOrder,
    state.handNumber === 0 ? undefined : previousWinnerId,
  );

  const newState: GameState = {
    ...state,
    phase: 'playing',
    hands,
    handSizes,
    chain: [],
    leftEnd: null,
    rightEnd: null,
    currentPlayerId: starting.playerId,
    startingPlayerId: starting.playerId,
    drawPile,
    drawPileCount: drawPile.length,
    consecutivePasses: 0,
    passHistory: [],
    handNumber: state.handNumber + 1,
    lastHandResult: null,
    firstPlayOfHand: true,
    firstPlayerId: starting.playerId,
    firstPlayTileId: starting.tileId,
    firstPlayEnd: null,
    lastPlayPlayerId: null,
    vueltaRedondaPlayerId: null,
    salidaBonus: null,
  };

  return newState;
}

export type PlayResult = {
  state: GameState;
  error: string | null;
  handEnded: boolean;
  forcedTileId?: string;
};

export function playTile(
  state: GameState,
  playerId: string,
  tileId: string,
  end: 'left' | 'right',
): PlayResult {
  if (state.phase !== 'playing') {
    return { state, error: 'No hay partida en curso', handEnded: false };
  }
  if (state.currentPlayerId !== playerId) {
    return { state, error: 'No es tu turno', handEnded: false };
  }

  const hand = state.hands[playerId];
  if (!hand) {
    return { state, error: 'No tienes mano', handEnded: false };
  }

  const tile = getTileById(hand, tileId);
  if (!tile) {
    return { state, error: 'No tienes esa ficha', handEnded: false };
  }

  const legalMoves = getLegalMoves(hand, state.leftEnd, state.rightEnd);
  if (legalMoves.length === 0) {
    return { state, error: 'No tienes jugadas legales', handEnded: false };
  }

  const move = legalMoves.find((m) => m.tileId === tileId);
  if (!move) {
    return { state, error: 'Esa ficha no se puede jugar', handEnded: false };
  }

  let chosenEnd: 'left' | 'right' = end;
  if (move.end !== 'both' && move.end !== chosenEnd) {
    return { state, error: 'Esa ficha no se puede colocar en ese extremo', handEnded: false };
  }
  if (state.chain.length === 0) {
    chosenEnd = 'left';
  }

  let newChain = [...state.chain];
  let newLeftEnd = state.leftEnd;
  let newRightEnd = state.rightEnd;

  if (newChain.length === 0) {
    newLeftEnd = tile.a;
    newRightEnd = tile.b;
    newChain.push({
      tileId: tile.id,
      left: tile.a,
      right: tile.b,
      playedBy: playerId,
    });
  } else if (chosenEnd === 'left') {
    const connectVal = newLeftEnd!;
    let leftSide: number, rightSide: number;
    if (tile.a === connectVal) {
      leftSide = tile.b;
      rightSide = tile.a;
    } else {
      leftSide = tile.a;
      rightSide = tile.b;
    }
    newLeftEnd = leftSide;
    newChain.unshift({
      tileId: tile.id,
      left: leftSide,
      right: rightSide,
      playedBy: playerId,
    });
  } else {
    const connectVal = newRightEnd!;
    let leftSide: number, rightSide: number;
    if (tile.a === connectVal) {
      leftSide = tile.a;
      rightSide = tile.b;
    } else {
      leftSide = tile.b;
      rightSide = tile.a;
    }
    newRightEnd = rightSide;
    newChain.push({
      tileId: tile.id,
      left: leftSide,
      right: rightSide,
      playedBy: playerId,
    });
  }

  const newHand = removeTile(hand, tileId);
  const newHandSizes = { ...state.handSizes, [playerId]: newHand.length };
  const newHands = { ...state.hands, [playerId]: newHand };

  let newState: GameState = {
    ...state,
    hands: newHands,
    handSizes: newHandSizes,
    chain: newChain,
    leftEnd: newLeftEnd,
    rightEnd: newRightEnd,
    consecutivePasses: 0,
    passHistory: [],
    lastPlayPlayerId: playerId,
  };

  if (state.firstPlayOfHand) {
    newState.firstPlayOfHand = false;
    newState.firstPlayEnd = chosenEnd;
  }

  if (newHand.length === 0) {
    const result = endHand(newState, playerId, tile);
    return { state: result.state, error: null, handEnded: true };
  }

  const nextPlayer = getNextPlayer({ ...newState, currentPlayerId: playerId });
  newState.currentPlayerId = nextPlayer;

  if (isTranque(newState)) {
    const result = endHandByTranque(newState);
    return { state: result.state, error: null, handEnded: true };
  }

  return { state: newState, error: null, handEnded: false };
}

export function passTurn(state: GameState, playerId: string): PlayResult {
  if (state.phase !== 'playing') {
    return { state, error: 'No hay partida en curso', handEnded: false };
  }
  if (state.currentPlayerId !== playerId) {
    return { state, error: 'No es tu turno', handEnded: false };
  }

  const hand = state.hands[playerId];
  if (!hand) {
    return { state, error: 'No tienes mano', handEnded: false };
  }

  if (hasLegalMove(hand, state.leftEnd, state.rightEnd)) {
    return { state, error: 'Tienes jugadas legales, no puedes pasar', handEnded: false };
  }

  const newPassHistory = [...state.passHistory, playerId];
  const newConsecutivePasses = state.consecutivePasses + 1;
  const nextPlayer = getNextPlayer({ ...state, currentPlayerId: playerId });

  let newState: GameState = {
    ...state,
    consecutivePasses: newConsecutivePasses,
    passHistory: newPassHistory,
    currentPlayerId: nextPlayer,
  };

  if (isTranque(newState)) {
    const result = endHandByTranque(newState);
    return { state: result.state, error: null, handEnded: true };
  }

  return { state: newState, error: null, handEnded: false };
}

export function drawTile(state: GameState, playerId: string): PlayResult & { drewTile?: Tile } {
  if (state.phase !== 'playing') {
    return { state, error: 'No hay partida en curso', handEnded: false };
  }
  if (state.currentPlayerId !== playerId) {
    return { state, error: 'No es tu turno', handEnded: false };
  }
  if (!state.withCarga) {
    return { state, error: 'Este modo no tiene carga', handEnded: false };
  }
  if (state.drawPile.length === 0) {
    return { state, error: 'No hay fichas para robar', handEnded: false };
  }

  const hand = state.hands[playerId];
  if (!hand) {
    return { state, error: 'No tienes mano', handEnded: false };
  }

  if (hasLegalMove(hand, state.leftEnd, state.rightEnd)) {
    return { state, error: 'Tienes jugadas legales, no puedes robar', handEnded: false };
  }

  const drawPile = [...state.drawPile];
  const drawnTile = drawPile.shift()!;
  const newHand = [...hand, drawnTile];

  let newState: GameState = {
    ...state,
    hands: { ...state.hands, [playerId]: newHand },
    handSizes: { ...state.handSizes, [playerId]: newHand.length },
    drawPile,
    drawPileCount: drawPile.length,
  };

  if (hasLegalMove(newHand, state.leftEnd, state.rightEnd)) {
    return {
      state: newState,
      error: null,
      handEnded: false,
      forcedTileId: drawnTile.id,
      drewTile: drawnTile,
    };
  }

  if (drawPile.length === 0) {
    return {
      state: newState,
      error: null,
      handEnded: false,
      drewTile: drawnTile,
    };
  }

  return drawTile(newState, playerId);
}

function endHand(state: GameState, winnerId: string, lastTile: Tile): { state: GameState } {
  const mode = state.mode;
  const target = state.targetPoints;

  const { points, details } = scoreNormalWin(state, winnerId);

  let bonusPoints = 0;
  const bonusTypes: string[] = [];

  const capicua = isCapicua(lastTile, state.leftEnd!, state.rightEnd!);
  if (capicua) {
    bonusPoints += bonusForTarget(30, target);
    bonusTypes.push('capicua');
  }

  if (mode === '2v2' || mode === '4individual') {
    if (isVueltaRedonda(state, winnerId)) {
      const vueltaBonus = bonusForTarget(30, target);
      if (canApplyBonus(state.scores[winnerId] || 0, target)) {
        bonusPoints += vueltaBonus;
        bonusTypes.push('vuelta redonda');
      }
    }
  }

  if (state.salidaBonus && (mode === '2v2' || mode === '4individual')) {
    if (canApplyBonus(state.scores[winnerId] || 0, target)) {
      bonusPoints += state.salidaBonus.points;
      bonusTypes.push(state.salidaBonus.type);
    }
  }

  const bonusType = bonusTypes.length > 0 ? bonusTypes.join(' + ') : null;
  const result: HandResult = {
    type: 'win',
    winnerId,
    points,
    bonusPoints,
    bonusType,
    details,
  };

  const newScores = { ...state.scores };
  if (mode === '2v2') {
    const winnerTeam = getTeamForPlayer(state, winnerId);
    for (const pid of getActivePlayers(state)) {
      if (getTeamForPlayer(state, pid) === winnerTeam) {
        newScores[pid] = (newScores[pid] || 0) + points + bonusPoints;
      }
    }
  } else {
    newScores[winnerId] = (newScores[winnerId] || 0) + points + bonusPoints;
  }

  const matchEnded = checkMatchEnd(newScores, mode, target, winnerId);

  const newState: GameState = {
    ...state,
    phase: matchEnded ? 'match_end' : 'hand_end',
    scores: newScores,
    lastHandResult: result,
  };

  return { state: newState };
}

function endHandByTranque(state: GameState): { state: GameState } {
  const mode = state.mode;
  const target = state.targetPoints;

  const tranquerId = state.passHistory.length > 0
    ? state.passHistory[state.passHistory.length - 1]
    : state.currentPlayerId!;

  const { points, winnerId, details } = scoreTranque(state, tranquerId);

  const result: HandResult = {
    type: 'tranque',
    winnerId,
    points,
    bonusPoints: 0,
    bonusType: null,
    details,
  };

  const newScores = { ...state.scores };
  if (mode === '2v2') {
    const winnerTeam = getTeamForPlayer(state, winnerId);
    for (const pid of getActivePlayers(state)) {
      if (getTeamForPlayer(state, pid) === winnerTeam) {
        newScores[pid] = (newScores[pid] || 0) + points;
      }
    }
  } else {
    newScores[winnerId] = (newScores[winnerId] || 0) + points;
  }

  const matchEnded = checkMatchEnd(newScores, mode, target, winnerId);

  const newState: GameState = {
    ...state,
    phase: matchEnded ? 'match_end' : 'hand_end',
    scores: newScores,
    lastHandResult: result,
  };

  return { state: newState };
}

function checkMatchEnd(
  scores: Record<string, number>,
  mode: GameMode,
  target: number,
  winnerId: string,
): boolean {
  if (mode === '2v2') {
    return scores[winnerId] >= target;
  }
  return scores[winnerId] >= target;
}

export function filterStateForPlayer(
  state: GameState,
  viewerId: string,
  isSpectator: boolean,
) {
  const myHand = isSpectator ? [] : (state.hands[viewerId] || []);

  return {
    phase: state.phase,
    mode: state.mode,
    targetPoints: state.targetPoints,
    withCarga: state.withCarga,
    seats: state.seats,
    myHand,
    handSizes: state.handSizes,
    chain: state.chain,
    leftEnd: state.leftEnd,
    rightEnd: state.rightEnd,
    currentPlayerId: state.currentPlayerId,
    startingPlayerId: state.startingPlayerId,
    drawPileCount: state.drawPileCount,
    consecutivePasses: state.consecutivePasses,
    handNumber: state.handNumber,
    scores: state.scores,
    lastHandResult: state.lastHandResult,
    teams: state.teams,
    rematchRequested: state.rematchRequested,
    lastPlayPlayerId: state.lastPlayPlayerId,
    vueltaRedondaPlayerId: state.vueltaRedondaPlayerId,
    salidaBonus: state.salidaBonus,
  };
}

export { determineStartingPlayer, getLegalMoves, hasLegalMove, getNextPlayer };
