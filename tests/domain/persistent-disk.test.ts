import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { createAgentRun, driveAgentRun, decideAgentDisk, resumeAgentDisk, cancelAgentRun } from "../../src/server/agent/runs.ts";
import { currentAgentContext, executeAgentTool } from "../../src/server/agent/tools.ts";
import { GoalModelClient } from "../../src/server/agent/model.ts";
import { toolsForAgent, toolsForConversation } from "../../src/server/agent/tools.ts";
import { agentFixture } from "../helpers/agent-fixture.ts";
import {
	captureProject,
	type SourceFile,
} from "../../src/server/workspace/inspect.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import {
	fullstackPreparation,
	prepareFullstackFiles,
} from "../../src/server/agent/fullstack-preparation.ts";
import {
	parseProjectBuildPlan,
	node24BuildImage,
} from "../../src/contracts/project-build.ts";
import { validateBuildOutput } from "../../src/server/agent/build-output.ts";
import { persistBuildOutput } from "../../src/server/agent/build-output-store.ts";
import {
	assembleFullstackArtifact,
	compiledProof,
	compiledProofPath,
} from "../../src/server/agent/fullstack-artifact.ts";
import {
	fingerprint,
	parseActionSpec,
} from "../../src/server/policy/action.ts";
import { saveImportedEnvironment } from "../../src/server/environment/import.ts";
import { sourceBuildEnvironment } from "../../src/server/environment/build.ts";
import { LiaraAccountClient } from "../../src/server/liara/catalog.ts";
import { LiaraProvisionClient } from "../../src/server/liara/provision.ts";
import { LiaraEnvironmentClient } from "../../src/server/liara/environment.ts";
import { LiaraDiskClient } from "../../src/server/liara/disks.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";
import {
	proposeDestination,
	executeDestination,
	observeDestination,
} from "../../src/server/application/provision.ts";
import { createPublicationMission, resumePublicationMission } from "../../src/server/application/publication-mission.ts";
import { fullstackVerification } from "../../src/server/application/fullstack-verification.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { object } from "../../src/contracts/validation.ts";
import { AgentRepository } from "../../src/server/agent/store.ts";
import {
	proposeEnvironment,
	executeEnvironment,
	observeEnvironment,
} from "../../src/server/application/environment.ts";
import {
	proposeDisk,
	executeDisk,
	observeDisk,
	currentDiskBinding,
} from "../../src/server/application/disks.ts";
import {
	proposeWorkloadDeployment,
	executeDeployment,
	observeDeployment,
} from "../../src/server/application/deployment.ts";
import { LiaraReadClient } from "../../src/server/liara/client.ts";
import { LiaraDeployClient } from "../../src/server/liara/deploy.ts";
import { WorkloadProbe } from "../../src/server/liara/probe.ts";
import { decodeAction } from "../../src/contracts/client-decode.ts";
import {
	parseDiskInventory,
	parseDiskSpec,
	parseDiskProgress,
} from "../../src/contracts/persistent-disk.ts";

const team = "a".repeat(24),
	account = "b".repeat(24),
	network = "c".repeat(24),
	targetId = "d".repeat(24),
	diskId = "e".repeat(24),
	app = "controlled-worker-app",
	origin = `https://${app}.example.test`;
const signal = () => AbortSignal.timeout(10000),
	digest = (value: Uint8Array) =>
		createHash("sha256").update(value).digest("hex");
