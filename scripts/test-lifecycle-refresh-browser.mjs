import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import {startTestServer} from './test-server.mjs';
import {seedDestinationProposal} from '../tests/helpers/destination-proposal.mjs';
import {fingerprint} from '../src/server/policy/action.ts';
const baseline=process.argv.includes('--baseline');
const server=await startTestServer({agentFixture:true}),browser=await chromium.launch({headless:true});
const context=await browser.newContext({locale:'fa-IR',reducedMotion:'reduce'}),page=await context.newPage();
const output=resolve('.artifacts/lifecycle-refresh',new Date().toISOString().replaceAll(':','-'));
const errors=[],posts=[],lifecycleReads=[];let fixture,created=false;
page.on('pageerror',error=>errors.push(error.message));
page.on('request',request=>{if(request.method()==='POST')posts.push(new URL(request.url()).pathname)});
await context.route('**/*',route=>new URL(route.request().url()).origin===server.origin?route.continue():route.abort());
try{
 await mkdir(output,{recursive:true});
 const boot=await fetch(server.origin+"/api/workspace"); await boot.arrayBuffer(); assert.equal(boot.status,401);
 fixture=await seedDestinationProposal(server);
 const flow=fixture.store.getProjectFlow(fixture.actor),input={projectId:flow.id,sourceHash:flow.profile.sourceHash,path:'/',expectedText:null};
 fixture.run.mission={...input,kind:'publication',identity:fingerprint({input,context:fixture.run.context})};
 fixture.run.state='working';fixture.repository.save(fixture.actor,fixture.run);
 await context.route('**/api/agent/runs/'+fixture.run.id,async route=>{
  const response=await route.fetch(),data=await response.json();
  // Controlled UI receipt only. No action is approved or executed in the test Store.
  if(created){data.run.state='completed';data.run.effect='destination_created';data.run.nextAction='reply';data.run.destination.state='succeeded';}
  await route.fulfill({response,json:data});
 });
 await context.route('**/api/projects/lifecycle?*',async route=>{
  const response=await route.fetch(),data=await response.json();lifecycleReads.push(data.app);
  await route.fulfill({response,json:data});
 });
 const firstLifecycle=page.waitForResponse(response=>response.url().includes('/api/projects/lifecycle?'));
 await page.goto(server.origin);await page.getByLabel('کلید ورود محلی',{exact:true}).fill(server.token);
 await page.getByRole('button',{name:'ورود به میز کار',exact:true}).click();
 await page.locator('.destination-card').waitFor();
 await firstLifecycle;
 assert.ok(lifecycleReads.includes(null));assert.equal(await page.getByText('مدیریت مقصد در لیارا',{exact:true}).count(),0);
 const connection=fixture.store.getConnection(fixture.actor,'liara');
 fixture.store.saveConnection(fixture.actor,{...connection,view:{...connection.view,apps:[{id:'c'.repeat(24),name:server.app,platform:'node'}],selectedApp:server.app}});
 created=true;
 await page.locator('.publication-journey .badge').filter({hasText:'نتیجه بررسی و تأیید شد'}).waitFor();
 if(baseline){
  assert.equal(await page.getByText('مدیریت مقصد در لیارا',{exact:true}).count(),0);
  console.log(JSON.stringify({baselineBugReproduced:true,initialLifecycleReads:lifecycleReads.length,createdDestinationHidden:true}));
 }else{
  const summary=page.locator('summary').filter({hasText:'مدیریت مقصد در لیارا'});await summary.waitFor();
  assert.equal(lifecycleReads.at(-1),server.app);
  await summary.press('Enter');
  const panel=page.locator('details').filter({has:page.locator('summary',{hasText:'مدیریت مقصد در لیارا'})}).last();
  await panel.getByRole('button',{name:'توقف برنامه…',exact:true}).waitFor();
  assert.equal(await panel.getByRole('button',{name:'حذف مقصد از لیارا…',exact:true}).count(),0);
  for(const width of [280,390,1280]){
   await page.setViewportSize({width,height:900});await page.evaluate(()=>document.fonts.ready);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
   assert.deepEqual(axe.violations.map(row=>row.id),[]);
  }
  await page.screenshot({path:join(output,'controls.png'),fullPage:true});
  await page.reload();await summary.waitFor();
  assert.equal(posts.includes('/api/projects/lifecycle'),false);assert.equal(fixture.store.db.prepare('SELECT count(*) n FROM attempts').get().n,0);
  assert.deepEqual(errors,[]);
  const result={automaticRefresh:true,lifecycleReads,layouts:3,axeViolations:0,reload:true,provider:'synthetic',cloudWrites:0};
  await writeFile(join(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }
}catch(error){await page.screenshot({path:join(output,'failure.png'),fullPage:true});throw error;}
finally{fixture?.store.close();await context.close();await browser.close();await server.close();}
