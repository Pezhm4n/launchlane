import type { ActionSpec, Scope } from "../../contracts/domain.ts";
import {
	parseDiskInventory,
	type DiskInventory,
	type DiskSpec,
} from "../../contracts/persistent-disk.ts";
import { object, string, integer } from "../../contracts/validation.ts";
import { providerObjectId } from "../../contracts/provision.ts";
import type { Config } from "../config.ts";
import { AppError, ensure } from "../errors.ts";
import { authorizeScope, fingerprint } from "../policy/action.ts";
import type { RunBudget } from "../policy/budget.ts";
import {
	abortable,
	boundedJson,
	httpFailure,
	sendRead,
	transport,
	type Transport,
} from "../providers/http.ts";
import {
	LiaraAccountClient,
	parsePaaSCatalog,
	quotePaaSOffer,
} from "./catalog.ts";
import { containsCredential } from "../policy/redaction.ts";

export type DiskSnapshot = Readonly<{
	scope: Scope;
	appId: string;
	planId: string;
	bundleId: string;
	capacityGB: number;
	reservedGB: number;
	maxDisks: number;
	inventory: DiskInventory;
	inventoryHash: string;
	quote: ReturnType<typeof quotePaaSOffer>;
}>;
export class LiaraDiskClient {
	readonly config: Config;
	readonly accountId: string;
	readonly send: Transport;
	constructor(config: Config, accountId: string, send: Transport = transport) {
		this.config = config;
		this.accountId = accountId;
		this.send = send;
	}
	private async read(
		path: string,
		budget: RunBudget,
		signal: AbortSignal,
	): Promise<Record<string, unknown>> {
		ensure(
			this.config.enableLiveLiara &&
				this.config.liaraToken &&
				this.config.liaraBaseUrl === "https://api.liara.ir",
			"LIARA_UNCONFIGURED",
			"خواندن مشخصات دیسک فعال نیست.",
			403,
		);
		const bounded = budget.signal(signal),
			url = new URL(path, this.config.liaraBaseUrl);
		url.searchParams.set("teamID", this.config.teamId);
		try {
			const response = await sendRead(
				this.send,
				url.href,
				{
					method: "GET",
					redirect: "error",
					cache: "no-store",
					signal: bounded,
					headers: {
						Authorization: `Bearer ${this.config.liaraToken}`,
						Accept: "application/json",
					},
				},
				budget,
				bounded,
			);
			if (!response.ok) {
				await response.body?.cancel();
				throw httpFailure(response.status);
			}
			const result = object(await boundedJson(response, 1024 * 1024));
			ensure(!bounded.aborted, "CANCELLED", "خواندن دیسک پایان یافت.", 409);
			return result;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				"DISK_READ_UNAVAILABLE",
				"مشخصات دیسک قابل تأیید نیست؛ پاسخ خالی فرض نشد.",
				502,
			);
		}
	}
	async inventory(
		scope: Scope,
		appId: string,
		budget: RunBudget,
		signal: AbortSignal,
	): Promise<DiskInventory> {
		authorizeScope(scope, this.config);
		providerObjectId(appId);
		await new LiaraAccountClient(
			this.config,
			this.accountId,
			this.send,
		).identity(budget, signal);
		const project = object(
			(
				await this.read(
					`/v1/projects/${encodeURIComponent(scope.app)}`,
					budget,
					signal,
				)
			).project,
		);
		ensure(
			project._id === appId && project.project_id === scope.app,
			"DISK_TARGET_CHANGED",
			"هویت مقصد دیسک تغییر کرده است.",
			409,
		);
		// The live account returns 404 for a name here. The documented object-id read is required.
		const inventory = parseDiskInventory(
			await this.read(`/v1/projects/${appId}/disks`, budget, signal),
		);
		ensure(
			!containsCredential(
				JSON.stringify(inventory),
				[
					this.config.liaraToken,
					this.config.operatorToken,
					this.config.sessionSecret,
					...this.config.projectSecretValues,
				].filter(Boolean),
			),
			"SENSITIVE_RESPONSE",
			"فهرست دیسک شامل اطلاعات خصوصی است.",
			502,
		);
		return inventory;
	}
	/** Publication already fences this exact approved app through project/release reads.
	 * This is not a model-supplied database ID or a standalone inventory entry point. */
	async publicationInventory(
		spec: Extract<ActionSpec, { version: 26 }>,
		budget: RunBudget,
		signal: AbortSignal,
	): Promise<DiskInventory> {
		authorizeScope(spec.scope, this.config);
		ensure(
			spec.accountId === this.accountId,
			"DISK_TARGET_CHANGED",
			"حساب دیسک انتشار تغییر کرده است.",
			403,
		);
		providerObjectId(spec.targetAppId);
		return parseDiskInventory(
			await this.read(`/v1/projects/${spec.targetAppId}/disks`, budget, signal),
		);
	}
	async snapshot(
		scope: Scope,
		appId: string,
		budget: RunBudget,
		signal: AbortSignal,
	): Promise<DiskSnapshot> {
		authorizeScope(scope, this.config);
		providerObjectId(appId);
		const raw = await this.read("/v1/me", budget, signal),
			catalog = parsePaaSCatalog(raw, {
				accountId: this.accountId,
				teamId: scope.teamId,
			});
		const project = object(
			(
				await this.read(
					`/v1/projects/${encodeURIComponent(scope.app)}`,
					budget,
					signal,
				)
			).project,
		);
		ensure(
			project._id === appId &&
				project.project_id === scope.app &&
				project.type === "node",
			"DISK_TARGET_CHANGED",
			"این قرارداد به همان مقصد Node نیاز دارد.",
			409,
		);
		const planId = string(project.planID, 100),
			bundleId = string(project.bundlePlanID, 100),
			plan = object(object(object(raw.plans).projects)[planId]);
		const bundle = object(
			object(object(object(raw.plans).projectBundlePlans)[planId])[bundleId],
		);
		const inventory = parseDiskInventory(
			await this.read(`/v1/projects/${appId}/disks`, budget, signal),
		);
		const result = {
			scope,
			appId,
			planId,
			bundleId,
			capacityGB: integer(plan.volume, 1, 100000),
			reservedGB: integer(project.reservedDiskSpace, 0, 100000),
			maxDisks: integer(bundle.maxDiskPerProject, 1, 100),
			inventory,
			inventoryHash: fingerprint(inventory),
			quote: quotePaaSOffer(catalog, planId, bundleId),
		};
		ensure(
			!containsCredential(
				JSON.stringify(result),
				[
					this.config.liaraToken,
					this.config.modelKey,
					this.config.operatorToken,
					this.config.sessionSecret,
					...this.config.projectSecretValues,
				].filter(Boolean),
			),
			"SENSITIVE_RESPONSE",
			"مشخصات دیسک شامل اطلاعات خصوصی است.",
			502,
		);
		return result;
	}
	async create(
		spec: DiskSpec,
		budget: RunBudget,
		signal: AbortSignal,
	): Promise<void> {
		authorizeScope(spec.scope, this.config);
		ensure(
			this.config.enableMutations &&
				this.config.enableLiveLiara &&
				this.config.liaraToken &&
				this.config.liaraBaseUrl === "https://api.liara.ir",
			"MUTATIONS_DISABLED",
			"ساخت دیسک خاموش است.",
			403,
		);
		const url = new URL(
			`/v1/projects/${spec.scope.app}/disks`,
			this.config.liaraBaseUrl,
		);
		url.searchParams.set("teamID", spec.scope.teamId);
		budget.take("tool", signal);
		const bounded = budget.signal(signal);
		try {
			const response = await abortable(
				() =>
					this.send(url.href, {
						method: "POST",
						redirect: "error",
						cache: "no-store",
						signal: bounded,
						headers: {
							Authorization: `Bearer ${this.config.liaraToken}`,
							Accept: "application/json",
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							name: spec.disk.name,
							size: String(spec.disk.sizeGB),
						}),
					}),
				bounded,
			);
			if (!response.ok) {
				await response.body?.cancel();
				throw httpFailure(response.status);
			}
			await response.body?.cancel();
			ensure(
				!bounded.aborted,
				"DISK_WRITE_UNCERTAIN",
				"پاسخ ساخت دیسک قطعی نیست.",
				409,
			);
		} catch {
			throw new AppError(
				"DISK_WRITE_UNCERTAIN",
				"نتیجه ساخت دیسک باید از همان مقصد بازخوانی شود؛ درخواست دوباره ارسال نشد.",
				409,
			);
		}
	}
}
