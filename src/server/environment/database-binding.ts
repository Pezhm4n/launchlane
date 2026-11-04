import type { EnvironmentReference } from "../../contracts/environment.ts";
import type { ProjectFlow } from "../../contracts/project-flow.ts";
import { string } from "../../contracts/validation.ts";
import type { Store } from "../persistence/store.ts";
import { ensure } from "../errors.ts";
import { environmentProjectIds, openEnvironmentInput, projectEnvironmentValues } from "./secrets.ts";
import { databaseBindingKeys, isDatabaseResourceSpec } from "../../contracts/database-provision.ts";

/** Creating a resource cannot discharge its source requirement while the app still uses unrelated configuration. */
export function assertDatabaseEnvironmentBinding(store: Store, secret: string, actor: string, flow: ProjectFlow, reference: EnvironmentReference | null,
  testedPostgresKeys: readonly (readonly string[])[] = []): void {
  const projects = environmentProjectIds(store, actor, flow.id), connection = store.getConnection(actor, "liara")?.view,
    app = connection?.apps.find(row => row.name === connection.selectedApp);
  if (!connection || !app) return; // Destination authorization is enforced separately by the caller.
  const projectIds = [...projects];
  const rows = store.db.prepare(`SELECT id FROM actions WHERE actor_id=? AND state='succeeded' AND json_extract(spec,'$.version') IN (27,28,29) AND json_extract(spec,'$.accountId')=? AND team_id=? AND json_extract(spec,'$.targetAppId')=? AND json_extract(spec,'$.projectFlowId') IN (${projectIds.map(() => "?").join(",")}) ORDER BY rowid DESC LIMIT 129`).all(actor, connection.identityId, connection.teamId, app.id, ...projectIds);
  ensure(rows.length <= 128, "DATABASE_BINDING_REVIEW_LIMIT", "تعداد منابع همین تبار از سقف بررسی بیشتر است؛ وضعیت ناقص، مجوز انتشار نیست.", 409);
  const resources = rows.map(row => store.getAction(string(row.id, 36), actor));
  for (const database of resources) {
    const spec = database.spec;
    if ((spec.version !== 27 && spec.version !== 28 && spec.version !== 29) || !projects.has(spec.projectFlowId)) continue;
    const kind = spec.database.type === "postgres" ? "postgresql" : spec.database.type === "mysql" ? "mysql" : "redis";
    const tested = spec.consumerRoot === "." && spec.database.type === "postgres" && testedPostgresKeys.some(keys => JSON.stringify(keys) === JSON.stringify(databaseBindingKeys(spec)));
    if (!tested && !flow.profile.applicationRequirements?.requirements.some(need => need.need === "required" && need.consumerRoot === spec.consumerRoot && need.kind === kind)) continue;
    // A fresh credential binding may supersede the old one only for the identical verified resource and purpose.
    const aliases = resources.filter(other => isDatabaseResourceSpec(other.spec) && other.database?.databaseId && other.database.databaseId === database.database?.databaseId &&
      other.database.observation?.outcome === "identity_verified" && other.spec.consumerRoot === spec.consumerRoot && other.spec.database.type === spec.database.type &&
      JSON.stringify(databaseBindingKeys(other.spec)) === JSON.stringify(databaseBindingKeys(spec))).map(other => other.id);
    const links = aliases.flatMap(id => store.db.prepare("SELECT b.action_id FROM database_environment_bindings b JOIN actions a ON a.id=b.action_id WHERE b.database_action_id=? AND a.actor_id=? AND a.state='succeeded'").all(id, actor));
    ensure(reference && links.length > 0, "DATABASE_BINDING_REQUIRED", "اتصال همین دیتابیس به برنامه هنوز تأیید نشده است؛ انتشار ارسال نشد.", 409);
    const values = projectEnvironmentValues(store, secret, actor, flow.id, reference);
    ensure(links.some(link => {
      const binding = store.getAction(string(link.action_id, 36), actor), input = binding.spec;
      if (input.version !== 9 || !projects.has(input.projectFlowId) || input.targetAppId !== app.id || input.accountId !== connection.identityId || input.scope.teamId !== connection.teamId) return false;
      if (JSON.stringify([...input.keys].sort()) !== JSON.stringify(databaseBindingKeys(spec)) || input.keys.some(key => !input.secretKeys.includes(key))) return false;
      const expected = openEnvironmentInput(store, secret, actor, input, true);
      return input.keys.length > 0 && input.keys.every(key => expected.some(original => original.key === key && values.some(current => current.key === key && current.value === original.value)));
    }), "DATABASE_BINDING_CHANGED", "اتصال جاری برنامه با اتصال تأییدشدهٔ دیتابیس برابر نیست؛ پیشنهاد تازه لازم است.", 409);
  }
}
