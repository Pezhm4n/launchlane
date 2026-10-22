import { exactKeys, identifier, integer, object, text } from "../../contracts/validation.ts";
import { permittedChatModels, type Config } from "../config.ts";
import { AppError, ensure } from "../errors.ts";
import type { RunBudget } from "../policy/budget.ts";
import { redact } from "../policy/redaction.ts";
import {
  abortable,
  boundedJson,
  httpFailure,
  transport,
  type Transport,
} from "../providers/http.ts";

export type FunctionCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};
export type ModelMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: FunctionCall[] }
  | { role: "tool"; tool_call_id: string; content: string };
export type ToolDefinition = {
  type: "function";
  argumentValidation?: "application";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      additionalProperties: false;
      required: string[];
      properties: Record<string, unknown>;
    };
  };
};
export type ToolTurn = { calls: FunctionCall[]; content: string | null; usage: number | null };
export type ModelPort = {
  complete(
    messages: readonly ModelMessage[],
    tools: readonly ToolDefinition[],
    budget: RunBudget,
    signal: AbortSignal,
    beforeRequest?: () => void,
  ): Promise<ToolTurn>;
};

export function validateToolMessages(messages: readonly ModelMessage[]): void {
  const pending = new Set<string>(),
    seen = new Set<string>();
  for (const message of messages) {
    if (message.role === "tool")
      ensure(
        pending.delete(message.tool_call_id),
        "MODEL_PROTOCOL",
        "نتیجه ابزار با درخواست آن تطبیق ندارد.",
        502,
      );
    else {
      ensure(pending.size === 0, "MODEL_PROTOCOL", "یک ابزار هنوز نتیجه ندارد.", 502);
      if (message.role === "assistant")
        for (const call of message.tool_calls ?? []) {
          ensure(!seen.has(call.id), "MODEL_PROTOCOL", "شناسه درخواست ابزار تکراری است.", 502);
          seen.add(call.id);
          pending.add(call.id);
        }
    }
  }
  ensure(!pending.size, "MODEL_PROTOCOL", "یک ابزار هنوز نتیجه ندارد.", 502);
}

