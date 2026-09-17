/*
# Dominó FighteRD - Game Tables

1. New Tables
- `rooms` - Game rooms/tables where players join to play
  - id (uuid, primary key)
  - code (text, unique, short 5-char code for sharing)
  - name (text, optional room name)
  - mode (text: '2v2', '1v1', 'pintintin', '4individual')
  - target_points (int: 100 or 200)
  - with_carga (boolean, for 1v1)
  - is_public (boolean)
  - voice_enabled (boolean)
  - spectators_allowed (boolean)
  - creator_id (text, player session ID of creator)
  - status (text: 'waiting', 'playing', 'finished')
  - game_state (jsonb, full authoritative game state)
  - created_at (timestamptz)
  - updated_at (timestamptz)

- `players` - Players in rooms (temporary sessions, no accounts)
  - id (text, primary key - client-generated session ID)
  - room_id (uuid, references rooms)
  - nickname (text)
  - seat (int, -1 for spectators)
  - is_spectator (boolean)
  - is_creator (boolean)
  - is_connected (boolean)
  - joined_at (timestamptz)

2. Security
- Enable RLS on both tables.
- Allow anon + authenticated CRUD since this is a no-auth app with temporary sessions.
- All game state is intentionally shared within a room.
*/

CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text DEFAULT '',
  mode text NOT NULL DEFAULT '2v2',
  target_points int NOT NULL DEFAULT 100,
  with_carga boolean NOT NULL DEFAULT false,
  is_public boolean NOT NULL DEFAULT true,
  voice_enabled boolean NOT NULL DEFAULT false,
  spectators_allowed boolean NOT NULL DEFAULT true,
  creator_id text NOT NULL,
  status text NOT NULL DEFAULT 'waiting',
  game_state jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_rooms" ON rooms;
CREATE POLICY "anon_select_rooms" ON rooms FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_rooms" ON rooms;
CREATE POLICY "anon_insert_rooms" ON rooms FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_rooms" ON rooms;
CREATE POLICY "anon_update_rooms" ON rooms FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_rooms" ON rooms;
CREATE POLICY "anon_delete_rooms" ON rooms FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS players (
  id text NOT NULL,
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  seat int NOT NULL DEFAULT -1,
  is_spectator boolean NOT NULL DEFAULT false,
  is_creator boolean NOT NULL DEFAULT false,
  is_connected boolean NOT NULL DEFAULT true,
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (id, room_id)
);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_players" ON players;
CREATE POLICY "anon_select_players" ON players FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_players" ON players;
CREATE POLICY "anon_insert_players" ON players FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_players" ON players;
CREATE POLICY "anon_update_players" ON players FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_players" ON players;
CREATE POLICY "anon_delete_players" ON players FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_players_room_id ON players(room_id);
CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
