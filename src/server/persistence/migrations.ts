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
  {
    version: 9,
    sql: `
CREATE TABLE provision_progress (
  action_id TEXT PRIMARY KEY REFERENCES actions(id), data_json TEXT NOT NULL
) STRICT;
`,
  },
  {
    version: 10,
    sql: `
CREATE TABLE environment_inputs (
  id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, binding_json TEXT NOT NULL,
  ciphertext TEXT NOT NULL, expires_at INTEGER NOT NULL, action_id TEXT UNIQUE REFERENCES actions(id)
) STRICT;
CREATE TABLE environment_progress (
  action_id TEXT PRIMARY KEY REFERENCES actions(id), data_json TEXT NOT NULL
) STRICT;
`,
  },
  {
    version: 11,
    sql: `
CREATE TABLE mission_authorities (
  id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, run_id TEXT NOT NULL REFERENCES agent_runs(id),
  plan_json TEXT NOT NULL, plan_hash TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('proposed','approved','revoked')), session_id TEXT NOT NULL,
  created_at INTEGER NOT NULL, UNIQUE(actor_id,run_id)
) STRICT;
CREATE TABLE mission_steps (
  authority_id TEXT NOT NULL REFERENCES mission_authorities(id),
  kind TEXT NOT NULL CHECK(kind IN ('build','repair','publication')),
  subject_id TEXT NOT NULL, evidence_hash TEXT NOT NULL, created_at INTEGER NOT NULL,
  PRIMARY KEY(kind,subject_id)
) STRICT;
CREATE TABLE mission_artifacts (
  authority_id TEXT NOT NULL REFERENCES mission_authorities(id), source_hash TEXT NOT NULL,
  archive_hash TEXT NOT NULL, base_source_hash TEXT NOT NULL, job_id TEXT NOT NULL UNIQUE REFERENCES code_repair_jobs(id),
  evidence_hash TEXT NOT NULL, PRIMARY KEY(authority_id,source_hash,archive_hash)
) STRICT;
`,
  },
  {
    version: 12,
    sql: `
CREATE TABLE network_progress (
  action_id TEXT PRIMARY KEY REFERENCES actions(id), data_json TEXT NOT NULL
) STRICT;
`,
  },
  {
    version: 13,
    sql: `
CREATE TABLE coding_agent_executions (
  job_id TEXT PRIMARY KEY REFERENCES code_repair_jobs(id), actor_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('dispatched','returned','uncertain')), data_json TEXT NOT NULL
) STRICT;
`,
  },
  {
    version: 14,
    sql: `
CREATE TABLE mission_authority_history (
  id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, run_id TEXT NOT NULL,
  plan_json TEXT NOT NULL, plan_hash TEXT NOT NULL, state TEXT NOT NULL,
  session_id TEXT NOT NULL, created_at INTEGER NOT NULL, archived_at INTEGER NOT NULL
) STRICT;
`,
  },
  {
    version: 15,
    sql: `
ALTER TABLE mission_artifacts RENAME TO mission_artifacts_v11;
ALTER TABLE mission_steps RENAME TO mission_steps_v11;
ALTER TABLE mission_authorities RENAME TO mission_authorities_v11;
CREATE TABLE mission_authorities (
  id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, run_id TEXT NOT NULL REFERENCES agent_runs(id),
  plan_json TEXT NOT NULL, plan_hash TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('proposed','approved','revoked')), session_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
) STRICT;
INSERT INTO mission_authorities SELECT * FROM mission_authorities_v11;
CREATE INDEX mission_authorities_run ON mission_authorities(actor_id,run_id,created_at);
CREATE TABLE mission_steps (
  authority_id TEXT NOT NULL REFERENCES mission_authorities(id),
  kind TEXT NOT NULL CHECK(kind IN ('build','repair','publication')),
  subject_id TEXT NOT NULL, evidence_hash TEXT NOT NULL, created_at INTEGER NOT NULL,
  PRIMARY KEY(kind,subject_id)
) STRICT;
INSERT INTO mission_steps SELECT * FROM mission_steps_v11;
CREATE TABLE mission_artifacts (
  authority_id TEXT NOT NULL REFERENCES mission_authorities(id), source_hash TEXT NOT NULL,
  archive_hash TEXT NOT NULL, base_source_hash TEXT NOT NULL, job_id TEXT NOT NULL UNIQUE REFERENCES code_repair_jobs(id),
  evidence_hash TEXT NOT NULL, PRIMARY KEY(authority_id,source_hash,archive_hash)
) STRICT;
INSERT INTO mission_artifacts SELECT * FROM mission_artifacts_v11;
DROP TABLE mission_artifacts_v11;
DROP TABLE mission_steps_v11;
DROP TABLE mission_authorities_v11;
`,
  },
  {
    version: 16,
    sql: `
CREATE TABLE mcp_connections (
  id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, request_key TEXT NOT NULL,
  host TEXT NOT NULL CHECK(host IN ('codex','claude','opencode')), missions INTEGER NOT NULL CHECK(missions IN (0,1)),
  parent_session_id TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL,
  revoked_at INTEGER, initialized_at INTEGER, discovered_at INTEGER, last_tool_at INTEGER,
  protocol_version TEXT, reported_client TEXT, access_path TEXT NOT NULL,
  UNIQUE(actor_id,request_key)
) STRICT;
CREATE INDEX mcp_connections_actor ON mcp_connections(actor_id,created_at);
`,
  },
  {
    version: 17,
    sql: `
CREATE TABLE lifecycle_progress (action_id TEXT PRIMARY KEY REFERENCES actions(id), data_json TEXT NOT NULL) STRICT;
CREATE TABLE project_archives (
  project_id TEXT PRIMARY KEY REFERENCES project_flows(id), actor_id TEXT NOT NULL, source_hash TEXT NOT NULL,
  archived_at INTEGER NOT NULL, session_id TEXT NOT NULL
) STRICT;
`,
  },
  {
    version: 18,
    sql: `
CREATE TABLE disk_progress (action_id TEXT PRIMARY KEY REFERENCES actions(id), data_json TEXT NOT NULL) STRICT;
`,
  },
  {
    version: 19,
    sql: `
CREATE TABLE database_progress (action_id TEXT PRIMARY KEY REFERENCES actions(id), data_json TEXT NOT NULL) STRICT;
CREATE UNIQUE INDEX database_request_keys ON actions(actor_id,json_extract(spec,'$.requestKey')) WHERE json_extract(spec,'$.version')=27;
CREATE TABLE database_environment_bindings (action_id TEXT PRIMARY KEY REFERENCES actions(id), database_action_id TEXT NOT NULL REFERENCES actions(id)) STRICT;
`,
  },
  {
    version: 20,
    sql: `
CREATE UNIQUE INDEX database_bound_request_keys ON actions(actor_id,json_extract(spec,'$.requestKey')) WHERE json_extract(spec,'$.version') IN (27,28);
`,
  },
  {
    version: 21,
    sql: `
CREATE UNIQUE INDEX database_resource_request_keys ON actions(actor_id,json_extract(spec,'$.requestKey')) WHERE json_extract(spec,'$.version') IN (27,28,29);
`,
  },
] as const;
