import { randomBytes } from "node:crypto";
import type { Action, ActionSpec, Session } from "../../contracts/domain.ts";
import type { ProjectFlow } from "../../contracts/project-flow.ts";
import {
	parseDiskBinding,
	parseDiskSpec,
	type DiskBinding,
	type DiskSpec,
} from "../../contracts/persistent-disk.ts";
import type { Config } from "../config.ts";
import type { Store } from "../persistence/store.ts";
import { connectedLiaraConfig } from "../connections/liara.ts";
import { ensure } from "../errors.ts";
import { fingerprint } from "../policy/action.ts";
import { RunBudget } from "../policy/budget.ts";
import { LiaraDiskClient } from "../liara/disks.ts";
import { fullstackVerification } from "./fullstack-verification.ts";
import { restoreProjectFlow } from "./project-flows.ts";
import { string } from "../../contracts/validation.ts";

type Dependencies = { client?: LiaraDiskClient; budget?: RunBudget; agentRunId?: string };
function context(config: Config, store: Store, actor: string, spec?: DiskSpec) {
	const flow = store.getProjectFlow(actor),
		connection = store.getConnection(actor, "liara")?.view,
		target = connection?.apps.find(
			(row) => row.name === connection.selectedApp,
		);
	ensure(
		flow?.artifact &&
			flow.status === "ready" &&
			flow.profile.fullstack?.workerSqlite &&
			connection?.status === "connected" &&
			target,
		"DISK_PROJECT_REQUIRED",
		"پروژه Worker و مقصد همین حساب لازم است.",
		409,
	);
	if (spec) store.assertProjectAction(actor, spec);
	return {
		flow,
		connection,
		target,
		config: connectedLiaraConfig(config, store, actor, target.name),
	};
}
function assertNewManagedTarget(
	store: Store,
	actor: string,
	flow: ProjectFlow,
	targetId: string,
) {
	const rows = store.db
		.prepare(
			"SELECT id FROM actions WHERE actor_id=? AND state='succeeded' AND remote_id=? AND json_extract(spec,'$.version')=8 AND json_extract(spec,'$.projectFlowId')=? ORDER BY rowid DESC LIMIT 4",
		)
		.all(actor, targetId, flow.id);
	ensure(
		rows.some((row) => {
			const action = store.getAction(string(row.id, 36), actor),
				spec = action.spec;
			return (
				spec.version === 8 &&
				spec.sourceHash === flow.profile.sourceHash &&
				spec.artifactHash === flow.artifact?.archiveHash &&
				action.provision?.appId === targetId &&
				action.provision.observation?.outcome === "verified" &&
				action.createdAt >= Date.now() - 86400000
			);
		}),
		"DISK_NEW_DESTINATION_REQUIRED",
		"این برش فقط مقصد تازه و تأییدشده‌ای را می‌پذیرد که همین محصول برای همین artifact ساخته است.",
		409,
	);
}
export async function proposeDisk(
	config: Config,
	store: Store,
	session: Pick<Session, "actorId">,
	flowId: string,
	requestKey: string,
	signal: AbortSignal,
	deps: Dependencies = {},
): Promise<Action> {
	ensure(
		config.enableMutations && config.enableLiveLiara,
		"MUTATIONS_DISABLED",
		"ساخت دیسک در این نصب خاموش است.",
		403,
	);
	const c = context(config, store, session.actorId);
	ensure(
		c.flow.id === flowId && /^[a-f0-9-]{36}$/.test(requestKey),
		"DISK_SCOPE_INVALID",
		"پروژه یا شناسه درخواست دیسک معتبر نیست.",
		409,
	);
	const prior = store.db
		.prepare(
			"SELECT id FROM actions WHERE actor_id=? AND json_extract(spec,'$.version')=25 AND json_extract(spec,'$.requestKey')=?",
		)
		.get(session.actorId, requestKey);
	if (prior) {
		const action = store.getAction(string(prior.id, 36), session.actorId);
		ensure(
			action.spec.version === 25 &&
				action.spec.projectFlowId === flowId &&
				action.spec.targetAppId === c.target.id && action.spec.agentRunId === (deps.agentRunId ?? null),
			"IDEMPOTENCY_CONFLICT",
			"شناسه درخواست متعلق به محدوده دیگری است.",
			409,
		);
		return action;
	}
	store.assertAgentIdle(session.actorId, null, false, deps.agentRunId ?? null);
	assertNewManagedTarget(store, session.actorId, c.flow, c.target.id);
	const restored = await restoreProjectFlow(
		c.config,
		store,
		session.actorId,
		signal,
		flowId,
	);
	ensure(
		restored?.status === "ready",
		"PROJECT_CHANGED",
		"نسخه پروژه تغییر کرده است.",
		409,
	);
	await fullstackVerification(
		store,
		config.stateDir,
		session.actorId,
		restored,
		config.sessionSecret,
	);
	const budget = deps.budget ?? new RunBudget(config),
		snapshot = await (
			deps.client ?? new LiaraDiskClient(c.config, c.connection.identityId)
		).snapshot(
			{ teamId: c.config.teamId, app: c.target.name },
			c.target.id,
			budget,
			signal,
		);
	ensure(
		snapshot.reservedGB === 0 &&
			snapshot.inventory.disks.length === 0 &&
			snapshot.inventory.mounts.length === 0 &&
			snapshot.capacityGB >= 1 &&
			snapshot.maxDisks >= 1 &&
			snapshot.quote.creditCoversOneBaseHour,
		"DISK_CAPACITY_UNAVAILABLE",
		"مقصد باید خالی و دارای ظرفیت موجود باشد؛ هیچ دیسک یا پلنی خودکار تغییر نمی‌کند.",
		409,
	);
	const spec = parseDiskSpec({
		version: 25,
		operation: "create_disk",
		scope: snapshot.scope,
		accountId: c.connection.identityId,
		targetAppId: c.target.id,
		projectFlowId: flowId,
		sourceHash: c.flow.profile.sourceHash,
		artifactHash: c.flow.artifact?.archiveHash,
		selectionHash: c.flow.selectionHash,
		requestKey,
		agentRunId: deps.agentRunId ?? null,
		args: { port: null, planId: snapshot.planId },
		bundleId: snapshot.bundleId,
		disk: {
			name: `ll-data-${randomBytes(8).toString("hex")}`,
			sizeGB: 1,
			mountTo: "/data",
		},
		expected: {
			inventoryHash: snapshot.inventoryHash,
			reservedGB: 0,
			capacityGB: snapshot.capacityGB,
			maxDisks: snapshot.maxDisks,
		},
		cost: {
			effect: "existing_plan_unchanged",
			incrementalHourlyHundredthsToman: 0,
			catalogFingerprint: snapshot.quote.catalogFingerprint,
			observedAt: snapshot.quote.observedAt,
			expiresAt: snapshot.quote.expiresAt,
		},
	});
	context(config, store, session.actorId, spec);
	ensure(!signal.aborted, "CANCELLED", "پیشنهاد دیسک متوقف شد.", 409);
	return store.createAction(session.actorId, spec);
}
export async function executeDisk(
	config: Config,
	store: Store,
	session: Session,
	id: string,
	signal: AbortSignal,
	deps: Dependencies = {},
): Promise<Action> {
	const action = store.getAction(id, session.actorId);
	ensure(
		action.spec.version === 25 &&
			action.state === "approved" &&
			!action.attemptId,
		"ACTION_CONFLICT",
		"مجوز دیسک قابل مصرف نیست.",
		409,
	);
	ensure(
		config.enableMutations && config.enableLiveLiara,
		"MUTATIONS_DISABLED",
		"ساخت دیسک خاموش است.",
		403,
	);
	const spec = action.spec,
		c = context(config, store, session.actorId, spec);
	assertNewManagedTarget(store, session.actorId, c.flow, c.target.id);
	const restored = await restoreProjectFlow(
		config,
		store,
		session.actorId,
		signal,
		c.flow.id,
	);
	ensure(
		restored?.status === "ready" &&
			restored.profile.sourceHash === spec.sourceHash,
		"PROJECT_CHANGED",
		"نسخه source پیش از ساخت دیسک تغییر کرده است.",
		409,
	);
	await fullstackVerification(
		store,
		config.stateDir,
		session.actorId,
		restored,
		config.sessionSecret,
	);
	ensure(
		spec.cost.expiresAt > Date.now(),
		"CATALOG_STALE",
		"قیمت و ظرفیت باید دوباره بررسی شوند.",
		409,
	);
	const budget = deps.budget ?? new RunBudget(config),
		client = deps.client ?? new LiaraDiskClient(c.config, spec.accountId),
		snapshot = await client.snapshot(
			spec.scope,
			spec.targetAppId,
			budget,
			signal,
		);
	ensure(
		snapshot.planId === spec.args.planId &&
			snapshot.bundleId === spec.bundleId &&
			snapshot.reservedGB === 0 &&
			snapshot.capacityGB === spec.expected.capacityGB &&
			snapshot.maxDisks === spec.expected.maxDisks &&
			snapshot.inventoryHash === spec.expected.inventoryHash &&
			snapshot.inventory.disks.length === 0 &&
			snapshot.inventory.mounts.length === 0 &&
			snapshot.quote.catalogFingerprint === spec.cost.catalogFingerprint &&
			snapshot.quote.creditCoversOneBaseHour,
		"DISK_TARGET_CHANGED",
		"هویت، قیمت، ظرفیت یا دیسک‌های مقصد تغییر کرده‌اند؛ تصمیم تازه لازم است.",
		409,
	);
	ensure(
		budget.maxToolCalls - budget.toolCalls >= 1 && !signal.aborted,
		"BUDGET_EXHAUSTED",
		"بودجه ارسال دیسک کافی نیست.",
		409,
	);
	context(config, store, session.actorId, spec);
	store.claim(id, session.actorId, session.id, spec);
	try {
		store.diskStep(id, session.actorId, "request_started");
		await client.create(spec, budget, signal);
		return store.diskStep(id, session.actorId, "accepted");
	} catch {
		store.uncertain(id, session.actorId);
		return store.getAction(id, session.actorId);
	}
}
export async function observeDisk(
	config: Config,
	store: Store,
	session: Session,
	id: string,
	signal: AbortSignal,
	deps: Dependencies = {},
): Promise<Action> {
	const action = store.getAction(id, session.actorId);
	ensure(
		action.spec.version === 25 &&
			action.disk &&
			["observing", "uncertain"].includes(action.state),
		"ACTION_CONFLICT",
		"دیسک منتظر بازخوانی نیست.",
		409,
	);
	const spec = action.spec,
		c = context(config, store, session.actorId, spec);
	if (action.disk.stage === "claimed")
		return store.observeDisk(id, session.actorId, action.disk.checkedAt, null);
	const budget = deps.budget ?? new RunBudget(config);
	let proof = null;
	try {
		const inventory = await (
				deps.client ?? new LiaraDiskClient(c.config, spec.accountId)
			).inventory(spec.scope, spec.targetAppId, budget, signal),
			disk = inventory.disks.find(
				(row) => row.name === spec.disk.name && row.sizeGB === spec.disk.sizeGB,
			);
		if (disk && inventory.disks.length === 1 && inventory.mounts.length === 0)
			proof = {
				accountId: spec.accountId,
				scope: spec.scope,
				appId: spec.targetAppId,
				name: disk.name,
				id: disk.id,
				sizeGB: disk.sizeGB,
				observedAt: Date.now(),
			};
	} catch {
		/* A failed/partial read is never an empty disk inventory or permission to replay. */
	}
	return store.observeDisk(id, session.actorId, action.disk.checkedAt, proof);
}
export function currentDiskBinding(
	store: Store,
	actor: string,
	flow: ProjectFlow,
): DiskBinding | null {
	const connection = store.getConnection(actor, "liara")?.view,
		target = connection?.apps.find(
			(row) => row.name === connection.selectedApp,
		);
	if (!connection || !target) return null;
	const rows = store.db
		.prepare(
			"SELECT id FROM actions WHERE actor_id=? AND state='succeeded' AND json_extract(spec,'$.version')=25 ORDER BY rowid DESC LIMIT 128",
		)
		.all(actor);
	for (const row of rows) {
		const action = store.getAction(string(row.id, 36), actor),
			spec = action.spec;
		if (
			spec.version === 25 &&
			action.disk?.outcome === "verified" &&
			action.disk.diskId &&
			spec.projectFlowId === flow.id &&
			spec.sourceHash === flow.profile.sourceHash &&
			spec.artifactHash === flow.artifact?.archiveHash &&
			spec.selectionHash === flow.selectionHash &&
			spec.accountId === connection.identityId &&
			spec.scope.teamId === connection.teamId &&
			spec.scope.app === target.name &&
			spec.targetAppId === target.id
		)
			return parseDiskBinding({
				actionId: action.id,
				diskId: action.disk.diskId,
				...spec.disk,
			});
	}
	return null;
}
export async function checkPublicationDisk(
	config: Config,
	spec: Extract<ActionSpec, { version: 26 }>,
	budget: RunBudget,
	signal: AbortSignal,
	mounted: boolean,
	client?: LiaraDiskClient,
): Promise<void> {
	const inventory = await (
			client ?? new LiaraDiskClient(config, spec.accountId)
		).publicationInventory(spec, budget, signal),
		disk = inventory.disks[0];
	const correct =
		inventory.disks.length === 1 &&
		disk?.id === spec.storage.diskId &&
		disk.name === spec.storage.name &&
		disk.sizeGB === spec.storage.sizeGB &&
		((inventory.mounts.length === 0 && !mounted) ||
			(inventory.mounts.length === 1 &&
				inventory.mounts[0]?.name === disk.name &&
				inventory.mounts[0].mountTo === spec.storage.mountTo));
	ensure(
		correct,
		"DISK_BINDING_CHANGED",
		"دیسک یا اتصال /data با نسخه مصوب برابر نیست؛ انتشار یا سلامت تأیید نشد.",
		409,
	);
}