async function put(root: string, files: readonly SourceFile[]) {
	for (const file of files) {
		await mkdir(join(root, file.path, ".."), { recursive: true });
		await writeFile(join(root, file.path), file.content);
	}
}
async function fixture() {
	const f = await agentFixture();
	try {
		const config = {
			...f.config,
			teamId: team,
			apps: [app],
			enableLiveLiara: true,
			enableMutations: true,
			probeOrigins: { [app]: origin },
			liaraToken: "synthetic-disk-provider",
		};
		const workerFiles = [
			[
				"package.json",
				JSON.stringify({
					name: "worker-fixture",
					type: "module",
					scripts: { build: "vite build" },
					dependencies: { hono: "4", react: "18", vite: "5" },
				}),
			],
			[
				"package-lock.json",
				JSON.stringify({ lockfileVersion: 3, packages: {} }),
			],
			[
				"wrangler.jsonc",
				JSON.stringify({
					main: "worker/index.ts",
					assets: {
						directory: "dist",
						binding: "ASSETS",
						not_found_handling: "single-page-application",
					},
					d1_databases: [{ binding: "DB", migrations_dir: "migrations" }],
				}),
			],
			[
				"worker/index.ts",
				"import {Hono} from 'hono';const app=new Hono();app.get('/api/health',c=>c.json({ok:!!c.env.SESSION_SECRET}));app.all('*',c=>c.env.ASSETS.fetch(c.req.raw));export default app;",
			],
			["migrations/0001_init.sql", "CREATE TABLE events(id TEXT PRIMARY KEY);"],
			["index.html", "<!doctype html><html>Controlled Worker</html>"],
		].map(([path, content]) => {
			assert.ok(path && content);
			return { path, content: Buffer.from(content) };
		});
		await put(f.project, workerFiles);
		const sourceFlow = await prepareProjectFlow(
				config,
				f.store,
				f.session.actorId,
				{ kind: "local", directory: "service" },
				signal(),
			),
			source = await captureProject(f.project, ".");
		const variables = [
			{ key: "SESSION_SECRET", value: "synthetic-worker-private-value" },
		];
		saveImportedEnvironment(
			config,
			f.store,
			f.session.actorId,
			sourceFlow,
			variables,
		);
		const preparation = fullstackPreparation(source.files, source.profile),
			sourceEnvironment = sourceBuildEnvironment(
				config,
				f.store,
				f.session.actorId,
				sourceFlow.id,
			);
		assert.ok(sourceEnvironment);
		const build = parseProjectBuildPlan({
			version: 7,
			nodeVersion: "24",
			image: node24BuildImage,
			fullstack: preparation,
			buildCommand: preparation.buildCommand,
			startCommand: preparation.startCommand,
			testCommand: null,
			port: 3000,
			workload: {
				path: "/",
				status: 200,
				assertion: { kind: "text", contains: "Controlled Worker" },
			},
			apiChecks: [
				{
					path: "/api/health",
					status: 200,
					assertions: [{ pointer: ["ok"], equals: true }],
				},
			],
			environment: null,
			sourceEnvironment,
		});
		assert.equal(build.version, 7);
		if (build.version !== 7) throw Error("invalid fixture");
		const jobId = randomUUID(),
			root = join(config.stateDir, "repair-workspaces", jobId);
		await put(
			root,
			prepareFullstackFiles(source.files, source.profile, preparation),
		);
		const tested = await captureProject(root, "."),
			contents = new Map([
				[
					"index.html",
					Buffer.from(
						'<!doctype html><html>Controlled Worker<script src="/app.js"></script></html>',
					),
				],
				["app.js", Buffer.from("console.log('controlled browser bundle')")],
				[
					"launchlane-private/worker.cjs",
					Buffer.from("// compiler transport fixture, never executed"),
				],
			]);
		const output = validateBuildOutput(
			{
				version: 1,
				files: [...contents].map(([path, content]) => ({
					path,
					type: "file",
					bytes: content.length,
					sha256: digest(content),
				})),
			},
			contents,
		);
		const outputReceipt = await persistBuildOutput(config.stateDir, output, {
			sourceHash: tested.profile.sourceHash,
			planHash: fingerprint(build),
		});
		const assembled = await assembleFullstackArtifact({
			stateDir: config.stateDir,
			store: f.store,
			actorId: f.session.actorId,
			workspace: root,
			sourceHash: tested.profile.sourceHash,
			plan: build,
			receipt: outputReceipt,
			signal: signal(),
			secrets: [],
		});
		f.store.db.prepare("INSERT INTO code_repair_jobs VALUES (?,?,?,?,?)").run(
			jobId,
			f.session.actorId,
			"succeeded",
			Date.now(),
			JSON.stringify({
				job: {
					id: jobId,
					projectId: sourceFlow.id,
					baseRevision: source.profile.sourceHash,
					state: "succeeded",
					goal: "Synthetic compiler transport for storage policy tests; not real application acceptance",
					allowedPaths: [],
					testFiles: [],
					changedPaths: assembled.changedPaths,
					diff: null,
					beforeTest: null,
					afterTest: {
						command: "synthetic compiler transport",
						exitCode: 0,
						signal: null,
						output: "synthetic",
						durationMs: 1,
						passed: true,
						buildOutput: outputReceipt,
					},
					artifact: assembled.artifact,
					publication: assembled.publication,
					execution: "container",
					containerIds: ["1".repeat(64)],
					containerImage: node24BuildImage,
					build,
					errorCode: null,
					message: "synthetic",
					createdAt: Date.now(),
					updatedAt: Date.now(),
				},
			}),
		);
		const flow = await prepareProjectFlow(
			config,
			f.store,
			f.session.actorId,
			{
				kind: "repair",
				directory: ".",
				jobId,
				artifactHash: assembled.artifact.archiveHash,
			},
			signal(),
		);
		f.store.saveConnection(f.session.actorId, {
			source: "token",
			ciphertext: sealCredential(
				config.liaraToken,
				config.sessionSecret,
				f.session.actorId,
				"liara",
			),
			view: {
				provider: "liara",
				status: "connected",
				identityId: account,
				displayName: "Fixture",
				login: "fixture@example.test",
				teamId: team,
				teamName: "Fixture",
				selectedApp: null,
				apps: [],
				checkedAt: Date.now(),
			},
		});
		let exists = false,
			diskWrites = 0,
			lost = false,
			unavailable = false,
			capacity = 5,
			price = 10,
			wrongId = false;
		let disks: { _id: string; name: string; size: number }[] = [],
			mounts: { name: string; mountedTo: string }[] = [],
			envs: { key: string; value: string }[] = [];
		const me = () => ({
			user: { _id: account },
			team: { _id: team, balance: 10000 },
			plans: {
				projects: {
					starter: { available: true, region: "iran", price, volume: capacity },
				},
				projectBundlePlans: {
					starter: {
						basic: { available: true, price: 1, maxDiskPerProject: 2 },
					},
				},
			},
		});
		const project = () => ({
			_id: wrongId ? "f".repeat(24) : targetId,
			project_id: app,
			type: "node",
			status: "Running",
			planID: "starter",
			bundlePlanID: "basic",
			network: { _id: network },
			readOnlyRootFilesystem: true,
			reservedDiskSpace: disks.reduce((sum, disk) => sum + disk.size, 0),
			envs: envs.map((row) => ({ ...row, encrypted: false })),
		});
		const read: import("../../src/server/providers/http.ts").Transport = async (
			url,
			init,
		) => {
			assert.equal(init.method, "GET");
			assert.equal(new URL(url).searchParams.get("teamID"), team);
			const path = new URL(url).pathname;
			if (unavailable && path.endsWith("/disks"))
				return new Response(null, { status: 503 });
			if (path === "/v1/me") return Response.json(me());
			if (path === "/v1/networks")
				return Response.json({ networks: [{ _id: network, name: "fixture" }] });
			if (path.endsWith("/releases"))
				return Response.json({
					total: 1,
					currentRelease: "fixture-release",
					releases: [{ _id: "fixture-release", state: "READY", port: 3000 }],
				});
			if (path === `/v1/projects/${targetId}/disks`)
				return Response.json({ disks, mounts });
			assert.equal(path, `/v1/projects/${app}`);
			return exists
				? Response.json({ project: project() })
				: new Response(null, { status: 404 });
		};
		const accountClient = new LiaraAccountClient(config, account, read),
			provisionClient = new LiaraProvisionClient(config, async () => {
				exists = true;
				return Response.json({ projectID: targetId });
			});
		const destination = await proposeDestination(
			config,
			f.store,
			f.session.actorId,
			{
				flowId: flow.id,
				app,
				planId: "starter",
				bundleId: "basic",
				networkId: network,
			},
			signal(),
			{ read: accountClient, write: provisionClient },
		);
		f.store.decide(
			destination.id,
			f.session.actorId,
			f.session.id,
			destination.hash,
			"approve",
		);
		await executeDestination(
			config,
			f.store,
			f.session,
			destination.id,
			signal(),
			{ read: accountClient, write: provisionClient },
		);
		assert.equal(
			(
				await observeDestination(
					config,
					f.store,
					f.session,
					destination.id,
					signal(),
					{ read: accountClient },
				)
			).state,
			"succeeded",
		);
		const environmentClient = new LiaraEnvironmentClient(
			config,
			async (url, init) => {
				if (init.method === "POST") {
					envs = variables.map((row) => ({ ...row }));
					return new Response("");
				}
				return read(url, init);
			},
		);
		const repo = new AgentRepository(f.store),
			mission = (
				await createPublicationMission(
					config,
					f.store,
					f.session,
					randomUUID(),
					{
						projectId: flow.id,
						sourceHash: flow.profile.sourceHash,
						path: "/",
						expectedText: "Controlled Worker",
					},
					signal(),
				)
			).run;
		mission.state = "needs_input";
		mission.nextAction = "configure_env";
		repo.save(f.session.actorId, mission);
		const environment = await proposeEnvironment(
			config,
			f.store,
			f.session,
			mission.id,
			randomUUID(),
			variables,
			signal(),
			{ client: environmentClient },
		);
		f.store.decide(
			environment.id,
			f.session.actorId,
			f.session.id,
			environment.hash,
			"approve",
		);
		await executeEnvironment(
			config,
			f.store,
			f.session,
			environment.id,
			signal(),
			{ client: environmentClient },
		);
		assert.equal(
			(
				await observeEnvironment(
					config,
					f.store,
					f.session,
					environment.id,
					signal(),
					{ client: environmentClient },
				)
			).state,
			"succeeded",
		);
		const diskClient = new LiaraDiskClient(
			config,
			account,
			async (url, init) => {
				if (init.method !== "POST") return read(url, init);
				diskWrites++;
				assert.equal(new URL(url).pathname, `/v1/projects/${app}/disks`);
				const body = JSON.parse(String(init.body));
				assert.equal(body.size, "1");
				const current = f.store.getAction(
					f.store.getProjectFlow(f.session.actorId)?.actionId ?? "",
					f.session.actorId,
				);
				assert.equal(current.disk?.stage, "request_started");
				assert.ok(current.attemptId);
				disks = [{ _id: diskId, name: body.name, size: 1 }];
				if (lost) throw new TypeError("lost response must stay uncertain");
				return new Response(null, { status: 201 });
			},
		);
		return {
			...f,
			config,
			flow,
			build,
			contents,
			environmentClient,
			diskClient,
			readClient: new LiaraReadClient(config, read),
			get diskWrites() {
				return diskWrites;
			},
			set(options: {
				lost?: boolean;
				unavailable?: boolean;
				capacity?: number;
				price?: number;
				wrongId?: boolean;
				mounts?: typeof mounts;
			}) {
				lost = options.lost ?? lost;
				unavailable = options.unavailable ?? unavailable;
				capacity = options.capacity ?? capacity;
				price = options.price ?? price;
				wrongId = options.wrongId ?? wrongId;
				mounts = options.mounts ?? mounts;
			},
		};
	} catch (error) {
		f.close();
		throw error;
	}
}

