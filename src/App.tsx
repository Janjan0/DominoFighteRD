import { useState } from 'react';
import EntryScreen from '@/components/EntryScreen';
import Lobby from '@/components/Lobby';
import GameTable from '@/components/GameTable';

type Screen = 'entry' | 'lobby' | 'game';

type Session = {
  roomId: string;
  playerId: string;
  nickname: string;
};

const SESSION_KEY = 'dominofighter_session';

function loadSession(): Session | null {
  try {
    const saved = localStorage.getItem(SESSION_KEY);

    if (!saved) {
      return null;
    }

    const session = JSON.parse(saved) as Session;

    if (
      typeof session.roomId !== 'string' ||
      typeof session.playerId !== 'string' ||
      typeof session.nickname !== 'string'
    ) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }

    return session;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function App() {
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [screen, setScreen] = useState<Screen>(() =>
    loadSession() ? 'lobby' : 'entry'
  );

  const handleJoinRoom = (
    roomId: string,
    playerId: string,
    nickname: string
  ) => {
    const newSession: Session = {
      roomId,
      playerId,
      nickname,
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));

    setSession(newSession);
    setScreen('lobby');
  };

  const handleGameStart = () => {
    setScreen('game');
  };

  const handleLeave = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setScreen('entry');
  };

  if (screen === 'entry' || !session) {
    return <EntryScreen onJoinRoom={handleJoinRoom} />;
  }

  if (screen === 'lobby') {
    return (
      <Lobby
        roomId={session.roomId}
        playerId={session.playerId}
        onGameStart={handleGameStart}
        onLeave={handleLeave}
      />
    );
  }

  return (
    <GameTable
      roomId={session.roomId}
      playerId={session.playerId}
      onLeave={handleLeave}
    />
  );
}

export default App;
