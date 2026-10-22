import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { object } from "../../src/contracts/validation.ts";
import { GoalModelClient } from "../../src/server/agent/model.ts";
import { createAgentRun, driveAgentRun, continueAgentRun } from "../../src/server/agent/runs.ts";
import { AgentRepository } from "../../src/server/agent/store.ts";
import { agentFixture } from "../helpers/agent-fixture.ts";

test("typed completion preserves evidence, reload and follow-up without pretending to publish", async () => {
  const f = await agentFixture();
  try {
    let requests = 0;
    const model = new GoalModelClient(f.config, async (_url, init) => {
      const body = object(JSON.parse(String(init.body)));
      assert.ok(Array.isArray(body.tools));
      assert.ok(body.tools.map(object).some(tool => object(tool.function).name === "finish_investigation"));
      return Response.json({choices:[{finish_reason:"tool_calls",message:{role:"assistant",tool_calls:[{
        id:randomUUID(),type:"function",function: requests++ === 0
          ? {name:"inspect_project",arguments:"{}"}
          : {name:"finish_investigation",arguments:JSON.stringify({state:"partially_completed",
            message:"فایل‌ها بررسی شدند؛ انتشار انجام نشد.",question:null,nextAction:"reply"})},
      }]}}],usage:{total_tokens:50}});
    });
    const run = createAgentRun(f.config,f.store,f.session,randomUUID(),"فقط روش اجرای پروژه را بررسی کن",f.flow.id).run;
    await driveAgentRun(f.config,f.store,f.session,run.id,{model});
    const repo = new AgentRepository(f.store), saved = repo.get(f.session.actorId,run.id);
    assert.ok(saved);
    assert.equal(saved.state,"partially_completed");
    assert.equal(saved.question,null);
    assert.equal(saved.effect,"no_remote_changes");
    assert.equal(saved.events.at(-1)?.kind,"assistant");
    assert.equal(saved.usage.modelCalls,2);
    assert.equal(saved.usage.toolCalls,1);
    repo.get(f.session.actorId,run.id);
    assert.equal(requests,2);
    continueAgentRun(f.config,f.store,f.session,run.id,saved.revision,randomUUID(),"همین نتیجه را خلاصه کن");
    await driveAgentRun(f.config,f.store,f.session,run.id,{model});
    assert.equal(repo.get(f.session.actorId,run.id)?.state,"partially_completed");
    assert.equal(requests,3);
    assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM attempts").get()?.n,0);
  } finally { f.close(); }
});

test("typed completion cannot invent success or replace a missing evidence receipt", async () => {
  for (const mode of ["no_evidence","completed","unknown_fields"] as const) {
    const f = await agentFixture();
    try {
      let requests = 0;
      const model = new GoalModelClient(f.config,async () => Response.json({choices:[{
        finish_reason:"tool_calls",message:{role:"assistant",tool_calls:[{
          id:randomUUID(),type:"function",function: mode !== "no_evidence" && requests++ === 0
            ? {name:"inspect_project",arguments:"{}"}
            : {name:"finish_investigation",arguments:JSON.stringify({
              state:mode === "completed" ? "completed" : "partially_completed",
              message:"بررسی تمام شد",question:null,nextAction:"reply",
              ...(mode === "unknown_fields" ? {approved:true} : {}),
            })},
        }]},
      }],usage:{total_tokens:50}}));
      const run = createAgentRun(f.config,f.store,f.session,randomUUID(),"پروژه را بررسی کن",f.flow.id).run;
      await driveAgentRun(f.config,f.store,f.session,run.id,{model});
      const saved = new AgentRepository(f.store).get(f.session.actorId,run.id);
      assert.equal(saved?.state,"failed");
      assert.equal(saved.effect,"no_remote_changes");
      assert.equal(saved.errorCode,mode === "unknown_fields" ? "INVALID_INPUT" : "OUTCOME_UNVERIFIED");
    } finally { f.close(); }
  }
});