// Separate from the historical one-evidence-tool diagnosis protocol.
export class GoalModelClient implements ModelPort {
  readonly config: Config;
  readonly send: Transport;
  constructor(config: Config, send: Transport = transport) {
    this.config = config;
    this.send = send;
  }
  async complete(
    messages: readonly ModelMessage[],
    tools: readonly ToolDefinition[],
    budget: RunBudget,
    signal: AbortSignal,
    beforeRequest?: () => void,
  ): Promise<ToolTurn> {
    const c = this.config;
    ensure(
      c.enableLiveModel,
      "LIVE_MODEL_DISABLED",
      "دستیار در این نصب فعال نیست. از مسئول نصب بخواهید دسترسی مدل را بررسی کند.",
      403,
    );
    ensure(
      c.modelKey &&
        permittedChatModels.includes(c.modelId) &&
        c.modelBaseUrl === "https://ai.boxapi.ir/ai/v1",
      "MODEL_UNCONFIGURED",
      "تنظیمات دستیار کامل نیست.",
      503,
    );
    ensure(
      messages.length > 0 && messages.length <= 80 && tools.length > 0 && tools.length <= 16,
      "MODEL_INPUT_LIMIT",
      "مکالمه به سقف بررسی رسیده است.",
      413,
    );
    validateToolMessages(messages);
    const secrets = [c.modelKey, c.liaraToken, c.operatorToken, c.sessionSecret, ...c.projectSecretValues].filter(Boolean);
    const body = JSON.stringify({
      model: c.modelId,
      messages: messages.map((message) => ({
        ...message,
        content:
          typeof message.content === "string" ? redact(message.content, secrets) : message.content,
      })),
      tools: tools.map(({ type, function: definition }) => ({ type, function: definition })),
      parallel_tool_calls: false,
      stream: false,
      reasoning_effort: c.modelReasoningEffort,
      max_completion_tokens: c.modelOutputTokens,
    });
    ensure(
      Buffer.byteLength(body) <= 96 * 1024,
      "MODEL_INPUT_LIMIT",
      "حجم بررسی بیشتر از سقف است.",
      413,
    );
    budget.take("model", signal);
    beforeRequest?.(); // Durable reservation before the network request; unknown usage is not zero.
    const boundedSignal = budget.signal(signal);
    try {
      return await abortable(async () => {
        const response = await this.send(`${c.modelBaseUrl}/chat/completions`, {
          method: "POST",
          redirect: "error",
          cache: "no-store",
          signal: boundedSignal,
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.modelKey}` },
          body,
        });
        if (!response.ok) {
          await response.body?.cancel();
          throw httpFailure(response.status);
        }
        const raw = object(await boundedJson(response, 128 * 1024));
        if (raw.usage !== undefined && raw.usage !== null)
          budget.observedTokens =
            (budget.observedTokens ?? 0) + integer(object(raw.usage).total_tokens, 0, 1000000);
        ensure(
          Array.isArray(raw.choices) && raw.choices.length === 1,
          "MODEL_PROTOCOL",
          "مدل پاسخ واحد معتبر نداد.",
          502,
        );
        const choice = object(raw.choices[0]),
          message = object(choice.message);
        ensure(
          message.role === "assistant" && !message.refusal && !boundedSignal.aborted,
          "MODEL_INCOMPLETE",
          "پاسخ دستیار کامل نشد.",
          502,
        );
        const usage =
          raw.usage === undefined || raw.usage === null
            ? null
            : integer(object(raw.usage).total_tokens, 0, 1000000);
        if (choice.finish_reason === "stop") {
          ensure(!message.tool_calls, "MODEL_PROTOCOL", "پاسخ پایانی ابزار بدون نتیجه دارد.", 502);
          return { calls: [], content: redact(text(message.content, 12000), secrets), usage };
        }
        ensure(
          choice.finish_reason === "tool_calls" &&
            Array.isArray(message.tool_calls) &&
            message.tool_calls.length === 1,
          "MODEL_INCOMPLETE",
          "پاسخ قطع شده یا تعداد ابزارها معتبر نیست.",
          502,
        );
        const call = object(message.tool_calls[0]),
          fn = object(call.function);
        const name = identifier(fn.name),
          id = identifier(call.id),
          args = text(fn.arguments, 32768);
        ensure(
          call.type === "function" && tools.some((tool) => tool.function.name === name),
          "TOOL_DENIED",
          "دستیار ابزار خارج از محدوده درخواست کرد.",
          403,
        );
        let parsed: Record<string, unknown>;
        try {
          parsed = object(JSON.parse(args));
        } catch {
          throw new AppError("MODEL_PROTOCOL", "آرگومان ابزار معتبر نیست.", 502);
        }
        const definition = tools.find((tool) => tool.function.name === name);
        ensure(definition, "TOOL_DENIED", "ابزار مجاز نیست.", 403);
        if (definition.argumentValidation !== "application") {
          exactKeys(parsed, Object.keys(definition.function.parameters.properties));
          ensure(
            definition.function.parameters.required.every((key) => key in parsed),
            "MODEL_PROTOCOL",
            "اطلاعات لازم ابزار کامل نیست.",
            502,
          );
        }
        return {
          calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(parsed) } }],
          content: null,
          usage,
        };
      }, boundedSignal);
    } catch (error) {
      if (boundedSignal.aborted)
        throw new AppError(
          signal.aborted ? "CANCELLED" : "BUDGET_EXHAUSTED",
          "بررسی کامل نشد؛ درخواست خودکار تکرار نمی‌شود.",
          409,
        );
      if (error instanceof AppError) throw error;
      throw new AppError(
        "MODEL_TRANSPORT",
        "پاسخ دستیار دریافت نشد؛ درخواست خودکار تکرار نشد.",
        502,
      );
    }
  }
}
