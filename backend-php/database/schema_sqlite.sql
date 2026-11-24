-- VocalRemover.group Multi-Provider Engine Schema
-- Database Engine: SQLite 3 / Cloudflare D1

CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    priority INTEGER NOT NULL DEFAULT 10,
    has_credentials INTEGER NOT NULL DEFAULT 0,
    daily_quota_limit INTEGER NULL,
    monthly_quota_limit INTEGER NULL,
    remaining_credits INTEGER NULL,
    is_confirmed_quota INTEGER NOT NULL DEFAULT 0,
    endpoint_url TEXT NULL,
    timeout_seconds INTEGER NOT NULL DEFAULT 120,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audio_jobs (
    id TEXT PRIMARY KEY,
    session_id TEXT NULL,
    provider_id TEXT NOT NULL,
    input_filename TEXT NOT NULL,
    format TEXT NOT NULL DEFAULT 'mp3',
    file_bytes INTEGER NOT NULL DEFAULT 0,
    duration_seconds REAL NOT NULL DEFAULT 0.0,
    state TEXT NOT NULL DEFAULT 'queued',
    percent INTEGER NOT NULL DEFAULT 0,
    vocals_stem_key TEXT NULL,
    instrumental_stem_key TEXT NULL,
    provider_job_id TEXT NULL,
    failover_count INTEGER NOT NULL DEFAULT 0,
    error_code TEXT NULL,
    error_message TEXT NULL,
    expires_at INTEGER NULL,
    created_at INTEGER NOT NULL,
    completed_at INTEGER NULL
);

CREATE INDEX IF NOT EXISTS idx_jobs_provider ON audio_jobs(provider_id);
CREATE INDEX IF NOT EXISTS idx_jobs_state ON audio_jobs(state);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON audio_jobs(created_at);

CREATE TABLE IF NOT EXISTS usage_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id TEXT NOT NULL,
    job_id TEXT NULL,
    date_utc TEXT NOT NULL,
    month_utc TEXT NOT NULL,
    duration_seconds REAL NOT NULL DEFAULT 0.0,
    success INTEGER NOT NULL DEFAULT 1,
    is_confirmed INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_provider_date ON usage_ledger(provider_id, date_utc);
CREATE INDEX IF NOT EXISTS idx_usage_provider_month ON usage_ledger(provider_id, month_utc);

CREATE TABLE IF NOT EXISTS provider_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id TEXT NOT NULL,
    job_id TEXT NULL,
    level TEXT NOT NULL DEFAULT 'INFO',
    message TEXT NOT NULL,
    http_status INTEGER NULL,
    latency_ms INTEGER NULL,
    context_json TEXT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_logs_provider ON provider_logs(provider_id);
CREATE INDEX IF NOT EXISTS idx_logs_created ON provider_logs(created_at);
