-- Migration: Create authentication tables for multi-user support
-- Description: Stores encrypted Tembo API keys per Discord user with audit logging

-- Table: user_api_keys
-- Stores encrypted API keys for each Discord user
CREATE TABLE user_api_keys (
  discord_user_id TEXT PRIMARY KEY NOT NULL,
  encrypted_api_key TEXT NOT NULL,
  encryption_iv TEXT NOT NULL,
  encryption_salt TEXT NOT NULL,
  registration_timestamp INTEGER NOT NULL,
  last_used_timestamp INTEGER NOT NULL,
  last_validated_timestamp INTEGER,
  validation_status TEXT DEFAULT 'valid' CHECK(validation_status IN ('pending', 'valid', 'invalid')),
  tembo_user_id TEXT,
  tembo_org_id TEXT,
  tembo_email TEXT
);

-- Table: auth_events
-- Audit log for all authentication-related events
CREATE TABLE auth_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_user_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('register', 'update', 'unregister', 'validation_success', 'validation_failure', 'auth_failure')),
  timestamp INTEGER NOT NULL,
  metadata TEXT
);

-- Indexes for performance
CREATE INDEX idx_user_api_keys_last_used ON user_api_keys(last_used_timestamp);
CREATE INDEX idx_auth_events_user_id ON auth_events(discord_user_id);
CREATE INDEX idx_auth_events_timestamp ON auth_events(timestamp);
CREATE INDEX idx_auth_events_type ON auth_events(event_type);
