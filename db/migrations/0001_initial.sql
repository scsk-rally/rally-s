CREATE TABLE IF NOT EXISTS efukuri_content_collections (
  type text PRIMARY KEY,
  items jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS efukuri_companies (
  id uuid PRIMARY KEY,
  code_digest text NOT NULL UNIQUE,
  code_hint text NOT NULL,
  name text NOT NULL,
  pension_name text NOT NULL DEFAULT '',
  pension_url text NOT NULL DEFAULT '',
  stock_plan_name text NOT NULL DEFAULT '',
  stock_plan_url text NOT NULL DEFAULT '',
  logo_url text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  session_version text NOT NULL,
  link_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS efukuri_admin_users (
  id text PRIMARY KEY,
  password_hash text NOT NULL,
  credential_version text NOT NULL,
  is_owner boolean NOT NULL DEFAULT false,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS efukuri_audit_log (
  id bigserial PRIMARY KEY,
  actor_type text NOT NULL,
  actor_id text NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS efukuri_content_versions (
  id bigserial PRIMARY KEY,
  type text NOT NULL,
  items jsonb NOT NULL,
  actor_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS efukuri_login_attempts (
  key text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 1,
  window_started_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS efukuri_analytics_daily (
  company_id uuid NOT NULL REFERENCES efukuri_companies(id) ON DELETE CASCADE,
  event_date date NOT NULL,
  path text NOT NULL,
  page_views integer NOT NULL DEFAULT 0,
  unique_sessions integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, event_date, path)
);

CREATE TABLE IF NOT EXISTS efukuri_analytics_unique_daily (
  company_id uuid NOT NULL REFERENCES efukuri_companies(id) ON DELETE CASCADE,
  event_date date NOT NULL,
  path text NOT NULL,
  session_digest text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, event_date, path, session_digest)
);

CREATE INDEX IF NOT EXISTS efukuri_content_versions_type_created_idx
  ON efukuri_content_versions (type, created_at DESC);

CREATE INDEX IF NOT EXISTS efukuri_audit_log_created_idx
  ON efukuri_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS efukuri_analytics_daily_date_idx
  ON efukuri_analytics_daily (event_date, company_id);

CREATE INDEX IF NOT EXISTS efukuri_analytics_unique_date_idx
  ON efukuri_analytics_unique_daily (event_date, company_id);
