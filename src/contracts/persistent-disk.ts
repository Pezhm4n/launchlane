import type { Action, Scope } from "./domain.ts";
import { exactKeys, hash, integer, object, string } from "./validation.ts";
import { providerObjectId } from "./provision.ts";
import { ensure } from "../server/errors.ts";

export type DiskInventory = Readonly<{
	disks: readonly Readonly<{ id: string; name: string; sizeGB: number }>[];
	mounts: readonly Readonly<{ name: string; mountTo: string }>[];
}>;
export function diskName(value: unknown): string {
	const name = string(value, 63);
	ensure(
		/^[a-z][a-z0-9-]{2,62}$/.test(name),
		"DISK_SCOPE_INVALID",
		"نام دیسک معتبر نیست.",
		409,
	);
	return name;
}
export function parseDiskInventory(value: unknown): DiskInventory {
	const row = object(value);
	ensure(
		Array.isArray(row.disks) &&
			row.disks.length <= 100 &&
			Array.isArray(row.mounts) &&
			row.mounts.length <= 100,
		"DISK_RESPONSE_INVALID",
		"فهرست کامل دیسک‌ها و اتصال‌ها قابل تأیید نیست.",
		502,
	);
	const disks = row.disks.map((value) => {
		const disk = object(value);
		return {
			id: providerObjectId(disk._id),
			name: diskName(disk.name),
			sizeGB: integer(disk.size, 1, 100000),
		};
	});
	const mounts = row.mounts.map((value) => {
		const mount = object(value),
			mountTo = string(mount.mountedTo, 240);
		ensure(
			/^\/[A-Za-z0-9_/-]+$/.test(mountTo) &&
				!mountTo.split("/").some((part) => part === ".."),
			"DISK_RESPONSE_INVALID",
			"مسیر اتصال دیسک معتبر نیست.",
			502,
		);
		return { name: diskName(mount.name), mountTo };
	});
	ensure(
		new Set(disks.map((row) => row.id)).size === disks.length &&
			new Set(disks.map((row) => row.name)).size === disks.length &&
			new Set(mounts.map((row) => row.mountTo)).size === mounts.length &&
			mounts.every((mount) => disks.some((disk) => disk.name === mount.name)),
		"DISK_RESPONSE_INVALID",
		"هویت یا اتصال دیسک تکراری یا نامعتبر است.",
		502,
	);
	return {
		disks: disks.sort((a, b) => a.name.localeCompare(b.name, "en")),
		mounts: mounts.sort((a, b) => a.mountTo.localeCompare(b.mountTo, "en")),
	};
}
export type DiskSpec = Readonly<{
	version: 25;
	operation: "create_disk";
	scope: Scope;
	accountId: string;
	targetAppId: string;
	projectFlowId: string;
	sourceHash: string;
	artifactHash: string;
	selectionHash: string;
	requestKey: string;
	agentRunId: string | null;
	args: { port: null; planId: string };
	bundleId: string;
	disk: { name: string; sizeGB: number; mountTo: "/data" };
	expected: {
		inventoryHash: string;
		reservedGB: 0;
		capacityGB: number;
		maxDisks: number;
	};
	cost: {
		effect: "existing_plan_unchanged";
		incrementalHourlyHundredthsToman: 0;
		catalogFingerprint: string;
		observedAt: number;
		expiresAt: number;
	};
}>;
export function parseDiskSpec(value: unknown): DiskSpec {
	const row = object(value),
		scope = object(row.scope),
		args = object(row.args),
		disk = object(row.disk),
		expected = object(row.expected),
		cost = object(row.cost);
	exactKeys(row, [
		"version",
		"operation",
		"scope",
		"accountId",
		"targetAppId",
		"projectFlowId",
		"sourceHash",
		"artifactHash",
		"selectionHash",
		"requestKey",
		"agentRunId",
		"args",
		"bundleId",
		"disk",
		"expected",
		"cost",
	]);
	exactKeys(scope, ["teamId", "app"]);
	exactKeys(args, ["port", "planId"]);
	exactKeys(disk, ["name", "sizeGB", "mountTo"]);
	exactKeys(expected, [
		"inventoryHash",
		"reservedGB",
		"capacityGB",
		"maxDisks",
	]);
	exactKeys(cost, [
		"effect",
		"incrementalHourlyHundredthsToman",
		"catalogFingerprint",
		"observedAt",
		"expiresAt",
	]);
	const uuid = (value: unknown) => {
			const id = string(value, 36);
			ensure(
				/^[a-f0-9-]{36}$/.test(id),
				"DISK_SCOPE_INVALID",
				"شناسه اقدام دیسک معتبر نیست.",
				409,
			);
			return id;
		},
		app = string(scope.app, 63);
	const capacityGB = integer(expected.capacityGB, 1, 100000),
		sizeGB = integer(disk.sizeGB, 1, 1),
		observedAt = integer(cost.observedAt, 0, Number.MAX_SAFE_INTEGER),
		expiresAt = integer(cost.expiresAt, 0, Number.MAX_SAFE_INTEGER);
	ensure(
		row.version === 25 &&
			row.operation === "create_disk" &&
			/^[a-z0-9][a-z0-9-]{0,62}$/.test(app) &&
			args.port === null &&
			disk.mountTo === "/data" &&
			expected.reservedGB === 0 &&
			sizeGB <= capacityGB &&
			cost.effect === "existing_plan_unchanged" &&
			cost.incrementalHourlyHundredthsToman === 0 &&
			expiresAt > observedAt &&
			expiresAt - observedAt <= 600000,
		"DISK_SCOPE_INVALID",
		"این قرارداد فقط یک دیسک یک‌گیگابایتی در ظرفیت موجود مقصد خالی می‌سازد؛ تغییر پلن یا دیسک موجود مجاز نیست.",
		409,
	);
	return {
		version: 25,
		operation: "create_disk",
		scope: { teamId: providerObjectId(scope.teamId), app },
		accountId: providerObjectId(row.accountId),
		targetAppId: providerObjectId(row.targetAppId),
		projectFlowId: uuid(row.projectFlowId),
		sourceHash: hash(row.sourceHash),
		artifactHash: hash(row.artifactHash),
		selectionHash: hash(row.selectionHash),
		requestKey: uuid(row.requestKey),
		agentRunId: row.agentRunId === null ? null : uuid(row.agentRunId),
		args: { port: null, planId: string(args.planId, 100) },
		bundleId: string(row.bundleId, 100),
		disk: { name: diskName(disk.name), sizeGB, mountTo: "/data" },
		expected: {
			inventoryHash: hash(expected.inventoryHash),
			reservedGB: 0,
			capacityGB,
			maxDisks: integer(expected.maxDisks, 1, 100),
		},
		cost: {
			effect: "existing_plan_unchanged",
			incrementalHourlyHundredthsToman: 0,
			catalogFingerprint: hash(cost.catalogFingerprint),
			observedAt,
			expiresAt,
		},
	};
}
export type DiskReadback = Readonly<{
	accountId: string;
	scope: Scope;
	appId: string;
	name: string;
	id: string;
	sizeGB: number;
	observedAt: number;
}>;
export type DiskProgress = Readonly<{
	stage: "claimed" | "request_started" | "accepted";
	checkedAt: number | null;
	outcome: "verified" | "inconclusive" | "not_started" | null;
	diskId: string | null;
}>;
export function parseDiskProgress(value: unknown): DiskProgress {
	const row = object(value);
	exactKeys(row, ["stage", "checkedAt", "outcome", "diskId"]);
	ensure(
		["claimed", "request_started", "accepted"].includes(
			string(row.stage, 24),
		) &&
			(row.outcome === null ||
				row.outcome === "verified" ||
				row.outcome === "inconclusive" ||
				row.outcome === "not_started"),
		"DISK_RECEIPT_INVALID",
		"رسید دیسک معتبر نیست.",
		503,
	);
	const diskId = row.diskId === null ? null : providerObjectId(row.diskId);
	ensure(
		(row.outcome !== "verified" || (diskId !== null && row.checkedAt !== null && row.stage !== "claimed")) &&
		(row.outcome !== "not_started" || row.stage === "claimed") &&
		(row.outcome === null ? row.checkedAt === null && diskId === null : row.checkedAt !== null) &&
		(diskId === null || row.outcome === "verified"),
		"DISK_RECEIPT_INVALID",
		"تأیید دیسک بدون هویت و بازخوانی معتبر نیست.",
		503,
	);
	return {
		stage: row.stage as DiskProgress["stage"],
		checkedAt:
			row.checkedAt === null
				? null
				: integer(row.checkedAt, 1, Number.MAX_SAFE_INTEGER),
		outcome: row.outcome,
		diskId,
	};
}
export type DiskBinding = Readonly<{
	actionId: string;
	diskId: string;
	name: string;
	sizeGB: number;
	mountTo: "/data";
}>;
export function canReadDiskResult(action: Action): boolean {
	return action.spec.version === 25 && !!action.disk && !!action.attemptId && ["observing", "uncertain"].includes(action.state);
}
export function parseDiskBinding(value: unknown): DiskBinding {
	const row = object(value);
	exactKeys(row, ["actionId", "diskId", "name", "sizeGB", "mountTo"]);
	const actionId = string(row.actionId, 36);
	ensure(
		/^[a-f0-9-]{36}$/.test(actionId) && row.mountTo === "/data",
		"DISK_SCOPE_INVALID",
		"مرجع دیسک معتبر نیست.",
		409,
	);
	return {
		actionId,
		diskId: providerObjectId(row.diskId),
		name: diskName(row.name),
		sizeGB: integer(row.sizeGB, 1, 1),
		mountTo: "/data",
	};
}
