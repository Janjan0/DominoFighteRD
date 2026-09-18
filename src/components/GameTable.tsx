import { useState, useEffect, useRef, useCallback } from 'react';
import { Crown, LogOut, RotateCw, Trophy, Layers, Eye } from 'lucide-react';
import { apiCall } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import DominoTile from './DominoTile';

type Tile = { id: string; a: number; b: number };
type BoardTile = { tileId: string; left: number; right: number; playedBy: string };
type HandResult = {
  type: 'win' | 'tranque';
  winnerId: string;
  points: number;
  bonusPoints: number;
  bonusType: string | null;
  details: string;
};

type VisibleState = {
  phase: string;
  mode: string;
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
};

type Player = {
  id: string;
  nickname: string;
  seat: number;
  is_spectator: boolean;
  is_creator: boolean;
  is_connected: boolean;
};

type GameTableProps = {
  roomId: string;
  playerId: string;
  onLeave: () => void;
};

const MODE_LABELS: Record<string, string> = {
  '2v2': '2v2',
  '1v1': '1v1',
  'pintintin': 'Pintintin',
  '4individual': '4 Indiv.',
};

export default function GameTable({ roomId, playerId, onLeave }: GameTableProps) {
  const [state, setState] = useState<VisibleState | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastFetch, setLastFetch] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchState = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetch < 300) return;
    setLastFetch(now);
    try {
      const data = await apiCall({ action: 'get_state', roomId, playerId });
      setState(data.gameState);
      setPlayers(data.players || []);
    } catch {
      // ignore polling errors
    }
  }, [roomId, playerId, lastFetch]);

  useEffect(() => {
    fetchState();

    const channel = supabase
      .channel(`game-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, () => fetchState())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` }, () => fetchState())
      .subscribe();

    pollingRef.current = setInterval(fetchState, 3000);

    return () => {
      supabase.removeChannel(channel);
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [roomId]);

  const playerMap: Record<string, Player> = {};
  for (const p of players) playerMap[p.id] = p;
  const me = playerMap[playerId];
  const isSpectator = me?.is_spectator || false;

  // Determine legal moves for my hand
  const myLegalTileIds = new Set<string>();
  if (state && !isSpectator && state.phase === 'playing') {
    for (const tile of state.myHand) {
      const canLeft = state.chain.length === 0 || tile.a === state.leftEnd || tile.b === state.leftEnd;
      const canRight = tile.a === state.rightEnd || tile.b === state.rightEnd;
      if (canLeft || canRight || state.chain.length === 0) {
        myLegalTileIds.add(tile.id);
      }
    }
  }

  const isMyTurn = state?.currentPlayerId === playerId && !isSpectator && state?.phase === 'playing';
  const hasLegalMove = myLegalTileIds.size > 0;

  const handlePlayTile = async (tile: Tile, end: 'left' | 'right') => {
    setLoading(true);
    setError('');
    try {
      await apiCall({ action: 'play_tile', roomId, playerId, tileId: tile.id, end });
      setSelectedTile(null);
      await fetchState();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al jugar');
    } finally {
      setLoading(false);
    }
  };

  const handlePass = async () => {
    setLoading(true);
    setError('');
    try {
      await apiCall({ action: 'pass', roomId, playerId });
      await fetchState();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al pasar');
    } finally {
      setLoading(false);
    }
  };

  const handleDraw = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiCall({ action: 'draw', roomId, playerId });
      await fetchState();
      if (data.forcedTileId) {
        // The drawn tile is playable — it will be highlighted after refetch
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al robar');
    } finally {
      setLoading(false);
    }
  };

  const handleNextHand = async () => {
    setLoading(true);
    try {
      await apiCall({ action: 'next_hand', roomId, playerId });
      await fetchState();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleRematch = async () => {
    setLoading(true);
    try {
      await apiCall({ action: 'rematch', roomId, playerId });
      await fetchState();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async () => {
    await apiCall({ action: 'leave_room', roomId, playerId });
    onLeave();
  };

  if (!state) {
    return (
      <div className="min-h-screen bg-emerald-950 flex items-center justify-center text-white">
        <p>Cargando partida...</p>
      </div>
    );
  }

  const activeSeats = state.seats.filter((s): s is string => s !== null);

  // Score display
  const renderScores = () => {
    if (state.mode === '2v2') {
      const team0 = activeSeats.find((sid) => state.teams[sid] === 0);
      const team1 = activeSeats.find((sid) => state.teams[sid] === 1);
      return (
        <div className="flex gap-4 items-center">
          <ScoreCard label="Eq 1" value={team0 ? state.scores[team0] || 0 : 0} color="emerald" />
          <span className="text-emerald-600 text-xs">vs</span>
          <ScoreCard label="Eq 2" value={team1 ? state.scores[team1] || 0 : 0} color="amber" />
        </div>
      );
    }
    return (
      <div className="flex flex-wrap gap-2">
        {activeSeats.map((sid) => {
          const p = playerMap[sid];
          return (
            <ScoreCard key={sid} label={p?.nickname || '?'} value={state.scores[sid] || 0} color="emerald" />
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 via-emerald-900 to-slate-900 text-white flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-emerald-950/80 border-b border-emerald-800">
        <div className="flex items-center gap-2">
          <span className="font-black text-sm">Dominó <span className="text-amber-400">FighteRD</span></span>
          <span className="text-emerald-600 text-xs">|</span>
          <span className="text-emerald-300 text-xs">{MODE_LABELS[state.mode]}</span>
          <span className="text-emerald-600 text-xs">|</span>
          <span className="text-emerald-300 text-xs">Mano {state.handNumber}</span>
          <span className="text-emerald-600 text-xs">|</span>
          <span className="text-amber-400 text-xs">Objetivo: {state.targetPoints}</span>
        </div>
        <button onClick={handleLeave} className="text-emerald-400 hover:text-red-400 transition-colors">
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* Scores */}
      <div className="px-3 py-2 bg-emerald-950/40 border-b border-emerald-800/50">
        {renderScores()}
      </div>

      {/* Opponents info */}
      <div className="px-3 py-2 flex justify-center gap-4 flex-wrap">
        {state.seats.map((sid, i) => {
          if (sid === playerId) return null;
          const p = sid ? playerMap[sid] : null;
          const isCurrent = state.currentPlayerId === sid;
          const team = sid ? state.teams[sid] : -1;
          return (
            <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${isCurrent ? 'bg-amber-500/20 ring-1 ring-amber-400' : 'bg-emerald-900/40'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${state.mode === '2v2' ? (team === 0 ? 'bg-emerald-600' : 'bg-amber-600') : 'bg-emerald-700'}`}>{i + 1}</span>
              <span className="text-sm font-medium">{p?.nickname || '...'}</span>
              <span className="text-xs text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded">{(sid && state.handSizes[sid]) || 0} fichas</span>
              {p?.is_creator && <Crown className="w-3 h-3 text-amber-400" />}
            </div>
          );
        })}
      </div>

      {/* Board area */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <div className="w-full max-w-2xl">
          {state.chain.length === 0 ? (
            <div className="text-center text-emerald-600 py-12">
              <p className="text-sm">Esperando primera jugada...</p>
              {state.startingPlayerId && (
                <p className="text-amber-400 mt-2 text-sm">
                  Empieza: {playerMap[state.startingPlayerId]?.nickname || '?'}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-1 max-h-[40vh] overflow-y-auto">
              {state.chain.map((bt, i) => {
                return (
                  <div key={`${bt.tileId}-${i}`} className="flex items-center">
                    <DominoTile a={bt.left} b={bt.right} size="sm" />
                    {i < state.chain.length - 1 && <div className="w-1 h-3 bg-emerald-700/30" />}
                  </div>
                );
              })}
            </div>
          )}
          {/* Board ends indicator */}
          {state.chain.length > 0 && (
            <div className="flex justify-center gap-6 mt-3 text-xs text-emerald-400">
              <span>Izq: <span className="font-bold text-amber-400">{state.leftEnd}</span></span>
              <span>Der: <span className="font-bold text-amber-400">{state.rightEnd}</span></span>
              {state.withCarga && state.drawPileCount > 0 && (
                <span className="flex items-center gap-1"><Layers className="w-3 h-3" /> Reserva: {state.drawPileCount}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Hand + actions */}
      {!isSpectator && (
        <div className="bg-emerald-950/80 border-t border-emerald-800 p-3">
          {error && <p className="text-red-400 text-xs text-center mb-2">{error}</p>}
          {isMyTurn ? (
            <p className="text-amber-400 text-sm text-center mb-2 font-semibold">Tu turno</p>
          ) : state.phase === 'playing' ? (
            <p className="text-emerald-400 text-sm text-center mb-2">
              Turno de {playerMap[state.currentPlayerId || '']?.nickname || '?'}
            </p>
          ) : null}

          {/* Hand */}
          <div className="flex justify-center gap-1.5 overflow-x-auto pb-2 px-2" style={{ scrollbarWidth: 'thin' }}>
            {state.myHand.length === 0 ? (
              <p className="text-emerald-600 text-sm py-4">Sin fichas</p>
            ) : (
              state.myHand.map((tile) => {
                const isLegal = myLegalTileIds.has(tile.id);
                const isSelected = selectedTile?.id === tile.id;
                return (
                  <div key={tile.id} className="flex-shrink-0">
                    <DominoTile
                      a={tile.a}
                      b={tile.b}
                      size="md"
                      highlight={isSelected}
                      dimmed={isMyTurn && !isLegal}
                      onClick={isMyTurn && isLegal ? () => setSelectedTile(isSelected ? null : tile) : undefined}
                    />
                  </div>
                );
              })
            )}
          </div>

          {/* Actions */}
          {state.phase === 'playing' && isMyTurn && (
            <div className="flex justify-center gap-2 mt-2">
              {selectedTile ? (
                <>
                  {(() => {
                    const canLeft = state.chain.length === 0 || selectedTile.a === state.leftEnd || selectedTile.b === state.leftEnd;
                    const canRight = selectedTile.a === state.rightEnd || selectedTile.b === state.rightEnd;
                    return (
                      <>
                        {canLeft && (
                          <button
                            onClick={() => handlePlayTile(selectedTile, 'left')}
                            disabled={loading}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition-all active:scale-95 disabled:opacity-50"
                          >
                            Izquierda
                          </button>
                        )}
                        {canRight && state.chain.length > 0 && (
                          <button
                            onClick={() => handlePlayTile(selectedTile, 'right')}
                            disabled={loading}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition-all active:scale-95 disabled:opacity-50"
                          >
                            Derecha
                          </button>
                        )}
                        {state.chain.length === 0 && (
                          <button
                            onClick={() => handlePlayTile(selectedTile, 'left')}
                            disabled={loading}
                            className="bg-amber-500 hover:bg-amber-400 text-emerald-950 text-sm font-bold px-4 py-2 rounded-lg transition-all active:scale-95 disabled:opacity-50"
                          >
                            Jugar
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedTile(null)}
                          className="bg-emerald-800 text-emerald-300 text-sm px-3 py-2 rounded-lg hover:bg-emerald-700"
                        >
                          Cancelar
                        </button>
                      </>
                    );
                  })()}
                </>
              ) : (
                <>
                  {!hasLegalMove && state.withCarga && state.drawPileCount > 0 && (
                    <button
                      onClick={handleDraw}
                      disabled={loading}
                      className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1"
                    >
                      <Layers className="w-4 h-4" /> Robar
                    </button>
                  )}
                  {!hasLegalMove && (!state.withCarga || state.drawPileCount === 0) && (
                    <button
                      onClick={handlePass}
                      disabled={loading}
                      className="bg-red-600 hover:bg-red-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition-all active:scale-95 disabled:opacity-50"
                    >
                      Pasar
                    </button>
                  )}
                  {!hasLegalMove && state.withCarga && state.drawPileCount === 0 && (
                    <button
                      onClick={handlePass}
                      disabled={loading}
                      className="bg-red-600 hover:bg-red-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition-all active:scale-95 disabled:opacity-50"
                    >
                      Pasar
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Hand end / Match end */}
          {state.phase === 'hand_end' && state.lastHandResult && (
            <HandEndOverlay
              result={state.lastHandResult}
              playerMap={playerMap}
              isCreator={me?.is_creator}
              onNext={handleNextHand}
              loading={loading}
            />
          )}
          {state.phase === 'match_end' && state.lastHandResult && (
            <MatchEndOverlay
              result={state.lastHandResult}
              playerMap={playerMap}
              scores={state.scores}
              rematchRequested={state.rematchRequested}
              playerId={playerId}
              onRematch={handleRematch}
              loading={loading}
            />
          )}
        </div>
      )}

      {/* Spectator view */}
      {isSpectator && (
        <div className="bg-emerald-950/80 border-t border-emerald-800 p-3 text-center">
          <Eye className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
          <p className="text-emerald-400 text-sm">Estás como espectador</p>
          {state.phase === 'hand_end' && state.lastHandResult && (
            <HandEndOverlay
              result={state.lastHandResult}
              playerMap={playerMap}
              isCreator={false}
              onNext={() => {}}
              loading={false}
            />
          )}
          {state.phase === 'match_end' && state.lastHandResult && (
            <MatchEndOverlay
              result={state.lastHandResult}
              playerMap={playerMap}
              scores={state.scores}
              rematchRequested={state.rematchRequested}
              playerId={playerId}
              onRematch={() => {}}
              loading={false}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ScoreCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorClass = color === 'amber' ? 'text-amber-400 bg-amber-950/40' : 'text-emerald-300 bg-emerald-900/40';
  return (
    <div className={`px-3 py-1 rounded-lg ${colorClass}`}>
      <span className="text-xs opacity-70">{label}: </span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

function HandEndOverlay({
  result,
  playerMap,
  isCreator,
  onNext,
  loading,
}: {
  result: HandResult;
  playerMap: Record<string, Player>;
  isCreator: boolean;
  onNext: () => void;
  loading: boolean;
}) {
  return (
    <div className="mt-2 bg-emerald-900/60 rounded-xl p-4 text-center border border-emerald-700">
      <p className="text-amber-400 font-bold text-lg">
        {result.type === 'win' ? 'Mano ganada' : 'Tranque'}
      </p>
      <p className="text-emerald-200 mt-1">
        {playerMap[result.winnerId]?.nickname || '?'} +{result.points} puntos
      </p>
      {result.bonusPoints > 0 && (
        <p className="text-amber-400 text-sm mt-1">Bono: +{result.bonusPoints} ({result.bonusType})</p>
      )}
      {result.details && <p className="text-emerald-400 text-xs mt-1">{result.details}</p>}
      {isCreator && (
        <button
          onClick={onNext}
          disabled={loading}
          className="mt-3 bg-amber-500 hover:bg-amber-400 text-emerald-950 font-bold px-6 py-2 rounded-lg transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 mx-auto"
        >
          <RotateCw className="w-4 h-4" /> Siguiente Mano
        </button>
      )}
      {!isCreator && <p className="text-emerald-500 text-xs mt-2">Esperando siguiente mano...</p>}
    </div>
  );
}

function MatchEndOverlay({
  result,
  playerMap,
  scores,
  rematchRequested,
  playerId,
  onRematch,
  loading,
}: {
  result: HandResult;
  playerMap: Record<string, Player>;
  scores: Record<string, number>;
  rematchRequested: string[];
  playerId: string;
  onRematch: () => void;
  loading: boolean;
}) {
  const winnerName = playerMap[result.winnerId]?.nickname || '?';
  const hasRematched = rematchRequested.includes(playerId);
  return (
    <div className="mt-2 bg-gradient-to-b from-amber-900/40 to-emerald-900/60 rounded-xl p-5 text-center border border-amber-600">
      <Trophy className="w-10 h-10 text-amber-400 mx-auto mb-2" />
      <p className="text-amber-400 font-black text-xl">Partida Terminada</p>
      <p className="text-white text-lg mt-2 font-bold">{winnerName} gana!</p>
      <p className="text-emerald-300 text-sm mt-1">{result.points} puntos esta mano</p>
      {result.bonusPoints > 0 && (
        <p className="text-amber-400 text-sm">Bono: +{result.bonusPoints} ({result.bonusType})</p>
      )}
      <div className="mt-3 flex justify-center gap-2 flex-wrap">
        {Object.entries(scores).map(([pid, score]) => (
          <span key={pid} className="text-xs bg-emerald-950/60 px-2 py-1 rounded">
            {playerMap[pid]?.nickname || '?'}: {score}
          </span>
        ))}
      </div>
      <button
        onClick={onRematch}
        disabled={loading || hasRematched}
        className="mt-4 bg-amber-500 hover:bg-amber-400 text-emerald-950 font-bold px-6 py-2 rounded-lg transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 mx-auto"
      >
        <RotateCw className="w-4 h-4" /> {hasRematched ? 'Rematch solicitado' : 'Revancha'}
      </button>
      {rematchRequested.length > 0 && (
        <p className="text-emerald-400 text-xs mt-2">{rematchRequested.length} jugador(es) quieren revancha</p>
      )}
    </div>
  );
}
