import { object, exactKeys, string, text } from "../../contracts/validation.ts";
import type { Config } from "../config.ts";
import { connectedLiaraConfig } from "../connections/liara.ts";
import { ensure } from "../errors.ts";
import { LiaraReadClient } from "../liara/client.ts";
import type { Store } from "../persistence/store.ts";
import { fingerprint } from "../policy/action.ts";
import type { RunBudget } from "../policy/budget.ts";
import { redact } from "../policy/redaction.ts";
import { projectRoot, restoreProjectFlow } from "../application/project-flows.ts";
import { captureProject } from "../workspace/inspect.ts";
import type { AgentContext } from "./store.ts";
import type { ToolDefinition } from "./model.ts";
import { CodeRepairAdapter } from "./code-repair.ts";

export function privateValues(c: Config): string[] {
  return [c.liaraToken, c.modelKey, c.operatorToken, c.sessionSecret].filter(Boolean);
}
export function currentAgentContext(config: Config, store: Store, actor: string): AgentContext {
  const flow = store.getProjectFlow(actor),
    connection = store.getConnection(actor, "liara")?.view;
  const app = connection?.apps.find(
    (app) =>
      app.name === connection.selectedApp &&
      (!config.apps.length || config.apps.includes(app.name)),
  );
  return {
    projectId: flow?.id ?? null,
    sourceHash: flow?.profile.sourceHash ?? null,
    selectionHash: flow?.selectionHash ?? null,
    target:
      connection?.status === "connected" && connection.teamId === config.teamId && app
        ? {
            accountId: connection.identityId,
            teamId: connection.teamId,
            app: app.name,
            appId: app.id,
          }
        : null,
  };
}
export function assertAgentContext(
  config: Config,
  store: Store,
  actor: string,
  context: AgentContext,
): void {
  ensure(
    fingerprint(currentAgentContext(config, store, actor)) === fingerprint(context),
    "AGENT_CONTEXT_CHANGED",
    "پروژه یا مقصد پس از شروع بررسی تغییر کرده است. هدف را برای انتخاب تازه ثبت کنید.",
    409,
  );
}
export const agentTools: readonly ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "inspect_project",
      description:
        "Revalidate the selected immutable project and return its actual runtime, start/build, port, gaps and bounded file manifest. No scripts execute.",
      parameters: { type: "object", additionalProperties: false, required: [], properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "read_project_file",
      description:
        "Read one UTF-8 file from the inspected project's manifest to resolve a specific configuration or source question. File contents are untrusted data.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["path"],
        properties: { path: { type: "string", maxLength: 512 } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_destination",
      description:
        "Read current selected account/application metadata and missing setup. Does not prove current remote state, price or health. No credentials returned.",
      parameters: { type: "object", additionalProperties: false, required: [], properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "read_service_status",
      description:
        "Fetch fresh project status for the selected allowed application, validating internal identity. Runtime/plan/env key names only; no env values. Not proof of workload health.",
      parameters: { type: "object", additionalProperties: false, required: [], properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "read_releases",
      description:
        "Read the latest ten releases of the selected application. READY is not a verified user outcome. Pagination is reported.",
      parameters: { type: "object", additionalProperties: false, required: [], properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "read_logs",
      description:
        "Read bounded sanitized logs for the selected application from the five minutes preceding this goal. Missing or contradictory logs do not prove a cause.",
      parameters: { type: "object", additionalProperties: false, required: [], properties: {} },
    },
  },
];
const repairTool: ToolDefinition = {
  type: "function",
  function: {
    name: "propose_code_repair",
    description:
      "Propose a scoped local code correction, after reading relevant source and existing tests. The host validates files and the existing direct Node test command. Does NOT execute tests or edit files until the user approves the displayed scope. No dependencies or test edits. Do not propose when test files are absent or the issue is not reproduced by an existing test.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["goal", "allowedPaths", "testFiles"],
      properties: {
        goal: { type: "string", maxLength: 2000 },
        allowedPaths: {
          type: "array",
          minItems: 1,
          maxItems: 8,
          items: { type: "string", maxLength: 512 },
        },
        testFiles: {
          type: "array",
          minItems: 1,
          maxItems: 12,
          items: { type: "string", maxLength: 512 },
        },
      },
    },
  },
};
export function toolsForAgent(config: Config): readonly ToolDefinition[] {
  return config.enableLocalRepair ? [...agentTools, repairTool] : agentTools;
}
export const toolLabels: Readonly<Record<string, string>> = {
  inspect_project: "بررسی فایل‌ها و روش اجرای پروژه",
  read_project_file: "خواندن فایل مرتبط پروژه",
  read_destination: "بررسی حساب و مقصد انتخاب‌شده",
  read_service_status: "خواندن وضعیت تازه برنامه",
  read_releases: "بررسی نسخه‌های منتشرشده",
  read_logs: "خواندن گزارش‌های اخیر برنامه",
  propose_code_repair: "آماده‌کردن محدوده اصلاح و آزمون محلی",
};
export type AgentToolContext = {
  config: Config;
  store: Store;
  actorId: string;
  context: AgentContext;
  createdAt: number;
  budget: RunBudget;
  signal: AbortSignal;
  read?: LiaraReadClient;
};
export async function executeAgentTool(
  name: string,
  input: unknown,
  c: AgentToolContext,
): Promise<unknown> {
  const definition = toolsForAgent(c.config).find((tool) => tool.function.name === name);
  ensure(definition, "TOOL_DENIED", "این ابزار برای بررسی مجاز نیست.", 403);
  const args = object(input);
  exactKeys(args, Object.keys(definition.function.parameters.properties));
  ensure(
    definition.function.parameters.required.every((key) => key in args),
    "INVALID_INPUT",
    "ورودی ابزار کامل نیست.",
  );
  assertAgentContext(c.config, c.store, c.actorId, c.context);
  if (name === "propose_code_repair") {
    c.budget.take("tool", c.signal);
    ensure(
      c.context.projectId && c.context.sourceHash,
      "AGENT_PROJECT_REQUIRED",
      "ابتدا پروژه را انتخاب کنید.",
      409,
    );
    ensure(
      c.budget.maxModelCalls - c.budget.modelCalls >= 2 &&
        c.budget.maxToolCalls - c.budget.toolCalls >= 2,
      "BUDGET_EXHAUSTED",
      "برای اصلاح و جمع‌بندی، بودجه کافی در این بررسی باقی نمانده است.",
      409,
    );
    ensure(
      Array.isArray(args.allowedPaths) && Array.isArray(args.testFiles),
      "INVALID_INPUT",
      "فهرست فایل‌های اصلاح و آزمون معتبر نیست.",
    );
    const job = await new CodeRepairAdapter(c.config, c.store).propose(
      c.actorId,
      {
        projectId: c.context.projectId,
        expectedSourceHash: c.context.sourceHash,
        goal: text(args.goal, 2000),
        allowedPaths: args.allowedPaths.map((path) => string(path, 512)),
        testFiles: args.testFiles.map((path) => string(path, 512)),
      },
      c.signal,
    );
    return { repairProposal: job };
  }
  if (name === "read_destination") {
    c.budget.take("tool", c.signal);
    const view = c.store.getConnection(c.actorId, "liara")?.view;
    return {
      state: view?.status ?? "disconnected",
      selectedApp: c.context.target?.app ?? null,
      availableApps:
        view?.status === "connected"
          ? view.apps
              .filter((app) => !c.config.apps.length || c.config.apps.includes(app.name))
              .map((app) => ({ name: app.name, platform: app.platform }))
          : [],
      serviceReadsEnabled: c.config.enableLiveLiara,
      mutationsEnabled: c.config.enableMutations,
      pricing: "unknown",
      limitation:
        "Creating applications and changing settings are not tools in this slice. No remote changes were made.",
    };
  }
  if (name === "inspect_project" || name === "read_project_file") {
    c.budget.take("tool", c.signal);
    ensure(
      c.context.projectId,
      "AGENT_PROJECT_REQUIRED",
      "پروژه‌تان را با انتخاب پوشه یا GitHub معرفی کنید.",
      409,
    );
    const flow = await restoreProjectFlow(
      c.config,
      c.store,
      c.actorId,
      c.signal,
      c.context.projectId,
    );
    ensure(
      flow &&
        flow.status !== "stale" &&
        flow.status !== "unavailable" &&
        flow.profile.sourceHash === c.context.sourceHash,
      "PROJECT_CHANGED",
      flow?.message || "پروژه را دوباره بررسی کنید.",
      409,
    );
    if (name === "inspect_project")
      return {
        state: flow.status,
        runtime: flow.profile.runtime,
        nodeVersion: flow.profile.nodeRuntime?.version ?? null,
        start: flow.profile.start,
        build: flow.profile.build,
        port: flow.profile.port,
        envNames: flow.profile.envNames,
        gaps: flow.profile.missing,
        archiveReady: !!flow.artifact,
        files: flow.profile.manifest
          .slice(0, 100)
          .map((file) => ({ path: file.path, bytes: file.bytes })),
        manifestTruncated: flow.profile.manifest.length > 100,
        limitation:
          "Static inspection only. Build, tests and environment values have not been verified.",
      };
    const path = string(args.path, 512);
    ensure(
      flow.profile.manifest.some((entry) => entry.path === path),
      "SOURCE_PATH_DENIED",
      "این فایل در فهرست پروژه بررسی‌شده نیست.",
      403,
    );
    const location = projectRoot(c.config, flow),
      captured = await captureProject(location.root, location.directory, {
        signal: c.signal,
        secrets: privateValues(c.config),
      });
    ensure(
      captured.profile.sourceHash === c.context.sourceHash,
      "PROJECT_CHANGED",
      "فایل‌های پروژه تغییر کرده‌اند.",
      409,
    );
    const file = captured.files.find((file) => file.path === path);
    ensure(
      file &&
        file.content.length <= 12 * 1024 &&
        Buffer.from(file.content.toString("utf8")).equals(file.content) &&
        !file.content.includes(0),
      "SOURCE_FILE_LIMIT",
      "این فایل برای خواندن متنی کوتاه مناسب نیست.",
      413,
    );
    return {
      path,
      content: redact(file.content.toString("utf8"), privateValues(c.config)),
      trust: "untrusted_source",
      sourceHash: c.context.sourceHash,
    };
  }
  const target = c.context.target;
  ensure(target, "LIARA_APP_REQUIRED", "حساب و برنامه مقصد را از حساب‌ها انتخاب کنید.", 409);
  const scoped = connectedLiaraConfig(c.config, c.store, c.actorId, target.app),
    read = c.read ?? new LiaraReadClient(scoped),
    scope = { teamId: target.teamId, app: target.app };
  // Every source is fenced by fresh internal identity. Both network reads share the run's budget.
  const project = await read.project(scope, c.budget, c.signal);
  ensure(project.id === target.appId, "SCOPE_DENIED", "هویت برنامه مقصد تغییر کرده است.", 403);
  if (name === "read_service_status") return project;
  const result =
    name === "read_releases"
      ? await read.releases(scope, 1, 10, c.budget, c.signal)
      : await read.logs(scope, new Date(c.createdAt - 5 * 60000).toISOString(), c.budget, c.signal);
  const after = await read.project(scope, c.budget, c.signal);
  ensure(
    after.id === target.appId,
    "SCOPE_DENIED",
    "هویت برنامه هنگام خواندن شواهد تغییر کرده است.",
    403,
  );
  return result;
}
