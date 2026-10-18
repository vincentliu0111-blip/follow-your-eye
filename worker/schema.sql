CREATE TABLE IF NOT EXISTS test_sessions (
  session_id TEXT PRIMARY KEY,
  registered_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS choices (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  round_id TEXT NOT NULL,
  dataset_version TEXT NOT NULL,
  pair_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  a_artwork_id TEXT NOT NULL,
  b_artwork_id TEXT NOT NULL,
  choice TEXT NOT NULL CHECK (choice IN ('A', 'B')),
  layout TEXT NOT NULL CHECK (layout IN ('side-by-side', 'stacked')),
  shown_at TEXT NOT NULL,
  chosen_at TEXT NOT NULL,
  elapsed_ms INTEGER NOT NULL,
  received_at TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('production', 'test')),
  payload_json TEXT NOT NULL,
  UNIQUE (session_id, round_id, pair_id),
  UNIQUE (session_id, round_id, position)
);

CREATE INDEX IF NOT EXISTS choices_export_order
  ON choices (environment, dataset_version, received_at, id);

-- New installations also need the public v7 experience table.
CREATE TABLE IF NOT EXISTS experience_choices (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  round_id TEXT NOT NULL,
  dataset_version TEXT NOT NULL,
  pair_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 10),
  left_artwork_id TEXT NOT NULL,
  right_artwork_id TEXT NOT NULL,
  choice TEXT NOT NULL CHECK (choice IN ('A','B','skip')),
  layout TEXT NOT NULL CHECK (layout IN ('side-by-side','stacked')),
  source TEXT NOT NULL,
  mood TEXT NOT NULL,
  interests_json TEXT NOT NULL,
  language TEXT NOT NULL,
  shown_at TEXT NOT NULL,
  chosen_at TEXT NOT NULL,
  elapsed_ms INTEGER NOT NULL,
  received_at TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('production','test')),
  payload_json TEXT NOT NULL,
  country_code TEXT CHECK (country_code IS NULL OR country_code GLOB '[A-Z][A-Z]'),
  client_ip TEXT CHECK (client_ip IS NULL OR length(client_ip) BETWEEN 3 AND 45),
  city_name TEXT CHECK (city_name IS NULL OR length(city_name) BETWEEN 1 AND 128),
  region_name TEXT CHECK (region_name IS NULL OR length(region_name) BETWEEN 1 AND 128),
  postal_code TEXT CHECK (postal_code IS NULL OR length(postal_code) BETWEEN 1 AND 128),
  latitude REAL CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  longitude REAL CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  UNIQUE (session_id,round_id,pair_id),
  UNIQUE (session_id,round_id,position)
);
CREATE INDEX IF NOT EXISTS experience_community
  ON experience_choices (environment,dataset_version,pair_id,choice);
CREATE INDEX IF NOT EXISTS experience_export
  ON experience_choices (environment,dataset_version,received_at,id);
CREATE INDEX IF NOT EXISTS experience_country
  ON experience_choices (environment,dataset_version,country_code,session_id);