test("a disk is exact-source scoped, decision-bound, single use and verified by the documented object-id inventory", async () => {
	const f = await fixture();
	try {
		const key = randomUUID(),
			action = await proposeDisk(
				f.config,
				f.store,
				f.session,
				f.flow.id,
				key,
				signal(),
				{ client: f.diskClient },
			);
		assert.equal(f.diskWrites, 0);
		assert.equal(action.spec.version, 25);
		assert.deepEqual(parseActionSpec(action.spec), action.spec);
		assert.deepEqual(decodeAction(action).spec, action.spec);
		assert.equal(
			(
				await proposeDisk(
					f.config,
					f.store,
					f.session,
					f.flow.id,
					key,
					signal(),
					{ client: f.diskClient },
				)
			).id,
			action.id,
		);
		await assert.rejects(
			executeDisk(f.config, f.store, f.session, action.id, signal(), {
				client: f.diskClient,
			}),
			{ code: "ACTION_CONFLICT" },
		);
		f.store.decide(
			action.id,
			f.session.actorId,
			f.session.id,
			action.hash,
			"approve",
		);
		assert.equal(
			(
				await executeDisk(f.config, f.store, f.session, action.id, signal(), {
					client: f.diskClient,
				})
			).state,
			"observing",
		);
		const verified = await observeDisk(
			f.config,
			f.store,
			f.session,
			action.id,
			signal(),
			{ client: f.diskClient },
		);
		assert.equal(verified.state, "succeeded");
		assert.equal(verified.disk?.diskId, diskId);
		assert.equal(
			currentDiskBinding(f.store, f.session.actorId, f.flow)?.diskId,
			diskId,
		);
		assert.equal(f.diskWrites, 1);
		await assert.rejects(
			executeDisk(f.config, f.store, f.session, action.id, signal(), {
				client: f.diskClient,
			}),
			{ code: "ACTION_CONFLICT" },
		);
		assert.equal(f.diskWrites, 1);
	} finally {
		f.close();
	}
});

