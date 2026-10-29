/** Local production browser regression. Supply PLAYWRIGHT_MODULE_PATH for a bundled Playwright; no install or data fetch. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, writeFile, readdir, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { getNavigationCategories } from '../src/navigation.ts';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const output = 'docs/evidence/civic-explorer';
await mkdir(output, { recursive: true });
const port = 4291, url = `http://127.0.0.1:${port}/taipei-feitsui-water-map/`;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { env: { ...process.env, GITHUB_PAGES: 'true' }, stdio: 'ignore', windowsHide: true });
const checks = [], loading = [], errors = [];
let browser;
async function check(name, run) { try { await run(); checks.push({name, pass:true}); } catch (error) { checks.push({name, pass:false, error:String(error)}); throw error; } }
async function contextFor(language='en', width=1440) {
 const context = await browser.newContext({ viewport: {width,height:1000}, serviceWorkers:'block', reducedMotion:'reduce' });
 await context.addInitScript(lang => localStorage.setItem('language',lang),language);
 // Map tiles are unrelated external images. Use a deterministic local image, never request external datasets.
 await context.route('https://**.tile.openstreetmap.org/**',route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8L0AAAAASUVORK5CYII=','base64')}));
 return context;
}
const entry = page => page.getByRole('button',{name:/^(Explore Topics|探索主題)$/});
const back = page => page.getByRole('button',{name:/Return to Dashboard|返回儀表板/});
try {
 for(let i=0;i<40;i++){try{if((await fetch(url)).ok)break;}catch{}await new Promise(r=>setTimeout(r,150));}
 browser=await chromium.launch({channel:'msedge',headless:true});
 for(const hash of ['', '#preparedness', '#river-policy']) {
  const context=await contextFor();const page=await context.newPage();const requests=[];
  page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const start=Date.now();await page.goto(url+hash,{waitUntil:'networkidle'});const elapsedMs=Date.now()-start;
  const initialData=requests.filter(u=>u.includes('/data/'));const initialJs=requests.filter(u=>u.endsWith('.js'));
  await check(`cold ${hash || 'default'} lazy loading`,async()=>{
   assert.ok(!initialJs.some(u=>u.includes('CivicExplorer')));
   assert.equal(await page.locator('.data-explorer').count(),0);
   if(hash)assert.ok(initialData.every(u=>u.includes(hash==='#preparedness'?'/preparedness-decision/':'/river-water-policy/')));
  });
  const selects=page.locator('[data-dashboard] select');let retained;
  if(await selects.count()) {const first=selects.first();const options=await first.locator('option').count();if(options>1)await first.selectOption({index:1});retained=await first.inputValue();}
  await entry(page).focus();await page.keyboard.press('Enter');await page.locator('.data-explorer h1').waitFor();
  await check(`Explorer ${hash || 'default'} adds zero JSON requests`,async()=>{
   await page.waitForLoadState('networkidle');assert.equal(requests.filter(u=>u.includes('/data/')).length,initialData.length);
   assert.equal(await page.locator('.explore-hub').count(),5);assert.equal(await page.locator('[data-module]').count(),21);
   assert.equal(await page.locator('.data-explorer h1').evaluate(el=>document.activeElement===el),true);
  });
  await back(page).click();
  await check(`return ${hash || 'default'} preserves state and focus`,async()=>{
   await page.waitForFunction(()=>document.activeElement?.classList.contains('explorer-entry'));
   if(retained!==undefined)assert.equal(await selects.first().inputValue(),retained);
   if(!hash) { assert.ok(await page.locator('.leaflet-container').isVisible()); assert.ok(await page.locator('.recharts-wrapper').count()); await page.locator('.leaflet-control-zoom-in').click(); }
  });
  loading.push({hash,elapsedMs,initialDataRequests:initialData.map(u=>u.split('/data/')[1]),initialJs:initialJs.map(u=>u.split('/').pop()),explorerAdditionalDataRequests:requests.filter(u=>u.includes('/data/')).length-initialData.length});
  if(hash) {
   await entry(page).click();await page.locator('[data-module="waterQuality"]').focus();await page.keyboard.press('Enter');
   await check('cold '+hash+' to legacy destination focus',async()=>{
    await page.waitForFunction(()=>document.activeElement?.tagName==='H1' && document.activeElement.closest('[data-dashboard]'));
    assert.ok(await page.locator('.leaflet-container').isVisible());
   });
  }
  await context.close();
 }
 for(const language of ['en','zh'])for(const width of [320,390,768,1440]) {
  const context=await contextFor(language,width);const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(url+'#preparedness',{waitUntil:'networkidle'});await entry(page).click();await page.locator('.data-explorer h1').waitFor();
  const prefix=`${language}/${width}`;
  await check(`${prefix} responsive complete catalogue and touch targets`,async()=>{
   assert.equal(await page.locator('[data-module]').count(),21);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.deepEqual(await page.locator('.data-explorer button').evaluateAll(els=>els.filter(el=>{const r=el.getBoundingClientRect();return r.width<43.9||r.height<43.9}).map(el=>el.textContent)),[]);
  });
  if((language==='en'&&width===1440)||(language==='zh'&&width===390)) await page.screenshot({path:`${output}/${language}-${width}.png`,fullPage:true});
  const hubs=page.locator('.explore-hub');await hubs.nth(2).focus();await page.keyboard.press('Enter');
  await check(`${prefix} keyboard category selection reduced motion`,async()=>{
   assert.equal(await hubs.nth(2).getAttribute('aria-pressed'),'true');assert.equal(await page.locator('[data-module]').count(),6);
   assert.equal(await page.locator('.explore-results h2').evaluate(el=>document.activeElement===el),true);
   assert.equal(await hubs.nth(2).locator('.explore-lift').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
   assert.equal(await hubs.nth(2).locator('.explore-lift').evaluate(el=>getComputedStyle(el).transform),'none');
  });
  await page.keyboard.press('Escape');await page.waitForFunction(()=>document.activeElement?.getAttribute('data-explore-group')==='rivers');await check(`${prefix} Escape restores hub focus`,async()=>assert.equal(await hubs.nth(2).evaluate(el=>document.activeElement===el),true));
  const search=page.locator('.explore-controls input');await search.fill(language==='zh'?'Heavy-Rain':'河川監測');
  await check(`${prefix} bilingual keyword search`,async()=>assert.equal(await page.locator('[data-module]').getAttribute('data-module'),language==='zh'?'preparednessDecision':'riverWaterPolicy'));
  await search.fill('unmatchable-module-987');await page.locator('.explore-empty button').click();await page.waitForFunction(()=>document.activeElement?.getAttribute('type')==='search');
  await check(`${prefix} empty reset restores search focus`,async()=>{assert.equal(await search.evaluate(el=>document.activeElement===el),true);assert.equal(await page.locator('[data-module]').count(),21);});
  await page.locator('.explore-hub').first().click();await page.locator('.explore-view button').nth(1).click();await page.locator('.explore-status button').click();await page.waitForFunction(()=>document.activeElement?.matches('.explore-results h2'));
  await check(`${prefix} HTML list fallback`,async()=>{assert.equal(await hubs.count(),0);assert.equal(await page.locator('.explore-result-group li').count(),21);});
  await context.close();
 }
 const context=await contextFor();const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url,{waitUntil:'networkidle'});
 for(const category of getNavigationCategories('en'))for(const tab of category.tabs) {
  await entry(page).click();await page.locator(`[data-module="${tab.id}"]`).click();
  await check(`host target ${category.id}/${tab.id}`,async()=>{
   assert.equal(await page.locator('.data-explorer').count(),0);
   assert.equal(await page.locator('.module-tabs button.active').textContent(),tab.label);
   if(['hydromet','operation','combinedDashboard'].includes(tab.id)) assert.ok(await page.locator('.recharts-wrapper').count(),tab.id+' charts');
   if(['waterQuality','pumpingStations','sedimentationBasins'].includes(tab.id)) assert.ok(await page.locator('.leaflet-container').isVisible(),tab.id+' map');
   if(tab.id==='riverWaterQuality') {const locations=JSON.parse(await readFile('public/data/river-station-locations.json','utf8'));assert.equal(await page.locator('.leaflet-container').count(),locations.length?1:0);assert.ok(await page.locator('.recharts-wrapper').count());}
   if(tab.id==='dataTable') assert.ok(await page.locator('.table-wrap tbody tr').count(), 'table rows');
   await page.waitForLoadState('networkidle');assert.ok(await page.locator('[data-dashboard] h1').isVisible());
  });
 }
 await context.close();
 const failureContext=await contextFor();const failurePage=await failureContext.newPage();
 await failurePage.route('**/CivicExplorer-*.js',route=>route.abort());
 await failurePage.goto(url+'#river-policy',{waitUntil:'networkidle'});await entry(failurePage).click();
 await check('optional chunk failure retains all 21 native module buttons and return',async()=>{
  await failurePage.getByRole('heading',{name:'Topic list'}).waitFor();await failurePage.waitForFunction(()=>document.activeElement?.textContent==='Topic list');assert.equal(await failurePage.locator('main li button').count(),21);await back(failurePage).click();assert.ok(await entry(failurePage).isVisible());
 });
 await entry(failurePage).click();
 await check('reopening cached chunk failure restores fallback focus',async()=>{await failurePage.waitForFunction(()=>document.activeElement?.textContent==='Topic list');await back(failurePage).click();});
 await failureContext.close();
 await check('no unexpected browser errors',async()=>assert.deepEqual(errors,[]));
} finally {
 if(browser)await browser.close();server.kill();
 const bundles=[];for(const file of await readdir('dist/assets'))if(/\.(js|css)$/.test(file)){const data=await readFile('dist/assets/'+file);bundles.push({file,bytes:data.length,gzipBytes:gzipSync(data).length});}
 await writeFile(`${output}/browser-results.json`,JSON.stringify({date:'2026-10-29',scope:'Local Edge production Pages build; service workers blocked; external map tiles stubbed; no official data fetched.',checks,loading,errors,bundles},null,2)+'\n');
 console.log(JSON.stringify({passed:checks.filter(c=>c.pass).length,failed:checks.filter(c=>!c.pass),errors}));
}
