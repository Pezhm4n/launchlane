const assert = require("node:assert/strict");
for (const name of ["AUTH_DB_URL", "PROFILE_DB_URL"]) {
  assert.ok(process.env[name]); assert.match(new URL(process.env[name]).username, /^launchlane_app_[01]$/);
}
for (const name of ["JWT_SECRET", "DB_MIGRATIONS_ENABLED", "ALLOW_INSECURE_TLS"]) assert.equal(process.env[name], undefined);
