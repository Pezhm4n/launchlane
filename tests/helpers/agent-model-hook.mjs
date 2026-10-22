// Loaded only into the disposable production test server, never imported by application code.
import { appendFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
const nativeFetch = globalThis.fetch;
const reply = (name, args = {}) =>
  Response.json({
    choices: [
      {
        finish_reason: "tool_calls",
        message: {
          role: "assistant",
          tool_calls: [
            {
              id: randomUUID(),
              type: "function",
              function: { name, arguments: JSON.stringify(args) },
            },
          ],
        },
      },
    ],
    usage: { total_tokens: 40 },
  });
const final = (
  nextAction = "connect_account",
  question = "حساب مقصد را متصل کنید.",
  message = "فایل‌ها بررسی شدند؛ انتشار انجام نشده است.",
) =>
  Response.json({
    choices: [
      {
        finish_reason: "stop",
        message: {
          role: "assistant",
          content: JSON.stringify({
            state: question ? "needs_input" : "partially_completed",
            message,
            question,
            nextAction,
          }),
        },
      },
    ],
    usage: { total_tokens: 25 },
  });
globalThis.fetch = async (input, init) => {
  const url = new URL(
    typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
  );
  if (url.origin !== "https://ai.boxapi.ir") {
    if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname))
      throw new Error("External request denied in isolated agent test");
    return nativeFetch(input, init);
  }
  const body = JSON.parse(String(init?.body)),
    last = body.messages.at(-1),
    first = body.messages.find((message) => message.role === "user")?.content ?? "";
  appendFileSync(
    process.env.LAUNCHLANE_AGENT_FIXTURE_LOG,
    `${JSON.stringify({
      at: Date.now(),
      worker: body.tools.some((tool) => tool.function.name === "submit_patch"),
    })}\n`,
  );
  if (first.includes("آزمون خطای ارتباط"))
    return new Response("synthetic provider unavailable", { status: 429 });
  if (first.includes("آزمون توقف"))
    return new Promise((_, reject) =>
      init?.signal?.addEventListener("abort", () => reject(new Error("cancelled")), { once: true }),
    );
  if (body.tools.some((tool) => tool.function.name === "submit_patch")) {
    const request = JSON.parse(last.content),
      source = request.files.find((file) => file.path === "invoice.mjs");
    return reply("submit_patch", {
      baseRevision: request.baseRevision,
      files: [
        {
          path: source.path,
          beforeHash: source.sha256,
          content: source.content.replace("sum + line.price,", "sum + line.price * line.quantity,"),
        },
      ],
    });
  }
  if (last.role === "user") {
    if (last.content.startsWith("Host local repair receipt"))
      return final(
        "reply",
        null,
        "خطای تعداد در نسخه جدا اصلاح شد و همان آزمون موجود گذشت. سایت هنوز تغییر نکرده است.",
      );
    return reply("inspect_project");
  }
  const result = JSON.parse(last.content);
  if (!result.ok) return final("choose_project", "پروژه را انتخاب کنید.");
  if ("runtime" in result.data)
    return first.includes("فاکتور")
      ? reply("read_project_file", { path: "invoice.mjs" })
      : reply("read_destination");
  if (result.data.path === "invoice.mjs")
    return reply("read_project_file", { path: "invoice.test.mjs" });
  if (result.data.path === "invoice.test.mjs")
    return reply("propose_code_repair", {
      goal: "تعداد کالا در محاسبه فاکتور اعمال شود.",
      allowedPaths: ["invoice.mjs"],
      testFiles: ["invoice.test.mjs"],
    });
  return final();
};
