import type { ProjectFlow } from "../../contracts/project-flow.ts";
import type { DisposableTestDatabase } from "../../contracts/test-database.ts";
import { databaseBindingKeys, isDatabaseResourceSpec } from "../../contracts/database-provision.ts";
import { string } from "../../contracts/validation.ts";
import type { Store } from "../persistence/store.ts";
import { ensure } from "../errors.ts";
import { assertDatabaseEnvironmentBinding } from "./database-binding.ts";
import { currentEnvironment, environmentProjectIds, projectEnvironmentValues } from "./secrets.ts";

/** A disposable URL is not a live connection. Resolve every tested purpose to its approved real resource. */
export function assertPreparedDatabaseBindings(store: Store, secret: string, actor: string, flow: ProjectFlow,
  plan: Extract<DisposableTestDatabase, { version: 4 }>): void {
  const reference = currentEnvironment(store, secret, actor, flow.id), connection = store.getConnection(actor, "liara")?.view,
    app = connection?.apps.find(row => row.name === connection.selectedApp), projects = [...environmentProjectIds(store, actor, flow.id)];
  ensure(reference && connection?.status === "connected" && app, "DATABASE_BINDING_REQUIRED", "هر اتصال آزموده‌شده باید به منبع واقعی همین مقصد وصل و بازخوانی شود.", 409);
  const values = projectEnvironmentValues(store, secret, actor, flow.id, reference);
  ensure(JSON.stringify(values.map(row => row.key).sort()) === JSON.stringify(plan.environmentKeys),
    "DATABASE_BUILD_ENV_CHANGED", "این ساخت فقط ورودی‌های خصوصی دیتابیس را آزموده است؛ ورودی دیگر به ساخت و تصمیم تازه نیاز دارد.", 409);
  const rows = store.db.prepare(`SELECT id FROM actions WHERE actor_id=? AND state='succeeded' AND json_extract(spec,'$.version') IN (27,28,29) AND json_extract(spec,'$.accountId')=? AND team_id=? AND json_extract(spec,'$.targetAppId')=? AND json_extract(spec,'$.projectFlowId') IN (${projects.map(() => "?").join(",")}) ORDER BY rowid DESC LIMIT 129`).all(actor, connection.identityId, connection.teamId, app.id, ...projects);
  ensure(rows.length <= 128, "DATABASE_BINDING_REVIEW_LIMIT", "فهرست منابع همان نسخه برای بررسی کامل بیش از حد بزرگ است.", 409);
  const resources = rows.map(row => store.getAction(string(row.id, 36), actor)), ids: string[] = [];
  for (const target of plan.targets) {
    const candidates = resources.filter(action => isDatabaseResourceSpec(action.spec) && action.spec.consumerRoot === "." && action.spec.database.type === "postgres" &&
      action.database?.observation?.outcome === "identity_verified" && action.database.databaseId && JSON.stringify(databaseBindingKeys(action.spec)) === JSON.stringify(target.environmentKeys));
    const identities = [...new Set(candidates.map(action => action.database?.databaseId))];
    ensure(identities.length === 1 && identities[0], "DATABASE_BINDING_REQUIRED", "شناسهٔ منبع واقعی هر اتصال باید از تصمیم و رسید همان پروژه مشخص باشد.", 409);
    ids.push(identities[0]);
  }
  ensure(new Set(ids).size === ids.length, "DATABASE_TARGETS_COLLAPSED", "دیتابیس‌های مستقل آزمون نباید بی‌تصمیم به یک منبع تبدیل شوند.", 409);
  // Private classification and the exact current values are proved by the linked v9 binding receipts.
  assertDatabaseEnvironmentBinding(store, secret, actor, flow, reference, plan.targets.map(target => target.environmentKeys));
}