test("a lost create response is reconciled without replay; unavailable inventory remains uncertain", async () => {
	const f = await fixture();
	try {
		const action = await proposeDisk(
			f.config,
			f.store,
			f.session,
			f.flow.id,
			randomUUID(),
			signal(),
			{ client: f.diskClient },
		);
		f.store.decide(
			action.id,
			f.session.actorId,
			f.session.id,
			action.hash,
			"approve",
		);
		f.set({ lost: true });
		assert.equal(
			(
				await executeDisk(f.config, f.store, f.session, action.id, signal(), {
					client: f.diskClient,
				})
			).state,
			"uncertain",
		);
		f.set({ unavailable: true });
		assert.equal(
			(
				await observeDisk(f.config, f.store, f.session, action.id, signal(), {
					client: f.diskClient,
				})
			).state,
			"uncertain",
		);
		assert.equal(f.diskWrites, 1);
		assert.throws(() => f.store.assertAgentIdle(f.session.actorId), {
			code: "UNRESOLVED_EFFECT",
		});
		f.set({ unavailable: false });
		assert.equal(
			(
				await observeDisk(f.config, f.store, f.session, action.id, signal(), {
					client: f.diskClient,
				})
			).state,
			"succeeded",
		);
		assert.equal(f.diskWrites, 1);
	} finally {
		f.close();
	}
});

