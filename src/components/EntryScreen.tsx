import { useState } from 'react';
import { Swords, LogIn, Plus, Search, Copy, Users, Eye, Volume2, VolumeX, Crown, Play, ArrowRight } from 'lucide-react';
import { apiCall } from '@/lib/api';
import { supabase } from '@/lib/supabase';

type EntryScreenProps = {
  onJoinRoom: (roomId: string, playerId: string, nickname: string) => void;
};

function generatePlayerId() {
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function EntryScreen({ onJoinRoom }: EntryScreenProps) {
  const [nickname, setNickname] = useState('');
  const [screen, setScreen] = useState<'home' | 'create' | 'join'>('home');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Create form
  const [mode, setMode] = useState<'2v2' | '1v1' | 'pintintin' | '4individual'>('2v2');
  const [targetPoints, setTargetPoints] = useState(100);
  const [withCarga, setWithCarga] = useState(true);
  const [isPublic, setIsPublic] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [spectatorsAllowed, setSpectatorsAllowed] = useState(true);
  const [roomName, setRoomName] = useState('');

  // Join form
  const [joinCode, setJoinCode] = useState('');

  const playerId = generatePlayerId();

  const handleEnter = () => {
    if (!nickname.trim()) {
      setError('Escribe tu nombre');
      return;
    }
    setError('');
    setScreen('home');
  };

  const handleCreate = async () => {
    if (!nickname.trim()) {
      setError('Escribe tu nombre primero');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await apiCall({
        action: 'create_room',
        playerId,
        nickname: nickname.trim(),
        mode,
        targetPoints,
        withCarga: mode === '1v1' ? withCarga : false,
        isPublic,
        voiceEnabled,
        spectatorsAllowed,
        name: roomName.trim(),
      });
      onJoinRoom(data.room.id, playerId, nickname.trim());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!nickname.trim()) {
      setError('Escribe tu nombre primero');
      return;
    }
    if (!joinCode.trim()) {
      setError('Escribe el código de la mesa');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await apiCall({
        action: 'join_room',
        playerId,
        nickname: nickname.trim(),
        code: joinCode.trim().toUpperCase(),
      });
      onJoinRoom(data.room.id, playerId, nickname.trim());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 via-emerald-900 to-slate-900 text-white flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Swords className="w-10 h-10 text-amber-400" strokeWidth={2.5} />
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight">
            Dominó <span className="text-amber-400">FighteRD</span>
          </h1>
        </div>
        <p className="text-emerald-300/80 text-sm sm:text-base">Dominó dominicano competitivo</p>
      </div>

      {/* Nickname entry */}
      {!nickname.trim() || screen === 'home' ? (
        <div className="w-full max-w-md space-y-4">
          <div>
            <label className="text-emerald-200 text-sm font-medium mb-2 block">¿Cómo quieres aparecer?</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleEnter()}
              maxLength={16}
              placeholder="Tu apodo"
              className="w-full bg-emerald-950/50 border border-emerald-700 rounded-xl px-4 py-3 text-white placeholder:text-emerald-600 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
            />
          </div>

          {!nickname.trim() ? (
            <button
              onClick={handleEnter}
              className="w-full bg-amber-500 hover:bg-amber-400 text-emerald-950 font-bold py-3 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <LogIn className="w-5 h-5" /> ENTRAR
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setScreen('create'); setError(''); }}
                className="bg-amber-500 hover:bg-amber-400 text-emerald-950 font-bold py-4 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex flex-col items-center gap-2"
              >
                <Plus className="w-6 h-6" /> Crear Mesa
              </button>
              <button
                onClick={() => { setScreen('join'); setError(''); }}
                className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-4 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex flex-col items-center gap-2"
              >
                <Search className="w-6 h-6" /> Unirse
              </button>
            </div>
          )}

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        </div>
      ) : screen === 'create' ? (
        <div className="w-full max-w-md space-y-5 bg-emerald-950/60 rounded-2xl p-5 border border-emerald-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Crear Mesa</h2>
            <button onClick={() => setScreen('home')} className="text-emerald-400 hover:text-emerald-300 text-sm">Volver</button>
          </div>

          {/* Mode */}
          <div>
            <label className="text-emerald-200 text-sm font-medium mb-2 block">Modalidad</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: '2v2', label: '2 vs 2', desc: 'Parejas' },
                { v: '1v1', label: '1 vs 1', desc: 'Individual' },
                { v: 'pintintin', label: 'Pintintin', desc: '3 jugadores' },
                { v: '4individual', label: '4 Individual', desc: 'Todos solos' },
              ].map((m) => (
                <button
                  key={m.v}
                  onClick={() => setMode(m.v as any)}
                  className={`p-3 rounded-lg text-sm font-semibold transition-all ${
                    mode === m.v
                      ? 'bg-amber-500 text-emerald-950'
                      : 'bg-emerald-800/50 text-emerald-200 hover:bg-emerald-700/50'
                  }`}
                >
                  <div>{m.label}</div>
                  <div className="text-xs opacity-70">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Target */}
          <div>
            <label className="text-emerald-200 text-sm font-medium mb-2 block">Objetivo</label>
            <div className="grid grid-cols-2 gap-2">
              {[100, 200].map((p) => (
                <button
                  key={p}
                  onClick={() => setTargetPoints(p)}
                  className={`p-2 rounded-lg font-semibold transition-all ${
                    targetPoints === p ? 'bg-amber-500 text-emerald-950' : 'bg-emerald-800/50 text-emerald-200 hover:bg-emerald-700/50'
                  }`}
                >
                  {p} puntos
                </button>
              ))}
            </div>
          </div>

          {/* Carga (1v1 only) */}
          {mode === '1v1' && (
            <div>
              <label className="text-emerald-200 text-sm font-medium mb-2 block">Carga</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setWithCarga(true)}
                  className={`p-2 rounded-lg font-semibold transition-all ${withCarga ? 'bg-amber-500 text-emerald-950' : 'bg-emerald-800/50 text-emerald-200'}`}
                >
                  Con Carga
                </button>
                <button
                  onClick={() => setWithCarga(false)}
                  className={`p-2 rounded-lg font-semibold transition-all ${!withCarga ? 'bg-amber-500 text-emerald-950' : 'bg-emerald-800/50 text-emerald-200'}`}
                >
                  Sin Carga
                </button>
              </div>
            </div>
          )}

          {/* Toggles */}
          <div className="space-y-2">
            <ToggleRow icon={isPublic ? <Users className="w-4 h-4" /> : <Eye className="w-4 h-4" />} label="Mesa Pública" value={isPublic} onChange={setIsPublic} />
            <ToggleRow icon={voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />} label="Voz" value={voiceEnabled} onChange={setVoiceEnabled} />
            <ToggleRow icon={<Eye className="w-4 h-4" />} label="Espectadores" value={spectatorsAllowed} onChange={setSpectatorsAllowed} />
          </div>

          {/* Room name */}
          <input
            type="text"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            maxLength={30}
            placeholder="Nombre de mesa (opcional)"
            className="w-full bg-emerald-950/50 border border-emerald-700 rounded-lg px-3 py-2 text-white placeholder:text-emerald-600 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
          />

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-400 text-emerald-950 font-bold py-3 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? 'Creando...' : <><Plus className="w-5 h-5" /> Crear Mesa</>}
          </button>
        </div>
      ) : (
        <div className="w-full max-w-md space-y-5 bg-emerald-950/60 rounded-2xl p-5 border border-emerald-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Unirse a Mesa</h2>
            <button onClick={() => setScreen('home')} className="text-emerald-400 hover:text-emerald-300 text-sm">Volver</button>
          </div>
          <div>
            <label className="text-emerald-200 text-sm font-medium mb-2 block">Código de la mesa</label>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              maxLength={5}
              placeholder="ABCDE"
              className="w-full bg-emerald-950/50 border border-emerald-700 rounded-xl px-4 py-3 text-white placeholder:text-emerald-600 text-2xl text-center font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button
            onClick={handleJoin}
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? 'Buscando...' : <><ArrowRight className="w-5 h-5" /> Unirse</>}
          </button>
        </div>
      )}

      <p className="text-emerald-700 text-xs mt-8 text-center max-w-sm">
        Juego temporal — no requiere cuenta. Tu nombre es para esta sesión.
      </p>
    </div>
  );
}

function ToggleRow({ icon, label, value, onChange }: { icon: React.ReactNode; label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="w-full flex items-center justify-between bg-emerald-900/40 rounded-lg px-3 py-2 hover:bg-emerald-800/40 transition-all"
    >
      <div className="flex items-center gap-2 text-emerald-200 text-sm">
        {icon} {label}
      </div>
      <div className={`w-10 h-5 rounded-full transition-all relative ${value ? 'bg-amber-500' : 'bg-emerald-800'}`}>
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${value ? 'left-5' : 'left-0.5'}`} />
      </div>
    </button>
  );
}
