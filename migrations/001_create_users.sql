-- migrations/001_create_users.sql
CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  firstName      TEXT NOT NULL,
  lastName       TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  phone          TEXT,
  aiPurpose      TEXT,
  dob            TEXT,
  favoriteColor  TEXT,
  favoriteAnimal TEXT,
  stylePrefs     TEXT,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