test("price, target and capacity drift fail before consuming a decision or sending a disk request", async () => {
	for (const change of [{ price: 11 }, { capacity: 6 }, { wrongId: true }]) {
		const f = await fixture();
		try {
			const action = await proposeDisk(
				f.config,
				f.store,
				f.session,
				f.flow.id,
				randomUUID(),
				signal(),
				{ client: f.diskClient },
			);
			f.store.decide(
				action.id,
				f.session.actorId,
				f.session.id,
				action.hash,
				"approve",
			);
			f.set(change);
			await assert.rejects(
				executeDisk(f.config, f.store, f.session, action.id, signal(), {
					client: f.diskClient,
				}),
			);
			assert.equal(f.diskWrites, 0);
			assert.equal(
				f.store.getAction(action.id, f.session.actorId).attemptId,
				null,
			);
		} finally {
			f.close();
		}
	}
});

test("an approved Worker release binds the existing disk mount and still rejects green HTML with the wrong storage", async () => {
	const f = await fixture();
	try {
		await assert.rejects(
			proposeWorkloadDeployment(
				f.config,
				f.store,
				f.session.actorId,
				{
					flowId: f.flow.id,
					app,
					port: null,
					workload: { origin, ...f.build.workload },
				},
				signal(),
				{ read: f.readClient, environment: f.environmentClient },
			),
			{ code: "WORKER_STORAGE_BINDING_REQUIRED" },
		);
		const disk = await proposeDisk(
			f.config,
			f.store,
			f.session,
			f.flow.id,
			randomUUID(),
			signal(),
			{ client: f.diskClient },
		);
		f.store.decide(
			disk.id,
			f.session.actorId,
			f.session.id,
			disk.hash,
			"approve",
		);
		await executeDisk(f.config, f.store, f.session, disk.id, signal(), {
			client: f.diskClient,
		});
		await observeDisk(f.config, f.store, f.session, disk.id, signal(), {
			client: f.diskClient,
		});
		const publication = await proposeWorkloadDeployment(
			f.config,
			f.store,
			f.session.actorId,
			{
				flowId: f.flow.id,
				app,
				port: null,
				workload: { origin, ...f.build.workload },
			},
			signal(),
			{
				read: f.readClient,
				environment: f.environmentClient,
				disk: f.diskClient,
			},
		);
		assert.ok(publication.spec.version === 26);
		assert.deepEqual(decodeAction(publication).spec, publication.spec);
		assert.deepEqual(parseActionSpec(publication.spec), publication.spec);
		const spec = publication.spec;
		let sends = 0;
		const writer = new LiaraDeployClient(f.config, async (url, init) => {
			sends++;
			if (new URL(url).pathname.endsWith("/sources"))
				return Response.json({ sourceID: "fixture-source" });
			assert.deepEqual(JSON.parse(String(init.body)), {
				sourceID: "fixture-source",
				port: 3000,
				type: "node",
				platformConfig: { version: "24" },
				disks: [{ name: spec.storage.name, mountTo: "/data" }],
			});
			f.set({ mounts: [{ name: spec.storage.name, mountedTo: "/wrong" }] });
			return Response.json({ releaseID: "fixture-release" });
		});
		f.store.decide(
			publication.id,
			f.session.actorId,
			f.session.id,
			publication.hash,
			"approve",
		);
		await executeDeployment(
			f.config,
			f.store,
			f.session,
			publication.id,
			signal(),
			{
				read: f.readClient,
				write: writer,
				environment: f.environmentClient,
				disk: f.diskClient,
			},
		);
		assert.equal(sends, 2);
		const probe = new WorkloadProbe(
			f.config,
			async () => [{ address: "93.184.216.34", family: 4 }],
			async (url) => {
				const body =
					url.pathname === compiledProofPath
						? compiledProof(spec.verification)
						: url.pathname === "/api/health"
							? JSON.stringify({ ok: true })
							: (f.contents
									.get(url.pathname === "/app.js" ? "app.js" : "index.html")
									?.toString() ?? "");
				return {
					status: 200,
					body,
					bytes: Buffer.byteLength(body),
					durationMs: 1,
					contentType:
						url.pathname === "/app.js" ? "application/javascript" : "text/html",
				};
			},
		);
		const wrong = await observeDeployment(
			f.config,
			f.store,
			f.session,
			publication.id,
			signal(),
			{
				read: f.readClient,
				environment: f.environmentClient,
				disk: f.diskClient,
				probe,
			},
		);
		assert.equal(wrong.state, "observing");
		assert.equal(wrong.deployment?.observation?.outcome, "inconclusive");
		assert.equal(wrong.deployment?.observation?.code, "DISK_BINDING_CHANGED");
		assert.equal(sends, 2);
		f.set({ mounts: [{ name: spec.storage.name, mountedTo: "/data" }] });
		assert.equal(
			(
				await observeDeployment(
					f.config,
					f.store,
					f.session,
					publication.id,
					signal(),
					{
						read: f.readClient,
						environment: f.environmentClient,
						disk: f.diskClient,
						probe,
					},
				)
			).state,
			"succeeded",
		);
		assert.equal(sends, 2);
	} finally {
		f.close();
	}
});

