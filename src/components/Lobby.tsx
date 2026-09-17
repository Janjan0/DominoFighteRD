import { useState, useEffect } from 'react';
import { Copy, Crown, Play, Users, Eye, Volume2, VolumeX, LogOut, Search } from 'lucide-react';
import { apiCall } from '@/lib/api';
import { supabase } from '@/lib/supabase';

type Player = {
  id: string;
  nickname: string;
  seat: number;
  is_spectator: boolean;
  is_creator: boolean;
  is_connected: boolean;
};

type Room = {
  id: string;
  code: string;
  name: string;
  mode: string;
  target_points: number;
  with_carga: boolean;
  is_public: boolean;
  voice_enabled: boolean;
  spectators_allowed: boolean;
  creator_id: string;
  status: string;
};

type LobbyProps = {
  roomId: string;
  playerId: string;
  nickname: string;
  onGameStart: () => void;
  onLeave: () => void;
};

const MODE_LABELS: Record<string, string> = {
  '2v2': '2 vs 2',
  '1v1': '1 vs 1',
  'pintintin': 'Pintintin',
  '4individual': '4 Individual',
};

const MODE_SEATS: Record<string, number> = {
  '2v2': 4,
  '1v1': 2,
  'pintintin': 3,
  '4individual': 4,
};

export default function Lobby({ roomId, playerId, nickname, onGameStart, onLeave }: LobbyProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchState();
    const channel = supabase
      .channel(`lobby-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` }, () => fetchState())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, () => fetchState())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  const fetchState = async () => {
    const data = await apiCall({ action: 'get_state', roomId, playerId });
    setRoom(data.room);
    setPlayers(data.players || []);
    if (data.room?.status === 'playing') {
      onGameStart();
    }
  };

  const handleStart = async () => {
    setLoading(true);
    setError('');
    try {
      await apiCall({ action: 'start_game', roomId, playerId });
      onGameStart();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async () => {
    await apiCall({ action: 'leave_room', roomId, playerId });
    onLeave();
  };

  const copyCode = () => {
    navigator.clipboard.writeText(room?.code || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isCreator = room?.creator_id === playerId;
  const maxSeats = room ? MODE_SEATS[room.mode] : 4;
  const seatedPlayers = players.filter((p) => !p.is_spectator);
  const spectators = players.filter((p) => p.is_spectator);
  const canStart = seatedPlayers.length >= maxSeats;

  if (!room) {
    return (
      <div className="min-h-screen bg-emerald-950 flex items-center justify-center text-white">
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 via-emerald-900 to-slate-900 text-white p-4 flex flex-col items-center">
      <div className="w-full max-w-2xl mt-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-black">Dominó <span className="text-amber-400">FighteRD</span></h1>
          <button onClick={handleLeave} className="text-emerald-400 hover:text-red-400 transition-colors flex items-center gap-1 text-sm">
            <LogOut className="w-4 h-4" /> Salir
          </button>
        </div>

        {/* Room info card */}
        <div className="bg-emerald-950/60 border border-emerald-800 rounded-2xl p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-emerald-300 text-xs uppercase tracking-wide">Código de Mesa</p>
              <button onClick={copyCode} className="flex items-center gap-2 mt-1 group">
                <span className="text-3xl font-mono font-bold tracking-widest text-amber-400">{room.code}</span>
                <Copy className="w-5 h-5 text-emerald-400 group-hover:text-amber-400 transition-colors" />
                {copied && <span className="text-xs text-emerald-400">Copiado!</span>}
              </button>
            </div>
            <div className="text-right text-sm">
              <div className="text-emerald-200 font-semibold">{MODE_LABELS[room.mode]}</div>
              <div className="text-emerald-400">{room.target_points} puntos</div>
              {room.mode === '1v1' && <div className="text-emerald-400 text-xs">{room.with_carga ? 'Con Carga' : 'Sin Carga'}</div>}
              <div className="flex gap-2 justify-end mt-1">
                {room.is_public ? <Users className="w-3 h-3 text-emerald-500" /> : <Eye className="w-3 h-3 text-emerald-500" />}
                {room.voice_enabled ? <Volume2 className="w-3 h-3 text-emerald-500" /> : <VolumeX className="w-3 h-3 text-emerald-700" />}
              </div>
            </div>
          </div>
          {room.name && <p className="text-emerald-300 text-sm border-t border-emerald-800 pt-3">{room.name}</p>}
        </div>

        {/* Players */}
        <div className="bg-emerald-950/60 border border-emerald-800 rounded-2xl p-5 mb-4">
          <h3 className="text-sm font-semibold text-emerald-300 mb-3">Jugadores ({seatedPlayers.length}/{maxSeats})</h3>
          <div className="space-y-2">
            {Array.from({ length: maxSeats }).map((_, i) => {
              const p = seatedPlayers.find((sp) => sp.seat === i);
              return (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-lg ${p ? 'bg-emerald-800/40' : 'bg-emerald-900/30 border border-dashed border-emerald-700'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${p ? 'bg-amber-500 text-emerald-950' : 'bg-emerald-800 text-emerald-600'}`}>
                    {i + 1}
                  </div>
                  {p ? (
                    <>
                      <span className="font-semibold flex-1">{p.nickname}</span>
                      {p.is_creator && <Crown className="w-4 h-4 text-amber-400" />}
                      {p.id === playerId && <span className="text-xs text-emerald-400">(Tú)</span>}
                    </>
                  ) : (
                    <span className="text-emerald-600 text-sm flex-1">Esperando jugador...</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Spectators */}
        {spectators.length > 0 && (
          <div className="bg-emerald-950/60 border border-emerald-800 rounded-2xl p-5 mb-4">
            <h3 className="text-sm font-semibold text-emerald-300 mb-2 flex items-center gap-2"><Eye className="w-4 h-4" /> Espectadores ({spectators.length})</h3>
            <div className="flex flex-wrap gap-2">
              {spectators.map((s) => (
                <span key={s.id} className="text-sm bg-emerald-800/40 px-3 py-1 rounded-full">{s.nickname}</span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          {isCreator ? (
            <button
              onClick={handleStart}
              disabled={loading || !canStart}
              className="w-full bg-amber-500 hover:bg-amber-400 text-emerald-950 font-bold py-4 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:hover:scale-100 flex items-center justify-center gap-2 text-lg"
            >
              <Play className="w-6 h-6" /> {loading ? 'Iniciando...' : canStart ? 'Iniciar Partida' : `Faltan ${maxSeats - seatedPlayers.length} jugadores`}
            </button>
          ) : (
            <div className="text-center text-emerald-400 text-sm py-4">
              Esperando a que el creador inicie la partida...
            </div>
          )}
          <p className="text-center text-emerald-600 text-xs">
            Comparte el código <span className="text-amber-400 font-mono font-bold">{room.code}</span> con tus amigos para que se unan
          </p>
        </div>
      </div>
    </div>
  );
}
