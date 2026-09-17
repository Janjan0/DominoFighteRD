import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};


const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ===== TYPES =====
type GameMode = "2v2" | "1v1" | "pintintin" | "4individual";
type Tile = { id: string; a: number; b: number };
type BoardTile = { tileId: string; left: number; right: number; playedBy: string };
type HandResult = {
  type: "win" | "tranque";
  winnerId: string;
  points: number;
  bonusPoints: number;
  bonusType: string | null;
  details: string;
};

type GameState = {
  phase: "waiting" | "dealing" | "playing" | "hand_end" | "match_end";
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
  firstPlayEnd: "left" | "right" | null;
  lastPlayPlayerId: string | null;
  vueltaRedondaPlayerId: string | null;
  salidaBonus: { points: number; type: string } | null;
  teams: Record<string, number>;
  rematchRequested: string[];
};

type RoomConfig = {
  mode: GameMode;
  targetPoints: number;
  withCarga: boolean;
  isPublic: boolean;
  voiceEnabled: boolean;
  spectatorsAllowed: boolean;
  name: string;
};

// ===== TILES =====
function tileId(a: number, b: number): string {
  return `${Math.min(a, b)}-${Math.max(a, b)}`;
}
function makeTile(a: number, b: number): Tile {
  return { id: tileId(a, b), a: Math.min(a, b), b: Math.max(a, b) };
}
function createTileSet(): Tile[] {
  const tiles: Tile[] = [];
  for (let a = 0; a <= 6; a++) {
    for (let b = a; b <= 6; b++) {
      tiles.push(makeTile(a, b));
    }
  }
  return tiles;
}
function shuffleTiles(tiles: Tile[]): Tile[] {
  const result = [...tiles];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function tileValue(tile: Tile): number {
  return tile.a + tile.b;
}
function isDouble(tile: Tile): boolean {
  return tile.a === tile.b;
}
function highestSide(tile: Tile): number {
  return Math.max(tile.a, tile.b);
}
function getTileById(tiles: Tile[], id: string): Tile | undefined {
  return tiles.find((t) => t.id === id);
}
function removeTile(tiles: Tile[], id: string): Tile[] {
  return tiles.filter((t) => t.id !== id);
}

function dealTiles(
  mode: GameMode,
  tiles: Tile[]
): { hands: Record<number, Tile[]>; drawPile: Tile[] } {
  const shuffled = shuffleTiles(tiles);
  let workingSet = [...shuffled];
  const handsBySeat: Record<number, Tile[]> = {};
  const tilesPerPlayer = 7;

  let numPlayers: number;
  switch (mode) {
    case "2v2": numPlayers = 4; break;
    case "1v1": numPlayers = 2; break;
    case "pintintin": numPlayers = 3; break;
    case "4individual": numPlayers = 4; break;
  }

  if (mode === "pintintin") {
    workingSet = workingSet.filter((t) => t.id !== "0-0");
  }

  for (let i = 0; i < numPlayers; i++) {
    handsBySeat[i] = workingSet.splice(0, tilesPerPlayer);
  }

  return { hands: handsBySeat, drawPile: workingSet };
}

// ===== RULES =====
type LegalMove = { tileId: string; end: "left" | "right" | "both" };

function getLegalMoves(
  hand: Tile[],
  leftEnd: number | null,
  rightEnd: number | null
): LegalMove[] {
  if (leftEnd === null && rightEnd === null) {
    return hand.map((t) => ({ tileId: t.id, end: "both" }));
  }
  const moves: LegalMove[] = [];
  for (const tile of hand) {
    const canLeft = tile.a === leftEnd || tile.b === leftEnd;
    const canRight = tile.a === rightEnd || tile.b === rightEnd;
    if (canLeft && canRight) {
      moves.push({ tileId: tile.id, end: "both" });
    } else if (canLeft) {
      moves.push({ tileId: tile.id, end: "left" });
    } else if (canRight) {
      moves.push({ tileId: tile.id, end: "right" });
    }
  }
  return moves;
}

function hasLegalMove(
  hand: Tile[],
  leftEnd: number | null,
  rightEnd: number | null
): boolean {
  return getLegalMoves(hand, leftEnd, rightEnd).length > 0;
}

function determineStartingPlayer(
  mode: GameMode,
  hands: Record<string, Tile[]>,
  seatOrder: string[],
  previousWinnerId?: string
): { playerId: string; tileId: string; reason: string } {
  if (previousWinnerId) {
    const winnerHand = hands[previousWinnerId];
    if (winnerHand && winnerHand.length > 0) {
      return {
        playerId: previousWinnerId,
        tileId: winnerHand[0].id,
        reason: "Ganador de la mano anterior",
      };
    }
  }

  const doubleOrder = [6, 5, 4, 3, 2, 1, 0];

  for (const seat of seatOrder) {
    const hand = hands[seat];
    if (!hand) continue;
    const sixSix = hand.find((t) => t.id === "6-6");
    if (sixSix) {
      return { playerId: seat, tileId: "6-6", reason: "Tiene 6-6" };
    }
  }

  for (const d of doubleOrder) {
    for (const seat of seatOrder) {
      const hand = hands[seat];
      if (!hand) continue;
      const dbl = hand.find((t) => t.a === d && t.b === d);
      if (dbl) {
        return { playerId: seat, tileId: dbl.id, reason: `Doble ${d}-${d}` };
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
      reason: `Ficha de mayor valor (${bestTile.a}-${bestTile.b})`,
    };
  }

  return { playerId: seatOrder[0], tileId: hands[seatOrder[0]][0].id, reason: "Por defecto" };
}

function getNextPlayer(state: GameState): string | null {
  const activeSeats = state.seats.filter((s): s is string => s !== null);
  if (activeSeats.length === 0) return null;
  const currentIdx = activeSeats.indexOf(state.currentPlayerId!);
  if (currentIdx === -1) return activeSeats[0];
  return activeSeats[(currentIdx + 1) % activeSeats.length];
}

function isTranque(state: GameState): boolean {
  const activeSeats = state.seats.filter((s): s is string => s !== null);
  for (const pid of activeSeats) {
    const hand = state.hands[pid];
    if (hand && hasLegalMove(hand, state.leftEnd, state.rightEnd)) {
      return false;
    }
  }
  return true;
}

function isVueltaRedonda(state: GameState, lastPlayerId: string): boolean {
  const activeSeats = state.seats.filter((s): s is string => s !== null);
  if (activeSeats.length < 4) return false;
  const lastIdx = activeSeats.indexOf(lastPlayerId);
  if (lastIdx === -1) return false;
  for (let i = 1; i < activeSeats.length; i++) {
    const pid = activeSeats[(lastIdx + i) % activeSeats.length];
    const hand = state.hands[pid];
    if (hand && hasLegalMove(hand, state.leftEnd, state.rightEnd)) {
      return false;
    }
  }
  return true;
}

// ===== SCORING =====
function handTotal(tiles: Tile[]): number {
  return tiles.reduce((sum, t) => sum + tileValue(t), 0);
}
function getTeamForPlayer(state: GameState, playerId: string): number {
  return state.teams[playerId] ?? 0;
}
function getTeammate(state: GameState, playerId: string): string | null {
  const myTeam = getTeamForPlayer(state, playerId);
  for (const pid of Object.keys(state.teams)) {
    if (pid !== playerId && state.teams[pid] === myTeam) return pid;
  }
  return null;
}
function getActivePlayers(state: GameState): string[] {
  return state.seats.filter((s): s is string => s !== null);
}

function isCapicua(lastTile: Tile, leftEnd: number, rightEnd: number): boolean {
  if (isDouble(lastTile)) return false;
  return (
    (lastTile.a === leftEnd || lastTile.b === leftEnd) &&
    (lastTile.a === rightEnd || lastTile.b === rightEnd) &&
    leftEnd !== rightEnd
  );
}

function bonusForTarget(base: number, target: number): number {
  return target === 100 ? Math.floor(base / 2) : base;
}
function canApplyBonus(score: number, target: number): boolean {
  const threshold = target === 100 ? 85 : 170;
  return score <= threshold;
}

function scoreNormalWin(
  state: GameState,
  winnerId: string
): { points: number; details: string } {
  const active = getActivePlayers(state);
  const mode = state.mode;

  if (mode === "2v2") {
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
    return { points: total, details: "Puntos de oponentes + compañero" };
  }

  let total = 0;
  for (const pid of active) {
    if (pid !== winnerId) {
      total += handTotal(state.hands[pid]);
    }
  }
  return { points: total, details: "Puntos de oponentes" };
}

function scoreTranque(
  state: GameState,
  tranquerId: string
): { points: number; winnerId: string; details: string } {
  const active = getActivePlayers(state);
  const mode = state.mode;
  const tranquerPoints = handTotal(state.hands[tranquerId]);

  if (mode === "2v2") {
    const activeArr = active;
    const idx = activeArr.indexOf(tranquerId);
    const nextPlayer = activeArr[(idx + 1) % activeArr.length];
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
    return { points: total, winnerId, details: "Tranque 2v2" };
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
  return { points: total, winnerId, details: "Tranque individual" };
}

// ===== ENGINE =====
function createInitialState(
  config: RoomConfig,
  players: { id: string; seat: number; isSpectator: boolean }[]
): GameState {
  const seats: (string | null)[] = [null, null, null, null];
  const teams: Record<string, number> = {};
  const scores: Record<string, number> = {};

  for (const p of players) {
    if (p.isSpectator) continue;
    seats[p.seat] = p.id;
    scores[p.id] = 0;
    teams[p.id] = config.mode === "2v2" ? p.seat % 2 : p.seat;
  }

  return {
    phase: "waiting",
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

function dealNewHand(state: GameState, previousWinnerId?: string): GameState {
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
    state.handNumber === 0 ? undefined : previousWinnerId
  );

  return {
    ...state,
    phase: "playing",
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
}

type PlayResult = {
  state: GameState;
  error: string | null;
  handEnded: boolean;
  forcedTileId?: string;
  drewTile?: Tile;
};

function playTile(
  state: GameState,
  playerId: string,
  tileId: string,
  end: "left" | "right"
): PlayResult {
  if (state.phase !== "playing") return { state, error: "No hay partida en curso", handEnded: false };
  if (state.currentPlayerId !== playerId) return { state, error: "No es tu turno", handEnded: false };

  const hand = state.hands[playerId];
  if (!hand) return { state, error: "No tienes mano", handEnded: false };

  const tile = getTileById(hand, tileId);
  if (!tile) return { state, error: "No tienes esa ficha", handEnded: false };

  const legalMoves = getLegalMoves(hand, state.leftEnd, state.rightEnd);
  if (legalMoves.length === 0) return { state, error: "No tienes jugadas legales", handEnded: false };

  const move = legalMoves.find((m) => m.tileId === tileId);
  if (!move) return { state, error: "Esa ficha no se puede jugar", handEnded: false };

  let chosenEnd: "left" | "right" = end;
  if (move.end !== "both" && move.end !== chosenEnd)
    return { state, error: "No se puede colocar en ese extremo", handEnded: false };
  if (state.chain.length === 0) chosenEnd = "left";

  let newChain = [...state.chain];
  let newLeftEnd = state.leftEnd;
  let newRightEnd = state.rightEnd;

  if (newChain.length === 0) {
    newLeftEnd = tile.a;
    newRightEnd = tile.b;
    newChain.push({ tileId: tile.id, left: tile.a, right: tile.b, playedBy: playerId });
  } else if (chosenEnd === "left") {
    const connectVal = newLeftEnd!;
    let leftSide: number, rightSide: number;
    if (tile.a === connectVal) { leftSide = tile.b; rightSide = tile.a; }
    else { leftSide = tile.a; rightSide = tile.b; }
    newLeftEnd = leftSide;
    newChain.unshift({ tileId: tile.id, left: leftSide, right: rightSide, playedBy: playerId });
  } else {
    const connectVal = newRightEnd!;
    let leftSide: number, rightSide: number;
    if (tile.a === connectVal) { leftSide = tile.a; rightSide = tile.b; }
    else { leftSide = tile.b; rightSide = tile.a; }
    newRightEnd = rightSide;
    newChain.push({ tileId: tile.id, left: leftSide, right: rightSide, playedBy: playerId });
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
    return { state: endHand(newState, playerId, tile), error: null, handEnded: true };
  }

  const nextPlayer = getNextPlayer({ ...newState, currentPlayerId: playerId });
  newState.currentPlayerId = nextPlayer;

  if (isTranque(newState)) {
    return { state: endHandByTranque(newState), error: null, handEnded: true };
  }

  return { state: newState, error: null, handEnded: false };
}

function passTurn(state: GameState, playerId: string): PlayResult {
  if (state.phase !== "playing") return { state, error: "No hay partida en curso", handEnded: false };
  if (state.currentPlayerId !== playerId) return { state, error: "No es tu turno", handEnded: false };

  const hand = state.hands[playerId];
  if (!hand) return { state, error: "No tienes mano", handEnded: false };
  if (hasLegalMove(hand, state.leftEnd, state.rightEnd))
    return { state, error: "Tienes jugadas legales, no puedes pasar", handEnded: false };

  const newPassHistory = [...state.passHistory, playerId];
  const nextPlayer = getNextPlayer({ ...state, currentPlayerId: playerId });

  let newState: GameState = {
    ...state,
    consecutivePasses: state.consecutivePasses + 1,
    passHistory: newPassHistory,
    currentPlayerId: nextPlayer,
  };

  if (isTranque(newState)) {
    return { state: endHandByTranque(newState), error: null, handEnded: true };
  }

  return { state: newState, error: null, handEnded: false };
}

function drawTile(state: GameState, playerId: string): PlayResult & { drewTile?: Tile } {
  if (state.phase !== "playing") return { state, error: "No hay partida en curso", handEnded: false };
  if (state.currentPlayerId !== playerId) return { state, error: "No es tu turno", handEnded: false };
  if (!state.withCarga) return { state, error: "Este modo no tiene carga", handEnded: false };
  if (state.drawPile.length === 0) return { state, error: "No hay fichas para robar", handEnded: false };

  const hand = state.hands[playerId];
  if (!hand) return { state, error: "No tienes mano", handEnded: false };
  if (hasLegalMove(hand, state.leftEnd, state.rightEnd))
    return { state, error: "Tienes jugadas legales, no puedes robar", handEnded: false };

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
    return { state: newState, error: null, handEnded: false, forcedTileId: drawnTile.id, drewTile: drawnTile };
  }
  if (drawPile.length === 0) {
    return { state: newState, error: null, handEnded: false, drewTile: drawnTile };
  }
  return drawTile(newState, playerId);
}

function endHand(state: GameState, winnerId: string, lastTile: Tile): GameState {
  const mode = state.mode;
  const target = state.targetPoints;
  const { points, details } = scoreNormalWin(state, winnerId);

  let bonusPoints = 0;
  const bonusTypes: string[] = [];

  if (isCapicua(lastTile, state.leftEnd!, state.rightEnd!)) {
    bonusPoints += bonusForTarget(30, target);
    bonusTypes.push("capicúa");
  }

  if (mode === "2v2" || mode === "4individual") {
    if (isVueltaRedonda(state, winnerId)) {
      if (canApplyBonus(state.scores[winnerId] || 0, target)) {
        bonusPoints += bonusForTarget(30, target);
        bonusTypes.push("vuelta redonda");
      }
    }
  }

  if (state.salidaBonus && (mode === "2v2" || mode === "4individual")) {
    if (canApplyBonus(state.scores[winnerId] || 0, target)) {
      bonusPoints += state.salidaBonus.points;
      bonusTypes.push(state.salidaBonus.type);
    }
  }

  const bonusType = bonusTypes.length > 0 ? bonusTypes.join(" + ") : null;
  const result: HandResult = { type: "win", winnerId, points, bonusPoints, bonusType, details };

  const newScores = { ...state.scores };
  if (mode === "2v2") {
    const winnerTeam = getTeamForPlayer(state, winnerId);
    for (const pid of getActivePlayers(state)) {
      if (getTeamForPlayer(state, pid) === winnerTeam) {
        newScores[pid] = (newScores[pid] || 0) + points + bonusPoints;
      }
    }
  } else {
    newScores[winnerId] = (newScores[winnerId] || 0) + points + bonusPoints;
  }

  const matchEnded = newScores[winnerId] >= target;
  return { ...state, phase: matchEnded ? "match_end" : "hand_end", scores: newScores, lastHandResult: result };
}

function endHandByTranque(state: GameState): GameState {
  const mode = state.mode;
  const target = state.targetPoints;
  const tranquerId = state.passHistory.length > 0
    ? state.passHistory[state.passHistory.length - 1]
    : state.currentPlayerId!;

  const { points, winnerId, details } = scoreTranque(state, tranquerId);
  const result: HandResult = { type: "tranque", winnerId, points, bonusPoints: 0, bonusType: null, details };

  const newScores = { ...state.scores };
  if (mode === "2v2") {
    const winnerTeam = getTeamForPlayer(state, winnerId);
    for (const pid of getActivePlayers(state)) {
      if (getTeamForPlayer(state, pid) === winnerTeam) {
        newScores[pid] = (newScores[pid] || 0) + points;
      }
    }
  } else {
    newScores[winnerId] = (newScores[winnerId] || 0) + points;
  }

  const matchEnded = newScores[winnerId] >= target;
  return { ...state, phase: matchEnded ? "match_end" : "hand_end", scores: newScores, lastHandResult: result };
}

// ===== FILTER STATE =====
function filterStateForPlayer(state: GameState, viewerId: string, isSpectator: boolean) {
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
  };
}

// ===== ROOM CODE =====
function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ===== MAIN HANDLER =====
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace("/functions/v1/domino-game", "").replace("/domino-game", "");
    const body = await req.json();
    const { action } = body;

    // --- CREATE ROOM ---
    if (action === "create_room") {
      const {
        playerId,
        nickname,
        mode,
        targetPoints,
        withCarga,
        isPublic,
        voiceEnabled,
        spectatorsAllowed,
        name,
      } = body;

      const config: RoomConfig = {
        mode: mode || "2v2",
        targetPoints: targetPoints || 100,
        withCarga: withCarga || false,
        isPublic: isPublic !== false,
        voiceEnabled: voiceEnabled || false,
        spectatorsAllowed: spectatorsAllowed !== false,
        name: name || "",
      };

      let code = generateRoomCode();
      let attempts = 0;
      while (attempts < 10) {
        const { data: existing } = await supabase
          .from("rooms")
          .select("id")
          .eq("code", code)
          .maybeSingle();
        if (!existing) break;
        code = generateRoomCode();
        attempts++;
      }

      const { data: room, error: roomError } = await supabase
        .from("rooms")
        .insert({
          code,
          name: config.name,
          mode: config.mode,
          target_points: config.targetPoints,
          with_carga: config.withCarga,
          is_public: config.isPublic,
          voice_enabled: config.voiceEnabled,
          spectators_allowed: config.spectatorsAllowed,
          creator_id: playerId,
          status: "waiting",
        })
        .select()
        .single();

      if (roomError) {
        return new Response(JSON.stringify({ error: roomError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("players").insert({
        id: playerId,
        room_id: room.id,
        nickname,
        seat: 0,
        is_spectator: false,
        is_creator: true,
        is_connected: true,
      });

      const initialState = createInitialState(config, [{ id: playerId, seat: 0, isSpectator: false }]);
      await supabase.from("rooms").update({ game_state: initialState }).eq("id", room.id);

      return new Response(JSON.stringify({ room: { ...room, game_state: initialState } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- JOIN ROOM ---
    if (action === "join_room") {
      const { playerId, nickname, code } = body;

      const { data: room, error: roomError } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", code.toUpperCase())
        .maybeSingle();

      if (roomError || !room) {
        return new Response(JSON.stringify({ error: "Mesa no encontrada" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: existingPlayers } = await supabase
        .from("players")
        .select("*")
        .eq("room_id", room.id);

      const existing = existingPlayers || [];
      const alreadyIn = existing.find((p: any) => p.id === playerId);
      if (alreadyIn) {
        return new Response(JSON.stringify({ room, players: existing }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const seatsTaken = existing.filter((p: any) => !p.is_spectator).map((p: any) => p.seat);
      const maxPlayers = room.mode === "1v1" ? 2 : room.mode === "pintintin" ? 3 : 4;
      let seat = -1;
      for (let i = 0; i < maxPlayers; i++) {
        if (!seatsTaken.includes(i)) {
          seat = i;
          break;
        }
      }

      const isSpectator = seat === -1;
      if (isSpectator && !room.spectators_allowed) {
        return new Response(JSON.stringify({ error: "Mesa llena y espectadores no permitidos" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("players").insert({
        id: playerId,
        room_id: room.id,
        nickname,
        seat: isSpectator ? -1 : seat,
        is_spectator: isSpectator,
        is_creator: false,
        is_connected: true,
      });

      const { data: updatedPlayers } = await supabase
        .from("players")
        .select("*")
        .eq("room_id", room.id);

      return new Response(JSON.stringify({ room, players: updatedPlayers }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- GET ROOM STATE ---
    if (action === "get_state") {
      const { roomId, playerId } = body;

      const { data: room } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", roomId)
        .maybeSingle();

      if (!room) {
        return new Response(JSON.stringify({ error: "Mesa no encontrada" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: players } = await supabase
        .from("players")
        .select("*")
        .eq("room_id", roomId);

      const gameState = room.game_state as GameState | null;
      const player = (players || []).find((p: any) => p.id === playerId);
      const isSpectator = player?.is_spectator || false;

      const visibleState = gameState
        ? filterStateForPlayer(gameState, playerId, isSpectator)
        : null;

      return new Response(
        JSON.stringify({ room, players: players || [], gameState: visibleState }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- START GAME ---
    if (action === "start_game") {
      const { roomId, playerId } = body;

      const { data: room } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", roomId)
        .maybeSingle();

      if (!room) {
        return new Response(JSON.stringify({ error: "Mesa no encontrada" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (room.creator_id !== playerId) {
        return new Response(JSON.stringify({ error: "Solo el creador puede iniciar" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: players } = await supabase
        .from("players")
        .select("*")
        .eq("room_id", roomId)
        .eq("is_spectator", false);

      const activePlayers = (players || []).filter((p: any) => !p.is_spectator);
      const mode = room.mode as GameMode;
      const required = mode === "1v1" ? 2 : mode === "pintintin" ? 3 : 4;

      if (activePlayers.length < required) {
        return new Response(JSON.stringify({ error: `Faltan jugadores (${activePlayers.length}/${required})` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const config: RoomConfig = {
        mode,
        targetPoints: room.target_points,
        withCarga: room.with_carga,
        isPublic: room.is_public,
        voiceEnabled: room.voice_enabled,
        spectatorsAllowed: room.spectators_allowed,
        name: room.name || "",
      };

      const playerInfos = activePlayers.map((p: any) => ({
        id: p.id,
        seat: p.seat,
        isSpectator: false,
      }));

      let state = createInitialState(config, playerInfos);
      state = dealNewHand(state);

      await supabase
        .from("rooms")
        .update({ game_state: state, status: "playing", updated_at: new Date().toISOString() })
        .eq("id", roomId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- PLAY TILE ---
    if (action === "play_tile") {
      const { roomId, playerId, tileId, end } = body;

      const { data: room } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", roomId)
        .maybeSingle();

      if (!room || !room.game_state) {
        return new Response(JSON.stringify({ error: "Partida no encontrada" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const state = room.game_state as GameState;
      const result = playTile(state, playerId, tileId, end);

      if (result.error) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase
        .from("rooms")
        .update({ game_state: result.state, updated_at: new Date().toISOString() })
        .eq("id", roomId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- PASS ---
    if (action === "pass") {
      const { roomId, playerId } = body;

      const { data: room } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", roomId)
        .maybeSingle();

      if (!room || !room.game_state) {
        return new Response(JSON.stringify({ error: "Partida no encontrada" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const state = room.game_state as GameState;
      const result = passTurn(state, playerId);

      if (result.error) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase
        .from("rooms")
        .update({ game_state: result.state, updated_at: new Date().toISOString() })
        .eq("id", roomId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- DRAW (CARGA) ---
    if (action === "draw") {
      const { roomId, playerId } = body;

      const { data: room } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", roomId)
        .maybeSingle();

      if (!room || !room.game_state) {
        return new Response(JSON.stringify({ error: "Partida no encontrada" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const state = room.game_state as GameState;
      const result = drawTile(state, playerId);

      if (result.error) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase
        .from("rooms")
        .update({ game_state: result.state, updated_at: new Date().toISOString() })
        .eq("id", roomId);

      return new Response(JSON.stringify({ success: true, forcedTileId: result.forcedTileId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- NEXT HAND ---
    if (action === "next_hand") {
      const { roomId, playerId } = body;

      const { data: room } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", roomId)
        .maybeSingle();

      if (!room || !room.game_state) {
        return new Response(JSON.stringify({ error: "Partida no encontrada" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const state = room.game_state as GameState;
      if (state.phase !== "hand_end") {
        return new Response(JSON.stringify({ error: "La mano no ha terminado" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const winnerId = state.lastHandResult?.winnerId;
      const newState = dealNewHand(state, winnerId);

      await supabase
        .from("rooms")
        .update({ game_state: newState, updated_at: new Date().toISOString() })
        .eq("id", roomId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- REMATCH ---
    if (action === "rematch") {
      const { roomId, playerId } = body;

      const { data: room } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", roomId)
        .maybeSingle();

      if (!room || !room.game_state) {
        return new Response(JSON.stringify({ error: "Partida no encontrada" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const state = room.game_state as GameState;
      if (state.phase !== "match_end") {
        return new Response(JSON.stringify({ error: "La partida no ha terminado" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const rematch = [...new Set([...state.rematchRequested, playerId])];
      const newState = { ...state, rematchRequested: rematch };
      await supabase
        .from("rooms")
        .update({ game_state: newState, updated_at: new Date().toISOString() })
        .eq("id", roomId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- LEAVE ROOM ---
    if (action === "leave_room") {
      const { roomId, playerId } = body;
      await supabase.from("players").delete().eq("id", playerId).eq("room_id", roomId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- LIST PUBLIC ROOMS ---
    if (action === "list_rooms") {
      const { data: rooms } = await supabase
        .from("rooms")
        .select("*")
        .eq("is_public", true)
        .eq("status", "waiting")
        .order("created_at", { ascending: false })
        .limit(20);

      return new Response(JSON.stringify({ rooms: rooms || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Acción no reconocida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