test("disk contract rejects duplicate identities, hidden mounts, resizing, remounts and fabricated free capacity", () => {
	assert.deepEqual(parseDiskInventory({ disks: [], mounts: [] }), {
		disks: [],
		mounts: [],
	});
	for (const value of [
		{ disks: [], mounts: [{ name: "unknown", mountedTo: "/data" }] },
		{
			disks: [
				{ _id: diskId, name: "fixture-disk", size: 1 },
				{ _id: diskId, name: "other-disk", size: 1 },
			],
			mounts: [],
		},
		{ disks: [], mounts: null },
	])
		assert.throws(() => parseDiskInventory(value));
	assert.throws(() => parseDiskSpec({ version: 25, operation: "create_disk" }));
	for (const progress of [
		{ stage: "claimed", outcome: "verified", checkedAt: Date.now(), diskId },
		{ stage: "accepted", outcome: "not_started", checkedAt: Date.now(), diskId: null },
		{ stage: "accepted", outcome: null, checkedAt: Date.now(), diskId: null },
	]) assert.throws(() => parseDiskProgress(progress));
});

test("disk decisions deny rejection, a different session, expired cost and material argument changes", async () => {
  const f = await fixture();
  try {
    const action = await proposeDisk(f.config, f.store, f.session, f.flow.id, randomUUID(), signal(), { client: f.diskClient });
    assert.equal(action.spec.version, 25);if (action.spec.version !== 25) throw Error("fixture contract");
    const spec = action.spec;
    for (const change of [
      { disk: { ...spec.disk, sizeGB: 2 } }, { disk: { ...spec.disk, mountTo: "/elsewhere" } },
      { expected: { ...spec.expected, reservedGB: 1 } }, { cost: { ...spec.cost, incrementalHourlyHundredthsToman: 1 } },
      { cost: { ...spec.cost, expiresAt: spec.cost.observedAt + 600001 } }, { approved: true },
    ]) assert.throws(() => parseActionSpec({ ...spec, ...change }));
    assert.throws(() => f.store.getAction(action.id, "another-actor"), { code: "NOT_FOUND" });
    f.store.decide(action.id, f.session.actorId, f.session.id, action.hash, "reject");
    await assert.rejects(executeDisk(f.config, f.store, f.session, action.id, signal(), { client: f.diskClient }), { code: "ACTION_CONFLICT" });
    const pending = await proposeDisk(f.config, f.store, f.session, f.flow.id, randomUUID(), signal(), { client: f.diskClient });
    f.store.decide(pending.id, f.session.actorId, f.session.id, pending.hash, "approve");
    const other = { ...f.session, id: "other-session" };f.store.saveSession(other);
    await assert.rejects(executeDisk(f.config, f.store, other, pending.id, signal(), { client: f.diskClient }), { code: "APPROVAL_SESSION" });
    assert.equal(f.store.getAction(pending.id, f.session.actorId).attemptId, null);
    f.store.db.prepare("UPDATE actions SET expires_at=? WHERE id=?").run(Date.now() - 1, pending.id);
    await assert.rejects(executeDisk(f.config, f.store, f.session, pending.id, signal(), { client: f.diskClient }));
    const stale = f.store.createAction(f.session.actorId, { ...spec, requestKey: randomUUID(), cost: { ...spec.cost, observedAt: Date.now() - 600000, expiresAt: Date.now() - 1 } });
    assert.throws(() => f.store.decide(stale.id, f.session.actorId, f.session.id, stale.hash, "approve"), { code: "CATALOG_STALE" });
    assert.equal(f.diskWrites, 0);
  } finally { f.close(); }
});

