const baseline = require("./fixtures/v81-baseline.json");
// Run against a local checkout or a deployed URL with SHEET_URL=https://...
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
(async () => {
  let server, browser;
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "infinity-v81-"));
  try {
    let url = process.env.SHEET_URL;
    if (!url) {
      server = http.createServer((req,res)=>{
        const name=decodeURIComponent(new URL(req.url,"http://localhost").pathname).replace(/^\/+/, "") || "index.html";
        const file=path.resolve(name);
        if (!file.startsWith(process.cwd()+path.sep)) { res.writeHead(403);res.end();return; }
        const ext=path.extname(file);
        const mime={".js":"application/javascript",".html":"text/html; charset=utf-8",".css":"text/css",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml"};
        fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);res.end();}else{res.setHeader("Content-Type",mime[ext]||"application/octet-stream");res.end(data);}});
      });
      await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
      url="http://127.0.0.1:"+server.address().port+"/";
    }
    browser=await chromium.launch({headless:true});
    const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
    const errors=[];
    page.on("pageerror",err=>errors.push(String(err)));
    page.on("dialog",d=>d.accept());
    await page.goto(url,{waitUntil:"domcontentloaded"});
    await page.locator('select[data-talent-select="0"]').waitFor();
    await page.waitForFunction(build=>window.INFINITY_BUILD===build,baseline.build);
    assert.equal(await page.evaluate(()=>window.INFINITY_DATA.traits.length),baseline.counts.traits);
    assert.equal(await page.evaluate(()=>window.INFINITY_DATA.talents.length),baseline.counts.talents);
    const career=page.locator('select[data-field="career"]');
    if(await career.locator('option[value="General / Unrestricted"]').count()) await career.selectOption("General / Unrestricted");
    const choose=(kind,index,value)=>page.locator('select[data-'+kind+'-select="'+index+'"]').selectOption(value);
    await page.locator('select[data-main-skill="Willpower"]').selectOption("7");
    await page.locator('select[data-main-skill="Agility"]').selectOption("7");
    const rating=skill=>page.locator('[data-rating="'+skill+'"]').innerText().then(Number);
    const before=await rating("Discipline");
    await choose("trait",0,"Cammo - TO 2");
    await choose("trait",1,"Cammo - TO 1");
    await choose("talent",0,"Marksman Level 3");
    await choose("talent",1,"Marksman Level 1");
    assert.equal(await rating("Discipline"),before+4);
    assert.equal(await page.locator('[data-focus="Agility"]').count(),0);
    assert.equal(await page.locator('[data-focus="Acrobatics"]').count(),1);
    const acro=await rating("Acrobatics");
    await page.locator('select[data-main-skill="Agility"]').selectOption("8");
    assert.equal(await rating("Acrobatics"),acro+1);
    await choose("talent",0,"Spy");
    await choose("talent",1,"");
    for(const [key,value] of Object.entries({"Counter Intelligence|Intelligence":"Hacking","Espionage|Intelligence":"Medicine","Espionage|Awareness":"Observation","Spy|Intelligence":"Tech","Spy|Awareness":"Survival"})){
      await page.locator('select[data-talent-grant-key="'+key+'"]').first().selectOption(value);
    }
    const saved=await page.evaluate(()=>collectState());
    assert.equal(saved.talentGrantChoices["Spy|Awareness"],"Survival");
    assert.equal(saved.houseRuleBuild,baseline.build);
    await page.locator('input[data-field="characterName"]').fill("V81 Smoke Test");
    const downloadPromise=page.waitForEvent("download");
    await page.locator("#exportXmlBtn").click();
    const download=await downloadPromise;
    const file=path.join(temp,"character.xml");
    await download.saveAs(file);
    assert.ok(fs.readFileSync(file,"utf8").includes("talentGrantChoices"));
    await page.locator('input[data-field="characterName"]').fill("Changed");
    await page.locator("#importXmlFile").setInputFiles(file);
    await page.waitForFunction(()=>document.querySelector('input[data-field="characterName"]').value==="V81 Smoke Test");
    assert.equal(await page.evaluate(()=>collectState().talentGrantChoices["Spy|Awareness"]),"Survival");
    await page.evaluate(()=>{const state=collectState();delete state.houseRuleBuild;state.traits=["Dogged","Berserk",""];state.talents=["Counter-Intel","",""];applyState(state);});
    assert.equal(await page.locator('select[data-trait-select="0"]').inputValue(),"Unshakable");
    assert.equal(await page.locator('select[data-trait-select="1"]').inputValue(),"Dogged");
    assert.equal(await page.locator('select[data-talent-select="0"]').inputValue(),"Counter Intelligence");
    await page.locator("#randomBeginnerCharacterBtn").click();
    await page.waitForFunction(()=>!!document.querySelector('input[data-field="characterName"]').value);
    const random=await page.evaluate(()=>collectState());
    assert.equal(random.weapons.length,5);
    assert.equal(random.equipment.length,10);
    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.locator('select[data-trait-select="0"]').isVisible());
    assert.deepEqual(errors,[]);
    console.log("PASS: browser boot, ability selection, rank skill gains, Acrobatics/Agility, choice grants, XML round trip, legacy aliases, beginner generation and mobile controls.");
  } finally {
    if(browser) await browser.close();
    if(server) await new Promise(resolve=>server.close(resolve));
    fs.rmSync(temp,{recursive:true,force:true});
  }
})().catch(err=>{console.error(err);process.exitCode=1;});
