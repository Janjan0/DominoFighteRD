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

function App() {
  const [screen, setScreen] = useState<Screen>('entry');
  const [session, setSession] = useState<Session | null>(null);

  const handleJoinRoom = (roomId: string, playerId: string, nickname: string) => {
    setSession({ roomId, playerId, nickname });
    setScreen('lobby');
  };

  const handleGameStart = () => {
    setScreen('game');
  };

  const handleLeave = () => {
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
