// Append-only. Never edit an entry after it has been applied to a user's database.
export const migrations = [
  {
    version: 1,
    sql: `
CREATE TABLE sessions (
  id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, expires_at INTEGER NOT NULL
) STRICT;
CREATE TABLE login_limits (
  bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL
) STRICT;
CREATE TABLE actions (
  id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, spec TEXT NOT NULL, hash TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('awaiting_approval','approved','cancelled','expired','executing','observing','uncertain','succeeded','failed')),
  team_id TEXT NOT NULL, app TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
  approval_session_id TEXT, consumed_at INTEGER, attempt_id TEXT UNIQUE, remote_id TEXT, error_code TEXT
) STRICT;
CREATE INDEX actions_scope_state ON actions(team_id, app, state);
CREATE TABLE attempts (
  id TEXT PRIMARY KEY, action_id TEXT NOT NULL UNIQUE REFERENCES actions(id), started_at INTEGER NOT NULL,
  remote_id TEXT
) STRICT;
CREATE TABLE audit_events (
  sequence INTEGER PRIMARY KEY, action_id TEXT NOT NULL REFERENCES actions(id),
  actor_id TEXT NOT NULL, event TEXT NOT NULL, at INTEGER NOT NULL
) STRICT;
`,
  },
  {
    version: 2,
    sql: `
CREATE TABLE source_artifacts (
  actor_id TEXT NOT NULL, archive_hash TEXT NOT NULL, source_hash TEXT NOT NULL,
  bytes INTEGER NOT NULL, file_count INTEGER NOT NULL, created_at INTEGER NOT NULL,
  PRIMARY KEY(actor_id, archive_hash)
) STRICT;
`,
  },
  {
    version: 3,
    sql: `
CREATE TABLE account_connections (
  actor_id TEXT NOT NULL, provider TEXT NOT NULL CHECK(provider IN ('github','liara')),
  public_json TEXT NOT NULL, credential_ciphertext TEXT,
  credential_source TEXT NOT NULL CHECK(credential_source IN ('token','cli_private','cli_system')),
  PRIMARY KEY(actor_id, provider)
) STRICT;
`,
  },
  {
    version: 4,
    sql: `
CREATE TABLE project_flows (
  id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, selection_json TEXT NOT NULL,
  selection_hash TEXT NOT NULL, profile_json TEXT NOT NULL, artifact_json TEXT,
  status TEXT NOT NULL CHECK(status IN ('ready','incomplete','stale','unavailable')),
  message TEXT, updated_at INTEGER NOT NULL, action_id TEXT REFERENCES actions(id)
) STRICT;
CREATE TABLE operator_progress (
  actor_id TEXT PRIMARY KEY, project_flow_id TEXT REFERENCES project_flows(id)
) STRICT;
CREATE INDEX project_flows_actor ON project_flows(actor_id,updated_at);
`,
  },
  {
    version: 5,
    sql: `
CREATE TABLE incident_runs (
  id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, data_json TEXT NOT NULL, updated_at INTEGER NOT NULL
) STRICT;
CREATE INDEX incident_runs_actor ON incident_runs(actor_id,updated_at);
CREATE TABLE probe_targets (
  actor_id TEXT NOT NULL, team_id TEXT NOT NULL, app TEXT NOT NULL, origin TEXT NOT NULL,
  PRIMARY KEY(actor_id,team_id,app)
) STRICT;
`,
  },
  {
    version: 6,
    sql: `
CREATE TABLE deployment_progress (
  action_id TEXT PRIMARY KEY REFERENCES actions(id), data_json TEXT NOT NULL
) STRICT;
`,
  },
  {
    version: 7,
    sql: `
CREATE TABLE restart_progress (
  action_id TEXT PRIMARY KEY REFERENCES actions(id), data_json TEXT NOT NULL
) STRICT;
`,
  },
  {
    version: 8,
    sql: `
CREATE TABLE agent_runs (
  id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, request_key TEXT NOT NULL,
  revision INTEGER NOT NULL, state TEXT NOT NULL, updated_at INTEGER NOT NULL,
  data_json TEXT NOT NULL, UNIQUE(actor_id, request_key)
) STRICT;
CREATE INDEX agent_runs_actor ON agent_runs(actor_id, updated_at);
CREATE TABLE code_repair_jobs (
  id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, state TEXT NOT NULL,
  updated_at INTEGER NOT NULL, data_json TEXT NOT NULL
) STRICT;
`,
  },
] as const;
