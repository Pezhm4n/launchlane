import { endpoint, jsonBody, reply } from "../../../../server/http.ts";
import {
	exactKeys,
	hash,
	object,
	string,
} from "../../../../contracts/validation.ts";
import { ensure } from "../../../../server/errors.ts";
import {
	executeDisk,
	observeDisk,
	proposeDisk,
} from "../../../../server/application/disks.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
	return endpoint(request, false, ({ store, session }) => {
		const params = new URL(request.url).searchParams;
		ensure(
			[...params.keys()].every((key) => key === "project"),
			"INVALID_INPUT",
			"نشانی معتبر نیست.",
		);
		const projectId = string(params.get("project"), 36),
			flow = store.getProjectFlow(session.actorId);
		ensure(
			flow?.id === projectId,
			"PROJECT_CHANGED",
			"ابتدا همان پروژه را باز کنید.",
			409,
		);
		store.listActions(session.actorId);
		const row = store.db
			.prepare(
				"SELECT id FROM actions WHERE actor_id=? AND json_extract(spec,'$.version')=25 AND json_extract(spec,'$.projectFlowId')=? ORDER BY rowid DESC LIMIT 1",
			)
			.get(session.actorId, projectId);
		return reply({
			action: row ? store.getAction(string(row.id, 36), session.actorId) : null,
			app:
				store.getConnection(session.actorId, "liara")?.view.selectedApp ?? null,
		});
	});
}
export async function POST(request: Request) {
	return endpoint(request, true, async ({ config, store, session }) => {
		const input = object(await jsonBody(request));
		if (input.operation === "propose") {
			exactKeys(input, ["operation", "projectId", "requestKey"]);
			return reply({
				action: await proposeDisk(
					config,
					store,
					session,
					string(input.projectId, 36),
					string(input.requestKey, 36),
					request.signal,
				),
			});
		}
		ensure(
			input.operation === "decision" ||
				input.operation === "execute" ||
				input.operation === "observe",
			"INVALID_OPERATION",
			"عملیات دیسک معتبر نیست.",
		);
		exactKeys(input, [
			"operation",
			"actionId",
			...(input.operation === "decision" ? ["hash", "decision"] : []),
		]);
		const id = string(input.actionId, 36),
			action = store.getAction(id, session.actorId);
		ensure(
			action.spec.version === 25,
			"INVALID_OPERATION",
			"این اقدام مربوط به دیسک نیست.",
		);
		if (input.operation === "decision") {
			ensure(
				input.decision === "approve" || input.decision === "reject",
				"INVALID_INPUT",
				"تصمیم معتبر نیست.",
			);
			return reply({
				action: store.decide(
					id,
					session.actorId,
					session.id,
					hash(input.hash),
					input.decision,
				),
			});
		}
		return reply({
			action: await (input.operation === "execute" ? executeDisk : observeDisk)(
				config,
				store,
				session,
				id,
				request.signal,
			),
		});
	});
}
