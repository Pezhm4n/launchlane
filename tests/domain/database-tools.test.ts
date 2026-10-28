import assert from "node:assert/strict";
import { test } from "node:test";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";
import { LiaraDatabaseReadClient } from "../../src/server/liara/database-read.ts";
import { currentAgentContext, executeAgentTool, toolsForAgent, toolsForConversation } from "../../src/server/agent/tools.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { GoalModelClient, maxModelToolDefinitions } from "../../src/server/agent/model.ts";
import { object } from "../../src/contracts/validation.ts";

test("Agent and shared MCP registry expose account-bound read-only database metadata with the existing budget", async () => {
  const f = await agentFixture();
  try {
    const accountId = "a".repeat(24), teamId = "b".repeat(24), databaseId = "c".repeat(24), token = "synthetic-database-tools-token";
    const config = {...f.config, teamId, liaraToken:token, enableLiveLiara:true, enableMutations:false};
    f.store.saveConnection(f.session.actorId, {source:"token", ciphertext:sealCredential(token, config.sessionSecret, f.session.actorId, "liara"),
      view:{provider:"liara", status:"connected", identityId:accountId, displayName:"fixture", login:"test@example.test", teamId, teamName:"fixture", checkedAt:Date.now(), apps:[], selectedApp:null}});
    let reads = 0;
    const database = new LiaraDatabaseReadClient(config, accountId, async (url, init) => {
      reads++; assert.equal(init.method,"GET"); assert.equal(new URL(url).searchParams.get("teamID"),teamId);
      if (new URL(url).pathname === "/v1/me") return Response.json({user:{_id:accountId},team:{_id:teamId,balance:100_000},
        databaseVersions:{postgres:[{value:"16.4"}]},
        plans:{databases:{"g2":{available:true,supports:["postgres"],price:100}},
          databaseBundlePlans:{"g2":{basic:{available:true,price:10}}}}});
      assert.equal(new URL(url).pathname,"/v1/databases"); return Response.json({databases:[{_id:databaseId,hostname:"fixture-postgres",type:"postgres",status:"RUNNING"}]});
    });
    const budget = new RunBudget({maxModelCalls:0,maxToolCalls:8,runTimeoutMs:3000}), context = {config, store:f.store, actorId:f.session.actorId,
      context:currentAgentContext(config,f.store,f.session.actorId), createdAt:Date.now(), budget, signal:AbortSignal.timeout(3000), database};
    for (const tools of [toolsForAgent(config),toolsForConversation(config)]) {
      const database = tools.find(tool => tool.function.name === "read_database_resources");
      assert.ok(database);
      assert.deepEqual(object(object(database.function.parameters).properties).view, {
        type: "string", enum: ["inventory", "capabilities", "identity", "quote"] });
    }
    assert.equal(toolsForAgent({...config,enableLiveLiara:false}).some(tool => tool.function.name === "read_database_resources"),false);
    const result = await executeAgentTool("read_database_resources",{view:"identity",databaseId},context);
    assert.ok(result && typeof result === "object" && "outcome" in result && result.outcome === "observed");
    assert.equal(reads,2); assert.equal(budget.toolCalls,2); assert.equal(budget.modelCalls,0);
    const quote = await executeAgentTool("read_database_resources",{view:"quote",type:"postgres",version:"16.4",planId:"g2",bundleId:"basic"},context);
    assert.ok(quote && typeof quote === "object" && "planHourlyToman" in quote && quote.planHourlyToman === 100);
    assert.equal(reads,3); assert.equal(budget.toolCalls,3);
    const readsBeforeInvalid = reads;
    for (const args of [{view:"quote",type:"postgres",version:"16.4",planId:"g2"},{view:"quote",type:"bad type",version:"16.4",planId:"g2",bundleId:"basic"},
      {view:"quote",type:"postgres",version:"16.4",planId:"g2",bundleId:"basic",extra:true}]) {
      await assert.rejects(executeAgentTool("read_database_resources",args,context));
    }
    assert.equal(reads,readsBeforeInvalid,"invalid quote inputs are rejected before provider reads");
    for (const args of [{view:"identity"},{view:"inventory",databaseId},{view:"identity",databaseId:"wrong"},{view:"delete",databaseId},{view:"inventory",password:"forbidden"}]) {
      await assert.rejects(executeAgentTool("read_database_resources",args,context));
    }
    assert.equal(reads,readsBeforeInvalid,"invalid inputs are rejected before provider reads");
    assert.equal(JSON.stringify(result).includes(token),false);
    let modelRequests = 0;
    const model = new GoalModelClient(config, async () => {
      modelRequests++; return Response.json({choices:[{finish_reason:"stop",message:{role:"assistant",content:"bounded result"}}],usage:{total_tokens:1}});
    });
    const modelBudget = new RunBudget({maxModelCalls:2,maxToolCalls:8,runTimeoutMs:3000});
    await model.complete([{role:"user",content:"Read available resource metadata"}],toolsForAgent({...config,enableMutations:true,enableLocalRepair:true}),modelBudget,AbortSignal.timeout(3000));
    assert.equal(modelRequests,1);
    const one = toolsForAgent(config)[0]; assert.ok(one);
    await assert.rejects(model.complete([{role:"user",content:"bounded"}],Array.from({length:maxModelToolDefinitions+1},()=>one),modelBudget,AbortSignal.timeout(3000)),{code:"MODEL_INPUT_LIMIT"});
    assert.equal(modelRequests,1); assert.equal(modelBudget.modelCalls,1);
  } finally {f.close();}
});