test("interrupted disk ownership is durable and only a journal with no send can resolve as not started", async () => {
  const f = await fixture();
  try {
    const action = await proposeDisk(f.config, f.store, f.session, f.flow.id, randomUUID(), signal(), { client: f.diskClient });
    f.store.decide(action.id, f.session.actorId, f.session.id, action.hash, "approve");
    const claimed = f.store.claim(action.id, f.session.actorId, f.session.id, action.spec);
    assert.equal(claimed.disk?.stage, "claimed");
    assert.throws(() => f.store.claim(action.id, f.session.actorId, f.session.id, action.spec), { code: "ACTION_CONFLICT" });
    assert.throws(() => f.store.finishObservation(action.id, f.session.actorId, "healthy"), { code: "DISK_OBSERVATION_REQUIRED" });
    f.store.recoverInterrupted();
    assert.equal(f.store.getAction(action.id, f.session.actorId).attemptId, claimed.attemptId);
    const checked = await observeDisk(f.config, f.store, f.session, action.id, signal(), { client: f.diskClient });
    assert.equal(checked.state, "failed");assert.equal(checked.disk?.outcome, "not_started");assert.equal(f.diskWrites, 0);
  } finally { f.close(); }
});

test("the product Agent proposes storage, waits for its exact decision, reads it back and continues the original publication", async () => {
  const f = await fixture();
  try {
    let requests = 0;
    const model = new GoalModelClient(f.config, async () => {
      const name = requests++ === 0 ? "propose_disk" : "propose_publication";
      return Response.json({ choices: [{ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [{ id: randomUUID(), type: "function", function: {
        name, arguments: JSON.stringify(name === "propose_disk" ? {} : f.build.workload),
      } }] } }], usage: { total_tokens: 10 } });
    });
    const dependencies = { model, disk: { client: f.diskClient }, pollDelayMs: 1,
      tool: (name: string, args: unknown, context: Parameters<typeof executeAgentTool>[2]) => executeAgentTool(name, args, { ...context, read: f.readClient, disk: f.diskClient, environment: f.environmentClient }) };
    const created = createAgentRun(f.config, f.store, f.session, randomUUID(), "همین نسخه را با داده پایدار منتشر کن", f.flow.id).run;
    const repo = new AgentRepository(f.store);
    await driveAgentRun(f.config, f.store, f.session, created.id, dependencies);
    const pending = repo.get(f.session.actorId, created.id);assert.ok(pending?.disk);
    assert.equal(pending.state, "needs_approval");assert.equal(pending.disk.spec.version, 25);assert.equal(f.diskWrites, 0);
    await assert.rejects(decideAgentDisk(f.config, f.store, f.session, pending.id, pending.revision + 1, pending.disk.id, "approve"), { code: "AGENT_CONFLICT" });
    await decideAgentDisk(f.config, f.store, f.session, pending.id, pending.revision, pending.disk.id, "approve");
    await driveAgentRun(f.config, f.store, f.session, created.id, dependencies);
    const continued = repo.get(f.session.actorId, created.id);assert.ok(continued);
    assert.equal(continued.disk?.state, "succeeded");assert.equal(continued.diskContinued, true);assert.equal(continued.effect, "disk_created");
    assert.equal(continued.publication?.spec.version, 26, JSON.stringify({ state: continued.state, code: continued.errorCode, events: continued.events.slice(-5), usage: continued.usage }));assert.equal(continued.state, "needs_approval");assert.equal(continued.publication?.attemptId, null);
    assert.equal(continued.usage.modelCalls, 2);assert.equal(f.diskWrites, 1);assert.equal(requests, 2);
    assert.throws(() => resumeAgentDisk(f.store, f.session, continued.id, continued.revision), { code: "AGENT_CONFLICT" });
    assert.equal(toolsForAgent(f.config, "build", true, true, true).some(tool => tool.function.name === "propose_disk"), true);
    assert.equal(toolsForAgent(f.config, "build", true, true).some(tool => tool.function.name === "propose_disk"), false);
    assert.equal(toolsForConversation(f.config).some(tool => tool.function.name === "propose_disk"), false);
  } finally { f.close(); }
});

test("cancelling or recovering a queued Agent disk decision revokes the unused action without sending or renewing its budget", async () => {
  for (const mode of ["cancel", "recover"] as const) {
    const f = await fixture();try {
      const model = new GoalModelClient(f.config, async () => Response.json({ choices: [{ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [{ id: randomUUID(), type: "function", function: { name: "propose_disk", arguments: "{}" } }] } }], usage: { total_tokens: 10 } }));
      const dependencies = { model, disk: { client: f.diskClient }, tool: (name: string, args: unknown, context: Parameters<typeof executeAgentTool>[2]) => executeAgentTool(name, args, { ...context, read: f.readClient, disk: f.diskClient, environment: f.environmentClient }) };
      const created = createAgentRun(f.config, f.store, f.session, randomUUID(), "فضای پایدار همین نسخه را آماده کن", f.flow.id).run;
      await driveAgentRun(f.config, f.store, f.session, created.id, dependencies);
      const repo = new AgentRepository(f.store), pending = repo.get(f.session.actorId, created.id);assert.ok(pending?.disk);
      const queued = await decideAgentDisk(f.config, f.store, f.session, pending.id, pending.revision, pending.disk.id, "approve");
      const usage = { ...queued.usage };
      if (mode === "cancel") cancelAgentRun(f.store, f.session.actorId, queued.id, queued.revision);else repo.recover();
      const stopped = repo.get(f.session.actorId, queued.id);assert.ok(stopped?.disk);
      assert.equal(stopped.disk.state, "cancelled");assert.equal(stopped.disk.attemptId, null);assert.deepEqual(stopped.usage, usage);
      await assert.rejects(executeDisk(f.config, f.store, f.session, stopped.disk.id, signal(), { client: f.diskClient }), { code: "ACTION_CONFLICT" });
      assert.equal(f.diskWrites, 0);
    } finally { f.close(); }
  }
});

test("a publication mission cannot resume past an uncertain disk send or spend a fresh allowance", async () => {
  const f = await fixture();try {
    const run = (await createPublicationMission(f.config, f.store, f.session, randomUUID(), { projectId: f.flow.id,
      sourceHash: f.flow.profile.sourceHash, path: "/", expectedText: "full service" }, signal())).run;
    const repo = new AgentRepository(f.store);run.state = "working";repo.save(f.session.actorId, run);
    run.disk = await proposeDisk(f.config, f.store, f.session, f.flow.id, randomUUID(), signal(), { client: f.diskClient, agentRunId: run.id });
    run.state = "needs_approval";repo.save(f.session.actorId, run);
    const queued = await decideAgentDisk(f.config, f.store, f.session, run.id, run.revision, run.disk.id, "approve");
    f.store.claim(run.disk.id, f.session.actorId, f.session.id, run.disk.spec);
    f.store.diskStep(run.disk.id, f.session.actorId, "request_started");f.store.uncertain(run.disk.id, f.session.actorId);
    queued.disk = f.store.getAction(run.disk.id, f.session.actorId);queued.state = "partially_completed";
    queued.effect = "remote_changes_unverified";queued.usage.modelCalls = 3;queued.usage.toolCalls = 7;repo.save(f.session.actorId, queued);
    await assert.rejects(resumePublicationMission(f.config, f.store, f.session, run.id, queued.revision, randomUUID(), signal()), { code: "MISSION_RECONCILIATION_REQUIRED" });
    const unchanged = repo.get(f.session.actorId, run.id);assert.ok(unchanged);
    assert.equal(unchanged.revision, queued.revision);assert.deepEqual(unchanged.usage, queued.usage);assert.deepEqual(unchanged.limits, queued.limits);
    assert.equal(unchanged.disk?.state, "uncertain");assert.equal(f.store.db.prepare("SELECT COUNT(*) AS count FROM attempts WHERE action_id=?").get(run.disk.id)?.count, 1);
    assert.equal(f.diskWrites, 0);
  } finally { f.close(); }
});

test("inspection rechecks the selected compiled build receipt without treating it as cloud environment, publication or persistence evidence", async () => {
  const f = await fixture();try {
    f.store.db.prepare("UPDATE actions SET state='failed' WHERE json_extract(spec,'$.version')=9").run();
    const inspect = () => executeAgentTool("inspect_project", {}, { config: f.config, store: f.store, actorId: f.session.actorId,
      context: currentAgentContext(f.config, f.store, f.session.actorId), createdAt: Date.now(), budget: new RunBudget(f.config), signal: signal() });
    const result = await inspect(), proof = object(object(result).selectedArtifactVerification);
    assert.equal(proof.state, "verified");assert.deepEqual(proof.originalWorkload, f.build.workload);
    assert.equal(proof.cloudPublication, "unverified");assert.equal(proof.storagePersistence, "unverified");
    await assert.rejects(fullstackVerification(f.store, f.config.stateDir, f.session.actorId, f.flow, f.config.sessionSecret), { code: "FULLSTACK_BUILD_REQUIRED" });
    assert.equal(f.flow.selection.kind, "repair");if (f.flow.selection.kind !== "repair") throw Error("fixture selection");
    f.store.db.prepare("UPDATE code_repair_jobs SET data_json=json_set(data_json,'$.job.publication.outputArtifactHash',?) WHERE id=?").run("f".repeat(64), f.flow.selection.jobId);
    const tampered = await inspect();assert.equal(object(object(tampered).selectedArtifactVerification).state, "unconfirmed");assert.equal(f.diskWrites, 0);
  } finally { f.close(); }
});
